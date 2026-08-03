import Link from 'next/link';
import { useRouter } from 'next/router';
import { useState } from 'react';
import {
  FileText, ClipboardList, UserCheck, DollarSign,
  Menu, X, Package, LogIn, Building2,
} from 'lucide-react';

type Role = 'customer' | 'customer_logged_in' | 'bh' | 'finance';

const MENUS: Record<Role, { href: string; label: string; icon: any }[]> = {
  // Unauthenticated customer — enquiry page only, with Login button
  customer: [
    { href: '/customer/enquiry', label: 'New Enquiry',  icon: FileText },
    { href: '/login',            label: 'Login',        icon: LogIn },
  ],
  // Authenticated customer — separate Virtual Account + Orders
  customer_logged_in: [
    { href: '/customer/orders',          label: 'Orders',          icon: ClipboardList },
    { href: '/customer/virtual-account', label: 'Virtual Account', icon: Building2 },
  ],
  bh: [
    { href: '/bh/dashboard',    label: 'Approval Desk', icon: UserCheck },
  ],
  finance: [
    { href: '/finance/dashboard', label: 'Finance Desk', icon: DollarSign },
  ],
};

// Map roles to header gradient styles
const ROLE_STYLE: Record<string, string> = {
  customer:           'from-brand-700 to-brand-900',
  customer_logged_in: 'from-brand-700 to-brand-900',
  bh:                 'from-violet-700 to-violet-900',
  finance:            'from-emerald-700 to-emerald-900',
};
const ROLE_LABEL: Record<string, string> = {
  customer:           'Customer Portal',
  customer_logged_in: 'Customer Portal',
  bh:                 'Branch Head',
  finance:            'Finance',
};

export default function Layout({
  children,
  role = 'customer',
}: {
  children: React.ReactNode;
  role?: Role;
}) {
  const router   = useRouter();
  const [open, setOpen] = useState(false);
  const menus    = MENUS[role] || MENUS.customer;

  const styleKey = ROLE_STYLE[role] || ROLE_STYLE.customer;
  const labelKey = ROLE_LABEL[role] || ROLE_LABEL.customer;

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <header className={`bg-gradient-to-r ${styleKey} shadow-lg`}>
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center">
              <Package size={18} className="text-white" />
            </div>
            <div>
              <p className="font-display font-bold text-white text-lg leading-none">ZNius</p>
              <p className="text-white/60 text-xs">{labelKey}</p>
            </div>
          </div>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-1">
            {menus.map(m => {
              const active = router.pathname.startsWith(m.href);
              return (
                <Link key={m.href} href={m.href}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition
                    ${active ? 'bg-white/20 text-white' : 'text-white/75 hover:bg-white/10 hover:text-white'}`}>
                  <m.icon size={15} />{m.label}
                </Link>
              );
            })}
          </nav>

          {/* Mobile */}
          <button className="md:hidden p-2 text-white" onClick={() => setOpen(!open)}>
            {open ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
        {open && (
          <div className="md:hidden border-t border-white/10 px-4 py-2">
            {menus.map(m => (
              <Link key={m.href} href={m.href} onClick={() => setOpen(false)}
                className="flex items-center gap-2 py-2.5 text-white/90 text-sm">
                <m.icon size={14} />{m.label}
              </Link>
            ))}
          </div>
        )}
      </header>

      <main className="flex-1 max-w-7xl mx-auto w-full px-4 py-6">{children}</main>

      <footer className="text-center text-xs text-slate-400 py-4 border-t border-slate-100">
        © {new Date().getFullYear()} ZNius · Zee Learn Ltd
      </footer>
    </div>
  );
}
