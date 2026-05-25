'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Volume2, VolumeX, RefreshCw, Wifi, WifiOff, Radio, LogOut } from 'lucide-react';
import { formatTimer, timerColorClass, timerBarColor, playNewOrderBeep } from '@/lib/utils';
import { fetchOrders, patchOrderStatus, normaliseOrder, toKdsStatus, WS_URL } from '@/lib/orders-api';
import type { KdsOrder, KdsStatus } from '@/lib/types';
import { useAuth } from '@/hooks/useAuth';
import { connectWebSocket } from '@/lib/orders-api'

type Filter  = 'all' | 'new' | 'preparing' | 'ready' | 'delivered';
type WsState = 'connecting' | 'connected' | 'disconnected' | 'error';

const STATUS_NEXT: Record<KdsStatus, KdsStatus | null> = {
  new: 'preparing', preparing: 'ready', ready: 'delivered', delivered: null,
};
const STATUS_ORDER: Record<KdsStatus, number> = {
  new: 0, preparing: 1, ready: 2, delivered: 3,
};
const STATUS_RANK: Record<string, number> = {
  new: 0, preparing: 1, ready: 2, delivered: 3,
};
const STRIP: Record<KdsStatus, string> = {
  new:       'bg-orange-400',
  preparing: 'bg-blue-500',
  ready:     'bg-green-500',
  delivered: 'bg-purple-500',
};
const BTN_CFG: Record<KdsStatus, { label: string; cls: string }[]> = {
  new: [
    { label: '✓ Accept',     cls: 'bg-blue-500/15 border-blue-500/30 text-blue-400 hover:bg-blue-500/25'   },
    { label: '🔥 Preparing', cls: 'bg-orange-500/15 border-orange-500/30 text-orange-400 hover:bg-orange-500/25' },
  ],
  preparing: [{ label: '🔔 Mark Ready', cls: 'bg-green-500/15 border-green-500/30 text-green-400 hover:bg-green-500/25'  }],
  ready:     [{ label: '✓ Delivered',   cls: 'bg-purple-500/15 border-purple-500/30 text-purple-400 hover:bg-purple-500/25' }],
  delivered: [{ label: '✓ Completed',   cls: 'bg-white/5 border-white/10 text-white/25 cursor-default'                      }],
};

const POLL_INTERVAL = 15000;

