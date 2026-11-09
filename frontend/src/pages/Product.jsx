import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Heart, ShoppingCart, ExternalLink, Expand, Check, Download, ChevronRight, Zap } from 'lucide-react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogTitle } from '../components/ui/dialog';
import { api, errMsg, fmtDate, imgUrl, inr } from '../lib/api';
import { Markdown, useTitle } from '../lib/hooks';
import { useAuth, useStore } from '../lib/store';
import { MiniCard } from '../components/ProductCard';
import { Spinner } from '../components/common';
import Info from './Info';

const TABS = [['description', 'Description'], ['specs', 'Specifications'], ['install', 'Installation'], ['license', 'License'], ['changelog', 'Update history'], ['reviews', 'Reviews']];

function Specs({ p }) {
  const s = p.specs || {};
  const rows = [['Technology stack', p.tech_stack.join(', ')], ['Framework', s.framework], ['Responsive', s.responsive === false ? 'No' : 'Yes'], ['Included files', s.included_files], ['Browser compatibility', s.browser_compat], ['Documentation', s.documentation], ['Dependencies', s.dependencies], ['Compatibility notes', s.compatibility], ['Version', p.version], ['Last updated', fmtDate(p.updated_at)]];
  return <dl className="grid gap-x-8 sm:grid-cols-2">{rows.filter((r) => r[1]).map(([k, v]) => <div key={k} className="flex justify-between gap-4 border-b py-3 text-sm" style={{ borderColor: 'var(--border-soft)' }}><dt className="yk-muted">{k}</dt><dd className="text-right font-medium">{v}</dd></div>)}</dl>;
}

