import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Download, FileText, BookOpen, Package, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';
import { api, downloadProduct, errMsg, fmtDate, imgUrl, inr, orderNo, openAuthed } from '../lib/api';
import { useAuth } from '../lib/store';
import { useTitle } from '../lib/hooks';
import { EmptyState, Spinner, StatusBadge } from '../components/common';
import { WishlistGrid } from '../pages/Wishlist';

const useData = (url) => { const [d, setD] = useState(null); useEffect(() => { api.get(url).then((r) => setD(r.data)).catch(() => setD([])); }, [url]); return d; };
const Head = ({ title, sub }) => <div className="mb-6"><h1 className="text-[32px] font-extrabold" data-testid="account-page-title">{title}</h1>{sub && <p className="mt-1 yk-muted">{sub}</p>}</div>;
const dl = async (id) => { try { await downloadProduct(id); } catch (e) { toast.error(errMsg(e)); } };

export function LibraryCard({ p, compact }) {
  return (
    <div className="yk-card-2 flex flex-col overflow-hidden" data-testid={`library-item-${p.slug}`}>
      <img src={imgUrl(p.preview_url)} alt="" className="aspect-[16/10] w-full object-cover" loading="lazy" />
      <div className="flex flex-1 flex-col gap-2 p-3">
        <div><div className="font-display text-[17px] font-bold">{p.title}</div><div className="text-xs yk-muted">{p.short_description || p.category}</div></div>
        <span className="yk-badge self-start" style={{ background: 'var(--elev)', color: 'var(--text)' }}>{p.license_name}</span>
        {!compact && <div className="text-xs yk-muted">Purchased v{p.purchased_version} · Latest v{p.available_version}{p.purchased_version !== p.available_version && <span style={{ color: '#8FD19E' }}> · update available</span>}</div>}
        <button type="button" onClick={() => dl(p.id)} className="yk-btn-outline mt-auto !py-1.5 text-[13px]" data-testid={`library-download-${p.slug}`}><Download size={14} />Download</button>
        {!compact && <Link to={`/products/${p.slug}`} className="flex items-center justify-center gap-1.5 text-xs underline yk-muted" data-testid={`library-docs-${p.slug}`}><BookOpen size={13} />Documentation & details</Link>}
      </div>
    </div>
  );
}

