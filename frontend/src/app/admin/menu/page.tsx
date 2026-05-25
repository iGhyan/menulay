'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Search, RefreshCw, Bell, Plus, Edit2, Trash2,
  X, CloudUpload, Loader2, AlertCircle, CheckCircle,
} from 'lucide-react';
import { formatPrice } from '@/lib/data';
import { Toggle, StatusChip } from '@/components/ui';
import {
  fetchMenuItems, fetchMenuItem, updateMenuItem, normaliseItem, type ApiMenuItem,
} from '@/lib/menu-api';
import { TENANT_ID } from '@/lib/api-config';

type ModalState = { open: boolean; item?: ApiMenuItem };
type LoadState  = 'idle' | 'loading' | 'success' | 'error';
type GlbStatus  = 'idle' | 'uploading' | 'approved' | 'error';

const ADMIN_RESTAURANT_ID = process.env.NEXT_PUBLIC_ADMIN_RESTAURANT_ID ?? '2687382e-3b00-4f57-9014-f484df89e3fe';
const MENU_BASE_URL = '/api/menu'; // proxied through Next.js — avoids CORS

async function createMenuItemWithFiles(
  payload: {
    name: string; description: string; price: number;
    categoryId: string; isActive: boolean;
    allergens?: string[]; prepTime?: string; calories?: number;
  },
  imageFile?: File | null,
  glbFile?: File | null,
): Promise<any> {
  const fd = new FormData();
  fd.append('name',            payload.name);
  fd.append('description',     payload.description);
  fd.append('priceMinorUnits', String(Math.round(payload.price * 100)));
  fd.append('categoryId',      payload.categoryId);
  fd.append('isActive',        String(payload.isActive));
  fd.append('restaurantId',    ADMIN_RESTAURANT_ID);
  // tenantId injected by proxy via X-Tenant-Id header — no need in body
  if (payload.allergens?.length) fd.append('allergens', payload.allergens.join(','));
  if (payload.prepTime)  fd.append('prepTime', payload.prepTime);
  if (payload.calories)  fd.append('calories',  String(payload.calories));
  if (imageFile)         fd.append('file',      imageFile);
  if (glbFile)           fd.append('arFile',    glbFile);

  // Get auth token — proxy adds X-Tenant-Id server-side
  const { getValidIdToken } = await import('@/lib/cognito');
  const token = await getValidIdToken();
  const headers: Record<string, string> = {};
  if (token) headers['Authorization'] = token;

  const res = await fetch(
    `${MENU_BASE_URL}/restaurants/${ADMIN_RESTAURANT_ID}/items`,
    { method: 'POST', headers, body: fd }
    // Note: NO Content-Type header — browser sets multipart boundary automatically
  );
  if (!res.ok) {
    const txt = await res.text().catch(() => res.statusText);
    throw new Error(`Create failed (${res.status}): ${txt}`);
  }
  return res.json();
}

