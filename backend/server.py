"""YKNOVA Studio API v3 — backward-compatible extension of the v2 Render API (same SQLite schema, additive migrations)."""
import os, sqlite3, json, secrets, hashlib, hmac, base64, time, uuid, re, zipfile, csv, io, logging, html as htmllib
import urllib.request, urllib.error
from pathlib import Path
from datetime import datetime, timezone, timedelta
from collections import defaultdict, deque
from typing import Optional
from dotenv import load_dotenv
load_dotenv(Path(__file__).parent / '.env')
import jwt
from fastapi import FastAPI, HTTPException, Depends, Header, UploadFile, File, Form, Request, Query
from fastapi.responses import FileResponse, HTMLResponse, Response, RedirectResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, EmailStr, Field

log = logging.getLogger('yknova'); logging.basicConfig(level=logging.INFO)
DATA = Path(os.environ['DATA_DIR']); DATA.mkdir(parents=True, exist_ok=True)
IMAGES = DATA / 'images'; PACKAGES = DATA / 'packages'; IMAGES.mkdir(exist_ok=True); PACKAGES.mkdir(exist_ok=True)
DB = DATA / 'studio.sqlite3'
SECRET = os.environ['JWT_SECRET']
ORIGINS = [x.strip() for x in os.environ['FRONTEND_ORIGINS'].split(',') if x.strip()]
SITE_URL = os.environ['PUBLIC_SITE_URL'].rstrip('/')
KEY_ID = os.environ.get('RAZORPAY_KEY_ID', ''); KEY_SECRET = os.environ.get('RAZORPAY_KEY_SECRET', '')
WEBHOOK_SECRET = os.environ.get('RAZORPAY_WEBHOOK_SECRET', '')
PAY_MODE = os.environ.get('RAZORPAY_MODE', 'test')
ALLOW_LIVE = os.environ.get('ALLOW_LIVE_PAYMENTS', '0') == '1'
PAYMENTS_ENABLED = bool(WEBHOOK_SECRET and KEY_ID and KEY_SECRET and ((PAY_MODE == 'test' and KEY_ID.startswith('rzp_test_')) or (PAY_MODE == 'live' and ALLOW_LIVE and KEY_ID.startswith('rzp_live_'))))
MAX_ZIP = int(os.environ.get('MAX_ZIP_MB', '100')) * 1024 * 1024
ADMIN_ROLES = ('admin', 'super_admin')

app = FastAPI(title='YKNOVA Studio API', version='3.0')
app.add_middleware(CORSMiddleware, allow_origins=ORIGINS, allow_credentials=False, allow_methods=['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'], allow_headers=['Authorization', 'Content-Type'])
app.mount('/images', StaticFiles(directory=str(IMAGES)), name='images')
from storage import put_object, get_object, init_storage, presign_download, is_r2
import psycopg
from pg_compat import connect as postgres_connect, assert_schema_ready

def conn():
    if os.getenv('DATABASE_URL'):
        return postgres_connect()
    c = sqlite3.connect(DB, timeout=30); c.row_factory = sqlite3.Row; c.execute('PRAGMA foreign_keys=ON'); return c
def now(): return datetime.now(timezone.utc).isoformat()
def jl(v, d):
    try: return json.loads(v) if v else d
    except Exception: return d
def rows(c, q, a=()): return [dict(r) for r in c.execute(q, a).fetchall()]
def one(c, q, a=()):
    r = c.execute(q, a).fetchone(); return dict(r) if r else None

def add_cols(c, table, cols):
    have = {r[1] for r in c.execute(f'PRAGMA table_info({table})')}
    for name, ddl in cols:
        if name not in have: c.execute(f'ALTER TABLE {table} ADD COLUMN {name} {ddl}')

DEFAULT_CATEGORIES = ['Landing Pages', 'Dashboards', 'Portfolios', 'Business', 'SaaS', 'Components', 'Bundles', 'Other']
DEFAULT_SETTINGS = {
    'store_name': 'YKNOVA Studio', 'contact_email': '', 'support_hours': 'Mon–Fri, 10:00–18:00 IST',
    'announcement': 'Explore our latest collection of original templates.', 'announcement_link': '/new', 'announcement_enabled': True,
    'instagram_url': '', 'twitter_url': '', 'github_url': '', 'linkedin_url': '',
    'seo_title': 'YKNOVA Studio — Original UI templates & components', 'seo_description': 'Beautifully crafted templates. Built for real projects.',
    'currency': 'INR', 'tax_rate_percent': 0, 'business_name': 'YKNOVA Technologies', 'business_address': '', 'gstin': '',
    'refund_policy': '', 'logo_key': '', 'featured_collection_id': '',
}

def init():
    if os.getenv('DATABASE_URL'):
        with conn() as c:
            assert_schema_ready(c)
        return
    with conn() as c:
        c.executescript('''CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY,email TEXT UNIQUE NOT NULL,name TEXT NOT NULL,pw TEXT NOT NULL,role TEXT NOT NULL DEFAULT 'customer',created_at TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS products(id TEXT PRIMARY KEY,title TEXT NOT NULL,slug TEXT UNIQUE NOT NULL,category TEXT NOT NULL,description TEXT NOT NULL,price INTEGER NOT NULL,license TEXT NOT NULL,preview TEXT NOT NULL DEFAULT '',package TEXT NOT NULL DEFAULT '',status TEXT NOT NULL DEFAULT 'draft',tags TEXT NOT NULL DEFAULT '',created_at TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS orders(id TEXT PRIMARY KEY,user_id TEXT NOT NULL,total INTEGER NOT NULL,status TEXT NOT NULL,razorpay_order_id TEXT UNIQUE,razorpay_payment_id TEXT UNIQUE,created_at TEXT NOT NULL,FOREIGN KEY(user_id) REFERENCES users(id));
        CREATE TABLE IF NOT EXISTS order_items(order_id TEXT NOT NULL,product_id TEXT NOT NULL,unit_price INTEGER NOT NULL,PRIMARY KEY(order_id,product_id));
        CREATE TABLE IF NOT EXISTS wishlist(user_id TEXT NOT NULL,product_id TEXT NOT NULL,PRIMARY KEY(user_id,product_id));
        CREATE TABLE IF NOT EXISTS schema_migrations(version TEXT PRIMARY KEY,applied_at TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS categories(id TEXT PRIMARY KEY,name TEXT UNIQUE NOT NULL,slug TEXT UNIQUE NOT NULL,description TEXT NOT NULL DEFAULT '',image_key TEXT NOT NULL DEFAULT '',sort_order INTEGER NOT NULL DEFAULT 0,active INTEGER NOT NULL DEFAULT 1);
        CREATE TABLE IF NOT EXISTS collections(id TEXT PRIMARY KEY,name TEXT NOT NULL,slug TEXT UNIQUE NOT NULL,description TEXT NOT NULL DEFAULT '',featured INTEGER NOT NULL DEFAULT 0,created_at TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS product_collections(product_id TEXT NOT NULL,collection_id TEXT NOT NULL,PRIMARY KEY(product_id,collection_id));
        CREATE TABLE IF NOT EXISTS product_files(id TEXT PRIMARY KEY,product_id TEXT NOT NULL,version TEXT NOT NULL,storage_key TEXT NOT NULL,original_filename TEXT NOT NULL,file_size INTEGER NOT NULL,checksum TEXT NOT NULL,created_at TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS uploads(key TEXT PRIMARY KEY,kind TEXT NOT NULL,original_filename TEXT NOT NULL,file_size INTEGER NOT NULL,checksum TEXT NOT NULL,created_by TEXT,created_at TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS cart_items(user_id TEXT NOT NULL,product_id TEXT NOT NULL,license_id TEXT NOT NULL DEFAULT 'standard',created_at TEXT NOT NULL,PRIMARY KEY(user_id,product_id));
        CREATE TABLE IF NOT EXISTS entitlements(id TEXT PRIMARY KEY,user_id TEXT NOT NULL,product_id TEXT NOT NULL,order_id TEXT,license TEXT NOT NULL DEFAULT '',version TEXT NOT NULL DEFAULT '',status TEXT NOT NULL DEFAULT 'active',granted_at TEXT NOT NULL,revoked_at TEXT,UNIQUE(user_id,product_id));
        CREATE TABLE IF NOT EXISTS downloads(id TEXT PRIMARY KEY,user_id TEXT NOT NULL,product_id TEXT NOT NULL,file_id TEXT,version TEXT NOT NULL DEFAULT '',filename TEXT NOT NULL DEFAULT '',downloaded_at TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS discounts(id TEXT PRIMARY KEY,code TEXT UNIQUE NOT NULL,type TEXT NOT NULL,value INTEGER NOT NULL,starts_at TEXT,ends_at TEXT,usage_limit INTEGER,per_customer_limit INTEGER,min_order INTEGER NOT NULL DEFAULT 0,product_ids TEXT NOT NULL DEFAULT '[]',categories TEXT NOT NULL DEFAULT '[]',active INTEGER NOT NULL DEFAULT 1,created_at TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS support_requests(id TEXT PRIMARY KEY,user_id TEXT,name TEXT NOT NULL DEFAULT '',email TEXT NOT NULL,subject TEXT NOT NULL,message TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'open',reply TEXT NOT NULL DEFAULT '',created_at TEXT NOT NULL,updated_at TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS audit_logs(id TEXT PRIMARY KEY,admin_id TEXT,admin_email TEXT,action TEXT NOT NULL,entity_type TEXT NOT NULL,entity_id TEXT,metadata TEXT NOT NULL DEFAULT '{}',created_at TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS payment_events(id TEXT PRIMARY KEY,event_id TEXT UNIQUE,event TEXT NOT NULL,order_id TEXT,payload TEXT NOT NULL,created_at TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS refunds(id TEXT PRIMARY KEY,order_id TEXT NOT NULL,provider_refund_id TEXT UNIQUE,amount INTEGER NOT NULL,status TEXT NOT NULL,reason TEXT NOT NULL DEFAULT '',created_at TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS newsletter(email TEXT PRIMARY KEY,consent_at TEXT NOT NULL,status TEXT NOT NULL,source TEXT NOT NULL DEFAULT 'footer');
        CREATE TABLE IF NOT EXISTS settings(key TEXT PRIMARY KEY,value TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS auth_tokens(token_hash TEXT PRIMARY KEY,user_id TEXT NOT NULL,purpose TEXT NOT NULL,payload TEXT NOT NULL DEFAULT '',expires_at TEXT NOT NULL,used INTEGER NOT NULL DEFAULT 0);
        CREATE TABLE IF NOT EXISTS reviews(id TEXT PRIMARY KEY,user_id TEXT NOT NULL,product_id TEXT NOT NULL,rating INTEGER NOT NULL,body TEXT NOT NULL,created_at TEXT NOT NULL,UNIQUE(user_id,product_id));''')
        add_cols(c, 'users', [('status', "TEXT NOT NULL DEFAULT 'active'"), ('email_verified', 'INTEGER NOT NULL DEFAULT 0'), ('updated_at', 'TEXT'), ('last_login_at', 'TEXT'), ('token_version', 'INTEGER NOT NULL DEFAULT 0'), ('phone', "TEXT NOT NULL DEFAULT ''"), ('pending_email', "TEXT NOT NULL DEFAULT ''"), ('notify_prefs', "TEXT NOT NULL DEFAULT '{}'")])
        add_cols(c, 'users', [('firebase_uid', 'TEXT')])
        c.execute(
            'CREATE UNIQUE INDEX IF NOT EXISTS idx_users_firebase_uid '
            'ON users(firebase_uid)'
        )
        add_cols(c, 'products', [('short_description', "TEXT NOT NULL DEFAULT ''"), ('subcategory', "TEXT NOT NULL DEFAULT ''"), ('compare_price', 'INTEGER'), ('featured', 'INTEGER NOT NULL DEFAULT 0'), ('new_release', 'INTEGER NOT NULL DEFAULT 0'), ('tech_stack', "TEXT NOT NULL DEFAULT ''"), ('licenses', "TEXT NOT NULL DEFAULT ''"), ('gallery', "TEXT NOT NULL DEFAULT '[]'"), ('live_demo_url', "TEXT NOT NULL DEFAULT ''"), ('demo_video_url', "TEXT NOT NULL DEFAULT ''"), ('version', "TEXT NOT NULL DEFAULT '1.0.0'"), ('specs', "TEXT NOT NULL DEFAULT '{}'"), ('changelog', "TEXT NOT NULL DEFAULT '[]'"), ('updated_at', 'TEXT'), ('published_at', 'TEXT'), ('scheduled_at', 'TEXT'), ('is_demo', 'INTEGER NOT NULL DEFAULT 0')])
        add_cols(c, 'orders', [('subtotal', 'INTEGER'), ('discount', 'INTEGER NOT NULL DEFAULT 0'), ('tax', 'INTEGER NOT NULL DEFAULT 0'), ('currency', "TEXT NOT NULL DEFAULT 'INR'"), ('discount_code', "TEXT NOT NULL DEFAULT ''"), ('billing', "TEXT NOT NULL DEFAULT '{}'"), ('paid_at', 'TEXT'), ('updated_at', 'TEXT'), ('failure_reason', "TEXT NOT NULL DEFAULT ''"), ('refunded_amount', 'INTEGER NOT NULL DEFAULT 0'), ('payment_provider', "TEXT NOT NULL DEFAULT 'razorpay'")])
        add_cols(c, 'order_items', [('title_snapshot', "TEXT NOT NULL DEFAULT ''"), ('license_snapshot', "TEXT NOT NULL DEFAULT ''"), ('version_snapshot', "TEXT NOT NULL DEFAULT ''")])
        for i, n in enumerate(DEFAULT_CATEGORIES):
            c.execute('INSERT OR IGNORE INTO categories(id,name,slug,sort_order) VALUES(?,?,?,?)', (uuid.uuid4().hex, n, slugify(n), i))
        for k, v in DEFAULT_SETTINGS.items():
            c.execute('INSERT OR IGNORE INTO settings VALUES(?,?)', (k, json.dumps(v)))
        # backfill entitlements + snapshots for pre-v3 paid orders (idempotent)
        c.execute("""INSERT OR IGNORE INTO entitlements(id,user_id,product_id,order_id,license,status,granted_at)
            SELECT lower(hex(randomblob(16))),o.user_id,oi.product_id,o.id,p.license,'active',o.created_at FROM orders o JOIN order_items oi ON oi.order_id=o.id JOIN products p ON p.id=oi.product_id WHERE o.status='paid'""")
        c.execute("UPDATE orders SET subtotal=total WHERE subtotal IS NULL")
        c.execute("UPDATE order_items SET title_snapshot=(SELECT title FROM products WHERE id=order_items.product_id) WHERE title_snapshot=''")
        c.execute("UPDATE products SET updated_at=created_at WHERE updated_at IS NULL")
        c.execute("UPDATE products SET published_at=created_at WHERE published_at IS NULL AND status='published'")
        c.execute("INSERT OR IGNORE INTO schema_migrations VALUES('v3_0001_marketplace',?)", (now(),))
        for q in ['CREATE INDEX IF NOT EXISTS orders_user ON orders(user_id)', 'CREATE INDEX IF NOT EXISTS orders_status ON orders(status,created_at)', 'CREATE INDEX IF NOT EXISTS products_status ON products(status,category)', 'CREATE INDEX IF NOT EXISTS downloads_user ON downloads(user_id,downloaded_at)', 'CREATE INDEX IF NOT EXISTS audit_created ON audit_logs(created_at)']:
            c.execute(q)
        email = os.environ.get('ADMIN_EMAIL', '').lower().strip(); pw = os.environ.get('ADMIN_PASSWORD', '')
        if email and pw:
            if len(pw) < 12: raise RuntimeError('ADMIN_PASSWORD must be >=12 characters')
            if not c.execute('SELECT id FROM users WHERE email=?', (email,)).fetchone():
                c.execute('INSERT INTO users(id,email,name,pw,role,created_at,email_verified) VALUES(?,?,?,?,?,?,1)', (uuid.uuid4().hex, email, 'Store Administrator', hash_password(pw), 'super_admin', now()))
                log.info('Initial admin created: %s', email)
        if email: c.execute("UPDATE users SET role='super_admin' WHERE email=? AND role='admin'", (email,))

