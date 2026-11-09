import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { IndianRupee, ShoppingCart, TrendingUp, Users, RotateCcw, Percent } from 'lucide-react';
import { imgUrl, inr } from '../lib/api';
import { useTitle } from '../lib/hooks';
import { Spinner } from '../components/common';
import { KpiCard, SalesChart, useAnalytics } from './charts';
import { PageHead } from './AdminApp';

const Card = ({ title, children, testid }) => <section className="yk-card p-5" data-testid={testid}><h2 className="mb-4 text-lg font-bold">{title}</h2>{children}</section>;
const Empty = ({ t = 'Not enough data in this period yet.' }) => <p className="py-10 text-center text-sm yk-muted">{t}</p>;

export default function Analytics() {
  useTitle('Analytics');
  const { data: a, picker } = useAnalytics();
  return (
    <>
      <PageHead title="Analytics" sub="All figures are calculated from real orders in the database." actions={picker} />
      {!a ? <Spinner /> : (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
            <KpiCard icon={IndianRupee} label="Revenue" value={inr(a.revenue, { free: false })} testid="an-revenue" />
            <KpiCard icon={ShoppingCart} label="Orders" value={a.orders} testid="an-orders" />
            <KpiCard icon={TrendingUp} label="Avg. order" value={inr(a.aov, { free: false })} testid="an-aov" />
            <KpiCard icon={Users} label="New customers" value={a.new_customers} sub={`${a.returning_customers} returning buyer(s)`} testid="an-customers" />
            <KpiCard icon={Percent} label="Checkout conversion" value={a.checkout_conversion === null ? '—' : `${a.checkout_conversion}%`} sub={`${a.abandoned_checkouts} abandoned / failed of ${a.checkouts_started}`} testid="an-conversion" />
            <KpiCard icon={RotateCcw} label="Refunds" value={inr(a.refunds_amount, { free: false })} sub={`${a.refunds_count} refund(s)`} testid="an-refunds" />
          </div>
          <div className="grid gap-6 xl:grid-cols-2">
            <Card title="Revenue over time" testid="an-revenue-chart">{a.revenue ? <SalesChart series={a.series} height={260} /> : <Empty />}</Card>
            <Card title="Orders over time" testid="an-orders-chart">{a.orders ? <SalesChart series={a.series} height={260} metric="orders" /> : <Empty />}</Card>
          </div>
          <div className="grid gap-6 xl:grid-cols-[1.3fr_1fr]">
            <Card title="Top-selling products" testid="an-top-products">
              {!a.top_products.length ? <Empty /> : <table className="yk-table w-full"><thead><tr><th>Product</th><th>Units</th><th>Revenue</th></tr></thead><tbody>{a.top_products.map((t) => <tr key={t.product_id}><td className="flex items-center gap-3"><img src={imgUrl(t.preview_url)} alt="" className="h-9 w-14 rounded-[4px] object-cover" />{t.title}</td><td>{t.units}</td><td>{inr(t.revenue)}</td></tr>)}</tbody></table>}
            </Card>
            <Card title="Revenue by category" testid="an-by-category">
              {!a.by_category.length ? <Empty /> : (
                <div style={{ height: 260 }}><ResponsiveContainer><BarChart data={a.by_category} layout="vertical" margin={{ left: 20 }}><CartesianGrid stroke="var(--border-soft)" horizontal={false} /><XAxis type="number" tickFormatter={(v) => `₹${v / 100}`} tick={{ fill: 'var(--text-2)', fontSize: 11 }} /><YAxis type="category" dataKey="category" tick={{ fill: 'var(--text-2)', fontSize: 12 }} width={100} /><Tooltip formatter={(v) => inr(v)} contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)' }} /><Bar dataKey="revenue" fill="#BC4639" radius={[0, 4, 4, 0]} /></BarChart></ResponsiveContainer></div>
              )}
            </Card>
          </div>
          <p className="text-xs yk-faint">Conversion is measured as paid orders ÷ checkouts started. Visitor-level conversion and cart abandonment before checkout require page analytics, which are not tracked.</p>
        </div>
      )}
    </>
  );
}
