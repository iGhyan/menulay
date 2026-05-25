'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { MapPin, ShoppingCart, Leaf, Loader2 } from 'lucide-react';

const MENU_RID  = process.env.NEXT_PUBLIC_RESTAURANT_ID || '2687382e-3b00-4f57-9014-f484df89e3fe';
const API_BASE  = process.env.NEXT_PUBLIC_API_BASE      || 'https://g1ou0w5x4m.execute-api.ap-south-1.amazonaws.com/dev';
const TENANT_ID = process.env.NEXT_PUBLIC_TENANT_ID     || 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';

function GuestContent() {
  const params = useSearchParams();
  const qrRid  = params.get('rid') || '';
  const tid    = params.get('tid') || '';
  const tableNum = tid.replace(/^[Tt](?:able[-_]?)?/, '').replace(/\D/g, '') || '—';

  const [zone,           setZone]           = useState('Main Hall');
  const [restaurantName, setRestaurantName] = useState('MenuLay');
  const [tagline,        setTagline]        = useState('Fine Dining Experience');
  const [loadingInfo,    setLoadingInfo]    = useState(true);

  useEffect(() => {
    const n = parseInt(tableNum, 10);
    if (n >= 9 && n <= 10)  setZone('Garden Terrace');
    else if (n >= 11)        setZone('Private Dining');
    else                     setZone('Main Hall');

    if (qrRid)               sessionStorage.setItem('lm_rid',   qrRid);
    if (tid)                 sessionStorage.setItem('lm_tid',   tid);
    if (tableNum !== '—')    sessionStorage.setItem('lm_table', tableNum);

    fetch(`${API_BASE}/menus/restaurants/${MENU_RID}/items`, {
      headers: { 'Content-Type': 'application/json', 'X-Tenant-Id': TENANT_ID },
      cache: 'no-store',
    })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        const items = data?.items ?? data ?? [];
        if (items.length > 0) {
          const firstItem = items[0];
          if (firstItem?.restaurantName)    setRestaurantName(firstItem.restaurantName);
          if (firstItem?.restaurantTagline) setTagline(firstItem.restaurantTagline);
        }
      })
      .catch(() => {})
      .finally(() => setLoadingInfo(false));
  }, [qrRid, tid, tableNum]);

  const isQrScan = params.has('rid') && params.has('tid');

  return (
    <main className="min-h-dvh bg-gray-950 flex flex-col items-center justify-center overflow-hidden">

      {/* Background glows */}
      <div className="fixed top-0 right-0 w-96 h-96 bg-orange-500/10 rounded-full blur-3xl pointer-events-none -translate-y-1/2 translate-x-1/2" />
      <div className="fixed bottom-0 left-0 w-80 h-80 bg-orange-500/5 rounded-full blur-3xl pointer-events-none translate-y-1/2 -translate-x-1/2" />

      <div className="phone-shell animate-fade-up relative">

        {/* ── Header ── */}
        <div className="mx-4 mt-4 rounded-2xl bg-orange-500/10 border border-orange-500/20 px-5 py-4 flex items-center justify-between">
          <div>
            <p className="text-orange-400/70 text-[10px] uppercase tracking-widest font-semibold mb-0.5">Now Open</p>
            <h1 className="text-white text-[24px] font-bold tracking-tight leading-tight">
              {restaurantName}
            </h1>
            <p className="text-orange-300/60 text-[13px] italic mt-0.5">{tagline}</p>
          </div>
          <div className="w-14 h-14 bg-orange-500/15 border border-orange-500/25 rounded-2xl flex items-center justify-center text-3xl">
            🍽️
          </div>
        </div>

        <div className="flex flex-col px-5 pt-4 pb-0 flex-1">

          {/* QR badge */}
          {isQrScan ? (
            <div className="flex items-center gap-2 bg-green-500/10 border border-green-500/20 rounded-full px-3.5 py-2 self-start mb-4">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
              <span className="text-[11px] text-green-400 font-semibold uppercase tracking-widest">
                ✓ QR Verified · Secure Session
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-2 bg-orange-500/10 border border-orange-500/20 rounded-full px-3.5 py-2 self-start mb-4">
              <span className="w-1.5 h-1.5 rounded-full bg-orange-400" />
              <span className="text-[11px] text-orange-400 font-semibold uppercase tracking-widest">
                Guest Session · Demo Mode
              </span>
            </div>
          )}

          {/* Table card */}
          <div className="bg-gray-900 border border-white/[0.07] rounded-2xl p-4 flex items-center gap-3.5 mb-4">
            <div className="w-12 h-12 rounded-[14px] bg-orange-500/15 border border-orange-500/25 flex items-center justify-center flex-shrink-0">
              <MapPin size={20} className="text-orange-400" />
            </div>
            <div className="flex-1">
              <p className="text-[10px] text-white/25 uppercase tracking-widest font-semibold mb-0.5">Your Table</p>
              <p className="text-[20px] font-bold text-white leading-tight">
                {tableNum !== '—' ? `Table ${tableNum}` : 'Walk-in Guest'}
              </p>
              <p className="text-[12px] text-white/35">{zone}</p>
            </div>
            <div className="w-7 h-7 rounded-full bg-green-500/15 border border-green-500/25 flex items-center justify-center">
              <span className="text-green-400 text-xs font-bold">✓</span>
            </div>
          </div>

          {/* Session info */}
          {isQrScan && (
            <div className="flex gap-2 mb-4">
              <div className="flex-1 bg-white/[0.03] border border-white/[0.06] rounded-xl p-2.5">
                <p className="text-[10px] text-white/25 uppercase tracking-widest font-semibold mb-0.5">Restaurant ID</p>
                <p className="text-[11px] text-white/40 font-mono truncate">
                  {qrRid ? `${qrRid.slice(0, 8)}…` : MENU_RID.slice(0, 8) + '…'}
                </p>
              </div>
              <div className="flex-1 bg-white/[0.03] border border-white/[0.06] rounded-xl p-2.5">
                <p className="text-[10px] text-white/25 uppercase tracking-widest font-semibold mb-0.5">Table ID</p>
                <p className="text-[12px] text-white/60 font-semibold">{tid || '—'}</p>
              </div>
            </div>
          )}

        </div>

        {/* ── Footer CTAs ── */}
        <div className="px-5 pb-6 flex flex-col gap-3">
          <Link
            href={`/guest/menu?rid=${qrRid}&tid=${tid}`}
            className="flex items-center justify-center gap-2 h-14 rounded-2xl text-[15px] font-bold bg-orange-500 hover:bg-orange-600 text-white transition-all shadow-lg shadow-orange-500/30 active:scale-[0.98]"
          >
            <ShoppingCart size={18} />
            Browse Our Menu
          </Link>
          <button className="flex items-center justify-center gap-2 h-11 rounded-2xl text-[13px] font-semibold bg-white/[0.04] border border-white/[0.08] text-white/50 hover:bg-white/[0.07] hover:text-white/70 transition-all">
            <Leaf size={15} />
            View Allergen Guide
          </button>
        </div>

        {/* ── Bottom nav ── */}
        <div className="flex justify-around items-center px-5 pt-3.5 pb-7 border-t border-white/[0.06] bg-gray-900/80 backdrop-blur-sm">
          {[
            { icon: '🏠', label: 'Home',   href: '/guest'          },
            { icon: '📖', label: 'Menu',   href: '/guest/menu', active: true },
            { icon: '🛒', label: 'Cart',   href: '/guest/cart'     },
            { icon: '🕐', label: 'Orders', href: '/guest/tracking' },
          ].map(n => (
            <Link key={n.label} href={n.href}
              className={`flex flex-col items-center gap-1 px-2.5 py-1 transition-all ${
                n.active ? 'text-orange-400' : 'text-white/20 hover:text-white/40'
              }`}>
              <span className="text-[20px]">{n.icon}</span>
              <span className={`text-[10px] font-semibold ${n.active ? 'text-orange-400' : ''}`}>{n.label}</span>
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}

export default function GuestLandingPage() {
  return (
    <Suspense fallback={
      <main className="min-h-dvh bg-gray-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 size={28} className="animate-spin text-orange-400" />
          <p className="text-[13px] text-white/30">Loading…</p>
        </div>
      </main>
    }>
      <GuestContent />
    </Suspense>
  );
}