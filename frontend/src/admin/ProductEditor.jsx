import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { UploadCloud, X, Plus, FileArchive, CheckCircle2, Bold, Italic, Underline, List, ListOrdered, Link2, ChevronLeft, ChevronRight, Eye, Send, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogTitle } from '../components/ui/dialog';
import { api, errMsg, imgUrl, inr } from '../lib/api';
import { Markdown, useTitle } from '../lib/hooks';
import { Spinner, StatusBadge } from '../components/common';

const LICENSE_PRESETS = ['Personal License', 'Commercial License', 'Extended License'];
const SPEC_FIELDS = [['framework', 'Framework'], ['dependencies', 'Dependencies'], ['included_files', 'Included file types'], ['documentation', 'Documentation'], ['browser_compat', 'Browser compatibility'], ['compatibility', 'Compatibility notes']];
const EMPTY = { title: '', slug: '', short_description: '', description: '', category: '', subcategory: '', tags: [], tech_stack: [], price: '', compare_price: '', licenses: [{ id: 'commercial', name: 'Commercial License', price: '' }], images: [], live_demo_url: '', demo_video_url: '', pkg: null, version: '1.0.0', changelog_note: '', specs: { responsive: true }, featured: false, new_release: true, collection_ids: [], scheduled_at: '', publish: true };
const toRs = (p) => (p === null || p === undefined ? '' : String(p / 100));
const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

function fromProduct(p) {
  return { ...EMPTY, ...p, price: toRs(p.price), compare_price: toRs(p.compare_price), licenses: p.licenses.map((l) => ({ ...l, price: toRs(l.price) })), images: p.gallery.length ? p.gallery.map((k, i) => ({ key: k, url: p.gallery_urls[i] })) : p.preview ? [{ key: p.preview, url: p.preview_url }] : [], pkg: p.package_file ? { key: p.package_key, filename: p.package_file.original_filename, size: p.package_file.file_size, checksum: p.package_file.checksum } : null, specs: { responsive: true, ...p.specs }, changelog_note: '', scheduled_at: p.scheduled_at || '', publish: p.status === 'published' };
}

function Chips({ value, onChange, placeholder, testid }) {
  const [v, setV] = useState('');
  const add = () => { const t = v.trim().replace(/,$/, ''); if (t && !value.includes(t)) onChange([...value, t]); setV(''); };
  return (
    <div className="yk-input flex flex-wrap items-center gap-1.5 !py-1.5" data-testid={testid}>
      {value.map((t) => <span key={t} className="yk-badge !py-1" style={{ background: 'var(--accent)', color: '#fff' }}>{t}<button type="button" onClick={() => onChange(value.filter((x) => x !== t))} aria-label={`Remove ${t}`}><X size={11} /></button></span>)}
      <input value={v} onChange={(e) => setV(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); add(); } }} onBlur={add} placeholder={placeholder} className="min-w-[90px] flex-1 bg-transparent py-1 text-sm outline-none" data-testid={`${testid}-input`} />
    </div>
  );
}

function MdEditor({ value, onChange }) {
  const ref = useRef(null); const [preview, setPreview] = useState(false);
  const wrap = (a, b = a, prefix = false) => {
    const el = ref.current; const s = el.selectionStart; const e = el.selectionEnd; const sel = value.slice(s, e) || 'text';
    const ins = prefix ? sel.split('\n').map((l, i) => (a === '1. ' ? `${i + 1}. ` : a) + l).join('\n') : a + sel + b;
    onChange(value.slice(0, s) + ins + value.slice(e)); setTimeout(() => el.focus(), 0);
  };
  const tools = [[Bold, () => wrap('**'), 'Bold'], [Italic, () => wrap('*'), 'Italic'], [Underline, () => wrap('__'), 'Underline'], [List, () => wrap('- ', '', true), 'Bulleted list'], [ListOrdered, () => wrap('1. ', '', true), 'Numbered list'], [Link2, () => wrap('[', '](https://)'), 'Link']];
  return (
    <div className="overflow-hidden rounded-[6px]" style={{ border: '1px solid var(--border)' }}>
      <div className="flex items-center gap-1 px-2 py-1.5" style={{ borderBottom: '1px solid var(--border)', background: 'var(--surface-2)' }}>
        {tools.map(([I, f, l]) => <button key={l} type="button" onClick={f} className="yk-btn-ghost !p-1.5" aria-label={l} data-testid={`md-${l.toLowerCase().replace(' ', '-')}`}><I size={15} /></button>)}
        <button type="button" onClick={() => setPreview(!preview)} className="yk-btn-ghost ml-auto !py-1 text-xs" data-testid="md-preview-toggle">{preview ? 'Edit' : 'Preview'}</button>
      </div>
      {preview ? <Markdown text={value || '*Nothing to preview*'} className="min-h-[130px] p-3 text-sm" /> : <textarea ref={ref} value={value} onChange={(e) => onChange(e.target.value)} className="min-h-[130px] w-full bg-[var(--surface-2)] p-3 text-sm outline-none" placeholder="Describe the template, its pages, and who it's for…" data-testid="editor-description" />}
    </div>
  );
}

