import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Layers, Download, Package, Heart, ArrowRight, ChevronRight, FileText, Headphones, LayoutGrid, Calendar, Check, BadgeCheck, ShieldCheck } from 'lucide-react';
import { api, fmtDate, imgUrl, inr, orderNo, PHOTOS, openAuthed } from '../lib/api';
import { useAuth } from '../lib/store';
import { useTitle } from '../lib/hooks';
import { Spinner, StatusBadge } from '../components/common';
import { LibraryCard } from './Pages';

const Box = ({ title, link, linkLabel, children, testid, className = '' }) => (
  <section className={`yk-card p-5 ${className}`} data-testid={testid}>
    <div className="mb-4 flex items-center justify-between gap-3"><h2 className="text-[22px] font-bold">{title}</h2>{link && <Link to={link} className="flex items-center gap-1.5 text-[13px] font-medium hover:underline">{linkLabel}<ArrowRight size={14} /></Link>}</div>
    {children}
  </section>
);
const Empty = ({ children }) => <p className="py-6 text-center text-sm yk-muted">{children}</p>;

function Tracking({ o }) {
  if (!o) return <Empty>No orders yet.</Empty>;
  const failed = ['failed', 'canceled'].includes(o.status); const done = ['paid', 'partially_refunded', 'refunded'].includes(o.status);
  const steps = [['Placed', true], ['Payment', done || o.status === 'authorized'], [failed ? 'Not completed' : 'Completed', done]];
  return (
    <div className="yk-card-2 p-4" data-testid="order-tracking">
      <div className="font-display text-lg font-bold">{orderNo(o.id)}</div><div className="text-xs yk-muted">{o.items.length} item(s) · placed {fmtDate(o.created_at)}</div>
      <ol className="mt-5 flex">{steps.map(([l, ok], i) => (
        <li key={l} className="flex flex-1 flex-col items-center gap-1.5 text-center text-xs">
          <div className="relative flex w-full justify-center">{i > 0 && <span className="absolute right-1/2 top-1/2 h-0.5 w-full" style={{ background: ok ? 'var(--rose)' : 'var(--border)' }} />}<span className="relative z-10 flex h-6 w-6 items-center justify-center rounded-full" style={{ background: ok ? (i === 2 ? 'var(--blue)' : 'var(--rose)') : 'var(--surface)', border: '1px solid var(--border)' }}>{ok && <Check size={13} color="#fff" />}</span></div>
          <span className="font-semibold">{l}</span>
        </li>
      ))}</ol>
    </div>
  );
}

