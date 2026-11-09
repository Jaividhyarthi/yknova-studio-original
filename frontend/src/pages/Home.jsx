import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, Check, LayoutGrid, Layers, BarChart3, Image as ImageIcon, Briefcase, Box, Package, Component } from 'lucide-react';
import { api, PHOTOS } from '../lib/api';
import { useCategories, useTitle } from '../lib/hooks';
import { ProductCard, FeaturedCard } from '../components/ProductCard';
import { EmptyState, SectionHead, Spinner } from '../components/common';
import { ValueStrip } from '../components/Footer';

const ICONS = { 'landing-pages': Layers, dashboards: BarChart3, portfolios: ImageIcon, business: Briefcase, saas: Layers, components: Box, bundles: Package };

function HeroVisual() {
  return (
    <div className="relative h-[300px] sm:h-[360px] lg:h-full" aria-hidden>
      <img src={PHOTOS.treasury} alt="" className="absolute inset-0 h-full w-full object-cover object-[50%_35%] opacity-70" />
      <div className="absolute inset-0" style={{ background: 'linear-gradient(90deg, var(--bg) 0%, rgba(27,15,12,0.35) 45%, rgba(27,15,12,0.1) 100%)' }} />
      <div className="absolute left-[6%] top-[12%] w-[64%] overflow-hidden rounded-[10px] shadow-2xl" style={{ border: '1px solid rgba(243,224,220,0.35)', transform: 'perspective(1400px) rotateY(-14deg) rotateX(4deg)', background: '#1d100d' }}>
        <div className="flex items-center justify-between px-4 py-2.5 text-[9px] text-[#F3E0DC]/80"><span className="font-display text-[11px] font-bold">Petrafolio</span><span className="flex gap-4"><span>Work</span><span>About</span><span>Services</span><span>Contact</span></span></div>
        <div className="relative aspect-[16/10]">
          <img src={PHOTOS.siq} alt="" className="absolute inset-0 h-full w-full object-cover" />
          <div className="absolute inset-0" style={{ background: 'linear-gradient(90deg, rgba(29,16,13,0.92) 0%, rgba(29,16,13,0.4) 55%, transparent 100%)' }} />
          <div className="absolute left-5 top-1/4 max-w-[52%] text-[#F3E0DC]">
            <div className="font-display text-[clamp(14px,1.6vw,22px)] font-semibold italic leading-tight">A modern portfolio for creative work</div>
            <div className="mt-2 text-[9px] opacity-80">Showcase your projects with a clean, refined and timeless layout.</div>
            <span className="mt-3 inline-block rounded-[3px] px-2.5 py-1 text-[8px] font-semibold text-white" style={{ background: '#BC4639' }}>View Work →</span>
          </div>
        </div>
      </div>
      <div className="absolute right-[3%] top-[18%] hidden w-[28%] overflow-hidden rounded-[10px] p-2 shadow-2xl sm:block" style={{ background: '#F3E0DC', transform: 'perspective(1400px) rotateY(-14deg)' }}>
        <div className="mb-2 flex gap-2 px-1 text-[7px] text-[#5C2018]/70"><span>Gallery</span><span>Journal</span><span>Contact</span></div>
        <div className="grid grid-cols-2 gap-1.5">
          {[PHOTOS.monastery, PHOTOS.camel, PHOTOS.siq, PHOTOS.treasury].map((src, i) => <img key={i} src={src} alt="" className="aspect-square w-full rounded-[4px] object-cover" />)}
        </div>
      </div>
      <p className="absolute bottom-2 right-3 text-[10px] text-[#F3E0DC]/60">Photography: Unsplash</p>
    </div>
  );
}