def slugify(s): return re.sub(r'-+', '-', ''.join(ch if ch.isalnum() else '-' for ch in s.lower())).strip('-')[:80]
def hash_password(pw):
    salt = secrets.token_bytes(16); dk = hashlib.pbkdf2_hmac('sha256', pw.encode(), salt, 250000)
    return base64.b64encode(salt + dk).decode()
def verify_password(pw, encoded):
    try:
        blob = base64.b64decode(encoded); return hmac.compare_digest(blob[16:], hashlib.pbkdf2_hmac('sha256', pw.encode(), blob[:16], 250000))
    except Exception: return False

def token(user, tv=0): return jwt.encode({'sub': user['id'], 'role': user['role'], 'tv': tv, 'exp': int(time.time()) + 60 * 60 * 2}, SECRET, algorithm='HS256')
USER_COLS = 'id,email,name,role,created_at,status,email_verified,phone,pending_email,notify_prefs,last_login_at,token_version,firebase_uid'
def public_user(u):
    d = {k: u[k] for k in ('id', 'email', 'name', 'role', 'created_at', 'status', 'email_verified', 'phone', 'pending_email', 'last_login_at') if k in u}
    d['notify_prefs'] = jl(u.get('notify_prefs'), {}); d['email_verified'] = bool(d.get('email_verified')); return d

def _firebase_principal(id_token):
    """Verify real Firebase bearer tokens and resolve local DB roles by UID."""
    import firebase_admin
    from firebase_admin import auth as fb_auth, credentials
    project = os.getenv('FIREBASE_PROJECT_ID')
    if not project:
        raise HTTPException(503, 'Firebase authentication not configured')
    try:
        try: app_instance = firebase_admin.get_app()
        except ValueError:
            app_instance = firebase_admin.initialize_app(credentials.ApplicationDefault(), {'projectId': project})
        claims = fb_auth.verify_id_token(id_token, app=app_instance, check_revoked=True)
    except (fb_auth.ExpiredIdTokenError, fb_auth.InvalidIdTokenError,
            fb_auth.RevokedIdTokenError, fb_auth.UserDisabledError, ValueError):
        raise HTTPException(401, 'Invalid or expired Firebase session')
    except Exception:
        log.exception('Firebase token verification failed')
        raise HTTPException(503, 'Authentication service unavailable')
    email = (claims.get('email') or '').strip().lower()
    uid = claims.get('uid')
    if not uid or not email or not claims.get('email_verified'):
        raise HTTPException(403, 'Verified Firebase email required')
    with conn() as c:
        user = one(c, f'SELECT {USER_COLS} FROM users WHERE firebase_uid=?', (uid,))
    if not user or user['email'].lower() != email:
        raise HTTPException(401, 'Firebase account not linked to this store account')
    if user['status'] != 'active':
        raise HTTPException(403, 'Account is not active')
    return user


def auth(authorization: Optional[str] = Header(default=None)):
    if not authorization or not authorization.startswith('Bearer '):
        raise HTTPException(401, 'Sign in required')
    raw_token = authorization[7:]
    try:
        algorithm = jwt.get_unverified_header(raw_token).get('alg')
    except Exception:
        raise HTTPException(401, 'Invalid session')
    if algorithm == 'RS256':
        return _firebase_principal(raw_token)
    if algorithm != 'HS256' or os.getenv('ALLOW_LEGACY_AUTH', '1') != '1':
        raise HTTPException(401, 'Legacy sessions disabled')
    try: claims = jwt.decode(raw_token, SECRET, algorithms=['HS256'])
    except Exception: raise HTTPException(401, 'Invalid or expired session')
    if claims.get('typ') or not claims.get('sub'):
        raise HTTPException(401, 'Invalid session')
    with conn() as c: user = one(c, f'SELECT {USER_COLS} FROM users WHERE id=?', (claims['sub'],))
    if not user: raise HTTPException(401, 'Account not found')
    if claims.get('tv', 0) != user['token_version']:
        raise HTTPException(401, 'Session ended. Please sign in again')
    if user['status'] != 'active': raise HTTPException(403, 'Account is not active')
    return user
def optional_auth(authorization: Optional[str] = Header(default=None)):
    try: return auth(authorization) if authorization else None
    except HTTPException: return None
def admin(user=Depends(auth)):
    if user['role'] not in ADMIN_ROLES: raise HTTPException(403, 'Admin access required')
    return user
def super_admin(user=Depends(auth)):
    if user['role'] != 'super_admin': raise HTTPException(403, 'Super admin access required')
    return user

def audit(c, user, action, etype, eid='', meta=None):
    c.execute('INSERT INTO audit_logs VALUES(?,?,?,?,?,?,?,?)', (uuid.uuid4().hex, user['id'], user['email'], action, etype, eid, json.dumps(meta or {}), now()))

_hits = defaultdict(deque)
def rate_limit(key, limit=10, window=600):
    q = _hits[key]; t = time.time()
    while q and q[0] < t - window: q.popleft()
    if len(q) >= limit: raise HTTPException(429, 'Too many attempts. Please wait a few minutes and try again')
    q.append(t)
def client_ip(request: Request): return request.headers.get('x-forwarded-for', request.client.host if request.client else '').split(',')[0].strip()

def make_auth_token(c, uid, purpose, hours=1, payload=''):
    raw = secrets.token_urlsafe(32)
    c.execute('INSERT INTO auth_tokens VALUES(?,?,?,?,?,0)', (hashlib.sha256(raw.encode()).hexdigest(), uid, purpose, payload, (datetime.now(timezone.utc) + timedelta(hours=hours)).isoformat()))
    return raw
def use_auth_token(c, raw, purpose):
    t = one(c, 'SELECT * FROM auth_tokens WHERE token_hash=? AND purpose=?', (hashlib.sha256(raw.encode()).hexdigest(), purpose))
    if not t or t['used'] or t['expires_at'] < now(): raise HTTPException(400, 'This link is invalid or has expired')
    c.execute('UPDATE auth_tokens SET used=1 WHERE token_hash=?', (t['token_hash'],)); return t
def send_email(to, subject, body):
    # No email provider configured yet: messages are written to the server log only.
    log.info('EMAIL (not delivered — no provider configured) to=%s subject=%s body=%s', to, subject, body)

def get_settings(c): return {r['key']: jl(r['value'], None) for r in rows(c, 'SELECT * FROM settings')}

# ---------- models ----------
class Register(BaseModel):
    name: str = Field(min_length=2, max_length=120); email: EmailStr; password: str = Field(min_length=10, max_length=128)
class Login(BaseModel):
    email: EmailStr; password: str
class Checkout(BaseModel):
    product_ids: list[str] = Field(min_length=1, max_length=30)
class Wish(BaseModel): product_id: str
class CartItem(BaseModel):
    product_id: str; license_id: str = 'standard'
class CartMerge(BaseModel): items: list[CartItem] = Field(default_factory=list, max_length=50)
class Billing(BaseModel):
    name: str = Field(min_length=2, max_length=120); email: EmailStr; country: str = Field(min_length=2, max_length=60)
    address: str = ''; address2: str = ''; city: str = ''; state: str = ''; postal_code: str = ''; phone: str = ''
class CreateOrder(BaseModel):
    items: list[CartItem] = Field(min_length=1, max_length=30); coupon: str = ''; billing: Billing
class Quote(BaseModel):
    items: list[CartItem] = Field(min_length=0, max_length=50); coupon: str = ''
class VerifyPay(BaseModel):
    razorpay_order_id: str; razorpay_payment_id: str; razorpay_signature: str
class PayFail(BaseModel):
    order_id: str; reason: str = ''; canceled: bool = False
class ProfileUpdate(BaseModel):
    name: str = Field(min_length=2, max_length=120); phone: Optional[str] = None; notify_prefs: Optional[dict] = None
class PasswordUpdate(BaseModel):
    current_password: str; new_password: str = Field(min_length=10, max_length=128)
class EmailOnly(BaseModel): email: EmailStr
class ResetIn(BaseModel):
    token: str; new_password: str = Field(min_length=10, max_length=128)
class TokenIn(BaseModel): token: str
class SupportIn(BaseModel):
    name: str = ''; email: Optional[EmailStr] = None; subject: str = Field(min_length=3, max_length=160); message: str = Field(min_length=10, max_length=5000)
class Newsletter(BaseModel):
    email: EmailStr; consent: bool
class ReviewIn(BaseModel):
    rating: int = Field(ge=1, le=5); body: str = Field(min_length=10, max_length=2000)

@app.on_event('startup')
def startup():
    init()
    try: init_storage()
    except Exception as ex:
        log.exception('Object storage init failed')
        if os.getenv('REQUIRE_R2', '0') == '1':
            raise RuntimeError('Required private R2 storage unavailable') from ex

_img_cache = {}
@app.get('/api/images/{key:path}')
def serve_image(key: str):
    legacy = IMAGES / key
    if '/' not in key and legacy.is_file(): return FileResponse(legacy, headers={'Cache-Control': 'public, max-age=86400'})
    if not key.startswith('yknova/images/'): raise HTTPException(404, 'Not found')
    if key not in _img_cache:
        with conn() as c:
            if not one(c, "SELECT key FROM uploads WHERE key=? AND kind='image'", (key,)): raise HTTPException(404, 'Not found')
        if len(_img_cache) > 300: _img_cache.clear()
        _img_cache[key] = get_object(key)
    data, ctype = _img_cache[key]
    return Response(data, media_type=ctype, headers={'Cache-Control': 'public, max-age=86400'})

@app.get('/api/health')
def health(): return {'status': 'ok', 'payments_enabled': PAYMENTS_ENABLED, 'payment_mode': PAY_MODE, 'key_id': KEY_ID if PAYMENTS_ENABLED else '', 'webhook_configured': bool(WEBHOOK_SECRET), 'email_delivery': False, 'google_sign_in': bool(os.getenv('FIREBASE_PROJECT_ID')), 'object_storage': 'r2' if is_r2() else 'local', 'database': 'postgresql' if os.getenv('DATABASE_URL') else 'sqlite'}
@app.get('/')
def root(): return {'service': 'YKNOVA Studio API', 'health': '/api/health'}

# ---------- auth ----------
def do_register(body, request):
    if os.getenv('ALLOW_LEGACY_AUTH', '1') != '1': raise HTTPException(410, 'Use Firebase registration')
    rate_limit('reg:' + client_ip(request), 8, 3600)
    uid = uuid.uuid4().hex
    try:
        with conn() as c:
            c.execute('INSERT INTO users(id,email,name,pw,role,created_at,updated_at) VALUES(?,?,?,?,?,?,?)', (uid, body.email.lower(), body.name.strip(), hash_password(body.password), 'customer', now(), now()))
            raw = make_auth_token(c, uid, 'verify', 48)
    except (sqlite3.IntegrityError, psycopg.IntegrityError): raise HTTPException(409, 'Email already registered')
    send_email(body.email, 'Verify your YKNOVA Studio email', f'{SITE_URL}/verify-email?token={raw}')
    with conn() as c: u = one(c, f'SELECT {USER_COLS} FROM users WHERE id=?', (uid,))
    return {'token': token(u, 0), 'user': public_user(u)}