export default function AdminMenuPage() {
  const [items,      setItems]      = useState<ApiMenuItem[]>([]);
  const [cats,       setCats]       = useState<{id:string; name:string}[]>([]);
  const [loadState,  setLoadState]  = useState<LoadState>('idle');
  const [loadError,  setLoadError]  = useState('');
  const [search,     setSearch]     = useState('');
  const [category,   setCategory]   = useState('all');
  const [modal,      setModal]      = useState<ModalState>({ open: false });
  const [isActive,   setIsActive]   = useState(true);
  const [isChef,     setIsChef]     = useState(false);
  const [saving,     setSaving]     = useState(false);
  const [saveMsg,    setSaveMsg]    = useState('');
  const [saveErr,    setSaveErr]    = useState('');
  const [deleting,   setDeleting]   = useState<string | null>(null);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadName, setUploadName] = useState<string | null>(null);
  const [glbFile,    setGlbFile]    = useState<File | null>(null);
  const [glbName,    setGlbName]    = useState<string | null>(null);
  const [glbStatus,  setGlbStatus]  = useState<GlbStatus>('idle');
  const [glbError,   setGlbError]   = useState('');
  const [form, setForm] = useState({
    name: '', description: '', price: '', category: '', prepTime: '', calories: '',
  });

  const loadItems = useCallback(async () => {
    setLoadState('loading'); setLoadError('');
    try {
      const raw        = await fetchMenuItems(ADMIN_RESTAURANT_ID);
      const normalised = raw.map(normaliseItem);
      setItems(normalised);
      const seen = new Map<string, string>();
      raw.forEach((r: any) => {
        const id   = r.categoryId ?? '';
        const KNOWN: Record<string,string> = { 'e933848e-0d18-4e3a-b0a8-d70275c2fa54': 'Main Course' };
        const name = r.categoryName ?? KNOWN[id] ?? (r.category && !r.category.includes('-') ? r.category : `Cat-${id.slice(0,6)}`);
        if (id && id.includes('-')) seen.set(id, name);
      });
      const DEFAULT_CATS = [
        { id: 'e933848e-0d18-4e3a-b0a8-d70275c2fa54', name: 'Main Course' },
        { id: 'bev-cat-0000-0000-000000000001', name: 'Beverages' },
        { id: 'des-cat-0000-0000-000000000002', name: 'Desserts' },
        { id: 'str-cat-0000-0000-000000000003', name: 'Starters' },
      ];
      const catList = seen.size > 0
        ? Array.from(seen.entries()).map(([id, name]) => ({ id, name }))
        : DEFAULT_CATS;
      setCats(catList);
      setForm(prev => prev.category === '' ? { ...prev, category: catList[0]?.id ?? '' } : prev);

      setLoadState('success');
    } catch (err: any) {
      setLoadError(err?.message ?? 'Failed to load'); setLoadState('error');
    }
  }, []);

  useEffect(() => { loadItems(); }, [loadItems]);

  const filtered    = items.filter(item => {
    if (item.status === 'inactive') return false;
    const mc = category === 'all' || (item as any).categoryId === category || item.category === category;
    return mc && item.name.toLowerCase().includes(search.toLowerCase());
  });
  const activeItems = items.filter(i => i.status === 'active');

  const openModal = (item?: ApiMenuItem) => {
    setModal({ open: true, item });
    setIsActive(item ? item.status === 'active' : true);
    setIsChef(item ? (item.tags ?? []).includes('chef') : false);
    setUploadFile(null); setUploadName(null);
    setGlbFile(null); setGlbName(null);
    setGlbStatus('idle'); setGlbError('');
    setSaveMsg(''); setSaveErr('');
    setForm({
      name:        item?.name        ?? '',
      description: item?.description ?? '',
      price:       item?.price       ? String(item.price) : '',
      category:    (item as any)?.categoryId ?? item?.category ?? cats[0]?.id ?? '',
      prepTime:    item?.prepTime    ?? '',
      calories:    item?.calories    ? String(item.calories) : '',
    });
  };

  const uploadToS3 = async (url: string, file: File, ct: string) => {
    const res = await fetch(url, { method: 'PUT', headers: { 'Content-Type': ct }, body: file });
    if (!res.ok) throw new Error(`S3 upload failed (${res.status})`);
  };

  const saveItem = async () => {
    if (!form.name.trim() || !form.price) { setSaveErr('Name and price are required.'); return; }
    if (cats.length === 0) { setSaveErr('Categories are still loading. Please wait a moment and try again.'); return; }
    if (!form.category) { setSaveErr('Please select a category.'); return; }
    setSaving(true); setSaveMsg(''); setSaveErr('');
    try {
      if (modal.item?.id) {
        const version = (modal.item as any).version ?? 1;
        const raw = await updateMenuItem(modal.item.id, {
          name: form.name.trim(), description: form.description.trim(),
          price: parseFloat(form.price), categoryId: form.category,
          status: isActive ? 'active' : 'inactive', tags: isChef ? ['chef'] : [],
          prepTime: form.prepTime || '20 min',
          calories: form.calories ? parseInt(form.calories) : undefined,
        }, version);
        setItems(prev => prev.map(i => i.id === ((raw as any).id ?? (raw as any).itemId) ? normaliseItem(raw) : i));
        setSaveMsg('Item updated!');
        if (uploadFile) {
          setSaveMsg('Getting image upload URL…');
          const fetched = await fetchMenuItem(modal.item.id, ADMIN_RESTAURANT_ID) as any;
          if (fetched.imageUrl) {
            setSaveMsg('Uploading image…');
            await uploadToS3(fetched.imageUrl, uploadFile, uploadFile.type || 'image/png');
            setSaveMsg('Image uploaded! ✓');
          }
        }
        if (glbFile && !(modal.item as any).arModelKey) {
          setSaveErr('This item has no AR model slot. Use "Recreate & Upload Files" to create a fresh item with GLB.');
          setSaving(false); return;
        }
      } else {
        setSaveMsg('Creating item…');
        if (glbFile) { setGlbStatus('uploading'); setSaveMsg('Uploading item + 3D model…'); }
        const raw = await createMenuItemWithFiles(
          { name: form.name.trim(), description: form.description.trim(),
            price: parseFloat(form.price), categoryId: form.category, isActive,
            prepTime: form.prepTime || undefined,
            calories: form.calories ? parseInt(form.calories) : undefined },
          uploadFile, glbFile,
        );
        setItems(prev => [...prev, normaliseItem(raw)]);
        if (raw.arModelKey) { setGlbStatus('approved'); setSaveMsg('Item created with 3D model! ✓'); }
        else setSaveMsg('Item created!');
      }
      setTimeout(() => { setModal({ open: false }); loadItems(); setSaveMsg(''); }, 1400);
    } catch (err: any) {
      setSaveErr(err?.message ?? 'Save failed.');
      if (glbStatus === 'uploading') { setGlbStatus('error'); setGlbError(err?.message ?? 'Upload failed'); }
    } finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Remove this item from the menu?')) return;
    setDeleting(id);
    try {
      const latest = await fetchMenuItem(id, ADMIN_RESTAURANT_ID) as any;
      await updateMenuItem(id, {
        name: latest.name, description: latest.description ?? '',
        categoryId: latest.categoryId, price: (latest.priceMinorUnits ?? 0) / 100, status: 'inactive',
      }, latest.version ?? 1);
      setItems(prev => prev.filter(i => i.id !== id));
    } catch (err: any) { alert(`Failed: ${err?.message}`); }
    finally { setDeleting(null); }
  };

  const handleRecreate = async () => {
    if (!modal.item) return;
    if (!confirm('Deactivate old item and create fresh with files? Continue?')) return;
    setSaving(true); setSaveErr(''); setSaveMsg('Deactivating old item…');
    try {
      const latest = await fetchMenuItem(modal.item.id, ADMIN_RESTAURANT_ID) as any;
      await updateMenuItem(modal.item.id, {
        name: latest.name, description: latest.description ?? '',
        categoryId: latest.categoryId, price: (latest.priceMinorUnits ?? 0) / 100, status: 'inactive',
      }, latest.version ?? 1);
      setItems(prev => prev.filter(i => i.id !== modal.item!.id));
      setSaveMsg('Creating fresh item with files…');
      if (glbFile) setGlbStatus('uploading');
      const raw = await createMenuItemWithFiles(
        { name: form.name.trim(), description: form.description.trim(),
          price: parseFloat(form.price), categoryId: form.category, isActive: true,
          prepTime: form.prepTime || undefined,
          calories: form.calories ? parseInt(form.calories) : undefined },
        uploadFile, glbFile,
      );
      setItems(prev => [...prev, normaliseItem(raw)]);
      if (raw.arModelKey) { setGlbStatus('approved'); setSaveMsg('Recreated with 3D model! ✓'); }
      else setSaveMsg('Recreated! ✓');
      setTimeout(() => { setModal({ open: false }); loadItems(); }, 1500);
    } catch (err: any) {
      setSaveErr(err?.message ?? 'Recreate failed.');
      if (glbStatus === 'uploading') { setGlbStatus('error'); setGlbError(err?.message ?? 'Failed'); }
    } finally { setSaving(false); }
  };

  return (
    <>
      {/* ── Top bar ── */}
      <div className="flex items-center justify-between px-8 py-5 border-b border-white/[0.06] bg-gray-950">
        <div>
          <h1 className="text-[22px] font-bold text-white tracking-tight">Menu Management</h1>
          <p className="text-[12px] text-white/30 mt-0.5">Live API · {activeItems.length} active items</p>
        </div>
        <div className="flex items-center gap-2.5">
          <div className="relative">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/25 pointer-events-none" />
            <input
              value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search items…"
              className="h-9 pl-9 pr-4 rounded-xl w-[200px] text-[13px] bg-gray-900 border border-white/10 text-white placeholder-white/25 focus:outline-none focus:border-orange-500/50 transition"
            />
          </div>
          <button onClick={loadItems} title="Refresh"
            className="w-9 h-9 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center hover:bg-orange-500/10 hover:border-orange-500/30 transition-all">
            <RefreshCw size={14} className={`text-white/40 ${loadState === 'loading' ? 'animate-spin text-orange-400' : ''}`} />
          </button>
          <button className="w-9 h-9 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center hover:bg-white/10 transition-all">
            <Bell size={15} className="text-white/40" />
          </button>
          <button onClick={() => openModal()}
            className="h-9 px-4 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-[13px] font-semibold flex items-center gap-1.5 transition-all shadow-lg shadow-orange-500/25">
            <Plus size={15} /> Add Item
          </button>
        </div>
      </div>

      <div className="flex-1 p-8 overflow-y-auto bg-gray-950 space-y-6">

        {/* Error */}
        {loadState === 'error' && (
          <div className="flex items-center gap-3 p-4 bg-red-500/10 border border-red-500/30 rounded-2xl">
            <AlertCircle size={16} className="text-red-400 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-[13px] font-semibold text-red-300">Failed to load menu items</p>
              <p className="text-[12px] text-red-400/70">{loadError}</p>
            </div>
            <button onClick={loadItems} className="px-3 py-1.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-[12px] font-semibold hover:bg-red-500/20 transition-all">Retry</button>
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-2 gap-3" style={{ maxWidth: '360px' }}>
          {[
            { label: 'Total Items', val: activeItems.length, color: 'text-white' },
            { label: 'Active',      val: activeItems.length, color: 'text-orange-400' },
          ].map(s => (
            <div key={s.label} className="bg-gray-900 border border-white/[0.07] rounded-2xl p-4">
              <p className="text-[10px] text-white/25 uppercase tracking-widest font-semibold mb-2">{s.label}</p>
              <p className={`text-[28px] font-bold ${s.color}`}>
                {loadState === 'loading' ? '…' : s.val}
              </p>
            </div>
          ))}
        </div>

        {/* Category filters */}
        <div className="flex gap-2 flex-wrap">
          <button onClick={() => setCategory('all')}
            className={`px-3.5 py-1.5 rounded-full border text-[12px] font-semibold transition-all ${
              category === 'all'
                ? 'bg-orange-500 border-orange-500 text-white shadow-lg shadow-orange-500/25'
                : 'bg-white/5 border-white/10 text-white/50 hover:text-white/70 hover:bg-white/10'
            }`}>
            🍽️ All
          </button>
          {cats.map(cat => (
            <button key={cat.id} onClick={() => setCategory(cat.id)}
              className={`px-3.5 py-1.5 rounded-full border text-[12px] font-semibold transition-all ${
                category === cat.id
                  ? 'bg-orange-500 border-orange-500 text-white shadow-lg shadow-orange-500/25'
                  : 'bg-white/5 border-white/10 text-white/50 hover:text-white/70 hover:bg-white/10'
              }`}>
              {cat.name}
            </button>
          ))}
        </div>

        {/* Loading skeleton */}
        {loadState === 'loading' && (
          <div className="bg-gray-900 border border-white/[0.07] rounded-2xl overflow-hidden">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 px-5 py-4 border-b border-white/[0.04] last:border-0">
                <div className="w-10 h-10 rounded-xl bg-white/5 animate-pulse flex-shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 bg-white/5 rounded animate-pulse w-1/3" />
                  <div className="h-2.5 bg-white/5 rounded animate-pulse w-1/2" />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Table */}
        {loadState !== 'loading' && (
          <div className="bg-gray-900 border border-white/[0.07] rounded-2xl overflow-hidden">
            {/* Header */}
            <div className="grid gap-3 px-5 py-3 border-b border-white/[0.06] bg-white/[0.02]"
              style={{ gridTemplateColumns: '44px 1fr 120px 90px 80px 90px 80px' }}>
              {['', 'Item', 'Category', 'Price', 'Rating', 'Status', 'Actions'].map(h => (
                <p key={h} className="text-[10px] text-white/25 uppercase tracking-widest font-semibold">{h}</p>
              ))}
            </div>

            {/* Empty state */}
            {filtered.length === 0 && loadState === 'success' && (
              <div className="flex flex-col items-center justify-center py-16 gap-3">
                <span className="text-4xl opacity-20">🍽️</span>
                <p className="text-[13px] text-white/25">No items found</p>
                <button onClick={() => openModal()}
                  className="px-4 py-2 rounded-xl bg-orange-500/10 border border-orange-500/25 text-orange-400 text-[13px] font-semibold hover:bg-orange-500/20 transition-all">
                  Add First Item
                </button>
              </div>
            )}

            {/* Rows */}
            {filtered.map((item, idx) => (
              <div key={item.id ?? `item-${idx}`}
                className="grid gap-3 px-5 py-3.5 border-b border-white/[0.04] last:border-0 items-center hover:bg-white/[0.02] transition-colors"
                style={{ gridTemplateColumns: '44px 1fr 120px 90px 80px 90px 80px' }}>
                <div className="w-10 h-10 rounded-xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center text-[20px] overflow-hidden flex-shrink-0">
                  {(item as any).imageUrl
                    ? <img src={(item as any).imageUrl} alt={item.name} className="w-full h-full object-cover rounded-xl" />
                    : item.emoji}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className="text-[13px] font-semibold text-white/80 truncate">{item.name}</p>
                    {(item as any).arModelKey && (
                      <span className="text-[9px] bg-purple-500/15 border border-purple-500/30 text-purple-400 px-1.5 py-0.5 rounded-full font-bold flex-shrink-0">3D</span>
                    )}
                  </div>
                  <p className="text-[11px] text-white/30 truncate">{item.description}</p>
                </div>
                <p className="text-[12px] text-white/40">{item.category}</p>
                <p className="text-[13px] text-orange-400 font-semibold">{formatPrice(item.price)}</p>
                <p className="text-[12px] text-amber-400 font-medium">★ {item.rating?.toFixed(1) ?? '—'}</p>
                <div>
                  <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold ${
                    item.status === 'active'
                      ? 'bg-green-500/10 text-green-400 border border-green-500/20'
                      : 'bg-white/5 text-white/25 border border-white/10'
                  }`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${item.status === 'active' ? 'bg-green-400' : 'bg-white/20'}`} />
                    {item.status}
                  </span>
                </div>
                <div className="flex gap-1.5">
                  <button onClick={() => openModal(item)}
                    className="w-7 h-7 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center hover:bg-orange-500/10 hover:border-orange-500/30 transition-all">
                    <Edit2 size={12} className="text-white/40" />
                  </button>
                  <button onClick={() => handleDelete(item.id)} disabled={deleting === item.id}
                    className="w-7 h-7 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center hover:bg-red-500/10 hover:border-red-500/30 transition-all disabled:opacity-40">
                    {deleting === item.id
                      ? <Loader2 size={12} className="animate-spin text-white/30" />
                      : <Trash2 size={12} className="text-white/40" />}
                  </button>
                </div>
              </div>
            ))}

            {/* Footer */}
            {!loadState.includes('loading') && activeItems.length > 0 && (
              <div className="px-5 py-3 border-t border-white/[0.06] bg-white/[0.01] flex items-center justify-between">
                <p className="text-[11px] text-white/20">Showing {filtered.length} of {activeItems.length} active items</p>
                <p className="text-[11px] text-white/15 font-mono">Source: AWS API Gateway</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Modal ── */}
      {modal.open && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-6"
          onClick={e => e.target === e.currentTarget && setModal({ open: false })}>
          <div className="bg-gray-900 border border-white/[0.07] rounded-3xl w-[440px] max-h-[90vh] overflow-y-auto p-6 shadow-2xl">
            {/* Modal header */}
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="text-[18px] font-bold text-white">{modal.item ? 'Edit Menu Item' : 'Add Menu Item'}</h2>
                <p className="text-[11px] text-white/25 mt-0.5">{modal.item ? `ID: ${modal.item.id?.slice(0,8)}…` : 'POST to AWS API Gateway'}</p>
              </div>
              <button onClick={() => setModal({ open: false })}
                className="w-8 h-8 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center hover:bg-white/10 transition-all">
                <X size={14} className="text-white/50" />
              </button>
            </div>

            {saveMsg && (
              <div className="flex items-center gap-2 p-3 bg-green-500/10 border border-green-500/25 rounded-xl mb-4">
                <CheckCircle size={14} className="text-green-400" />
                <p className="text-[12px] text-green-400 font-semibold">{saveMsg}</p>
              </div>
            )}
            {saveErr && (
              <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/25 rounded-xl mb-4">
                <AlertCircle size={14} className="text-red-400" />
                <p className="text-[12px] text-red-400">{saveErr}</p>
              </div>
            )}

            {/* Form fields */}
            <div className="mb-4">
              <label className="block text-[11px] text-white/30 uppercase tracking-widest font-semibold mb-1.5">Item Name *</label>
              <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                placeholder="e.g. Chicken Karahi"
                className="w-full h-10 px-3 rounded-xl bg-gray-800 border border-white/10 text-white text-[13px] placeholder-white/20 focus:outline-none focus:border-orange-500/50 transition" />
            </div>

            <div className="grid grid-cols-2 gap-3 mb-4">
              <div>
                <label className="block text-[11px] text-white/30 uppercase tracking-widest font-semibold mb-1.5">Category</label>
                <select value={form.category} onChange={e => setForm(p => ({ ...p, category: e.target.value }))}
                  className={`w-full h-10 px-3 rounded-xl bg-gray-800 border text-white text-[13px] focus:outline-none focus:border-orange-500/50 transition ${!form.category ? 'border-amber-500/50' : 'border-white/10'}`}>
                  {cats.length === 0 && <option value="">⚠ Loading categories…</option>}
                  {cats.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[11px] text-white/30 uppercase tracking-widest font-semibold mb-1.5">Price (Rs) *</label>
                <input type="number" value={form.price} onChange={e => setForm(p => ({ ...p, price: e.target.value }))}
                  placeholder="0"
                  className="w-full h-10 px-3 rounded-xl bg-gray-800 border border-white/10 text-white text-[13px] placeholder-white/20 focus:outline-none focus:border-orange-500/50 transition" />
              </div>
            </div>

            <div className="mb-4">
              <label className="block text-[11px] text-white/30 uppercase tracking-widest font-semibold mb-1.5">Description</label>
              <textarea value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                placeholder="Short description…" rows={2}
                className="w-full px-3 py-2.5 rounded-xl bg-gray-800 border border-white/10 text-white text-[13px] placeholder-white/20 focus:outline-none focus:border-orange-500/50 transition resize-none" />
            </div>

            <div className="grid grid-cols-2 gap-3 mb-4">
              <div>
                <label className="block text-[11px] text-white/30 uppercase tracking-widest font-semibold mb-1.5">Prep Time</label>
                <input value={form.prepTime} onChange={e => setForm(p => ({ ...p, prepTime: e.target.value }))}
                  placeholder="e.g. 25 min"
                  className="w-full h-10 px-3 rounded-xl bg-gray-800 border border-white/10 text-white text-[13px] placeholder-white/20 focus:outline-none focus:border-orange-500/50 transition" />
              </div>
              <div>
                <label className="block text-[11px] text-white/30 uppercase tracking-widest font-semibold mb-1.5">Calories</label>
                <input type="number" value={form.calories} onChange={e => setForm(p => ({ ...p, calories: e.target.value }))}
                  placeholder="e.g. 680"
                  className="w-full h-10 px-3 rounded-xl bg-gray-800 border border-white/10 text-white text-[13px] placeholder-white/20 focus:outline-none focus:border-orange-500/50 transition" />
              </div>
            </div>

            {/* Image upload */}
            <div className="mb-4">
              <label className="block text-[11px] text-white/30 uppercase tracking-widest font-semibold mb-1.5">
                Item Image
                {modal.item && !(modal.item as any).imageKey && <span className="ml-2 text-amber-400/70 normal-case font-normal">— no image yet</span>}
                {modal.item && (modal.item as any).imageKey  && <span className="ml-2 text-green-400/70 normal-case font-normal">✓ uploaded</span>}
              </label>
              <label className="flex flex-col items-center gap-2 p-5 rounded-2xl border-2 border-dashed border-white/10 bg-white/[0.02] cursor-pointer hover:border-orange-500/40 hover:bg-orange-500/5 transition-all">
                <input type="file" accept="image/*" className="hidden"
                  onChange={e => { const f = e.target.files?.[0] ?? null; setUploadFile(f); setUploadName(f?.name ?? null); }} />
                <CloudUpload size={24} className={uploadName ? 'text-orange-400' : 'text-white/20'} />
                <span className={`text-[12px] font-medium ${uploadName ? 'text-orange-400' : 'text-white/30'}`}>
                  {uploadName ? `✓ ${uploadName}` : 'Click to upload · PNG, JPG'}
                </span>
              </label>
            </div>

            {/* GLB upload */}
            <div className="mb-4">
              <label className="block text-[11px] text-white/30 uppercase tracking-widest font-semibold mb-1.5">
                3D AR Model (.glb)
                {modal.item && !(modal.item as any).arModelKey && <span className="ml-2 text-amber-400/70 normal-case font-normal">— no model yet</span>}
                {modal.item && (modal.item as any).arModelKey  && <span className="ml-2 text-green-400/70 normal-case font-normal">✓ uploaded</span>}
              </label>
              {glbStatus === 'idle' && (
                <label className="flex flex-col items-center gap-2 p-5 rounded-2xl border-2 border-dashed border-purple-500/20 bg-purple-500/5 cursor-pointer hover:border-purple-500/40 hover:bg-purple-500/10 transition-all">
                  <input type="file" accept=".glb,.gltf" className="hidden"
                    onChange={e => { const f = e.target.files?.[0] ?? null; setGlbFile(f); setGlbName(f?.name ?? null); setGlbError(''); }} />
                  <span className="text-2xl">🫙</span>
                  <span className={`text-[12px] font-medium ${glbName ? 'text-purple-400' : 'text-white/30'}`}>
                    {glbName ? `✓ ${glbName}` : 'Click to upload · .glb / .gltf'}
                  </span>
                  {glbName && !modal.item && <span className="text-[11px] text-purple-400/60">Will upload with item on Save</span>}
                  {glbName && modal.item  && <span className="text-[11px] text-amber-400/60">Use Recreate button below to attach GLB</span>}
                </label>
              )}
              {glbStatus === 'uploading' && (
                <div className="p-4 rounded-2xl border-2 border-dashed border-purple-500/30 bg-purple-500/5 flex items-center gap-2">
                  <Loader2 size={13} className="animate-spin text-purple-400" />
                  <span className="text-[12px] text-purple-300 font-medium">{saveMsg || 'Uploading 3D model…'}</span>
                </div>
              )}
              {glbStatus === 'approved' && (
                <div className="p-4 rounded-2xl border-2 border-dashed border-green-500/30 bg-green-500/5 flex items-center gap-3">
                  <CheckCircle size={20} className="text-green-400 flex-shrink-0" />
                  <div>
                    <p className="text-[12px] text-green-400 font-semibold">✓ 3D Model Uploaded</p>
                    <p className="text-[11px] text-green-400/60 mt-0.5">Refresh to see AR badge on item</p>
                  </div>
                </div>
              )}
              {glbStatus === 'error' && (
                <div className="p-4 rounded-2xl border-2 border-dashed border-red-500/30 bg-red-500/5">
                  <div className="flex items-center gap-2 mb-1">
                    <AlertCircle size={14} className="text-red-400 flex-shrink-0" />
                    <p className="text-[12px] text-red-400 font-semibold">Upload Error</p>
                  </div>
                  <p className="text-[11px] text-red-400/70 mb-2">{glbError}</p>
                  <button onClick={() => { setGlbStatus('idle'); setGlbFile(null); setGlbName(null); }}
                    className="text-[11px] text-red-400 underline">Try again</button>
                </div>
              )}
            </div>

            {/* Recreate */}
            {modal.item && glbFile && (
              <div className="mb-4 p-3 bg-amber-500/10 border border-amber-500/25 rounded-xl">
                <p className="text-[11px] text-amber-400 font-semibold mb-2">
                  ⚠ GLB upload requires recreating the item.
                </p>
                <button onClick={handleRecreate} disabled={saving}
                  className="w-full h-9 rounded-xl bg-amber-500 text-white text-[12px] font-semibold flex items-center justify-center gap-1.5 hover:bg-amber-600 disabled:opacity-60 transition-all">
                  {saving
                    ? <><Loader2 size={13} className="animate-spin" /> {saveMsg}</>
                    : '🔄 Recreate & Upload Files'}
                </button>
              </div>
            )}

            {/* Toggles */}
            <div className="flex items-center justify-between py-3 border-t border-white/[0.06]">
              <span className="text-[13px] text-white/50">Active on guest menu</span>
              <Toggle checked={isActive} onChange={setIsActive} />
            </div>
            <div className="flex items-center justify-between py-3 border-t border-white/[0.06]">
              <span className="text-[13px] text-white/50">Mark as Chef's Special</span>
              <Toggle checked={isChef} onChange={setIsChef} />
            </div>

            {/* Actions */}
            <div className="flex gap-2">
              <button onClick={() => setModal({ open: false })}
                className="flex-1 h-10 rounded-xl bg-white/5 border border-white/10 text-[13px] font-semibold text-white/40 hover:bg-white/10 hover:text-white/60 transition-all">
                Cancel
              </button>
              <button onClick={saveItem} disabled={saving || glbStatus === 'uploading' || (cats.length === 0 && !modal.item)}
                className="flex-[2] h-10 rounded-xl flex items-center justify-center gap-1.5 text-[13px] font-semibold bg-orange-500 text-white hover:bg-orange-600 shadow-lg shadow-orange-500/25 disabled:opacity-50 transition-all">
                {saving || glbStatus === 'uploading'
                  ? <><Loader2 size={14} className="animate-spin" /> {saveMsg || 'Saving…'}</>
                  : cats.length === 0 && !modal.item
                  ? '⏳ Loading categories…'
                  : modal.item ? '✓ Update Item' : '✓ Create Item'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}