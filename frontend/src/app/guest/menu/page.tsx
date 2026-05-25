'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { ShoppingCart, Search, Loader2, AlertCircle } from 'lucide-react';
import { formatPrice } from '@/lib/data';
import { fetchMenuItems, normaliseItem, type ApiMenuItem } from '@/lib/menu-api';
import { useCartStore } from '@/lib/store';

const EMOJI_MAP: Record<string, string> = {
  starters: '🥗', mains: '🍽️', desserts: '🍰', beverages: '🥤',
  pizza: '🍕', burgers: '🍔', pasta: '🍝', seafood: '🐟',
  grill: '🔥', soup: '🍜', bread: '🍞', other: '🍽️',
};

function getCategoryEmoji(cat: string): string {
  const c = cat.toLowerCase();
  for (const [key, emoji] of Object.entries(EMOJI_MAP)) {
    if (c.includes(key)) return emoji;
  }
  return '🍽️';
}

function MenuContent() {
  const params = useSearchParams();
  const [items,          setItems]          = useState<ApiMenuItem[]>([]);
  const [loading,        setLoading]        = useState(true);
  const [error,          setError]          = useState('');
  const [activeCategory, setActiveCategory] = useState('all');
  const [search,         setSearch]         = useState('');
  const [added,          setAdded]          = useState<Record<string, boolean>>({});
  const [tableLabel,     setTableLabel]     = useState('MenuLay');
  const { addItem, itemCount } = useCartStore();

  useEffect(() => {
    const storedTable = sessionStorage.getItem('lm_table');
    if (storedTable) setTableLabel(`Table ${storedTable}`);

    const urlRid = params.get('rid') || '';
    const urlTid = params.get('tid') || '';
    if (urlRid) sessionStorage.setItem('lm_rid', urlRid);
    if (urlTid) sessionStorage.setItem('lm_tid', urlTid);

    const menuRid = process.env.NEXT_PUBLIC_ADMIN_RESTAURANT_ID
      || process.env.NEXT_PUBLIC_RESTAURANT_ID
      || '2687382e-3b00-4f57-9014-f484df89e3fe';

    fetchMenuItems(menuRid)
      .then(raw => { setItems(raw.map(normaliseItem)); setLoading(false); })
      .catch(e => { setError(e?.message ?? 'Failed to load menu'); setLoading(false); });
  }, [params]);

  const categories = [
    { id: 'all', name: 'All', emoji: '🍽️' },
    ...Array.from(new Set(items.map(i => i.category).filter(Boolean)))
      .map(cat => {
        const isUuidFrag = /^[0-9a-f]{6,8}$/i.test(cat);
        const name = isUuidFrag ? 'All Dishes' : cat.charAt(0).toUpperCase() + cat.slice(1);
        return { id: cat, name, emoji: getCategoryEmoji(cat) };
      }),
  ];

  const filtered = items.filter(item => {
    const matchCat    = activeCategory === 'all' || item.category === activeCategory;
    const matchSearch = item.name.toLowerCase().includes(search.toLowerCase()) ||
                        (item.description ?? '').toLowerCase().includes(search.toLowerCase());
    return matchCat && matchSearch && item.status !== 'inactive';
  });

  const handleAdd = (item: ApiMenuItem) => {
    addItem({ menuItemId: item.id, name: item.name, emoji: item.emoji ?? '🍽️', price: item.price, quantity: 1, options: {} });
    setAdded(p => ({ ...p, [item.id]: true }));
    setTimeout(() => setAdded(p => ({ ...p, [item.id]: false })), 1800);
  };

  return (
    <main className="min-h-dvh bg-gray-950 flex flex-col items-center">
      <div className="phone-shell">

        {/* ── Top nav ── */}
        <div className="flex items-center justify-between px-5 pt-6 pb-4">
          <div>
            <p className="text-[11px] text-white/25 uppercase tracking-widest">{tableLabel}</p>
            <h1 className="text-[22px] font-bold text-white tracking-tight">Our Menu</h1>
          </div>
          <Link
            href="/guest/cart"
            className="relative w-11 h-11 rounded-[14px] bg-orange-500/15 border border-orange-500/25 flex items-center justify-center hover:bg-orange-500/25 transition-all">
            <ShoppingCart size={20} className="text-orange-400" />
            {itemCount() > 0 && (
              <span className="absolute -top-1 -right-1 w-[18px] h-[18px] rounded-full bg-orange-500 flex items-center justify-center text-[10px] font-bold text-white shadow-lg shadow-orange-500/50">
                {itemCount()}
              </span>
            )}
          </Link>
        </div>

        {/* ── Search ── */}
        <div className="relative px-5 mb-4">
          <Search size={14} className="absolute left-8 top-1/2 -translate-y-1/2 text-white/25 pointer-events-none" />
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search dishes…"
            className="w-full h-11 pl-9 pr-4 rounded-[14px] bg-white/[0.05] border border-white/[0.08] text-white text-[13px] placeholder-white/25 focus:outline-none focus:border-orange-500/40 transition"
          />
        </div>

        {/* ── Category chips ── */}
        <div className="flex gap-2 px-5 pb-1 overflow-x-auto scrollbar-hide mb-5">
          {categories.map(cat => (
            <button key={cat.id} onClick={() => setActiveCategory(cat.id)}
              className={`flex-shrink-0 flex items-center gap-1.5 px-3.5 py-2 rounded-full border text-[12px] font-semibold transition-all ${
                activeCategory === cat.id
                  ? 'bg-orange-500/15 border-orange-500/35 text-orange-400'
                  : 'bg-white/[0.03] border-white/[0.08] text-white/40 hover:border-orange-500/20 hover:text-white/60'
              }`}>
              <span className="text-[14px]">{cat.emoji}</span>{cat.name}
            </button>
          ))}
        </div>

        {/* ── Loading ── */}
        {loading && (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <Loader2 size={28} className="animate-spin text-orange-400" />
            <p className="text-[13px] text-white/30">Loading menu…</p>
          </div>
        )}

        {/* ── Error ── */}
        {error && !loading && (
          <div className="mx-5 p-4 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center gap-3">
            <AlertCircle size={18} className="text-red-400 flex-shrink-0" />
            <p className="text-[13px] text-red-300">{error}</p>
          </div>
        )}

        {/* ── Items list ── */}
        {!loading && !error && (
          <>
            <p className="px-5 text-[11px] text-white/25 uppercase tracking-widest font-semibold mb-3">
              🍽️ {activeCategory === 'all' ? 'All Items' : categories.find(c => c.id === activeCategory)?.name}
            </p>
            <div className="flex flex-col gap-2.5 px-5 mb-6">
              {filtered.length === 0 && (
                <p className="text-center text-[13px] text-white/25 py-8">No items found</p>
              )}
              {filtered.map(item => (
                <Link key={item.id} href={`/guest/menu/${item.id}`}>
                  <div className="flex items-center gap-3 p-3.5 rounded-2xl bg-gray-900 border border-white/[0.06] hover:border-orange-500/25 hover:bg-gray-900/80 transition-all cursor-pointer group">

                    {/* Image or emoji */}
                    <div className="w-14 h-14 rounded-[14px] flex items-center justify-center flex-shrink-0 overflow-hidden bg-orange-500/10 border border-orange-500/15">
                      {item.imageUrl
                        ? <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover" />
                        : <span className="text-[26px]">{item.emoji}</span>}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <p className="text-[14px] font-semibold text-white/85 truncate group-hover:text-white transition-colors">{item.name}</p>
                        {(item as any).hasArModel && (
                          <span className="text-[9px] bg-purple-500/15 border border-purple-500/25 text-purple-400 px-1.5 py-0.5 rounded-full font-bold flex-shrink-0">3D</span>
                        )}
                      </div>
                      <p className="text-[11px] text-white/28 truncate">{item.description}</p>
                      {(item.allergens ?? []).length > 0 && (
                        <p className="text-[10px] text-white/20 mt-0.5 truncate">
                          Contains: {(item.allergens as any[]).map((a: any) => typeof a === 'string' ? a : a.name).join(', ')}
                        </p>
                      )}
                    </div>

                    <div className="flex flex-col items-end gap-2 flex-shrink-0">
                      <span className="text-[15px] font-bold text-orange-400">{formatPrice(item.price)}</span>
                      <button
                        onClick={e => { e.preventDefault(); handleAdd(item); }}
                        className={`w-[30px] h-[30px] rounded-[9px] border flex items-center justify-center transition-all text-[14px] font-bold ${
                          added[item.id]
                            ? 'bg-orange-500 border-orange-500 text-white'
                            : 'bg-orange-500/12 border-orange-500/30 text-orange-400 hover:bg-orange-500/25'
                        }`}>
                        {added[item.id] ? '✓' : '+'}
                      </button>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </>
        )}

        {/* ── Bottom nav ── */}
        <div className="flex justify-around items-center px-5 pt-3.5 pb-7 border-t border-white/[0.06] bg-gray-900/80 backdrop-blur-sm">
          {[
            { icon: '🏠', label: 'Home',   href: '/guest'           },
            { icon: '📖', label: 'Menu',   href: '/guest/menu', active: true },
            { icon: '🛒', label: 'Cart',   href: '/guest/cart'      },
            { icon: '🕐', label: 'Orders', href: '/guest/tracking'  },
          ].map(n => (
            <Link key={n.label} href={n.href}
              className={`flex flex-col items-center gap-1 px-2.5 py-1 transition-all ${
                (n as any).active ? 'text-orange-400' : 'text-white/20 hover:text-white/40'
              }`}>
              <span className="text-[20px]">{n.icon}</span>
              <span className={`text-[10px] font-semibold ${(n as any).active ? 'text-orange-400' : ''}`}>{n.label}</span>
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}

export default function MenuPage() {
  return (
    <Suspense fallback={
      <main className="min-h-dvh bg-gray-950 flex items-center justify-center">
        <Loader2 size={28} className="animate-spin text-orange-400" />
      </main>
    }>
      <MenuContent />
    </Suspense>
  );
}