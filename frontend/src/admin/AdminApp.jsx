import { Suspense, lazy, useState } from 'react';
import { NavLink, Routes, Route, useNavigate, Link } from 'react-router-dom';
import { Home, Layers, UploadCloud, ShoppingCart, Users, BarChart3, Tag, Mail, FolderTree, Library, Image, Settings, ShieldCheck, ScrollText, Menu, LogOut, Store, Search } from 'lucide-react';
import { Sheet, SheetContent, SheetTitle } from '../components/ui/sheet';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '../components/ui/dropdown-menu';
import { Logo, Spinner } from '../components/common';
import { useAuth } from '../lib/store';
import { useTheme } from '../components/Header';
import { api, PHOTOS } from '../lib/api';

const Overview = lazy(() => import('./Overview'));
const Products = lazy(() => import('./Products'));
const ProductEditor = lazy(() => import('./ProductEditor'));
const Orders = lazy(() => import('./Orders'));
const Analytics = lazy(() => import('./Analytics'));
const M = lazy(() => import('./Manage'));

const NAV = [['Overview', '', Home], ['Products', 'products', Layers], ['Upload Template', 'upload', UploadCloud], ['Orders', 'orders', ShoppingCart], ['Customers', 'customers', Users], ['Analytics', 'analytics', BarChart3], ['Discounts', 'discounts', Tag], ['Messages', 'messages', Mail], ['Categories', 'categories', FolderTree], ['Collections', 'collections', Library], ['Media Library', 'media', Image], ['Store Settings', 'settings', Settings], ['Administrators', 'admins', ShieldCheck], ['Audit Logs', 'audit', ScrollText]];

function Sidebar({ onNav }) {
  return (
    <div className="relative flex h-full flex-col overflow-hidden" style={{ background: 'var(--surface)' }}>
      <div className="px-6 py-6"><Logo to="/admin" small /></div>
      <nav className="relative z-10 flex-1 space-y-0.5 overflow-y-auto px-3 pb-56" aria-label="Admin">
        {NAV.map(([l, to, I]) => (
          <NavLink key={l} to={`/admin/${to}`} end={to === ''} onClick={onNav} data-testid={`admin-nav-${to || 'overview'}`}
            className={({ isActive }) => `flex items-center gap-3.5 rounded-[8px] px-4 py-2.5 text-[14.5px] font-medium transition-colors ${isActive ? 'text-white' : 'hover:bg-[var(--accent-soft)]'}`}
            style={({ isActive }) => (isActive ? { background: 'var(--accent)' } : {})}><I size={18} strokeWidth={1.7} />{l}</NavLink>
        ))}
        <Link to="/" className="mt-3 flex items-center gap-3.5 rounded-[8px] px-4 py-2.5 text-[14.5px] font-medium hover:bg-[var(--accent-soft)]" data-testid="admin-nav-storefront"><Store size={18} strokeWidth={1.7} />View storefront</Link>
      </nav>
      <img src={PHOTOS.camel} alt="" aria-hidden className="pointer-events-none absolute bottom-0 left-0 h-60 w-full object-cover object-top opacity-55" style={{ maskImage: 'linear-gradient(to bottom, transparent, #000 45%)', WebkitMaskImage: 'linear-gradient(to bottom, transparent, #000 45%)' }} />
    </div>
  );
}

