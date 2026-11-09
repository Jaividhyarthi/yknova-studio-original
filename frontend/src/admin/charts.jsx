import { useEffect, useState } from 'react';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { api, inr } from '../lib/api';

export const RANGES = [['7', 'Last 7 days'], ['30', 'Last 30 days'], ['90', 'Last 90 days'], ['custom', 'Custom range']];

export function useAnalytics() {
  const [range, setRange] = useState('30'); const [start, setStart] = useState(''); const [end, setEnd] = useState(''); const [data, setData] = useState(null);
  useEffect(() => {
    if (range === 'custom' && (!start || !end)) return;
    api.get('/admin/analytics', { params: range === 'custom' ? { start, end } : { days: +range } }).then((r) => setData(r.data)).catch(() => setData(null));
  }, [range, start, end]);
  const picker = (
    <div className="flex flex-wrap items-center gap-2">
      <select value={range} onChange={(e) => setRange(e.target.value)} className="yk-input !w-auto !py-1.5 text-xs" aria-label="Date range" data-testid="analytics-range">{RANGES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
      {range === 'custom' && <><input type="date" value={start} onChange={(e) => setStart(e.target.value)} className="yk-input !w-auto !py-1.5 text-xs" aria-label="Start date" data-testid="analytics-start" /><input type="date" value={end} onChange={(e) => setEnd(e.target.value)} className="yk-input !w-auto !py-1.5 text-xs" aria-label="End date" data-testid="analytics-end" /></>}
    </div>
  );
  return { data, picker };
}

export function KpiCard({ icon: I, label, value, sub, testid }) {
  return (
    <div className="yk-card relative overflow-hidden p-5" data-testid={testid}>
      <div className="flex items-center gap-3 text-sm font-medium"><span className="flex h-9 w-9 items-center justify-center rounded-[8px]" style={{ background: 'var(--accent)', color: '#fff' }}><I size={18} /></span>{label}</div>
      <div className="mt-4 font-display text-[32px] font-extrabold leading-none" data-testid={`${testid}-value`}>{value}</div>
      {sub && <div className="mt-2 text-xs yk-muted">{sub}</div>}
    </div>
  );
}

const Tip = ({ active, payload, label }) => active && payload?.length ? (
  <div className="rounded-[6px] px-3 py-2 text-xs" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
    <div className="font-semibold">{label}</div>{payload.map((p) => <div key={p.dataKey}>{p.dataKey === 'revenue' ? `Revenue ${inr(p.value, { free: false })}` : `Orders ${p.value}`}</div>)}
  </div>
) : null;

export function SalesChart({ series, height = 240, metric = 'revenue' }) {
  const fmt = (d) => new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  return (
    <div style={{ height }} data-testid="sales-chart">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={series} margin={{ left: 0, right: 8, top: 10 }}>
          <defs><linearGradient id="ykFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#BC4639" stopOpacity={0.45} /><stop offset="100%" stopColor="#BC4639" stopOpacity={0.02} /></linearGradient></defs>
          <CartesianGrid stroke="var(--border-soft)" vertical={false} />
          <XAxis dataKey="date" tickFormatter={fmt} tick={{ fill: 'var(--text-2)', fontSize: 11 }} axisLine={false} tickLine={false} minTickGap={24} />
          <YAxis tickFormatter={(v) => (metric === 'revenue' ? `₹${(v / 100).toLocaleString('en-IN')}` : v)} tick={{ fill: 'var(--text-2)', fontSize: 11 }} axisLine={false} tickLine={false} width={metric === 'revenue' ? 70 : 30} allowDecimals={false} />
          <Tooltip content={<Tip />} labelFormatter={fmt} />
          <Area type="monotone" dataKey={metric} stroke="#E0806B" strokeWidth={2} fill="url(#ykFill)" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
