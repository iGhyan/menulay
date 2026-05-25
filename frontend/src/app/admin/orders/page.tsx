'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { RefreshCw, Wifi, WifiOff, ChevronRight, Clock, Users } from 'lucide-react';
import { fetchOrders, patchOrderStatus, normaliseOrder, toKdsStatus, WS_URL } from '@/lib/orders-api';
import type { KdsOrder, KdsStatus } from '@/lib/types';

const STATUS_NEXT: Record<KdsStatus, KdsStatus | null> = {
  new: 'preparing', preparing: 'ready', ready: 'delivered', delivered: null,
};

const STATUS_CFG: Record<KdsStatus, { label: string; dot: string; bg: string; text: string; border: string }> = {
  new:       { label: 'New',       dot: 'bg-orange-400',  bg: 'bg-orange-500/10',  text: 'text-orange-400',  border: 'border-orange-500/20' },
  preparing: { label: 'Preparing', dot: 'bg-blue-400',    bg: 'bg-blue-500/10',    text: 'text-blue-400',    border: 'border-blue-500/20'   },
  ready:     { label: 'Ready',     dot: 'bg-green-400',   bg: 'bg-green-500/10',   text: 'text-green-400',   border: 'border-green-500/20'  },
  delivered: { label: 'Delivered', dot: 'bg-purple-400',  bg: 'bg-purple-500/10',  text: 'text-purple-400',  border: 'border-purple-500/20' },
};

const ACTION_CFG: Record<KdsStatus, { label: string; cls: string } | null> = {
  new:       { label: '✓ Accept & Prepare', cls: 'bg-blue-500/15 border border-blue-500/30 text-blue-400 hover:bg-blue-500/25'       },
  preparing: { label: '🔔 Mark Ready',      cls: 'bg-green-500/15 border border-green-500/30 text-green-400 hover:bg-green-500/25'   },
  ready:     { label: '✓ Mark Delivered',   cls: 'bg-purple-500/15 border border-purple-500/30 text-purple-400 hover:bg-purple-500/25'},
  delivered: null,
};

const STAT_COLORS: Record<KdsStatus, string> = {
  new:       'text-orange-400',
  preparing: 'text-blue-400',
  ready:     'text-green-400',
  delivered: 'text-purple-400',
};

