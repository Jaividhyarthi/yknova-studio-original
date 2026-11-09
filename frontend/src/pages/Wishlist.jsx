import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Heart, ShoppingCart, Trash2 } from 'lucide-react';
import { api, imgUrl, inr } from '../lib/api';
import { useAuth, useStore } from '../lib/store';
import { useTitle } from '../lib/hooks';
import { EmptyState, Spinner } from '../components/common';

export function WishlistGrid({ compact = false }) {
  const { user } = useAuth(); const { wish, toggleWish, addToCart } = useStore(); const [items, setItems] = useState(null);
  useEffect(() => {
    (user ? api.get('/wishlist/products').then((r) => r.data) : api.get('/products').then((r) => r.data.filter((p) => wish.includes(p.id)))).then(setItems).catch(() => setItems([]));
  }, [user, wish]);
  if (items === null) return <Spinner />;
  if (!items.length) return <EmptyState icon={Heart} title="Your wishlist is empty" text="Save products you like and come back to them later." action={<Link to="/templates" className="yk-btn">Browse templates</Link>} testid="wishlist-empty" />;
  return (
    <div className={`grid gap-4 ${compact ? 'sm:grid-cols-2 xl:grid-cols-3' : 'sm:grid-cols-2 lg:grid-cols-4'}`} data-testid="wishlist-grid">
      {items.map((p) => (
        <div key={p.id} className="yk-card overflow-hidden" data-testid={`wishlist-item-${p.slug}`}>
          <Link to={`/products/${p.slug}`}><img src={imgUrl(p.preview_url)} alt={p.title} className="aspect-[16/10] w-full object-cover" loading="lazy" /></Link>
          <div className="p-4">
            <div className="flex justify-between gap-2"><Link to={`/products/${p.slug}`} className="font-display font-bold hover:underline">{p.title}</Link><span className="text-sm font-semibold">{inr(p.price)}</span></div>
            <div className="text-xs yk-muted">{p.short_description || p.category}</div>
            <div className="mt-3 flex gap-2">
              {p.price > 0 && <button type="button" className="yk-btn flex-1 !px-3 !py-2 text-xs" onClick={async () => { if (await addToCart(p.id, p.licenses[0].id)) toggleWish(p.id); }} data-testid={`wishlist-move-cart-${p.slug}`}><ShoppingCart size={14} />Move to cart</button>}
              <button type="button" className="yk-icon-btn !h-9 !w-9" onClick={() => toggleWish(p.id)} aria-label="Remove from wishlist" data-testid={`wishlist-remove-${p.slug}`}><Trash2 size={15} /></button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function Wishlist() {
  useTitle('Wishlist');
  return (
    <div className="yk-container py-10">
      <h1 className="mb-2 text-[36px] font-extrabold">Wishlist</h1>
      <p className="mb-8 yk-muted">Products you saved. Sign in to keep your wishlist across devices.</p>
      <WishlistGrid />
    </div>
  );
}
