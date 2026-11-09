import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { api, getToken, setToken, errMsg } from './api';

const AuthCtx = createContext(null);
const StoreCtx = createContext(null);
const CART_KEY = 'yk_cart';
const WISH_KEY = 'yk_wish';
const readLS = (k) => { try { return JSON.parse(localStorage.getItem(k)) || []; } catch { return []; } };
export const isAdmin = (u) => u && ['admin', 'super_admin'].includes(u.role);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);
  const refresh = useCallback(async () => {
    if (!getToken()) { setUser(null); setReady(true); return; }
    try { setUser((await api.get('/auth/me')).data); } catch { setToken(null); setUser(null); }
    setReady(true);
  }, []);
  useEffect(() => { refresh(); }, [refresh]);
  const login = async (email, password) => {
    const { data } = await api.post('/auth/login', { email, password });
    setToken(data.token); setUser(data.user); return data.user;
  };
  const register = async (body) => {
    const { data } = await api.post('/auth/register', body);
    setToken(data.token); setUser(data.user); return data.user;
  };
  const logout = async () => {
    try { await api.post('/auth/logout'); } catch { /* token may already be invalid */ }
    setToken(null); setUser(null);
  };
  return <AuthCtx.Provider value={{ user, ready, login, register, logout, refresh, setUser }}>{children}</AuthCtx.Provider>;
}
export const useAuth = () => useContext(AuthCtx);

export function StoreProvider({ children }) {
  const { user } = useAuth();
  const [cart, setCart] = useState(() => readLS(CART_KEY));
  const [wish, setWish] = useState(() => readLS(WISH_KEY));
  useEffect(() => localStorage.setItem(CART_KEY, JSON.stringify(cart)), [cart]);
  useEffect(() => { if (!user) localStorage.setItem(WISH_KEY, JSON.stringify(wish)); }, [wish, user]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        const merged = (await api.post('/cart/merge', { items: readLS(CART_KEY) })).data;
        setCart(merged.map(({ product_id, license_id }) => ({ product_id, license_id })));
        const guestWish = readLS(WISH_KEY);
        await Promise.all(guestWish.map((product_id) => api.post('/wishlist', { product_id }).catch(() => null)));
        localStorage.removeItem(WISH_KEY);
        setWish((await api.get('/wishlist')).data);
      } catch { /* keep local state */ }
    })();
  }, [user]);

  const addToCart = async (product_id, license_id = 'standard', silent = false) => {
    if (user) {
      try { await api.post('/cart/items', { product_id, license_id }); } catch (e) { toast.error(errMsg(e)); return false; }
    }
    setCart((c) => [...c.filter((i) => i.product_id !== product_id), { product_id, license_id }]);
    if (!silent) toast.success('Added to cart');
    return true;
  };
  const removeFromCart = async (product_id) => {
    setCart((c) => c.filter((i) => i.product_id !== product_id));
    if (user) await api.delete(`/cart/items/${product_id}`).catch(() => null);
  };
  const clearCartLocal = () => setCart([]);
  const toggleWish = async (product_id) => {
    const on = wish.includes(product_id);
    setWish((w) => (on ? w.filter((x) => x !== product_id) : [...w, product_id]));
    if (user) {
      try { on ? await api.delete(`/wishlist/${product_id}`) : await api.post('/wishlist', { product_id }); } catch (e) { toast.error(errMsg(e)); }
    }
    toast.success(on ? 'Removed from wishlist' : 'Saved to wishlist');
  };
  const value = useMemo(() => ({ cart, wish, addToCart, removeFromCart, clearCartLocal, toggleWish, inCart: (id) => cart.some((i) => i.product_id === id) }), [cart, wish, user]); // eslint-disable-line
  return <StoreCtx.Provider value={value}>{children}</StoreCtx.Provider>;
}
export const useStore = () => useContext(StoreCtx);
