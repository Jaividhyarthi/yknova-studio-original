import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { MoreHorizontal, Plus, Search } from 'lucide-react';
import { toast } from 'sonner';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '../components/ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogTitle } from '../components/ui/alert-dialog';
import { api, errMsg, fmtDate, imgUrl, inr } from '../lib/api';
import { useTitle } from '../lib/hooks';
import { EmptyState, Spinner, StatusBadge } from '../components/common';
import { PageHead } from './AdminApp';

export function Confirm({ open, onOpenChange, title, text, onConfirm, label = 'Confirm' }) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="border-[var(--border)] bg-[var(--surface)] text-[var(--text)]" data-testid="confirm-dialog">
        <AlertDialogTitle>{title}</AlertDialogTitle><AlertDialogDescription className="yk-muted">{text}</AlertDialogDescription>
        <AlertDialogFooter><AlertDialogCancel className="border-[var(--border)] bg-transparent" data-testid="confirm-cancel">Cancel</AlertDialogCancel><AlertDialogAction onClick={onConfirm} className="bg-[var(--accent)] hover:bg-[var(--accent-hover)]" data-testid="confirm-ok">{label}</AlertDialogAction></AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export default function Products() {
  useTitle('Products');
  const nav = useNavigate(); const [list, setList] = useState(null); const [q, setQ] = useState(''); const [st, setSt] = useState(''); const [del, setDel] = useState(null);
  const load = () => api.get('/admin/products').then((r) => setList(r.data));
  useEffect(() => { load(); }, []);
  const act = async (p, a) => {
    try {
      if (a === 'duplicate') { const { data } = await api.post(`/admin/products/${p.id}/duplicate`); toast.success('Duplicated as draft'); nav(`/admin/products/${data.id}`); return; }
      await api.post(`/admin/products/${p.id}/${a}`); toast.success(`Product ${a === 'unpublish' ? 'moved to draft' : a + 'd'}`); load();
    } catch (e) { toast.error(errMsg(e)); }
  };
  const remove = async () => { try { await api.delete(`/admin/products/${del.id}`, { params: { permanent: true } }); toast.success('Product deleted'); load(); } catch (e) { toast.error(errMsg(e)); } setDel(null); };
  if (!list) return <Spinner />;
  const shown = list.filter((p) => (!st || p.status === st) && (!q || `${p.title} ${p.category} ${p.slug}`.toLowerCase().includes(q.toLowerCase())));
  return (
    <>
      <PageHead title="Products" sub={`${list.length} total · ${list.filter((p) => p.status === 'published').length} published`} actions={<Link to="/admin/upload" className="yk-btn" data-testid="products-new"><Plus size={16} />Upload template</Link>} />
      <div className="mb-4 flex flex-wrap gap-3">
        <label className="flex flex-1 items-center gap-2 rounded-[6px] px-3" style={{ border: '1px solid var(--border)' }}><Search size={15} /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search products" className="w-full bg-transparent py-2 text-sm outline-none" data-testid="products-search" /></label>
        <select value={st} onChange={(e) => setSt(e.target.value)} className="yk-input !w-auto" data-testid="products-status-filter"><option value="">All status</option>{['published', 'draft', 'scheduled', 'archived'].map((s) => <option key={s}>{s}</option>)}</select>
      </div>
      {!shown.length ? <EmptyState title="No products found" text="Upload a template to get started." action={<Link to="/admin/upload" className="yk-btn">Upload template</Link>} testid="products-empty" /> : (
        <div className="yk-card overflow-x-auto">
          <table className="yk-table w-full min-w-[900px]" data-testid="products-table">
            <thead><tr><th>Product</th><th>Category</th><th>Price</th><th>Status</th><th>Created</th><th>Updated</th><th>Sales</th><th /></tr></thead>
            <tbody>{shown.map((p) => (
              <tr key={p.id} data-testid={`product-row-${p.id}`}>
                <td><Link to={`/admin/products/${p.id}`} className="flex items-center gap-3 font-semibold hover:underline">{p.preview_url ? <img src={imgUrl(p.preview_url)} alt="" className="h-10 w-16 rounded-[4px] object-cover" /> : <span className="h-10 w-16 rounded-[4px]" style={{ background: 'var(--elev)' }} />}<span>{p.title}{p.is_demo && <span className="ml-2 text-[10px] yk-faint">DEMO</span>}</span></Link></td>
                <td>{p.category}</td><td>{inr(p.price)}</td><td><StatusBadge status={p.status} /></td><td>{fmtDate(p.created_at)}</td><td>{fmtDate(p.updated_at)}</td><td>{p.sales}</td>
                <td>
                  <DropdownMenu><DropdownMenuTrigger className="yk-icon-btn !h-8 !w-8" aria-label="Actions" data-testid={`product-actions-${p.id}`}><MoreHorizontal size={16} /></DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="border-[var(--border)] bg-[var(--surface)] text-[var(--text)]">
                      {p.status === 'published' && <DropdownMenuItem onClick={() => window.open(`/products/${p.slug}`, '_blank')} data-testid={`action-view-${p.id}`}>View on store</DropdownMenuItem>}
                      <DropdownMenuItem onClick={() => nav(`/admin/products/${p.id}`)} data-testid={`action-edit-${p.id}`}>Edit</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => act(p, 'duplicate')} data-testid={`action-duplicate-${p.id}`}>Duplicate</DropdownMenuItem>
                      {p.status !== 'published' ? <DropdownMenuItem onClick={() => act(p, 'publish')} data-testid={`action-publish-${p.id}`}>Publish</DropdownMenuItem> : <DropdownMenuItem onClick={() => act(p, 'unpublish')} data-testid={`action-unpublish-${p.id}`}>Unpublish</DropdownMenuItem>}
                      {p.status !== 'archived' && <DropdownMenuItem onClick={() => act(p, 'archive')} data-testid={`action-archive-${p.id}`}>Archive</DropdownMenuItem>}
                      <DropdownMenuSeparator className="bg-[var(--border-soft)]" />
                      <DropdownMenuItem onClick={() => setDel(p)} className="text-[#F19A8E]" data-testid={`action-delete-${p.id}`}>Delete permanently</DropdownMenuItem>
                    </DropdownMenuContent></DropdownMenu>
                </td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}
      <Confirm open={!!del} onOpenChange={(o) => !o && setDel(null)} title={`Delete “${del?.title}”?`} text="This permanently removes the product. Products with orders or customer entitlements cannot be deleted — archive them instead." onConfirm={remove} label="Delete" />
    </>
  );
}
