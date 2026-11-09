import { Link } from 'react-router-dom';
import { Heart, ShoppingCart, Eye, ArrowRight, Check } from 'lucide-react';
import { imgUrl, inr } from '../lib/api';
import { useStore } from '../lib/store';

function Thumb({ p, className = '' }) {
  return (
    <div className={`yk-img-zoom relative overflow-hidden ${className}`} style={{ background: 'var(--surface-2)' }}>
      {p.preview_url ? <img src={imgUrl(p.preview_url)} alt={`${p.title} preview`} loading="lazy" className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center text-xs yk-faint">No preview</div>}
      {p.is_demo && <span className="yk-badge absolute left-2 top-2" style={{ background: 'var(--overlay)', color: 'var(--cream)', border: '1px solid var(--border)' }}>Demo listing</span>}
    </div>
  );
}

export function ProductCard({ p }) {
  const { toggleWish, wish, addToCart, inCart } = useStore();
  const saved = wish.includes(p.id);
  return (
    <article className="yk-card group flex flex-col overflow-hidden yk-fade-in" data-testid={`product-card-${p.slug}`}>
      <Link to={`/products/${p.slug}`} className="block" data-testid={`product-card-link-${p.slug}`}><Thumb p={p} className="aspect-[16/10]" /></Link>
      <div className="flex flex-1 flex-col gap-3 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <Link to={`/products/${p.slug}`} className="block truncate font-display text-[17px] font-bold hover:underline">{p.title}</Link>
            <p className="text-[13px] yk-muted">{p.short_description || p.category}</p>
          </div>
          <div className="text-right">
            <div className="font-display text-[15px] font-bold" data-testid={`product-price-${p.slug}`}>{inr(p.price)}</div>
            {p.compare_price > p.price && <div className="text-xs line-through yk-faint">{inr(p.compare_price)}</div>}
          </div>
        </div>
        {p.tech_stack?.length > 0 && (
          <div className="flex flex-wrap gap-1.5">{p.tech_stack.slice(0, 3).map((t) => <span key={t} className="yk-badge" style={{ background: 'var(--surface-2)', color: 'var(--text-2)', border: '1px solid var(--border-soft)' }}>{t}</span>)}</div>
        )}
        <div className="mt-auto flex items-center gap-2 pt-1">
          <Link to={`/products/${p.slug}`} className="yk-btn-outline flex-1 !px-3 !py-2 text-[13px]" data-testid={`product-view-${p.slug}`}>View details</Link>
          {p.live_demo_url && <a href={p.live_demo_url} target="_blank" rel="noopener noreferrer" className="yk-icon-btn !h-9 !w-9" aria-label="Live preview" data-testid={`product-demo-${p.slug}`}><Eye size={16} /></a>}
          {p.price > 0 && <button type="button" onClick={() => addToCart(p.id, p.licenses?.[0]?.id)} className="yk-icon-btn !h-9 !w-9" aria-label="Add to cart" data-testid={`product-add-cart-${p.slug}`}>{inCart(p.id) ? <Check size={16} /> : <ShoppingCart size={16} />}</button>}
          <button type="button" onClick={() => toggleWish(p.id)} className="yk-icon-btn !h-9 !w-9" aria-label={saved ? 'Remove from wishlist' : 'Save to wishlist'} aria-pressed={saved} data-testid={`product-wish-${p.slug}`}><Heart size={16} fill={saved ? 'var(--accent)' : 'none'} color={saved ? 'var(--accent)' : 'currentColor'} /></button>
        </div>
      </div>
    </article>
  );
}

export function MiniCard({ p }) {
  return (
    <Link to={`/products/${p.slug}`} className="yk-card group block overflow-hidden" data-testid={`mini-card-${p.slug}`}>
      <Thumb p={p} className="aspect-[16/9]" />
      <div className="flex items-end justify-between gap-2 p-3">
        <div className="min-w-0"><div className="truncate font-display font-bold">{p.title}</div><div className="truncate text-xs yk-muted">{p.short_description || p.category}</div></div>
        <div className="font-display text-sm font-bold">{inr(p.price)}</div>
      </div>
    </Link>
  );
}

export function FeaturedCard({ p }) {
  const { toggleWish, wish } = useStore();
  return (
    <article className="yk-card relative grid min-h-[168px] grid-cols-[1fr_1.15fr] overflow-hidden" style={{ background: 'var(--surface-2)' }} data-testid={`featured-card-${p.slug}`}>
      <div className="flex flex-col p-5">
        <span className="yk-badge mb-3 self-start uppercase tracking-[0.06em]" style={{ background: 'var(--accent)', color: '#fff' }}>{p.category}</span>
        <h3 className="text-[22px] font-bold leading-tight">{p.title}</h3>
        <p className="mt-1 text-[13px] yk-muted">{p.short_description}</p>
        <div className="mt-auto flex items-center gap-3 pt-4">
          <Link to={`/products/${p.slug}`} className="yk-icon-btn !h-8 !w-8" aria-label={`View ${p.title}`} data-testid={`featured-view-${p.slug}`}><ArrowRight size={15} /></Link>
          <span className="font-display text-sm font-bold">{inr(p.price)}</span>
          <button type="button" onClick={() => toggleWish(p.id)} className="ml-auto" aria-label="Toggle wishlist" data-testid={`featured-wish-${p.slug}`}><Heart size={16} fill={wish.includes(p.id) ? 'var(--accent)' : 'none'} color={wish.includes(p.id) ? 'var(--accent)' : 'var(--text-2)'} /></button>
        </div>
      </div>
      <Link to={`/products/${p.slug}`} className="relative block" tabIndex={-1}>
        <div className="absolute bottom-0 left-2 right-[-12%] top-6 overflow-hidden rounded-tl-[8px]" style={{ border: '1px solid var(--border)', transform: 'perspective(900px) rotateY(-10deg)', transformOrigin: 'left' }}>
          <Thumb p={p} className="h-full w-full" />
        </div>
      </Link>
    </article>
  );
}
