export function statusBadge(status?: string) {
  const map: Record<string, string> = {
    'Pending BH Approval':  'badge badge-yellow',
    'BH Rejected':          'badge badge-red',
    'Pending Fin Clearing': 'badge badge-purple',
    'Finance Rejected':     'badge badge-red',
    'Pending Dispatch':     'badge badge-blue',
    'Dispatched':           'badge badge-blue',
    'Delivered':            'badge badge-teal',
    'Received':             'badge badge-green',
    'HO Cleared':           'badge badge-teal',
  };
  return { cls: map[status || ''] || 'badge badge-yellow', label: status || 'Pending' };
}

export function fmt(n?: number | null) {
  return (n ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function fmtDate(d?: string | null) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function maxDiscount(productName: string, isHighValue: boolean): number {
  const n = (productName || '').toLowerCase();
  if (n.includes('robot')) return isHighValue ? 20 : 25;
  return isHighValue ? 28 : 33; // olympiad
}