@app.post('/api/register')
def register(body: Register, request: Request): return do_register(body, request)
@app.post('/api/auth/register')
def register_v3(body: Register, request: Request): return do_register(body, request)

def do_login(body, request):
    if os.getenv('ALLOW_LEGACY_AUTH', '1') != '1': raise HTTPException(410, 'Use Firebase login')
    rate_limit('login:' + client_ip(request) + body.email.lower(), 10, 600)
    with conn() as c:
        u = one(c, 'SELECT * FROM users WHERE email=?', (body.email.lower(),))
        if not u or not verify_password(body.password, u['pw']): raise HTTPException(401, 'Invalid credentials')
        if u['status'] == 'suspended': raise HTTPException(403, 'Account suspended. Contact support')
        c.execute('UPDATE users SET last_login_at=? WHERE id=?', (now(), u['id']))
    return {'token': token(u, u['token_version']), 'user': public_user(u)}
@app.post('/api/login')
def login(body: Login, request: Request): return do_login(body, request)
@app.post('/api/auth/login')
def login_v3(body: Login, request: Request): return do_login(body, request)


# ---------- Firebase authentication ----------
@app.post('/api/auth/firebase/exchange')
def firebase_exchange(body: TokenIn):
    import firebase_admin
    from firebase_admin import auth as firebase_auth
    from firebase_admin import credentials

    project_id = os.environ.get('FIREBASE_PROJECT_ID')
    if not project_id:
        raise HTTPException(503, 'Firebase is not configured')

    try:
        fb_app = firebase_admin.get_app()
    except ValueError:
        try:
            fb_app = firebase_admin.initialize_app(
                credentials.ApplicationDefault(),
                {'projectId': project_id}
            )
        except Exception:
            log.exception('Firebase initialization failed')
            raise HTTPException(503, 'Firebase authentication unavailable')

    try:
        claims = firebase_auth.verify_id_token(
            body.token,
            app=fb_app,
            check_revoked=True
        )
    except firebase_auth.ExpiredIdTokenError:
        raise HTTPException(401, 'Firebase session expired')
    except (
        firebase_auth.InvalidIdTokenError,
        firebase_auth.RevokedIdTokenError,
        firebase_auth.UserDisabledError,
        ValueError
    ):
        raise HTTPException(401, 'Invalid Firebase session')
    except Exception:
        log.exception('Firebase token verification unavailable')
        raise HTTPException(503, 'Firebase authentication unavailable')

    uid = claims.get('uid')
    email = (claims.get('email') or '').strip().lower()

    if not uid or not email or not claims.get('email_verified'):
        raise HTTPException(403, 'Verified Firebase email required')

    with conn() as c:
        user = one(
            c,
            'SELECT * FROM users WHERE firebase_uid=?',
            (uid,)
        )

        if not user:
            # Never take over an existing account by matching email.
            existing = one(
                c,
                'SELECT id FROM users WHERE email=?',
                (email,)
            )
            if existing:
                raise HTTPException(
                    409,
                    'This email already has a store account. '
                    'Secure account linking is required.'
                )

            new_id = uuid.uuid4().hex
            display_name = (
                claims.get('name') or email.split('@')[0]
            ).strip()[:120]

            try:
                c.execute(
                    '''INSERT INTO users
                    (id,email,name,pw,role,created_at,
                     updated_at,email_verified,firebase_uid)
                    VALUES(?,?,?,?,?,?,?,?,?)''',
                    (
                        new_id,
                        email,
                        display_name,
                        hash_password(secrets.token_urlsafe(48)),
                        'customer',
                        now(),
                        now(),
                        1,
                        uid
                    )
                )
            except (sqlite3.IntegrityError, psycopg.IntegrityError):
                raise HTTPException(
                    409,
                    'An account with this identity already exists'
                )

            user = one(
                c,
                'SELECT * FROM users WHERE id=?',
                (new_id,)
            )

        if user['email'].lower() != email:
            raise HTTPException(
                403,
                'Firebase email does not match linked account'
            )

        if user['status'] != 'active':
            raise HTTPException(403, 'Account is not active')

        c.execute(
            'UPDATE users SET last_login_at=? WHERE id=?',
            (now(), user['id'])
        )

        return {
            'token': token(user, user['token_version']),
            'user': public_user(user)
        }

@app.get('/api/me')
def me(user=Depends(auth)): return public_user(user)
@app.get('/api/auth/me')
def me_v3(user=Depends(auth)): return public_user(user)
@app.post('/api/auth/logout')
def logout(user=Depends(auth)): return {'ok': True}
@app.post('/api/auth/logout-all')
def logout_all(user=Depends(auth)):
    with conn() as c: c.execute('UPDATE users SET token_version=token_version+1 WHERE id=?', (user['id'],))
    return {'ok': True}

@app.post('/api/auth/forgot-password')
def forgot(body: EmailOnly, request: Request):
    if os.getenv('ALLOW_LEGACY_AUTH', '1') != '1': raise HTTPException(410, 'Use Firebase password reset')
    rate_limit('forgot:' + client_ip(request), 5, 3600)
    with conn() as c:
        u = one(c, 'SELECT id,email FROM users WHERE email=?', (body.email.lower(),))
        if u:
            raw = make_auth_token(c, u['id'], 'reset', 1)
            send_email(u['email'], 'Reset your YKNOVA Studio password', f'{SITE_URL}/reset-password?token={raw}')
    return {'ok': True, 'message': 'If an account exists for this email, a reset link has been sent.'}
@app.post('/api/auth/reset-password')
def reset_password(body: ResetIn):
    if os.getenv('ALLOW_LEGACY_AUTH', '1') != '1': raise HTTPException(410, 'Use Firebase password reset')
    with conn() as c:
        t = use_auth_token(c, body.token, 'reset')
        c.execute('UPDATE users SET pw=?,token_version=token_version+1,updated_at=? WHERE id=?', (hash_password(body.new_password), now(), t['user_id']))
    return {'ok': True}
@app.post('/api/auth/verify-email/request')
def verify_request(user=Depends(auth)):
    if user.get('firebase_uid'): raise HTTPException(410, 'Email verification is managed by Firebase')
    rate_limit('verify:' + user['id'], 3, 3600)
    with conn() as c: raw = make_auth_token(c, user['id'], 'verify', 48)
    send_email(user['email'], 'Verify your YKNOVA Studio email', f'{SITE_URL}/verify-email?token={raw}')
    return {'ok': True}
@app.post('/api/auth/verify-email/confirm')
def verify_confirm(body: TokenIn):
    if os.getenv('ALLOW_LEGACY_AUTH', '1') != '1': raise HTTPException(410, 'Use Firebase email verification')
    with conn() as c:
        t = use_auth_token(c, body.token, 'verify')
        if t['payload']:
            try: c.execute("UPDATE users SET email=?,pending_email='',email_verified=1 WHERE id=?", (t['payload'], t['user_id']))
            except (sqlite3.IntegrityError, psycopg.IntegrityError): raise HTTPException(409, 'That email is already in use')
        else: c.execute('UPDATE users SET email_verified=1 WHERE id=?', (t['user_id'],))
    return {'ok': True}

@app.put('/api/me')
def update_profile(body: ProfileUpdate, user=Depends(auth)):
    with conn() as c:
        c.execute('UPDATE users SET name=?,phone=COALESCE(?,phone),notify_prefs=COALESCE(?,notify_prefs),updated_at=? WHERE id=?', (body.name.strip(), body.phone, json.dumps(body.notify_prefs) if body.notify_prefs is not None else None, now(), user['id']))
        return public_user(one(c, f'SELECT {USER_COLS} FROM users WHERE id=?', (user['id'],)))
@app.put('/api/me/password')
def change_password(body: PasswordUpdate, user=Depends(auth)):
    with conn() as c:
        row = one(c, 'SELECT pw,firebase_uid FROM users WHERE id=?', (user['id'],))
        if row and row.get('firebase_uid'):
            raise HTTPException(409, 'Password is managed by Firebase Authentication')
        if not row or not verify_password(body.current_password, row['pw']): raise HTTPException(400, 'Current password is incorrect')
        c.execute('UPDATE users SET pw=?,updated_at=? WHERE id=?', (hash_password(body.new_password), now(), user['id']))
    return {'ok': True}
@app.put('/api/me/email')
def change_email(body: EmailOnly, user=Depends(auth)):
    if user.get('firebase_uid'):
        raise HTTPException(409, 'Email is managed by Firebase Authentication')
    new = body.email.lower()
    with conn() as c:
        if one(c, 'SELECT id FROM users WHERE email=?', (new,)): raise HTTPException(409, 'That email is already in use')
        c.execute('UPDATE users SET pending_email=? WHERE id=?', (new, user['id']))
        raw = make_auth_token(c, user['id'], 'verify', 24, new)
    send_email(new, 'Confirm your new YKNOVA Studio email', f'{SITE_URL}/verify-email?token={raw}')
    return {'ok': True, 'pending_email': new}
@app.post('/api/me/deletion-request')
def deletion_request(user=Depends(auth)):
    with conn() as c:
        c.execute('INSERT INTO support_requests VALUES(?,?,?,?,?,?,?,?,?,?)', (uuid.uuid4().hex, user['id'], user['name'], user['email'], 'Account deletion request', 'Customer requested account deletion from the Security page.', 'open', '', now(), now()))
    return {'ok': True}

# ---------- catalog ----------
def img_url(k): return k if not k or k.startswith('http') else '/api/images/' + k
def licenses_of(p):
    lic = jl(p.get('licenses'), [])
    return lic or [{'id': 'standard', 'name': p['license'], 'price': p['price']}]
def product_dict(p, admin_view=False, sales=None):
    d = dict(p); pkg = d.pop('package', '')
    d['tags'] = [x for x in (d.get('tags') or '').split(',') if x]
    d['tech_stack'] = [x for x in (d.get('tech_stack') or '').split(',') if x]
    d['licenses'] = licenses_of(p); d['gallery'] = jl(p.get('gallery'), []); d['specs'] = jl(p.get('specs'), {}); d['changelog'] = jl(p.get('changelog'), [])
    d['preview_url'] = img_url(d.get('preview', '')); d['gallery_urls'] = [img_url(x) for x in d['gallery']]
    d['has_package'] = bool(pkg); d['featured'] = bool(d.get('featured')); d['new_release'] = bool(d.get('new_release')); d['is_demo'] = bool(d.get('is_demo'))
    if sales is not None: d['sales'] = sales
    if admin_view: d['package_key'] = pkg
    return d

def publish_due(c): c.execute("UPDATE products SET status='published',published_at=scheduled_at WHERE status='scheduled' AND scheduled_at<=?", (now(),))
def sales_map(c): return {r['product_id']: r['n'] for r in rows(c, "SELECT oi.product_id,COUNT(*) n FROM order_items oi JOIN orders o ON o.id=oi.order_id WHERE o.status IN ('paid','partially_refunded') GROUP BY oi.product_id")}

def query_products(c, category='', search='', tech='', min_price=None, max_price=None, sort='newest', collection='', featured=False, new=False, free=None):
    publish_due(c)
    q = "SELECT p.* FROM products p WHERE p.status='published'"; a = []
    if category and category not in ('All', 'all'):
        cat = one(c, 'SELECT name FROM categories WHERE slug=? OR name=?', (category, category))
        q += ' AND p.category=?'; a.append(cat['name'] if cat else category)
    if search:
        for term in search.split()[:6]:
            q += ' AND (p.title LIKE ? OR p.description LIKE ? OR p.short_description LIKE ? OR p.category LIKE ? OR p.tags LIKE ? OR p.tech_stack LIKE ?)'; a += ['%' + term + '%'] * 6
    if tech:
        for t in tech.split(','):
            q += ' AND p.tech_stack LIKE ?'; a.append('%' + t.strip() + '%')
    if min_price is not None: q += ' AND p.price>=?'; a.append(min_price)
    if max_price is not None: q += ' AND p.price<=?'; a.append(max_price)
    if collection: q += ' AND p.id IN (SELECT pc.product_id FROM product_collections pc JOIN collections cl ON cl.id=pc.collection_id WHERE cl.slug=?)'; a.append(collection)
    if featured: q += ' AND p.featured=1'
    if new: q += ' AND p.new_release=1'
    if free is True: q += ' AND p.price=0'
    order = {'newest': 'COALESCE(p.published_at,p.created_at) DESC', 'price_asc': 'p.price ASC', 'price_desc': 'p.price DESC', 'oldest': 'p.created_at ASC'}.get(sort, 'COALESCE(p.published_at,p.created_at) DESC')
    sm = sales_map(c)
    items = [product_dict(r, sales=sm.get(r['id'], 0)) for r in rows(c, q + ' ORDER BY ' + order + ' LIMIT 500', a)]
    if sort == 'popular': items.sort(key=lambda x: -x['sales'])
    return items

@app.get('/api/products')
def products(category: str = '', search: str = ''):
    with conn() as c: return query_products(c, category, search)
@app.get('/api/catalog')
def catalog(category: str = '', search: str = '', tech: str = '', min_price: Optional[int] = None, max_price: Optional[int] = None, sort: str = 'newest', collection: str = '', featured: bool = False, new: bool = False, page: int = Query(1, ge=1), page_size: int = Query(12, ge=1, le=60)):
    with conn() as c: items = query_products(c, category, search, tech, min_price, max_price, sort, collection, featured, new)
    techs = sorted({t for p in items for t in p['tech_stack']})
    return {'items': items[(page - 1) * page_size: page * page_size], 'total': len(items), 'page': page, 'page_size': page_size, 'technologies': techs}
@app.get('/api/search')
def search(q: str = Query('', max_length=100), limit: int = Query(8, le=50)):
    if not q.strip(): return []
    with conn() as c: return query_products(c, search=q.strip())[:limit]
