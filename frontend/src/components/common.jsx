import { Link } from 'react-router-dom';
import { PackageOpen } from 'lucide-react';

export function Logo({ to = '/', small = false }) {
  return (
    <Link to={to} className="flex items-center gap-3" data-testid="brand-logo">
      <span className={`flex items-center justify-center rounded-[6px] font-display font-extrabold ${small ? 'h-9 w-9 text-lg' : 'h-10 w-10 text-xl'}`} style={{ border: '1.5px solid var(--text)', color: 'var(--text)' }}>Y</span>
      <span className="leading-none">
        <span className="block font-display text-[17px] font-extrabold tracking-[0.14em]" style={{ color: 'var(--text)' }}>YKNOVA <span style={{ color: 'var(--rose)', fontWeight: 600 }}>STUDIO</span></span>
        <span className="mt-1 block text-[8.5px] font-semibold tracking-[0.2em] yk-muted">BY YKNOVA TECHNOLOGIES</span>
      </span>
    </Link>
  );
}

export function EmptyState({ icon: Icon = PackageOpen, title, text, action, testid = 'empty-state' }) {
  return (
    <div className="yk-card flex flex-col items-center px-6 py-14 text-center" data-testid={testid}>
      <span className="mb-4 flex h-12 w-12 items-center justify-center rounded-[8px]" style={{ background: 'var(--accent-soft)', color: 'var(--rose)' }}><Icon size={22} /></span>
      <h3 className="text-lg font-bold">{title}</h3>
      {text && <p className="mt-2 max-w-md text-sm yk-muted">{text}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function Spinner({ label = 'Loading' }) {
  return (
    <div className="flex items-center justify-center gap-3 py-16 text-sm yk-muted" role="status" data-testid="loading-state">
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />{label}…
    </div>
  );
}

const STATUS = {
  paid: ['#1F3B2A', '#8FD19E', 'Completed'], published: ['#1F3B2A', '#8FD19E', 'Published'], active: ['#1F3B2A', '#8FD19E', 'Active'], closed: ['#2F2A28', '#BDB1AD', 'Closed'],
  pending: ['#3D311A', '#F2C46B', 'Pending'], authorized: ['#3D311A', '#F2C46B', 'Authorized'], scheduled: ['#3D311A', '#F2C46B', 'Scheduled'], open: ['#3D311A', '#F2C46B', 'Open'], in_progress: ['#1E2D45', '#8DB4F7', 'In progress'],
  draft: ['#33292A', '#C9B9B4', 'Draft'], archived: ['#33292A', '#C9B9B4', 'Archived'], suspended: ['#4A1E1A', '#F19A8E', 'Suspended'],
  failed: ['#4A1E1A', '#F19A8E', 'Failed'], canceled: ['#4A1E1A', '#F19A8E', 'Canceled'], refunded: ['#4A1E1A', '#F19A8E', 'Refunded'], partially_refunded: ['#4A1E1A', '#F19A8E', 'Part. refunded'],
};
export function StatusBadge({ status }) {
  const [bg, fg, label] = STATUS[status] || ['#33292A', '#C9B9B4', status];
  return <span className="yk-badge" style={{ background: bg, color: fg }} data-testid={`status-${status}`}>{label}</span>;
}

export function SectionHead({ title, link, linkLabel, testid }) {
  return (
    <div className="mb-5 flex items-end justify-between gap-4">
      <h2 className="text-2xl font-bold sm:text-[28px]">{title}</h2>
      {link && <Link to={link} className="yk-link shrink-0" data-testid={testid}>{linkLabel} <span aria-hidden>→</span></Link>}
    </div>
  );
}
