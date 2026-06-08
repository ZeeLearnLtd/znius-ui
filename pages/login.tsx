import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { Package, Loader2, LogIn, Eye, EyeOff } from 'lucide-react';
import toast from 'react-hot-toast';
import { login } from '../lib/api';
import { useSession } from '../lib/session';

export default function LoginPage() {
  const router  = useRouter();
  const session = useSession();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPwd, setShowPwd]   = useState(false);
  const [loading, setLoading]   = useState(false);

  // Agar already logged in hai toh redirect karo
  useEffect(() => {
    if (!session.isReady) return;
    if (session.userId && session.userType) {
      redirectByRole(session.userType, router);
    }
  }, [session.isReady, session.userId, session.userType]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) return;
    setLoading(true);
    try {
      const r = await login({ username: username.trim(), password });

      if (!r.data.success) {
        toast.error(r.data.message || 'Login failed');
        return;
      }

      const u = r.data.user;

      // localStorage mein save karo
      localStorage.setItem('znius_user_id',   String(u.user_id));
      localStorage.setItem('znius_user_type', u.user_type);

      toast.success(`Welcome${u.full_name ? ', ' + u.full_name : ''}!`);

      const redirect = router.query.redirect as string | undefined;
      if (redirect && redirect.startsWith('/')) {
        router.replace(redirect);
      } else {
        redirectByRole(u.user_type, router);
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-700 to-brand-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">

        <div className="bg-white rounded-3xl shadow-2xl p-8">
          {/* Logo header */}
          <div className="text-center mb-7">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center mb-3">
              <Package size={28} className="text-white" />
            </div>
            <h1 className="font-display text-2xl font-bold text-slate-800">Welcome to ZNius</h1>
            <p className="text-sm text-slate-500 mt-1">Sign in to manage your orders</p>
          </div>

          <form onSubmit={submit} className="space-y-4">
            <div>
              <label className="label">Username</label>
              <input
                className="input"
                type="text"
                autoComplete="username"
                placeholder="e.g. F1380"
                value={username}
                onChange={e => setUsername(e.target.value)}
                autoFocus
              />
              <p className="text-xs text-slate-400 mt-1">
                Your Franchisee ID (sent in approval email)
              </p>
            </div>

            <div>
              <label className="label">Password</label>
              <div className="relative">
                <input
                  className="input pr-10"
                  type={showPwd ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                />
                <button
                  type="button"
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-slate-400 hover:text-slate-600"
                  onClick={() => setShowPwd(s => !s)}
                  tabIndex={-1}>
                  {showPwd ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              className="btn-primary w-full flex items-center justify-center gap-2"
              disabled={loading || !username || !password}>
              {loading
                ? <><Loader2 size={16} className="animate-spin" /> Signing in…</>
                : <><LogIn size={16} /> Sign In</>}
            </button>
          </form>

          <div className="mt-6 pt-6 border-t border-slate-100 text-center text-xs text-slate-500 space-y-2">
            <p>
              New school?{' '}
              <Link href="/customer/enquiry" className="text-brand-600 font-semibold hover:underline">
                Submit an enquiry
              </Link>
            </p>
            <p className="text-slate-400">
              Internal user? Login via{' '}
              <a href="https://app.mountlitera.com" className="text-brand-600 hover:underline">
                eMountLitera portal
              </a>
            </p>
          </div>
        </div>

        <p className="text-center text-xs text-white/60 mt-6">© ZNius · Zee Learn Ltd</p>
      </div>
    </div>
  );
}

function redirectByRole(userType: string, router: any) {
  if      (userType === 'F')   router.replace('/customer/orders');
  else if (userType === 'BH')  router.replace('/bh/dashboard');
  else if (userType === 'ACC') router.replace('/finance/dashboard');
  else router.replace('/');
}