@app.get('/api/technologies')
def technologies():
    with conn() as c: return sorted({t for r in rows(c, "SELECT tech_stack FROM products WHERE status='published'") for t in r['tech_stack'].split(',') if t})

@app.get('/api/products/{pid}')
def get_product(pid: str):
    with conn() as c:
        publish_due(c)
        p = one(c, "SELECT * FROM products WHERE (id=? OR slug=?) AND status='published'", (pid, pid))
        if not p: raise HTTPException(404, 'Product not found')
        d = product_dict(p, sales=sales_map(c).get(p['id'], 0))
        d['collections'] = rows(c, 'SELECT cl.id,cl.name,cl.slug FROM collections cl JOIN product_collections pc ON pc.collection_id=cl.id WHERE pc.product_id=?', (p['id'],))
        d['reviews'] = rows(c, 'SELECT r.rating,r.body,r.created_at,u.name FROM reviews r JOIN users u ON u.id=r.user_id WHERE r.product_id=? ORDER BY r.created_at DESC', (p['id'],))
        d['related'] = [product_dict(x) for x in rows(c, "SELECT * FROM products WHERE status='published' AND category=? AND id!=? ORDER BY created_at DESC LIMIT 4", (p['category'], p['id']))]
        return d
@app.post('/api/products/{pid}/reviews')
def add_review(pid: str, body: ReviewIn, user=Depends(auth)):
    with conn() as c:
        if not one(c, "SELECT id FROM entitlements WHERE user_id=? AND product_id=? AND status='active'", (user['id'], pid)): raise HTTPException(403, 'Only customers who own this product can review it')
        c.execute('INSERT OR REPLACE INTO reviews VALUES(?,?,?,?,?,?)', (uuid.uuid4().hex, user['id'], pid, body.rating, body.body.strip(), now()))
    return {'ok': True}

@app.get('/api/categories')
def categories():
    with conn() as c:
        counts = {r['category']: r['n'] for r in rows(c, "SELECT category,COUNT(*) n FROM products WHERE status='published' GROUP BY category")}
        return [{**r, 'active': bool(r['active']), 'product_count': counts.get(r['name'], 0)} for r in rows(c, 'SELECT * FROM categories WHERE active=1 ORDER BY sort_order,name')]
@app.get('/api/collections')
def collections():
    with conn() as c: return rows(c, "SELECT cl.*,(SELECT COUNT(*) FROM product_collections pc JOIN products p ON p.id=pc.product_id WHERE pc.collection_id=cl.id AND p.status='published') product_count FROM collections cl ORDER BY featured DESC,created_at DESC")
@app.get('/api/settings/public')
def public_settings():
    with conn() as c: s = get_settings(c)
    s.pop('featured_collection_id', None); s['logo_url'] = img_url(s.get('logo_key') or '')
    return s

@app.post('/api/newsletter')
def newsletter(body: Newsletter, request: Request):
    rate_limit('nl:' + client_ip(request), 10, 3600)
    if not body.consent: raise HTTPException(422, 'Please confirm you agree to receive emails')
    with conn() as c: c.execute("INSERT OR REPLACE INTO newsletter VALUES(?,?,?,?)", (body.email.lower(), now(), 'subscribed', 'footer'))
    return {'ok': True}
@app.post('/api/support')
def support(body: SupportIn, request: Request, user=Depends(optional_auth)):
    rate_limit('sup:' + client_ip(request), 10, 3600)
    email = (user['email'] if user else (body.email or '')).lower()
    if not email: raise HTTPException(422, 'Email is required')
    with conn() as c:
        sid = uuid.uuid4().hex
        c.execute('INSERT INTO support_requests VALUES(?,?,?,?,?,?,?,?,?,?)', (sid, user['id'] if user else None, (user['name'] if user else body.name)[:120], email, body.subject.strip(), body.message.strip(), 'open', '', now(), now()))
    return {'ok': True, 'id': sid}
@app.get('/api/support/mine')
def my_support(user=Depends(auth)):
    with conn() as c: return rows(c, 'SELECT * FROM support_requests WHERE user_id=? ORDER BY created_at DESC', (user['id'],))

# ---------- wishlist ----------
@app.get('/api/wishlist')
def get_wishlist(user=Depends(auth)):
    with conn() as c: return [r['product_id'] for r in rows(c, 'SELECT product_id FROM wishlist WHERE user_id=?', (user['id'],))]
@app.get('/api/wishlist/products')
def wishlist_products(user=Depends(auth)):
    with conn() as c: return [product_dict(r) for r in rows(c, "SELECT p.* FROM products p JOIN wishlist w ON w.product_id=p.id WHERE w.user_id=? AND p.status='published'", (user['id'],))]
@app.post('/api/wishlist')
def add_wishlist(body: Wish, user=Depends(auth)):
    with conn() as c:
        if not one(c, 'SELECT id FROM products WHERE id=?', (body.product_id,)): raise HTTPException(404, 'Product not found')
        c.execute('INSERT OR IGNORE INTO wishlist VALUES(?,?)', (user['id'], body.product_id))
    return {'ok': True}
@app.delete('/api/wishlist/{pid}')
def delete_wishlist(pid: str, user=Depends(auth)):
    with conn() as c: c.execute('DELETE FROM wishlist WHERE user_id=? AND product_id=?', (user['id'], pid))
    return {'ok': True}

# ---------- cart & pricing ----------
def price_items(c, items, user_id=None):
    out, seen, issues = [], set(), []
    for it in items:
        if it.product_id in seen: continue
        seen.add(it.product_id)
        p = one(c, "SELECT * FROM products WHERE id=?", (it.product_id,))
        if not p or p['status'] != 'published' or not p['package']:
            issues.append({'product_id': it.product_id, 'reason': 'This product is no longer available'}); continue
        lic = next((l for l in licenses_of(p) if l['id'] == it.license_id), licenses_of(p)[0])
        owned = bool(user_id and one(c, "SELECT id FROM entitlements WHERE user_id=? AND product_id=? AND status='active'", (user_id, p['id'])))
        out.append({'product': product_dict(p), 'product_id': p['id'], 'license': lic, 'price': int(lic['price']), 'owned': owned})
    return out, issues

def apply_discount(c, code, lines, user_id):
    if not code: return 0, None
    d = one(c, 'SELECT * FROM discounts WHERE code=? COLLATE NOCASE', (code.strip(),))
    t = now()
    if not d or not d['active']: raise HTTPException(400, 'This promo code is not valid')
    if (d['starts_at'] and d['starts_at'] > t) or (d['ends_at'] and d['ends_at'] < t): raise HTTPException(400, 'This promo code is not active right now')
    used = one(c, "SELECT COUNT(*) n FROM orders WHERE discount_code=? AND status IN ('paid','partially_refunded')", (d['code'],))['n']
    if d['usage_limit'] and used >= d['usage_limit']: raise HTTPException(400, 'This promo code has reached its usage limit')
    if user_id and d['per_customer_limit']:
        mine = one(c, "SELECT COUNT(*) n FROM orders WHERE discount_code=? AND user_id=? AND status IN ('paid','partially_refunded')", (d['code'], user_id))['n']
        if mine >= d['per_customer_limit']: raise HTTPException(400, 'You have already used this promo code')
    pids, cats = jl(d['product_ids'], []), jl(d['categories'], [])
    eligible = [l for l in lines if (not pids and not cats) or l['product_id'] in pids or l['product']['category'] in cats]
    base = sum(l['price'] for l in eligible)
    if not eligible: raise HTTPException(400, 'This promo code does not apply to the items in your cart')
    if sum(l['price'] for l in lines) < d['min_order']: raise HTTPException(400, f"Minimum order of ₹{d['min_order'] // 100} required for this code")
    amt = base * d['value'] // 100 if d['type'] == 'percent' else min(base, d['value'])
    return int(amt), d

def quote(c, items, coupon, user_id):
    lines, issues = price_items(c, items, user_id)
    subtotal = sum(l['price'] for l in lines)
    discount, d = apply_discount(c, coupon, lines, user_id) if lines else (0, None)
    rate = float(get_settings(c).get('tax_rate_percent') or 0)
    tax = int(round((subtotal - discount) * rate / 100))
    return {'lines': lines, 'issues': issues, 'subtotal': subtotal, 'discount': discount, 'discount_code': d['code'] if d else '', 'tax_rate_percent': rate, 'tax': tax, 'total': subtotal - discount + tax, 'currency': 'INR'}

@app.post('/api/cart/quote')
def cart_quote(body: Quote, user=Depends(optional_auth)):
    with conn() as c: return quote(c, body.items, body.coupon, user['id'] if user else None)
@app.get('/api/cart')
def get_cart(user=Depends(auth)):
    with conn() as c: return rows(c, 'SELECT product_id,license_id,created_at FROM cart_items WHERE user_id=? ORDER BY created_at', (user['id'],))
@app.post('/api/cart/items')
def add_cart(body: CartItem, user=Depends(auth)):
    with conn() as c:
        p = one(c, "SELECT id FROM products WHERE id=? AND status='published'", (body.product_id,))
        if not p: raise HTTPException(404, 'Product not available')
        c.execute('INSERT INTO cart_items VALUES(?,?,?,?) ON CONFLICT(user_id,product_id) DO UPDATE SET license_id=excluded.license_id', (user['id'], body.product_id, body.license_id, now()))
    return {'ok': True}
@app.delete('/api/cart/items/{pid}')
def del_cart(pid: str, user=Depends(auth)):
    with conn() as c: c.execute('DELETE FROM cart_items WHERE user_id=? AND product_id=?', (user['id'], pid))
    return {'ok': True}
@app.post('/api/cart/merge')
def merge_cart(body: CartMerge, user=Depends(auth)):
    with conn() as c:
        for it in body.items:
            if one(c, "SELECT id FROM products WHERE id=? AND status='published'", (it.product_id,)):
                c.execute('INSERT INTO cart_items VALUES(?,?,?,?) ON CONFLICT(user_id,product_id) DO UPDATE SET license_id=excluded.license_id', (user['id'], it.product_id, it.license_id, now()))
        return rows(c, 'SELECT product_id,license_id,created_at FROM cart_items WHERE user_id=? ORDER BY created_at', (user['id'],))
@app.delete('/api/cart')
def clear_cart(user=Depends(auth)):
    with conn() as c: c.execute('DELETE FROM cart_items WHERE user_id=?', (user['id'],))
    return {'ok': True}

# ---------- payments ----------
def razor(method, endpoint, payload=None):
    a = base64.b64encode(f'{KEY_ID}:{KEY_SECRET}'.encode()).decode()
    req = urllib.request.Request('https://api.razorpay.com/v1/' + endpoint, data=json.dumps(payload).encode() if payload is not None else None, headers={'Authorization': 'Basic ' + a, 'Content-Type': 'application/json'}, method=method)
    try:
        with urllib.request.urlopen(req, timeout=20) as r: return json.load(r)
    except urllib.error.HTTPError as ex:
        log.warning('Razorpay %s %s -> %s %s', method, endpoint, ex.code, ex.read()[:300]); raise HTTPException(502, 'Payment gateway rejected the request')
    except Exception as ex: raise HTTPException(502, 'Payment gateway unavailable') from ex

def grant(c, order):
    """Idempotent: mark paid + create entitlements once."""
    for it in rows(c, 'SELECT * FROM order_items WHERE order_id=?', (order['id'],)):
        c.execute("INSERT INTO entitlements(id,user_id,product_id,order_id,license,version,status,granted_at) VALUES(?,?,?,?,?,?,'active',?) ON CONFLICT(user_id,product_id) DO UPDATE SET status='active',revoked_at=NULL,order_id=excluded.order_id,license=excluded.license", (uuid.uuid4().hex, order['user_id'], it['product_id'], order['id'], it['license_snapshot'], it['version_snapshot'], now()))
    c.execute('DELETE FROM cart_items WHERE user_id=? AND product_id IN (SELECT product_id FROM order_items WHERE order_id=?)', (order['user_id'], order['id']))

def mark_paid(c, order, payment_id):
    if order['status'] in ('paid', 'partially_refunded', 'refunded'):
        if order['razorpay_payment_id'] and order['razorpay_payment_id'] != payment_id: raise HTTPException(409, 'Order already paid by a different payment')
        return
    c.execute("UPDATE orders SET status='paid',razorpay_payment_id=?,paid_at=?,updated_at=?,failure_reason='' WHERE id=? AND status NOT IN ('paid','partially_refunded','refunded')", (payment_id, now(), now(), order['id']))
    grant(c, order)

def create_order(c, user, items, coupon, billing):
    if not PAYMENTS_ENABLED: raise HTTPException(503, 'Payments are not activated yet. Paid checkout is temporarily unavailable.')
    q = quote(c, items, coupon, user['id'])
    if q['issues']: raise HTTPException(400, q['issues'][0]['reason'])
    if any(l['owned'] for l in q['lines']): raise HTTPException(400, 'One or more items are already in your library')
    if any(l['price'] == 0 for l in q['lines']): raise HTTPException(400, 'Free products are claimed from their product page, not purchased')
    if q['total'] < 100: raise HTTPException(400, 'Minimum payable amount is ₹1')
    oid = uuid.uuid4().hex
    rz = razor('POST', 'orders', {'amount': q['total'], 'currency': 'INR', 'receipt': oid[:40], 'notes': {'studio_order': oid, 'customer': user['email']}})
    c.execute('INSERT INTO orders(id,user_id,total,status,razorpay_order_id,created_at,subtotal,discount,tax,currency,discount_code,billing,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)', (oid, user['id'], q['total'], 'pending', rz['id'], now(), q['subtotal'], q['discount'], q['tax'], 'INR', q['discount_code'], json.dumps(billing or {}), now()))
    for l in q['lines']:
        c.execute('INSERT INTO order_items(order_id,product_id,unit_price,title_snapshot,license_snapshot,version_snapshot) VALUES(?,?,?,?,?,?)', (oid, l['product_id'], l['price'], l['product']['title'], l['license']['name'], l['product']['version']))
    s = get_settings(c)
    return {'order_id': oid, 'razorpay_order_id': rz['id'], 'amount': q['total'], 'currency': 'INR', 'key_id': KEY_ID, 'name': s.get('store_name') or 'YKNOVA Studio', 'prefill': {'name': (billing or {}).get('name', user['name']), 'email': (billing or {}).get('email', user['email']), 'contact': (billing or {}).get('phone', '')}}

