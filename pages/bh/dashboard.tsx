import { useEffect, useState } from 'react';
import Layout from '../../components/Layout';
import { getOrders, getOrder, bhApprove, bhReject } from '../../lib/api';
import { useSession } from '../../lib/session';
import { statusBadge, fmt, fmtDate, maxDiscount } from '../../lib/utils';
import toast from 'react-hot-toast';
import {
  RefreshCw, CheckCircle, XCircle, Edit3, Loader2,
  ChevronDown, ChevronUp, ShieldAlert, Copy,
} from 'lucide-react';

export default function BHDashboard() {
  const session = useSession();
  const [orders, setOrders]        = useState<any[]>([]);
  const [loading, setLoading]      = useState(true);
  const [selected, setSelected]    = useState<any>(null);
  const [expanded, setExpanded]    = useState<number | null>(null);
  const [discountPct, setDiscount] = useState(0);
  const [remarks, setRemarks]      = useState('');
  const [acting, setActing]        = useState(false);

  // Credentials returned after approve (so BH can share with school)
  const [credsModal, setCredsModal] = useState<any>(null);

  const load = async () => {
    setLoading(true);
    try {
      const r = await getOrders({ status: 'Pending BH Approval' });
      setOrders(r.data.data || []);
    } catch { toast.error('Failed to load orders'); }
    finally  { setLoading(false); }
  };

  useEffect(() => { if (session.isReady) load(); }, [session.isReady]);

  // ── Role gate ─────────────────────────────────────────────
  if (session.isReady && session.userType && session.userType !== 'BH') {
    return (
      <Layout role="bh">
        <div className="max-w-md mx-auto mt-16 card p-10 text-center">
          <ShieldAlert size={40} className="text-amber-500 mx-auto mb-3" />
          <h2 className="font-display text-xl font-bold mb-2">Access Restricted</h2>
          <p className="text-sm text-slate-500">
            This page is for Branch Head users only.<br/>
            Your role: <strong>{session.userType}</strong>
          </p>
        </div>
      </Layout>
    );
  }

  const openDetail = async (o: any) => {
    try {
      const r = await getOrder(o.Indent_Id);
      setSelected(r.data.data);
      setDiscount(r.data.data.header.Discount_Pct || 0);
      setRemarks('');
    } catch { toast.error('Failed to load order detail'); }
  };

  const handleApprove = async () => {
    if (!selected) return;
    if (!session.userId) return toast.error('Session not ready');

    const { header, items } = selected;
    const payable = header.Indent_Amount;
    const isHighVal = payable * (1 - discountPct / 100) >= 750000;
    for (const item of items) {
      const max = maxDiscount(item.Product_Name, isHighVal);
      if (discountPct > max) {
        toast.error(`Max discount for "${item.Product_Name}" is ${max}%`);
        return;
      }
    }
    setActing(true);
    try {
      const r = await bhApprove(header.Indent_Id, {
        discount_pct: discountPct,
        user_id: session.userId,                 // ← from session, no hardcode
        remarks: remarks || 'BH Approved',
      });
      toast.success('Order approved! Franchisee credentials generated.');
      setSelected(null);
      setCredsModal(r.data.franchisee_credentials || null);  // Show creds modal
      load();
    } catch (e: any) { toast.error(e?.response?.data?.message || 'Approve failed'); }
    finally { setActing(false); }
  };

  const handleReject = async () => {
    if (!selected) return;
    if (!session.userId) return toast.error('Session not ready');
    if (!remarks.trim()) return toast.error('Please enter rejection remarks');

    setActing(true);
    try {
      await bhReject(selected.header.Indent_Id, {
        user_id: session.userId,
        remarks,
      });
      toast.success('Order rejected');
      setSelected(null);
      load();
    } catch { toast.error('Reject failed'); }
    finally { setActing(false); }
  };

  const discountedAmount = selected
    ? selected.header.Indent_Amount * (1 - discountPct / 100) : 0;

  const copy = (text: string) => navigator.clipboard.writeText(text).then(() => toast.success('Copied'));

  return (
    <Layout role="bh">
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="font-display text-2xl font-bold text-slate-800">BH Approval Desk</h1>
            <p className="text-sm text-slate-500 mt-1">
              {session.fullName ? `Welcome, ${session.fullName}` : 'Review customer enquiries and approve or reject'}
            </p>
          </div>
          <button className="btn-outline flex items-center gap-2" onClick={load}>
            <RefreshCw size={14} /> Refresh
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Pending Approval', value: orders.length, color: 'text-amber-600' },
            { label: 'Total Value', value: `₹${(orders.reduce((s,o)=>s+(o.Indent_Amount||0),0)/100000).toFixed(1)}L`, color: 'text-brand-600' },
          ].map(s => (
            <div key={s.label} className="card p-4">
              <p className="text-xs text-slate-400">{s.label}</p>
              <p className={`font-display text-xl font-bold ${s.color}`}>{s.value}</p>
            </div>
          ))}
        </div>

        {loading ? (
          <div className="card p-16 text-center text-slate-400">Loading…</div>
        ) : orders.length === 0 ? (
          <div className="card p-12 text-center text-slate-400">No pending approvals 🎉</div>
        ) : (
          <div className="space-y-2">
            {orders.map(o => {
              const { cls, label } = statusBadge(o.Indent_Status);
              const isOpen = expanded === o.Indent_Id;
              return (
                <div key={o.Indent_Id} className="card overflow-hidden">
                  <div className="flex flex-wrap gap-3 items-center p-4">
                    <div className="flex-1 min-w-0 cursor-pointer" onClick={() => setExpanded(isOpen ? null : o.Indent_Id)}>
                      <p className="font-semibold truncate">{o.Franchisee_Name}</p>
                      <p className="text-xs text-slate-400">{o.Indent_No} · {fmtDate(o.Indent_Date)} · {o.Contact_Person}</p>
                    </div>
                    <p className="font-bold text-slate-800">₹{fmt(o.Indent_Amount)}</p>
                    <span className={cls}>{label}</span>
                    <button className="btn-primary text-sm flex items-center gap-1.5" onClick={() => openDetail(o)}>
                      <Edit3 size={13} /> Review
                    </button>
                    <button onClick={() => setExpanded(isOpen ? null : o.Indent_Id)} className="text-slate-400">
                      {isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </button>
                  </div>
                  {isOpen && (
                    <div className="border-t border-slate-100 p-4 bg-slate-50/50 grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                      <div><p className="label">GST</p><p>{o.GST_No || '—'}</p></div>
                      <div><p className="label">PAN</p><p>{o.PAN_No || '—'}</p></div>
                      <div><p className="label">Aadhar</p><p>{o.Aadhar_No || '—'}</p></div>
                      <div><p className="label">Mobile</p><p>{o.Mobile_No || '—'}</p></div>
                      <div className="col-span-2 sm:col-span-4">
                        <p className="label">Address</p>
                        <p>{[o.Address1, o.Address2, o.City_Name, o.State_Name, o.Pin_Code].filter(Boolean).join(', ')}</p>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Detail Modal */}
        {selected && (
          <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && setSelected(null)}>
            <div className="modal">
              <div className="p-5 border-b border-slate-100 flex justify-between items-start sticky top-0 bg-white z-10">
                <div>
                  <h3 className="font-display text-xl font-bold">Review Order #{selected.header.Indent_Id}</h3>
                  <p className="text-sm text-slate-500">{selected.header.Franchisee_Name} · {selected.header.Contact_Person}</p>
                </div>
                <button onClick={() => setSelected(null)} className="text-slate-400 hover:text-slate-700 text-xl leading-none">✕</button>
              </div>

              <div className="p-5 space-y-5">
                <div>
                  <p className="font-semibold text-sm mb-2">Products Ordered</p>
                  <div className="rounded-xl overflow-hidden border border-slate-100">
                    <table>
                      <thead><tr><th>Product</th><th>Qty</th><th>MRP/Unit</th><th>Max Disc</th><th>Subtotal</th></tr></thead>
                      <tbody>
                        {(selected.items || []).map((item: any, i: number) => {
                          const isHighVal = discountedAmount >= 750000;
                          return (
                            <tr key={i}>
                              <td className="font-medium">{item.Product_Name}</td>
                              <td>{item.Quantity}</td>
                              <td>₹{fmt(item.Sale_Price)}</td>
                              <td><span className="badge badge-orange">{maxDiscount(item.Product_Name, isHighVal)}%</span></td>
                              <td className="font-semibold">₹{fmt(item.SubTotal)}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="bg-brand-50 rounded-xl p-4 space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-600">Order Total (MRP)</span>
                    <span className="font-bold">₹{fmt(selected.header.Indent_Amount)}</span>
                  </div>
                  {discountPct > 0 && (
                    <div className="flex justify-between text-emerald-600">
                      <span>Discount ({discountPct}%)</span>
                      <span>– ₹{fmt(selected.header.Indent_Amount * discountPct / 100)}</span>
                    </div>
                  )}
                  <div className="flex justify-between font-bold text-brand-700 border-t border-brand-200 pt-2 text-base">
                    <span>Customer Payable</span>
                    <span>₹{fmt(discountedAmount)}</span>
                  </div>
                </div>

                <div>
                  <div className="flex justify-between mb-1">
                    <label className="label">Discount Percentage</label>
                    <span className="text-brand-700 font-bold text-sm">{discountPct}%</span>
                  </div>
                  <input type="range" min={0} max={35} step={0.5}
                    value={discountPct}
                    onChange={e => setDiscount(parseFloat(e.target.value))}
                    className="w-full accent-brand-600 h-2 cursor-pointer" />
                  <div className="flex justify-between text-xs text-slate-400 mt-1"><span>0%</span><span>35%</span></div>
                </div>

                <div>
                  <label className="label">Remarks</label>
                  <textarea className="input" rows={2}
                    placeholder="Add remarks (required for rejection)…"
                    value={remarks} onChange={e => setRemarks(e.target.value)} />
                </div>

                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-800">
                  ℹ️ On approval, a Franchisee login (m_User row) and ZIN-XXXX code will be created automatically.
                  The credentials will be shown after approval so you can share them with the school.
                </div>

                <div className="flex gap-3 pt-2 border-t border-slate-100">
                  <button className="btn-primary flex-1 flex items-center justify-center gap-2"
                    disabled={acting} onClick={handleApprove}>
                    {acting ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle size={15} />}
                    Approve & Create Login
                  </button>
                  <button className="btn-danger flex-1 flex items-center justify-center gap-2"
                    disabled={acting} onClick={handleReject}>
                    <XCircle size={15} /> Reject
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Credentials modal — shown after successful approval */}
        {credsModal && (
          <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && setCredsModal(null)}>
            <div className="modal max-w-md">
              <div className="p-5 border-b border-slate-100 flex justify-between items-start">
                <div>
                  <h3 className="font-display text-lg font-bold text-emerald-700">✓ Approval Successful</h3>
                  <p className="text-xs text-slate-500">Share these login details with the franchisee</p>
                </div>
                <button onClick={() => setCredsModal(null)} className="text-slate-400 hover:text-slate-700 text-xl leading-none">✕</button>
              </div>
              <div className="p-5 space-y-3 text-sm">
                {[
                  { label: 'Franchisee Code', value: credsModal.Franchisee_Code },
                  { label: 'Login Username',  value: credsModal.User_Name },
                  { label: 'Password',        value: credsModal.User_Password },
                ].map(row => (
                  <div key={row.label} className="flex items-center gap-3 bg-slate-50 rounded-xl p-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-slate-400">{row.label}</p>
                      <p className="font-mono font-semibold text-slate-800">{row.value}</p>
                    </div>
                    <button onClick={() => copy(row.value)} className="text-brand-600 hover:text-brand-700 p-1.5">
                      <Copy size={14} />
                    </button>
                  </div>
                ))}
                <p className="text-xs text-amber-700 bg-amber-50 rounded-xl p-3 mt-2">
                  ⚠ This password is shown only once. Make sure to share it with the franchisee.
                </p>
                <button className="btn-primary w-full" onClick={() => setCredsModal(null)}>Done</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
