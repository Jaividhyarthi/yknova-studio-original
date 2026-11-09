import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Download, Search } from 'lucide-react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogTitle } from '../components/ui/dialog';
import { api, errMsg, fmtDate, inr, orderNo, openAuthed } from '../lib/api';
import { useTitle } from '../lib/hooks';
import { EmptyState, Spinner, StatusBadge } from '../components/common';
import { PageHead } from './AdminApp';
import { Confirm } from './Products';

function OrderDetail({ id, onClose, onChange }) {
  const [o, setO] = useState(null); const [amt, setAmt] = useState(''); const [confirm, setConfirm] = useState(false);
  useEffect(() => { if (id) api.get(`/admin/orders/${id}`).then((r) => setO(r.data)); else setO(null); }, [id]);
  const refund = async () => { try { const { data } = await api.post(`/admin/orders/${id}/refund`, { amount: amt ? Math.round(+amt * 100) : null, reason: 'Admin refund' }); setO({ ...o, ...data }); toast.success('Refund requested with Razorpay'); onChange(); } catch (e) { toast.error(errMsg(e)); } setConfirm(false); };
  return (
    <Dialog open={!!id} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto border-[var(--border)] bg-[var(--surface)] text-[var(--text)]" data-testid="admin-order-detail">
        <DialogTitle className="text-xl font-bold">Order {orderNo(id)}</DialogTitle>
        {!o ? <Spinner /> : (
          <div className="space-y-5 text-sm">
            <div className="grid gap-3 sm:grid-cols-2">
              <div><div className="yk-faint">Customer</div>{o.customer_name} · {o.customer_email}</div><div><div className="yk-faint">Status</div><StatusBadge status={o.status} /></div>
              <div><div className="yk-faint">Created</div>{new Date(o.created_at).toLocaleString('en-IN')}</div><div><div className="yk-faint">Paid</div>{o.paid_at ? new Date(o.paid_at).toLocaleString('en-IN') : '—'}</div>
              <div><div className="yk-faint">Razorpay order</div><code className="text-xs">{o.razorpay_order_id || '—'}</code></div><div><div className="yk-faint">Payment reference</div><code className="text-xs">{o.razorpay_payment_id || '—'}</code></div>
            </div>
            <table className="yk-table w-full"><tbody>{o.items.map((i) => <tr key={i.id}><td>{i.title}<div className="text-xs yk-faint">{i.license_snapshot} · v{i.version_snapshot}</div></td><td className="text-right">{inr(i.unit_price)}</td></tr>)}
              <tr><td>Subtotal</td><td className="text-right">{inr(o.subtotal ?? o.total, { free: false })}</td></tr>{o.discount > 0 && <tr><td>Discount {o.discount_code}</td><td className="text-right">−{inr(o.discount)}</td></tr>}<tr><td className="font-bold">Total</td><td className="text-right font-bold">{inr(o.total, { free: false })}</td></tr></tbody></table>
            {o.refunds.length > 0 && <div><div className="mb-1 font-semibold">Refunds</div>{o.refunds.map((r) => <div key={r.id} className="yk-muted">{inr(r.amount)} · {r.status} · {fmtDate(r.created_at)}</div>)}</div>}
            {o.failure_reason && <p className="yk-muted">Failure reason: {o.failure_reason}</p>}
            <div className="flex flex-wrap items-center gap-3">
              {['paid', 'partially_refunded', 'refunded'].includes(o.status) && <button type="button" className="yk-btn-outline" onClick={() => openAuthed(`/admin/orders/${id}/invoice`)} data-testid="admin-order-invoice">View invoice</button>}
              {['paid', 'partially_refunded'].includes(o.status) && <><input type="number" className="yk-input !w-36" placeholder="Amount ₹ (full)" value={amt} onChange={(e) => setAmt(e.target.value)} data-testid="refund-amount" /><button type="button" className="yk-btn" onClick={() => setConfirm(true)} data-testid="refund-button">Refund</button></>}
            </div>
          </div>
        )}
        <Confirm open={confirm} onOpenChange={setConfirm} title="Issue refund?" text="The refund is sent to Razorpay. A full refund revokes the customer's download access for this order." onConfirm={refund} label="Refund" />
      </DialogContent>
    </Dialog>
  );
}

export default function Orders() {
  useTitle('Orders');
  const [sp] = useSearchParams(); const [list, setList] = useState(null); const [f, setF] = useState({ q: sp.get('q') || '', status: '', start: '', end: '' }); const [open, setOpen] = useState(null);
  const load = () => api.get('/admin/orders', { params: f }).then((r) => setList(r.data));
  useEffect(() => { const t = setTimeout(load, 250); return () => clearTimeout(t); }, [f]); // eslint-disable-line
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  return (
    <>
      <PageHead title="Orders" sub="Every checkout, with its real payment status from Razorpay." actions={<button type="button" className="yk-btn-outline" onClick={() => openAuthed('/admin/orders/export.csv', 'yknova-orders.csv')} data-testid="orders-export"><Download size={15} />Export CSV</button>} />
      <div className="mb-4 grid gap-3 md:grid-cols-[1.5fr_1fr_1fr_1fr]">
        <label className="flex items-center gap-2 rounded-[6px] px-3" style={{ border: '1px solid var(--border)' }}><Search size={15} /><input value={f.q} onChange={set('q')} placeholder="Order ID, customer email or payment ID" className="w-full bg-transparent py-2 text-sm outline-none" data-testid="orders-search" /></label>
        <select value={f.status} onChange={set('status')} className="yk-input" data-testid="orders-status-filter"><option value="">All payment status</option>{['paid', 'pending', 'authorized', 'failed', 'canceled', 'refunded', 'partially_refunded'].map((s) => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}</select>
        <input type="date" value={f.start} onChange={set('start')} className="yk-input" aria-label="From date" data-testid="orders-start" />
        <input type="date" value={f.end} onChange={set('end')} className="yk-input" aria-label="To date" data-testid="orders-end" />
      </div>
      {!list ? <Spinner /> : !list.length ? <EmptyState title="No orders found" text="Orders appear here when customers start a checkout." testid="orders-empty" /> : (
        <div className="yk-card overflow-x-auto"><table className="yk-table w-full min-w-[820px]" data-testid="orders-table">
          <thead><tr><th>Order #</th><th>Customer</th><th>Products</th><th>Amount</th><th>Date</th><th>Status</th></tr></thead>
          <tbody>{list.map((o) => <tr key={o.id} onClick={() => setOpen(o.id)} className="cursor-pointer hover:bg-[var(--accent-soft)]" data-testid={`order-row-${o.id}`}><td className="font-semibold">{orderNo(o.id)}</td><td>{o.customer_name}<div className="text-xs yk-faint">{o.customer_email}</div></td><td className="max-w-[220px] truncate">{o.items.map((i) => i.title).join(', ')}</td><td>{inr(o.total, { free: false })}</td><td>{fmtDate(o.created_at)}</td><td><StatusBadge status={o.status} /></td></tr>)}</tbody>
        </table></div>
      )}
      <OrderDetail id={open} onClose={() => setOpen(null)} onChange={load} />
    </>
  );
}
