import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { Search, Sun, Moon, Heart, ShoppingCart, Menu, User, LogOut, LayoutDashboard, X } from 'lucide-react';
import { Sheet, SheetContent, SheetTitle } from './ui/sheet';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from './ui/dropdown-menu';
import { Logo } from './common';
import { api, imgUrl, inr } from '../lib/api';
import { useAuth, useStore, isAdmin } from '../lib/store';
import { useSettings } from '../lib/hooks';

const NAV = [['New', '/new'], ['Bundles', '/bundles'], ['Components', '/components'], ['Templates', '/templates'], ['FAQ', '/faq']];

export function useTheme() {
  const [theme, setTheme] = useState(() => localStorage.getItem('yk_theme') || 'dark');
  useEffect(() => { document.documentElement.dataset.theme = theme; localStorage.setItem('yk_theme', theme); }, [theme]);
  return [theme, () => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))];
}

export function SearchBox({ onDone, testid = 'header-search' }) {
  const [q, setQ] = useState(''); const [res, setRes] = useState([]); const [idx, setIdx] = useState(-1); const [open, setOpen] = useState(false);
  const nav = useNavigate(); const ref = useRef(null);
  useEffect(() => {
    const t = setTimeout(() => { if (q.trim().length > 1) api.get('/search', { params: { q, limit: 6 } }).then((r) => { setRes(r.data); setOpen(true); }).catch(() => {}); else setRes([]); }, 220);
    return () => clearTimeout(t);
  }, [q]);
  useEffect(() => {
    const k = (e) => { if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); ref.current?.focus(); } };
    window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k);
  }, []);
  const go = (path) => { setOpen(false); setQ(''); setIdx(-1); nav(path); onDone?.(); };
  const onKey = (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setIdx((i) => Math.min(i + 1, res.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setIdx((i) => Math.max(i - 1, -1)); }
    else if (e.key === 'Escape') setOpen(false);
    else if (e.key === 'Enter' && q.trim()) { e.preventDefault(); go(idx >= 0 ? `/products/${res[idx].slug}` : `/search?q=${encodeURIComponent(q.trim())}`); }
  };
  return (
    <div className="relative w-full" onBlur={() => setTimeout(() => setOpen(false), 150)}>
      <label className="flex h-10 items-center gap-2 rounded-[6px] px-3" style={{ border: '1px solid var(--text-2)' }}>
        <Search size={16} className="shrink-0" aria-hidden />
        <input ref={ref} value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={onKey} onFocus={() => res.length && setOpen(true)} placeholder="Search templates & components…" aria-label="Search products" className="w-full bg-transparent text-[13px] outline-none placeholder:text-[var(--muted)]" data-testid={`${testid}-input`} role="combobox" aria-expanded={open} aria-controls="search-suggestions" />
        {q ? <button type="button" onClick={() => setQ('')} aria-label="Clear search" data-testid={`${testid}-clear`}><X size={14} /></button> : <kbd className="hidden rounded-[4px] px-1.5 text-[10px] lg:inline" style={{ border: '1px solid var(--border)' }}>⌘K</kbd>}
      </label>
      {open && q.trim().length > 1 && (
        <ul id="search-suggestions" role="listbox" className="yk-card absolute left-0 right-0 top-12 z-50 overflow-hidden p-1 shadow-lg" data-testid={`${testid}-suggestions`}>
          {res.length === 0 && <li className="px-3 py-3 text-sm yk-muted">No products match “{q}”.</li>}
          {res.map((p, i) => (
            <li key={p.id} role="option" aria-selected={i === idx}>
              <button type="button" onMouseDown={() => go(`/products/${p.slug}`)} className="flex w-full items-center gap-3 rounded-[6px] px-2 py-2 text-left" style={{ background: i === idx ? 'var(--accent-soft)' : 'transparent' }} data-testid={`search-suggestion-${p.slug}`}>
                <img src={imgUrl(p.preview_url)} alt="" className="h-9 w-14 rounded-[4px] object-cover" />
                <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold">{p.title}</span><span className="block text-xs yk-muted">{p.category}</span></span>
                <span className="text-xs font-semibold">{inr(p.price)}</span>
              </button>
            </li>
          ))}
          {res.length > 0 && <li><button type="button" onMouseDown={() => go(`/search?q=${encodeURIComponent(q)}`)} className="w-full px-3 py-2 text-left text-xs font-semibold yk-muted hover:underline" data-testid={`${testid}-all-results`}>See all results →</button></li>}
        </ul>
      )}
    </div>
  );
}