function Uploader({ accept, multiple, onFiles, label, hint, testid, children }) {
  const [over, setOver] = useState(false); const ref = useRef(null);
  return (
    <div onDragOver={(e) => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)} onDrop={(e) => { e.preventDefault(); setOver(false); onFiles([...e.dataTransfer.files]); }}
      onClick={() => ref.current.click()} onKeyDown={(e) => e.key === 'Enter' && ref.current.click()} role="button" tabIndex={0}
      className="flex cursor-pointer flex-col items-center justify-center gap-1 rounded-[8px] p-4 text-center text-xs transition-colors" style={{ border: `1.5px dashed ${over ? 'var(--accent)' : 'var(--border)'}`, background: over ? 'var(--accent-soft)' : 'transparent' }} data-testid={testid}>
      <input ref={ref} type="file" hidden accept={accept} multiple={multiple} onChange={(e) => { onFiles([...e.target.files]); e.target.value = ''; }} data-testid={`${testid}-input`} />
      {children || <><Plus size={20} /><span className="font-semibold">{label}</span><span className="yk-faint">{hint}</span></>}
    </div>
  );
}

const L = ({ children, req }) => <span className="yk-label">{children}{req && <span className="req"> *</span>}</span>;
const Section = ({ title, children, compact }) => <section className={compact ? 'space-y-4' : 'yk-card space-y-4 p-5'}>{!compact && <h2 className="text-lg font-bold">{title}</h2>}{children}</section>;

