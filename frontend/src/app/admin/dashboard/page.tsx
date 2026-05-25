'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { BookOpen, QrCode, Users, RefreshCw, AlertCircle, TrendingUp, ShoppingBag, Table2, DollarSign } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

// ── Types ──────────────────────────────────────────────────────────────────────
interface LineItem {
  name:                 string;
  itemId:               string;
  quantity:             number;
  unitPriceMinorUnits:  number;
  totalPriceMinorUnits: number;
}

interface ApiOrder {
  orderId:               string;
  status:                string;
  tableId?:              string;
  lineItems:             LineItem[];
  placedAt?:             string;
  updatedAt?:            string;
  totalAmountMinorUnits?: number;
  currencyCode?:         string;
  tenantId?:             string;
  restaurantId?:         string;
}

// ── Helpers ────────────────────────────────────────────────────────────────────
function toKds(status: string): 'new' | 'preparing' | 'ready' | 'delivered' {
  const s = status.toUpperCase();
  if (s === 'RECEIVED' || s === 'PENDING')      return 'new';
  if (s === 'PREPARING' || s === 'IN_PROGRESS') return 'preparing';
  if (s === 'READY')                            return 'ready';
  return 'delivered';
}

function formatRs(minorUnits: number): string {
  return 'Rs ' + (minorUnits / 100).toLocaleString('en-PK');
}

function formatTime(iso?: string): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
}

function shortId(orderId: string): string {
  return `LM-${orderId.slice(0, 6).toUpperCase()}`;
}

function tableNum(tableId?: string): string {
  if (!tableId) return '??';
  const n = tableId.replace(/[^0-9]/g, '');
  return n ? n.padStart(2, '0') : tableId;
}

const STATUS_STYLES: Record<string, { bg: string; text: string; dot: string }> = {
  new:       { bg: 'bg-orange-500/10', text: 'text-orange-400',  dot: 'bg-orange-400'  },
  preparing: { bg: 'bg-blue-500/10',   text: 'text-blue-400',    dot: 'bg-blue-400'    },
  ready:     { bg: 'bg-green-500/10',  text: 'text-green-400',   dot: 'bg-green-400'   },
  delivered: { bg: 'bg-white/5',       text: 'text-white/30',    dot: 'bg-white/20'    },
};

const QUICK_LINKS = [
  { href: '/admin/menu',  label: 'Menu Management', icon: BookOpen, desc: 'Edit items, categories & pricing', accent: 'from-orange-500/20 to-orange-500/5',  border: 'border-orange-500/30', iconBg: 'bg-orange-500/15', iconColor: 'text-orange-400' },
  { href: '/admin/qr',    label: 'QR Codes',         icon: QrCode,  desc: 'Generate & manage table QR codes', accent: 'from-white/10 to-white/5',            border: 'border-white/20',      iconBg: 'bg-white/10',      iconColor: 'text-white'      },
  { href: '/admin/users', label: 'User Management',  icon: Users,   desc: 'Team members & access roles',      accent: 'from-orange-500/10 to-transparent',   border: 'border-orange-500/20', iconBg: 'bg-orange-500/10', iconColor: 'text-orange-300' },
];

