'use client';

import { useState, useEffect, useCallback } from 'react';
import { RefreshCw, Search, WifiOff, Clock, Users, TrendingUp, ShoppingBag, DollarSign, CheckCircle } from 'lucide-react';
import { fetchOrders } from '@/lib/orders-api';
import type { KdsOrder, KdsStatus } from '@/lib/types';

const STATUS_CFG: Record<KdsStatus, { label: string; dot: string; bg: string; text: string; border: string }> = {
  new:       { label: 'New',       dot: 'bg-orange-400', bg: 'bg-orange-500/10', text: 'text-orange-400', border: 'border-orange-500/20' },
  preparing: { label: 'Preparing', dot: 'bg-blue-400',   bg: 'bg-blue-500/10',   text: 'text-blue-400',   border: 'border-blue-500/20'   },
  ready:     { label: 'Ready',     dot: 'bg-green-400',  bg: 'bg-green-500/10',  text: 'text-green-400',  border: 'border-green-500/20'  },
  delivered: { label: 'Delivered', dot: 'bg-purple-400', bg: 'bg-purple-500/10', text: 'text-purple-400', border: 'border-purple-500/20' },
};

export default function OrdersHistoryPage() {
  const [orders,  setOrders]  = useState<(KdsOrder & { _apiId: string })[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState('');
  const [search,  setSearch]  = useState('');
  const [filter,  setFilter]  = useState<'all' | KdsStatus>('all');

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const data = await fetchOrders();
      setOrders(data);
    } catch (e: any) {
      setError(e?.message ?? 'Failed to load orders');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = orders.filter(o => {
    const matchStatus = filter === 'all' || o.status === filter;
    const matchSearch = search === '' ||
      o.id.toLowerCase().includes(search.toLowerCase()) ||
      o.table.includes(search) ||
      o.items.some(i => i.name.toLowerCase().includes(search.toLowerCase()));
    return matchStatus && matchSearch;
  });

  const totalRevenue = orders.reduce((sum, o) => sum + ((o as any)._raw?.totalAmountMinorUnits ?? 0), 0) / 100;
  const delivered    = orders.filter(o => o.status === 'delivered').length;
  const avgItems     = orders.length ? (orders.reduce((s, o) => s + o.items.length, 0) / orders.length).toFixed(1) : '0';

  const stats = [
    { label: 'Total Orders',    value: orders.length,                  icon: ShoppingBag, color: 'text-white'      },
    { label: 'Delivered',       value: delivered,                      icon: CheckCircle, color: 'text-green-400'  },
    { label: 'Revenue',         value: `Rs ${totalRevenue.toFixed(0)}`,icon: DollarSign,  color: 'text-orange-400' },
    { label: 'Avg Items/Order', value: avgItems,                       icon: TrendingUp,  color: 'text-amber-400'  },
  ];

  return (
    <>
      {/* ── Top bar ── */}
      <div className="flex items-center justify-between px-8 py-5 border-b border-white/[0.06] bg-gray-950">
        <div>
          <h1 className="text-[22px] font-bold text-white tracking-tight">Orders History</h1>
          <p className="text-[12px] text-white/30 mt-0.5">All orders · {orders.length} total</p>
        </div>
        <div className="flex items-center gap-2.5">
          <div className="relative">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/25 pointer-events-none" />
            <input
              value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search orders…"
              className="h-9 pl-9 pr-4 rounded-xl w-[200px] text-[13px] bg-gray-900 border border-white/10 text-white placeholder-white/25 focus:outline-none focus:border-orange-500/50 transition"
            />
          </div>
          <button onClick={load}
            className="w-9 h-9 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center hover:bg-orange-500/10 hover:border-orange-500/30 transition-all">
            <RefreshCw size={14} className={`text-white/40 ${loading ? 'animate-spin text-orange-400' : ''}`} />
          </button>
        </div>
      </div>

      <div className="flex-1 p-8 overflow-y-auto bg-gray-950 space-y-6">

        {/* Stats */}
        <div className="grid grid-cols-4 gap-4">
          {stats.map(s => (
            <div key={s.label} className="bg-gray-900 border border-white/[0.07] rounded-2xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <s.icon size={13} className="text-white/25" />
                <p className="text-[10px] text-white/25 uppercase tracking-widest font-semibold">{s.label}</p>
              </div>
              <p className={`text-[26px] font-bold ${s.color} leading-none`}>{s.value}</p>
            </div>
          ))}
        </div>

        {/* Filter tabs */}
        <div className="flex gap-1 bg-white/[0.04] border border-white/[0.06] rounded-xl p-1 w-fit">
          {[
            { key: 'all',       label: 'All Orders'  },
            { key: 'new',       label: '🟠 New'       },
            { key: 'preparing', label: '🔵 Preparing' },
            { key: 'ready',     label: '🟢 Ready'     },
            { key: 'delivered', label: '✓ Delivered'  },
          ].map(f => (
            <button key={f.key} onClick={() => setFilter(f.key as any)}
              className={`px-4 h-8 rounded-[10px] text-[12px] font-semibold transition-all ${
                filter === f.key
                  ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/25'
                  : 'text-white/35 hover:text-white/60'
              }`}>
              {f.label}
            </button>
          ))}
        </div>

        {/* Error */}
        {error && (
          <div className="flex items-center gap-3 p-4 bg-red-500/10 border border-red-500/25 rounded-2xl">
            <WifiOff size={16} className="text-red-400 flex-shrink-0" />
            <p className="text-[13px] text-red-300 flex-1">{error}</p>
            <button onClick={load}
              className="px-3 py-1.5 rounded-xl bg-red-500/10 border border-red-500/25 text-red-400 text-[12px] font-semibold hover:bg-red-500/20 transition-all">
              Retry
            </button>
          </div>
        )}

        {/* Loading skeleton */}
        {loading && (
          <div className="bg-gray-900 border border-white/[0.07] rounded-2xl overflow-hidden">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 px-5 py-4 border-b border-white/[0.04] last:border-0">
                <div className="w-16 h-4 rounded bg-white/5 animate-pulse" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 bg-white/5 rounded animate-pulse w-2/3" />
                  <div className="h-2.5 bg-white/5 rounded animate-pulse w-1/3" />
                </div>
                <div className="w-20 h-6 rounded-full bg-white/5 animate-pulse" />
              </div>
            ))}
          </div>
        )}

        {/* Empty state */}
        {!loading && filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 gap-3 border-2 border-dashed border-white/[0.06] rounded-3xl">
            <span className="text-4xl opacity-20">📋</span>
            <p className="text-[13px] text-white/25">
              {search ? 'No orders match your search' : 'No orders yet'}
            </p>
          </div>
        )}

        {/* Table */}
        {!loading && filtered.length > 0 && (
          <div className="bg-gray-900 border border-white/[0.07] rounded-2xl overflow-hidden">
            {/* Header */}
            <div className="grid gap-3 px-5 py-3 border-b border-white/[0.06] bg-white/[0.02]"
              style={{ gridTemplateColumns: '100px 70px 1fr 110px 110px 120px' }}>
              {['Order ID', 'Table', 'Items', 'Placed At', 'Total', 'Status'].map(h => (
                <p key={h} className="text-[10px] text-white/25 uppercase tracking-widest font-semibold">{h}</p>
              ))}
            </div>

            {/* Rows */}
            {filtered.map(order => {
              const cfg   = STATUS_CFG[order.status];
              const total = (order as any)._raw?.totalAmountMinorUnits;
              return (
                <div key={order.id}
                  className="grid gap-3 px-5 py-3.5 border-b border-white/[0.04] last:border-0 items-center hover:bg-white/[0.02] transition-colors"
                  style={{ gridTemplateColumns: '100px 70px 1fr 110px 110px 120px' }}>

                  <p className="font-mono text-[12px] font-semibold text-orange-400">{order.id}</p>

                  <div className="flex items-center gap-1.5">
                    <Users size={11} className="text-white/25" />
                    <span className="text-[12px] text-white/50 font-medium">{order.table}</span>
                  </div>

                  <div className="min-w-0">
                    <p className="text-[12px] text-white/60 truncate">
                      {order.items.map(i => `${i.emoji} ${i.name} ×${i.qty}`).join(' · ')}
                    </p>
                    <p className="text-[10px] text-white/25 mt-0.5">
                      {order.items.reduce((s, i) => s + i.qty, 0)} item{order.items.reduce((s, i) => s + i.qty, 0) !== 1 ? 's' : ''}
                    </p>
                  </div>

                  <div className="flex items-center gap-1 text-[12px] text-white/35">
                    <Clock size={11} className="text-white/20" />
                    {order.placedAt}
                  </div>

                  <p className="text-[13px] text-orange-300 font-semibold">
                    {total ? `Rs ${(total / 100).toFixed(0)}` : '—'}
                  </p>

                  <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border w-fit ${cfg.bg} ${cfg.border}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
                    <span className={`text-[11px] font-semibold ${cfg.text}`}>{cfg.label}</span>
                  </div>
                </div>
              );
            })}

            {/* Footer */}
            <div className="flex items-center justify-between px-5 py-3 border-t border-white/[0.06] bg-white/[0.01]">
              <p className="text-[11px] text-white/20">
                Showing {filtered.length} of {orders.length} orders
                {search && ` · filtered by "${search}"`}
              </p>
              <p className="text-[11px] text-white/15 font-mono">Source: AWS API Gateway</p>
            </div>
          </div>
        )}
      </div>
    </>
  );
}