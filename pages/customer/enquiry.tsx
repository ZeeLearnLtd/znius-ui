import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import Layout from '../../components/Layout';
import toast from 'react-hot-toast';
import {
  User, ShieldCheck, ShoppingCart, CheckCircle,
  ChevronRight, Plus, Trash2, Loader2, ExternalLink,
  LogIn, AlertTriangle,
} from 'lucide-react';
import {
  getCountries, getStates, getCities, getProducts, getSubjects, getClasses,
  createFranchisee, saveAddress, saveKYC, createOrder,
  verifyGST, verifyPAN, verifyAadhar,
  checkExistingFranchisee,
} from '../../lib/api';

const STEPS = ['Personal & School', 'KYC Verification', 'Order Details', 'Terms & Submit'];

interface Item {
  product_id: number; product_name: string; mrp: number;
  quantity: number; sale_price: number;
  type: 'robotics' | 'olympiad_online' | 'olympiad_offline';
}

export default function EnquiryPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState<number | null>(null);

  // ── Returning franchisee detection ────────────────────────
  const [existingCheck, setExistingCheck] = useState<{
    checked: boolean;
    is_existing: boolean;
    franchisee_code?: string;
    franchisee_name?: string;
  }>({ checked: false, is_existing: false });
  const [checkingExisting, setCheckingExisting] = useState(false);

  // Lookups
  const [states, setStates] = useState<any[]>([]);
  const [cities, setCities] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [subjects, setSubjects] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);

  // Step 0
  const [personal, setPersonal] = useState({
    name: '', email: '', phone: '', school_name: '',
    address1: '', address2: '', place: '', zone_code: '', pincode: '',
    state_id: 0, state_name: '', city_id: 0, city_name: '',
    country_id: 1,
  });

  // Zone options
  const ZONES = [
    { code: 'W', name: 'West Zone' },
    { code: 'E', name: 'East Zone' },
    { code: 'N', name: 'North Zone' },
    { code: 'S', name: 'South Zone' },
  ];

  // Step 1
  const [kyc, setKyc] = useState({
    gst_no: '', pan_no: '', aadhar_no: '',
    gst_verified: false, pan_verified: false, aadhar_verified: false,
    gst_loading: false, pan_loading: false, aadhar_loading: false,
  });

  // Step 2
  const [items, setItems] = useState<Item[]>([]);

  // Step 3 – Terms
  const [termsOpened, setTermsOpened]     = useState(false);
  const [termsLoaded, setTermsLoaded]     = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [showTermsInline, setShowTermsInline] = useState(false);

  // ─── Load lookups on mount ───────────────────────────────────
  useEffect(() => {
    getStates(1).then(r => setStates(r.data.data || []));

    getProducts().then(r => setProducts(r.data.data || [])).catch(() => {
      setProducts([
        { Product_Id: 17160, Product_Code: '8100100', Product_Name: 'Robotics',          MRP: 599, Product_Category: 'ZNESIGN' },
        { Product_Id: 17161, Product_Code: '4012990', Product_Name: 'Olympiad (Online)',  MRP: 299, Product_Category: 'ZNESIGN' },
        { Product_Id: 17160, Product_Code: '4012989', Product_Name: 'Olympiad (Offline)', MRP: 349, Product_Category: 'ZNESIGN' },
      ]);
    });

    getSubjects().then(r => setSubjects(r.data.data || [])).catch(() => {
      setSubjects([
        { Subject_Id: 3,  Subject_Name: 'English' },
        { Subject_Id: 7,  Subject_Name: 'Mathematics' },
        { Subject_Id: 6,  Subject_Name: 'Science' },
        { Subject_Id: 48, Subject_Name: 'Cyber' },
      ]);
    });

    getClasses().then(r => setClasses(r.data.data || [])).catch(() => {
      setClasses(Array.from({ length: 12 }, (_, i) => ({ Class_Id: i + 1, Class_Name: `Class ${i + 1}` })));
    });
  }, []);

  // ─── State change → load cities ─────────────────────────────
  const onStateChange = async (state_id: number, state_name: string) => {
    setPersonal(p => ({ ...p, state_id, state_name, city_id: 0, city_name: '' }));
    if (state_id) {
      const r = await getCities(state_id);
      setCities(r.data.data || []);
    }
  };

  // ─── KYC verify ─────────────────────────────────────────────
  const verify = async (type: 'gst' | 'pan' | 'aadhar') => {
    const loadKey = `${type}_loading` as keyof typeof kyc;
    setKyc(k => ({ ...k, [loadKey]: true }));
    try {
      const val = type === 'gst' ? kyc.gst_no : type === 'pan' ? kyc.pan_no : kyc.aadhar_no;
      const fn  = type === 'gst' ? verifyGST : type === 'pan' ? verifyPAN : verifyAadhar;
      const r   = await fn(val);
      if (r.data.verified) {
        setKyc(k => ({ ...k, [`${type}_verified`]: true, [loadKey]: false }));
        toast.success(`${type.toUpperCase()} verified ✓`);
      } else {
        toast.error(r.data.message || 'Verification failed');
        setKyc(k => ({ ...k, [loadKey]: false }));
      }
    } catch {
      toast.error('Verification request failed');
      setKyc(k => ({ ...k, [`${type}_loading` as keyof typeof kyc]: false }));
    }
  };

  // ─── Check if franchisee already exists ─────────────────────
  const handleCheckExisting = async () => {
    setCheckingExisting(true);
    try {
      const r = await checkExistingFranchisee({
        school_name: personal.school_name,
        pan_no:      kyc.pan_no,
        gst_no:      kyc.gst_no,
      });
      const data = r.data;
      if (data.is_existing) {
        setExistingCheck({
          checked: true,
          is_existing: true,
          franchisee_code: data.franchisee_code,
          franchisee_name: data.franchisee_name,
        });
        // Don't auto-redirect; show the message and let user click Login
      } else {
        setExistingCheck({ checked: true, is_existing: false });
        // Not existing → proceed to step 2 (Order Details)
        setStep(2);
      }
    } catch {
      // If check fails, allow the user to continue as new franchisee
      setExistingCheck({ checked: true, is_existing: false });
      setStep(2);
    } finally {
      setCheckingExisting(false);
    }
  };

  // ─── Product lookup by Product_Code ─────────────────────────
  const findProduct = (type: Item['type']) => {
    const codeMap: Record<Item['type'], string> = {
      robotics:         '8100100',
      olympiad_online:  '4012990',
      olympiad_offline: '4012989',
    };
    return products.find(p => p.Product_Code === codeMap[type]);
  };

  // ─── Add item ────────────────────────────────────────────────
  const addItem = (type: Item['type']) => {
    const match = findProduct(type);
    if (!match) return toast.error('Product not found in master');
    setItems(p => [...p, {
      product_id:   match.Product_Id,
      product_name: match.Product_Name,
      mrp:          match.MRP,
      quantity:     1,
      sale_price:   match.MRP,
      type,
    }]);
  };

  // ─── Remove / update item ────────────────────────────────────
  const removeItem = (i: number) => setItems(p => p.filter((_, idx) => idx !== i));
  const updateItem = <K extends keyof Item>(i: number, field: K, val: Item[K]) =>
    setItems(p => p.map((it, idx) => idx === i ? { ...it, [field]: val } : it));

  // ─── Totals ──────────────────────────────────────────────────
  const total = items.reduce((s, i) => s + i.quantity * i.sale_price, 0);
  const isFinanceEligible = total >= 750000;

  // ─── Step validation ─────────────────────────────────────────
  // CHANGED: KYC now requires ALL THREE fields verified
  const canNext = () => {
    if (step === 0)
      return personal.name && personal.email && personal.phone &&
             personal.school_name && personal.address1 && personal.place &&
             personal.zone_code && personal.pincode && personal.state_id;
    if (step === 1)
      return kyc.gst_verified && kyc.pan_verified && kyc.aadhar_verified;
    if (step === 2)
      return items.length > 0 && items.every(i => i.quantity > 0 && i.product_id);
    return termsAccepted;
  };

  // ─── Handle "Continue" from KYC step ─────────────────────────
  // Instead of directly going to step 2, check for existing franchisee first
  const handleKYCContinue = () => {
    // Reset existing check state when KYC data might have changed
    setExistingCheck({ checked: false, is_existing: false });
    handleCheckExisting();
  };

  // ─── Terms open ──────────────────────────────────────────────
  const handleOpenTerms = () => {
    setShowTermsInline(true);
    setTermsOpened(true);
  };

  // ─── Final submit ────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!termsAccepted) return toast.error('Please accept the terms & conditions');
    setSubmitting(true);
    try {
      const fRes = await createFranchisee({ franchisee_name: personal.school_name, created_by: 'WEB' });
      const franchisee_id: number = fRes.data.franchisee_id;

      await saveAddress({
        entity_id:      franchisee_id,
        contact_person: personal.name,
        address1:       personal.address1,
        address2:       personal.address2,
        place:          personal.place,
        zone_code:      personal.zone_code,
        city_id:        personal.city_id,
        city_name:      personal.city_name,
        pin_code:       personal.pincode,
        state_id:       personal.state_id,
        state_name:     personal.state_name,
        country_id:     personal.country_id,
        mobile_no:      personal.phone,
        email_id:       personal.email,
        created_by:     'WEB',
      });

      await saveKYC({
        franchisee_id,
        gst_no:          kyc.gst_no    || null,
        pan_no:          kyc.pan_no    || null,
        aadhar_no:       kyc.aadhar_no || null,
        gst_verified:    kyc.gst_verified,
        pan_verified:    kyc.pan_verified,
        aadhar_verified: kyc.aadhar_verified,
        created_by:      'WEB',
      });

      const oRes = await createOrder({
        franchisee_id,
        academicyear_id: 0,
        total_amount:    total,
        items: items.map(i => ({
          product_id: i.product_id,
          quantity:   i.quantity,
          sale_price: i.sale_price,
          tax_amount: 0,
        })),
        created_by: 'WEB',
      });

      setSubmitted(oRes.data.indent_id);
      toast.success('Enquiry submitted successfully!');
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Submission failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  // ─── Success screen ──────────────────────────────────────────
  if (submitted) {
    return (
      <Layout role="customer">
        <div className="max-w-md mx-auto mt-16 card p-10 text-center">
          <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-5">
            <CheckCircle size={40} className="text-emerald-500" />
          </div>
          <h2 className="font-display text-2xl font-bold mb-2">Enquiry Submitted!</h2>
          <p className="text-slate-500 text-sm mb-2">Your Order Request ID</p>
          <p className="font-display text-4xl font-extrabold text-brand-600 mb-2">#{submitted}</p>
          <p className="text-sm text-slate-500 mb-8">
            Our Branch Head will review your request. You'll be notified once it's approved and ready for payment.
          </p>
          <div className="flex gap-3 justify-center">
            <a href="/login" className="btn-primary flex items-center gap-2">
              <LogIn size={15} /> Login to Track Orders
            </a>
            <button className="btn-outline" onClick={() => {
              setSubmitted(null); setStep(0); setItems([]);
              setTermsAccepted(false); setTermsLoaded(false);
              setTermsOpened(false); setShowTermsInline(false);
              setExistingCheck({ checked: false, is_existing: false });
            }}>
              New Enquiry
            </button>
          </div>
        </div>
      </Layout>
    );
  }

  // ─── Main form ───────────────────────────────────────────────
  return (
    <Layout role="customer">
      <div className="max-w-3xl mx-auto">

        {/* Header */}
        <div className="mb-6">
          <h1 className="font-display text-2xl font-bold text-slate-800">New Enquiry / Order Request</h1>
          <p className="text-sm text-slate-500 mt-1">Complete all steps to submit your ZNius product enquiry</p>
        </div>

        {/* Step indicator */}
        <div className="flex items-center mb-8">
          {STEPS.map((s, i) => (
            <div key={i} className="flex items-center flex-1 last:flex-none">
              <div className="flex flex-col items-center gap-1 min-w-0">
                <div className={`step-dot ${i < step ? 'step-done' : i === step ? 'step-active' : 'step-inactive'}`}>
                  {i < step ? <CheckCircle size={14} /> : i + 1}
                </div>
                <span className={`text-xs font-medium hidden sm:block truncate ${i === step ? 'text-brand-600' : 'text-slate-400'}`}>{s}</span>
              </div>
              {i < STEPS.length - 1 && (
                <div className={`flex-1 h-0.5 mx-2 mt-[-14px] transition-all ${i < step ? 'bg-emerald-400' : 'bg-slate-200'}`} />
              )}
            </div>
          ))}
        </div>

        <div className="card p-6 mb-4">

          {/* ─── Step 0: Personal & School ─── */}
          {step === 0 && (
            <div className="space-y-5">
              <h2 className="font-display text-lg font-semibold flex items-center gap-2">
                <User size={18} className="text-brand-500" /> Personal & School Details
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="label">Contact Person *</label>
                  <input className="input" placeholder="Full Name" value={personal.name}
                    onChange={e => setPersonal(p => ({ ...p, name: e.target.value }))} />
                </div>
                <div>
                  <label className="label">School / Institution Name *</label>
                  <input className="input" placeholder="School Name" value={personal.school_name}
                    onChange={e => setPersonal(p => ({ ...p, school_name: e.target.value }))} />
                </div>
                <div>
                  <label className="label">Email Address *</label>
                  <input type="email" className="input" placeholder="email@school.com" value={personal.email}
                    onChange={e => setPersonal(p => ({ ...p, email: e.target.value }))} />
                </div>
                <div>
                  <label className="label">Mobile Number *</label>
                  <input className="input" placeholder="10-digit mobile" maxLength={10} value={personal.phone}
                    onChange={e => setPersonal(p => ({ ...p, phone: e.target.value.replace(/\D/, '') }))} />
                </div>
                <div className="sm:col-span-2">
                  <label className="label">Address Line 1 *</label>
                  <input className="input" placeholder="Building / Street" value={personal.address1}
                    onChange={e => setPersonal(p => ({ ...p, address1: e.target.value }))} />
                </div>
                <div className="sm:col-span-2">
                  <label className="label">Address Line 2</label>
                  <input className="input" placeholder="Area / Landmark (optional)" value={personal.address2}
                    onChange={e => setPersonal(p => ({ ...p, address2: e.target.value }))} />
                </div>
                <div>
                  <label className="label">Place *</label>
                  <input className="input" placeholder="e.g. Mumbai" value={personal.place}
                    onChange={e => setPersonal(p => ({ ...p, place: e.target.value }))} />
                </div>
                <div>
                  <label className="label">Zone *</label>
                  <select className="input" value={personal.zone_code}
                    onChange={e => setPersonal(p => ({ ...p, zone_code: e.target.value }))}>
                    <option value="">— Select Zone —</option>
                    {ZONES.map(z => <option key={z.code} value={z.code}>{z.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">State *</label>
                  <select className="input" value={personal.state_id}
                    onChange={e => {
                      const s = states.find(x => x.state_id === +e.target.value);
                      onStateChange(+e.target.value, s?.state_name || '');
                    }}>
                    <option value={0}>— Select State —</option>
                    {states.map(s => <option key={s.state_id} value={s.state_id}>{s.state_name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">City</label>
                  <select className="input" value={personal.city_id}
                    onChange={e => {
                      const c = cities.find(x => x.City_ID === +e.target.value);
                      setPersonal(p => ({ ...p, city_id: +e.target.value, city_name: c?.City_Name || '' }));
                    }}>
                    <option value={0}>— Select City —</option>
                    {cities.map(c => <option key={c.City_ID} value={c.City_ID}>{c.City_Name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">PIN Code *</label>
                  <input className="input" placeholder="6-digit PIN" maxLength={6} value={personal.pincode}
                    onChange={e => setPersonal(p => ({ ...p, pincode: e.target.value.replace(/\D/, '') }))} />
                </div>
              </div>
            </div>
          )}

          {/* ─── Step 1: KYC ─── */}
          {step === 1 && (
            <div className="space-y-5">
              <h2 className="font-display text-lg font-semibold flex items-center gap-2">
                <ShieldCheck size={18} className="text-brand-500" /> KYC Verification
              </h2>

              {/* CHANGED: All three documents are mandatory */}
              <p className="text-sm text-slate-500 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
                All three documents are <strong>mandatory</strong>. Please verify GST, PAN, and Aadhar to continue.
              </p>

              {[
                { key: 'gst',    label: 'GST Number *',    field: 'gst_no',    placeholder: '15-character GST No (e.g. 09LLQPS8572M1ZJ)' },
                { key: 'pan',    label: 'PAN Number *',    field: 'pan_no',    placeholder: 'ABCDE1234F' },
                { key: 'aadhar', label: 'Aadhar Number *', field: 'aadhar_no', placeholder: '12-digit Aadhar' },
              ].map(({ key, label, field, placeholder }) => {
                const verified = kyc[`${key}_verified` as keyof typeof kyc] as boolean;
                const loading  = kyc[`${key}_loading`  as keyof typeof kyc] as boolean;
                const value    = kyc[field as keyof typeof kyc] as string;
                return (
                  <div key={key} className={`p-4 rounded-2xl border-2 transition-all ${verified ? 'border-emerald-400 bg-emerald-50' : 'border-slate-200 bg-white'}`}>
                    <label className="label">{label}</label>
                    <div className="flex gap-2">
                      <input className="input flex-1" placeholder={placeholder} value={value}
                        disabled={verified}
                        onChange={e => setKyc(k => ({ ...k, [field]: e.target.value.toUpperCase() }))} />
                      {verified
                        ? <span className="flex items-center gap-1.5 text-emerald-600 font-semibold text-sm px-3 whitespace-nowrap">
                            <CheckCircle size={16} /> Verified
                          </span>
                        : <button className="btn-primary whitespace-nowrap" disabled={!value || loading}
                            onClick={() => verify(key as any)}>
                            {loading ? <Loader2 size={14} className="animate-spin" /> : 'Verify'}
                          </button>
                      }
                    </div>
                  </div>
                );
              })}

              {/* ── Existing franchisee detected ── */}
              {existingCheck.is_existing && (
                <div className="bg-blue-50 border-2 border-blue-300 rounded-2xl p-5 space-y-3">
                  <div className="flex items-start gap-3">
                    <AlertTriangle size={22} className="text-blue-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-display font-bold text-blue-900 mb-1">
                        You are already registered!
                      </p>
                      <p className="text-sm text-blue-800">
                        A franchisee account matching your School Name, PAN, and GST already exists
                        {existingCheck.franchisee_code && (
                          <> with code <strong>{existingCheck.franchisee_code}</strong></>
                        )}.
                        Please log in to place a new order.
                      </p>
                    </div>
                  </div>
                  <button
                    className="btn-primary w-full flex items-center justify-center gap-2"
                    onClick={() => router.push('/login')}
                  >
                    <LogIn size={16} /> Go to Login
                  </button>
                </div>
              )}
            </div>
          )}

          {/* ─── Step 2: Order Details ─── */}
          {step === 2 && (
            <div className="space-y-5">
              <h2 className="font-display text-lg font-semibold flex items-center gap-2">
                <ShoppingCart size={18} className="text-brand-500" /> Order Details
              </h2>
              <p className="text-sm text-slate-500">Add products to your order. You can add multiple lines.</p>

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
                  <div key={i} className="card p-4 space-y-3">
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
                      <p className="text-xs text-slate-500 mt-1">20% upfront = ₹{(total * 0.2).toLocaleString('en-IN', { maximumFractionDigits: 0 })}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ─── Step 3: Terms & Submit ─── */}
          {step === 3 && (
            <div className="space-y-5">
              <h2 className="font-display text-lg font-semibold flex items-center gap-2">
                <CheckCircle size={18} className="text-brand-500" /> Review & Accept Terms
              </h2>

              {/* Summary */}
              <div className="bg-slate-50 rounded-xl p-4 text-sm space-y-1.5 border border-slate-200">
                <p><span className="text-slate-400">School:</span> <strong>{personal.school_name}</strong></p>
                <p><span className="text-slate-400">Contact:</span> {personal.name} · {personal.phone} · {personal.email}</p>
                <p><span className="text-slate-400">Address:</span> {personal.address1}{personal.city_name ? `, ${personal.city_name}` : ''}{personal.state_name ? `, ${personal.state_name}` : ''} - {personal.pincode}</p>
                <p><span className="text-slate-400">KYC:</span>
                  {kyc.gst_verified ? ' GST ✓' : ''}{kyc.pan_verified ? ' PAN ✓' : ''}{kyc.aadhar_verified ? ' Aadhar ✓' : ''}
                </p>
                <p><span className="text-slate-400">Products:</span> {items.length} item(s)</p>
                <p><span className="text-slate-400">Total Amount:</span> <strong className="text-brand-700">₹{total.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</strong></p>
                {isFinanceEligible && (
                  <p><span className="text-slate-400">Finance Option:</span> <strong>Available (20% = ₹{(total * 0.2).toLocaleString('en-IN', { maximumFractionDigits: 0 })} upfront)</strong></p>
                )}
              </div>

              {/* View Terms button */}
              {!termsOpened && (
                <button className="btn-outline w-full flex items-center justify-center gap-2"
                  onClick={handleOpenTerms}>
                  <ExternalLink size={15} /> View Terms & Conditions (must read before accepting)
                </button>
              )}

              {/* PDF Viewer */}
              {showTermsInline && (
                <div className="border-2 border-slate-200 rounded-2xl overflow-hidden">
                  <div className="bg-slate-800 text-white text-xs px-4 py-2.5 flex justify-between items-center">
                    <span className="font-semibold">Terms & Conditions — ZNius Order Agreement</span>
                    <button className="text-white/60 hover:text-white text-xs"
                      onClick={() => setShowTermsInline(false)}>
                      Collapse
                    </button>
                  </div>
                  <div className="bg-white">
                    <iframe
                      src="/TnC_Znius.pdf"
                      className="w-full"
                      style={{ height: '450px', border: 'none' }}
                      title="Terms and Conditions"
                      onLoad={() => setTermsLoaded(true)}
                    />
                  </div>
                  <div className="bg-slate-50 px-4 py-2 border-t border-slate-200 text-xs">
                    {!termsLoaded
                      ? <span className="text-amber-500 font-medium flex items-center gap-1">
                          <Loader2 size={12} className="animate-spin" /> Loading PDF…
                        </span>
                      : <span className="text-emerald-600 font-medium">
                          ✓ Terms loaded — you may now accept below
                        </span>
                    }
                  </div>
                </div>
              )}

              {/* Checkbox */}
              <label className={`flex items-start gap-3 p-4 rounded-2xl border-2 cursor-pointer transition-all
                ${!(termsOpened && termsLoaded)
                  ? 'opacity-50 cursor-not-allowed border-slate-200'
                  : termsAccepted
                    ? 'border-emerald-400 bg-emerald-50'
                    : 'border-slate-200 hover:border-brand-300 bg-white'
                }`}>
                <input
                  type="checkbox"
                  className="mt-0.5 w-4 h-4 accent-brand-600"
                  disabled={!(termsOpened && termsLoaded)}
                  checked={termsAccepted}
                  onChange={e => setTermsAccepted(e.target.checked)}
                />
                <div className="text-sm">
                  <span className="font-semibold text-slate-800">I accept the Terms & Conditions</span>
                  {!termsOpened &&
                    <span className="text-slate-400 ml-2">(Please view the terms first)</span>}
                  {termsOpened && !termsLoaded &&
                    <span className="text-amber-500 ml-2">(Waiting for PDF to load)</span>}
                </div>
              </label>
            </div>
          )}
        </div>

        {/* Navigation */}
        <div className="flex justify-between">
          <button className="btn-outline" disabled={step === 0}
            onClick={() => setStep(s => s - 1)}>
            ← Back
          </button>
          {step < STEPS.length - 1
            ? step === 1
              ? /* KYC step: check existing before proceeding */
                <button className="btn-primary flex items-center gap-2"
                  disabled={!canNext() || checkingExisting || existingCheck.is_existing}
                  onClick={handleKYCContinue}>
                  {checkingExisting
                    ? <><Loader2 size={15} className="animate-spin" /> Checking…</>
                    : <>Continue <ChevronRight size={16} /></>}
                </button>
              : <button className="btn-primary flex items-center gap-2"
                  disabled={!canNext()}
                  onClick={() => setStep(s => s + 1)}>
                  Continue <ChevronRight size={16} />
                </button>
            : <button className="btn-primary flex items-center gap-2"
                disabled={!canNext() || submitting}
                onClick={handleSubmit}>
                {submitting
                  ? <><Loader2 size={15} className="animate-spin" /> Submitting…</>
                  : 'Submit Enquiry →'}
              </button>
          }
        </div>

      </div>
    </Layout>
  );
}