function Library() {
  const d = useData('/library');
  return (<><Head title="My library" sub="Everything you have purchased or claimed. Download any version you are entitled to, any time." />
    {!d ? <Spinner /> : !d.length ? <EmptyState title="Your library is empty" text="Purchased templates appear here after verified payment." action={<Link to="/templates" className="yk-btn">Browse marketplace</Link>} testid="library-empty" /> : <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" data-testid="library-grid">{d.map((p) => <LibraryCard key={p.id} p={p} />)}</div>}</>);
}

function Downloads() {
  const d = useData('/download-history');
  return (<><Head title="Download history" />
    {!d ? <Spinner /> : !d.length ? <EmptyState icon={Download} title="No downloads yet" testid="downloads-empty" /> : (
      <div className="yk-card overflow-x-auto"><table className="yk-table w-full min-w-[640px]" data-testid="downloads-table"><thead><tr><th>Product</th><th>Version</th><th>File</th><th>Downloaded</th><th /></tr></thead><tbody>{d.map((x) => <tr key={x.id}><td className="font-semibold">{x.title}</td><td>v{x.version}</td><td className="text-xs yk-muted">{x.filename}</td><td>{new Date(x.downloaded_at).toLocaleString('en-IN')}</td><td><button type="button" className="yk-btn-ghost text-xs" onClick={() => dl(x.product_id)} data-testid={`download-again-${x.id}`}><Download size={14} />Download again</button></td></tr>)}</tbody></table></div>
    )}</>);
}

function Orders() {
  const d = useData('/orders');
  return (<><Head title="Orders" />
    {!d ? <Spinner /> : !d.length ? <EmptyState icon={Package} title="No orders yet" action={<Link to="/templates" className="yk-btn">Browse marketplace</Link>} testid="orders-empty" /> : (
      <div className="yk-card overflow-x-auto"><table className="yk-table w-full min-w-[700px]" data-testid="account-orders-table"><thead><tr><th>Order</th><th>Date</th><th>Products</th><th>Total</th><th>Status</th><th /></tr></thead><tbody>{d.map((o) => <tr key={o.id}><td className="font-semibold">{orderNo(o.id)}</td><td>{fmtDate(o.created_at)}</td><td className="max-w-[240px] truncate">{o.items.map((i) => i.title).join(', ')}</td><td>{inr(o.total, { free: false })}</td><td><StatusBadge status={o.status} /></td><td><Link to={`/account/orders/${o.id}`} className="yk-btn-ghost text-xs" data-testid={`account-order-view-${o.id}`}>View details<ChevronRight size={14} /></Link></td></tr>)}</tbody></table></div>
    )}</>);
}

function OrderDetail() {
  const { id } = useParams(); const o = useData(`/orders/${id}`);
  if (!o) return <Spinner />;
  if (!o.id) return <EmptyState title="Order not found" testid="order-not-found" />;
  const paid = ['paid', 'partially_refunded', 'refunded'].includes(o.status);
  return (<><Link to="/account/orders" className="text-sm yk-muted hover:underline">← Orders</Link><Head title={`Order ${orderNo(o.id)}`} sub={`Placed ${new Date(o.created_at).toLocaleString('en-IN')}`} />
    <div className="grid gap-5 lg:grid-cols-[1.5fr_1fr]">
      <section className="yk-card p-5" data-testid="order-detail-items">{o.items.map((i) => <div key={i.id} className="flex items-center gap-4 border-b py-3" style={{ borderColor: 'var(--border-soft)' }}><img src={imgUrl(i.preview_url)} alt="" className="h-14 w-24 rounded-[6px] object-cover" /><div className="flex-1"><div className="font-semibold">{i.title}</div><div className="text-xs yk-muted">{i.license_snapshot} · v{i.version_snapshot}</div></div><div className="font-semibold">{inr(i.unit_price)}</div>{paid && o.status !== 'refunded' && <button type="button" className="yk-icon-btn" onClick={() => dl(i.product_id)} aria-label="Download" data-testid={`order-download-${i.product_id}`}><Download size={15} /></button>}</div>)}
        <dl className="mt-4 space-y-2 text-sm"><div className="flex justify-between"><dt>Subtotal</dt><dd>{inr(o.subtotal ?? o.total, { free: false })}</dd></div>{o.discount > 0 && <div className="flex justify-between"><dt>Discount ({o.discount_code})</dt><dd>−{inr(o.discount)}</dd></div>}{o.tax > 0 && <div className="flex justify-between"><dt>Tax</dt><dd>{inr(o.tax)}</dd></div>}<div className="flex justify-between font-display text-lg font-bold"><dt>Total</dt><dd>{inr(o.total, { free: false })}</dd></div></dl>
      </section>
      <section className="yk-card space-y-3 p-5 text-sm"><div className="flex justify-between"><span className="yk-muted">Status</span><StatusBadge status={o.status} /></div><div className="flex justify-between"><span className="yk-muted">Payment reference</span><code className="text-xs">{o.razorpay_payment_id || '—'}</code></div>{o.failure_reason && <p className="yk-muted">{o.failure_reason}</p>}
        <div><div className="yk-muted">Billed to</div>{o.billing.name}<br />{o.billing.email}<br />{[o.billing.city, o.billing.state, o.billing.country].filter(Boolean).join(', ')}</div>
        {paid && <button type="button" className="yk-btn-outline w-full" onClick={() => openAuthed(`/orders/${o.id}/invoice`)} data-testid="order-view-invoice"><FileText size={15} />View invoice</button>}
        {['failed', 'canceled', 'pending'].includes(o.status) && <Link to="/checkout" className="yk-btn w-full" data-testid="order-retry">Retry checkout</Link>}
      </section>
    </div></>);
}

function Invoices() {
  const d = useData('/orders'); const paid = (d || []).filter((o) => ['paid', 'partially_refunded', 'refunded'].includes(o.status));
  return (<><Head title="Invoices" sub="Invoices are generated from your paid orders. No tax is shown unless it was legally charged." />
    {!d ? <Spinner /> : !paid.length ? <EmptyState icon={FileText} title="No invoices yet" testid="invoices-empty" /> : <div className="yk-card overflow-x-auto"><table className="yk-table w-full min-w-[600px]" data-testid="invoices-table"><thead><tr><th>Invoice</th><th>Order</th><th>Date</th><th>Amount</th><th /></tr></thead><tbody>{paid.map((o) => <tr key={o.id}><td className="font-semibold">{o.invoice_number}</td><td>{orderNo(o.id)}</td><td>{fmtDate(o.paid_at || o.created_at)}</td><td>{inr(o.total, { free: false })}</td><td className="flex gap-2"><button type="button" className="yk-btn-ghost text-xs" onClick={() => openAuthed(`/orders/${o.id}/invoice`)} data-testid={`invoice-view-${o.id}`}>View</button><button type="button" className="yk-btn-ghost text-xs" onClick={() => openAuthed(`/orders/${o.id}/invoice`, `${o.invoice_number}.html`)} data-testid={`invoice-download-${o.id}`}><Download size={14} />Download</button></td></tr>)}</tbody></table></div>}</>);
}

function Support() {
  const [list, setList] = useState(null); const [f, setF] = useState({ subject: '', message: '' }); const [busy, setBusy] = useState(false);
  const load = () => api.get('/support/mine').then((r) => setList(r.data));
  useEffect(() => { load(); }, []);
  const submit = async (e) => { e.preventDefault(); setBusy(true); try { await api.post('/support', f); toast.success('Request sent'); setF({ subject: '', message: '' }); load(); } catch (er) { toast.error(errMsg(er)); } setBusy(false); };
  return (<><Head title="Support" sub="Questions about a purchase, download, or license? We're here to help." />
    <div className="grid gap-5 lg:grid-cols-2">
      <form onSubmit={submit} className="yk-card space-y-4 p-5" data-testid="support-form"><label className="block"><span className="yk-label">Subject</span><input className="yk-input" required minLength={3} value={f.subject} onChange={(e) => setF({ ...f, subject: e.target.value })} data-testid="support-subject" /></label><label className="block"><span className="yk-label">Message</span><textarea className="yk-input min-h-[140px]" required minLength={10} value={f.message} onChange={(e) => setF({ ...f, message: e.target.value })} data-testid="support-message" /></label><button disabled={busy} className="yk-btn" data-testid="support-submit">Send request</button></form>
      <section className="yk-card p-5"><h2 className="mb-3 text-lg font-bold">Your requests</h2>{!list ? <Spinner /> : !list.length ? <p className="text-sm yk-muted">No requests yet.</p> : list.map((m) => <div key={m.id} className="border-b py-3 text-sm" style={{ borderColor: 'var(--border-soft)' }}><div className="flex justify-between"><span className="font-semibold">{m.subject}</span><StatusBadge status={m.status} /></div><div className="text-xs yk-faint">{fmtDate(m.created_at)}</div>{m.reply && <p className="mt-1 yk-muted">Reply: {m.reply}</p>}</div>)}</section>
    </div></>);
}

function Profile() {
  const { user, setUser } = useAuth(); const [f, setF] = useState({ name: user.name, phone: user.phone || '', notify_prefs: { product_updates: true, newsletter: false, ...user.notify_prefs } }); const [email, setEmail] = useState('');
  const save = async () => { try { setUser((await api.put('/me', f)).data); toast.success('Profile updated'); } catch (e) { toast.error(errMsg(e)); } };
  const changeEmail = async () => { try { await api.put('/me/email', { email }); toast.success('Check your new inbox for a confirmation link'); setUser({ ...user, pending_email: email }); setEmail(''); } catch (e) { toast.error(errMsg(e)); } };
  const pref = (k) => <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={!!f.notify_prefs[k]} onChange={(e) => setF({ ...f, notify_prefs: { ...f.notify_prefs, [k]: e.target.checked } })} className="accent-[var(--accent)]" data-testid={`pref-${k}`} />{k === 'product_updates' ? 'Updates to products I own' : 'Newsletter & new releases'}</label>;
  return (<><Head title="Profile" />
    <div className="grid gap-5 lg:grid-cols-2">
      <section className="yk-card space-y-4 p-5"><label className="block"><span className="yk-label">Full name</span><input className="yk-input" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} data-testid="profile-name" /></label><label className="block"><span className="yk-label">Phone</span><input className="yk-input" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} data-testid="profile-phone" /></label><div><span className="yk-label">Notifications</span><div className="space-y-2">{pref('product_updates')}{pref('newsletter')}</div></div><button type="button" className="yk-btn" onClick={save} data-testid="profile-save">Save profile</button></section>
      <section className="yk-card space-y-4 p-5"><div><span className="yk-label">Current email</span><p className="text-sm">{user.email}</p>{user.pending_email && <p className="mt-1 text-xs" style={{ color: '#F2C46B' }}>Pending change to {user.pending_email} — confirm from that inbox.</p>}</div><label className="block"><span className="yk-label">New email (requires verification)</span><input type="email" className="yk-input" value={email} onChange={(e) => setEmail(e.target.value)} data-testid="profile-new-email" /></label><button type="button" className="yk-btn-outline" disabled={!email} onClick={changeEmail} data-testid="profile-change-email">Send confirmation</button></section>
    </div></>);
}

