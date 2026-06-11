import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Layout from '../../components/Layout';
import { getOrders, getVirtualAccount, savePaymentChoice } from '../../lib/api';
import { useRequireAuth, logoutAndRedirect } from '../../lib/session';
import { statusBadge, fmt, fmtDate } from '../../lib/utils';
import toast from 'react-hot-toast';
import {
  RefreshCw, ChevronDown, ChevronUp, Clock, CheckCircle,
  AlertCircle, Copy, QrCode, Building2, Loader2, LogOut,
  CreditCard, Landmark, Info, ArrowRight,
  Hourglass,
} from 'lucide-react';

// ── FRD constants ────────────────────────────────────────────
const LOAN_MIN_ORDER_VALUE = 750000;  // ₹7.5 L (MRP)
const LOAN_MIN_DEAL_VALUE  = 500000;  // ₹5 L (after discount)
const LOAN_DOWN_PCT        = 20;      // 20% upfront by customer

// ── Virtual Account Panel ────────────────────────────────────
function VirtualAccountPanel({
  franchiseeId,
  amountLabel,
  amountValue,
  highlight = false,
}: {
  franchiseeId: number;
  amountLabel: string;
  amountValue: number;
  highlight?: boolean;
}) {
  const [va, setVa]           = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied]   = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await getVirtualAccount(franchiseeId);
        if (!cancelled) { setVa(r.data.data || null); setLoading(false); }
      } catch {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [franchiseeId]);

  const copyText = (text: string, label: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(label);
      setTimeout(() => setCopied(null), 2000);
    });
  };

  if (loading)
    return (
      <div className="flex items-center gap-2 py-3 text-slate-400 text-sm">
        <Loader2 size={16} className="animate-spin" /> Loading payment details…
      </div>
    );

  if (!va)
    return (
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
        <p className="font-semibold mb-1">Virtual Account Being Created</p>
        <p>Your payment account is being set up. Please refresh in a few minutes.</p>
      </div>
    );

  const rows = [
    { label: 'Account Number', value: va.virtual_account_number },
    { label: 'IFSC Code',      value: va.virtual_account_ifsc },
    { label: 'UPI ID',         value: va.virtual_upi_id },
  ];

  const themeBg     = highlight ? 'bg-emerald-50 border-emerald-300' : 'bg-blue-50 border-blue-200';
  const themePill   = highlight ? 'bg-emerald-100 text-emerald-800' : 'bg-blue-100 text-blue-800';
  const themeAmount = highlight ? 'text-emerald-700' : 'text-blue-700';
  const themeIcon   = highlight ? 'text-emerald-600' : 'text-blue-600';
  const themeTitle  = highlight ? 'text-emerald-900' : 'text-blue-900';

  return (
    <div className={`border-2 rounded-2xl p-4 space-y-4 ${themeBg}`}>
      {/* Amount-to-pay banner */}
      <div className={`rounded-xl px-4 py-3 flex items-center justify-between ${themePill}`}>
        <span className="text-sm font-semibold">{amountLabel}</span>
        <span className={`text-xl font-bold ${themeAmount}`}>₹{fmt(amountValue)}</span>
      </div>

      <div className="flex items-center gap-2">
        <Building2 size={18} className={`${themeIcon} flex-shrink-0`} />
        <p className={`font-semibold ${themeTitle}`}>Transfer via NEFT / RTGS / UPI</p>
      </div>

      <div className="space-y-2">
        {rows.map(({ label, value }) => (
          <div key={label}
            className="flex items-center justify-between bg-white rounded-xl px-4 py-3 border border-slate-100 gap-3">
            <div className="min-w-0">
              <p className="text-xs text-slate-400 mb-0.5">{label}</p>
              <p className="font-mono font-semibold text-slate-800 text-sm break-all">{value}</p>
            </div>
            <button
              className="flex-shrink-0 p-1.5 rounded-lg hover:bg-slate-50 text-blue-500 hover:text-blue-700 transition"
              onClick={() => copyText(value, label)}>
              {copied === label
                ? <CheckCircle size={15} className="text-emerald-500" />
                : <Copy size={15} />}
            </button>
          </div>
        ))}
      </div>

      {va.virtual_account_qr && (
        <div className="flex items-center gap-4 bg-white rounded-xl p-3 border border-slate-100">
          <img src={va.virtual_account_qr} alt="Scan to Pay"
               className="w-24 h-24 rounded-lg border border-slate-100 object-contain" />
          <div className="text-sm text-slate-600 space-y-1">
            <div className="flex items-center gap-1 font-semibold text-slate-800">
              <QrCode size={14} /> Scan to Pay
            </div>
            <p className="text-xs text-slate-500">Use any UPI app (GPay, PhonePe, Paytm) to scan and pay.</p>
          </div>
        </div>
      )}

      <p className="text-xs text-slate-400">
        ⏱ Payment confirmation may take up to 30 minutes after transfer.
      </p>
    </div>
  );
}

