import { useEffect, useMemo, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { RotateCcw, SlidersHorizontal } from 'lucide-react';
import { api } from '../lib/api';
import { useCategories, useTitle } from '../lib/hooks';
import { ProductCard } from '../components/ProductCard';
import { EmptyState, Spinner } from '../components/common';

const META = {
  new: ['New releases', 'The latest original templates and components from the studio.'],
  templates: ['Templates', 'Complete website templates for landing pages, dashboards, portfolios and businesses.'],
  components: ['Components', 'Reusable, animated interface components ready to drop into your project.'],
  bundles: ['Bundles', 'Curated sets of templates and components at one price.'],
  search: ['Search', ''], category: ['', ''],
};

export default function Catalog({ mode }) {
  const { slug } = useParams(); const [sp, setSp] = useSearchParams(); const cats = useCategories();
  const fixedCat = mode === 'components' ? 'components' : mode === 'bundles' ? 'bundles' : mode === 'category' ? slug : '';
  const f = { q: sp.get('q') || '', cat: sp.get('category') || '', tech: sp.get('tech') || '', min: sp.get('min') || '', max: sp.get('max') || '', sort: sp.get('sort') || 'newest' };
  const [data, setData] = useState(null); const [page, setPage] = useState(1); const [items, setItems] = useState([]); const [showF, setShowF] = useState(false);
  const catName = cats.find((c) => c.slug === (fixedCat || f.cat))?.name;
  const [title, desc] = mode === 'category' ? [catName || 'Category', cats.find((c) => c.slug === slug)?.description || ''] : mode === 'search' ? [f.q ? `Results for “${f.q}”` : 'All products', ''] : META[mode];
  useTitle(title, desc);
  const params = useMemo(() => ({ search: f.q, category: fixedCat || f.cat, tech: f.tech, min_price: f.min ? Math.round(+f.min * 100) : undefined, max_price: f.max ? Math.round(+f.max * 100) : undefined, sort: f.sort, new: mode === 'new' || undefined, page_size: 12 }), [sp.toString(), mode, fixedCat]); // eslint-disable-line
  useEffect(() => { setPage(1); setData(null); api.get('/catalog', { params: { ...params, page: 1 } }).then((r) => { setData(r.data); setItems(r.data.items); }); }, [params]);
  const more = async () => { const r = await api.get('/catalog', { params: { ...params, page: page + 1 } }); setPage(page + 1); setItems((x) => [...x, ...r.data.items]); };
  const set = (k, v) => { const n = new URLSearchParams(sp); v ? n.set(k, v) : n.delete(k); setSp(n, { replace: true }); };
  const reset = () => setSp(f.q ? { q: f.q } : {}, { replace: true });

  return (
    <div className="yk-container py-10">
      <header className="mb-8 max-w-3xl">
        <p className="yk-eyebrow mb-2">Catalogue</p>
        <h1 className="text-[32px] font-extrabold sm:text-[40px]" data-testid="catalog-title">{title}</h1>
        {desc && <p className="mt-2 yk-muted">{desc}</p>}
      </header>
      <div className="mb-6 flex flex-wrap items-center gap-3">
        {!fixedCat && (
          <div className="scrollbar-none flex max-w-full gap-2 overflow-x-auto">
            <button type="button" data-active={!f.cat} className="yk-pill" onClick={() => set('category', '')} data-testid="filter-cat-all">All</button>
            {cats.map((c) => <button key={c.id} type="button" data-active={f.cat === c.slug} className="yk-pill" onClick={() => set('category', c.slug)} data-testid={`filter-cat-${c.slug}`}>{c.name}</button>)}
          </div>
        )}
        <button type="button" className="yk-btn-outline !py-2 md:hidden" onClick={() => setShowF(!showF)} data-testid="toggle-filters"><SlidersHorizontal size={15} />Filters</button>
      </div>
      <div className={`${showF ? 'grid' : 'hidden'} yk-card mb-8 gap-4 p-4 md:grid md:grid-cols-[1.2fr_1fr_1fr_1fr_auto] md:items-end`} data-testid="catalog-filters">
        <label><span className="yk-label">Search</span><input className="yk-input" value={f.q} onChange={(e) => set('q', e.target.value)} placeholder="Name, tag, technology…" data-testid="filter-search" /></label>
        <label><span className="yk-label">Technology</span>
          <select className="yk-input" value={f.tech} onChange={(e) => set('tech', e.target.value)} data-testid="filter-tech"><option value="">Any technology</option>{(data?.technologies || []).concat(f.tech && !(data?.technologies || []).includes(f.tech) ? [f.tech] : []).map((t) => <option key={t}>{t}</option>)}</select>
        </label>
        <div><span className="yk-label">Price (₹)</span><div className="flex gap-2"><input type="number" min="0" className="yk-input" placeholder="Min" value={f.min} onChange={(e) => set('min', e.target.value)} data-testid="filter-min-price" /><input type="number" min="0" className="yk-input" placeholder="Max" value={f.max} onChange={(e) => set('max', e.target.value)} data-testid="filter-max-price" /></div></div>
        <label><span className="yk-label">Sort by</span>
          <select className="yk-input" value={f.sort} onChange={(e) => set('sort', e.target.value)} data-testid="filter-sort"><option value="newest">Newest</option><option value="popular">Most purchased</option><option value="price_asc">Price: low to high</option><option value="price_desc">Price: high to low</option></select>
        </label>
        <button type="button" className="yk-btn-ghost" onClick={reset} data-testid="filter-reset"><RotateCcw size={15} />Reset</button>
      </div>
      {data === null ? <Spinner /> : items.length === 0 ? (
        <EmptyState title={mode === 'search' || sp.toString() ? 'No products match these filters' : 'The collection is coming soon'} text={sp.toString() ? 'Try removing a filter or searching for something broader.' : 'New products are published here as soon as they are ready.'} action={sp.toString() ? <button type="button" className="yk-btn-outline" onClick={reset}>Reset filters</button> : null} testid="catalog-empty" />
      ) : (
        <>
          <p className="mb-4 text-sm yk-muted" data-testid="catalog-count">{data.total} product{data.total === 1 ? '' : 's'}</p>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4" data-testid="catalog-grid">{items.map((p) => <ProductCard key={p.id} p={p} />)}</div>
          {items.length < data.total && <div className="mt-10 text-center"><button type="button" className="yk-btn-outline" onClick={more} data-testid="catalog-load-more">Load more</button></div>}
        </>
      )}
    </div>
  );
}