export default function Dashboard() {
  useTitle('My account');
  const { user } = useAuth(); const [d, setD] = useState(null);
  useEffect(() => {
    Promise.all([api.get('/account/summary'), api.get('/library'), api.get('/download-history'), api.get('/orders'), api.get('/wishlist/products')]).then(([s, l, dl, o, w]) => setD({ s: s.data, lib: l.data, dl: dl.data, orders: o.data, wish: w.data }));
  }, []);
  if (!d) return <Spinner />;
  const paid = d.orders.filter((o) => ['paid', 'partially_refunded', 'refunded'].includes(o.status));
  const stats = [[Layers, d.s.purchased, 'Purchased templates', 'stat-purchased'], [Download, d.s.downloads, 'Total downloads', 'stat-downloads'], [Package, d.s.completed_orders, 'Completed orders', 'stat-orders'], [Heart, d.s.wishlist, 'Saved items (wishlist)', 'stat-wishlist']];
  return (
    <div>
      <header className="relative overflow-hidden px-4 pb-6 pt-10 sm:px-8">
        <img src={PHOTOS.treasury} alt="" aria-hidden className="absolute right-0 top-0 h-full w-full object-cover object-[50%_25%] opacity-55 md:w-[60%]" />
        <div className="absolute inset-0" style={{ background: 'linear-gradient(90deg, var(--bg) 35%, rgba(27,15,12,0.25) 100%)' }} />
        <div className="relative">
          <p className="yk-eyebrow">Welcome back,</p>
          <h1 className="mt-1 text-[40px] font-extrabold leading-tight sm:text-[48px]" data-testid="account-welcome">{user.name}</h1>
          <p className="mt-2 max-w-md text-[15px]">Manage your templates, downloads, orders, and account settings all in one place.</p>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{stats.map(([I, n, l, t]) => <div key={l} className="yk-card flex items-center gap-4 p-5" style={{ background: 'var(--overlay)' }} data-testid={t}><span className="flex h-12 w-12 items-center justify-center rounded-full" style={{ background: 'var(--accent)', color: '#fff' }}><I size={22} /></span><div><div className="font-display text-[28px] font-extrabold leading-none">{n}</div><div className="mt-1 text-sm">{l}</div></div></div>)}</div>
        </div>
      </header>
      <div className="grid gap-5 px-4 pb-10 sm:px-8 2xl:grid-cols-[1fr_330px]">
        <div className="min-w-0 space-y-5">
          <Box title="My library" link="/account/library" linkLabel="View all in library" testid="dash-library">
            <p className="-mt-3 mb-4 text-sm yk-muted">Your purchased templates and components.</p>
            {!d.lib.length ? <Empty>Nothing here yet. <Link to="/templates" className="underline">Browse the marketplace</Link> to find your first template.</Empty> : <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{d.lib.slice(0, 4).map((p) => <LibraryCard key={p.id} p={p} compact />)}</div>}
          </Box>
          <div className="grid gap-5 xl:grid-cols-2">
            <Box title="Recent downloads" link="/account/downloads" linkLabel="View all downloads" testid="dash-downloads">
              {!d.dl.length ? <Empty>No downloads yet.</Empty> : <ul className="divide-y" style={{ borderColor: 'var(--border-soft)' }}>{d.dl.slice(0, 3).map((x) => <li key={x.id} className="flex items-center gap-3 py-2.5"><img src={imgUrl(x.preview ? `/api/images/${x.preview}` : '')} alt="" className="h-11 w-[72px] rounded-[4px] object-cover" /><div className="min-w-0 flex-1"><div className="truncate text-sm font-semibold">{x.title} <span className="font-normal yk-muted">— {x.category}</span></div><div className="text-xs yk-faint">{new Date(x.downloaded_at).toLocaleString('en-IN')}</div></div><span className="yk-badge" style={{ background: 'var(--elev)' }}>v{x.version}</span></li>)}</ul>}
            </Box>
            <Box title="Order history" link="/account/orders" linkLabel="View all orders" testid="dash-orders">
              {!d.orders.length ? <Empty>No orders yet.</Empty> : <ul className="divide-y" style={{ borderColor: 'var(--border-soft)' }}>{d.orders.slice(0, 3).map((o) => <li key={o.id}><Link to={`/account/orders/${o.id}`} className="flex items-center gap-3 py-3 text-sm hover:opacity-80"><Package size={18} style={{ color: 'var(--rose)' }} /><span className="font-semibold">{orderNo(o.id)}</span><span className="hidden yk-muted sm:inline">{fmtDate(o.created_at)}</span><span className="yk-muted">{o.items.length} item(s)</span><span className="ml-auto"><StatusBadge status={o.status} /></span><ChevronRight size={16} /></Link></li>)}</ul>}
            </Box>
          </div>
          <div className="grid gap-5 xl:grid-cols-[1fr_1.3fr]">
            <Box title="Invoices" link="/account/invoices" linkLabel="View all invoices" testid="dash-invoices">
              {!paid.length ? <Empty>Invoices appear after your first purchase.</Empty> : <ul className="divide-y" style={{ borderColor: 'var(--border-soft)' }}>{paid.slice(0, 3).map((o) => <li key={o.id} className="flex items-center gap-3 py-2.5 text-sm"><FileText size={18} style={{ color: 'var(--rose)' }} /><span className="font-medium">{o.invoice_number}</span><span className="yk-muted">{fmtDate(o.paid_at || o.created_at)}</span><span className="ml-auto font-semibold">{inr(o.total, { free: false })}</span><button type="button" className="yk-icon-btn !h-8 !w-8" onClick={() => openAuthed(`/orders/${o.id}/invoice`, `${o.invoice_number}.html`)} aria-label="Download invoice" data-testid={`dash-invoice-${o.id}`}><Download size={14} /></button></li>)}</ul>}
            </Box>
            <Box title="Wishlist" link="/account/wishlist" linkLabel="View all saved" testid="dash-wishlist">
              {!d.wish.length ? <Empty>No saved items.</Empty> : <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">{d.wish.slice(0, 3).map((p) => <Link key={p.id} to={`/products/${p.slug}`} className="yk-card-2 overflow-hidden"><img src={imgUrl(p.preview_url)} alt="" className="aspect-[16/10] w-full object-cover" /><div className="p-2"><div className="truncate text-sm font-semibold">{p.title}</div><div className="truncate text-xs yk-muted">{p.category}</div></div></Link>)}</div>}
            </Box>
          </div>
        </div>
        <div className="space-y-5">
          <Box title="Account summary" testid="dash-account-summary">
            <div className="yk-card-2 flex items-center gap-4 p-4"><span className="flex h-14 w-14 items-center justify-center rounded-full font-display text-2xl font-bold text-white" style={{ background: 'var(--accent)' }}>{user.name[0]}</span><div className="min-w-0"><div className="truncate font-display text-lg font-bold">{user.name}</div><div className="truncate text-xs yk-muted">{user.email}</div>{user.email_verified ? <span className="yk-badge mt-1" style={{ background: 'var(--blue)', color: '#fff' }}><BadgeCheck size={12} />Verified</span> : <Link to="/account/security" className="yk-badge mt-1" style={{ background: '#3D311A', color: '#F2C46B' }}>Verify email</Link>}</div></div>
            <dl className="mt-4 space-y-3 text-sm">{[[LayoutGrid, 'Account type', 'Customer'], [ShieldCheck, 'Active licenses', d.s.purchased], [Download, 'Total downloads', d.s.downloads], [Calendar, 'Member since', fmtDate(user.created_at)]].map(([I, k, v]) => <div key={k} className="flex items-center gap-3"><I size={16} className="yk-muted" /><dt>{k}</dt><dd className="ml-auto font-medium">{v}</dd></div>)}</dl>
            <Link to="/account/profile" className="yk-btn-outline mt-5 w-full" data-testid="dash-edit-profile">Edit profile</Link>
          </Box>
          <Box title="Order tracking" testid="dash-tracking"><Tracking o={d.orders[0]} /></Box>
          <Box title="Need help?" testid="dash-help"><p className="mb-4 text-sm yk-muted">Get support for your purchases, downloads, licenses, or account.</p><Link to="/account/support" className="yk-btn w-full" data-testid="dash-contact-support"><Headphones size={16} />Contact support</Link></Box>
        </div>
      </div>
    </div>
  );
}