// ── Payment Options Panel ────────────────────────────────────
function PaymentOptionsPanel({
  order,
  userId,
  onSaved,
}: {
  order: any;
  userId: number;
  onSaved: () => void;
}) {
  const payable        = order.Payable_Amount ?? order.Indent_Amount;
  const indentAmount   = order.Indent_Amount;
  const franchiseeId   = order.Franchisee_Id;
  const indentId       = order.Indent_Id;

  // From SP - existing choice (if any)
  const paymentType: 'FULL' | 'LOAN' | null = order.Payment_Type || null;
  const loanStatus:  'PENDING' | 'APPROVED' | 'REJECTED' | null = order.Loan_Status || null;
  const loanRemarks: string | null = order.Loan_Remarks || null;
  const downPayment  = Number(order.PC_Down_Payment   ?? Math.ceil((payable * LOAN_DOWN_PCT) / 100));
  const financeAmt   = Number(order.PC_Finance_Amount ?? payable - downPayment);

  // Eligibility per FRD
  const loanEligible = indentAmount >= LOAN_MIN_ORDER_VALUE && payable >= LOAN_MIN_DEAL_VALUE;

  const [selected, setSelected] = useState<'FULL' | 'LOAN' | null>(null);
  const [saving, setSaving]     = useState(false);

  const handleConfirm = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      const r = await savePaymentChoice(indentId, {
        payment_type: selected,
        user_id: userId,
      });
      if (r.data.success) {
        toast.success(r.data.message);
        onSaved();
      } else {
        toast.error(r.data.message || 'Unable to save choice');
      }
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Failed to save. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  // ═════════════════════════════════════════════════════════════
  // STATE 1 — Already chose FULL → show full VA
  // ═════════════════════════════════════════════════════════════
  if (paymentType === 'FULL') {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
          <Landmark size={16} className="text-blue-600" />
          Full Payment — Virtual Account
        </div>
        <VirtualAccountPanel
          franchiseeId={franchiseeId}
          amountLabel="Total Amount Payable"
          amountValue={payable}
        />
      </div>
    );
  }

  // ═════════════════════════════════════════════════════════════
  // STATE 2 — Chose LOAN, awaiting Finance review
  // ═════════════════════════════════════════════════════════════
  if (paymentType === 'LOAN' && loanStatus === 'PENDING') {
    return (
      <div className="space-y-4">
        <div className="bg-amber-50 border-2 border-amber-200 rounded-2xl p-4">
          <div className="flex items-start gap-3">
            <Hourglass size={20} className="text-amber-600 mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-semibold text-amber-900 mb-1">Loan Application Under Review</p>
              <p className="text-sm text-amber-800">
                Your financing request is being reviewed by our Finance team.
                You will be notified once approved — then you can pay {LOAN_DOWN_PCT}% upfront
                via your virtual account.
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3 text-sm">
          <div className="bg-white rounded-xl p-3 border border-slate-200">
            <p className="text-xs text-slate-400 mb-1">Total Payable</p>
            <p className="font-bold text-slate-800">₹{fmt(payable)}</p>
          </div>
          <div className="bg-emerald-50 rounded-xl p-3 border border-emerald-200">
            <p className="text-xs text-emerald-600 mb-1">You Pay ({LOAN_DOWN_PCT}%)</p>
            <p className="font-bold text-emerald-700">₹{fmt(downPayment)}</p>
          </div>
          <div className="bg-violet-50 rounded-xl p-3 border border-violet-200">
            <p className="text-xs text-violet-600 mb-1">Finance Covers</p>
            <p className="font-bold text-violet-700">₹{fmt(financeAmt)}</p>
          </div>
        </div>
      </div>
    );
  }

  // ═════════════════════════════════════════════════════════════
  // STATE 3 — Loan APPROVED → show 20% VA
  // ═════════════════════════════════════════════════════════════
  if (paymentType === 'LOAN' && loanStatus === 'APPROVED') {
    return (
      <div className="space-y-4">
        <div className="bg-emerald-50 border-2 border-emerald-200 rounded-2xl p-4">
          <div className="flex items-start gap-3">
            <CheckCircle size={20} className="text-emerald-600 mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <p className="font-semibold text-emerald-900 mb-1">🎉 Loan Approved!</p>
              <p className="text-sm text-emerald-800">
                Pay the {LOAN_DOWN_PCT}% upfront amount now. The remaining ₹{fmt(financeAmt)}
                will be settled by the financing partner.
              </p>
              {loanRemarks && (
                <p className="text-xs text-emerald-700 mt-2 italic">"{loanRemarks}"</p>
              )}
            </div>
          </div>
        </div>

        <VirtualAccountPanel
          franchiseeId={franchiseeId}
          amountLabel={`${LOAN_DOWN_PCT}% Down Payment`}
          amountValue={downPayment}
          highlight
        />
      </div>
    );
  }

  // ═════════════════════════════════════════════════════════════
  // STATE 4 — Loan REJECTED → show full VA
  // ═════════════════════════════════════════════════════════════
  if (paymentType === 'LOAN' && loanStatus === 'REJECTED') {
    return (
      <div className="space-y-4">
        <div className="bg-red-50 border-2 border-red-200 rounded-2xl p-4">
          <div className="flex items-start gap-3">
            <AlertCircle size={20} className="text-red-600 mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-semibold text-red-900 mb-1">Loan Application Not Approved</p>
              <p className="text-sm text-red-800">
                Your financing request was not approved. As per terms, please pay
                the full amount via your virtual account to proceed with the order.
              </p>
              {loanRemarks && (
                <p className="text-xs text-red-700 mt-2 italic">Reason: "{loanRemarks}"</p>
              )}
            </div>
          </div>
        </div>

        <VirtualAccountPanel
          franchiseeId={franchiseeId}
          amountLabel="Full Amount Payable"
          amountValue={payable}
        />
      </div>
    );
  }

  // ═════════════════════════════════════════════════════════════
  // STATE 5 — No choice yet → show selection UI
  // ═════════════════════════════════════════════════════════════
  return (
    <div className="space-y-4">
      <p className="text-sm font-semibold text-slate-700">
        Choose Payment Option
      </p>

      {/* Option 1: Full Payment */}
      <button
        onClick={() => setSelected('FULL')}
        className={`w-full text-left rounded-2xl border-2 p-4 transition-all ${
          selected === 'FULL'
            ? 'border-blue-500 bg-blue-50'
            : 'border-slate-200 bg-white hover:border-blue-300 hover:bg-blue-50/40'
        }`}
      >
        <div className="flex items-start gap-3">
          <div className={`mt-0.5 w-5 h-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center ${
            selected === 'FULL' ? 'border-blue-500' : 'border-slate-300'
          }`}>
            {selected === 'FULL' && <div className="w-2.5 h-2.5 rounded-full bg-blue-500" />}
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <Landmark size={16} className="text-blue-600" />
              <span className="font-semibold text-slate-800">Full Payment</span>
              <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">
                NEFT / RTGS / UPI
              </span>
            </div>
            <p className="text-sm text-slate-500 mt-1">
              Pay the complete amount via your virtual bank account.
            </p>
            <p className="text-lg font-bold text-blue-700 mt-2">₹{fmt(payable)}</p>
          </div>
        </div>
      </button>

      {/* Option 2: Financing */}
      <button
        onClick={() => loanEligible ? setSelected('LOAN') : undefined}
        disabled={!loanEligible}
        className={`w-full text-left rounded-2xl border-2 p-4 transition-all ${
          !loanEligible
            ? 'border-slate-100 bg-slate-50 opacity-60 cursor-not-allowed'
            : selected === 'LOAN'
              ? 'border-violet-500 bg-violet-50'
              : 'border-slate-200 bg-white hover:border-violet-300 hover:bg-violet-50/40'
        }`}
      >
        <div className="flex items-start gap-3">
          <div className={`mt-0.5 w-5 h-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center ${
            selected === 'LOAN' ? 'border-violet-500' : 'border-slate-300'
          }`}>
            {selected === 'LOAN' && <div className="w-2.5 h-2.5 rounded-full bg-violet-500" />}
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <CreditCard size={16} className="text-violet-600" />
              <span className="font-semibold text-slate-800">Apply for Financing</span>
              <span className="text-xs bg-violet-100 text-violet-700 px-2 py-0.5 rounded-full font-medium">
                {LOAN_DOWN_PCT}% Now · {100 - LOAN_DOWN_PCT}% via Finance
              </span>
            </div>
            <p className="text-sm text-slate-500 mt-1">
              Pay {LOAN_DOWN_PCT}% upfront. The financing partner covers the remaining {100 - LOAN_DOWN_PCT}%
              after Finance team approval.
            </p>

            {loanEligible ? (
              <div className="mt-3 grid grid-cols-2 gap-2">
                <div className="bg-white rounded-xl p-2.5 border border-violet-100">
                  <p className="text-xs text-slate-400">You Pay Now</p>
                  <p className="font-bold text-emerald-600">₹{fmt(Math.ceil((payable * LOAN_DOWN_PCT) / 100))}</p>
                  <p className="text-xs text-slate-400">({LOAN_DOWN_PCT}%)</p>
                </div>
                <div className="bg-white rounded-xl p-2.5 border border-violet-100">
                  <p className="text-xs text-slate-400">Finance Covers</p>
                  <p className="font-bold text-violet-600">₹{fmt(payable - Math.ceil((payable * LOAN_DOWN_PCT) / 100))}</p>
                  <p className="text-xs text-slate-400">({100 - LOAN_DOWN_PCT}%)</p>
                </div>
              </div>
            ) : (
              <div className="mt-2 flex items-start gap-1.5 text-xs text-amber-700 bg-amber-50 rounded-lg px-3 py-2">
                <Info size={12} className="flex-shrink-0 mt-0.5" />
                <span>
                  Financing is available for orders ≥ ₹{fmt(LOAN_MIN_ORDER_VALUE)} (MRP)
                  with deal value ≥ ₹{fmt(LOAN_MIN_DEAL_VALUE)} after discount.
                </span>
              </div>
            )}
          </div>
        </div>
      </button>

      {/* Confirm */}
      {selected && (
        <button
          onClick={handleConfirm}
          disabled={saving}
          className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-white transition-all ${
            selected === 'LOAN'
              ? 'bg-violet-600 hover:bg-violet-700'
              : 'bg-blue-600 hover:bg-blue-700'
          } disabled:opacity-60`}
        >
          {saving
            ? <><Loader2 size={16} className="animate-spin" /> Saving…</>
            : selected === 'LOAN'
              ? <><CreditCard size={16} /> Confirm & Submit Loan Application <ArrowRight size={16} /></>
              : <><Landmark size={16} /> Confirm — Proceed with Full Payment <ArrowRight size={16} /></>
          }
        </button>
      )}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────
export default function CustomerOrdersPage() {
  const router  = useRouter();
  const session = useRequireAuth(['F']);
  const [orders, setOrders]     = useState<any[]>([]);
  const [loading, setLoading]   = useState(true);
  const [expanded, setExpanded] = useState<number | null>(null);

  const load = async () => {
    if (!session.isReady || !session.userId) return;
    setLoading(true);
    try {
      const params = session.userType === 'F' && session.franchiseeCode
        ? { franchisee_code: session.franchiseeCode }
        : session.entityId
          ? { franchisee_id: session.entityId }
          : {};
      const r = await getOrders(params);
      setOrders(r.data.data || []);
    } catch { toast.error('Failed to load orders'); }
    finally  { setLoading(false); }
  };

  useEffect(() => { load(); }, [session.isReady, session.userId, session.franchiseeCode]);

  const statusInfo = (o: any) => {
    const status = o.Indent_Status;
    if (!status)
      return { icon: Clock, color: 'text-amber-500', bg: 'bg-amber-50 border-amber-200',
               msg: 'Your order is being processed.' };
    if (status === 'Pending BH Approval')
      return { icon: Clock, color: 'text-amber-600', bg: 'bg-amber-50 border-amber-200',
               msg: 'Your order is under Branch Head review. You will be notified once approved.' };
    if (status === 'BH Rejected')
      return { icon: AlertCircle, color: 'text-red-500', bg: 'bg-red-50 border-red-200',
               msg: 'Your order was rejected by the Branch Head. Please contact support.' };
    if (status === 'Pending Fin Clearing') {
      if (!o.Payment_Type)
        return { icon: Info, color: 'text-blue-600', bg: 'bg-blue-50 border-blue-200',
                 msg: 'Order approved! Please select a payment option below to proceed.' };
      if (o.Payment_Type === 'FULL')
        return { icon: Landmark, color: 'text-blue-600', bg: 'bg-blue-50 border-blue-200',
                 msg: 'Transfer the full amount to your virtual bank account.' };
      if (o.Payment_Type === 'LOAN' && o.Loan_Status === 'PENDING')
        return { icon: Clock, color: 'text-amber-600', bg: 'bg-amber-50 border-amber-200',
                 msg: 'Your loan application is under review by the Finance team.' };
      if (o.Payment_Type === 'LOAN' && o.Loan_Status === 'APPROVED')
        return { icon: CheckCircle, color: 'text-emerald-600', bg: 'bg-emerald-50 border-emerald-200',
                 msg: 'Loan approved! Please pay the 20% down payment.' };
      if (o.Payment_Type === 'LOAN' && o.Loan_Status === 'REJECTED')
        return { icon: AlertCircle, color: 'text-red-500', bg: 'bg-red-50 border-red-200',
                 msg: 'Loan not approved. Please pay the full amount via virtual account.' };
    }
    if (status === 'Finance Rejected')
      return { icon: AlertCircle, color: 'text-red-500', bg: 'bg-red-50 border-red-200',
               msg: 'Payment was not confirmed. Please contact the finance team.' };
    if (status === 'Finance Cleared')
      return { icon: CheckCircle, color: 'text-emerald-600', bg: 'bg-emerald-50 border-emerald-200',
               msg: 'Payment confirmed by Finance. Your order is complete.' };
    if (status === 'Pending Dispatch')
      return { icon: CheckCircle, color: 'text-emerald-600', bg: 'bg-emerald-50 border-emerald-200',
               msg: 'Payment received! Your order is being prepared for dispatch.' };
    if (status === 'Dispatched')
      return { icon: CheckCircle, color: 'text-blue-600', bg: 'bg-blue-50 border-blue-200',
               msg: 'Your order has been dispatched.' };
    if (status === 'Delivered')
      return { icon: CheckCircle, color: 'text-teal-600', bg: 'bg-teal-50 border-teal-200',
               msg: 'Your order has been delivered.' };
    return { icon: Clock, color: 'text-slate-500', bg: 'bg-slate-50 border-slate-200', msg: status };
  };

  return (
    <Layout role="customer">
      <div className="space-y-4">
        <div className="flex justify-between items-center flex-wrap gap-3">
          <div>
            <h1 className="font-display text-2xl font-bold text-slate-800">My Orders</h1>
            <p className="text-sm text-slate-500 mt-1">
              {session.fullName
                ? <>Welcome, <strong>{session.fullName}</strong>{session.franchiseeCode && <span className="text-slate-400 ml-2">({session.franchiseeCode})</span>}</>
                : 'Track your enquiries and make payments'}
            </p>
          </div>
          <div className="flex gap-2">
            <button className="btn-outline flex items-center gap-2" onClick={load}>
              <RefreshCw size={14} /> Refresh
            </button>
            {session.source === 'login' && (
              <button className="btn-outline flex items-center gap-2"
                onClick={() => logoutAndRedirect(router)}>
                <LogOut size={14} /> Logout
              </button>
            )}
          </div>
        </div>

        {loading || !session.isReady ? (
          <div className="card p-16 text-center text-slate-400">Loading orders…</div>
        ) : orders.length === 0 ? (
          <div className="card p-12 text-center">
            <p className="text-slate-400 mb-4">No orders yet</p>
            <a href="/customer/enquiry" className="btn-primary">Create New Enquiry</a>
          </div>
        ) : (
          <div className="space-y-3">
            {orders.map(o => {
              const { cls, label } = statusBadge(o.Indent_Status);
              const payable        = o.Payable_Amount ?? o.Indent_Amount;
              const isOpen         = expanded === o.Indent_Id;
              const sInfo          = statusInfo(o);
              const SIcon          = sInfo.icon;
              const showPayment    = o.Indent_Status === 'Pending Fin Clearing';

              return (
                <div key={o.Indent_Id} className="card overflow-hidden">
                  <div className="flex flex-wrap gap-3 items-center p-4 cursor-pointer hover:bg-slate-50"
                       onClick={() => setExpanded(isOpen ? null : o.Indent_Id)}>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-slate-800 truncate">{o.Franchisee_Name}</p>
                      <p className="text-xs text-slate-400">{o.Indent_No} · {fmtDate(o.Indent_Date)}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-brand-700 text-lg">₹{fmt(payable)}</p>
                      {o.Discount_Pct > 0 && (
                        <p className="text-xs text-emerald-600">{o.Discount_Pct}% discount applied</p>
                      )}
                    </div>
                    <span className={cls}>{label}</span>
                    {/* Payment type sub-badge */}
                    {o.Payment_Type === 'LOAN' && o.Loan_Status === 'PENDING' && (
                      <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">
                        Loan Pending
                      </span>
                    )}
                    {o.Payment_Type === 'LOAN' && o.Loan_Status === 'APPROVED' && (
                      <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-medium">
                        Loan Approved
                      </span>
                    )}
                    {o.Payment_Type === 'LOAN' && o.Loan_Status === 'REJECTED' && (
                      <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-medium">
                        Loan Rejected
                      </span>
                    )}
                    {isOpen
                      ? <ChevronUp size={16} className="text-slate-400" />
                      : <ChevronDown size={16} className="text-slate-400" />}
                  </div>

                  {isOpen && (
                    <div className="border-t border-slate-100 bg-slate-50/50 space-y-4 p-4">
                      <div className={`flex items-start gap-3 p-3 rounded-xl border ${sInfo.bg}`}>
                        <SIcon size={18} className={`${sInfo.color} flex-shrink-0 mt-0.5`} />
                        <p className={`text-sm font-medium ${sInfo.color}`}>{sInfo.msg}</p>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
                        <div><p className="label">GST No</p><p>{o.GST_No || '—'}</p></div>
                        <div><p className="label">PAN No</p><p>{o.PAN_No || '—'}</p></div>
                        <div><p className="label">Aadhar No</p><p>{o.Aadhar_No || '—'}</p></div>
                        <div><p className="label">Contact</p><p>{o.Contact_Person || '—'}</p></div>
                        <div><p className="label">Mobile</p><p>{o.Mobile_No || '—'}</p></div>
                        <div><p className="label">Email</p><p className="truncate">{o.Email_Id || '—'}</p></div>
                        {o.Discount_Pct > 0 && (
                          <div>
                            <p className="label">Discount Applied</p>
                            <p className="text-emerald-600 font-semibold">{o.Discount_Pct}%</p>
                          </div>
                        )}
                        <div className="col-span-2 sm:col-span-3">
                          <p className="label">School Address</p>
                          <p>{[o.Address1, o.Address2, o.City_Name, o.State_Name, o.Pin_Code]
                              .filter(Boolean).join(', ')}</p>
                        </div>
                      </div>

                      {showPayment && (
                        <PaymentOptionsPanel
                          order={o}
                          userId={session.userId!}
                          onSaved={load}
                        />
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Layout>
  );
}