function Security() {
  const { user, logout } = useAuth(); const [f, setF] = useState({ current_password: '', new_password: '' });
  const change = async () => { try { await api.put('/me/password', f); toast.success('Password changed'); setF({ current_password: '', new_password: '' }); } catch (e) { toast.error(errMsg(e)); } };
  const all = async () => { await api.post('/auth/logout-all'); toast.success('Signed out of all sessions'); await logout(); window.location.href = '/login'; };
  const verify = async () => { try { await api.post('/auth/verify-email/request'); toast.success('Verification email requested'); } catch (e) { toast.error(errMsg(e)); } };
  const del = async () => { if (!window.confirm('Send an account deletion request? Our team will process it and confirm by email.')) return; await api.post('/me/deletion-request'); toast.success('Deletion request sent to support'); };
  return (<><Head title="Security" />
    <div className="grid gap-5 lg:grid-cols-2">
      <section className="yk-card space-y-4 p-5"><h2 className="text-lg font-bold">Change password</h2><label className="block"><span className="yk-label">Current password</span><input type="password" className="yk-input" value={f.current_password} onChange={(e) => setF({ ...f, current_password: e.target.value })} data-testid="security-current" /></label><label className="block"><span className="yk-label">New password (10+ characters)</span><input type="password" className="yk-input" value={f.new_password} onChange={(e) => setF({ ...f, new_password: e.target.value })} data-testid="security-new" /></label><button type="button" className="yk-btn" disabled={f.new_password.length < 10} onClick={change} data-testid="security-change-password">Update password</button><p className="text-xs yk-muted">Forgot it? <Link to="/forgot-password" className="underline">Reset by email</Link>.</p></section>
      <section className="yk-card space-y-4 p-5"><h2 className="text-lg font-bold">Sessions & account</h2>
        {!user.email_verified && <div className="flex items-center justify-between gap-3 text-sm"><span>Your email is not verified.</span><button type="button" className="yk-btn-outline !py-1.5" onClick={verify} data-testid="security-verify-email">Send verification</button></div>}
        <div className="flex items-center justify-between gap-3 text-sm"><span>Sign out of every device, including this one.</span><button type="button" className="yk-btn-outline !py-1.5" onClick={all} data-testid="security-logout-all">Sign out everywhere</button></div>
        <div className="flex items-center justify-between gap-3 text-sm"><span>Sign out of this device.</span><button type="button" className="yk-btn-outline !py-1.5" onClick={async () => { await logout(); window.location.href = '/'; }} data-testid="security-logout">Sign out</button></div>
        <div className="flex items-center justify-between gap-3 border-t pt-4 text-sm" style={{ borderColor: 'var(--border-soft)' }}><span>Request permanent deletion of your account.</span><button type="button" className="yk-btn-ghost" style={{ color: '#F19A8E' }} onClick={del} data-testid="security-delete-request">Request deletion</button></div>
      </section>
    </div></>);
}

const V = { library: Library, downloads: Downloads, orders: Orders, order: OrderDetail, invoices: Invoices, support: Support, profile: Profile, security: Security, wishlist: () => <><Head title="Wishlist" /><WishlistGrid compact /></> };
export default function Pages({ view }) {
  useTitle(view[0].toUpperCase() + view.slice(1));
  const C = V[view]; return <div className="px-4 py-8 sm:px-8"><C /></div>;
}
