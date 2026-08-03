import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Layout from '../../components/Layout';
import { useRequireAuth, logoutAndRedirect } from '../../lib/session';
import { getProducts, getSubjects, getClasses, createOrderReturning } from '../../lib/api';
import toast from 'react-hot-toast';
import {
  ShoppingCart, CheckCircle, Plus, Trash2, Loader2, LogOut, ExternalLink,
} from 'lucide-react';

interface Item {
  product_id: number;
  product_name: string;
  mrp: number;
  quantity: number;
  sale_price: number;
  type: 'robotics' | 'olympiad_online' | 'olympiad_offline';
}

export default function NewOrderPage() {
  const router  = useRouter();
  const session = useRequireAuth(['F']);

  const [products, setProducts] = useState<any[]>([]);
  const [subjects, setSubjects] = useState<any[]>([]);
  const [classes, setClasses]   = useState<any[]>([]);
  const [items, setItems]       = useState<Item[]>([]);

  const [termsOpened, setTermsOpened]     = useState(false);
  const [termsLoaded, setTermsLoaded]     = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [showTermsInline, setShowTermsInline] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted]   = useState<number | null>(null);

  // ─── Load lookups ────────────────────────────────────────────
  useEffect(() => {
    getProducts().then(r => setProducts(r.data.data || [])).catch(() => {
      setProducts([
        { Product_Id: 17160, Product_Code: '8100100', Product_Name: 'Robotics',          MRP: 599, Product_Category: 'ZNESIGN' },
        { Product_Id: 17161, Product_Code: '4012990', Product_Name: 'Olympiad (Online)',  MRP: 299, Product_Category: 'ZNESIGN' },
        { Product_Id: 17160, Product_Code: '4012989', Product_Name: 'Olympiad (Offline)', MRP: 349, Product_Category: 'ZNESIGN' },
      ]);
    });
    getSubjects().then(r => setSubjects(r.data.data || [])).catch(() => {
      setSubjects([
        { Subject_Id: 3, Subject_Name: 'English' }, { Subject_Id: 7, Subject_Name: 'Mathematics' },
        { Subject_Id: 6, Subject_Name: 'Science' }, { Subject_Id: 48, Subject_Name: 'Cyber' },
      ]);
    });
    getClasses().then(r => setClasses(r.data.data || [])).catch(() => {
      setClasses(Array.from({ length: 12 }, (_, i) => ({ Class_Id: i + 1, Class_Name: `Class ${i + 1}` })));
    });
  }, []);

  // ─── Product helpers ─────────────────────────────────────────
  const findProduct = (type: Item['type']) => {
    const codeMap: Record<Item['type'], string> = {
      robotics: '8100100', olympiad_online: '4012990', olympiad_offline: '4012989',
    };
    return products.find(p => p.Product_Code === codeMap[type]);
  };

  const addItem = (type: Item['type']) => {
    const match = findProduct(type);
    if (!match) return toast.error('Product not found');
    setItems(p => [...p, {
      product_id: match.Product_Id, product_name: match.Product_Name,
      mrp: match.MRP, quantity: 1, sale_price: match.MRP, type,
    }]);
  };

  const removeItem = (i: number) => setItems(p => p.filter((_, idx) => idx !== i));
  const updateItem = <K extends keyof Item>(i: number, field: K, val: Item[K]) =>
    setItems(p => p.map((it, idx) => idx === i ? { ...it, [field]: val } : it));

  const total = items.reduce((s, i) => s + i.quantity * i.sale_price, 0);
  const isFinanceEligible = total >= 750000;

  const canSubmit = items.length > 0
    && items.every(i => i.quantity > 0 && i.product_id)
    && termsAccepted;

  // ─── Submit ──────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!canSubmit) return;
    if (!session.entityId) return toast.error('Session not ready — please log in again.');
    setSubmitting(true);
    try {
      const r = await createOrderReturning({
        franchisee_id:   session.entityId,
        academicyear_id: 0,
        total_amount:    total,
        items: items.map(i => ({
          product_id: i.product_id,
          quantity:   i.quantity,
          sale_price: i.sale_price,
          tax_amount: 0,
        })),
        created_by: session.fullName || 'WEB',
      });
      setSubmitted(r.data.indent_id);
      toast.success('Order placed successfully!');
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Order submission failed');
    } finally {
      setSubmitting(false);
    }
  };

  // ─── Success ─────────────────────────────────────────────────
  if (submitted) {
    return (
      <Layout role="customer_logged_in">
        <div className="max-w-md mx-auto mt-16 card p-10 text-center">
          <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-5">
            <CheckCircle size={40} className="text-emerald-500" />
          </div>
          <h2 className="font-display text-2xl font-bold mb-2">Order Placed!</h2>
          <p className="text-slate-500 text-sm mb-2">Your Order Request ID</p>
          <p className="font-display text-4xl font-extrabold text-brand-600 mb-2">#{submitted}</p>
          <p className="text-sm text-slate-500 mb-8">
            Our Branch Head will review your order. You'll be notified once approved.
          </p>
          <div className="flex gap-3 justify-center">
            <a href="/customer/orders" className="btn-primary">View My Orders</a>
            <button className="btn-outline" onClick={() => {
              setSubmitted(null); setItems([]);
              setTermsAccepted(false); setTermsLoaded(false);
              setTermsOpened(false); setShowTermsInline(false);
            }}>
              Place Another Order
            </button>
          </div>
        </div>
      </Layout>
    );
  }

  // ─── Main form ───────────────────────────────────────────────
  return (
    <Layout role="customer_logged_in">
      <div className="max-w-3xl mx-auto space-y-5">

        {/* Header */}
        <div className="flex justify-between items-center flex-wrap gap-3">
          <div>
            <h1 className="font-display text-2xl font-bold text-slate-800">Place New Order</h1>
            <p className="text-sm text-slate-500 mt-1">
              {session.fullName && (
                <>
                  Ordering as <strong>{session.fullName}</strong>
                  {session.franchiseeCode && (
                    <span className="text-slate-400 ml-1">({session.franchiseeCode})</span>
                  )}
                </>
              )}
            </p>
          </div>
          <div className="flex gap-2">
            <a href="/customer/orders" className="btn-outline text-sm">← Back to Orders</a>
            {session.source === 'login' && (
              <button className="btn-outline flex items-center gap-2 text-sm"
                onClick={() => logoutAndRedirect(router)}>
                <LogOut size={14} /> Logout
              </button>
            )}
          </div>
        </div>

        {/* Product selection */}
        <div className="card p-6 space-y-5">
          <h2 className="font-display text-lg font-semibold flex items-center gap-2">
            <ShoppingCart size={18} className="text-brand-500" /> Select Products
          </h2>

          <div className="flex flex-wrap gap-2">
            {[
              { type: 'robotics',         label: '+ Robotics',           cls: 'bg-purple-600 hover:bg-purple-700' },
              { type: 'olympiad_online',  label: '+ Olympiad (Online)',  cls: 'bg-blue-600 hover:bg-blue-700' },
              { type: 'olympiad_offline', label: '+ Olympiad (Offline)', cls: 'bg-teal-600 hover:bg-teal-700' },
            ].map(p => (
              <button key={p.type}
                className={`${p.cls} text-white text-sm font-semibold px-4 py-2 rounded-xl transition flex items-center gap-1`}
                onClick={() => addItem(p.type as Item['type'])}>
                <Plus size={14} />{p.label}
              </button>
            ))}
          </div>

          {items.length === 0 && (
            <div className="border-2 border-dashed border-slate-200 rounded-2xl p-10 text-center text-slate-400 text-sm">
              Use the buttons above to add products
            </div>
          )}

          <div className="space-y-3">
            {items.map((item, i) => (
              <div key={i} className="bg-slate-50 rounded-xl p-4 space-y-3 border border-slate-100">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-semibold text-sm">{item.product_name}</p>
                    <span className={`badge mt-1 ${item.type === 'robotics' ? 'badge-purple' : item.type === 'olympiad_online' ? 'badge-blue' : 'badge-teal'}`}>
                      {item.type.replace(/_/g, ' ')}
                    </span>
                  </div>
                  <button onClick={() => removeItem(i)} className="text-red-400 hover:text-red-600 p-1">
                    <Trash2 size={15} />
                  </button>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {item.type !== 'robotics' && (
                    <>
                      <div>
                        <label className="label">Subject</label>
                        <select className="input text-sm">
                          <option value="">— Select —</option>
                          {subjects.map(s => <option key={s.Subject_Id} value={s.Subject_Id}>{s.Subject_Name}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="label">Class</label>
                        <select className="input text-sm">
                          <option value="">— Select —</option>
                          {classes.map(c => <option key={c.Class_Id} value={c.Class_Id}>{c.Class_Name}</option>)}
                        </select>
                      </div>
                    </>
                  )}
                  <div>
                    <label className="label">Quantity</label>
                    <input type="number" min={1} className="input text-sm" value={item.quantity}
                      onChange={e => updateItem(i, 'quantity', Math.max(1, parseInt(e.target.value) || 1))} />
                  </div>
                  <div>
                    <label className="label">MRP / Unit (₹)</label>
                    <input type="number" className="input text-sm" value={item.sale_price} disabled />
                  </div>
                </div>
                <p className="text-right text-sm font-semibold text-brand-700">
                  Subtotal: ₹{(item.quantity * item.sale_price).toLocaleString('en-IN')}
                </p>
              </div>
            ))}
          </div>

          {items.length > 0 && (
            <div className="bg-brand-50 rounded-2xl p-4 flex flex-wrap justify-between items-center gap-3">
              <div>
                <p className="text-xs text-slate-500 mb-0.5">Order Total (MRP)</p>
                <p className="font-display text-2xl font-bold text-brand-700">
                  ₹{total.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                </p>
              </div>
              {isFinanceEligible && (
                <div className="text-right">
                  <span className="badge badge-green">Finance Available</span>
                  <p className="text-xs text-slate-500 mt-1">
                    20% upfront = ₹{(total * 0.2).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Terms & Submit */}
        {items.length > 0 && (
          <div className="card p-6 space-y-4">
            <h2 className="font-display text-lg font-semibold flex items-center gap-2">
              <CheckCircle size={18} className="text-brand-500" /> Terms & Submit
            </h2>

            {!termsOpened && (
              <button className="btn-outline w-full flex items-center justify-center gap-2"
                onClick={() => { setShowTermsInline(true); setTermsOpened(true); }}>
                <ExternalLink size={15} /> View Terms & Conditions
              </button>
            )}

            {showTermsInline && (
              <div className="border-2 border-slate-200 rounded-2xl overflow-hidden">
                <div className="bg-slate-800 text-white text-xs px-4 py-2.5 flex justify-between items-center">
                  <span className="font-semibold">Terms & Conditions — ZNius Order Agreement</span>
                  <button className="text-white/60 hover:text-white text-xs"
                    onClick={() => setShowTermsInline(false)}>Collapse</button>
                </div>
                <iframe src="/TnC_Znius.pdf" className="w-full" style={{ height: '400px', border: 'none' }}
                  title="Terms" onLoad={() => setTermsLoaded(true)} />
                <div className="bg-slate-50 px-4 py-2 border-t border-slate-200 text-xs">
                  {!termsLoaded
                    ? <span className="text-amber-500 font-medium flex items-center gap-1">
                        <Loader2 size={12} className="animate-spin" /> Loading PDF…
                      </span>
                    : <span className="text-emerald-600 font-medium">✓ Terms loaded</span>}
                </div>
              </div>
            )}

            <label className={`flex items-start gap-3 p-4 rounded-2xl border-2 cursor-pointer transition-all
              ${!(termsOpened && termsLoaded)
                ? 'opacity-50 cursor-not-allowed border-slate-200'
                : termsAccepted
                  ? 'border-emerald-400 bg-emerald-50'
                  : 'border-slate-200 hover:border-brand-300 bg-white'
              }`}>
              <input type="checkbox" className="mt-0.5 w-4 h-4 accent-brand-600"
                disabled={!(termsOpened && termsLoaded)}
                checked={termsAccepted}
                onChange={e => setTermsAccepted(e.target.checked)} />
              <div className="text-sm">
                <span className="font-semibold text-slate-800">I accept the Terms & Conditions</span>
                {!termsOpened && <span className="text-slate-400 ml-2">(View terms first)</span>}
              </div>
            </label>

            <button className="btn-primary w-full flex items-center justify-center gap-2"
              disabled={!canSubmit || submitting}
              onClick={handleSubmit}>
              {submitting
                ? <><Loader2 size={15} className="animate-spin" /> Submitting…</>
                : 'Submit Order →'}
            </button>
          </div>
        )}
      </div>
    </Layout>
  );
}