// ── Page ───────────────────────────────────────────────────────────────────────
export default function AdminDashboardPage() {
  const { user } = useAuth();
  const [orders,   setOrders]   = useState<ApiOrder[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState('');
  const [lastSync, setLastSync] = useState('');

  const loadOrders = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/orders', { cache: 'no-store' });
      if (!res.ok) throw new Error(`API ${res.status}`);
      const data = await res.json();
      setOrders(data.orders ?? []);
      setLastSync(new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }));
    } catch (err: any) {
      setError(err?.message ?? 'Failed to load orders');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadOrders(); }, [loadOrders]);

  const totalRevenue  = orders.reduce((sum, o) => sum + (o.totalAmountMinorUnits ?? 0), 0);
  const activeOrders  = orders.filter(o => toKds(o.status) !== 'delivered');
  const delivering    = orders.filter(o => toKds(o.status) === 'delivered').length;
  const avgOrderValue = orders.length > 0 ? Math.round(totalRevenue / orders.length) : 0;
  const activeTables  = new Set(activeOrders.map(o => o.tableId).filter(Boolean)).size;

  const stats = [
    { label: 'Total Revenue',   val: loading ? null : formatRs(totalRevenue),       delta: `${orders.length} orders`,         icon: DollarSign,  accent: 'text-orange-400', glow: 'shadow-orange-500/20' },
    { label: 'Active Orders',   val: loading ? null : String(activeOrders.length),  delta: `${delivering} delivered`,         icon: ShoppingBag, accent: 'text-white',      glow: 'shadow-white/10'     },
    { label: 'Active Tables',   val: loading ? null : String(activeTables),         delta: 'Tables with open orders',         icon: Table2,      accent: 'text-orange-300', glow: 'shadow-orange-400/10'},
    { label: 'Avg Order Value', val: loading ? null : formatRs(avgOrderValue),      delta: `From ${orders.length} orders`,    icon: TrendingUp,  accent: 'text-orange-400', glow: 'shadow-orange-500/20'},
  ];

  const recentOrders = [...orders]
    .sort((a, b) => new Date(b.placedAt ?? 0).getTime() - new Date(a.placedAt ?? 0).getTime())
    .slice(0, 10);

  return (
    <>
      {/* ── Top bar ── */}
      <div className="flex items-center justify-between px-8 py-5 border-b border-white/[0.06] bg-gray-950">
        <div>
          <h1 className="text-[22px] font-bold text-white tracking-tight">
            Good {new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 17 ? 'afternoon' : 'evening'},{' '}
            <span className="text-orange-400">{user?.displayName?.split(' ')[0] ?? 'Admin'}</span>
          </h1>
          <p className="text-[12px] text-white/30 mt-0.5">
            {new Date().toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {lastSync && (
            <span className="text-[11px] text-white/25 bg-white/5 px-3 py-1.5 rounded-full border border-white/[0.06]">
              Synced {lastSync}
            </span>
          )}
          <button
            onClick={loadOrders}
            className="w-9 h-9 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center hover:bg-orange-500/10 hover:border-orange-500/30 transition-all"
            title="Refresh"
          >
            <RefreshCw size={14} className={`text-white/40 ${loading ? 'animate-spin text-orange-400' : ''}`} />
          </button>
        </div>
      </div>

      <div className="flex-1 p-8 overflow-y-auto bg-gray-950 space-y-8">

        {/* ── Error ── */}
        {error && (
          <div className="flex items-center gap-3 p-4 bg-red-500/10 border border-red-500/30 rounded-2xl">
            <AlertCircle size={16} className="text-red-400 flex-shrink-0" />
            <p className="text-[13px] text-red-300 flex-1">{error}</p>
            <button onClick={loadOrders} className="text-[12px] text-red-400 font-semibold hover:text-red-300 transition-colors">
              Retry
            </button>
          </div>
        )}

        {/* ── Stats grid ── */}
        <div className="grid grid-cols-4 gap-4">
          {stats.map((s, i) => {
            const Icon = s.icon;
            return (
              <div
                key={s.label}
                className={`relative overflow-hidden bg-gray-900 border border-white/[0.07] rounded-2xl p-5 shadow-lg ${s.glow}`}
                style={{ animationDelay: `${i * 80}ms` }}
              >
                {/* Subtle orange glow top-right */}
                <div className="absolute -top-6 -right-6 w-20 h-20 rounded-full bg-orange-500/10 blur-2xl" />

                <div className="flex items-start justify-between mb-4">
                  <div className={`w-9 h-9 rounded-xl bg-white/5 border border-white/[0.07] flex items-center justify-center`}>
                    <Icon size={16} className={s.accent} />
                  </div>
                </div>

                {loading ? (
                  <div className="space-y-2">
                    <div className="h-7 w-24 bg-white/5 rounded-lg animate-pulse" />
                    <div className="h-3 w-16 bg-white/5 rounded animate-pulse" />
                  </div>
                ) : (
                  <>
                    <p className={`text-[24px] font-bold ${s.accent} leading-none mb-1`}>{s.val}</p>
                    <p className="text-[11px] text-white/25 uppercase tracking-widest font-medium">{s.label}</p>
                    <p className="text-[11px] text-white/20 mt-1">{s.delta}</p>
                  </>
                )}
              </div>
            );
          })}
        </div>

        {/* ── Quick links ── */}
        <div>
          <p className="text-[11px] text-white/25 uppercase tracking-widest font-semibold mb-3">Quick Access</p>
          <div className="grid grid-cols-3 gap-4">
            {QUICK_LINKS.map(ql => {
              const Icon = ql.icon;
              return (
                <Link
                  key={ql.href}
                  href={ql.href}
                  className={`group relative overflow-hidden bg-gradient-to-br ${ql.accent} border ${ql.border} rounded-2xl p-5 hover:scale-[1.02] transition-all duration-200`}
                >
                  <div className={`w-10 h-10 rounded-xl ${ql.iconBg} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
                    <Icon size={18} className={ql.iconColor} />
                  </div>
                  <p className="text-[14px] font-semibold text-white mb-1">{ql.label}</p>
                  <p className="text-[12px] text-white/40">{ql.desc}</p>
                  <div className="absolute bottom-4 right-4 text-white/20 group-hover:text-white/40 transition-colors text-[18px]">→</div>
                </Link>
              );
            })}
          </div>
        </div>

        {/* ── Recent orders ── */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <p className="text-[11px] text-white/25 uppercase tracking-widest font-semibold">Recent Orders</p>
            <Link href="/kds" className="text-[12px] text-orange-400 font-semibold hover:text-orange-300 transition-colors">
              View KDS →
            </Link>
          </div>

          <div className="bg-gray-900 border border-white/[0.07] rounded-2xl overflow-hidden">
            {/* Table header */}
            <div
              className="grid gap-3 px-5 py-3 border-b border-white/[0.06] bg-white/[0.02]"
              style={{ gridTemplateColumns: '130px 80px 60px 120px 100px 80px' }}
            >
              {['Order ID', 'Table', 'Items', 'Total', 'Status', 'Time'].map(h => (
                <p key={h} className="text-[10px] text-white/25 uppercase tracking-widest font-semibold">{h}</p>
              ))}
            </div>

            {/* Loading skeleton */}
            {loading && Array.from({ length: 5 }).map((_, i) => (
              <div
                key={i}
                className="grid gap-3 px-5 py-4 border-b border-white/[0.04] last:border-0 items-center"
                style={{ gridTemplateColumns: '130px 80px 60px 120px 100px 80px' }}
              >
                {Array.from({ length: 6 }).map((_, j) => (
                  <div key={j} className="h-3 bg-white/5 rounded animate-pulse" />
                ))}
              </div>
            ))}

            {/* Empty state */}
            {!loading && recentOrders.length === 0 && (
              <div className="flex flex-col items-center justify-center py-16 gap-3">
                <span className="text-4xl opacity-20">📋</span>
                <p className="text-[13px] text-white/25">No orders yet</p>
              </div>
            )}

            {/* Rows */}
            {!loading && recentOrders.map((order, i) => {
              const kds       = toKds(order.status);
              const itemCount = order.lineItems?.length ?? 0;
              const style     = STATUS_STYLES[kds];
              return (
                <div
                  key={order.orderId}
                  className="grid gap-3 px-5 py-3.5 border-b border-white/[0.04] last:border-0 items-center hover:bg-white/[0.02] transition-colors"
                  style={{ gridTemplateColumns: '130px 80px 60px 120px 100px 80px' }}
                >
                  <span className="font-mono text-[12px] text-orange-400 font-semibold">
                    {shortId(order.orderId)}
                  </span>
                  <span className="text-[13px] text-white/50">
                    Table {tableNum(order.tableId)}
                  </span>
                  <span className="text-[13px] text-white/40">
                    {itemCount} item{itemCount !== 1 ? 's' : ''}
                  </span>
                  <span className="text-[13px] text-orange-300 font-semibold">
                    {formatRs(order.totalAmountMinorUnits ?? 0)}
                  </span>
                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold capitalize ${style.bg} ${style.text}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${style.dot}`} />
                    {kds}
                  </span>
                  <span className="text-[12px] text-white/30">{formatTime(order.placedAt)}</span>
                </div>
              );
            })}

            {/* Footer */}
            {!loading && orders.length > 0 && (
              <div className="px-5 py-3 border-t border-white/[0.06] bg-white/[0.01] flex items-center justify-between">
                <p className="text-[11px] text-white/20">
                  Showing {recentOrders.length} of {orders.length} orders
                </p>
                <p className="text-[11px] text-white/15 font-mono">Source: AWS API Gateway</p>
              </div>
            )}
          </div>
        </div>

      </div>
    </>
  );
}