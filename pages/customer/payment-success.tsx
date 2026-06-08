import { useRouter } from 'next/router';
import Layout from '../../components/Layout';
import { CheckCircle } from 'lucide-react';

export default function PaymentSuccess() {
  const { query } = useRouter();
  const { indent_id, txn, mode } = query;
  const is20Pct = mode === 'finance_20';

  return (
    <Layout role="customer">
      <div className="max-w-md mx-auto mt-16 card p-10 text-center">
        <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-5">
          <CheckCircle size={40} className="text-emerald-500" />
        </div>
        <h2 className="font-display text-2xl font-bold mb-2 text-emerald-700">Payment Successful!</h2>
        {txn && <p className="text-xs text-slate-400 mb-1">Transaction ID: <strong>{txn}</strong></p>}
        {indent_id && <p className="text-xs text-slate-400 mb-4">Order: <strong>#{indent_id}</strong></p>}
        {is20Pct ? (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800 mb-6 text-left">
            <p className="font-semibold mb-1">20% Payment Received</p>
            <p>Your upfront payment has been recorded. Our Finance team will review and confirm it. The remaining 80% will be processed via the approved finance arrangement.</p>
          </div>
        ) : (
          <p className="text-sm text-slate-500 mb-6">
            Your full payment has been received. The Finance team will confirm and dispatch your order shortly.
          </p>
        )}
        <a href="/customer/orders" className="btn-primary">View My Orders</a>
      </div>
    </Layout>
  );
}
