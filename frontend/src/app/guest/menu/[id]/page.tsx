'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Share2, Heart, Clock, Cuboid, Loader2, AlertCircle, Send } from 'lucide-react';
import Link from 'next/link';
import { formatPrice } from '@/lib/data';
import { fetchMenuItem, normaliseItem, type ApiMenuItem } from '@/lib/menu-api';

const TAG_STYLES: Record<string, string> = {
  veg:     'bg-green-500/10 border border-green-500/20 text-green-400',
  spicy:   'bg-red-500/10 border border-red-500/20 text-red-400',
  new:     'bg-orange-500/10 border border-orange-500/20 text-orange-400',
  popular: 'bg-purple-500/10 border border-purple-500/20 text-purple-400',
  chef:    'bg-amber-500/10 border border-amber-500/20 text-amber-400',
};

const TENANT_ID     = process.env.NEXT_PUBLIC_TENANT_ID_KDS     ?? 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
const RESTAURANT_ID = process.env.NEXT_PUBLIC_RESTAURANT_ID_KDS ?? '2687382e-3b00-4f57-9014-f484df89e3fe';

export default function ItemDetailPage() {
  const { id }  = useParams<{ id: string }>();
  const router  = useRouter();

  const [item,     setItem]     = useState<ApiMenuItem | null>(null);
  const [rawItem,  setRawItem]  = useState<any>(null);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState('');
  const [qty,      setQty]      = useState(1);
  const [wished,   setWished]   = useState(false);
  const [doneness, setDoneness] = useState('');
  const [side,     setSide]     = useState('');
  const [sauce,    setSauce]    = useState('');
  const [arReady,  setArReady]  = useState<boolean | null>(null);
  const [placing,  setPlacing]  = useState(false);
  const [placed,   setPlaced]   = useState(false);
  const [orderId,  setOrderId]  = useState('');
  const [orderErr, setOrderErr] = useState('');

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    const menuRid = process.env.NEXT_PUBLIC_ADMIN_RESTAURANT_ID
      || process.env.NEXT_PUBLIC_RESTAURANT_ID
      || '2687382e-3b00-4f57-9014-f484df89e3fe';
    fetchMenuItem(id, menuRid)
      .then(raw => {
        setRawItem(raw);
        const normalised = normaliseItem(raw);
        setItem(normalised);
        setDoneness(normalised.customisations?.doneness?.[1] ?? '');
        setSide(normalised.customisations?.sides?.[0] ?? '');
        setSauce(normalised.customisations?.sauces?.[0] ?? '');
        setLoading(false);
        setArReady(!!(raw as any).arModelUrl || !!(raw as any).arModelKey);
      })
      .catch(e => { setError(e?.message ?? 'Failed to load item'); setLoading(false); });
  }, [id]);

  const placeOrder = async () => {
    if (!item) return;
    setPlacing(true); setOrderErr('');
    try {
      const tableId = (typeof window !== 'undefined' ? sessionStorage.getItem('lm_tid') : null) ?? 'table-01';
      const payload = {
        tenantId: TENANT_ID, restaurantId: RESTAURANT_ID, tableId,
        currencyCode: 'PKR',
        totalAmountMinorUnits: Math.round(item.price * qty * 100),
        lineItems: [{ itemId: item.id, name: item.name, quantity: qty,
          unitPriceMinorUnits: Math.round(item.price * 100),
          totalPriceMinorUnits: Math.round(item.price * qty * 100) }],
      };
      const res  = await fetch('/api/orders', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? data?.message ?? `Error ${res.status}`);
      setOrderId(data.orderId ?? '');
      setPlaced(true);
    } catch (err: any) {
      setOrderErr(err?.message ?? 'Order failed. Please try again.');
    } finally {
      setPlacing(false);
    }
  };

  // ── Loading ──
  if (loading) return (
    <main className="min-h-dvh bg-gray-950 flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <Loader2 size={28} className="animate-spin text-orange-400" />
        <p className="text-[13px] text-white/30">Loading item…</p>
      </div>
    </main>
  );

  // ── Error ──
  if (error || !item) return (
    <main className="min-h-dvh bg-gray-950 flex items-center justify-center px-6">
      <div className="flex flex-col items-center gap-3 text-center">
        <AlertCircle size={32} className="text-red-400" />
        <p className="text-[14px] font-bold text-white/70">Item not found</p>
        <p className="text-[12px] text-white/30">{error}</p>
        <button onClick={() => router.back()}
          className="px-4 py-2 rounded-xl bg-orange-500/10 border border-orange-500/25 text-orange-400 text-[13px] font-semibold">
          ← Go Back
        </button>
      </div>
    </main>
  );

  // ── Order success ──
  if (placed) return (
    <main className="min-h-dvh bg-gray-950 flex flex-col items-center">
      <div className="phone-shell">
        <div className="flex-1 flex flex-col items-center justify-center px-6 pb-10">
          <div className="relative w-[100px] h-[100px] mb-6">
            <div className="absolute inset-0 rounded-full border border-orange-500/30" />
            <div className="absolute -inset-2 rounded-full border border-orange-500/15 animate-pulse" />
            <div className="absolute inset-0 rounded-full bg-orange-500/15 flex items-center justify-center text-4xl">✓</div>
          </div>
          <h2 className="text-[26px] font-bold text-white tracking-tight mb-2 text-center">Order Placed!</h2>
          <p className="text-[14px] text-white/35 text-center leading-relaxed mb-4 px-4">
            Your <strong className="text-white/60">{item.name}</strong> × {qty} has been sent to the kitchen.
          </p>
          {orderId && (
            <div className="bg-orange-500/10 border border-orange-500/25 rounded-full px-5 py-2 mb-8">
              <span className="text-[13px] text-orange-400 font-semibold font-mono">
                #{orderId.slice(0, 8).toUpperCase()}
              </span>
            </div>
          )}
          <div className="flex flex-col gap-3 w-full max-w-[280px]">
            <button onClick={() => router.push('/guest/tracking')}
              className="h-12 rounded-2xl bg-orange-500 hover:bg-orange-600 text-white text-[14px] font-bold flex items-center justify-center gap-2 shadow-lg shadow-orange-500/25 transition-all">
              📡 Track My Order
            </button>
            <button onClick={() => { setPlaced(false); setQty(1); }}
              className="h-12 rounded-2xl bg-white/[0.05] border border-white/[0.08] text-white/50 text-[14px] font-medium hover:bg-white/[0.08] transition-all">
              Order Again
            </button>
            <button onClick={() => router.push('/guest/menu')}
              className="h-12 rounded-2xl bg-white/[0.05] border border-white/[0.08] text-white/50 text-[14px] font-medium hover:bg-white/[0.08] transition-all">
              ← Back to Menu
            </button>
          </div>
        </div>
      </div>
    </main>
  );

  const rid        = process.env.NEXT_PUBLIC_RESTAURANT_ID || '2687382e-3b00-4f57-9014-f484df89e3fe';
  const arModelUrl = rawItem?.arModelUrl ?? '';
  const arHref     = `/guest/ar?rid=${encodeURIComponent(rid)}&iid=${encodeURIComponent(id)}&name=${encodeURIComponent(item.name)}&emoji=${encodeURIComponent(item.emoji ?? '🍽️')}${arModelUrl ? '&url=' + encodeURIComponent(arModelUrl) : ''}`;

  return (
    <main className="min-h-dvh bg-gray-950 flex flex-col items-center">
      <div className="phone-shell">

        {/* ── Hero ── */}
        <div className="relative w-full h-[210px] flex items-center justify-center text-[88px] bg-gradient-to-br from-orange-500/10 to-gray-900">
          <span className="drop-shadow-lg">{item.emoji}</span>

          <button onClick={() => router.back()}
            className="absolute top-3 left-4 w-9 h-9 rounded-xl bg-gray-950/80 backdrop-blur border border-white/10 flex items-center justify-center hover:bg-gray-900 transition-all">
            <ArrowLeft size={16} className="text-white/60" />
          </button>
          <button onClick={() => setWished(!wished)}
            className={`absolute top-3 right-14 w-9 h-9 rounded-xl backdrop-blur border flex items-center justify-center transition-all ${
              wished ? 'bg-red-500/20 border-red-500/30' : 'bg-gray-950/80 border-white/10 hover:bg-gray-900'
            }`}>
            <Heart size={16} className={wished ? 'text-red-400 fill-red-400' : 'text-white/40'} />
          </button>
          <button className="absolute top-3 right-4 w-9 h-9 rounded-xl bg-gray-950/80 backdrop-blur border border-white/10 flex items-center justify-center hover:bg-gray-900 transition-all">
            <Share2 size={16} className="text-white/40" />
          </button>

          {/* Tags */}
          <div className="absolute bottom-3.5 left-4 flex gap-1.5">
            {(item.tags ?? []).filter(t => t !== 'chef').map(tag => (
              <span key={tag} className={`text-[10px] px-2 py-0.5 rounded-full font-semibold backdrop-blur ${TAG_STYLES[tag] ?? ''}`}>
                {tag.charAt(0).toUpperCase() + tag.slice(1)}
              </span>
            ))}
          </div>

          {/* AR button */}
          {arReady === true && (
            <Link href={arHref}
              className="absolute bottom-3.5 right-4 flex items-center gap-1.5 bg-gray-950/80 backdrop-blur border border-orange-500/30 rounded-full px-2.5 py-1.5 hover:bg-orange-500/10 transition-all">
              <Cuboid size={12} className="text-orange-400" />
              <span className="text-[10px] text-orange-400 font-semibold">View in AR</span>
            </Link>
          )}
          {arReady === null && (
            <div className="absolute bottom-3.5 right-4 flex items-center gap-1.5 bg-gray-950/60 border border-white/10 rounded-full px-2.5 py-1.5 opacity-50">
              <Loader2 size={11} className="text-white/40 animate-spin" />
              <span className="text-[10px] text-white/40">AR…</span>
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto">

          {/* ── Item header ── */}
          <div className="px-5 pt-4 pb-4 border-b border-white/[0.06]">
            <h1 className="text-[24px] font-bold text-white mb-1 tracking-tight">{item.name}</h1>
            {item.subtitle && <p className="italic text-[13px] text-orange-400/70 mb-3">{item.subtitle}</p>}
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex gap-0.5">
                {[1,2,3,4,5].map(s => (
                  <span key={s} className={`text-[14px] ${s <= Math.floor(item.rating ?? 0) ? 'text-amber-400' : 'text-white/15'}`}>★</span>
                ))}
              </div>
              <span className="text-[13px] text-white/50 font-medium">{item.rating?.toFixed(1) ?? '—'}</span>
              <span className="w-1 h-1 rounded-full bg-white/20" />
              <span className="text-[12px] text-white/30">{item.reviewCount ?? 0} reviews</span>
              {item.prepTime && (
                <>
                  <span className="w-1 h-1 rounded-full bg-white/20" />
                  <span className="flex items-center gap-1 text-[12px] text-white/30">
                    <Clock size={12} />{item.prepTime}
                  </span>
                </>
              )}
            </div>
          </div>

          {/* ── AR banner ── */}
          {arReady === true && (
            <Link href={arHref}
              className="mx-5 mt-4 flex items-center gap-3 p-3.5 rounded-2xl bg-orange-500/10 border border-orange-500/20 hover:border-orange-500/35 transition-all">
              <div className="w-10 h-10 rounded-xl bg-orange-500/20 border border-orange-500/30 flex items-center justify-center flex-shrink-0">
                <Cuboid size={20} className="text-orange-400" />
              </div>
              <div className="flex-1">
                <p className="text-[13px] font-semibold text-white/80">View in Augmented Reality</p>
                <p className="text-[11px] text-orange-400/60">Place on your table · Mobile AR & 360° Desktop</p>
              </div>
              <span className="text-orange-400/50 text-lg">›</span>
            </Link>
          )}

          {/* ── Macros ── */}
          {(item.calories || item.protein || item.fat || item.carbs) ? (
            <div className="flex gap-2 px-5 py-4 border-b border-white/[0.06] mt-2">
              {[
                { val: item.calories,        label: 'Cal'     },
                { val: `${item.protein}g`,   label: 'Protein' },
                { val: `${item.fat}g`,       label: 'Fat'     },
                { val: `${item.carbs}g`,     label: 'Carbs'   },
              ].map(m => (
                <div key={m.label} className="flex-1 bg-white/[0.03] border border-white/[0.06] rounded-2xl p-2.5 flex flex-col items-center gap-0.5">
                  <span className="text-[15px] font-bold text-white/70">{m.val ?? '—'}</span>
                  <span className="text-[10px] text-white/25 uppercase tracking-widest font-semibold">{m.label}</span>
                </div>
              ))}
            </div>
          ) : null}

          {/* ── Description ── */}
          {item.description && (
            <div className="px-5 py-4 border-b border-white/[0.06]">
              <p className="text-[10px] text-white/25 uppercase tracking-widest font-semibold mb-2">Description</p>
              <p className="text-[13px] text-white/50 leading-relaxed">{item.description}</p>
            </div>
          )}

          {/* ── Allergens ── */}
          {(item.allergens ?? []).length > 0 && (
            <div className="px-5 py-4 border-b border-white/[0.06]">
              <p className="text-[10px] text-white/25 uppercase tracking-widest font-semibold mb-2">Allergen Information</p>
              <div className="flex gap-4 mb-3">
                <span className="flex items-center gap-1.5 text-[11px] text-white/35"><span className="w-2 h-2 rounded-full bg-red-400" />Contains</span>
                <span className="flex items-center gap-1.5 text-[11px] text-white/35"><span className="w-2 h-2 rounded-full bg-green-400" />Free from</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {(item.allergens ?? []).map(a => (
                  <div key={a.name} className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[11px] font-medium border ${
                    a.status === 'present'
                      ? 'bg-red-500/10 border-red-500/20 text-red-400'
                      : 'bg-green-500/10 border-green-500/20 text-green-400'
                  }`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${a.status === 'present' ? 'bg-red-400' : 'bg-green-400'}`} />
                    <span>{a.emoji}</span><span>{a.name}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Customisations ── */}
          {item.customisations && (
            <div className="px-5 py-4 border-b border-white/[0.06]">
              <p className="text-[10px] text-white/25 uppercase tracking-widest font-semibold mb-3">Customise Your Order</p>
              {[
                { label: 'Doneness', opts: item.customisations.doneness, val: doneness, set: setDoneness },
                { label: 'Side',     opts: item.customisations.sides,    val: side,     set: setSide     },
                { label: 'Sauce',    opts: item.customisations.sauces,   val: sauce,    set: setSauce    },
              ].filter(g => g.opts?.length).map(g => (
                <div key={g.label} className="mb-4">
                  <p className="text-[13px] font-semibold text-white/60 mb-2">{g.label}</p>
                  <div className="flex gap-2 flex-wrap">
                    {g.opts!.map(o => (
                      <button key={o} onClick={() => g.set(o)}
                        className={`px-3.5 py-1.5 rounded-full border text-[12px] font-semibold transition-all ${
                          g.val === o
                            ? 'bg-orange-500 border-orange-500 text-white shadow-lg shadow-orange-500/20'
                            : 'bg-white/[0.04] border-white/[0.08] text-white/40 hover:border-orange-500/30 hover:text-white/60'
                        }`}>
                        {o}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ── Quantity ── */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06]">
            <div>
              <p className="text-[13px] font-semibold text-white/60">Quantity</p>
              <p className="text-[11px] text-white/25">Max 5</p>
            </div>
            <div className="flex items-center border border-white/[0.08] rounded-2xl overflow-hidden bg-gray-900">
              <button onClick={() => setQty(Math.max(1, qty - 1))}
                className="w-10 h-10 flex items-center justify-center hover:bg-white/5 transition-colors text-white/40 font-bold text-lg">
                −
              </button>
              <span className="w-10 h-10 flex items-center justify-center text-[16px] font-bold text-white border-x border-white/[0.08]">
                {qty}
              </span>
              <button onClick={() => setQty(Math.min(5, qty + 1))}
                className="w-10 h-10 flex items-center justify-center hover:bg-orange-500/10 transition-colors text-orange-400 font-bold text-lg">
                +
              </button>
            </div>
          </div>

          {/* Order error */}
          {orderErr && (
            <div className="mx-5 mt-3 flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-xl">
              <AlertCircle size={14} className="text-red-400 flex-shrink-0" />
              <p className="text-[12px] text-red-400">{orderErr}</p>
            </div>
          )}
          <div className="h-4" />
        </div>

        {/* ── Footer CTA ── */}
        <div className="p-4 flex items-center gap-3 bg-gray-900/80 backdrop-blur-sm border-t border-white/[0.06]">
          <div>
            <p className="text-[10px] text-white/25 uppercase tracking-widest font-semibold">Total</p>
            <p className="text-[22px] font-bold text-orange-400 leading-none">{formatPrice(item.price * qty)}</p>
          </div>
          <button onClick={placeOrder} disabled={placing}
            className={`flex-1 h-[52px] rounded-2xl flex items-center justify-center gap-2 text-[15px] font-bold transition-all ${
              placing
                ? 'bg-orange-400 text-white'
                : 'bg-orange-500 hover:bg-orange-600 text-white shadow-lg shadow-orange-500/25'
            }`}>
            {placing
              ? <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Placing Order…</>
              : <><Send size={16} /> Place Order · {formatPrice(item.price * qty)}</>}
          </button>
        </div>
      </div>
    </main>
  );
}