@app.post('/api/checkout')
def checkout_legacy(body: Checkout, user=Depends(auth)):
    with conn() as c: return create_order(c, user, [CartItem(product_id=p) for p in body.product_ids], '', {'name': user['name'], 'email': user['email']})
@app.post('/api/checkout/create-order')
def checkout_create(body: CreateOrder, user=Depends(auth)):
    with conn() as c: return create_order(c, user, body.items, body.coupon, body.billing.model_dump())

@app.post('/api/checkout/verify')
def verify_checkout(body: VerifyPay, user=Depends(auth)):
    expected = hmac.new(KEY_SECRET.encode(), (body.razorpay_order_id + '|' + body.razorpay_payment_id).encode(), hashlib.sha256).hexdigest() if KEY_SECRET else ''
    if not expected or not hmac.compare_digest(expected, body.razorpay_signature): raise HTTPException(400, 'Payment signature invalid')
    with conn() as c:
        order = one(c, 'SELECT * FROM orders WHERE razorpay_order_id=? AND user_id=?', (body.razorpay_order_id, user['id']))
        if not order: raise HTTPException(404, 'Order not found')
    pay = razor('GET', 'payments/' + body.razorpay_payment_id)
    if pay.get('order_id') != body.razorpay_order_id or pay.get('currency') != 'INR' or int(pay.get('amount', 0)) != order['total']: raise HTTPException(400, 'Payment does not match this order')
    if pay.get('status') == 'authorized':
        pay = razor('POST', f"payments/{body.razorpay_payment_id}/capture", {'amount': order['total'], 'currency': 'INR'})
    with conn() as c:
        order = one(c, 'SELECT * FROM orders WHERE id=?', (order['id'],))
        if pay.get('status') != 'captured':
            c.execute("UPDATE orders SET status='authorized',razorpay_payment_id=?,updated_at=? WHERE id=? AND status='pending'", (body.razorpay_payment_id, now(), order['id']))
            return {'status': 'authorized', 'order_id': order['id']}
        mark_paid(c, order, body.razorpay_payment_id)
    return {'status': 'paid', 'order_id': order['id']}

@app.post('/api/checkout/failed')
def checkout_failed(body: PayFail, user=Depends(auth)):
    with conn() as c:
        c.execute("UPDATE orders SET status=?,failure_reason=?,updated_at=? WHERE (id=? OR razorpay_order_id=?) AND user_id=? AND status='pending'", ('canceled' if body.canceled else 'failed', body.reason[:300], now(), body.order_id, body.order_id, user['id']))
    return {'ok': True}

async def handle_webhook(request: Request):
    if not WEBHOOK_SECRET: raise HTTPException(503, 'Webhook not configured')
    body = await request.body(); sig = request.headers.get('X-Razorpay-Signature', '')
    if not hmac.compare_digest(hmac.new(WEBHOOK_SECRET.encode(), body, hashlib.sha256).hexdigest(), sig): raise HTTPException(401, 'Invalid webhook signature')
    payload = json.loads(body); event = payload.get('event', '')
    eid = request.headers.get('X-Razorpay-Event-Id') or hashlib.sha256(body).hexdigest()
    pay = payload.get('payload', {}).get('payment', {}).get('entity', {}) or {}
    refund = payload.get('payload', {}).get('refund', {}).get('entity', {}) or {}
    rz_order = pay.get('order_id') or payload.get('payload', {}).get('order', {}).get('entity', {}).get('id')
    with conn() as c:
        event_insert = c.execute('INSERT INTO payment_events VALUES(?,?,?,?,?,?) ON CONFLICT(event_id) DO NOTHING', (uuid.uuid4().hex, eid, event, rz_order, body.decode()[:20000], now()))
        if event_insert.rowcount == 0: return {'ok': True, 'duplicate': True}
        order = one(c, 'SELECT * FROM orders WHERE razorpay_order_id=?', (rz_order,)) if rz_order else None
        if refund and not order and refund.get('payment_id'): order = one(c, 'SELECT * FROM orders WHERE razorpay_payment_id=?', (refund['payment_id'],))
        if not order: return {'ok': True, 'unmatched': True}
        if event == 'payment.captured' and (pay.get('order_id') == order['razorpay_order_id'] and
            pay.get('currency') == 'INR' and int(pay.get('amount', 0)) == order['total'] and
            pay.get('status') == 'captured' and pay.get('id')):
            mark_paid(c, order, pay['id'])
        elif event == 'order.paid':
            # Do not trust the webhook's order amount or a missing payment entity.
            verified_order = razor('GET', 'orders/' + order['razorpay_order_id'])
            if (verified_order.get('id') == order['razorpay_order_id'] and
                verified_order.get('status') == 'paid' and
                verified_order.get('currency') == 'INR' and
                int(verified_order.get('amount', 0)) == order['total'] and
                int(verified_order.get('amount_paid', 0)) >= order['total']):
                payments = razor('GET', 'orders/' + order['razorpay_order_id'] + '/payments')
                captured = [x for x in payments.get('items', []) if x.get('status') == 'captured' and
                    x.get('order_id') == order['razorpay_order_id'] and x.get('currency') == 'INR' and
                    int(x.get('amount', 0)) == order['total'] and x.get('id')]
                if captured:
                    mark_paid(c, order, captured[0]['id'])
        elif event == 'payment.authorized': c.execute("UPDATE orders SET status='authorized',updated_at=? WHERE id=? AND status='pending'", (now(), order['id']))
        elif event == 'payment.failed': c.execute("UPDATE orders SET status='failed',failure_reason=?,updated_at=? WHERE id=? AND status IN ('pending','authorized')", ((pay.get('error_description') or '')[:300], now(), order['id']))
        elif event.startswith('refund.') and refund: record_refund(c, order, refund)
    return {'ok': True}
@app.post('/api/webhooks/razorpay')
async def webhook_v3(request: Request): return await handle_webhook(request)
@app.post('/api/checkout/webhook')
async def webhook(request: Request): return await handle_webhook(request)

def record_refund(c, order, refund):
    c.execute('INSERT INTO refunds VALUES(?,?,?,?,?,?,?) ON CONFLICT(provider_refund_id) DO UPDATE SET status=excluded.status', (uuid.uuid4().hex, order['id'], refund.get('id'), int(refund.get('amount', 0)), refund.get('status', 'processed'), (refund.get('notes') or {}).get('reason', '') if isinstance(refund.get('notes'), dict) else '', now()))
    total_ref = one(c, "SELECT COALESCE(SUM(amount),0) n FROM refunds WHERE order_id=? AND status!='failed'", (order['id'],))['n']
    status = 'refunded' if total_ref >= order['total'] else 'partially_refunded'
    c.execute('UPDATE orders SET status=?,refunded_amount=?,updated_at=? WHERE id=?', (status, total_ref, now(), order['id']))
    if status == 'refunded': c.execute("UPDATE entitlements SET status='revoked',revoked_at=? WHERE order_id=?", (now(), order['id']))

# ---------- free claim, library, downloads ----------
@app.post('/api/library/claim/{pid}')
def claim_free(pid: str, user=Depends(auth)):
    with conn() as c:
        p = one(c, "SELECT * FROM products WHERE id=? AND status='published'", (pid,))
        if not p or not p['package']: raise HTTPException(404, 'Product not available')
        if p['price'] != 0 or any(int(l['price']) for l in licenses_of(p)): raise HTTPException(400, 'This product is not free')
        c.execute("INSERT OR IGNORE INTO entitlements(id,user_id,product_id,order_id,license,version,status,granted_at) VALUES(?,?,?,NULL,?,?,'active',?)", (uuid.uuid4().hex, user['id'], pid, licenses_of(p)[0]['name'], p['version'], now()))
    return {'ok': True}

@app.get('/api/library')
def library(user=Depends(auth)):
    with conn() as c:
        out = []
        for r in rows(c, "SELECT p.*,e.license ent_license,e.version ent_version,e.granted_at,e.order_id FROM entitlements e JOIN products p ON p.id=e.product_id WHERE e.user_id=? AND e.status='active' ORDER BY e.granted_at DESC", (user['id'],)):
            d = product_dict(r); d['purchased_version'] = r['ent_version'] or r['version']; d['available_version'] = r['version']; d['license_name'] = r['ent_license'] or r['license']; d['granted_at'] = r['granted_at']
            for k in ('ent_license', 'ent_version'): d.pop(k, None)
            out.append(d)
        return out

def entitled_file(c, uid, pid):
    e = one(c, "SELECT e.*,p.package,p.title,p.version FROM entitlements e JOIN products p ON p.id=e.product_id WHERE e.user_id=? AND e.product_id=? AND e.status='active'", (uid, pid))
    if not e or not e['package']: raise HTTPException(403, 'No download entitlement for this product')
    f = one(c, 'SELECT * FROM product_files WHERE product_id=? AND storage_key=? ORDER BY created_at DESC LIMIT 1', (pid, e['package']))
    return e, f

@app.get('/api/library/{pid}/download-link')
def download_link(pid: str, user=Depends(auth)):
    with conn() as c: entitled_file(c, user['id'], pid)
    t = jwt.encode({'sub': user['id'], 'pid': pid, 'typ': 'dl', 'exp': int(time.time()) + 120}, SECRET, algorithm='HS256')
    return {'url': f'/api/files/{t}', 'expires_in': 120}
@app.get('/api/files/{t}')
def signed_download(t: str):
    try: claims = jwt.decode(t, SECRET, algorithms=['HS256'])
    except Exception: raise HTTPException(403, 'Download link expired. Please start the download again from your library')
    if claims.get('typ') != 'dl': raise HTTPException(403, 'Invalid link')
    return serve_download(claims['sub'], claims['pid'])
@app.get('/api/library/{pid}/download')
def download(pid: str, user=Depends(auth)): return serve_download(user['id'], pid)
def serve_download(uid, pid):
    with conn() as c:
        e, f = entitled_file(c, uid, pid)
        fname = (f['original_filename'] if f else slugify(e['title']) + '.zip')
        key = e['package']
    if '/' in key:
        if is_r2():
            try: url = presign_download(key, fname, expires=60)
            except Exception:
                log.exception('Failed to generate private R2 download URL')
                raise HTTPException(503, 'Download temporarily unavailable')
            resp = RedirectResponse(url, status_code=302, headers={'Cache-Control': 'no-store'})
        else:
            try: data, _ = get_object(key)
            except Exception: raise HTTPException(404, 'File unavailable; contact support')
            resp = Response(data, media_type='application/zip', headers={'Content-Disposition': f'attachment; filename="{fname}"', 'Cache-Control': 'no-store'})
    else:
        path = PACKAGES / key  # legacy v2 files on the Render persistent disk
        if not path.is_file(): raise HTTPException(404, 'File unavailable; contact support')
        resp = FileResponse(path, media_type='application/zip', filename=fname)
    with conn() as c: c.execute('INSERT INTO downloads VALUES(?,?,?,?,?,?,?)', (uuid.uuid4().hex, uid, pid, f['id'] if f else None, e['version'], fname, now()))
    return resp
@app.get('/api/download-history')
def download_history(user=Depends(auth)):
    with conn() as c: return rows(c, 'SELECT d.*,p.title,p.preview,p.category,p.version current_version FROM downloads d JOIN products p ON p.id=d.product_id WHERE d.user_id=? ORDER BY d.downloaded_at DESC LIMIT 200', (user['id'],))

# ---------- customer orders & invoices ----------
def order_full(c, o):
    d = dict(o); d['billing'] = jl(o.get('billing'), {})
    d['items'] = rows(c, 'SELECT oi.product_id id,oi.product_id,COALESCE(NULLIF(oi.title_snapshot,\'\'),p.title) title,p.preview,p.slug,p.category,oi.unit_price,oi.license_snapshot,oi.version_snapshot FROM order_items oi LEFT JOIN products p ON oi.product_id=p.id WHERE oi.order_id=?', (o['id'],))
    for it in d['items']: it['preview_url'] = img_url(it.get('preview') or '')
    d['refunds'] = rows(c, 'SELECT * FROM refunds WHERE order_id=? ORDER BY created_at', (o['id'],))
    d['number'] = 'YK-' + o['id'][:8].upper(); d['invoice_number'] = 'INV-' + o['id'][:8].upper()
    return d
@app.get('/api/orders')
def my_orders(user=Depends(auth)):
    with conn() as c: return [order_full(c, o) for o in rows(c, 'SELECT * FROM orders WHERE user_id=? ORDER BY created_at DESC', (user['id'],))]
@app.get('/api/orders/{oid}')
def my_order(oid: str, user=Depends(auth)):
    with conn() as c:
        o = one(c, 'SELECT * FROM orders WHERE id=? AND user_id=?', (oid, user['id']))
        if not o: raise HTTPException(404, 'Order not found')
        return order_full(c, o)
