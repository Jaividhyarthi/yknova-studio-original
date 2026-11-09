import axios from 'axios';

export const BACKEND = process.env.REACT_APP_BACKEND_URL;
export const api = axios.create({ baseURL: `${BACKEND}/api` });
const TOKEN_KEY = 'yk_token';
export const getToken = () => localStorage.getItem(TOKEN_KEY);
export const setToken = (t) => (t ? localStorage.setItem(TOKEN_KEY, t) : localStorage.removeItem(TOKEN_KEY));

api.interceptors.request.use((cfg) => {
  const t = getToken();
  if (t) cfg.headers.Authorization = `Bearer ${t}`;
  return cfg;
});

export const errMsg = (e, fallback = 'Something went wrong') => {
  const d = e?.response?.data?.detail;
  if (Array.isArray(d)) return d.map((x) => `${x.loc?.slice(-1)[0] || ''}: ${x.msg}`).join(', ');
  return d || e?.message || fallback;
};

export const inr = (paise, { free = true } = {}) => {
  if (paise === 0 && free) return 'Free';
  const v = (paise || 0) / 100;
  return '₹' + v.toLocaleString('en-IN', { minimumFractionDigits: v % 1 ? 2 : 0, maximumFractionDigits: 2 });
};
export const imgUrl = (u) => (!u ? '' : u.startsWith('http') ? u : `${BACKEND}${u}`);
export const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—');
export const orderNo = (id) => 'YK-' + (id || '').slice(0, 8).toUpperCase();

export const PHOTOS = {
  treasury: 'https://images.unsplash.com/photo-1615811648503-479d06197ff3?auto=format&fit=crop&w=1600&q=75',
  siq: 'https://images.unsplash.com/photo-1580834341580-8c17a3a630ca?auto=format&fit=crop&w=1400&q=75',
  camel: 'https://images.unsplash.com/photo-1579606032821-4e6161c81bd3?auto=format&fit=crop&w=800&q=70',
  monastery: 'https://images.unsplash.com/photo-1554357475-accb8a88a330?auto=format&fit=crop&w=1000&q=70',
};

export async function openAuthed(path, filename) {
  const res = await api.get(path, { responseType: 'blob' });
  const url = URL.createObjectURL(res.data);
  if (filename) {
    const a = document.createElement('a');
    a.href = url; a.download = filename; a.click();
  } else window.open(url, '_blank', 'noopener');
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}

export async function downloadProduct(productId) {
  const { data } = await api.get(`/library/${productId}/download-link`);
  window.location.href = `${BACKEND}${data.url}`;
}
