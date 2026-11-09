import { Suspense, lazy, useState } from 'react';
import { NavLink, Routes, Route, Link, useNavigate } from 'react-router-dom';
import { LayoutGrid, Layers, Download, Package, Heart, FileText, LifeBuoy, User, Shield, Store, ShoppingCart, Menu, LogOut } from 'lucide-react';
import { Sheet, SheetContent, SheetTitle } from '../components/ui/sheet';
import { Logo, Spinner } from '../components/common';
import { useAuth, useStore, isAdmin } from '../lib/store';
import { useTheme } from '../components/Header';

const P = lazy(() => import('./Pages'));
const Dashboard = lazy(() => import('./Dashboard'));

const NAV = [['Dashboard', '', LayoutGrid], ['My Library', 'library', Layers], ['Downloads', 'downloads', Download], ['Orders', 'orders', Package], ['Wishlist', 'wishlist', Heart], ['Invoices', 'invoices', FileText], ['Support', 'support', LifeBuoy]];
const NAV2 = [['Profile', 'profile', User], ['Security', 'security', Shield]];

function Side({ onNav }) {
  const { cart } = useStore(); const { user, logout } = useAuth(); const nav = useNavigate();
  const item = ([l, to, I]) => <NavLink key={l} to={`/account/${to}`} end={to === ''} onClick={onNav} data-testid={`account-nav-${to || 'dashboard'}`} className={({ isActive }) => `flex items-center gap-3.5 rounded-[8px] px-4 py-2.5 text-[15px] font-medium transition-colors ${isActive ? 'text-white' : 'hover:bg-[var(--accent-soft)]'}`} style={({ isActive }) => (isActive ? { background: 'var(--accent)' } : {})}><I size={19} strokeWidth={1.7} />{l}</NavLink>;
  return (
    <div className="flex h-full flex-col" style={{ background: 'var(--surface)' }}>
      <div className="px-6 py-6"><Logo small /></div>
      <div className="mx-6 border-t pt-5" style={{ borderColor: 'var(--border-soft)' }}><p className="yk-eyebrow mb-3">Customer portal</p></div>
      <nav className="flex-1 space-y-0.5 overflow-y-auto px-3" aria-label="Account">
        <Link to="/" onClick={onNav} className="mb-2 flex items-center gap-3.5 rounded-[8px] px-4 py-2.5 text-[15px] font-semibold" style={{ border: '1px solid var(--border)' }} data-testid="account-nav-marketplace"><Store size={19} strokeWidth={1.7} />Browse Marketplace</Link>
        {NAV.map(item)}
        <Link to="/cart" onClick={onNav} className="flex items-center gap-3.5 rounded-[8px] px-4 py-2.5 text-[15px] font-medium hover:bg-[var(--accent-soft)]" data-testid="account-nav-cart"><ShoppingCart size={19} strokeWidth={1.7} />Cart{cart.length > 0 && <span className="ml-auto text-xs yk-muted">{cart.length}</span>}</Link>
        <div className="mx-3 my-4 border-t" style={{ borderColor: 'var(--border-soft)' }} />
        {NAV2.map(item)}
        {isAdmin(user) && <Link to="/admin" className="flex items-center gap-3.5 rounded-[8px] px-4 py-2.5 text-[15px] font-medium hover:bg-[var(--accent-soft)]" data-testid="account-nav-admin"><LayoutGrid size={19} strokeWidth={1.7} />Admin portal</Link>}
        <button type="button" onClick={async () => { await logout(); nav('/'); }} className="flex w-full items-center gap-3.5 rounded-[8px] px-4 py-2.5 text-[15px] font-medium hover:bg-[var(--accent-soft)]" data-testid="account-logout"><LogOut size={19} strokeWidth={1.7} />Sign out</button>
      </nav>
    </div>
  );
}

export default function AccountApp() {
  const [open, setOpen] = useState(false); useTheme();
  return (
    <div className="flex min-h-screen">
      <aside className="sticky top-0 hidden h-screen w-[250px] shrink-0 lg:block" style={{ borderRight: '1px solid var(--border-soft)' }}><Side /></aside>
      <Sheet open={open} onOpenChange={setOpen}><SheetContent side="left" className="w-[270px] border-[var(--border)] p-0"><SheetTitle className="sr-only">Account navigation</SheetTitle><Side onNav={() => setOpen(false)} /></SheetContent></Sheet>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-3 p-4 lg:hidden" style={{ borderBottom: '1px solid var(--border-soft)' }}><button type="button" className="yk-icon-btn" onClick={() => setOpen(true)} aria-label="Open account menu" data-testid="account-menu-button"><Menu size={18} /></button><Logo small /></div>
        <main><Suspense fallback={<Spinner />}><Routes>
          <Route index element={<Dashboard />} />
          {['library', 'downloads', 'orders', 'wishlist', 'invoices', 'support', 'profile', 'security'].map((v) => <Route key={v} path={v} element={<P view={v} />} />)}
          <Route path="orders/:id" element={<P view="order" />} />
        </Routes></Suspense></main>
      </div>
    </div>
  );
}
