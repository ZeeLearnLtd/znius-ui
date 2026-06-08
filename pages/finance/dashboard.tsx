import { useEffect, useState } from 'react';
import Layout from '../../components/Layout';
import {
  getOrders, getOrder, financeConfirm, financeReject,
  loanApprove, loanReject,
} from '../../lib/api';
import { useSession } from '../../lib/session';
import { statusBadge, fmt, fmtDate } from '../../lib/utils';
import toast from 'react-hot-toast';
import {
  RefreshCw, CheckCircle, XCircle, Eye, Loader2, Info, ShieldAlert,
  CreditCard, Landmark, Hourglass,
} from 'lucide-react';

const FINANCE_STATUSES = ['Pending Fin Clearing', 'Pending Dispatch', 'HO Cleared'];

// Small helper — what's the action state for an order?
function paymentBadge(o: any) {
  if (!o.Payment_Type)
    return { cls: 'bg-slate-100 text-slate-600', label: 'Awaiting Choice' };
  if (o.Payment_Type === 'FULL')
    return { cls: 'bg-blue-100 text-blue-700',   label: 'Full Payment' };
  if (o.Payment_Type === 'LOAN' && o.Loan_Status === 'PENDING')
    return { cls: 'bg-amber-100 text-amber-700', label: 'Loan: Pending' };
  if (o.Payment_Type === 'LOAN' && o.Loan_Status === 'APPROVED')
    return { cls: 'bg-emerald-100 text-emerald-700', label: 'Loan: Approved (20%)' };
  if (o.Payment_Type === 'LOAN' && o.Loan_Status === 'REJECTED')
    return { cls: 'bg-red-100 text-red-700',     label: 'Loan: Rejected (Full)' };
  return { cls: 'bg-slate-100 text-slate-600',  label: o.Payment_Type };
}

