# YKNOVA Studio — Production rollout (staged)

This repository adds Cloudflare R2 object storage and stronger payment checks, but **is not yet ready for live customer payments**. The application still uses SQLite; do not deploy SQLite on an ephemeral Render filesystem. PostgreSQL migration is not implemented in this codebase. Either use a paid Render persistent disk plus tested offsite backups for an interim single-instance deployment, or complete a tested PostgreSQL adapter/data migration first.

## Critical source-control cleanup

The previous Git history tracked `backend/data/studio.sqlite3`. Treat this as sensitive: inspect the DB for users/password hashes/other private data, remove it from tracked files with `git rm --cached backend/data/studio.sqlite3`, rotate any affected credentials if exposure occurred, and rewrite Git history if the repository was public. `.gitignore` prevents future additions, not previous exposures. Never upload your service-account JSON or secret `.env` files.

## Deploy backend (Render; interim SQLite with paid persistent disk)

1. Set root directory `backend`; build: `pip install -r requirements.txt`; start: `uvicorn server:app --host 0.0.0.0 --port $PORT`.
2. Attach Render persistent disk at `/var/data`; set `DATA_DIR=/var/data/yknova`. Use **one backend instance** (SQLite locking constraints). Create an offsite daily SQLite backup (using Python sqlite3 backup API) and test recovery.
3. Add production env vars from `backend/.env.example` using Render's secrets UI. Provide Firebase Admin JSON via a Render secret file; set `GOOGLE_APPLICATION_CREDENTIALS` to its absolute path. Never expose this JSON to frontend.
4. Set `FRONTEND_ORIGINS` to the exact Pages/custom domain(s). Set `PUBLIC_SITE_URL` to the public storefront URL. Require HTTPS.
5. The R2 bucket must be **private**. Create an R2 API token restricted to that specific bucket and necessary object read/write privileges. Set all four `R2_*` variables. Avoid a public R2 custom-domain URL for private ZIPs. Test uploads before publishing products.
6. Historical objects from local `OBJECT_STORAGE_DIR` are **not** transferred automatically. Migrate them to R2 preserving their object keys before switching. Historical SQLite/legacy `PACKAGES` files also need explicit migration.
7. Check `/api/health` and keep it off the public landing page. Watch error logs for failed storage/auth/payment events.

## Deploy frontend (Cloudflare Pages)

Framework preset: Create React App; root `frontend`; build `npm ci --legacy-peer-deps && npm run build`; output `build`. Set all `REACT_APP_*` values in Pages environment variables, pointing `REACT_APP_BACKEND_URL` to your Render HTTPS API. CRA bakes these values into the production JS; rebuild after changes. Add Pages or custom hostname to Firebase Authentication authorized domains. Configure SPA fallback to index.html for React routes.

## Payments

1. Do not set `ALLOW_LIVE_PAYMENTS=1` until approved merchant onboarding, business/legal pages, checkout and webhook verification tests are complete. Use Razorpay **test mode** keys initially.
2. Configure webhook URL: `https://YOUR_API_HOST/api/webhooks/razorpay`, with a unique `RAZORPAY_WEBHOOK_SECRET`. Subscribe to payment.captured, order.paid, payment.failed, refund.* events. Verify raw-body signature in integration tests.
3. Test successful payment, declined payment, duplicate callbacks, wrong amount/order/currency, refunds, entitlements and download access. Reconcile payouts and refund policy.
4. If `RAZORPAY_WEBHOOK_SECRET` is empty, checkout stays disabled by design.

## Admin uploads & downloads

Existing admin UI and API already allow preview images, ZIP uploads, product publishing, free claims, orders, and entitlement-based signed download links. With R2 configured, new object keys persist in the private bucket. ZIP downloads redirect to a short-lived R2 presigned URL only *after* the application checks entitlements. R2's object-storage operation is not atomic with SQLite updates; monitor orphan objects after database failures.

## Auth/security remaining before a real launch

Firebase login still uses a local application JWT exchange and some legacy email/password endpoints remain enabled. Frontend now sends refreshed Firebase ID tokens to protected APIs rather than persisting Firebase-exchanged JWTs in localStorage. Legacy sessions still remain supported behind `ALLOW_LEGACY_AUTH` for migration; set `ALLOW_LEGACY_AUTH=0` in staging/production. Complete legacy endpoint review, admin MFA/reauthentication, account linking for preexisting customers, and security tests before live deployment. Production rollout is **not** cleared until these are resolved.

## Launch sequence

1. Local smoke tests and security regression tests.
2. Private R2 test uploads and download entitlement tests.
3. Persistent database and offsite backup proof; PostgreSQL adapter/migration if that is the chosen architecture.
4. Test payments, signed webhook event tests, admin audit, and restore drills.
5. Pages/Render staging URL, Firebase authorized domains, CORS, SEO/legal/privacy/refunds, Instagram bio link.
6. Enable live checkout only after Razorpay KYC/approval and the full staging gate is passed.