export default function ProductEditor({ compact = false, onSaved }) {
  const { id: routeId } = useParams(); const nav = useNavigate();
  const [id, setId] = useState(routeId || null); const [f, setF] = useState(EMPTY); const [status, setStatus] = useState('draft'); const [loaded, setLoaded] = useState(!routeId);
  const [cats, setCats] = useState([]); const [cols, setCols] = useState([]); const [errors, setErrors] = useState({}); const [busy, setBusy] = useState(false);
  const [zipPct, setZipPct] = useState(null); const [imgBusy, setImgBusy] = useState(0); const [saved, setSaved] = useState(JSON.stringify(EMPTY)); const [savedAt, setSavedAt] = useState(null); const [showPrev, setShowPrev] = useState(false); const [files, setFiles] = useState([]);
  useTitle(compact ? null : routeId ? 'Edit template' : 'Upload template');
  const dirty = JSON.stringify(f) !== saved;
  useEffect(() => { api.get('/admin/categories').then((r) => setCats(r.data.filter((c) => c.active))); api.get('/admin/collections').then((r) => setCols(r.data)); }, []);
  useEffect(() => {
    if (!routeId) { setF(EMPTY); setSaved(JSON.stringify(EMPTY)); setId(null); setLoaded(true); return; }
    api.get(`/admin/products/${routeId}`).then((r) => { const v = fromProduct(r.data); setF(v); setSaved(JSON.stringify(v)); setStatus(r.data.status); setFiles(r.data.files); setId(routeId); setLoaded(true); }).catch(() => { toast.error('Product not found'); nav('/admin/products'); });
  }, [routeId]); // eslint-disable-line
  useEffect(() => { const h = (e) => { if (dirty) { e.preventDefault(); e.returnValue = ''; } }; window.addEventListener('beforeunload', h); return () => window.removeEventListener('beforeunload', h); }, [dirty]);
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e?.target ? (e.target.type === 'checkbox' ? e.target.checked : e.target.value) : e }));
  const setSpec = (k) => (e) => setF((x) => ({ ...x, specs: { ...x.specs, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value } }));

  const uploadImages = async (list) => {
    const ok = list.filter((fl) => /image\/(png|jpe?g|webp)/.test(fl.type) && fl.size <= 8 * 1024 * 1024);
    if (ok.length < list.length) toast.error('Some files were skipped — use JPG, PNG or WebP up to 8 MB');
    for (const fl of ok) {
      setImgBusy((n) => n + 1);
      try { const fd = new FormData(); fd.append('file', fl); const { data } = await api.post('/admin/uploads/preview', fd); setF((x) => ({ ...x, images: [...x.images, { key: data.key, url: data.url }].slice(0, 12) })); } catch (e) { toast.error(errMsg(e)); }
      setImgBusy((n) => n - 1);
    }
  };
  const uploadZip = async ([fl]) => {
    if (!fl) return;
    if (!fl.name.toLowerCase().endsWith('.zip')) { toast.error('Upload a .zip package'); return; }
    if (fl.size > 100 * 1024 * 1024) { toast.error('ZIP exceeds the 100 MB limit'); return; }
    setZipPct(0);
    try { const fd = new FormData(); fd.append('file', fl, fl.name); const { data } = await api.post('/admin/uploads/package', fd, { onUploadProgress: (e) => setZipPct(Math.round((e.loaded / (e.total || fl.size)) * 100)) }); setF((x) => ({ ...x, pkg: data })); toast.success('Package uploaded'); } catch (e) { toast.error(errMsg(e)); }
    setZipPct(null);
  };
  const move = (i, d) => setF((x) => { const a = [...x.images]; const j = i + d; if (j < 0 || j >= a.length) return x; [a[i], a[j]] = [a[j], a[i]]; return { ...x, images: a }; });

  const validate = (publish) => {
    const e = {};
    if (f.title.trim().length < 2) e.title = 'Title is required';
    if (!f.category) e.category = 'Choose a category';
    if (f.price === '' || isNaN(+f.price) || +f.price < 0) e.price = 'Enter a price (0 for free)';
    if (publish) {
      if (f.description.trim().length < 20) e.description = 'Write at least 20 characters before publishing';
      if (!f.images.length) e.images = 'Add at least one preview image (the first is the cover)';
      if (!f.pkg) e.pkg = 'Upload the source ZIP before publishing';
    }
    setErrors(e); if (Object.keys(e).length) toast.error('Please fix the highlighted fields'); return !Object.keys(e).length;
  };
  const payload = () => {
    const base = Math.round(+f.price * 100);
    const lic = compact ? [{ id: slug(f.licenses[0].name) || 'standard', name: f.licenses[0].name, price: base }] : f.licenses.filter((l) => l.name.trim()).map((l, i) => ({ id: slug(l.id || l.name) || `lic${i}`, name: l.name.trim(), price: i === 0 ? base : Math.round(+(l.price || 0) * 100) }));
    return { title: f.title, slug: f.slug, short_description: f.short_description, description: f.description, category: f.category, subcategory: f.subcategory, tags: f.tags, tech_stack: f.tech_stack, price: base, compare_price: f.compare_price ? Math.round(+f.compare_price * 100) : null, licenses: lic, preview: f.images[0]?.key || '', gallery: f.images.map((i) => i.key), live_demo_url: f.live_demo_url.trim(), demo_video_url: f.demo_video_url.trim(), package_key: f.pkg?.key || '', version: f.version || '1.0.0', changelog_note: f.changelog_note, specs: f.specs, featured: f.featured, new_release: f.new_release, collection_ids: f.collection_ids, scheduled_at: f.scheduled_at || null };
  };
  const save = async (mode) => {
    const publish = mode === 'publish';
    if (!validate(publish || mode === 'schedule')) return;
    setBusy(true);
    try {
      let { data } = id ? await api.patch(`/admin/products/${id}`, payload()) : await api.post('/admin/catalog/products', payload());
      if (publish) data = (await api.post(`/admin/products/${data.id}/publish`)).data;
      else if (mode === 'schedule') data = (await api.post(`/admin/products/${data.id}/schedule`)).data;
      toast.success(publish ? 'Published — now live on the storefront' : mode === 'schedule' ? 'Scheduled for publication' : 'Draft saved');
      setSavedAt(new Date()); onSaved?.(data);
      if (compact) { setF(EMPTY); setSaved(JSON.stringify(EMPTY)); setId(null); return; }
      const v = fromProduct(data); setF(v); setSaved(JSON.stringify(v)); setStatus(data.status); setFiles(data.files);
      if (!id) { setId(data.id); nav(`/admin/products/${data.id}`, { replace: true }); }
    } catch (e) { toast.error(errMsg(e)); }
    setBusy(false);
  };
  const statusAction = async (action) => { try { const { data } = await api.post(`/admin/products/${id}/${action}`); setStatus(data.status); toast.success(`Product ${data.status}`); } catch (e) { toast.error(errMsg(e)); } };
  if (!loaded) return <Spinner />;
  const err = (k) => errors[k] && <span className="mt-1 block text-xs" style={{ color: '#F19A8E' }} role="alert">{errors[k]}</span>;

  const basics = (
    <Section compact={compact} title="Basic information">
      <label className="block"><L req>Template title</L><input className="yk-input" value={f.title} onChange={(e) => setF((x) => ({ ...x, title: e.target.value, slug: id || x.slug !== slug(x.title) ? x.slug : slug(e.target.value) }))} placeholder="e.g. Aster — Creative Portfolio" data-testid="editor-title" />{err('title')}</label>
      {!compact && <div className="grid gap-4 sm:grid-cols-2"><label className="block"><L>URL slug</L><input className="yk-input" value={f.slug} onChange={(e) => set('slug')(slug(e.target.value))} data-testid="editor-slug" /><span className="mt-1 block text-xs yk-faint">/products/{f.slug || '…'}</span></label><label className="block"><L>Short description</L><input className="yk-input" maxLength={300} value={f.short_description} onChange={set('short_description')} data-testid="editor-short-description" /></label></div>}
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block"><L req>Category</L><select className="yk-input" value={f.category} onChange={set('category')} data-testid="editor-category"><option value="">Select…</option>{cats.map((c) => <option key={c.id}>{c.name}</option>)}</select>{err('category')}</label>
        <label className="block"><L req>Price (INR)</L><div className="flex items-center rounded-[6px]" style={{ border: '1px solid var(--border)', background: 'var(--surface-2)' }}><span className="pl-3 text-sm yk-muted">₹</span><input type="number" min="0" step="1" className="w-full bg-transparent px-2 py-2.5 text-sm outline-none" value={f.price} onChange={set('price')} placeholder="1299" data-testid="editor-price" /></div>{err('price')}</label>
      </div>
      {compact ? (
        <label className="block"><L req>License</L><select className="yk-input" value={f.licenses[0].name} onChange={(e) => setF((x) => ({ ...x, licenses: [{ ...x.licenses[0], name: e.target.value }] }))} data-testid="editor-license">{LICENSE_PRESETS.map((l) => <option key={l}>{l}</option>)}</select></label>
      ) : <div className="grid gap-4 sm:grid-cols-2"><label className="block"><L>Subcategory</L><input className="yk-input" value={f.subcategory} onChange={set('subcategory')} data-testid="editor-subcategory" /></label><label className="block"><L>Compare-at price (₹, optional)</L><input type="number" min="0" className="yk-input" value={f.compare_price} onChange={set('compare_price')} data-testid="editor-compare-price" /></label></div>}
    </Section>
  );
  const media = (
    <Section compact={compact} title="Media">
      <div><div className="flex items-baseline justify-between"><L req>Preview images</L><span className="text-[11px] yk-faint">First image is the cover · JPG/PNG/WebP up to 8 MB</span></div>
        <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-4" data-testid="editor-images">
          {f.images.map((im, i) => (
            <div key={im.key} className="group relative overflow-hidden rounded-[6px]" style={{ border: `1px solid ${i === 0 ? 'var(--accent)' : 'var(--border)'}` }} data-testid={`editor-image-${i}`}>
              <img src={imgUrl(im.url)} alt="" className="aspect-[4/3] w-full object-cover" />
              {i === 0 && <span className="yk-badge absolute left-1 top-1" style={{ background: 'var(--accent)', color: '#fff' }}>Cover</span>}
              <button type="button" onClick={() => setF((x) => ({ ...x, images: x.images.filter((_, j) => j !== i) }))} className="absolute right-1 top-1 rounded-full bg-black/60 p-1 text-white" aria-label="Remove image" data-testid={`editor-image-remove-${i}`}><X size={12} /></button>
              <div className="absolute inset-x-0 bottom-0 flex justify-between bg-black/55 p-1 text-white"><button type="button" onClick={() => move(i, -1)} aria-label="Move left" data-testid={`editor-image-left-${i}`}><ChevronLeft size={14} /></button><button type="button" onClick={() => move(i, 1)} aria-label="Move right" data-testid={`editor-image-right-${i}`}><ChevronRight size={14} /></button></div>
            </div>
          ))}
          <Uploader accept="image/png,image/jpeg,image/webp" multiple onFiles={uploadImages} label={imgBusy ? 'Uploading…' : 'Add image'} hint="Drag & drop" testid="editor-image-upload" />
        </div>{err('images')}
      </div>
      {!compact && <div className="grid gap-4 sm:grid-cols-2"><label className="block"><L>Live preview URL</L><input className="yk-input" value={f.live_demo_url} onChange={set('live_demo_url')} placeholder="https://" data-testid="editor-demo-url" /></label><label className="block"><L>Demo video URL</L><input className="yk-input" value={f.demo_video_url} onChange={set('demo_video_url')} placeholder="https://" data-testid="editor-video-url" /></label></div>}
    </Section>
  );
  const pkg = (
    <Section compact={compact} title="Product files">
      <div><L req>Template files (ZIP)</L>
        <Uploader accept=".zip,application/zip" onFiles={uploadZip} testid="editor-zip-upload">
          {zipPct !== null ? <div className="w-full"><div className="mb-1 text-sm font-semibold">Uploading… {zipPct}%</div><div className="h-1.5 w-full overflow-hidden rounded-full" style={{ background: 'var(--border)' }}><div className="h-full" style={{ width: `${zipPct}%`, background: 'var(--accent)' }} /></div></div>
            : f.pkg ? <div className="flex w-full items-center gap-3 text-left" data-testid="editor-zip-info"><FileArchive size={30} /><div className="min-w-0 flex-1"><div className="truncate text-sm font-semibold">{f.pkg.filename}</div><div className="yk-faint">{(f.pkg.size / 1024 / 1024).toFixed(2)} MB · SHA-256 {f.pkg.checksum?.slice(0, 12)}… · click to replace</div></div><CheckCircle2 size={20} color="#8FD19E" /></div>
              : <><UploadCloud size={22} /><span className="font-semibold">Drop ZIP here or click to browse</span><span className="yk-faint">Stored privately · max 100 MB</span></>}
        </Uploader>{err('pkg')}
      </div>
      {!compact && <div className="grid gap-4 sm:grid-cols-2"><label className="block"><L>Version</L><input className="yk-input" value={f.version} onChange={set('version')} data-testid="editor-version" /></label><label className="block"><L>Changelog note for this version</L><input className="yk-input" value={f.changelog_note} onChange={set('changelog_note')} data-testid="editor-changelog" /></label></div>}
      {!compact && files.length > 0 && <div className="text-xs yk-muted"><div className="mb-1 font-semibold">Version history</div>{files.map((x) => <div key={x.id}>v{x.version} · {x.original_filename} · {(x.file_size / 1024).toFixed(0)} KB · {x.created_at.slice(0, 10)}</div>)}</div>}
    </Section>
  );
  const desc = (
    <Section compact={compact} title="Description">
      <div><L req>Description</L><MdEditor value={f.description} onChange={set('description')} />{err('description')}</div>
      <div><L>Tags</L><Chips value={f.tags} onChange={set('tags')} placeholder="Add a tag…" testid="editor-tags" /></div>
      {!compact && <div><L>Technology stack</L><Chips value={f.tech_stack} onChange={set('tech_stack')} placeholder="e.g. React, Tailwind CSS" testid="editor-tech" /></div>}
    </Section>
  );
  const actions = (
    <div className="flex flex-wrap gap-3">
      <button type="button" disabled={busy} onClick={() => save('draft')} className="yk-btn-outline flex-1 !py-3" data-testid="editor-save-draft">Save draft</button>
      {!compact && <button type="button" onClick={() => setShowPrev(true)} className="yk-btn-outline !py-3" data-testid="editor-preview-listing"><Eye size={16} />Preview listing</button>}
      <button type="button" disabled={busy} onClick={() => save(compact ? (f.publish ? 'publish' : 'draft') : 'publish')} className="yk-btn flex-1 !py-3" data-testid="editor-publish"><Send size={16} />{compact && !f.publish ? 'Save draft' : 'Publish template'}</button>
    </div>
  );

  if (compact) return (
    <aside className="yk-card h-fit space-y-5 p-5" data-testid="quick-upload-panel">
      <div className="flex gap-4"><span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[8px]" style={{ background: 'var(--accent)', color: '#fff' }}><UploadCloud size={24} /></span><div><h2 className="text-2xl font-bold">Upload new template</h2><p className="text-sm yk-muted">Add a template, upload files, and publish. <Link to="/admin/upload" className="underline">Open full editor</Link></p></div></div>
      {basics}{media}{pkg}{desc}
      <fieldset><L>Publish status</L><div className="flex gap-6 text-sm">{[[true, 'Publish (live on store)'], [false, 'Save as draft']].map(([v, l]) => <label key={l} className="flex items-center gap-2"><input type="radio" checked={f.publish === v} onChange={() => setF((x) => ({ ...x, publish: v }))} className="accent-[var(--accent)]" data-testid={`quick-publish-${v}`} />{l}</label>)}</div></fieldset>
      {actions}
    </aside>
  );
  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div><Link to="/admin/products" className="text-sm yk-muted hover:underline">← Products</Link><h1 className="mt-1 text-[32px] font-extrabold" data-testid="admin-page-title">{id ? 'Edit template' : 'Upload template'}</h1>
          <div className="mt-1 flex items-center gap-3 text-xs yk-muted" data-testid="editor-save-status">{id && <StatusBadge status={status} />}{dirty ? 'Unsaved changes' : savedAt ? `Saved at ${savedAt.toLocaleTimeString()}` : id ? 'All changes saved' : 'New product'}</div></div>
        {id && <div className="flex flex-wrap gap-2">
          {status === 'published' && <a href={`/products/${f.slug}`} target="_blank" rel="noreferrer" className="yk-btn-ghost" data-testid="editor-view-live">View live</a>}
          {status === 'published' ? <button type="button" className="yk-btn-ghost" onClick={() => statusAction('unpublish')} data-testid="editor-unpublish">Unpublish</button> : null}
          {status !== 'archived' && <button type="button" className="yk-btn-ghost" onClick={() => statusAction('archive')} data-testid="editor-archive"><Trash2 size={15} />Archive</button>}
        </div>}
      </div>
      <div className="space-y-5">
        {basics}{media}{pkg}{desc}
        <Section compact={compact} title="Licenses & pricing">
          <p className="text-xs yk-muted">The first license uses the base price above. Add more tiers with their own price.</p>
          {f.licenses.map((l, i) => (
            <div key={i} className="grid grid-cols-[1fr_140px_auto] gap-2" data-testid={`editor-license-row-${i}`}>
              <input className="yk-input" value={l.name} onChange={(e) => setF((x) => ({ ...x, licenses: x.licenses.map((y, j) => (j === i ? { ...y, name: e.target.value, id: y.id && i === 0 && id ? y.id : slug(e.target.value) } : y)) }))} placeholder="License name" data-testid={`editor-license-name-${i}`} />
              <input type="number" min="0" className="yk-input" disabled={i === 0} value={i === 0 ? f.price : l.price} onChange={(e) => setF((x) => ({ ...x, licenses: x.licenses.map((y, j) => (j === i ? { ...y, price: e.target.value } : y)) }))} placeholder="₹" data-testid={`editor-license-price-${i}`} />
              <button type="button" disabled={f.licenses.length === 1} onClick={() => setF((x) => ({ ...x, licenses: x.licenses.filter((_, j) => j !== i) }))} className="yk-icon-btn" aria-label="Remove license"><X size={15} /></button>
            </div>
          ))}
          <button type="button" className="yk-btn-ghost" onClick={() => setF((x) => ({ ...x, licenses: [...x.licenses, { id: '', name: '', price: '' }] }))} data-testid="editor-add-license"><Plus size={15} />Add license tier</button>
        </Section>
        <Section compact={compact} title="Technical information">
          <div className="grid gap-4 sm:grid-cols-2">{SPEC_FIELDS.map(([k, l]) => <label key={k} className="block"><L>{l}</L><input className="yk-input" value={f.specs[k] || ''} onChange={setSpec(k)} data-testid={`editor-spec-${k}`} /></label>)}</div>
          <label className="block"><L>Installation instructions</L><textarea className="yk-input min-h-[90px]" value={f.specs.installation || ''} onChange={setSpec('installation')} data-testid="editor-spec-installation" /></label>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={f.specs.responsive !== false} onChange={setSpec('responsive')} className="accent-[var(--accent)]" data-testid="editor-spec-responsive" />Fully responsive</label>
        </Section>
        <Section compact={compact} title="Publishing">
          <div className="flex flex-wrap gap-6 text-sm">
            <label className="flex items-center gap-2"><input type="checkbox" checked={f.featured} onChange={set('featured')} className="accent-[var(--accent)]" data-testid="editor-featured" />Feature on homepage</label>
            <label className="flex items-center gap-2"><input type="checkbox" checked={f.new_release} onChange={set('new_release')} className="accent-[var(--accent)]" data-testid="editor-new-release" />Mark as new release</label>
          </div>
          {cols.length > 0 && <div><L>Collections</L><div className="flex flex-wrap gap-2">{cols.map((c) => <label key={c.id} className="yk-pill cursor-pointer" data-active={f.collection_ids.includes(c.id)}><input type="checkbox" className="sr-only" checked={f.collection_ids.includes(c.id)} onChange={(e) => setF((x) => ({ ...x, collection_ids: e.target.checked ? [...x.collection_ids, c.id] : x.collection_ids.filter((y) => y !== c.id) }))} data-testid={`editor-collection-${c.slug}`} />{c.name}</label>)}</div></div>}
          <div className="flex flex-wrap items-end gap-3"><label className="block"><L>Schedule publication (optional)</L><input type="datetime-local" className="yk-input" value={f.scheduled_at ? f.scheduled_at.slice(0, 16) : ''} onChange={(e) => set('scheduled_at')(e.target.value ? new Date(e.target.value).toISOString() : '')} data-testid="editor-schedule" /></label>{f.scheduled_at && <button type="button" disabled={busy} className="yk-btn-outline" onClick={() => save('schedule')} data-testid="editor-schedule-submit">Save & schedule</button>}</div>
        </Section>
        <div className="sticky bottom-0 z-10 -mx-1 p-1 py-4" style={{ background: 'var(--bg)' }}>{actions}</div>
      </div>
      <Dialog open={showPrev} onOpenChange={setShowPrev}>
        <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto border-[var(--border)] bg-[var(--bg)] text-[var(--text)]" data-testid="listing-preview">
          <DialogTitle className="text-2xl font-bold">{f.title || 'Untitled'}</DialogTitle>
          {f.images[0] && <img src={imgUrl(f.images[0].url)} alt="" className="aspect-[16/10] w-full rounded-[8px] object-cover" />}
          <div className="flex items-center justify-between"><span className="yk-muted">{f.category} · {f.short_description}</span><span className="font-display text-xl font-bold">{inr(Math.round(+f.price * 100) || 0)}</span></div>
          <Markdown text={f.description} className="text-sm" />
        </DialogContent>
      </Dialog>
    </div>
  );
}