def invoice_html(c, o):
    d = order_full(c, o); s = get_settings(c); e = htmllib.escape; b = d['billing']
    inr = lambda p: '₹' + f"{p / 100:,.2f}"
    items = ''.join(f"<tr><td>{e(i['title'] or '')}<br><small>{e(i['license_snapshot'] or '')} · v{e(i['version_snapshot'] or '')}</small></td><td style='text-align:right'>{inr(i['unit_price'])}</td></tr>" for i in d['items'])
    tax_row = f"<tr><td>Tax</td><td style='text-align:right'>{inr(d['tax'])}</td></tr>" if d['tax'] else ''
    gst = f"<div>GSTIN: {e(s.get('gstin'))}</div>" if s.get('gstin') else ''
    return f"""<!doctype html><html><head><meta charset='utf-8'><title>{d['invoice_number']}</title><style>body{{font-family:Helvetica,Arial,sans-serif;color:#2C120E;max-width:720px;margin:40px auto;padding:0 24px}}h1{{font-size:22px}}table{{width:100%;border-collapse:collapse}}td{{padding:10px 0;border-bottom:1px solid #eadcd8}}.muted{{color:#6E5B57;font-size:13px}}</style></head><body>
<h1>{e(s.get('store_name') or 'YKNOVA Studio')} — Invoice</h1><div class='muted'>{e(s.get('business_name') or '')}<br>{e(s.get('business_address') or '')}</div>{gst}
<p><b>Invoice:</b> {d['invoice_number']}<br><b>Order:</b> {d['number']}<br><b>Date:</b> {(d['paid_at'] or d['created_at'])[:10]}<br><b>Status:</b> {e(d['status'])}<br><b>Payment ref:</b> {e(d['razorpay_payment_id'] or '-')}</p>
<p><b>Billed to</b><br>{e(b.get('name', ''))}<br>{e(b.get('email', ''))}<br>{e(', '.join(x for x in [b.get('address'), b.get('address2'), b.get('city'), b.get('state'), b.get('postal_code'), b.get('country')] if x))}</p>
<table>{items}<tr><td>Subtotal</td><td style='text-align:right'>{inr(d['subtotal'] or d['total'])}</td></tr><tr><td>Discount {e(d['discount_code'])}</td><td style='text-align:right'>-{inr(d['discount'])}</td></tr>{tax_row}<tr><td><b>Total paid</b></td><td style='text-align:right'><b>{inr(d['total'])}</b></td></tr></table>
<p class='muted'>Digital goods delivered electronically. {'' if d['tax'] else 'No tax has been charged on this invoice.'}</p></body></html>"""
@app.get('/api/orders/{oid}/invoice')
def my_invoice(oid: str, user=Depends(auth)):
    with conn() as c:
        o = one(c, "SELECT * FROM orders WHERE id=? AND user_id=? AND status IN ('paid','partially_refunded','refunded')", (oid, user['id']))
        if not o: raise HTTPException(404, 'Invoice not available')
        return HTMLResponse(invoice_html(c, o))

@app.get('/api/account/summary')
def account_summary(user=Depends(auth)):
    with conn() as c:
        u = user['id']; n = lambda q: one(c, q, (u,))['n']
        return {'purchased': n("SELECT COUNT(*) n FROM entitlements WHERE user_id=? AND status='active'"), 'completed_orders': n("SELECT COUNT(*) n FROM orders WHERE user_id=? AND status IN ('paid','partially_refunded')"),
                'downloads': n('SELECT COUNT(*) n FROM downloads WHERE user_id=?'), 'available_downloads': n("SELECT COUNT(*) n FROM entitlements e JOIN products p ON p.id=e.product_id WHERE e.user_id=? AND e.status='active' AND p.package!=''"),
                'wishlist': n("SELECT COUNT(*) n FROM wishlist w JOIN products p ON p.id=w.product_id WHERE w.user_id=? AND p.status='published'"), 'open_tickets': n("SELECT COUNT(*) n FROM support_requests WHERE user_id=? AND status!='closed'")}

# ---------- admin uploads ----------
def store_upload(c, upload, kind, user):
    is_zip = kind == 'package'
    ext = Path(upload.filename or '').suffix.lower()
    allowed_ext = ['.zip'] if is_zip else ['.jpg', '.jpeg', '.png', '.webp']
    allowed_mime = ('application/zip', 'application/x-zip-compressed', 'application/octet-stream', 'multipart/x-zip') if is_zip else ('image/png', 'image/jpeg', 'image/webp')
    if ext not in allowed_ext or upload.content_type not in allowed_mime: raise HTTPException(422, 'Unsupported file type' + (' — upload a .zip' if is_zip else ' — use JPG, PNG or WebP'))
    limit = MAX_ZIP if is_zip else 8 * 1024 * 1024
    buf = io.BytesIO(); total = 0; h = hashlib.sha256()
    while chunk := upload.file.read(1024 * 1024):
        total += len(chunk); h.update(chunk)
        if total > limit: raise HTTPException(413, f'File too large (max {limit // 1024 // 1024} MB)')
        buf.write(chunk)
    try:
        if is_zip:
            if not zipfile.is_zipfile(buf): raise HTTPException(422, 'Invalid ZIP file')
            with zipfile.ZipFile(buf) as z:
                m = z.infolist()
                if len(m) > 5000 or sum(x.file_size for x in m) > 500 * 1024 * 1024: raise HTTPException(422, 'ZIP archive has too many or overly large files')
                if any(x.filename.startswith('/') or '..' in x.filename for x in m): raise HTTPException(422, 'ZIP contains unsafe paths')
        else:
            from PIL import Image
            with Image.open(io.BytesIO(buf.getvalue())) as im: im.verify()
    except HTTPException: raise
    except Exception: raise HTTPException(422, 'File could not be processed')
    ctype = 'application/zip' if is_zip else {'.png': 'image/png', '.webp': 'image/webp'}.get(ext, 'image/jpeg')
    name = put_object(f"yknova/{'packages' if is_zip else 'images'}/{uuid.uuid4().hex}{ext}", buf.getvalue(), ctype)['path']
    c.execute('INSERT INTO uploads VALUES(?,?,?,?,?,?,?)', (name, kind, (upload.filename or name)[:200], total, h.hexdigest(), user['id'], now()))
    return {'key': name, 'filename': upload.filename, 'size': total, 'checksum': h.hexdigest(), 'url': img_url(name) if not is_zip else None}
@app.post('/api/admin/uploads/preview')
def upload_preview(file: UploadFile = File(...), user=Depends(admin)):
    with conn() as c: return store_upload(c, file, 'image', user)
@app.post('/api/admin/uploads/package')
def upload_package(file: UploadFile = File(...), user=Depends(admin)):
    with conn() as c:
        r = store_upload(c, file, 'package', user); audit(c, user, 'upload_package', 'upload', r['key'], {'filename': r['filename'], 'size': r['size']}); return r
@app.get('/api/admin/media')
def media(user=Depends(admin)):
    with conn() as c:
        used = {r['preview'] for r in rows(c, 'SELECT preview FROM products')} | {g for r in rows(c, 'SELECT gallery FROM products') for g in jl(r['gallery'], [])}
        return [{**u, 'url': img_url(u['key']), 'in_use': u['key'] in used} for u in rows(c, "SELECT * FROM uploads WHERE kind='image' ORDER BY created_at DESC")]
@app.delete('/api/admin/media/{key:path}')
def delete_media(key: str, user=Depends(admin)):
    with conn() as c:
        u = one(c, "SELECT * FROM uploads WHERE key=? AND kind='image'", (key,))
        if not u: raise HTTPException(404, 'Not found')
        if one(c, 'SELECT id FROM products WHERE preview=? OR gallery LIKE ?', (key, f'%{key}%')): raise HTTPException(409, 'Image is used by a product')
        c.execute("UPDATE uploads SET kind='deleted_image' WHERE key=?", (key,)); audit(c, user, 'delete_media', 'media', key)
    return {'ok': True}

# ---------- admin products ----------
class LicenseIn(BaseModel):
    id: str = Field(min_length=1, max_length=40); name: str = Field(min_length=1, max_length=80); price: int = Field(ge=0, le=100000000)
class ProductIn(BaseModel):
    title: str = Field(min_length=2, max_length=150); slug: str = ''; short_description: str = Field('', max_length=300); description: str = Field('', max_length=20000)
    category: str; subcategory: str = ''; tags: list[str] = Field(default_factory=list); tech_stack: list[str] = Field(default_factory=list)
    price: int = Field(ge=0, le=100000000); compare_price: Optional[int] = None; licenses: list[LicenseIn] = Field(default_factory=list)
    preview: str = ''; gallery: list[str] = Field(default_factory=list, max_length=12); live_demo_url: str = ''; demo_video_url: str = ''
    package_key: str = ''; version: str = Field('1.0.0', max_length=20); changelog_note: str = ''; specs: dict = Field(default_factory=dict)
    featured: bool = False; new_release: bool = False; collection_ids: list[str] = Field(default_factory=list); scheduled_at: Optional[str] = None

def validate_url(u):
    if u and not re.match(r'^https://[^\s<>"]+$', u): raise HTTPException(422, 'URLs must start with https://')
def save_product(c, body, user, pid=None):
    cat = one(c, 'SELECT name FROM categories WHERE name=?', (body.category,))
    if not cat: raise HTTPException(422, 'Unknown category')
    validate_url(body.live_demo_url); validate_url(body.demo_video_url)
    if body.compare_price is not None and body.compare_price <= body.price: body.compare_price = None
    slug = slugify(body.slug or body.title)
    if not slug: raise HTTPException(422, 'Invalid slug')
    clash = one(c, 'SELECT id FROM products WHERE slug=? AND id!=?', (slug, pid or ''))
    if clash: raise HTTPException(409, 'That URL slug is already used by another product')
    for k in [body.preview, *body.gallery]:
        if k and not one(c, "SELECT key FROM uploads WHERE key=? AND kind='image'", (k,)) and not (IMAGES / k).is_file(): raise HTTPException(422, 'Unknown image reference')
    lic = [l.model_dump() for l in body.licenses] or [{'id': 'standard', 'name': 'Personal and commercial license', 'price': body.price}]
    price = min(l['price'] for l in lic)
    old = one(c, 'SELECT * FROM products WHERE id=?', (pid,)) if pid else None
    pkg = old['package'] if old else ''
    changelog = jl(old['changelog'], []) if old else []
    if body.package_key and body.package_key != pkg:
        up = one(c, "SELECT * FROM uploads WHERE key=? AND kind='package'", (body.package_key,))
        if not up: raise HTTPException(422, 'Unknown package upload')
        pkg = body.package_key
    if body.changelog_note.strip() or not old or (old and old['version'] != body.version):
        changelog.insert(0, {'version': body.version, 'date': now()[:10], 'notes': body.changelog_note.strip() or ('Initial release' if not old else 'Updated')})
    vals = dict(title=body.title.strip(), slug=slug, category=body.category, description=body.description, price=price, license=lic[0]['name'], preview=body.preview, package=pkg, tags=','.join(t.strip() for t in body.tags if t.strip())[:500],
                short_description=body.short_description, subcategory=body.subcategory, compare_price=body.compare_price, featured=int(body.featured), new_release=int(body.new_release), tech_stack=','.join(t.strip() for t in body.tech_stack if t.strip()),
                licenses=json.dumps(lic), gallery=json.dumps(body.gallery), live_demo_url=body.live_demo_url, demo_video_url=body.demo_video_url, version=body.version, specs=json.dumps(body.specs)[:20000], changelog=json.dumps(changelog[:50]), updated_at=now(), scheduled_at=body.scheduled_at)
    if old:
        c.execute('UPDATE products SET ' + ','.join(f'{k}=?' for k in vals) + ' WHERE id=?', (*vals.values(), pid))
    else:
        pid = uuid.uuid4().hex; vals.update(id=pid, status='draft', created_at=now())
        c.execute(f"INSERT INTO products({','.join(vals)}) VALUES({','.join('?' * len(vals))})", tuple(vals.values()))
    if pkg and (not old or pkg != old['package']):
        up = one(c, 'SELECT * FROM uploads WHERE key=?', (pkg,))
        c.execute('INSERT INTO product_files VALUES(?,?,?,?,?,?,?,?)', (uuid.uuid4().hex, pid, body.version, pkg, up['original_filename'], up['file_size'], up['checksum'], now()))
    c.execute('DELETE FROM product_collections WHERE product_id=?', (pid,))
    for cid in body.collection_ids: c.execute('INSERT OR IGNORE INTO product_collections SELECT ?,id FROM collections WHERE id=?', (pid, cid))
    audit(c, user, 'update_product' if old else 'create_product', 'product', pid, {'title': vals['title']})
    return pid

def admin_product(c, pid):
    p = one(c, 'SELECT * FROM products WHERE id=?', (pid,))
    if not p: raise HTTPException(404, 'Product not found')
    d = product_dict(p, admin_view=True, sales=sales_map(c).get(pid, 0))
    d['files'] = rows(c, 'SELECT * FROM product_files WHERE product_id=? ORDER BY created_at DESC', (pid,))
    d['collection_ids'] = [r['collection_id'] for r in rows(c, 'SELECT collection_id FROM product_collections WHERE product_id=?', (pid,))]
    d['package_file'] = one(c, 'SELECT original_filename,file_size,checksum FROM uploads WHERE key=?', (p['package'],)) if p['package'] else None
    return d

@app.get('/api/admin/products')
def admin_products(user=Depends(admin)):
    with conn() as c:
        publish_due(c); sm = sales_map(c)
        rev = {r['product_id']: r['n'] for r in rows(c, "SELECT oi.product_id,SUM(oi.unit_price) n FROM order_items oi JOIN orders o ON o.id=oi.order_id WHERE o.status IN ('paid','partially_refunded') GROUP BY oi.product_id")}
        return [{**product_dict(x, admin_view=True, sales=sm.get(x['id'], 0)), 'revenue': rev.get(x['id'], 0)} for x in rows(c, 'SELECT * FROM products ORDER BY COALESCE(updated_at,created_at) DESC')]
