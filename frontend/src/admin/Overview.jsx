import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Layers, ShoppingCart, Box, Users, MoreHorizontal } from 'lucide-react';
import { api, fmtDate, imgUrl, inr, orderNo } from '../lib/api';
import { useTitle } from '../lib/hooks';
import { EmptyState, Spinner, StatusBadge } from '../components/common';
import { KpiCard, SalesChart, useAnalytics } from './charts';
import { PageHead } from './AdminApp';
import ProductEditor from './ProductEditor';

export default function Overview() {
  useTitle('Admin overview');
  const [o, setO] = useState(null); const [products, setProducts] = useState([]); const { data: a, picker } = useAnalytics();
  const [fCat, setFCat] = useState(''); const [fStatus, setFStatus] = useState(''); const [tick, setTick] = useState(0);
  useEffect(() => { api.get('/admin/overview').then((r) => setO(r.data)); api.get('/admin/products').then((r) => setProducts(r.data)); }, [tick]);
  if (!o) return <Spinner />;
  const shown = products.filter((p) => (!fCat || p.category === fCat) && (!fStatus || p.status === fStatus));
  return (
    <>
      <PageHead title="Overview" sub="Manage your templates, track sales, and grow your marketplace." />
      <div className="grid gap-6 2xl:grid-cols-[1fr_420px]">
        <div className="min-w-0 space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <KpiCard icon={Layers} label="Total revenue" value={inr(o.revenue, { free: false })} sub="Paid orders, net of refunds" testid="kpi-revenue" />
            <KpiCard icon={ShoppingCart} label="Orders" value={o.orders} sub="Completed orders" testid="kpi-orders" />
            <KpiCard icon={Box} label="Templates" value={o.templates} sub={`${o.drafts} draft${o.drafts === 1 ? '' : 's'}`} testid="kpi-templates" />
            <KpiCard icon={Users} label="Customers" value={o.customers} sub="Registered accounts" testid="kpi-customers" />
          </div>
          <div className="grid gap-6 xl:grid-cols-[1.15fr_1fr]">
            <section className="yk-card p-5">
              <div className="flex items-start justify-between gap-3"><div><h2 className="text-xl font-bold">Sales trend</h2><div className="mt-2 font-display text-[28px] font-extrabold">{a ? inr(a.revenue, { free: false }) : '—'}</div><div className="text-xs yk-muted">{a ? `${a.orders} orders in range` : ''}</div></div>{picker}</div>
              {a && <div className="mt-4"><SalesChart series={a.series} /></div>}
            </section>
            <section className="yk-card p-5">
              <div className="mb-3 flex items-center justify-between"><h2 className="text-xl font-bold">Product performance</h2><Link to="/admin/analytics" className="text-xs font-medium hover:underline" data-testid="perf-view-all">View all →</Link></div>
              {!a?.top_products.length ? <p className="py-10 text-center text-sm yk-muted" data-testid="perf-empty">No sales in this period yet.</p> : (
                <ul className="divide-y" style={{ borderColor: 'var(--border-soft)' }}>{a.top_products.slice(0, 4).map((t) => (
                  <li key={t.product_id} className="flex items-center gap-3 py-3"><img src={imgUrl(t.preview_url)} alt="" className="h-11 w-16 rounded-[4px] object-cover" /><div className="min-w-0 flex-1"><div className="truncate text-sm font-semibold">{t.title}</div><div className="text-xs yk-muted">{t.category}</div></div><div className="text-center text-sm"><div className="font-semibold">{t.units}</div><div className="text-[11px] yk-muted">Sales</div></div><div className="w-20 text-right text-sm"><div className="font-semibold">{inr(t.revenue)}</div><div className="text-[11px] yk-muted">Revenue</div></div></li>
                ))}</ul>
              )}
            </section>
          </div>
          <section className="yk-card overflow-hidden">
            <div className="flex items-center justify-between p-5 pb-2"><h2 className="text-xl font-bold">Recent orders</h2><Link to="/admin/orders" className="text-xs font-medium hover:underline" data-testid="recent-orders-view-all">View all orders →</Link></div>
            {!o.recent_orders.length ? <p className="p-8 text-center text-sm yk-muted" data-testid="recent-orders-empty">No orders yet. They will appear here as soon as customers check out.</p> : (
              <div className="overflow-x-auto"><table className="yk-table w-full min-w-[640px]"><thead><tr><th>Order #</th><th>Customer</th><th>Template</th><th>Amount</th><th>Date</th><th>Status</th></tr></thead>
                <tbody>{o.recent_orders.map((r) => <tr key={r.id} data-testid={`recent-order-${r.id}`}><td className="font-semibold">{orderNo(r.id)}</td><td>{r.customer}</td><td className="max-w-[180px] truncate">{r.items.map((i) => i.title).join(', ')}</td><td>{inr(r.total, { free: false })}</td><td>{fmtDate(r.created_at)}</td><td><StatusBadge status={r.status} /></td></tr>)}</tbody></table></div>
            )}
          </section>
          <section className="yk-card p-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3"><h2 className="text-xl font-bold">My templates <span className="text-base font-medium yk-muted">({products.length})</span></h2>
              <div className="flex gap-2"><select className="yk-input !w-auto !py-1.5 text-xs" value={fCat} onChange={(e) => setFCat(e.target.value)} data-testid="mytemplates-cat"><option value="">All categories</option>{[...new Set(products.map((p) => p.category))].map((c) => <option key={c}>{c}</option>)}</select>
                <select className="yk-input !w-auto !py-1.5 text-xs" value={fStatus} onChange={(e) => setFStatus(e.target.value)} data-testid="mytemplates-status"><option value="">All status</option>{['published', 'draft', 'scheduled', 'archived'].map((s) => <option key={s}>{s}</option>)}</select></div></div>
            {!shown.length ? <EmptyState title="No templates yet" text="Upload your first template using the form." testid="mytemplates-empty" /> : (
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{shown.slice(0, 8).map((p) => (
                <Link key={p.id} to={`/admin/products/${p.id}`} className="yk-card-2 group overflow-hidden" data-testid={`mytemplate-${p.id}`}>
                  {p.preview_url ? <img src={imgUrl(p.preview_url)} alt="" className="aspect-[16/10] w-full object-cover" /> : <div className="aspect-[16/10]" style={{ background: 'var(--elev)' }} />}
                  <div className="p-3"><div className="flex justify-between gap-2"><span className="truncate font-semibold">{p.title}</span><span className="text-sm font-semibold">{inr(p.price)}</span></div><div className="text-xs yk-muted">{p.category}</div>
                    <div className="mt-2 flex items-center justify-between"><StatusBadge status={p.status} /><MoreHorizontal size={16} className="yk-muted" /></div></div>
                </Link>
              ))}</div>
            )}
          </section>
        </div>
        <ProductEditor compact onSaved={() => setTick((t) => t + 1)} />
      </div>
    </>
  );
}
