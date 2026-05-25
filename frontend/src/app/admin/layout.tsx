'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard, BookOpen, QrCode, ChefHat,
  BarChart2, Receipt, Users, Settings, LogOut,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

const NAV = [
  { section: 'Main', items: [
    { href: '/admin/dashboard', label: 'Dashboard',       icon: LayoutDashboard },
    { href: '/admin/menu',      label: 'Menu Management', icon: BookOpen        },
    { href: '/admin/qr',        label: 'QR Codes',        icon: QrCode          },
    { href: '/admin/orders',    label: 'Kitchen Orders',  icon: ChefHat         },
  ]},
  { section: 'Reports', items: [
    { href: '/admin/dashboard', label: 'Analytics',      icon: BarChart2 },
    { href: '/admin/history',   label: 'Orders History', icon: Receipt   },
  ]},
  { section: 'Admin', items: [
    { href: '/admin/users',     label: 'User Management', icon: Users    },
    { href: '/admin/dashboard', label: 'Settings',        icon: Settings },
  ]},
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router   = useRouter();
  const { user, logout } = useAuth();
  const [loggingOut, setLoggingOut] = useState(false);

  async function handleLogout() {
    setLoggingOut(true);
    await logout();
    router.push('/login/admin');
  }

  const displayName = user?.displayName || user?.email?.split('@')[0] || 'Admin'
  const initials    = displayName.slice(0, 2).toUpperCase()
  const roleLabel   = user?.groups?.includes('menulay_admin')  ? 'Super Admin' :
                      user?.groups?.includes('menulay_tenant') ? user.tenantName || 'Tenant' :
                      'User'

  return (
    <div className="flex min-h-dvh bg-gray-950 font-sans">

      {/* ── Sidebar ── */}
      <aside className="w-[220px] bg-gray-900 border-r border-white/[0.06] flex flex-col flex-shrink-0">

        {/* Logo */}
        <div className="flex items-center gap-2.5 px-5 py-5 border-b border-white/[0.06]">
          <div className="w-8 h-8 rounded-xl bg-orange-500/15 border border-orange-500/30 flex items-center justify-center text-[16px]">
            🍽️
          </div>
          <div>
            <p className="text-[16px] font-bold text-white leading-tight tracking-tight">
              Menu<span className="text-orange-400">Lay</span>
            </p>
            <p className="text-[10px] text-white/20 uppercase tracking-widest">Admin Portal</p>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 overflow-y-auto">
          {NAV.map((group) => (
            <div key={group.section} className="mb-4">
              <p className="px-3 py-1.5 text-[10px] text-white/20 uppercase tracking-widest font-semibold">
                {group.section}
              </p>
              {group.items.map((item) => {
                const Icon   = item.icon;
                const active = pathname === item.href ||
                  (item.href !== '/admin/dashboard' && pathname.startsWith(item.href));
                return (
                  <Link
                    key={item.label}
                    href={item.href}
                    className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-[13px] font-medium mb-0.5 transition-all ${
                      active
                        ? 'bg-orange-500/15 border border-orange-500/25 text-orange-400'
                        : 'text-white/40 hover:text-white/70 hover:bg-white/[0.04] border border-transparent'
                    }`}
                  >
                    <Icon size={15} className={active ? 'text-orange-400' : 'text-white/30'} />
                    <span className="flex-1">{item.label}</span>
                    {active && <span className="w-1.5 h-1.5 rounded-full bg-orange-400" />}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        {/* User + Logout */}
        <div className="px-3 pb-4 pt-3 border-t border-white/[0.06]">
          <div className="flex items-center gap-2.5 px-2 py-2 rounded-xl hover:bg-white/[0.03] transition-colors">
            {/* Avatar */}
            <div className="w-8 h-8 rounded-[10px] bg-orange-500/15 border border-orange-500/25 flex items-center justify-center text-[12px] font-bold text-orange-400 flex-shrink-0">
              {initials}
            </div>
            {/* Info */}
            <div className="flex-1 min-w-0">
              <p className="text-[12px] font-semibold text-white/70 truncate">{displayName}</p>
              <p className="text-[10px] text-white/25">{roleLabel}</p>
            </div>
            {/* Logout */}
            <button
              onClick={handleLogout}
              disabled={loggingOut}
              title="Sign out"
              className="w-7 h-7 rounded-lg flex items-center justify-center text-white/20 hover:text-red-400 hover:bg-red-500/10 transition-all disabled:opacity-40"
            >
              <LogOut size={14} className={loggingOut ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>
      </aside>

      {/* ── Main content ── */}
      <main className="flex-1 flex flex-col min-w-0 bg-gray-950">
        {children}
      </main>
    </div>
  );
}