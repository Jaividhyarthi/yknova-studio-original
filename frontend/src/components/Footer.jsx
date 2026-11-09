import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Instagram, Gem, Layers, Infinity as InfinityIcon, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { Logo } from './common';
import { api, errMsg } from '../lib/api';
import { useSettings } from '../lib/hooks';

const COLS = [
  ['Store', [['New releases', '/new'], ['Templates', '/templates'], ['Components', '/components'], ['Bundles', '/bundles'], ['All products', '/search']]],
  ['Help', [['FAQ', '/faq'], ['Licensing', '/licenses'], ['Refund policy', '/refund-policy'], ['Contact support', '/contact'], ['Terms of use', '/terms']]],
  ['About', [['YKNOVA Studio', '/about'], ['YKNOVA Technologies', '/about#technologies'], ['Privacy policy', '/privacy'], ['Contact', '/contact']]],
];

export function ValueStrip() {
  const items = [[Gem, 'Original designs', 'Crafted in-house, never resold templates.'], [Layers, 'Editable source files', 'Clean code you can adapt to any brand.'], [InfinityIcon, 'Transparent licensing', 'Clear personal and commercial terms.'], [RefreshCw, 'Version updates', 'Download new versions from your library.']];
  return (
    <div className="grid gap-6 border-y py-6 sm:grid-cols-2 lg:grid-cols-4" style={{ borderColor: 'var(--border-soft)' }}>
      {items.map(([I, t, d], i) => (
        <div key={t} className={`flex items-center gap-4 ${i ? 'lg:border-l lg:pl-6' : ''}`} style={{ borderColor: 'var(--border-soft)' }}>
          <I size={26} strokeWidth={1.5} style={{ color: 'var(--accent)' }} aria-hidden />
          <div><div className="text-sm font-semibold">{t}</div><div className="text-xs yk-muted">{d}</div></div>
        </div>
      ))}
    </div>
  );
}

export default function Footer() {
  const s = useSettings(); const [email, setEmail] = useState(''); const [consent, setConsent] = useState(false); const [busy, setBusy] = useState(false);
  const subscribe = async (e) => {
    e.preventDefault();
    if (!consent) { toast.error('Please tick the consent box to subscribe'); return; }
    setBusy(true);
    try { await api.post('/newsletter', { email, consent }); toast.success('Subscribed. Thank you!'); setEmail(''); setConsent(false); } catch (er) { toast.error(errMsg(er)); }
    setBusy(false);
  };
  return (
    <footer className="mt-16" style={{ background: 'var(--surface)', borderTop: '1px solid var(--border-soft)' }} data-testid="site-footer">
      <div className="yk-container grid gap-10 py-14 md:grid-cols-2 lg:grid-cols-[1.6fr_0.8fr_0.8fr_0.9fr_1.5fr]">
        <div>
          <Logo />
          <p className="mt-5 max-w-sm text-sm leading-relaxed yk-muted">A marketplace for original UI templates and components by YKNOVA Technologies. Thoughtfully designed, ready to use, and built for real projects.</p>
        </div>
        {COLS.map(([h, links]) => (
          <div key={h}>
            <h4 className="mb-4 text-[13px] font-bold uppercase tracking-[0.12em]" style={{ color: 'var(--rose)' }}>{h}</h4>
            <ul className="space-y-2.5">{links.map(([l, to]) => <li key={l}><Link to={to} className="text-sm hover:text-[var(--rose)]" data-testid={`footer-link-${l.toLowerCase().replace(/\s+/g, '-')}`}>{l}</Link></li>)}</ul>
          </div>
        ))}
        <div>
          <h4 className="mb-4 text-[13px] font-bold uppercase tracking-[0.12em]" style={{ color: 'var(--rose)' }}>Stay in the loop</h4>
          <p className="mb-4 text-sm yk-muted">Get notified about new templates and updates.</p>
          <form onSubmit={subscribe} className="space-y-3" data-testid="newsletter-form">
            <div className="flex gap-2">
              <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Your email address" aria-label="Email address" className="yk-input" data-testid="newsletter-email" />
              <button disabled={busy} className="yk-btn shrink-0" data-testid="newsletter-submit">Subscribe</button>
            </div>
            <label className="flex items-start gap-2 text-xs yk-muted"><input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-0.5 accent-[var(--accent)]" data-testid="newsletter-consent" />I agree to receive product emails from YKNOVA Studio. Unsubscribe anytime.</label>
          </form>
          {s.instagram_url && <a href={s.instagram_url} target="_blank" rel="noopener noreferrer" className="mt-5 inline-flex items-center gap-2 text-sm hover:text-[var(--rose)]" data-testid="footer-instagram"><Instagram size={16} />Instagram</a>}
        </div>
      </div>
      <div className="yk-container flex flex-col justify-between gap-2 border-t py-5 text-xs yk-faint sm:flex-row" style={{ borderColor: 'var(--border-soft)' }}>
        <span>© {new Date().getFullYear()} YKNOVA Technologies. All rights reserved.</span>
        <span>Prices in INR · Secure payments by Razorpay</span>
      </div>
    </footer>
  );
}
