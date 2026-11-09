import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Outlet, Navigate, useLocation } from 'react-router-dom';
import { Toaster } from 'sonner';
import './App.css';
import { AuthProvider, StoreProvider, useAuth, isAdmin } from './lib/store';
import Header from './components/Header';
import Footer from './components/Footer';
import { Spinner } from './components/common';

const Home = lazy(() => import('./pages/Home'));
const Catalog = lazy(() => import('./pages/Catalog'));
const Product = lazy(() => import('./pages/Product'));
const Wishlist = lazy(() => import('./pages/Wishlist'));
const Checkout = lazy(() => import('./pages/Checkout'));
const CheckoutResult = lazy(() => import('./pages/CheckoutResult'));
const Auth = lazy(() => import('./pages/Auth'));
const Info = lazy(() => import('./pages/Info'));
const AdminApp = lazy(() => import('./admin/AdminApp'));
const AccountApp = lazy(() => import('./account/AccountApp'));

function StoreLayout() {
  return (
    <div className="flex min-h-screen flex-col">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 yk-btn">Skip to content</a>
      <Header />
      <main id="main" className="flex-1"><Suspense fallback={<Spinner />}><Outlet /></Suspense></main>
      <Footer />
    </div>
  );
}

export function RequireAuth({ admin = false, children }) {
  const { user, ready } = useAuth(); const loc = useLocation();
  if (!ready) return <Spinner />;
  if (!user) return <Navigate to={`/login?next=${encodeURIComponent(loc.pathname + loc.search)}`} replace />;
  if (admin && !isAdmin(user)) return <Navigate to="/access-denied" replace />;
  return children;
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <StoreProvider>
          <Suspense fallback={<Spinner />}>
            <Routes>
              <Route element={<StoreLayout />}>
                <Route path="/" element={<Home />} />
                <Route path="/new" element={<Catalog mode="new" />} />
                <Route path="/templates" element={<Catalog mode="templates" />} />
                <Route path="/components" element={<Catalog mode="components" />} />
                <Route path="/bundles" element={<Catalog mode="bundles" />} />
                <Route path="/categories/:slug" element={<Catalog mode="category" />} />
                <Route path="/search" element={<Catalog mode="search" />} />
                <Route path="/products/:slug" element={<Product />} />
                <Route path="/wishlist" element={<Wishlist />} />
                <Route path="/cart" element={<Checkout step="cart" />} />
                <Route path="/checkout" element={<Checkout step="checkout" />} />
                <Route path="/checkout/success" element={<CheckoutResult ok />} />
                <Route path="/checkout/failed" element={<CheckoutResult />} />
                {['login', 'register', 'forgot-password', 'reset-password', 'verify-email'].map((m) => <Route key={m} path={`/${m}`} element={<Auth mode={m} />} />)}
                {['about', 'faq', 'licenses', 'terms', 'privacy', 'refund-policy', 'contact', 'access-denied', 'server-error'].map((p) => <Route key={p} path={`/${p}`} element={<Info page={p} />} />)}
                <Route path="*" element={<Info page="not-found" />} />
              </Route>
              <Route path="/admin/*" element={<RequireAuth admin><AdminApp /></RequireAuth>} />
              <Route path="/account/*" element={<RequireAuth><AccountApp /></RequireAuth>} />
            </Routes>
          </Suspense>
          <Toaster position="bottom-right" toastOptions={{ style: { background: 'var(--surface)', color: 'var(--text)', border: '1px solid var(--border)' } }} />
        </StoreProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
