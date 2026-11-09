import { useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '../components/ui/accordion';
import { api, errMsg } from '../lib/api';
import { useAuth } from '../lib/store';
import { useSettings, useTitle } from '../lib/hooks';

const FAQ = [
  ['What do I receive after purchase?', 'A ZIP package with the full, editable source files of the product, available in My Library. You can download it again at any time while your license is active.'],
  ['Which payment methods are supported?', 'UPI, credit and debit cards, net banking and supported wallets through Razorpay’s secure checkout. Prices are in Indian Rupees (INR).'],
  ['When are files unlocked?', 'Only after our server verifies the payment with Razorpay. If a payment fails or is cancelled, no files are unlocked and your cart is kept.'],
  ['Do I get updates?', 'When a new version of a product is published, it appears in your library and you can download it according to your license.'],
  ['Can I use a template for client work?', 'Yes, with the Commercial license. The Personal license covers your own non-commercial projects. See the Licensing page for details.'],
  ['How do refunds work?', 'Because digital files are delivered instantly, refunds are handled case by case. Please read the Refund Policy and contact support.'],
];

const PAGES = {
  about: ['About YKNOVA Studio', <>
    <p>YKNOVA Studio is the digital product marketplace of YKNOVA Technologies. We design and build original website templates, dashboards, portfolio themes and interface components for developers, designers, freelancers, agencies and growing businesses.</p>
    <p>Every product is designed in-house, delivered with editable source files, and sold with clear licensing.</p>
    <h2 id="technologies">YKNOVA Technologies</h2><p>YKNOVA Technologies is the parent company behind YKNOVA Studio, focused on crafting dependable digital products for real projects.</p></>],
  licenses: ['Licensing', <>
    <h2>Personal license</h2><p>Use the product in one personal, non-commercial project. You may modify the source code freely. Redistribution or resale of the source files is not permitted.</p>
    <h2>Commercial license</h2><p>Use the product in commercial projects, including client work and products you sell, for one end product per license. Redistribution or resale of the template itself, as-is or modified, is not permitted.</p>
    <h2>Free products</h2><p>Free products are licensed for personal and commercial use unless the product page states otherwise. Attribution is appreciated but not required.</p></>],
  terms: ['Terms of use', <>
    <p>By using YKNOVA Studio you agree to these terms. Products are digital goods licensed, not sold; ownership of the underlying intellectual property remains with YKNOVA Technologies.</p>
    <p>You are responsible for keeping your account credentials secure. We may suspend accounts that abuse the service, attempt to circumvent licensing, or share paid files publicly.</p>
    <p>Products are provided “as is”. We work to keep them accurate and compatible but cannot guarantee fitness for every purpose.</p></>],
  privacy: ['Privacy policy', <>
    <p>We collect the information needed to run your account and deliver purchases: your name, email, billing details you enter at checkout, order history and download history.</p>
    <p>Payment details (card numbers, UPI IDs, bank credentials) are entered directly in Razorpay’s checkout. We never receive or store them.</p>
    <p>Newsletter emails are sent only with your consent, and you can unsubscribe at any time. To request access to or deletion of your data, contact support or use the account deletion request in your Security settings.</p></>],
  'refund-policy': ['Refund policy', <>
    <p>Because products are delivered digitally and instantly, purchases are generally non-refundable once downloaded.</p>
    <p>We will issue a refund if a product is materially different from its description, the files are corrupted and we cannot provide a working replacement, or you were charged twice for the same product.</p>
    <p>Contact support within 14 days of purchase with your order number. Approved refunds are returned to the original payment method through Razorpay; refunded orders lose access to the product’s downloads.</p></>],
  'access-denied': ['Access denied', <p>You don’t have permission to view this page. If you think this is a mistake, sign in with the correct account or contact support.</p>],
  'server-error': ['Something went wrong', <p>We could not complete that request. Please try again in a moment. If the problem continues, contact support.</p>],
  'not-found': ['Page not found', <p>The page you are looking for does not exist or has moved.</p>],
};

function Contact() {
  const { user } = useAuth(); const s = useSettings();
  const [f, setF] = useState({ name: '', email: '', subject: '', message: '' }); const [busy, setBusy] = useState(false); const [done, setDone] = useState(false);
  const submit = async (e) => {
    e.preventDefault(); setBusy(true);
    try { await api.post('/support', { ...f, email: user ? undefined : f.email }); setDone(true); toast.success('Message sent'); } catch (er) { toast.error(errMsg(er)); }
    setBusy(false);
  };
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  if (done) return <p className="yk-card p-6" data-testid="contact-success">Thanks — your message has been received. We reply by email{s.support_hours ? ` (${s.support_hours})` : ''}.</p>;
  return (
    <form onSubmit={submit} className="yk-card grid gap-4 p-6 sm:grid-cols-2" data-testid="contact-form">
      {!user && <><label><span className="yk-label">Name</span><input className="yk-input" required value={f.name} onChange={set('name')} data-testid="contact-name" /></label>
        <label><span className="yk-label">Email</span><input type="email" className="yk-input" required value={f.email} onChange={set('email')} data-testid="contact-email" /></label></>}
      <label className="sm:col-span-2"><span className="yk-label">Subject</span><input className="yk-input" required minLength={3} value={f.subject} onChange={set('subject')} data-testid="contact-subject" /></label>
      <label className="sm:col-span-2"><span className="yk-label">Message</span><textarea className="yk-input min-h-[140px]" required minLength={10} value={f.message} onChange={set('message')} data-testid="contact-message" /></label>
      <div className="sm:col-span-2"><button disabled={busy} className="yk-btn" data-testid="contact-submit">{busy ? 'Sending…' : 'Send message'}</button>{s.contact_email && <span className="ml-4 text-sm yk-muted">or email {s.contact_email}</span>}</div>
    </form>
  );
}

export default function Info({ page }) {
  const title = page === 'faq' ? 'Frequently asked questions' : page === 'contact' ? 'Contact & support' : PAGES[page][0];
  useTitle(title);
  return (
    <div className="yk-container max-w-3xl py-14" data-testid={`page-${page}`}>
      {page === 'not-found' && <p className="yk-eyebrow mb-2">Error 404</p>}
      <h1 className="mb-6 text-[36px] font-extrabold">{title}</h1>
      {page === 'faq' ? (
        <Accordion type="single" collapsible className="yk-card px-5">{FAQ.map(([q, a], i) => <AccordionItem key={q} value={`q${i}`} className="border-[var(--border-soft)]"><AccordionTrigger className="text-left font-semibold" data-testid={`faq-q-${i}`}>{q}</AccordionTrigger><AccordionContent className="yk-muted">{a}</AccordionContent></AccordionItem>)}</Accordion>
      ) : page === 'contact' ? <Contact /> : <div className="space-y-4 leading-relaxed yk-muted [&_h2]:mt-8 [&_h2]:text-xl [&_h2]:font-bold [&_h2]:text-[var(--text)]">{PAGES[page][1]}</div>}
      {['not-found', 'access-denied', 'server-error'].includes(page) && <div className="mt-8 flex gap-3"><Link to="/" className="yk-btn" data-testid="error-home">Back to the store</Link><Link to="/contact" className="yk-btn-outline">Contact support</Link></div>}
    </div>
  );
}
