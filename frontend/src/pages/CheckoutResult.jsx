import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CheckCircle2, XCircle, Clock } from 'lucide-react';
import { api, inr, orderNo } from '../lib/api';
import { useTitle } from '../lib/hooks';

export default function CheckoutResult({ ok }) {
  const [sp] = useSearchParams(); const id = sp.get('order'); const [o, setO] = useState(null);
  useTitle(ok ? 'Order complete' : 'Payment not completed');
  useEffect(() => { if (ok && id) api.get(`/orders/${id}`).then((r) => setO(r.data)).catch(() => {}); }, [ok, id]);
  const pending = ok && o && o.status !== 'paid';
  const Icon = !ok ? XCircle : pending ? Clock : CheckCircle2;
  return (
    <div className="yk-container max-w-2xl py-16">
      <div className="yk-card p-8 text-center" data-testid={ok ? 'checkout-success' : 'checkout-failed'}>
        <Icon size={48} className="mx-auto" style={{ color: ok && !pending ? 'var(--blue)' : 'var(--accent)' }} />
        <h1 className="mt-4 text-3xl font-extrabold">{!ok ? 'Payment not completed' : pending ? 'Payment received — confirming' : 'Thank you! Your order is complete'}</h1>
        <p className="mt-3 yk-muted">{!ok ? (sp.get('reason') || 'The payment was cancelled or failed.') + ' Your cart has been kept and no files were unlocked. You can safely try again.' : pending ? 'Your bank has authorised the payment. Files unlock as soon as the payment is captured.' : 'Your files are now available in your library.'}</p>
        {o && (
          <div className="yk-card-2 mt-6 p-4 text-left text-sm" data-testid="success-order-summary">
            <div className="mb-2 flex justify-between font-semibold"><span>Order {orderNo(o.id)}</span><span>{inr(o.total, { free: false })}</span></div>
            {o.items.map((i) => <div key={i.id} className="flex justify-between yk-muted"><span>{i.title} · {i.license_snapshot}</span><span>{inr(i.unit_price)}</span></div>)}
          </div>
        )}
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          {ok ? <><Link to="/account/library" className="yk-btn" data-testid="go-library">Open my library</Link><Link to={id ? `/account/orders/${id}` : '/account/orders'} className="yk-btn-outline" data-testid="view-order">View order</Link></>
            : <><Link to="/checkout" className="yk-btn" data-testid="retry-checkout">Try again</Link><Link to="/cart" className="yk-btn-outline" data-testid="back-to-cart">Back to cart</Link></>}
        </div>
      </div>
    </div>
  );
}
