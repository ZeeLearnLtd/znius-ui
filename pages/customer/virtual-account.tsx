import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Layout from '../../components/Layout';
import { getVirtualAccount } from '../../lib/api';
import { useRequireAuth, logoutAndRedirect } from '../../lib/session';
import { fmt } from '../../lib/utils';
import toast from 'react-hot-toast';
import {
  Building2, Copy, CheckCircle, QrCode, Loader2, LogOut, RefreshCw,
} from 'lucide-react';

export default function VirtualAccountPage() {
  const router  = useRouter();
  const session = useRequireAuth(['F']);

  const [va, setVa]           = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied]   = useState<string | null>(null);

  const load = async () => {
    if (!session.isReady || !session.entityId) return;
    setLoading(true);
    try {
      const r = await getVirtualAccount(session.entityId);
      setVa(r.data.data || null);
    } catch {
      toast.error('Failed to load virtual account');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [session.isReady, session.entityId]);

  const copyText = (text: string, label: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(label);
      setTimeout(() => setCopied(null), 2000);
    });
  };

  return (
    <Layout role="customer_logged_in">
      <div className="max-w-2xl mx-auto space-y-5">

        {/* Header */}
        <div className="flex justify-between items-center flex-wrap gap-3">
          <div>
            <h1 className="font-display text-2xl font-bold text-slate-800">
              Virtual Account
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              {session.fullName
                ? <>Welcome, <strong>{session.fullName}</strong>
                    {session.franchiseeCode && (
                      <span className="text-slate-400 ml-2">
                        ({session.franchiseeCode})
                      </span>
                    )}
                  </>
                : 'Your payment account details'}
            </p>
          </div>
          <div className="flex gap-2">
            <button className="btn-outline flex items-center gap-2" onClick={load}>
              <RefreshCw size={14} /> Refresh
            </button>
            {session.source === 'login' && (
              <button
                className="btn-outline flex items-center gap-2"
                onClick={() => logoutAndRedirect(router)}
              >
                <LogOut size={14} /> Logout
              </button>
            )}
          </div>
        </div>

        {/* Content */}
        {loading || !session.isReady ? (
          <div className="card p-16 text-center text-slate-400">
            <Loader2 size={24} className="animate-spin mx-auto mb-2" />
            Loading virtual account…
          </div>
        ) : !va ? (
          <div className="card p-10 text-center">
            <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Building2 size={28} className="text-amber-500" />
            </div>
            <h2 className="font-display text-lg font-bold mb-2">
              Virtual Account Being Created
            </h2>
            <p className="text-sm text-slate-500 mb-4">
              Your payment account is being set up by the system.
              Please check back in a few minutes.
            </p>
            <button className="btn-primary" onClick={load}>
              <RefreshCw size={14} className="inline mr-2" /> Check Again
            </button>
          </div>
        ) : (
          <div className="card p-6 space-y-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center">
                <Building2 size={20} className="text-blue-600" />
              </div>
              <div>
                <p className="font-display font-bold text-slate-800">
                  Payment Account Details
                </p>
                <p className="text-xs text-slate-400">
                  Use NEFT / RTGS / UPI to transfer funds
                </p>
              </div>
            </div>

            {/* Account details */}
            <div className="space-y-2">
              {[
                { label: 'Account Number', value: va.virtual_account_number },
                { label: 'IFSC Code',      value: va.virtual_account_ifsc },
                { label: 'UPI ID',         value: va.virtual_upi_id },
              ].map(({ label, value }) => value && (
                <div
                  key={label}
                  className="flex items-center justify-between bg-slate-50 rounded-xl px-4 py-3 border border-slate-100 gap-3"
                >
                  <div className="min-w-0">
                    <p className="text-xs text-slate-400 mb-0.5">{label}</p>
                    <p className="font-mono font-semibold text-slate-800 text-sm break-all">
                      {value}
                    </p>
                  </div>
                  <button
                    className="flex-shrink-0 p-1.5 rounded-lg hover:bg-slate-100 text-blue-500 hover:text-blue-700 transition"
                    onClick={() => copyText(value, label)}
                  >
                    {copied === label
                      ? <CheckCircle size={15} className="text-emerald-500" />
                      : <Copy size={15} />}
                  </button>
                </div>
              ))}
            </div>

            {/* QR Code */}
            {va.virtual_account_qr && (
              <div className="flex items-center gap-4 bg-white rounded-xl p-4 border border-slate-100">
                <img
                  src={va.virtual_account_qr}
                  alt="Scan to Pay"
                  className="w-28 h-28 rounded-lg border border-slate-100 object-contain"
                />
                <div className="text-sm text-slate-600 space-y-1.5">
                  <div className="flex items-center gap-1.5 font-semibold text-slate-800">
                    <QrCode size={16} /> Scan to Pay
                  </div>
                  <p className="text-xs text-slate-500">
                    Use any UPI app (GPay, PhonePe, Paytm) to scan and pay.
                  </p>
                </div>
              </div>
            )}

            {/* Zone info */}
            {va.Zone && (
              <div className="text-xs text-slate-400">
                Zone: <strong className="text-slate-600">{va.Zone}</strong>
              </div>
            )}

            <p className="text-xs text-slate-400 bg-slate-50 rounded-xl px-4 py-3 border border-slate-100">
              ⏱ Payment confirmation may take up to 30 minutes after transfer.
              Check your order status on the Orders page for updates.
            </p>
          </div>
        )}
      </div>
    </Layout>
  );
}
