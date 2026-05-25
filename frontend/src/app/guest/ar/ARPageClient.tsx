'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Cuboid, Loader2, AlertCircle, Sparkles } from 'lucide-react';
import dynamic from 'next/dynamic';
import { fetchArModel } from '@/lib/ar-api';

const ARViewer = dynamic(
  () => import('@/components/guest/ARViewer'),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-[400px] flex items-center justify-center gap-3 bg-white/[0.03] border border-white/[0.06] rounded-3xl">
        <Loader2 size={20} className="animate-spin text-orange-400" />
        <span className="text-[13px] text-white/40">Loading AR viewer…</span>
      </div>
    ),
  },
);

interface Props {
  restaurantId:     string;
  itemId:           string;
  itemName:         string;
  emoji:            string;
  preloadedGlbUrl?: string;
}

export default function ARPageClient({ restaurantId, itemId, itemName, emoji, preloadedGlbUrl }: Props) {
  const router = useRouter();
  const [glbUrl,  setGlbUrl]  = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);
  const [noModel, setNoModel] = useState(false);

  useEffect(() => {
    if (preloadedGlbUrl?.trim()) {
      setGlbUrl(preloadedGlbUrl.trim());
      setLoading(false);
      return;
    }

    if (!itemId?.trim()) {
      setError('No item selected. Please open AR from a menu item.');
      setLoading(false);
      return;
    }

    const rid = restaurantId?.trim()
      || (typeof window !== 'undefined' ? sessionStorage.getItem('lm_rid') || '' : '')
      || process.env.NEXT_PUBLIC_RESTAURANT_ID
      || '53591ab9-ac4e-4841-958b-d38853a90f0b';

    fetchArModel(rid, itemId.trim())
      .then(d => { setGlbUrl(d.presignedUrl); setLoading(false); })
      .catch(e => {
        const msg: string = e?.message ?? '';
        setLoading(false);
        if (msg.includes('item_not_found') || msg.includes('404')) {
          setNoModel(true);
        } else {
          setError(msg || 'Failed to load 3D model.');
        }
      });
  }, [restaurantId, itemId, preloadedGlbUrl]);

  return (
    <main className="min-h-dvh bg-gray-950 flex flex-col items-center">
      <div className="phone-shell">

        {/* ── Nav bar ── */}
        <div className="flex items-center gap-3 px-5 py-3.5 border-b border-white/[0.06]">
          <button onClick={() => router.back()}
            className="w-9 h-9 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center hover:bg-white/10 transition-all">
            <ArrowLeft size={16} className="text-white/50" />
          </button>
          <div className="flex-1">
            <h1 className="text-[18px] font-bold text-white tracking-tight">{itemName}</h1>
            <p className="text-[11px] text-white/30">AR & 3D Preview</p>
          </div>
          {glbUrl && (
            <div className="bg-orange-500/10 border border-orange-500/25 rounded-full px-3 py-1.5 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-orange-400 animate-pulse" />
              <span className="text-[10px] text-orange-400 font-semibold uppercase tracking-widest">Model Ready</span>
            </div>
          )}
        </div>

        {/* ── Item info row ── */}
        <div className="flex items-center gap-3 px-5 py-3.5 border-b border-white/[0.06]">
          <div className="w-12 h-12 rounded-2xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center text-2xl flex-shrink-0">
            {emoji}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-semibold text-white/70 truncate">{itemName}</p>
            {itemId && (
              <p className="text-[11px] text-white/25 font-mono">
                ID: {itemId.slice(0, 8)}…{itemId.slice(-4)}
              </p>
            )}
            <p className="text-[11px] text-white/20">Presigned S3 GLB · 15 min</p>
          </div>
          <Cuboid size={20} className="text-orange-400 flex-shrink-0" />
        </div>

        {/* ── Content area ── */}
        <div className="flex-1 px-5 py-4">

          {/* Loading */}
          {loading && (
            <div className="w-full h-[320px] flex flex-col items-center justify-center gap-3 bg-white/[0.03] border border-white/[0.06] rounded-3xl">
              <div className="text-5xl opacity-20">{emoji}</div>
              <div className="flex items-center gap-2">
                <Loader2 size={16} className="animate-spin text-orange-400" />
                <span className="text-[13px] text-white/35">Fetching 3D model…</span>
              </div>
            </div>
          )}

          {/* No model — friendly */}
          {noModel && !loading && (
            <div className="w-full flex flex-col items-center justify-center gap-4 bg-orange-500/5 border border-orange-500/15 rounded-3xl px-6 py-12 text-center">
              <div className="w-16 h-16 rounded-2xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center">
                <Sparkles size={28} className="text-orange-400" />
              </div>
              <div>
                <p className="text-[16px] font-bold text-white/80 mb-1">3D Model Coming Soon</p>
                <p className="text-[13px] text-white/35 leading-relaxed">
                  Our team is crafting a 3D model for <strong className="text-white/50">{itemName}</strong>.
                  Check back soon!
                </p>
              </div>
              <button onClick={() => router.back()}
                className="px-5 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-[13px] font-semibold transition-all shadow-lg shadow-orange-500/25">
                ← Back to Menu
              </button>
            </div>
          )}

          {/* Error — something went wrong */}
          {error && !loading && (
            <div className="w-full flex flex-col items-center justify-center gap-3 bg-red-500/10 border border-red-500/20 rounded-3xl px-6 py-12 text-center">
              <AlertCircle size={32} className="text-red-400" />
              <p className="text-[14px] font-bold text-red-300">Failed to Load Model</p>
              <p className="text-[12px] text-red-400/70 leading-relaxed">{error}</p>
              <button onClick={() => window.location.reload()}
                className="px-4 py-2 rounded-xl bg-red-500/15 border border-red-500/25 text-red-400 text-[13px] font-semibold hover:bg-red-500/25 transition-all">
                Retry
              </button>
            </div>
          )}

          {/* AR viewer */}
          {glbUrl && !loading && !error && (
            <ARViewer glbUrl={glbUrl} itemName={itemName} emoji={emoji} />
          )}
        </div>
      </div>
    </main>
  );
}