@app.get('/api/admin/products/{pid}')
def admin_get_product(pid: str, user=Depends(admin)):
    with conn() as c: return admin_product(c, pid)
@app.post('/api/admin/catalog/products')
def admin_create(body: ProductIn, user=Depends(admin)):
    with conn() as c: return admin_product(c, save_product(c, body, user))
@app.patch('/api/admin/products/{pid}')
def admin_update(pid: str, body: ProductIn, user=Depends(admin)):
    with conn() as c:
        if not one(c, 'SELECT id FROM products WHERE id=?', (pid,)): raise HTTPException(404, 'Product not found')
        return admin_product(c, save_product(c, body, user, pid))

def set_status(pid, status, user, action):
    with conn() as c:
        p = one(c, 'SELECT * FROM products WHERE id=?', (pid,))
        if not p: raise HTTPException(404, 'Product not found')
        if status in ('published', 'scheduled'):
            missing = [n for n, ok in [('title', p['title']), ('description', len(p['description'].strip()) >= 20), ('cover image', p['preview']), ('source ZIP package', p['package'])] if not ok]
            if missing: raise HTTPException(422, 'Cannot publish — missing: ' + ', '.join(missing))
            if status == 'scheduled' and not p['scheduled_at']: raise HTTPException(422, 'Set a publication date first')
        c.execute("UPDATE products SET status=?,updated_at=?,published_at=CASE WHEN ?='published' THEN COALESCE(published_at,?) ELSE published_at END WHERE id=?", (status, now(), status, now(), pid))
        audit(c, user, action, 'product', pid, {'title': p['title']})
        return admin_product(c, pid)
@app.post('/api/admin/products/{pid}/publish')
def publish(pid: str, user=Depends(admin)): return set_status(pid, 'published', user, 'publish_product')
@app.post('/api/admin/products/{pid}/schedule')
def schedule(pid: str, user=Depends(admin)): return set_status(pid, 'scheduled', user, 'schedule_product')
@app.post('/api/admin/products/{pid}/unpublish')
def unpublish_v3(pid: str, user=Depends(admin)): return set_status(pid, 'draft', user, 'unpublish_product')
@app.post('/api/admin/products/{pid}/archive')
def archive(pid: str, user=Depends(admin)): return set_status(pid, 'archived', user, 'archive_product')
@app.post('/api/admin/products/{pid}/duplicate')
def duplicate(pid: str, user=Depends(admin)):
    with conn() as c:
        p = one(c, 'SELECT * FROM products WHERE id=?', (pid,))
        if not p: raise HTTPException(404, 'Product not found')
        nid = uuid.uuid4().hex; p.update(id=nid, slug=(p['slug'][:70] + '-copy-' + nid[:4]), title=p['title'] + ' (Copy)', status='draft', created_at=now(), updated_at=now(), published_at=None, featured=0)
        c.execute(f"INSERT INTO products({','.join(p)}) VALUES({','.join('?' * len(p))})", tuple(p.values()))
        audit(c, user, 'duplicate_product', 'product', nid, {'from': pid}); return admin_product(c, nid)
@app.delete('/api/admin/products/{pid}')
def delete_product(pid: str, permanent: bool = False, user=Depends(admin)):
    with conn() as c:
        if not permanent:  # v2 compatibility: DELETE = unpublish
            c.execute("UPDATE products SET status='draft' WHERE id=?", (pid,)); return {'status': 'draft'}
        if one(c, 'SELECT order_id FROM order_items WHERE product_id=? LIMIT 1', (pid,)) or one(c, 'SELECT id FROM entitlements WHERE product_id=? LIMIT 1', (pid,)):
            raise HTTPException(409, 'This product has orders or customer entitlements. Archive it instead of deleting')
        p = one(c, 'SELECT title FROM products WHERE id=?', (pid,))
        if not p: raise HTTPException(404, 'Product not found')
        for t in ('product_collections', 'product_files', 'wishlist', 'cart_items'): c.execute(f'DELETE FROM {t} WHERE product_id=?', (pid,))
        c.execute('DELETE FROM products WHERE id=?', (pid,)); audit(c, user, 'delete_product', 'product', pid, {'title': p['title']})
    return {'deleted': True}

# v2 compatibility form endpoints
@app.post('/api/admin/products')
def create_product_v2(title: str = Form(...), category: str = Form(...), price: int = Form(...), description: str = Form(''), license: str = Form('Personal and commercial license'), tags: str = Form(''), status: str = Form('draft'), preview: Optional[UploadFile] = File(None), package: Optional[UploadFile] = File(None), user=Depends(admin)):
    with conn() as c:
        pv = store_upload(c, preview, 'image', user)['key'] if preview else ''
        pk = store_upload(c, package, 'package', user)['key'] if package else ''
        pid = save_product(c, ProductIn(title=title, category=category, price=price, description=description, licenses=[LicenseIn(id='standard', name=license, price=price)], tags=tags.split(','), preview=pv, package_key=pk), user)
    return {'id': pid, 'status': set_status(pid, 'published', user, 'publish_product')['status'] if status == 'published' else 'draft'}

# ---------- admin orders/customers ----------
@app.get('/api/admin/orders')
def all_orders(q: str = '', status: str = '', start: str = '', end: str = '', user=Depends(admin)):
    sql = 'SELECT o.*,u.email customer_email,u.name customer_name FROM orders o JOIN users u ON u.id=o.user_id WHERE 1=1'; a = []
    if q: sql += ' AND (o.id LIKE ? OR u.email LIKE ? OR u.name LIKE ? OR o.razorpay_payment_id LIKE ?)'; a += [f'%{q.lower().replace("yk-", "")}%', f'%{q}%', f'%{q}%', f'%{q}%']
    if status: sql += ' AND o.status=?'; a.append(status)
    if start: sql += ' AND o.created_at>=?'; a.append(start)
    if end: sql += ' AND o.created_at<=?'; a.append(end + 'T23:59:59')
    with conn() as c: return [order_full(c, o) for o in rows(c, sql + ' ORDER BY o.created_at DESC LIMIT 500', a)]
@app.get('/api/admin/orders/export.csv')
def export_orders(user=Depends(admin)):
    buf = io.StringIO(); w = csv.writer(buf); w.writerow(['order', 'date', 'customer', 'email', 'items', 'subtotal_inr', 'discount_inr', 'tax_inr', 'total_inr', 'status', 'payment_id'])
    with conn() as c:
        for o in rows(c, 'SELECT o.*,u.email,u.name FROM orders o JOIN users u ON u.id=o.user_id ORDER BY o.created_at DESC'):
            items = '; '.join(r['t'] or '' for r in rows(c, 'SELECT title_snapshot t FROM order_items WHERE order_id=?', (o['id'],)))
            w.writerow(['YK-' + o['id'][:8].upper(), o['created_at'], o['name'], o['email'], items, (o['subtotal'] or o['total']) / 100, o['discount'] / 100, o['tax'] / 100, o['total'] / 100, o['status'], o['razorpay_payment_id'] or ''])
    return Response(buf.getvalue(), media_type='text/csv', headers={'Content-Disposition': 'attachment; filename=yknova-orders.csv'})
@app.get('/api/admin/orders/{oid}')
def admin_order(oid: str, user=Depends(admin)):
    with conn() as c:
        o = one(c, 'SELECT o.*,u.email customer_email,u.name customer_name FROM orders o JOIN users u ON u.id=o.user_id WHERE o.id=?', (oid,))
        if not o: raise HTTPException(404, 'Order not found')
        d = order_full(c, o); d['events'] = rows(c, 'SELECT event,created_at FROM payment_events WHERE order_id=? ORDER BY created_at', (o['razorpay_order_id'],)); return d
@app.get('/api/admin/orders/{oid}/invoice')
def admin_invoice(oid: str, user=Depends(admin)):
    with conn() as c:
        o = one(c, 'SELECT * FROM orders WHERE id=?', (oid,))
        if not o: raise HTTPException(404, 'Order not found')
        return HTMLResponse(invoice_html(c, o))
class RefundIn(BaseModel):
    amount: Optional[int] = None; reason: str = ''
@app.post('/api/admin/orders/{oid}/refund')
def refund(oid: str, body: RefundIn, user=Depends(admin)):
    with conn() as c:
        o = one(c, 'SELECT * FROM orders WHERE id=?', (oid,))
        if not o or o['status'] not in ('paid', 'partially_refunded') or not o['razorpay_payment_id']: raise HTTPException(400, 'Only paid orders can be refunded')
        remaining = o['total'] - o['refunded_amount']; amt = body.amount or remaining
        if amt < 100 or amt > remaining: raise HTTPException(422, 'Invalid refund amount')
    rf = razor('POST', f"payments/{o['razorpay_payment_id']}/refund", {'amount': amt, 'notes': {'reason': body.reason[:200]}})
    with conn() as c:
        record_refund(c, o, rf); audit(c, user, 'refund_order', 'order', oid, {'amount': amt}); return order_full(c, one(c, 'SELECT * FROM orders WHERE id=?', (oid,)))

@app.get('/api/admin/customers')
def all_customers(q: str = '', user=Depends(admin)):
    sql = """SELECT u.id,u.name,u.email,u.created_at,u.status,u.email_verified,u.last_login_at,
        (SELECT COUNT(*) FROM orders o WHERE o.user_id=u.id AND o.status IN ('paid','partially_refunded')) orders_count,
        (SELECT COALESCE(SUM(o.total-o.refunded_amount),0) FROM orders o WHERE o.user_id=u.id AND o.status IN ('paid','partially_refunded','refunded')) lifetime_value
        FROM users u WHERE u.role='customer'"""; a = []
    if q: sql += ' AND (u.email LIKE ? OR u.name LIKE ?)'; a += [f'%{q}%'] * 2
    with conn() as c: return rows(c, sql + ' ORDER BY u.created_at DESC LIMIT 500', a)
@app.get('/api/admin/customers/{uid}')
def admin_customer(uid: str, user=Depends(admin)):
    with conn() as c:
        u = one(c, f"SELECT {USER_COLS} FROM users WHERE id=?", (uid,))
        if not u: raise HTTPException(404, 'Customer not found')
        return {'user': public_user(u), 'orders': [order_full(c, o) for o in rows(c, 'SELECT * FROM orders WHERE user_id=? ORDER BY created_at DESC', (uid,))], 'entitlements': rows(c, 'SELECT e.*,p.title FROM entitlements e JOIN products p ON p.id=e.product_id WHERE e.user_id=?', (uid,))}
class StatusIn(BaseModel): status: str
@app.patch('/api/admin/customers/{uid}')
def admin_customer_status(uid: str, body: StatusIn, user=Depends(admin)):
    if body.status not in ('active', 'suspended'): raise HTTPException(422, 'Invalid status')
    with conn() as c:
        c.execute("UPDATE users SET status=?,token_version=token_version+1 WHERE id=? AND role='customer'", (body.status, uid)); audit(c, user, 'customer_status', 'user', uid, {'status': body.status})
    return {'ok': True}

# ---------- analytics ----------
PAID = "('paid','partially_refunded','refunded')"
@app.get('/api/admin/overview')
def overview(user=Depends(admin)):
    with conn() as c:
        n = lambda q: c.execute(q).fetchone()[0]
        recent = [order_full(c, o) for o in rows(c, 'SELECT o.*,u.name customer FROM orders o JOIN users u ON u.id=o.user_id ORDER BY o.created_at DESC LIMIT 8')]
        return {'revenue': n(f"SELECT COALESCE(SUM(total-refunded_amount),0) FROM orders WHERE status IN {PAID}"), 'orders': n("SELECT COUNT(*) FROM orders WHERE status IN ('paid','partially_refunded')"),
                'templates': n("SELECT COUNT(*) FROM products WHERE status='published'"), 'drafts': n("SELECT COUNT(*) FROM products WHERE status='draft'"), 'customers': n("SELECT COUNT(*) FROM users WHERE role='customer'"),
                'open_messages': n("SELECT COUNT(*) FROM support_requests WHERE status='open'"), 'recent_orders': recent}
