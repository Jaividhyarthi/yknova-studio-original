import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { api, errMsg, PHOTOS } from '../lib/api';
import { useAuth, isAdmin } from '../lib/store';
import { useTitle } from '../lib/hooks';

const T = {
  login: ['Welcome back', 'Sign in to access your library, orders and downloads.'],
  register: ['Create your account', 'Buy templates, keep your library, and download updates.'],
  'forgot-password': ['Reset your password', 'Enter your email and we will send a reset link if an account exists.'],
  'reset-password': ['Choose a new password', 'Use at least 10 characters.'],
  'verify-email': ['Verify your email', ''],
};

export default function Auth({ mode }) {
  const [sp] = useSearchParams(); const nav = useNavigate(); const { login, firebaseLogin, register, user, refresh } = useAuth();
  const [f, setF] = useState({ name: '', email: '', password: '' }); const [busy, setBusy] = useState(false); const [msg, setMsg] = useState(''); const [err, setErr] = useState('');
  const next = sp.get('next'); const token = sp.get('token');
  useTitle(T[mode][0]);
  useEffect(() => {
    if (mode === 'verify-email' && token) api.post('/auth/verify-email/confirm', { token }).then(() => { setMsg('Your email address is verified.'); refresh(); }).catch((e) => setErr(errMsg(e)));
  }, [mode, token]); // eslint-disable-line
  const go = (u) => nav(next && next.startsWith('/') ? next : isAdmin(u) ? '/admin' : '/account', { replace: true });
  const submit = async (e) => {
    e.preventDefault(); setErr(''); setBusy(true);
    try {
      if (mode === 'login') go(await login(f.email, f.password));
      else if (mode === 'register') { go(await register(f)); toast.success('Account created'); }
      else if (mode === 'forgot-password') setMsg((await api.post('/auth/forgot-password', { email: f.email })).data.message);
      else if (mode === 'reset-password') { await api.post('/auth/reset-password', { token, new_password: f.password }); toast.success('Password updated. Please sign in.'); nav('/login'); }
    } catch (ex) { setErr(errMsg(ex)); }
    setBusy(false);
  };
  const submitFirebase = async () => {
    setErr('');
    setBusy(true);
    try {
      const u = await firebaseLogin(f.email, f.password);
      toast.success('Signed in with Firebase');
      go(u);
    } catch (e) {
      setErr(errMsg(e));
    } finally {
      setBusy(false);
    }
  };

  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  return (
    <div className="yk-container grid gap-0 py-10 lg:grid-cols-2">
      <div className="relative hidden overflow-hidden rounded-l-[12px] lg:block">
        <img src={PHOTOS.monastery} alt="Ad Deir monastery in Petra viewed through a sandstone cave" className="h-full w-full object-cover" />
        <div className="absolute inset-x-0 bottom-0 p-8" style={{ background: 'linear-gradient(0deg, rgba(27,15,12,0.9), transparent)' }}><p className="font-display text-2xl font-bold text-[#F3E0DC]">Beautifully crafted templates.<br />Built for real projects.</p></div>
      </div>
      <div className="yk-card flex flex-col justify-center p-8 sm:p-12 lg:rounded-l-none">
        <h1 className="text-[32px] font-extrabold" data-testid="auth-title">{T[mode][0]}</h1>
        {T[mode][1] && <p className="mt-2 yk-muted">{T[mode][1]}</p>}
        {mode === 'verify-email' ? (
          <div className="mt-6 text-sm" data-testid="verify-result">{msg || err || 'Verifying…'}<div className="mt-6"><Link to={user ? '/account' : '/login'} className="yk-btn">Continue</Link></div></div>
        ) : msg ? <p className="mt-6 rounded-[8px] p-4 text-sm" style={{ background: 'var(--surface-2)' }} data-testid="auth-message">{msg}</p> : (
          <form onSubmit={submit} className="mt-8 space-y-4" data-testid={`${mode}-form`} noValidate>
            {mode === 'register' && <label className="block"><span className="yk-label">Full name</span><input className="yk-input" required minLength={2} value={f.name} onChange={set('name')} autoComplete="name" data-testid="auth-name" /></label>}
            {mode !== 'reset-password' && <label className="block"><span className="yk-label">Email address</span><input type="email" className="yk-input" required value={f.email} onChange={set('email')} autoComplete="email" data-testid="auth-email" /></label>}
            {mode !== 'forgot-password' && <label className="block"><span className="yk-label flex justify-between">Password {mode === 'login' && <Link to="/forgot-password" className="font-normal underline yk-muted" data-testid="forgot-link">Forgot password?</Link>}</span><input type="password" className="yk-input" required minLength={mode === 'login' ? 1 : 10} value={f.password} onChange={set('password')} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} data-testid="auth-password" />{mode !== 'login' && <span className="mt-1 block text-xs yk-faint">At least 10 characters.</span>}</label>}
            {err && <p className="text-sm" style={{ color: '#F19A8E' }} role="alert" data-testid="auth-error">{err}</p>}
            <button disabled={busy} className="yk-btn w-full !py-3" data-testid="auth-submit">{busy ? 'Please wait…' : { login: 'Sign in', register: 'Create account', 'forgot-password': 'Send reset link', 'reset-password': 'Update password' }[mode]}</button>
          </form>
        )}
        {mode === 'login' && !msg && (
          <button
            type="button"
            disabled={busy}
            onClick={submitFirebase}
            className="yk-btn mt-4 w-full !py-3"
            data-testid="firebase-login"
          >
            Sign in with Firebase
          </button>
        )}
        <p className="mt-6 text-sm yk-muted">
          {mode === 'login' && <>New to YKNOVA Studio? <Link to={`/register${next ? `?next=${encodeURIComponent(next)}` : ''}`} className="font-semibold underline" style={{ color: 'var(--text)' }} data-testid="goto-register">Create an account</Link></>}
          {mode === 'register' && <>Already have an account? <Link to={`/login${next ? `?next=${encodeURIComponent(next)}` : ''}`} className="font-semibold underline" style={{ color: 'var(--text)' }} data-testid="goto-login">Sign in</Link></>}
          {['forgot-password', 'reset-password'].includes(mode) && <Link to="/login" className="underline" data-testid="back-to-login">Back to sign in</Link>}
        </p>
      </div>
    </div>
  );
}