function AccountMenu() {
  const { user, logout } = useAuth(); const nav = useNavigate();
  if (!user) return <Link to="/login" className="yk-icon-btn" aria-label="Sign in" data-testid="header-signin"><User size={17} /></Link>;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex h-10 w-10 items-center justify-center rounded-full font-display font-bold text-white" style={{ background: 'var(--accent)' }} aria-label="Account menu" data-testid="header-account-menu">{user.name[0]?.toUpperCase()}</DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56 border-[var(--border)] bg-[var(--surface)] text-[var(--text)]">
        <div className="px-2 py-2 text-xs"><div className="font-semibold">{user.name}</div><div className="yk-muted">{user.email}</div></div>
        <DropdownMenuSeparator className="bg-[var(--border-soft)]" />
        <DropdownMenuItem onClick={() => nav('/account')} data-testid="menu-account"><User size={14} className="mr-2" />My account</DropdownMenuItem>
        <DropdownMenuItem onClick={() => nav('/account/library')} data-testid="menu-library"><LayoutDashboard size={14} className="mr-2" />My library</DropdownMenuItem>
        {isAdmin(user) && <DropdownMenuItem onClick={() => nav('/admin')} data-testid="menu-admin"><LayoutDashboard size={14} className="mr-2" />Admin portal</DropdownMenuItem>}
        <DropdownMenuSeparator className="bg-[var(--border-soft)]" />
        <DropdownMenuItem onClick={async () => { await logout(); nav('/'); }} data-testid="menu-logout"><LogOut size={14} className="mr-2" />Sign out</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export default function Header() {
  const s = useSettings(); const { cart, wish } = useStore(); const [theme, toggle] = useTheme(); const [open, setOpen] = useState(false);
  const linkCls = ({ isActive }) => `relative py-1 text-[15px] font-medium transition-colors ${isActive ? 'text-[var(--text)] after:absolute after:-bottom-1 after:left-0 after:right-0 after:h-[2px] after:bg-[var(--accent)]' : 'text-[var(--text)]/90 hover:text-[var(--rose)]'}`;
  return (
    <>
      {s.announcement_enabled && s.announcement && (
        <div className="relative flex h-8 items-center justify-center px-4 text-[11px] font-semibold uppercase tracking-[0.12em] text-white sm:text-xs" style={{ background: 'var(--accent)' }} data-testid="announcement-bar">
          <span className="truncate">{s.announcement}</span>
          {s.announcement_link && <Link to={s.announcement_link} className="absolute right-4 hidden normal-case tracking-normal hover:underline md:inline" data-testid="announcement-link">Shop now →</Link>}
        </div>
      )}
      <header className="sticky top-0 z-40" style={{ background: 'var(--bg)', borderBottom: '1px solid var(--border-soft)' }}>
        <div className="yk-container flex h-[76px] items-center gap-6">
          <button type="button" className="yk-icon-btn lg:hidden" onClick={() => setOpen(true)} aria-label="Open menu" data-testid="mobile-menu-button"><Menu size={18} /></button>
          <Logo />
          <nav className="mx-auto hidden items-center gap-9 lg:flex" aria-label="Main">{NAV.map(([l, to]) => <NavLink key={to} to={to} className={linkCls} data-testid={`nav-${l.toLowerCase()}`}>{l}</NavLink>)}</nav>
          <div className="ml-auto flex items-center gap-2.5 lg:ml-0">
            <div className="hidden w-[290px] xl:block"><SearchBox /></div>
            <button type="button" onClick={toggle} className="yk-icon-btn hidden sm:inline-flex" aria-label="Toggle colour theme" data-testid="theme-toggle">{theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}</button>
            <Link to="/wishlist" className="yk-icon-btn hidden sm:inline-flex" aria-label={`Wishlist (${wish.length})`} data-testid="header-wishlist"><Heart size={17} />{wish.length > 0 && <Count n={wish.length} />}</Link>
            <Link to="/cart" className="yk-icon-btn" aria-label={`Cart (${cart.length} items)`} data-testid="header-cart"><ShoppingCart size={17} />{cart.length > 0 && <Count n={cart.length} testid="cart-count" />}</Link>
            <AccountMenu />
          </div>
        </div>
      </header>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="left" className="w-[300px] border-[var(--border)] bg-[var(--bg)] text-[var(--text)]" data-testid="mobile-menu">
          <SheetTitle className="sr-only">Menu</SheetTitle>
          <div className="mt-6 space-y-6">
            <SearchBox onDone={() => setOpen(false)} testid="mobile-search" />
            <nav className="flex flex-col gap-1" aria-label="Mobile">
              {[...NAV, ['Wishlist', '/wishlist'], ['Cart', '/cart'], ['My account', '/account'], ['Contact', '/contact']].map(([l, to]) => <NavLink key={to} to={to} onClick={() => setOpen(false)} className="rounded-[6px] px-3 py-2.5 text-[15px] font-medium hover:bg-[var(--accent-soft)]" data-testid={`mobile-nav-${l.toLowerCase().replace(' ', '-')}`}>{l}</NavLink>)}
            </nav>
            <button type="button" onClick={toggle} className="yk-btn-outline w-full" data-testid="mobile-theme-toggle">{theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />} {theme === 'dark' ? 'Light' : 'Dark'} theme</button>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
const Count = ({ n, testid }) => <span className="absolute -right-1.5 -top-1.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full px-1 text-[10px] font-bold text-white" style={{ background: 'var(--accent)' }} data-testid={testid}>{n}</span>;