export default function FinanceDashboard() {
  const session = useSession();
  const [orders, setOrders]         = useState<any[]>([]);
  const [loading, setLoading]       = useState(true);
  const [selected, setSelected]     = useState<any>(null);
  const [rejRemarks, setRejRemarks] = useState('');
  const [loanRemarks, setLoanRemarks] = useState('');
  const [acting, setActing]         = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const r = await getOrders();
      const all = (r.data.data || []) as any[];
      setOrders(all.filter(o => FINANCE_STATUSES.includes(o.Indent_Status)));
    } catch { toast.error('Failed to load'); }
    finally  { setLoading(false); }
  };

  useEffect(() => { if (session.isReady) load(); }, [session.isReady]);

  // Role gate
  if (session.isReady && session.userType && session.userType !== 'ACC') {
    return (
      <Layout role="finance">
        <div className="max-w-md mx-auto mt-16 card p-10 text-center">
          <ShieldAlert size={40} className="text-amber-500 mx-auto mb-3" />
          <h2 className="font-display text-xl font-bold mb-2">Access Restricted</h2>
          <p className="text-sm text-slate-500">
            This page is for Accounts (ACC) users only.<br/>
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
      setRejRemarks('');
      setLoanRemarks('');
    } catch { toast.error('Failed to load detail'); }
  };

  const confirmPayment = async () => {
    if (!selected || !session.userId) return;
    setActing(true);
    try {
      await financeConfirm(selected.header.Indent_Id, {
        user_id: session.userId,
        remarks: 'Finance Confirmed (Manual)',
      });
      toast.success('Payment confirmed');
      setSelected(null);
      load();
    } catch { toast.error('Confirmation failed'); }
    finally { setActing(false); }
  };

  const rejectPayment = async () => {
    if (!selected || !session.userId) return;
    if (!rejRemarks.trim()) return toast.error('Please enter rejection remarks');
    setActing(true);
    try {
      await financeReject(selected.header.Indent_Id, {
        user_id: session.userId,
        remarks: rejRemarks,
      });
      toast.success('Payment rejected — sent back');
      setSelected(null);
      load();
    } catch { toast.error('Reject failed'); }
    finally { setActing(false); }
  };

  const approveLoan = async () => {
    if (!selected || !session.userId) return;
    setActing(true);
    try {
      await loanApprove(selected.header.Indent_Id, {
        user_id: session.userId,
        remarks: loanRemarks.trim() || 'Loan Approved — customer to pay 20% down',
      });
      toast.success('Loan approved');
      setSelected(null);
      load();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Loan approval failed');
    } finally { setActing(false); }
  };

  const rejectLoan = async () => {
    if (!selected || !session.userId) return;
    if (!loanRemarks.trim()) return toast.error('Please enter loan rejection remarks');
    setActing(true);
    try {
      await loanReject(selected.header.Indent_Id, {
        user_id: session.userId,
        remarks: loanRemarks,
      });
      toast.success('Loan rejected — customer must pay full amount');
      setSelected(null);
      load();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Loan rejection failed');
    } finally { setActing(false); }
  };

  const statCount = (s: string) => orders.filter(o => o.Indent_Status === s).length;
  const loanPendingCount = orders.filter(
    o => o.Payment_Type === 'LOAN' && o.Loan_Status === 'PENDING'
  ).length;

  // What kind of action is allowed?
  const actionMode = (h: any): 'NONE' | 'LOAN_REVIEW' | 'PAYMENT' => {
    if (h.Indent_Status !== 'Pending Fin Clearing') return 'NONE';
    if (!h.Payment_Type) return 'NONE';
    if (h.Payment_Type === 'LOAN' && h.Loan_Status === 'PENDING') return 'LOAN_REVIEW';
    return 'PAYMENT';   // FULL, LOAN-APPROVED, LOAN-REJECTED
  };

  return (
    <Layout role="finance">
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="font-display text-2xl font-bold text-slate-800">Finance Confirmation Desk</h1>
            <p className="text-sm text-slate-500 mt-1">
              {session.fullName ? `Welcome, ${session.fullName}` : 'Monitor payments and clear orders'}
            </p>
          </div>
          <button className="btn-outline flex items-center gap-2" onClick={load}>
            <RefreshCw size={14} /> Refresh
          </button>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex gap-3 text-sm text-blue-800">
          <Info size={16} className="flex-shrink-0 mt-0.5 text-blue-500" />
          <div>
            <p className="font-semibold mb-1">Two action types on this desk</p>
            <p className="text-blue-700 text-xs">
              <strong>Loan Review</strong> — for orders where the customer applied for financing.
              Approve to require 20% down payment, or reject to require full payment.
              <br/>
              <strong>Payment Confirmation</strong> — manual confirmation when virtual-account
              auto-match has not picked up the payment.
            </p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="card p-4">
            <p className="label">Total</p>
            <p className="font-display text-xl font-bold text-brand-600">{orders.length}</p>
          </div>
          <div className="card p-4">
            <p className="label">Pending Fin Clear</p>
            <p className="font-display text-xl font-bold text-purple-600">{statCount('Pending Fin Clearing')}</p>
          </div>
          <div className="card p-4">
            <p className="label">Loan Reviews</p>
            <p className="font-display text-xl font-bold text-amber-600">{loanPendingCount}</p>
          </div>
          <div className="card p-4">
            <p className="label">Total Value</p>
            <p className="font-display text-xl font-bold text-emerald-600">
              ₹{(orders.reduce((s, o) => s + (o.Payable_Amount || o.Indent_Amount || 0), 0) / 100000).toFixed(1)}L
            </p>
          </div>
        </div>

        {/* Table */}
        {loading ? (
          <div className="card p-16 text-center text-slate-400">Loading…</div>
        ) : orders.length === 0 ? (
          <div className="card p-12 text-center text-slate-400">No orders on finance desk</div>
        ) : (
          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table>
                <thead>
                  <tr>
                    <th>Order #</th>
                    <th>School</th>
                    <th>Date</th>
                    <th>MRP Total</th>
                    <th>Payable</th>
                    <th>Payment Choice</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map(o => {
                    const { cls, label } = statusBadge(o.Indent_Status);
                    const pb              = paymentBadge(o);
                    const payable         = o.Payable_Amount || o.Indent_Amount;
                    const mode            = actionMode(o);

                    return (
                      <tr key={o.Indent_Id}>
                        <td className="font-mono text-brand-600 font-semibold">
                          {o.Indent_No || `#${o.Indent_Id}`}
                        </td>
                        <td>
                          <p className="font-medium">{o.Franchisee_Name}</p>
                          <p className="text-xs text-slate-400">{o.Contact_Person}</p>
                        </td>
                        <td className="text-slate-500">{fmtDate(o.Indent_Date)}</td>
                        <td>₹{fmt(o.Indent_Amount)}</td>
                        <td className="font-bold text-brand-700">₹{fmt(payable)}</td>
                        <td>
                          <span className={`text-xs px-2 py-1 rounded-full font-medium ${pb.cls}`}>
                            {pb.label}
                          </span>
                        </td>
                        <td><span className={cls}>{label}</span></td>
                        <td>
                          <div className="flex gap-2 flex-wrap">
                            <button
                              className="btn-ghost text-xs px-3 py-1.5 flex items-center gap-1"
                              onClick={() => openDetail(o)}>
                              <Eye size={12} /> Details
                            </button>
                            {mode === 'LOAN_REVIEW' && (
                              <button
                                className="text-xs px-3 py-1.5 flex items-center gap-1 rounded-lg bg-amber-500 text-white hover:bg-amber-600"
                                onClick={() => openDetail(o)}>
                                <CreditCard size={12} /> Review Loan
                              </button>
                            )}
                            {mode === 'PAYMENT' && (
                              <button
                                className="btn-primary text-xs px-3 py-1.5 flex items-center gap-1"
                                onClick={() => openDetail(o)}>
                                <CheckCircle size={12} /> Manual Confirm
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Detail Modal */}
        {selected && (() => {
          const h    = selected.header;
          const mode = actionMode(h);
          const pb   = paymentBadge(h);
          const expected = h.Expected_Payment_Amount;

          return (
            <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && setSelected(null)}>
              <div className="modal">
                <div className="p-5 border-b border-slate-100 flex justify-between items-start sticky top-0 bg-white z-10">
                  <div>
                    <h3 className="font-display text-xl font-bold">Order #{h.Indent_Id}</h3>
                    <p className="text-sm text-slate-500">{h.Franchisee_Name}</p>
                  </div>
                  <button onClick={() => setSelected(null)}
                    className="text-slate-400 hover:text-slate-700 text-xl leading-none">✕</button>
                </div>

                <div className="p-5 space-y-5">
                  {/* Order summary */}
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div><p className="label">Order Date</p><p>{fmtDate(h.Indent_Date)}</p></div>
                    <div>
                      <p className="label">Status</p>
                      <span className={statusBadge(h.Indent_Status).cls}>{h.Indent_Status}</span>
                    </div>
                    <div><p className="label">MRP Total</p><p className="font-bold">₹{fmt(h.Indent_Amount)}</p></div>
                    <div>
                      <p className="label">Payable (after disc)</p>
                      <p className="font-bold text-brand-700">₹{fmt(h.Payable_Amount || h.Indent_Amount)}</p>
                    </div>
                    {h.Discount_Pct > 0 && (
                      <div>
                        <p className="label">Discount</p>
                        <p className="text-emerald-600 font-semibold">{h.Discount_Pct}%</p>
                      </div>
                    )}
                    <div>
                      <p className="label">Payment Choice</p>
                      <span className={`text-xs px-2 py-1 rounded-full font-medium ${pb.cls}`}>{pb.label}</span>
                    </div>
                    <div><p className="label">GST</p><p>{h.GST_No || '—'}</p></div>
                    <div><p className="label">PAN</p><p>{h.PAN_No || '—'}</p></div>
                    <div><p className="label">Aadhar</p><p>{h.Aadhar_No || '—'}</p></div>
                    <div className="col-span-2">
                      <p className="label">Address</p>
                      <p>{[h.Address1, h.Address2, h.City_Name, h.State_Name, h.Pin_Code]
                          .filter(Boolean).join(', ')}</p>
                    </div>
                  </div>

                  {/* ─── Loan breakdown (if applicable) ─────────────────── */}
                  {h.Payment_Type === 'LOAN' && (
                    <div className="bg-violet-50 border-2 border-violet-200 rounded-2xl p-4 space-y-3">
                      <div className="flex items-center gap-2">
                        <CreditCard size={18} className="text-violet-600" />
                        <p className="font-semibold text-violet-900">Financing Breakdown</p>
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        <div className="bg-white rounded-xl p-3 border border-violet-100">
                          <p className="text-xs text-slate-400 mb-1">Total Payable</p>
                          <p className="font-bold text-slate-800">₹{fmt(h.PC_Total_Amount)}</p>
                        </div>
                        <div className="bg-white rounded-xl p-3 border border-violet-100">
                          <p className="text-xs text-emerald-600 mb-1">Down (20%)</p>
                          <p className="font-bold text-emerald-700">₹{fmt(h.PC_Down_Payment)}</p>
                        </div>
                        <div className="bg-white rounded-xl p-3 border border-violet-100">
                          <p className="text-xs text-violet-600 mb-1">Finance (80%)</p>
                          <p className="font-bold text-violet-700">₹{fmt(h.PC_Finance_Amount)}</p>
                        </div>
                      </div>
                      {h.Loan_Remarks && (
                        <div className="bg-white rounded-xl p-3 border border-violet-100 text-xs">
                          <p className="text-slate-400 mb-1">Action Remarks</p>
                          <p className="text-slate-700 italic">"{h.Loan_Remarks}"</p>
                          {h.Loan_Action_Date && (
                            <p className="text-slate-400 mt-1">on {h.Loan_Action_Date}</p>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {/* ─── Expected payment amount ──────────────────────── */}
                  {expected !== null && expected !== undefined && expected > 0 && (
                    <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 flex items-center justify-between">
                      <span className="text-sm font-semibold text-emerald-800">
                        Expected Payment from Customer
                      </span>
                      <span className="text-xl font-bold text-emerald-700">₹{fmt(expected)}</span>
                    </div>
                  )}

                  {/* ═══════════════════════════════════════════════════════
                       ACTION BLOCKS — based on mode
                     ═══════════════════════════════════════════════════════ */}

                  {/* ─── Mode: NONE — awaiting customer choice ─────────── */}
                  {mode === 'NONE' && h.Indent_Status === 'Pending Fin Clearing' && !h.Payment_Type && (
                    <div className="flex items-center gap-2 p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-600">
                      <Hourglass size={16} className="text-slate-400 flex-shrink-0" />
                      <span>Waiting for customer to choose a payment option. No action available yet.</span>
                    </div>
                  )}

                  {mode === 'NONE' && h.Indent_Status !== 'Pending Fin Clearing' && (
                    <div className="flex items-center gap-2 p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-sm text-emerald-700">
                      <CheckCircle size={16} className="text-emerald-500 flex-shrink-0" />
                      <span>
                        This order has been <strong>already processed</strong> —
                        current status is <strong>{h.Indent_Status}</strong>.
                      </span>
                    </div>
                  )}

                  {/* ─── Mode: LOAN_REVIEW — approve/reject loan ───────── */}
                  {mode === 'LOAN_REVIEW' && (
                    <div className="space-y-3 border-t border-slate-100 pt-4">
                      <div className="flex items-center gap-2">
                        <CreditCard size={16} className="text-amber-600" />
                        <p className="font-semibold text-slate-800">Loan Application Decision</p>
                      </div>
                      <p className="text-xs text-slate-500">
                        Approving the loan will require the customer to pay only the 20% down payment
                        (₹{fmt(h.PC_Down_Payment)}) via virtual account. Rejecting will require them
                        to pay the full amount (₹{fmt(h.PC_Total_Amount)}).
                      </p>
                      <div>
                        <label className="label">Decision Remarks</label>
                        <textarea
                          className="input" rows={2}
                          placeholder="e.g. Eligibility verified, documents in order…"
                          value={loanRemarks}
                          onChange={e => setLoanRemarks(e.target.value)} />
                      </div>
                      <div className="flex flex-wrap gap-3">
                        <button
                          className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl font-semibold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60"
                          disabled={acting}
                          onClick={approveLoan}>
                          {acting
                            ? <Loader2 size={14} className="animate-spin" />
                            : <CheckCircle size={14} />}
                          Approve Loan
                        </button>
                        <button
                          className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl font-semibold text-white bg-red-600 hover:bg-red-700 disabled:opacity-60"
                          disabled={acting}
                          onClick={rejectLoan}>
                          <XCircle size={14} /> Reject Loan
                        </button>
                      </div>
                      <p className="text-xs text-amber-700 bg-amber-50 rounded-lg px-3 py-2">
                        <Info size={11} className="inline mr-1" />
                        If you reject, the customer will be prompted to pay the full amount via
                        their virtual account.
                      </p>
                    </div>
                  )}

                  {/* ─── Mode: PAYMENT — confirm/reject payment ────────── */}
                  {mode === 'PAYMENT' && (
                    <div className="space-y-3 border-t border-slate-100 pt-4">
                      <div className="flex items-center gap-2">
                        <Landmark size={16} className="text-blue-600" />
                        <p className="font-semibold text-slate-800">Payment Confirmation</p>
                      </div>
                      <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-xs text-blue-700 flex gap-2">
                        <Info size={14} className="flex-shrink-0 mt-0.5 text-blue-500" />
                        <span>
                          Payment via virtual account is auto-matched by the batch job.
                          Use manual confirm only if status has not updated after payment receipt.
                        </span>
                      </div>
                      <div>
                        <label className="label">Remarks (required for rejection)</label>
                        <textarea
                          className="input" rows={2} placeholder="Add remarks…"
                          value={rejRemarks}
                          onChange={e => setRejRemarks(e.target.value)} />
                      </div>
                      <div className="flex flex-wrap gap-3">
                        <button
                          className="btn-primary flex items-center gap-2 flex-1"
                          disabled={acting}
                          onClick={confirmPayment}>
                          {acting
                            ? <Loader2 size={14} className="animate-spin" />
                            : <CheckCircle size={14} />}
                          Manually Confirm Payment & Clear
                        </button>
                        <button
                          className="btn-danger flex items-center gap-2"
                          disabled={acting}
                          onClick={rejectPayment}>
                          <XCircle size={14} /> Reject
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })()}

      </div>
    </Layout>
  );
}