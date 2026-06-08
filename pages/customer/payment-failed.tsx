import { useRouter } from 'next/router';
import Layout from '../../components/Layout';
import { XCircle } from 'lucide-react';

export default function PaymentFailed() {
  const { query } = useRouter();
  return (
    <Layout role="customer">
      <div className="max-w-md mx-auto mt-16 card p-10 text-center">
        <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-5">
          <XCircle size={40} className="text-red-500" />
        </div>
        <h2 className="font-display text-2xl font-bold mb-2 text-red-600">Payment Failed</h2>
        <p className="text-slate-500 text-sm mb-6">
          Your payment was not completed{query.indent_id ? ` for order #${query.indent_id}` : ''}. Please try again.
        </p>
        <div className="flex gap-3 justify-center">
          <a href="/customer/orders" className="btn-primary">Try Again</a>
          <a href="/customer/enquiry" className="btn-outline">Back to Home</a>
        </div>
      </div>
    </Layout>
  );
}