@app.get('/api/admin/analytics/overview')
def analytics_overview(user=Depends(admin)): return overview(user)
@app.get('/api/admin/analytics')
def analytics(days: int = 30, start: str = '', end: str = '', user=Depends(admin)):
    e_dt = datetime.fromisoformat(end).replace(tzinfo=timezone.utc) if end else datetime.now(timezone.utc)
    s_dt = datetime.fromisoformat(start).replace(tzinfo=timezone.utc) if start else e_dt - timedelta(days=days - 1)
    s, e = s_dt.date().isoformat(), e_dt.date().isoformat() + 'T23:59:59'
    with conn() as c:
        paid = rows(c, f"SELECT id,user_id,total,refunded_amount,COALESCE(paid_at,created_at) d FROM orders WHERE status IN {PAID} AND COALESCE(paid_at,created_at) BETWEEN ? AND ?", (s, e))
        series = {}; d = s_dt.date()
        while d <= e_dt.date(): series[d.isoformat()] = {'date': d.isoformat(), 'revenue': 0, 'orders': 0}; d += timedelta(days=1)
        for o in paid:
            k = o['d'][:10]
            if k in series: series[k]['revenue'] += o['total'] - o['refunded_amount']; series[k]['orders'] += 1
        revenue = sum(o['total'] - o['refunded_amount'] for o in paid)
        created = one(c, 'SELECT COUNT(*) n FROM orders WHERE created_at BETWEEN ? AND ?', (s, e))['n']
        abandoned = one(c, "SELECT COUNT(*) n FROM orders WHERE status IN ('pending','failed','canceled') AND created_at BETWEEN ? AND ?", (s, e))['n']
        top = rows(c, f"SELECT oi.product_id,COALESCE(NULLIF(oi.title_snapshot,''),p.title) title,p.preview,p.category,COUNT(*) units,SUM(oi.unit_price) revenue FROM order_items oi JOIN orders o ON o.id=oi.order_id LEFT JOIN products p ON p.id=oi.product_id WHERE o.status IN {PAID} AND COALESCE(o.paid_at,o.created_at) BETWEEN ? AND ? GROUP BY oi.product_id ORDER BY revenue DESC LIMIT 8", (s, e))
        for t in top: t['preview_url'] = img_url(t.get('preview') or '')
        by_cat = rows(c, f"SELECT COALESCE(p.category,'Other') category,SUM(oi.unit_price) revenue,COUNT(*) units FROM order_items oi JOIN orders o ON o.id=oi.order_id LEFT JOIN products p ON p.id=oi.product_id WHERE o.status IN {PAID} AND COALESCE(o.paid_at,o.created_at) BETWEEN ? AND ? GROUP BY 1 ORDER BY 2 DESC", (s, e))
        buyers = {o['user_id'] for o in paid}
        returning = sum(1 for b in buyers if one(c, f"SELECT COUNT(*) n FROM orders WHERE user_id=? AND status IN {PAID}", (b,))['n'] > 1)
        new_customers = one(c, "SELECT COUNT(*) n FROM users WHERE role='customer' AND created_at BETWEEN ? AND ?", (s, e))['n']
        refunds = one(c, 'SELECT COALESCE(SUM(amount),0) n,COUNT(*) c FROM refunds WHERE created_at BETWEEN ? AND ?', (s, e))
    return {'start': s, 'end': e[:10], 'revenue': revenue, 'orders': len(paid), 'aov': revenue // len(paid) if paid else 0, 'series': list(series.values()), 'top_products': top, 'by_category': by_cat,
            'new_customers': new_customers, 'buyers': len(buyers), 'returning_customers': returning, 'checkouts_started': created, 'abandoned_checkouts': abandoned,
            'checkout_conversion': round(len(paid) / created * 100, 1) if created else None, 'refunds_amount': refunds['n'], 'refunds_count': refunds['c']}

# ---------- discounts ----------
class DiscountIn(BaseModel):
    code: str = Field(min_length=3, max_length=30, pattern=r'^[A-Za-z0-9_-]+$'); type: str = Field(pattern='^(percent|fixed)$'); value: int = Field(gt=0)
    starts_at: Optional[str] = None; ends_at: Optional[str] = None; usage_limit: Optional[int] = None; per_customer_limit: Optional[int] = None; min_order: int = 0
    product_ids: list[str] = Field(default_factory=list); categories: list[str] = Field(default_factory=list); active: bool = True
def discount_out(c, d): return {**d, 'active': bool(d['active']), 'product_ids': jl(d['product_ids'], []), 'categories': jl(d['categories'], []), 'used': one(c, f"SELECT COUNT(*) n FROM orders WHERE discount_code=? AND status IN {PAID}", (d['code'],))['n']}
@app.get('/api/admin/discounts')
def list_discounts(user=Depends(admin)):
    with conn() as c: return [discount_out(c, d) for d in rows(c, 'SELECT * FROM discounts ORDER BY created_at DESC')]
def save_discount(c, body, did=None):
    if body.type == 'percent' and body.value > 100: raise HTTPException(422, 'Percentage cannot exceed 100')
    v = (body.code.upper(), body.type, body.value, body.starts_at or None, body.ends_at or None, body.usage_limit, body.per_customer_limit, body.min_order, json.dumps(body.product_ids), json.dumps(body.categories), int(body.active))
    try:
        if did: c.execute('UPDATE discounts SET code=?,type=?,value=?,starts_at=?,ends_at=?,usage_limit=?,per_customer_limit=?,min_order=?,product_ids=?,categories=?,active=? WHERE id=?', (*v, did))
        else: did = uuid.uuid4().hex; c.execute('INSERT INTO discounts VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)', (did, *v, now()))
    except (sqlite3.IntegrityError, psycopg.IntegrityError): raise HTTPException(409, 'Code already exists')
    return did
@app.post('/api/admin/discounts')
def create_discount(body: DiscountIn, user=Depends(admin)):
    with conn() as c: did = save_discount(c, body); audit(c, user, 'create_discount', 'discount', did, {'code': body.code}); return discount_out(c, one(c, 'SELECT * FROM discounts WHERE id=?', (did,)))
@app.put('/api/admin/discounts/{did}')
def update_discount(did: str, body: DiscountIn, user=Depends(admin)):
    with conn() as c: save_discount(c, body, did); audit(c, user, 'update_discount', 'discount', did, {'code': body.code}); return discount_out(c, one(c, 'SELECT * FROM discounts WHERE id=?', (did,)))
@app.delete('/api/admin/discounts/{did}')
def delete_discount(did: str, user=Depends(admin)):
    with conn() as c: c.execute('UPDATE discounts SET active=0 WHERE id=?', (did,)); audit(c, user, 'deactivate_discount', 'discount', did)
    return {'ok': True}

# ---------- categories & collections ----------
class CategoryIn(BaseModel):
    name: str = Field(min_length=2, max_length=60); description: str = ''; sort_order: int = 0; active: bool = True
@app.get('/api/admin/categories')
def admin_categories(user=Depends(admin)):
    with conn() as c:
        counts = {r['category']: r['n'] for r in rows(c, 'SELECT category,COUNT(*) n FROM products GROUP BY category')}
        return [{**r, 'active': bool(r['active']), 'product_count': counts.get(r['name'], 0)} for r in rows(c, 'SELECT * FROM categories ORDER BY sort_order,name')]
@app.post('/api/admin/categories')
def create_category(body: CategoryIn, user=Depends(admin)):
    try:
        with conn() as c:
            cid = uuid.uuid4().hex; c.execute('INSERT INTO categories VALUES(?,?,?,?,?,?,?)', (cid, body.name.strip(), slugify(body.name), body.description, '', body.sort_order, int(body.active))); audit(c, user, 'create_category', 'category', cid, {'name': body.name})
    except (sqlite3.IntegrityError, psycopg.IntegrityError): raise HTTPException(409, 'Category already exists')
    return {'id': cid}
@app.put('/api/admin/categories/{cid}')
def update_category(cid: str, body: CategoryIn, user=Depends(admin)):
    with conn() as c:
        old = one(c, 'SELECT * FROM categories WHERE id=?', (cid,))
        if not old: raise HTTPException(404, 'Not found')
        try: c.execute('UPDATE categories SET name=?,slug=?,description=?,sort_order=?,active=? WHERE id=?', (body.name.strip(), slugify(body.name), body.description, body.sort_order, int(body.active), cid))
        except (sqlite3.IntegrityError, psycopg.IntegrityError): raise HTTPException(409, 'Category name already exists')
        c.execute('UPDATE products SET category=? WHERE category=?', (body.name.strip(), old['name'])); audit(c, user, 'update_category', 'category', cid, {'name': body.name})
    return {'ok': True}
class CollectionIn(BaseModel):
    name: str = Field(min_length=2, max_length=80); description: str = ''; featured: bool = False; product_ids: list[str] = Field(default_factory=list)
@app.get('/api/admin/collections')
def admin_collections(user=Depends(admin)):
    with conn() as c: return [{**r, 'featured': bool(r['featured']), 'product_ids': [x['product_id'] for x in rows(c, 'SELECT product_id FROM product_collections WHERE collection_id=?', (r['id'],))]} for r in rows(c, 'SELECT * FROM collections ORDER BY created_at DESC')]
def save_collection(c, body, cid=None):
    try:
        if cid: c.execute('UPDATE collections SET name=?,slug=?,description=?,featured=? WHERE id=?', (body.name, slugify(body.name), body.description, int(body.featured), cid))
        else: cid = uuid.uuid4().hex; c.execute('INSERT INTO collections VALUES(?,?,?,?,?,?)', (cid, body.name, slugify(body.name), body.description, int(body.featured), now()))
    except (sqlite3.IntegrityError, psycopg.IntegrityError): raise HTTPException(409, 'Collection already exists')
    c.execute('DELETE FROM product_collections WHERE collection_id=?', (cid,))
    for pid in body.product_ids: c.execute('INSERT OR IGNORE INTO product_collections SELECT id,? FROM products WHERE id=?', (cid, pid))
    return cid
@app.post('/api/admin/collections')
def create_collection(body: CollectionIn, user=Depends(admin)):
    with conn() as c: cid = save_collection(c, body); audit(c, user, 'create_collection', 'collection', cid, {'name': body.name}); return {'id': cid}
@app.put('/api/admin/collections/{cid}')
def update_collection(cid: str, body: CollectionIn, user=Depends(admin)):
    with conn() as c: save_collection(c, body, cid); audit(c, user, 'update_collection', 'collection', cid); return {'ok': True}
@app.delete('/api/admin/collections/{cid}')
def delete_collection(cid: str, user=Depends(admin)):
    with conn() as c: c.execute('DELETE FROM product_collections WHERE collection_id=?', (cid,)); c.execute('DELETE FROM collections WHERE id=?', (cid,)); audit(c, user, 'delete_collection', 'collection', cid)
    return {'ok': True}

# ---------- support, settings, admins, audit ----------
@app.get('/api/admin/messages')
def admin_messages(status: str = '', user=Depends(admin)):
    with conn() as c: return rows(c, 'SELECT * FROM support_requests' + (' WHERE status=?' if status else '') + ' ORDER BY created_at DESC LIMIT 500', (status,) if status else ())
class MessageUpdate(BaseModel):
    status: str = Field(pattern='^(open|in_progress|closed)$'); reply: str = ''
@app.patch('/api/admin/messages/{mid}')
def update_message(mid: str, body: MessageUpdate, user=Depends(admin)):
    with conn() as c:
        m = one(c, 'SELECT * FROM support_requests WHERE id=?', (mid,))
        if not m: raise HTTPException(404, 'Not found')
        c.execute('UPDATE support_requests SET status=?,reply=?,updated_at=? WHERE id=?', (body.status, body.reply, now(), mid)); audit(c, user, 'update_message', 'support', mid, {'status': body.status})
        if body.reply and body.reply != m['reply']: send_email(m['email'], 'Re: ' + m['subject'], body.reply)
    return {'ok': True}
@app.get('/api/admin/settings')
def admin_settings(user=Depends(admin)):
    with conn() as c: return get_settings(c)
@app.put('/api/admin/settings')
def update_settings(body: dict, user=Depends(admin)):
    with conn() as c:
        for k, v in body.items():
            if k in DEFAULT_SETTINGS:
                if k.endswith('_url') and v: validate_url(v)
                c.execute('INSERT OR REPLACE INTO settings VALUES(?,?)', (k, json.dumps(v)))
        audit(c, user, 'update_settings', 'settings', '', {'keys': [k for k in body if k in DEFAULT_SETTINGS]}); return get_settings(c)
@app.get('/api/admin/newsletter')
def admin_newsletter(user=Depends(admin)):
    with conn() as c: return rows(c, 'SELECT * FROM newsletter ORDER BY consent_at DESC')
@app.get('/api/admin/admins')
def list_admins(user=Depends(admin)):
    with conn() as c: return rows(c, "SELECT id,name,email,role,created_at,last_login_at FROM users WHERE role IN ('admin','super_admin') ORDER BY created_at")
class AdminRole(BaseModel):
    email: EmailStr; role: str = Field(pattern='^(admin|super_admin|customer)$')
@app.post('/api/admin/admins')
def set_admin_role(body: AdminRole, user=Depends(super_admin)):
    with conn() as c:
        u = one(c, 'SELECT id,role FROM users WHERE email=?', (body.email.lower(),))
        if not u: raise HTTPException(404, 'No account with that email. Ask them to register first')
        if u['id'] == user['id']: raise HTTPException(400, 'You cannot change your own role')
        c.execute('UPDATE users SET role=?,token_version=token_version+1 WHERE id=?', (body.role, u['id'])); audit(c, user, 'set_role', 'user', u['id'], {'role': body.role, 'email': body.email})
    return {'ok': True}
@app.get('/api/admin/audit-logs')
def audit_logs(user=Depends(admin)):
    with conn() as c: return [{**r, 'metadata': jl(r['metadata'], {})} for r in rows(c, 'SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 500')]
@app.get('/api/admin/search')
def admin_search(q: str = Query(..., min_length=2), user=Depends(admin)):
    with conn() as c:
        like = f'%{q}%'
        return {'products': rows(c, 'SELECT id,title,status FROM products WHERE title LIKE ? OR slug LIKE ? LIMIT 6', (like, like)),
                'orders': [{'id': o['id'], 'number': 'YK-' + o['id'][:8].upper(), 'status': o['status'], 'total': o['total']} for o in rows(c, 'SELECT o.* FROM orders o JOIN users u ON u.id=o.user_id WHERE o.id LIKE ? OR u.email LIKE ? LIMIT 6', (f"%{q.lower().replace('yk-', '')}%", like))],
                'customers': rows(c, "SELECT id,name,email FROM users WHERE role='customer' AND (name LIKE ? OR email LIKE ?) LIMIT 6", (like, like))}

@app.get('/api/sitemap.xml')
def sitemap():
    with conn() as c: slugs = [r['slug'] for r in rows(c, "SELECT slug FROM products WHERE status='published'")] ; cats = [r['slug'] for r in rows(c, 'SELECT slug FROM categories WHERE active=1')]
    urls = ['', '/new', '/templates', '/components', '/bundles', '/faq', '/about', '/licenses', '/contact'] + [f'/categories/{s}' for s in cats] + [f'/products/{s}' for s in slugs]
    body = ''.join(f'<url><loc>{SITE_URL}{u}</loc></url>' for u in urls)
    return Response(f'<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">{body}</urlset>', media_type='application/xml')