export default function Home() {
  useTitle(null, 'Beautifully crafted website templates and UI components by YKNOVA Technologies.');
  const nav = useNavigate(); const cats = useCategories();
  const [cat, setCat] = useState('all'); const [featured, setFeatured] = useState(null); const [items, setItems] = useState(null);
  useEffect(() => { api.get('/catalog', { params: { featured: true, page_size: 3 } }).then((r) => setFeatured(r.data.items)); }, []);
  useEffect(() => { setItems(null); api.get('/catalog', { params: { category: cat === 'all' ? '' : cat, page_size: 8 } }).then((r) => setItems(r.data.items)); }, [cat]);
  return (
    <>
      <section className="relative overflow-hidden" style={{ borderBottom: '1px solid var(--border-soft)' }}>
        <div className="grid lg:min-h-[430px] lg:grid-cols-[1.08fr_1fr]">
          <div className="yk-container relative z-10 flex flex-col justify-center py-12 lg:!mr-0 lg:!max-w-[820px] lg:py-16">
            <h1 className="font-display text-[40px] font-extrabold leading-[1.04] sm:text-[54px] xl:text-[64px]" data-testid="hero-title">Beautiful original UI<br className="hidden sm:block" /> <span style={{ color: '#E0806B' }}>templates &amp; components.</span></h1>
            <p className="mt-5 max-w-xl text-base leading-relaxed sm:text-[17px]" style={{ color: 'var(--text)' }}>Thoughtfully crafted website templates and interface components, designed for developers, designers, and modern digital businesses.</p>
            <div className="mt-8 flex flex-wrap gap-4">
              <Link to="/templates" className="yk-btn !px-7 !py-3 text-[15px]" data-testid="hero-browse-templates">Browse Templates <ArrowRight size={16} /></Link>
              <Link to="/components" className="yk-btn-outline !px-7 !py-3 text-[15px]" style={{ borderColor: 'var(--text)' }} data-testid="hero-explore-components">Explore Components</Link>
            </div>
            <ul className="mt-7 flex flex-wrap gap-x-7 gap-y-2 text-[13px]">{['Original designs', 'Editable source files', 'Transparent licensing'].map((t) => <li key={t} className="flex items-center gap-2"><Check size={15} style={{ color: 'var(--accent)' }} />{t}</li>)}</ul>
          </div>
          <HeroVisual />
        </div>
      </section>

      <div className="yk-container">
        <div className="flex items-center gap-4 py-6">
          <span className="hidden shrink-0 text-sm font-semibold md:inline" style={{ color: 'var(--rose)' }}>Browse by category:</span>
          <div className="scrollbar-none flex gap-2.5 overflow-x-auto pb-1" role="tablist" aria-label="Categories">
            <button type="button" role="tab" aria-selected={cat === 'all'} data-active={cat === 'all'} onClick={() => setCat('all')} className="yk-pill" data-testid="category-pill-all"><LayoutGrid size={15} />All</button>
            {cats.filter((c) => c.name !== 'Other').map((c) => { const I = ICONS[c.slug] || Component; return <button key={c.id} type="button" role="tab" aria-selected={cat === c.slug} data-active={cat === c.slug} onClick={() => setCat(c.slug)} className="yk-pill" data-testid={`category-pill-${c.slug}`}><I size={15} />{c.name}</button>; })}
          </div>
          <Link to="/templates" className="ml-auto hidden shrink-0 text-[13px] font-medium hover:underline xl:inline" data-testid="view-all-categories">View all categories →</Link>
        </div>

        <section className="mb-12">
          <SectionHead title="Most wanted this week" link="/new" linkLabel="Everything new" testid="featured-everything-new" />
          {featured === null ? <Spinner /> : featured.length === 0 ? (
            <EmptyState title="The collection is coming soon" text="Our first original templates are being prepared. Join the newsletter below to hear the moment they launch." testid="featured-empty" />
          ) : <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">{featured.map((p) => <FeaturedCard key={p.id} p={p} />)}</div>}
        </section>

        <section className="mb-12">
          <SectionHead title="Featured templates" link="/templates" linkLabel="View all templates" testid="view-all-templates" />
          {items === null ? <Spinner /> : items.length === 0 ? (
            <EmptyState title="Nothing here yet" text="No published products in this category. Check back soon or browse another category." action={<button type="button" className="yk-btn-outline" onClick={() => setCat('all')}>Show all</button>} testid="catalog-empty" />
          ) : <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4" data-testid="home-product-grid">{items.map((p) => <ProductCard key={p.id} p={p} />)}</div>}
          {items?.length > 0 && <div className="mt-8 text-center"><button type="button" onClick={() => nav(cat === 'all' ? '/templates' : `/categories/${cat}`)} className="yk-btn-outline" data-testid="home-browse-more">Browse the full catalogue</button></div>}
        </section>
        <ValueStrip />
      </div>
    </>
  );
}