export default function KitchenDisplayPage() {
  const router = useRouter();
  const { user, logout } = useAuth();
  const [loggingOut, setLoggingOut] = useState(false);

  const [orders,    setOrders]    = useState<KdsOrder[]>([]);
  const [filter,    setFilter]    = useState<Filter>('all');
  const [audio,     setAudio]     = useState(true);
  const [toast,     setToast]     = useState<string | null>(null);
  const [clock,     setClock]     = useState('');
  const [pollPct,   setPollPct]   = useState(0);
  const [apiState,  setApiState]  = useState<'loading' | 'live' | 'error'>('loading');
  const [apiError,  setApiError]  = useState('');
  const [wsState,   setWsState]   = useState<WsState>('disconnected');
  const [wsLog,     setWsLog]     = useState<string[]>([]);
  const [advancing, setAdvancing] = useState<string | null>(null);

  const pollStart  = useRef(Date.now());
  const prevIds    = useRef<Set<string>>(new Set());
  const wsRef      = useRef<WebSocket | null>(null);
  const wsRetryRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  async function handleLogout() {
    setLoggingOut(true);
    await logout();
    router.push('/login/kds');
  }

  useEffect(() => {
    const tick = () => {
      const n = new Date();
      setClock([n.getHours(), n.getMinutes(), n.getSeconds()].map(x => String(x).padStart(2,'0')).join(':'));
    };
    tick(); const id = setInterval(tick, 1000); return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const id = setInterval(() => {
      setOrders(prev => prev.map(o =>
        o.status !== 'delivered'
          ? { ...o, elapsedSeconds: Math.min(o.elapsedSeconds + 1, o.maxSeconds + 300) }
          : o,
      ));
    }, 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const id = setInterval(() => {
      const pct = ((Date.now() - pollStart.current) % POLL_INTERVAL) / POLL_INTERVAL * 100;
      setPollPct(Math.min(100, pct));
    }, 200);
    return () => clearInterval(id);
  }, []);

  const showToast = (msg: string) => {
    setToast(msg); setTimeout(() => setToast(null), 5000);
  };

  const addWsLog = (msg: string) => {
    const time = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    setWsLog(prev => [`[${time}] ${msg}`, ...prev.slice(0, 9)]);
  };

  const connectWs = useCallback(async () => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;
    setWsState('connecting');
    addWsLog('Connecting to WebSocket…');
    const ws = await connectWebSocket()
    wsRef.current = ws;
    ws.onopen = () => {
      setWsState('connected');
      addWsLog('✓ Connected to WebSocket');
      ws.send(JSON.stringify({ action: 'subscribe', channel: 'orders' }));
    };
    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        addWsLog(`← ${JSON.stringify(msg).slice(0, 80)}`);
        const orderId = msg.orderId ?? msg.order_id;
        const status  = msg.status  ?? msg.orderStatus;
        const flags   = msg.flags;
        if (orderId && (status || flags)) {
          const kdsStatus = toKdsStatus(status ?? '', flags);
          const shortId   = orderId.slice(0, 6).toUpperCase();
          const displayId = `LM-${shortId}`;
          setOrders(prev => {
            const exists = prev.find(o => (o as any)._apiId === orderId || o.id === displayId);
            if (exists) {
              showToast(`📡 WS: Order #${displayId} → ${kdsStatus.toUpperCase()}`);
              return prev.map(o =>
                ((o as any)._apiId === orderId || o.id === displayId) ? { ...o, status: kdsStatus } : o,
              );
            } else if (msg.lineItems || msg.items) {
              const newOrder = normaliseOrder(msg);
              showToast(`🔔 WS: New order #${newOrder.id} — Table ${newOrder.table}`);
              if (audio) playNewOrderBeep();
              return [newOrder, ...prev];
            }
            return prev;
          });
        }
      } catch {
        addWsLog(`← (non-JSON) ${event.data?.slice(0, 60)}`);
      }
    };
    ws.onerror = () => { setWsState('error'); addWsLog('✗ WebSocket error'); };
    ws.onclose = (e) => {
      setWsState('disconnected');
      addWsLog(`✗ Disconnected (code ${e.code})`);
      if (wsRetryRef.current) clearTimeout(wsRetryRef.current);
      wsRetryRef.current = setTimeout(connectWs, 5000);
    };
  }, [audio]);

  useEffect(() => {
    connectWs();
    return () => {
      if (wsRetryRef.current) clearTimeout(wsRetryRef.current);
      wsRef.current?.close();
    };
  }, [connectWs]);

  const wsSend = (payload: object) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      const msg = JSON.stringify(payload);
      wsRef.current.send(msg);
      addWsLog(`→ ${msg.slice(0, 80)}`);
    }
  };

  const loadOrders = useCallback(async (silent = false) => {
    if (!silent) setApiState('loading');
    try {
      const fresh    = await fetchOrders();
      const freshIds = new Set(fresh.map((o: any) => o.id));
      const newOnes  = fresh.filter((o: any) => !prevIds.current.has(o.id));
      if (newOnes.length > 0 && prevIds.current.size > 0) {
        newOnes.forEach((o: any) => {
          showToast(`🔔 New order #${o.id} — Table ${o.table}`);
          if (audio) playNewOrderBeep();
        });
      }
      prevIds.current = freshIds;
      setOrders(prev => {
        const prevMap = new Map(prev.map(o => [o.id, o]));
        return fresh.map((o: any) => {
          const existing     = prevMap.get(o.id);
          if (!existing)     return o;
          const existingRank = STATUS_RANK[existing.status] ?? 0;
          const freshRank    = STATUS_RANK[o.status] ?? 0;
          const status = existingRank > freshRank ? existing.status : o.status;
          return { ...o, status, elapsedSeconds: existing.elapsedSeconds, items: existing.items };
        });
      });
      setApiState('live');
      pollStart.current = Date.now();
    } catch (err: any) {
      setApiError(err?.message ?? 'Failed to fetch orders');
      setApiState('error');
    }
  }, [audio]);

  useEffect(() => {
    loadOrders();
    const id = setInterval(() => loadOrders(true), POLL_INTERVAL);
    return () => clearInterval(id);
  }, [loadOrders]);

  const advanceOrder = async (orderId: string) => {
    const order = orders.find(o => o.id === orderId);
    if (!order) return;
    const next = STATUS_NEXT[order.status];
    if (!next) return;
    setAdvancing(orderId);
    setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: next } : o));
    try {
      const apiId = (order as any)._apiId ?? orderId;
      await patchOrderStatus(apiId, next);
      wsSend({ action: 'orderStatusUpdate', orderId: apiId, status: next });
      showToast(`Order #${orderId} → ${next.toUpperCase()}`);
    } catch (err: any) {
      setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: order.status } : o));
      showToast(`⚠ Failed: ${err?.message}`);
    } finally {
      setAdvancing(null);
    }
  };

  const toggleDish = (orderId: string, idx: number) => {
    setOrders(prev => prev.map(o => {
      if (o.id !== orderId) return o;
      const items = o.items.map((it, i) => i === idx ? { ...it, done: !it.done } : it);
      return { ...o, items };
    }));
  };

  const filtered = orders
    .filter(o => {
      if (filter === 'all')       return o.status !== 'delivered';
      if (filter === 'delivered') return o.status === 'delivered';
      return o.status === filter;
    })
    .sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status] || b.elapsedSeconds - a.elapsedSeconds);

  const counts = {
    pending:   orders.filter(o => o.status === 'new').length,
    preparing: orders.filter(o => o.status === 'preparing').length,
    ready:     orders.filter(o => o.status === 'ready').length,
  };

  return (
    <div className="min-h-dvh bg-gray-950 flex flex-col font-sans">

      {/* ── Toast ── */}
      {toast && (
        <div className="fixed top-20 right-5 z-50 bg-gray-900 border border-orange-500/30 rounded-2xl px-4 py-3 flex items-center gap-3 shadow-2xl max-w-[320px]">
          <div className="w-8 h-8 rounded-xl bg-orange-500/15 flex items-center justify-center text-base flex-shrink-0">🔔</div>
          <p className="text-[13px] font-semibold text-white/80">{toast}</p>
        </div>
      )}

      {/* ── Header ── */}
      <header className="flex items-center justify-between px-6 py-3.5 bg-gray-900 border-b border-white/[0.06]">

        {/* Left — brand */}
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-orange-500/15 border border-orange-500/25 flex items-center justify-center text-base">🍽️</div>
          <div>
            <p className="text-[17px] font-bold text-white tracking-tight">Das Perdas · KDS</p>
            <p className="text-[10px] text-white/25 uppercase tracking-widest font-semibold">Kitchen Display System</p>
          </div>
        </div>

        {/* Center — clock + status badges */}
        <div className="flex items-center gap-3">
          <div className="text-center">
            <p className="font-mono text-[20px] text-white font-bold">{clock || '00:00:00'}</p>
            <p className="text-[10px] text-white/25">
              {new Date().toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short' })}
            </p>
          </div>

          {/* REST status */}
          <div className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 border ${
            apiState === 'live'  ? 'bg-green-500/10 border-green-500/25' :
            apiState === 'error' ? 'bg-red-500/10 border-red-500/25'     :
                                   'bg-amber-500/10 border-amber-500/25'
          }`}>
            {apiState === 'live'
              ? <><Wifi size={11} className="text-green-400" /><span className="text-[10px] text-green-400 font-semibold uppercase tracking-widest">REST Live</span></>
              : apiState === 'error'
              ? <><WifiOff size={11} className="text-red-400" /><span className="text-[10px] text-red-400 font-semibold">API Error</span></>
              : <><RefreshCw size={11} className="text-amber-400 animate-spin" /><span className="text-[10px] text-amber-400 font-semibold">Loading…</span></>
            }
          </div>

          {/* WS status */}
          <div className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 border ${
            wsState === 'connected'  ? 'bg-green-500/10 border-green-500/25'  :
            wsState === 'connecting' ? 'bg-amber-500/10 border-amber-500/25'  :
                                       'bg-red-500/10 border-red-500/25'
          }`}>
            <Radio size={11} className={
              wsState === 'connected'  ? 'text-green-400'  :
              wsState === 'connecting' ? 'text-amber-400'  : 'text-red-400'
            } />
            <span className={`text-[10px] font-semibold uppercase tracking-widest ${
              wsState === 'connected'  ? 'text-green-400'  :
              wsState === 'connecting' ? 'text-amber-400'  : 'text-red-400'
            }`}>
              WS {wsState === 'connected' ? 'Live' : wsState === 'connecting' ? '…' : 'Off'}
            </span>
            {wsState === 'connected' && <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />}
          </div>
        </div>

        {/* Right — counters + audio + logout */}
        <div className="flex items-center gap-2.5">
          {[
            { val: counts.pending,   label: 'Pending',   cls: 'text-orange-400' },
            { val: counts.preparing, label: 'Preparing', cls: 'text-blue-400'   },
            { val: counts.ready,     label: 'Ready',     cls: 'text-green-400'  },
          ].map(s => (
            <div key={s.label} className="flex flex-col items-center px-3.5 py-1.5 rounded-xl bg-white/5 border border-white/10">
              <span className={`text-[18px] font-bold ${s.cls}`}>{s.val}</span>
              <span className="text-[9px] text-white/25 uppercase tracking-widest font-semibold">{s.label}</span>
            </div>
          ))}

          <button onClick={() => setAudio(!audio)}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl border text-[12px] font-semibold transition-all ${
              audio ? 'bg-white/5 border-white/10 text-white/60 hover:bg-white/10' : 'bg-red-500/10 border-red-500/25 text-red-400'
            }`}>
            {audio ? <Volume2 size={14} /> : <VolumeX size={14} />} Audio {audio ? 'On' : 'Off'}
          </button>

          <button
            onClick={handleLogout} disabled={loggingOut}
            title={`Sign out ${user?.displayName || ''}`}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-red-500/25 bg-red-500/10 text-red-400 text-[12px] font-semibold hover:bg-red-500/20 transition-all disabled:opacity-50">
            <LogOut size={14} className={loggingOut ? 'animate-spin' : ''} />
            {loggingOut ? 'Signing out…' : 'Sign Out'}
          </button>
        </div>
      </header>

      {/* ── Poll progress ── */}
      <div className="h-[2px] bg-white/[0.04]">
        <div className="h-full bg-orange-500/40 transition-all duration-200" style={{ width: `${pollPct}%` }} />
      </div>

      {/* ── API error banner ── */}
      {apiState === 'error' && (
        <div className="flex items-center gap-3 px-6 py-2.5 bg-red-500/10 border-b border-red-500/20">
          <WifiOff size={14} className="text-red-400 flex-shrink-0" />
          <p className="text-[12px] text-red-300 flex-1">{apiError}</p>
          <button onClick={() => loadOrders()}
            className="px-3 py-1 rounded-lg bg-red-500/15 border border-red-500/25 text-red-400 text-[12px] font-semibold hover:bg-red-500/25 transition-all">
            Retry
          </button>
        </div>
      )}

      {/* ── Filter bar ── */}
      <div className="flex items-center gap-2 px-6 py-3 bg-gray-900/50 border-b border-white/[0.06]">
        {([
          { key: 'all',       label: 'All Orders',  cls: 'bg-white/10 border-white/20 text-white'           },
          { key: 'new',       label: '🟠 New',        cls: 'bg-orange-500 border-orange-500 text-white'       },
          { key: 'preparing', label: '🔵 Preparing',  cls: 'bg-blue-600 border-blue-600 text-white'           },
          { key: 'ready',     label: '🟢 Ready',      cls: 'bg-green-600 border-green-600 text-white'         },
        ] as const).map(f => (
          <button key={f.key} onClick={() => setFilter(f.key)}
            className={`px-3.5 py-1.5 rounded-full border text-[12px] font-semibold transition-all ${
              filter === f.key ? f.cls : 'bg-white/[0.03] border-white/10 text-white/40 hover:border-white/20 hover:text-white/60'
            }`}>
            {f.label}
          </button>
        ))}
        <div className="w-px h-5 bg-white/10 mx-1" />
        <button onClick={() => setFilter('delivered')}
          className={`text-[11px] px-3.5 py-1.5 rounded-full border font-semibold transition-all ${
            filter === 'delivered' ? 'bg-purple-500 border-purple-500 text-white' : 'bg-white/[0.03] border-white/10 text-white/35 hover:text-white/55'
          }`}>
          ✓ Delivered
        </button>
      </div>

      {/* ── WS log bar ── */}
      {wsLog.length > 0 && (
        <div className="px-6 py-2 bg-gray-950 border-b border-white/[0.04] flex items-center gap-3 overflow-hidden">
          <Radio size={12} className="text-green-400 flex-shrink-0" />
          <p className="text-[10px] text-green-400/70 font-mono truncate">{wsLog[0]}</p>
          <span className="text-[9px] text-white/20 flex-shrink-0">{wsLog.length} events</span>
        </div>
      )}

      {/* ── Loading state ── */}
      {apiState === 'loading' && orders.length === 0 && (
        <div className="flex-1 flex flex-col items-center justify-center gap-4">
          <RefreshCw size={32} className="text-orange-400/50 animate-spin" />
          <p className="text-[14px] text-white/30 font-medium">Loading orders from API…</p>
          <p className="text-[11px] text-white/20 font-mono">GET /orders?tenantId=t123&restaurantId=r456</p>
        </div>
      )}

      {/* ── Order cards grid ── */}
      {(apiState !== 'loading' || orders.length > 0) && (
        <div className="flex-1 grid grid-cols-3 gap-4 p-5 content-start overflow-y-auto">

          {filtered.length === 0 && (
            <div className="col-span-3 flex flex-col items-center justify-center py-16 gap-3 border-2 border-dashed border-white/[0.06] rounded-3xl">
              <span className="text-4xl opacity-20">✓</span>
              <p className="text-[13px] text-white/25 font-medium">No orders in this category</p>
              <p className="text-[11px] text-white/20">
                {orders.length === 0 ? 'Waiting for orders…' : `${orders.length} orders in other categories`}
              </p>
            </div>
          )}

          {filtered.map(order => {
            const pct         = Math.min(100, (order.elapsedSeconds / order.maxSeconds) * 100);
            const isUrgent    = pct >= 90;
            const isAdvancing = advancing === order.id;
            const allDone     = order.items.every(i => i.done);

            return (
              <div key={order.id}
                className={`bg-gray-900 rounded-3xl flex flex-col border transition-all hover:-translate-y-0.5 hover:shadow-xl ${
                  isUrgent
                    ? 'border-red-500/40 shadow-[0_0_0_2px_rgba(239,68,68,0.08)]'
                    : 'border-white/[0.07] shadow-lg'
                }`}>

                {/* Status strip */}
                <div className={`h-1.5 rounded-t-3xl ${STRIP[order.status]}`} />

                {/* Card header */}
                <div className="flex items-start justify-between px-4 py-3.5 border-b border-white/[0.06]">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-mono text-[13px] font-bold text-white/70">#{order.id}</p>
                      {allDone && order.status !== 'delivered' && (
                        <span className="text-[9px] bg-green-500/15 border border-green-500/25 text-green-400 px-1.5 py-0.5 rounded-full font-bold">ALL DONE</span>
                      )}
                    </div>
                    <p className="text-[11px] text-white/30 mt-0.5">🪑 Table {order.table} · {order.zone}</p>
                  </div>
                  <div className="text-right">
                    <p className={`font-mono text-[20px] font-bold ${timerColorClass(order.elapsedSeconds, order.maxSeconds)}`}>
                      {formatTimer(order.elapsedSeconds)}
                    </p>
                    <p className="text-[10px] text-white/25">Placed {order.placedAt}</p>
                  </div>
                </div>

                {/* Timer bar */}
                <div className="h-1.5 bg-white/[0.05]">
                  <div className="h-full rounded-full transition-all duration-1000"
                    style={{ width: `${pct}%`, background: timerBarColor(order.elapsedSeconds, order.maxSeconds) }} />
                </div>

                {/* Items */}
                <div className="flex flex-col gap-2 px-4 py-3 flex-1">
                  {order.items.map((dish, i) => (
                    <div key={i} className="flex items-center gap-2.5">
                      <span className="text-[18px] w-8 text-center">{dish.emoji}</span>
                      <div className="flex-1 min-w-0">
                        <p className={`text-[12px] font-semibold truncate ${dish.done ? 'line-through text-white/20' : 'text-white/70'}`}>
                          {dish.name}
                        </p>
                        {dish.mods && <p className="text-[10px] text-white/25">{dish.mods}</p>}
                      </div>
                      <span className="text-[12px] text-white/35 font-semibold">×{dish.qty}</span>
                      <button onClick={() => toggleDish(order.id, i)}
                        className={`w-5 h-5 rounded-[5px] border flex items-center justify-center transition-all ${
                          dish.done ? 'bg-orange-500 border-orange-500' : 'border-white/15 hover:bg-white/5'
                        }`}>
                        {dish.done && <span className="text-white text-[11px] font-bold">✓</span>}
                      </button>
                    </div>
                  ))}
                </div>

                {/* Note */}
                {order.note && (
                  <div className="mx-4 mb-2 p-2 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-start gap-1.5">
                    <span className="text-amber-400 text-xs mt-0.5">⚠</span>
                    <p className="text-[10px] text-amber-300/80 leading-relaxed font-medium">{order.note}</p>
                  </div>
                )}

                {/* Action buttons */}
                <div className="flex gap-2 px-4 py-3 border-t border-white/[0.06]">
                  {BTN_CFG[order.status].map((btn, i) => (
                    <button key={btn.label}
                      onClick={() => i === 0 && advanceOrder(order.id)}
                      disabled={order.status === 'delivered' || isAdvancing}
                      className={`flex-1 h-9 rounded-xl flex items-center justify-center gap-1.5 text-[12px] font-semibold border transition-all disabled:opacity-40 ${btn.cls}`}>
                      {isAdvancing && i === 0
                        ? <RefreshCw size={12} className="animate-spin" />
                        : btn.label}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}