function AdminSearch() {
  const [q, setQ] = useState(''); const [r, setR] = useState(null); const nav = useNavigate();
  const run = async (v) => { setQ(v); if (v.trim().length < 2) { setR(null); return; } try { setR((await api.get('/admin/search', { params: { q: v } })).data); } catch { setR(null); } };
  const go = (p) => { setR(null); setQ(''); nav(p); };
  return (
    <div className="relative hidden w-[340px] md:block" onBlur={() => setTimeout(() => setR(null), 150)}>
      <label className="flex h-10 items-center gap-2 rounded-[6px] px-3" style={{ border: '1px solid var(--text-2)' }}><Search size={16} /><input value={q} onChange={(e) => run(e.target.value)} placeholder="Search templates, orders, customers…" className="w-full bg-transparent text-[13px] outline-none" aria-label="Admin search" data-testid="admin-search-input" /></label>
      {r && (
        <div className="yk-card absolute left-0 right-0 top-12 z-50 max-h-80 overflow-y-auto p-2 text-sm shadow-lg" data-testid="admin-search-results">
          {[['Products', r.products, (x) => [`${x.title}`, `/admin/products/${x.id}`]], ['Orders', r.orders, (x) => [`${x.number} · ${x.status}`, `/admin/orders?q=${x.number}`]], ['Customers', r.customers, (x) => [`${x.name} · ${x.email}`, `/admin/customers?q=${x.email}`]]].map(([h, list, f]) => list.length > 0 && (
            <div key={h} className="mb-1"><div className="px-2 py-1 text-[11px] font-semibold uppercase yk-faint">{h}</div>{list.map((x) => { const [t, p] = f(x); return <button key={x.id} type="button" onMouseDown={() => go(p)} className="block w-full truncate rounded-[4px] px-2 py-1.5 text-left hover:bg-[var(--accent-soft)]">{t}</button>; })}</div>
          ))}
          {!r.products.length && !r.orders.length && !r.customers.length && <div className="px-2 py-2 yk-muted">No matches</div>}
        </div>
      )}
    </div>
  );
}

export function PageHead({ title, sub, actions }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div><h1 className="text-[30px] font-extrabold leading-tight sm:text-[34px]" data-testid="admin-page-title">{title}</h1>{sub && <p className="mt-1 yk-muted">{sub}</p>}</div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export default function AdminApp() {
  const { user, logout } = useAuth(); const nav = useNavigate(); const [open, setOpen] = useState(false); useTheme();
  return (
    <div className="flex min-h-screen">
      <aside className="sticky top-0 hidden h-screen w-[250px] shrink-0 lg:block" style={{ borderRight: '1px solid var(--border-soft)' }}><Sidebar /></aside>
      <Sheet open={open} onOpenChange={setOpen}><SheetContent side="left" className="w-[260px] border-[var(--border)] p-0"><SheetTitle className="sr-only">Admin navigation</SheetTitle><Sidebar onNav={() => setOpen(false)} /></SheetContent></Sheet>
      <div className="min-w-0 flex-1">
        <header className="sticky top-0 z-30 flex h-[72px] items-center gap-4 px-4 sm:px-8" style={{ background: 'var(--bg)', borderBottom: '1px solid var(--border-soft)' }}>
          <button type="button" className="yk-icon-btn lg:hidden" onClick={() => setOpen(true)} aria-label="Open admin menu" data-testid="admin-menu-button"><Menu size={18} /></button>
          <span className="text-sm yk-muted">Business portal</span>
          <div className="ml-auto flex items-center gap-4">
            <AdminSearch />
            <DropdownMenu>
              <DropdownMenuTrigger className="flex items-center gap-3" data-testid="admin-user-menu">
                <span className="flex h-10 w-10 items-center justify-center rounded-full font-display font-bold text-white" style={{ background: 'var(--accent)' }}>{user.name[0]}</span>
                <span className="hidden text-left text-sm sm:block"><span className="block font-semibold">{user.name}</span><span className="block text-xs capitalize yk-muted">{user.role.replace('_', ' ')}</span></span>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="border-[var(--border)] bg-[var(--surface)] text-[var(--text)]">
                <div className="px-2 py-1.5 text-xs yk-muted">{user.email}</div>
                <DropdownMenuItem onClick={() => nav('/account/profile')}>My profile</DropdownMenuItem>
                <DropdownMenuItem onClick={async () => { await logout(); nav('/login'); }} data-testid="admin-logout"><LogOut size={14} className="mr-2" />Sign out</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>
        <main className="p-4 sm:p-8">
          <Suspense fallback={<Spinner />}>
            <Routes>
              <Route index element={<Overview />} />
              <Route path="products" element={<Products />} />
              <Route path="products/:id" element={<ProductEditor />} />
              <Route path="upload" element={<ProductEditor />} />
              <Route path="orders" element={<Orders />} />
              <Route path="customers" element={<M view="customers" />} />
              <Route path="analytics" element={<Analytics />} />
              {['discounts', 'messages', 'categories', 'collections', 'media', 'settings', 'admins', 'audit'].map((v) => <Route key={v} path={v} element={<M view={v} />} />)}
            </Routes>
          </Suspense>
        </main>
      </div>
    </div>
  );
}
