import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ShoppingCart, X, Check, Tag, Info as InfoIcon, User, FileText, CreditCard, Lock, ShieldCheck, Zap, RefreshCw, Infinity as InfinityIcon, ArrowRight, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';
import { api, errMsg, imgUrl, inr, PHOTOS } from '../lib/api';
import { useAuth, useStore } from '../lib/store';
import { useHealth, useTitle } from '../lib/hooks';
import { EmptyState, Spinner } from '../components/common';

const COUNTRIES = ['India', 'United States', 'United Kingdom', 'Canada', 'Australia', 'Germany', 'Singapore', 'United Arab Emirates', 'Other'];
const METHODS = [['upi', 'UPI', 'GPay, PhonePe, Paytm & more'], ['card', 'Credit / Debit card', 'Visa, Mastercard, RuPay'], ['netbanking', 'Net banking', 'All major Indian banks'], ['wallet', 'Wallets', 'Supported wallets']];

function loadRazorpay() {
  return new Promise((res, rej) => {
    if (window.Razorpay) return res();
    const s = document.createElement('script'); s.src = 'https://checkout.razorpay.com/v1/checkout.js'; s.onload = res; s.onerror = () => rej(new Error('Could not load Razorpay Checkout')); document.body.appendChild(s);
  });
}

function CartLine({ l, onLicense, onRemove }) {
  const p = l.product;
  return (
    <div className="grid gap-4 border-b py-5 sm:grid-cols-[190px_1fr_auto]" style={{ borderColor: 'var(--border-soft)' }} data-testid={`cart-line-${p.slug}`}>
      <Link to={`/products/${p.slug}`} className="overflow-hidden rounded-[8px]" style={{ border: '1px solid var(--border)' }}><img src={imgUrl(p.preview_url)} alt={p.title} className="aspect-[16/10] w-full object-cover" /></Link>
      <div className="min-w-0">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div><Link to={`/products/${p.slug}`} className="font-display text-xl font-bold hover:underline">{p.title}</Link><p className="text-sm yk-muted">{p.short_description || p.category}</p></div>
          <select value={l.license.id} onChange={(e) => onLicense(e.target.value)} className="yk-input !w-auto !py-2 text-xs" aria-label="License" data-testid={`cart-license-${p.slug}`}>{p.licenses.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select>
        </div>
        <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs">{[...(p.tech_stack || []).slice(0, 2), l.license.name].map((t) => <li key={t} className="flex items-center gap-1.5"><Check size={13} style={{ color: 'var(--accent)' }} />{t}</li>)}</ul>
        {l.owned && <p className="mt-2 text-xs" style={{ color: '#F2C46B' }}>You already own this product — remove it to continue.</p>}
      </div>
      <div className="flex items-start gap-4 sm:flex-col sm:items-end">
        <span className="font-display text-xl font-bold" data-testid={`cart-price-${p.slug}`}>{inr(l.price)}</span>
        <button type="button" onClick={onRemove} className="yk-btn-ghost !p-1.5" aria-label={`Remove ${p.title}`} data-testid={`cart-remove-${p.slug}`}><X size={18} /></button>
      </div>
    </div>
  );
}

function Steps({ n }) {
  return (
    <ol className="flex items-start px-2 pb-6" aria-label="Checkout progress" data-testid="checkout-steps">
      {['Your information', 'Payment', 'Complete'].map((t, i) => (
        <li key={t} className="flex flex-1 flex-col items-center gap-2 text-center text-[13px] font-medium" aria-current={i + 1 === n ? 'step' : undefined}>
          <div className="relative flex w-full justify-center">
            {i > 0 && <span className="absolute right-1/2 top-1/2 h-px w-full" style={{ background: 'var(--border)' }} />}
            <span className="relative z-10 flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold" style={{ background: i + 1 <= n ? 'var(--accent)' : 'var(--surface)', border: '1.5px solid ' + (i + 1 <= n ? 'var(--accent)' : 'var(--text-2)'), color: i + 1 <= n ? '#fff' : 'var(--text)' }}>{i + 1}</span>
          </div>{t}
        </li>
      ))}
    </ol>
  );
}

const Panel = ({ icon: I, title, children }) => <section className="yk-card-2 p-5"><h2 className="mb-4 flex items-center gap-2.5 text-lg font-bold"><I size={19} />{title}</h2>{children}</section>;
const Field = ({ label, req, children, className = '' }) => <label className={className}><span className="yk-label">{label}{req && <span className="req"> *</span>}</span>{children}</label>;

function CheckoutForm({ q, coupon }) {
  const { user } = useAuth(); const { cart, clearCartLocal } = useStore(); const health = useHealth(); const nav = useNavigate();
  const [b, setB] = useState({ name: user?.name || '', email: user?.email || '', country: 'India', address: '', address2: '', city: '', state: '', postal_code: '', phone: user?.phone || '' });
  const [method, setMethod] = useState('upi'); const [busy, setBusy] = useState(false); const [errors, setErrors] = useState({});
  const set = (k) => (e) => setB({ ...b, [k]: e.target.value });
  if (!user) return (
    <div className="space-y-4" data-testid="checkout-signin-required">
      <Panel icon={User} title="Sign in to continue"><p className="mb-4 text-sm yk-muted">Purchases are delivered to your YKNOVA Studio library, so you need an account to check out. Your cart is kept.</p>
        <div className="flex gap-3"><Link to="/login?next=/checkout" className="yk-btn flex-1" data-testid="checkout-login">Sign in</Link><Link to="/register?next=/checkout" className="yk-btn-outline flex-1" data-testid="checkout-register">Create account</Link></div></Panel>
    </div>
  );
  const validate = () => {
    const e = {};
    if (b.name.trim().length < 2) e.name = 'Enter your full name';
    if (!/^\S+@\S+\.\S+$/.test(b.email)) e.email = 'Enter a valid email';
    if (b.country === 'India' && !b.state.trim()) e.state = 'State is required for Indian billing';
    setErrors(e); return !Object.keys(e).length;
  };
  const fail = async (order_id, reason, canceled) => { await api.post('/checkout/failed', { order_id, reason, canceled }).catch(() => {}); nav(`/checkout/failed?reason=${encodeURIComponent(reason)}`); };
  const pay = async () => {
    if (!validate()) return;
    setBusy(true);
    try {
      const { data: o } = await api.post('/checkout/create-order', { items: cart, coupon, billing: b });
      await loadRazorpay();
      const rzp = new window.Razorpay({
        key: o.key_id, amount: o.amount, currency: o.currency, order_id: o.razorpay_order_id, name: o.name, description: `Order ${o.order_id.slice(0, 8).toUpperCase()}`,
        prefill: { ...o.prefill, method }, notes: { studio_order: o.order_id }, theme: { color: '#BC4639' },
        handler: async (r) => {
          try { const v = await api.post('/checkout/verify', r); clearCartLocal(); nav(`/checkout/success?order=${v.data.order_id}&status=${v.data.status}`); } catch (e) { toast.error(errMsg(e)); nav(`/checkout/failed?reason=${encodeURIComponent(errMsg(e))}`); }
        },
        modal: { ondismiss: () => { setBusy(false); fail(o.order_id, 'Payment window closed before completion', true); } },
      });
      rzp.on('payment.failed', (r) => fail(o.order_id, r.error?.description || 'Payment failed', false));
      rzp.open();
    } catch (e) { toast.error(errMsg(e)); setBusy(false); }
  };
  const err = (k) => errors[k] && <span className="mt-1 block text-xs" style={{ color: '#F19A8E' }}>{errors[k]}</span>;
  const blocked = !q.lines.length || q.lines.some((l) => l.owned) || !health?.payments_enabled;
  return (
    <div className="space-y-4">
      <Panel icon={User} title="Customer information">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Full name" req><input className="yk-input" value={b.name} onChange={set('name')} data-testid="checkout-name" />{err('name')}</Field>
          <Field label="Email address" req><input type="email" className="yk-input" value={b.email} onChange={set('email')} data-testid="checkout-email" />{err('email')}</Field>
        </div>
      </Panel>
      <Panel icon={FileText} title="Billing details">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Country / Region" req className="sm:col-span-2"><select className="yk-input" value={b.country} onChange={set('country')} data-testid="checkout-country">{COUNTRIES.map((c) => <option key={c}>{c}</option>)}</select></Field>
          <Field label="Address"><input className="yk-input" value={b.address} onChange={set('address')} data-testid="checkout-address" /></Field>
          <Field label="Apartment, suite (optional)"><input className="yk-input" value={b.address2} onChange={set('address2')} data-testid="checkout-address2" /></Field>
          <Field label="City"><input className="yk-input" value={b.city} onChange={set('city')} data-testid="checkout-city" /></Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="State" req={b.country === 'India'}><input className="yk-input" value={b.state} onChange={set('state')} data-testid="checkout-state" />{err('state')}</Field>
            <Field label="PIN / ZIP"><input className="yk-input" value={b.postal_code} onChange={set('postal_code')} data-testid="checkout-postal" /></Field>
          </div>
          <Field label="Phone (for payment OTP, optional)" className="sm:col-span-2"><input className="yk-input" value={b.phone} onChange={set('phone')} data-testid="checkout-phone" /></Field>
        </div>
      </Panel>
      <Panel icon={CreditCard} title="Payment method">
        <div className="grid gap-3 sm:grid-cols-2" role="radiogroup">
          {METHODS.map(([k, t, d]) => <label key={k} className="flex cursor-pointer items-start gap-3 rounded-[8px] p-3.5" style={{ border: `1.5px solid ${method === k ? 'var(--accent)' : 'var(--border)'}`, background: method === k ? 'var(--accent-soft)' : 'transparent' }}><input type="radio" name="method" checked={method === k} onChange={() => setMethod(k)} className="mt-1 accent-[var(--accent)]" data-testid={`pay-method-${k}`} /><span><span className="block text-sm font-semibold">{t}</span><span className="text-xs yk-muted">{d}</span></span></label>)}
        </div>
        <p className="mt-3 text-xs yk-muted">Card, UPI and bank details are entered in Razorpay's secure window. YKNOVA Studio never sees or stores them.</p>
      </Panel>
      <div className="yk-card-2 flex items-center gap-3 p-4"><Lock size={22} style={{ color: 'var(--rose)' }} /><div><div className="text-sm font-semibold">Secure checkout</div><div className="text-xs yk-muted">Payments are processed by Razorpay and verified by our server before files are unlocked.</div></div></div>
      {health && !health.payments_enabled && <p className="rounded-[8px] p-3 text-sm" style={{ background: '#3D311A', color: '#F2C46B' }} data-testid="payments-disabled-notice">Payments are not activated yet. Paid checkout will open as soon as the payment gateway is configured.</p>}
      {health?.payment_mode === 'test' && health?.payments_enabled && <p className="text-center text-xs yk-muted" data-testid="test-mode-notice">Razorpay TEST MODE — no real money is charged.</p>}
      <button type="button" disabled={busy || blocked} onClick={pay} className="flex w-full items-center justify-center gap-2 rounded-[8px] py-4 text-[17px] font-semibold text-white transition-colors disabled:opacity-50" style={{ background: 'var(--blue)' }} data-testid="pay-now-button"><Lock size={17} />{busy ? 'Opening secure payment…' : `Pay now — ${inr(q.total, { free: false })}`}</button>
      <p className="text-center text-xs yk-muted">By completing your purchase, you agree to our <Link to="/terms" className="underline">Terms of Use</Link>, <Link to="/licenses" className="underline">License</Link> and <Link to="/refund-policy" className="underline">Refund Policy</Link>.</p>
    </div>
  );
}

export default function Checkout({ step }) {
  useTitle(step === 'cart' ? 'Cart' : 'Checkout');
  const { cart, addToCart, removeFromCart } = useStore(); const nav = useNavigate();
  const [q, setQ] = useState(null); const [code, setCode] = useState(''); const [coupon, setCoupon] = useState('');
  const load = async (c = coupon) => {
    try { setQ((await api.post('/cart/quote', { items: cart, coupon: c })).data); return true; } catch (e) { toast.error(errMsg(e)); if (c) { setCoupon(''); setQ((await api.post('/cart/quote', { items: cart, coupon: '' })).data); } return false; }
  };
  useEffect(() => { load(); }, [cart]); // eslint-disable-line
  useEffect(() => { q?.issues?.forEach((i) => removeFromCart(i.product_id)); }, [q]); // eslint-disable-line
  const apply = async () => { if (await load(code.trim())) { setCoupon(code.trim()); if (code.trim()) toast.success('Promo code applied'); } };
  return (
    <div>
      <section className="relative overflow-hidden" style={{ borderBottom: '1px solid var(--border-soft)' }}>
        <img src={PHOTOS.treasury} alt="" className="absolute right-0 top-0 h-full w-full object-cover object-[50%_30%] opacity-60 md:w-[55%]" />
        <div className="absolute inset-0" style={{ background: 'linear-gradient(90deg, var(--bg) 35%, rgba(27,15,12,0.2) 100%)' }} />
        <div className="yk-container relative py-10">
          <nav className="mb-3 flex items-center gap-1.5 text-[13px]" aria-label="Breadcrumb"><Link to="/" className="yk-muted hover:underline">Store</Link><ChevronRight size={13} /><span>Cart &amp; Checkout</span></nav>
          <h1 className="font-display text-[40px] font-extrabold sm:text-[56px]">Cart &amp; <span style={{ color: '#E0806B' }}>Checkout</span></h1>
          <p className="mt-2 max-w-xl">Review your items, complete your purchase, and get instant access in your library.</p>
        </div>
      </section>
      <div className="yk-container grid gap-6 py-8 lg:grid-cols-[1.45fr_1fr]">
        <section className="yk-card p-5 sm:p-7" data-testid="cart-panel">
          <div className="flex items-center justify-between border-b pb-5" style={{ borderColor: 'var(--border-soft)' }}>
            <h2 className="flex items-center gap-3 text-2xl font-bold"><ShoppingCart size={26} />Your cart <span className="text-base font-medium yk-muted" data-testid="cart-items-count">({cart.length} {cart.length === 1 ? 'item' : 'items'})</span></h2>
            <Link to="/templates" className="hidden items-center gap-2 text-sm font-medium hover:underline sm:flex" data-testid="continue-shopping">Continue shopping <ArrowRight size={15} /></Link>
          </div>
          {!q ? <Spinner /> : !q.lines.length ? <div className="py-8"><EmptyState icon={ShoppingCart} title="Your cart is empty" text="Browse the catalogue and add templates to your cart." action={<Link to="/templates" className="yk-btn">Browse templates</Link>} testid="cart-empty" /></div> : (
            <>
              {q.lines.map((l) => <CartLine key={l.product_id} l={l} onLicense={(lid) => addToCart(l.product_id, lid, true)} onRemove={() => removeFromCart(l.product_id)} />)}
              <div className="mt-6 flex gap-3">
                <label className="flex flex-1 items-center gap-3 rounded-[6px] px-3" style={{ border: '1px solid var(--border)', background: 'var(--surface-2)' }}><Tag size={17} className="yk-muted" /><input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="Enter promo code" aria-label="Promo code" className="w-full bg-transparent py-2.5 text-sm outline-none" data-testid="promo-input" /></label>
                <button type="button" onClick={apply} className="yk-btn" data-testid="promo-apply">Apply</button>
              </div>
              <dl className="mt-6 space-y-3 text-[15px]" data-testid="cart-summary">
                <div className="flex justify-between border-b pb-3" style={{ borderColor: 'var(--border-soft)' }}><dt>Subtotal</dt><dd data-testid="cart-subtotal">{inr(q.subtotal, { free: false })}</dd></div>
                {q.discount > 0 && <div className="flex justify-between border-b pb-3" style={{ borderColor: 'var(--border-soft)' }}><dt>Discount ({q.discount_code}) <button type="button" className="ml-2 text-xs underline yk-muted" onClick={() => { setCoupon(''); setCode(''); load(''); }} data-testid="promo-remove">remove</button></dt><dd data-testid="cart-discount">−{inr(q.discount, { free: false })}</dd></div>}
                <div className="flex justify-between border-b pb-3" style={{ borderColor: 'var(--border-soft)' }}><dt className="flex items-center gap-1.5">Tax {q.tax_rate_percent ? `(${q.tax_rate_percent}%)` : ''}<InfoIcon size={14} className="yk-muted" aria-label="Tax is only charged where legally applicable" /></dt><dd data-testid="cart-tax">{q.tax ? inr(q.tax, { free: false }) : 'Not applicable'}</dd></div>
                <div className="flex items-center justify-between rounded-[8px] px-5 py-4" style={{ background: 'var(--elev)' }}><dt className="font-display text-xl font-bold">Total</dt><dd className="font-display text-2xl font-extrabold" data-testid="cart-total">{inr(q.total, { free: false })}</dd></div>
              </dl>
            </>
          )}
          <div className="mt-8 grid gap-5 border-t pt-6 sm:grid-cols-2 xl:grid-cols-4" style={{ borderColor: 'var(--border-soft)' }}>
            {[[ShieldCheck, 'Secure payment', 'Processed by Razorpay.'], [Zap, 'Instant download', 'Files unlock after verified payment.'], [RefreshCw, 'Version updates', 'New versions in your library.'], [InfinityIcon, 'Clear licensing', 'Personal & commercial options.']].map(([I, t, d]) => <div key={t} className="flex gap-3"><I size={22} style={{ color: 'var(--accent)' }} className="shrink-0" /><div><div className="text-sm font-semibold">{t}</div><div className="text-xs yk-muted">{d}</div></div></div>)}
          </div>
        </section>
        <aside className="yk-card h-fit p-4 sm:p-5" data-testid="checkout-panel">
          <Steps n={step === 'cart' ? 1 : 2} />
          {step === 'cart' ? (
            <div className="yk-card-2 space-y-4 p-5">
              <h2 className="text-lg font-bold">Order summary</h2>
              <div className="flex justify-between text-sm"><span>{q?.lines.length || 0} item(s)</span><span className="font-semibold">{inr(q?.total || 0, { free: false })}</span></div>
              <button type="button" disabled={!q?.lines.length} onClick={() => nav('/checkout')} className="yk-btn w-full !py-3" data-testid="proceed-to-checkout">Proceed to checkout <ArrowRight size={16} /></button>
              <Link to="/templates" className="yk-btn-outline w-full" data-testid="continue-shopping-2">Continue shopping</Link>
            </div>
          ) : q ? <CheckoutForm q={q} coupon={coupon} /> : <Spinner />}
        </aside>
      </div>
    </div>
  );
}