export default function AdminOrdersPage() {
  const [orders,    setOrders]    = useState<(KdsOrder & { _apiId: string })[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState('');
  const [filter,    setFilter]    = useState<'all' | KdsStatus>('all');
  const [advancing, setAdvancing] = useState<string | null>(null);
  const [wsState,   setWsState]   = useState<'connecting'|'connected'|'disconnected'>('disconnected');
  const wsRef      = useRef<WebSocket | null>(null);
  const wsRetryRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError('');
    try {
      const data = await fetchOrders();
      setOrders(data);
    } catch (e: any) {
      setError(e?.message ?? 'Failed to load orders');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(() => load(true), 15000);
    return () => clearInterval(id);
  }, [load]);

  const connectWs = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;
    setWsState('connecting');
    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;
    ws.onopen = () => {
      setWsState('connected');
      ws.send(JSON.stringify({ action: 'subscribe', channel: 'orders' }));
    };
    ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data);
        const orderId = msg.orderId ?? msg.order_id;
        if (orderId && msg.flags) {
          const kdsStatus = toKdsStatus('', msg.flags);
          setOrders(prev => prev.map(o => (o as any)._apiId === orderId ? { ...o, status: kdsStatus } : o));
        } else if (msg.lineItems) {
          setOrders(prev => [normaliseOrder(msg) as any, ...prev]);
        }
      } catch {}
    };
    ws.onerror = () => setWsState('disconnected');
    ws.onclose = () => {
      setWsState('disconnected');
      wsRetryRef.current = setTimeout(connectWs, 5000);
    };
  }, []);

  useEffect(() => {
    connectWs();
    return () => {
      wsRetryRef.current && clearTimeout(wsRetryRef.current);
      wsRef.current?.close();
    };
  }, [connectWs]);

  const advance = async (order: KdsOrder & { _apiId: string }) => {
    const next = STATUS_NEXT[order.status];
    if (!next) return;
    setAdvancing(order.id);
    setOrders(prev => prev.map(o => o.id === order.id ? { ...o, status: next } : o));
    try {
      await patchOrderStatus(order._apiId, next);
    } catch {
      setOrders(prev => prev.map(o => o.id === order.id ? { ...o, status: order.status } : o));
    } finally {
      setAdvancing(null);
    }
  };

  const displayed = orders.filter(o => filter === 'all' ? o.status !== 'delivered' : o.status === filter);
  const counts = {
    new:       orders.filter(o => o.status === 'new').length,
    preparing: orders.filter(o => o.status === 'preparing').length,
    ready:     orders.filter(o => o.status === 'ready').length,
    delivered: orders.filter(o => o.status === 'delivered').length,
  };

  return (
    <>
      {/* ── Top bar ── */}
      <div className="flex items-center justify-between px-8 py-5 border-b border-white/[0.06] bg-gray-950">
        <div>
          <h1 className="text-[22px] font-bold text-white tracking-tight">Kitchen Orders</h1>
          <p className="text-[12px] text-white/30 mt-0.5">Live orders · {orders.length} total</p>
        </div>
        <div className="flex items-center gap-2.5">
          {/* WS status */}
          <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-[11px] font-semibold ${
            wsState === 'connected'
              ? 'bg-green-500/10 border-green-500/25 text-green-400'
              : wsState === 'connecting'
              ? 'bg-amber-500/10 border-amber-500/25 text-amber-400'
              : 'bg-red-500/10 border-red-500/25 text-red-400'
          }`}>
            {wsState === 'connected' ? <Wifi size={11} /> : <WifiOff size={11} />}
            WS {wsState === 'connected' ? 'Live' : wsState === 'connecting' ? '…' : 'Off'}
            {wsState === 'connected' && <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />}
          </div>
          <button onClick={() => load()}
            className="w-9 h-9 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center hover:bg-orange-500/10 hover:border-orange-500/30 transition-all">
            <RefreshCw size={14} className={`text-white/40 ${loading ? 'animate-spin text-orange-400' : ''}`} />
          </button>
        </div>
      </div>

      <div className="flex-1 p-8 overflow-y-auto bg-gray-950 space-y-6">

        {/* Stats */}
        <div className="grid grid-cols-4 gap-4">
          {(['new','preparing','ready','delivered'] as KdsStatus[]).map(s => {
            const cfg = STATUS_CFG[s];
            return (
              <div key={s} className="bg-gray-900 border border-white/[0.07] rounded-2xl p-4">
                <div className="flex items-center gap-2 mb-3">
                  <span className={`w-2 h-2 rounded-full ${cfg.dot}`} />
                  <p className="text-[10px] text-white/25 uppercase tracking-widest font-semibold">{cfg.label}</p>
                </div>
                <p className={`text-[28px] font-bold ${STAT_COLORS[s]} leading-none`}>{counts[s]}</p>
              </div>
            );
          })}
        </div>

        {/* Filter tabs */}
        <div className="flex gap-1 bg-white/[0.04] border border-white/[0.06] rounded-xl p-1 w-fit">
          {[
            { key: 'all',       label: 'Active Orders' },
            { key: 'new',       label: '🟠 New'        },
            { key: 'preparing', label: '🔵 Preparing'  },
            { key: 'ready',     label: '🟢 Ready'      },
            { key: 'delivered', label: '✓ Delivered'   },
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
            <button onClick={() => load()}
              className="px-3 py-1.5 rounded-xl bg-red-500/10 border border-red-500/25 text-red-400 text-[12px] font-semibold hover:bg-red-500/20 transition-all">
              Retry
            </button>
          </div>
        )}

        {/* Loading skeleton */}
        {loading && orders.length === 0 && (
          <div className="bg-gray-900 border border-white/[0.07] rounded-2xl overflow-hidden">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 px-5 py-4 border-b border-white/[0.04] last:border-0">
                <div className="w-10 h-10 rounded-xl bg-white/5 animate-pulse flex-shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 bg-white/5 rounded animate-pulse w-1/3" />
                  <div className="h-2.5 bg-white/5 rounded animate-pulse w-1/2" />
                </div>
                <div className="h-8 bg-white/5 rounded-xl animate-pulse w-28" />
              </div>
            ))}
          </div>
        )}

        {/* Empty state */}
        {!loading && displayed.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 gap-3 border-2 border-dashed border-white/[0.06] rounded-3xl">
            <span className="text-4xl opacity-20">✓</span>
            <p className="text-[13px] text-white/25">No orders in this category</p>
          </div>
        )}

        {/* Orders table */}
        {displayed.length > 0 && (
          <div className="bg-gray-900 border border-white/[0.07] rounded-2xl overflow-hidden">
            {/* Header */}
            <div className="grid gap-3 px-5 py-3 border-b border-white/[0.06] bg-white/[0.02]"
              style={{ gridTemplateColumns: '90px 70px 1fr 100px 120px 150px' }}>
              {['Order ID', 'Table', 'Items', 'Total', 'Status', 'Action'].map(h => (
                <p key={h} className="text-[10px] text-white/25 uppercase tracking-widest font-semibold">{h}</p>
              ))}
            </div>

            {/* Rows */}
            {displayed.map(order => {
              const cfg    = STATUS_CFG[order.status];
              const action = ACTION_CFG[order.status];
              const total  = (order as any)._raw?.totalAmountMinorUnits;
              return (
                <div key={order.id}
                  className="grid gap-3 px-5 py-3.5 border-b border-white/[0.04] last:border-0 items-center hover:bg-white/[0.02] transition-colors"
                  style={{ gridTemplateColumns: '90px 70px 1fr 100px 120px 150px' }}>

                  <p className="font-mono text-[12px] font-semibold text-orange-400">{order.id}</p>

                  <div className="flex items-center gap-1.5">
                    <Users size={11} className="text-white/25" />
                    <span className="text-[12px] text-white/50 font-medium">{order.table}</span>
                  </div>

                  <div className="min-w-0">
                    <p className="text-[12px] text-white/60 font-medium truncate">
                      {order.items.map(i => `${i.emoji} ${i.name} ×${i.qty}`).join(' · ')}
                    </p>
                    <p className="text-[10px] text-white/25 flex items-center gap-1 mt-0.5">
                      <Clock size={9} /> {order.placedAt}
                    </p>
                  </div>

                  <p className="text-[13px] text-orange-300 font-semibold">
                    {total ? `Rs ${(total / 100).toFixed(0)}` : '—'}
                  </p>

                  <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border w-fit ${cfg.bg} ${cfg.border}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
                    <span className={`text-[11px] font-semibold ${cfg.text}`}>{cfg.label}</span>
                  </div>

                  {action ? (
                    <button onClick={() => advance(order)} disabled={advancing === order.id}
                      className={`h-8 px-3 rounded-xl text-[11px] font-semibold flex items-center justify-center gap-1 transition-all disabled:opacity-50 ${action.cls}`}>
                      {advancing === order.id
                        ? <RefreshCw size={11} className="animate-spin" />
                        : <>{action.label} <ChevronRight size={11} /></>}
                    </button>
                  ) : (
                    <span className="text-[11px] text-white/20">—</span>
                  )}
                </div>
              );
            })}

            {/* Footer */}
            <div className="flex items-center justify-between px-5 py-3 border-t border-white/[0.06] bg-white/[0.01]">
              <p className="text-[11px] text-white/20">Showing {displayed.length} of {orders.length} orders</p>
              <p className="text-[11px] text-white/15 font-mono">Live · AWS API Gateway</p>
            </div>
          </div>
        )}
      </div>
    </>
  );
}