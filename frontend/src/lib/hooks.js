import { useEffect, useState } from 'react';
import { api } from './api';

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const inline = (s) => esc(s)
  .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
  .replace(/__(.+?)__/g, '<u>$1</u>')
  .replace(/\*(.+?)\*/g, '<em>$1</em>')
  .replace(/\[([^\]]+)\]\((https:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer nofollow">$1</a>');

// Safe minimal markdown: escapes all HTML first, then applies a fixed set of transforms.
export function renderMarkdown(src = '') {
  const out = []; let list = null;
  for (const line of src.split('\n')) {
    const ul = line.match(/^\s*[-*]\s+(.*)/); const ol = line.match(/^\s*\d+\.\s+(.*)/);
    const kind = ul ? 'ul' : ol ? 'ol' : null;
    if (list && list.kind !== kind) { out.push(`<${list.kind}>${list.items.join('')}</${list.kind}>`); list = null; }
    if (kind) { list = list || { kind, items: [] }; list.items.push(`<li>${inline((ul || ol)[1])}</li>`); continue; }
    if (line.trim()) out.push(`<p>${inline(line)}</p>`);
  }
  if (list) out.push(`<${list.kind}>${list.items.join('')}</${list.kind}>`);
  return out.join('');
}

export function Markdown({ text, className = '' }) {
  return <div className={`yk-md ${className}`} dangerouslySetInnerHTML={{ __html: renderMarkdown(text) }} />;
}

export function useTitle(title, description) {
  useEffect(() => {
    document.title = title ? `${title} · YKNOVA Studio` : 'YKNOVA Studio — Original UI templates & components';
    if (description) document.querySelector('meta[name="description"]')?.setAttribute('content', description);
  }, [title, description]);
}

let settingsCache = null; let healthCache = null;
export function useSettings() {
  const [s, setS] = useState(settingsCache);
  useEffect(() => { if (!settingsCache) api.get('/settings/public').then((r) => { settingsCache = r.data; setS(r.data); }).catch(() => {}); }, []);
  return s || {};
}
export function useHealth() {
  const [h, setH] = useState(healthCache);
  useEffect(() => { api.get('/health').then((r) => { healthCache = r.data; setH(r.data); }).catch(() => {}); }, []);
  return h;
}
export function useCategories() {
  const [c, setC] = useState([]);
  useEffect(() => { api.get('/categories').then((r) => setC(r.data)).catch(() => {}); }, []);
  return c;
}