export default function Product() {
  const { slug } = useParams(); const nav = useNavigate(); const { user } = useAuth(); const { addToCart, toggleWish, wish, inCart } = useStore();
  const [p, setP] = useState(undefined); const [img, setImg] = useState(0); const [lic, setLic] = useState(null); const [tab, setTab] = useState('description'); const [full, setFull] = useState(false); const [owned, setOwned] = useState(false);
  useEffect(() => { setP(undefined); setImg(0); api.get(`/products/${slug}`).then((r) => { setP(r.data); setLic(r.data.licenses[0]); }).catch(() => setP(null)); }, [slug]);
  useEffect(() => { if (user && p) api.get('/library').then((r) => setOwned(r.data.some((x) => x.id === p.id))).catch(() => {}); }, [user, p]);
  useTitle(p?.title, p?.short_description);
  if (p === undefined) return <Spinner />;
  if (p === null) return <Info page="not-found" />;
  const images = [p.preview_url, ...p.gallery_urls.filter((g) => g !== p.preview_url)].filter(Boolean);
  const free = p.licenses.every((l) => l.price === 0);
  const claim = async () => {
    if (!user) { nav(`/login?next=/products/${slug}`); return; }
    try { await api.post(`/library/claim/${p.id}`); toast.success('Added to your library'); nav('/account/library'); } catch (e) { toast.error(errMsg(e)); }
  };
  const buyNow = async () => { if (await addToCart(p.id, lic.id, true)) nav('/checkout'); };
  const jsonLd = { '@context': 'https://schema.org', '@type': 'Product', name: p.title, description: p.short_description, image: images.map(imgUrl), offers: { '@type': 'Offer', priceCurrency: 'INR', price: (p.price / 100).toFixed(2), availability: 'https://schema.org/InStock' } };

  return (
    <div className="yk-container py-8">
      <script type="application/ld+json">{JSON.stringify(jsonLd)}</script>
      <nav className="mb-6 flex items-center gap-1.5 text-[13px] yk-muted" aria-label="Breadcrumb"><Link to="/" className="hover:underline">Store</Link><ChevronRight size={13} /><Link to={`/categories/${p.category.toLowerCase().replace(/\s+/g, '-')}`} className="hover:underline">{p.category}</Link><ChevronRight size={13} /><span style={{ color: 'var(--text)' }}>{p.title}</span></nav>
      <div className="grid gap-10 lg:grid-cols-[1.35fr_1fr]">
        <div>
          <div className="yk-card relative overflow-hidden">
            <img src={imgUrl(images[img])} alt={`${p.title} preview ${img + 1}`} className="aspect-[16/10] w-full object-cover" data-testid="product-main-image" />
            <button type="button" onClick={() => setFull(true)} className="yk-icon-btn absolute right-3 top-3" style={{ background: 'var(--overlay)' }} aria-label="View fullscreen" data-testid="product-fullscreen"><Expand size={16} /></button>
          </div>
          {images.length > 1 && <div className="mt-3 flex gap-3 overflow-x-auto">{images.map((u, i) => <button key={u} type="button" onClick={() => setImg(i)} className="shrink-0 overflow-hidden rounded-[6px]" style={{ border: `2px solid ${i === img ? 'var(--accent)' : 'var(--border-soft)'}` }} aria-label={`Show image ${i + 1}`} data-testid={`product-thumb-${i}`}><img src={imgUrl(u)} alt="" className="h-16 w-24 object-cover" /></button>)}</div>}
        </div>
        <div>
          <p className="yk-eyebrow mb-2">{p.category}{p.is_demo && ' · Demo listing'}</p>
          <h1 className="text-[34px] font-extrabold leading-tight sm:text-[40px]" data-testid="product-title">{p.title}</h1>
          <p className="mt-3 yk-muted">{p.short_description}</p>
          <div className="mt-5 flex items-baseline gap-3"><span className="font-display text-3xl font-extrabold" data-testid="product-price">{inr(lic?.price ?? p.price)}</span>{p.compare_price > p.price && <span className="line-through yk-faint">{inr(p.compare_price)}</span>}</div>
          {!free && (
            <fieldset className="mt-6 space-y-2" data-testid="license-options"><legend className="yk-label">License</legend>
              {p.licenses.map((l) => <label key={l.id} className="flex cursor-pointer items-center justify-between rounded-[8px] px-4 py-3 text-sm" style={{ border: `1px solid ${lic?.id === l.id ? 'var(--accent)' : 'var(--border)'}`, background: lic?.id === l.id ? 'var(--accent-soft)' : 'transparent' }}><span className="flex items-center gap-3"><input type="radio" name="license" checked={lic?.id === l.id} onChange={() => setLic(l)} className="accent-[var(--accent)]" data-testid={`license-${l.id}`} />{l.name}</span><span className="font-semibold">{inr(l.price)}</span></label>)}
            </fieldset>
          )}
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            {owned ? <Link to="/account/library" className="yk-btn sm:col-span-2" data-testid="product-in-library"><Download size={16} />In your library — download</Link>
              : free ? <button type="button" onClick={claim} className="yk-btn sm:col-span-2" data-testid="product-claim-free"><Download size={16} />Get it free</button>
                : <>
                  <button type="button" onClick={() => addToCart(p.id, lic.id)} className="yk-btn-outline" data-testid="product-add-to-cart">{inCart(p.id) ? <Check size={16} /> : <ShoppingCart size={16} />}{inCart(p.id) ? 'In cart — update license' : 'Add to cart'}</button>
                  <button type="button" onClick={buyNow} className="yk-btn" data-testid="product-buy-now"><Zap size={16} />Buy now</button>
                </>}
            <button type="button" onClick={() => toggleWish(p.id)} className="yk-btn-ghost justify-center" data-testid="product-wishlist"><Heart size={16} fill={wish.includes(p.id) ? 'var(--accent)' : 'none'} />{wish.includes(p.id) ? 'Saved to wishlist' : 'Save to wishlist'}</button>
            {p.live_demo_url ? <a href={p.live_demo_url} target="_blank" rel="noopener noreferrer" className="yk-btn-ghost justify-center" data-testid="product-live-demo"><ExternalLink size={16} />Live demo</a> : <span className="yk-btn-ghost justify-center opacity-60">No live demo</span>}
          </div>
          <ul className="mt-6 space-y-2 text-sm">{['Instant download from your library after payment', 'Editable source files', `Version ${p.version}`].map((t) => <li key={t} className="flex items-center gap-2"><Check size={15} style={{ color: 'var(--accent)' }} />{t}</li>)}</ul>
          {p.demo_video_url && <a href={p.demo_video_url} target="_blank" rel="noopener noreferrer" className="mt-4 inline-block text-sm underline yk-muted" data-testid="product-video">Watch the demo video</a>}
        </div>
      </div>
      <div className="mt-12">
        <div className="scrollbar-none flex gap-1 overflow-x-auto border-b" style={{ borderColor: 'var(--border-soft)' }} role="tablist">{TABS.map(([k, l]) => <button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => setTab(k)} className="whitespace-nowrap px-4 py-3 text-sm font-semibold" style={{ borderBottom: `2px solid ${tab === k ? 'var(--accent)' : 'transparent'}`, color: tab === k ? 'var(--text)' : 'var(--text-2)' }} data-testid={`product-tab-${k}`}>{l}</button>)}</div>
        <div className="max-w-4xl py-8 text-[15px] leading-relaxed" data-testid="product-tab-content">
          {tab === 'description' && <Markdown text={p.description} />}
          {tab === 'specs' && <Specs p={p} />}
          {tab === 'install' && <Markdown text={p.specs?.installation || 'Installation instructions are included in the package README.'} />}
          {tab === 'license' && <div className="space-y-3">{p.licenses.map((l) => <p key={l.id}><strong>{l.name}</strong> — {inr(l.price)}</p>)}<p className="yk-muted">Read the full <Link to="/licenses" className="underline">licensing terms</Link>.</p></div>}
          {tab === 'changelog' && (p.changelog.length ? <ol className="space-y-4">{p.changelog.map((c, i) => <li key={i}><div className="font-semibold">v{c.version} <span className="text-xs font-normal yk-faint">· {c.date}</span></div><div className="yk-muted">{c.notes}</div></li>)}</ol> : <p className="yk-muted">No updates yet.</p>)}
          {tab === 'reviews' && (p.reviews.length ? <ul className="space-y-4">{p.reviews.map((r, i) => <li key={i} className="yk-card p-4"><div className="text-sm font-semibold">{r.name} · {r.rating}/5</div><p className="mt-1 text-sm yk-muted">{r.body}</p></li>)}</ul> : <p className="yk-muted">No reviews yet. Reviews can only be written by verified owners.</p>)}
        </div>
      </div>
      {p.related.length > 0 && <section className="mt-6"><h2 className="mb-5 text-2xl font-bold">Related products</h2><div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">{p.related.map((r) => <MiniCard key={r.id} p={r} />)}</div></section>}
      <Dialog open={full} onOpenChange={setFull}>
        <DialogContent className="max-w-6xl border-[var(--border)] bg-[var(--bg)] p-2" data-testid="fullscreen-viewer">
          <DialogTitle className="sr-only">{p.title} preview</DialogTitle>
          <img src={imgUrl(images[img])} alt={`${p.title} full preview`} className="max-h-[85vh] w-full object-contain" />
          {images.length > 1 && <div className="flex justify-center gap-2 pb-2">{images.map((u, i) => <button key={u} type="button" onClick={() => setImg(i)} className="h-2 w-6 rounded-full" style={{ background: i === img ? 'var(--accent)' : 'var(--border)' }} aria-label={`Image ${i + 1}`} />)}</div>}
        </DialogContent>
      </Dialog>
    </div>
  );
}
