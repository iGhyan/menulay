'use client';

import { useState, useRef, useCallback } from 'react';
import {
  Download, Printer, Eye, X, Plus,
  Copy, CheckCheck, QrCode, MapPin,
  ExternalLink, Trash2, AlertCircle, Loader2,
} from 'lucide-react';

interface QrRecord {
  id:           string;
  restaurantId: string;
  tableId:      string;
  tableNumber:  string;
  zone:         string;
  outlet:       string;
  encodedUrl:   string;
  s3Key:        string;
  s3Url:        string;
  createdAt:    string;
  linked:       boolean;
  qrDataUrl?:   string;
}

const RESTAURANT_ID = '872f6f3a-82f2-41f0-a246-ec008b09666c';
const DEFAULT_BASE  = 'https://digital-menu-three-olive.vercel.app';
const ZONES = ['All Zones', 'Main Hall', 'Garden Terrace', 'Private Dining'];

type GenState = 'idle' | 'generating' | 'done' | 'error';

function buildQrUrl(baseUrl: string, restaurantId: string, tableId: string): string {
  const url = new URL('/guest', baseUrl);
  url.searchParams.set('rid', restaurantId);
  url.searchParams.set('tid', tableId);
  return url.toString();
}

function buildS3Key(restaurantId: string, tableId: string): string {
  return `qr-codes/${restaurantId}/${tableId}.png`;
}

function buildS3Url(s3Key: string): string {
  return `https://lamaison-assets.s3.ap-south-1.amazonaws.com/${s3Key}`;
}

function makeSeeds(): QrRecord[] {
  const base = typeof window !== 'undefined' ? window.location.origin : DEFAULT_BASE;
  const mainHall = Array.from({ length: 8 }, (_, i) => {
    const num = String(i + 1).padStart(2, '0');
    const tableId = `T${num}`;
    const s3Key = buildS3Key(RESTAURANT_ID, tableId);
    return {
      id: `seed-${tableId}`, restaurantId: RESTAURANT_ID,
      tableId, tableNumber: num, zone: 'Main Hall', outlet: 'Main Hall',
      encodedUrl: buildQrUrl(base, RESTAURANT_ID, tableId),
      s3Key, s3Url: buildS3Url(s3Key),
      createdAt: new Date().toISOString(), linked: true,
    };
  });
  const other = Array.from({ length: 4 }, (_, i) => {
    const num = String(i + 9).padStart(2, '0');
    const tableId = `T${num}`;
    const zone = i < 2 ? 'Garden Terrace' : 'Private Dining';
    const s3Key = buildS3Key(RESTAURANT_ID, tableId);
    return {
      id: `seed-${tableId}`, restaurantId: RESTAURANT_ID,
      tableId, tableNumber: num, zone, outlet: zone,
      encodedUrl: buildQrUrl(base, RESTAURANT_ID, tableId),
      s3Key, s3Url: buildS3Url(s3Key),
      createdAt: new Date().toISOString(), linked: true,
    };
  });
  return [...mainHall, ...other];
}

export default function AdminQRPage() {
  const [records,     setRecords]     = useState<QrRecord[]>(makeSeeds);
  const [zoneFilter,  setZoneFilter]  = useState('All Zones');
  const [preview,     setPreview]     = useState<QrRecord | null>(null);
  const [previewImg,  setPreviewImg]  = useState<string | null>(null);
  const [genState,    setGenState]    = useState<GenState>('idle');
  const [genError,    setGenError]    = useState('');
  const [copiedId,    setCopiedId]    = useState<string | null>(null);
  const [dlAll,       setDlAll]       = useState(false);
  const [showNewForm, setShowNewForm] = useState(false);
  const [newTable,    setNewTable]    = useState({ number: '', zone: 'Main Hall', outlet: 'Main Hall' });
  const printRef = useRef<HTMLDivElement>(null);

  const generateQR = useCallback(async (record: QrRecord): Promise<string | null> => {
    try {
      const res = await fetch('/api/qr/generate', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          restaurantId: record.restaurantId, tableId: record.tableId,
          tableNumber: record.tableNumber, zone: record.zone, outlet: record.outlet,
        }),
      });
      if (!res.ok) throw new Error(`API ${res.status}`);
      const data = await res.json();
      return data.pngDataUrl ?? null;
    } catch (err: any) {
      console.error('QR gen error:', err);
      return null;
    }
  }, []);

  const openPreview = async (record: QrRecord) => {
    setPreview(record); setPreviewImg(null);
    setGenState('generating'); setGenError('');
    const img = await generateQR(record);
    if (img) {
      setPreviewImg(img);
      setRecords(prev => prev.map(r => r.id === record.id ? { ...r, qrDataUrl: img } : r));
      setGenState('done');
    } else {
      setGenState('error');
      setGenError('Failed to generate QR — check API route');
    }
  };

  const downloadQR = async (record: QrRecord) => {
    let img = record.qrDataUrl ?? null;
    if (!img) img = await generateQR(record);
    if (!img) return;
    const a = document.createElement('a');
    a.href     = img;
    a.download = `QR_Table${record.tableNumber}_${record.zone.replace(/\s/g, '_')}.png`;
    a.click();
  };

  const downloadAll = async () => {
    setDlAll(true);
    const updated = await Promise.all(records.map(async r => {
      if (r.qrDataUrl) return r;
      const img = await generateQR(r);
      return img ? { ...r, qrDataUrl: img } : r;
    }));
    setRecords(updated); setDlAll(false);
    setTimeout(() => window.print(), 300);
  };

  const copyUrl = (record: QrRecord) => {
    navigator.clipboard.writeText(record.encodedUrl);
    setCopiedId(record.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const addTable = () => {
    if (!newTable.number.trim()) return;
    const tableId = `T${newTable.number.padStart(2, '0')}`;
    const base    = window.location.origin;
    const s3Key   = buildS3Key(RESTAURANT_ID, tableId);
    const record: QrRecord = {
      id: crypto.randomUUID(), restaurantId: RESTAURANT_ID, tableId,
      tableNumber: newTable.number.padStart(2, '0'),
      zone: newTable.zone, outlet: newTable.outlet,
      encodedUrl: buildQrUrl(base, RESTAURANT_ID, tableId),
      s3Key, s3Url: buildS3Url(s3Key),
      createdAt: new Date().toISOString(), linked: true,
    };
    setRecords(prev => [...prev, record]);
    setShowNewForm(false);
    setNewTable({ number: '', zone: 'Main Hall', outlet: 'Main Hall' });
    setTimeout(() => openPreview(record), 300);
  };

  const deleteRecord = (id: string) => {
    setRecords(prev => prev.filter(r => r.id !== id));
    if (preview?.id === id) setPreview(null);
  };

  const filtered = records.filter(r => zoneFilter === 'All Zones' || r.zone === zoneFilter);
  const stats = {
    total:     records.length,
    linked:    records.filter(r => r.linked).length,
    generated: records.filter(r => r.qrDataUrl).length,
    zones:     new Set(records.map(r => r.zone)).size,
  };

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          body > * { display: none !important; }
          #print-sheet { display: flex !important; }
        }
      ` }} />

      {/* Hidden print sheet */}
      <div id="print-sheet" ref={printRef}
        className="hidden fixed inset-0 z-[9999] bg-white p-8 flex-wrap gap-6 content-start overflow-auto">
        {records.filter(r => r.qrDataUrl).map(r => (
          <div key={r.id} className="border border-gray-200 rounded-2xl p-5 flex flex-col items-center gap-3 w-[200px] break-inside-avoid">
            <img src={r.qrDataUrl} alt={`Table ${r.tableNumber}`} className="w-[140px] h-[140px]" />
            <div className="text-center">
              <p className="text-[16px] font-semibold text-black">Table {r.tableNumber}</p>
              <p className="text-[11px] text-gray-500">{r.zone}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ── Top bar ── */}
      <div className="flex items-center justify-between px-8 py-5 border-b border-white/[0.06] bg-gray-950">
        <div>
          <h1 className="text-[22px] font-bold text-white tracking-tight">QR Code Management</h1>
          <p className="text-[12px] text-white/30 mt-0.5">Encode restaurantId + tableId → generate PNG → store in S3</p>
        </div>
        <div className="flex items-center gap-2.5">
          <button onClick={downloadAll} disabled={dlAll}
            className="h-9 px-4 rounded-xl bg-white/5 border border-white/10 text-white text-[13px] font-semibold flex items-center gap-1.5 hover:bg-white/10 transition-all disabled:opacity-50">
            {dlAll ? <Loader2 size={14} className="animate-spin" /> : <Printer size={14} />}
            {dlAll ? 'Generating…' : 'Print All'}
          </button>
          <button onClick={() => setShowNewForm(true)}
            className="h-9 px-4 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-[13px] font-semibold flex items-center gap-1.5 transition-all shadow-lg shadow-orange-500/25">
            <Plus size={15} /> Add Table
          </button>
        </div>
      </div>

      <div className="flex-1 p-8 overflow-y-auto bg-gray-950 space-y-6">

        {/* Stats */}
        <div className="grid grid-cols-4 gap-4">
          {[
            { label: 'Total Tables', val: stats.total,     icon: '🪑', color: 'text-white'       },
            { label: 'Linked',       val: stats.linked,    icon: '🔗', color: 'text-orange-400'  },
            { label: 'QR Generated', val: stats.generated, icon: '📱', color: 'text-green-400'   },
            { label: 'Zones',        val: stats.zones,     icon: '🏛️', color: 'text-purple-400'  },
          ].map(s => (
            <div key={s.label} className="bg-gray-900 border border-white/[0.07] rounded-2xl p-4">
              <span className="text-xl mb-3 block">{s.icon}</span>
              <p className={`text-[28px] font-bold ${s.color} leading-none`}>{s.val}</p>
              <p className="text-[10px] text-white/25 uppercase tracking-widest font-semibold mt-1">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Zone filters */}
        <div className="flex gap-2 flex-wrap">
          {ZONES.map(z => (
            <button key={z} onClick={() => setZoneFilter(z)}
              className={`px-3.5 py-1.5 rounded-full border text-[12px] font-semibold transition-all ${
                zoneFilter === z
                  ? 'bg-orange-500 border-orange-500 text-white shadow-lg shadow-orange-500/25'
                  : 'bg-white/5 border-white/10 text-white/50 hover:text-white/70 hover:bg-white/10'
              }`}>
              {z}
            </button>
          ))}
        </div>

        {/* QR Grid */}
        <div className="grid grid-cols-4 gap-4">
          {filtered.map(record => (
            <div key={record.id}
              className="bg-gray-900 border border-white/[0.07] rounded-2xl overflow-hidden hover:border-orange-500/30 hover:shadow-lg hover:shadow-orange-500/5 transition-all group">

              {/* QR preview area */}
              <div className="aspect-square flex items-center justify-center bg-white/[0.03] relative overflow-hidden cursor-pointer"
                onClick={() => openPreview(record)}>
                {record.qrDataUrl ? (
                  <img src={record.qrDataUrl} alt={`Table ${record.tableNumber}`} className="w-full h-full object-contain p-4" />
                ) : (
                  <div className="flex flex-col items-center gap-2">
                    <QrCode size={40} className="text-white/20" />
                    <p className="text-[10px] text-white/30 font-medium">Click to generate</p>
                  </div>
                )}
                <div className="absolute inset-0 bg-orange-500/80 flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Eye size={20} className="text-white" />
                  <span className="text-white text-[13px] font-semibold">Preview</span>
                </div>
              </div>

              <div className="p-3.5">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <p className="text-[14px] font-semibold text-white">Table {record.tableNumber}</p>
                    <p className="text-[11px] text-white/35 flex items-center gap-1 mt-0.5">
                      <MapPin size={10} />{record.zone}
                    </p>
                  </div>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${
                    record.linked
                      ? 'bg-green-500/10 border border-green-500/20 text-green-400'
                      : 'bg-white/5 border border-white/10 text-white/30'
                  }`}>
                    {record.linked ? 'Linked' : 'Unlinked'}
                  </span>
                </div>

                {/* URL copy row */}
                <div className="flex items-center gap-1.5 bg-white/[0.03] border border-white/[0.06] rounded-xl px-2.5 py-1.5 mb-3 cursor-pointer hover:bg-orange-500/5 hover:border-orange-500/20 transition-all"
                  onClick={() => copyUrl(record)}>
                  <p className="text-[10px] text-white/30 font-mono flex-1 truncate">{record.encodedUrl}</p>
                  {copiedId === record.id
                    ? <CheckCheck size={11} className="text-green-400 flex-shrink-0" />
                    : <Copy size={11} className="text-white/30 flex-shrink-0" />}
                </div>

                {/* Actions */}
                <div className="flex gap-1.5">
                  <button onClick={() => openPreview(record)}
                    className="flex-1 h-8 rounded-xl bg-orange-500/10 border border-orange-500/20 text-[11px] font-semibold text-orange-400 flex items-center justify-center gap-1 hover:bg-orange-500/20 transition-all">
                    <Eye size={11} /> View
                  </button>
                  <button onClick={() => downloadQR(record)}
                    className="flex-1 h-8 rounded-xl bg-white/5 border border-white/10 text-[11px] font-semibold text-white/50 flex items-center justify-center gap-1 hover:bg-white/10 hover:text-white/70 transition-all">
                    <Download size={11} /> Save
                  </button>
                  <button onClick={() => deleteRecord(record.id)}
                    className="w-8 h-8 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center hover:bg-red-500/20 transition-all">
                    <Trash2 size={11} className="text-red-400" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Preview Modal ── */}
      {preview && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-6"
          onClick={e => e.target === e.currentTarget && setPreview(null)}>
          <div className="bg-gray-900 border border-white/[0.07] rounded-3xl w-[480px] shadow-2xl overflow-hidden">

            <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.06]">
              <div>
                <h2 className="text-[18px] font-bold text-white">Table {preview.tableNumber} — QR Code</h2>
                <p className="text-[12px] text-white/30 mt-0.5">{preview.zone} · {preview.outlet}</p>
              </div>
              <button onClick={() => setPreview(null)}
                className="w-8 h-8 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center hover:bg-white/10 transition-all">
                <X size={14} className="text-white/50" />
              </button>
            </div>

            <div className="p-6">
              {/* QR display */}
              <div className="flex justify-center mb-6">
                <div className="relative w-[220px] h-[220px] bg-white/[0.03] border border-white/[0.06] rounded-3xl flex items-center justify-center">
                  {genState === 'generating' && (
                    <div className="flex flex-col items-center gap-3">
                      <Loader2 size={32} className="animate-spin text-orange-400" />
                      <p className="text-[12px] text-white/40">Generating QR code…</p>
                    </div>
                  )}
                  {genState === 'done' && previewImg && (
                    <img src={previewImg} alt={`Table ${preview.tableNumber}`} className="w-[200px] h-[200px] rounded-2xl" />
                  )}
                  {genState === 'error' && (
                    <div className="flex flex-col items-center gap-2 px-4 text-center">
                      <AlertCircle size={28} className="text-red-400" />
                      <p className="text-[12px] text-red-400">{genError}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Meta grid */}
              <div className="grid grid-cols-2 gap-2 mb-4">
                {[
                  { label: 'Table ID',      val: preview.tableId },
                  { label: 'Zone',          val: preview.zone },
                  { label: 'Restaurant ID', val: `${preview.restaurantId.slice(0, 8)}…` },
                  { label: 'Created',       val: new Date(preview.createdAt).toLocaleDateString() },
                ].map(m => (
                  <div key={m.label} className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-2.5">
                    <p className="text-[10px] text-white/25 uppercase tracking-widest font-semibold mb-0.5">{m.label}</p>
                    <p className="text-[12px] text-white/70 font-semibold font-mono truncate">{m.val}</p>
                  </div>
                ))}
              </div>

              {/* Encoded URL */}
              <div className="mb-4">
                <p className="text-[11px] text-white/25 uppercase tracking-widest font-semibold mb-1.5">Encoded URL</p>
                <div className="flex items-center gap-2 bg-white/[0.03] border border-white/[0.06] rounded-xl px-3 py-2.5">
                  <p className="text-[11px] text-orange-400 font-mono flex-1 break-all">{preview.encodedUrl}</p>
                  <div className="flex gap-1.5 flex-shrink-0">
                    <button onClick={() => copyUrl(preview)}
                      className="w-7 h-7 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center hover:bg-orange-500/10 transition-all">
                      {copiedId === preview.id
                        ? <CheckCheck size={12} className="text-green-400" />
                        : <Copy size={12} className="text-white/40" />}
                    </button>
                    <a href={preview.encodedUrl} target="_blank" rel="noopener noreferrer"
                      className="w-7 h-7 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center hover:bg-orange-500/10 transition-all">
                      <ExternalLink size={12} className="text-white/40" />
                    </a>
                  </div>
                </div>
              </div>

              {/* S3 path */}
              <div className="mb-5">
                <p className="text-[11px] text-white/25 uppercase tracking-widest font-semibold mb-1.5">S3 Storage Path</p>
                <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl px-3 py-2.5">
                  <p className="text-[10px] text-white/40 font-mono break-all">{preview.s3Key}</p>
                  <p className="text-[9px] text-white/25 font-mono break-all mt-0.5">{preview.s3Url}</p>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-2">
                <button onClick={() => previewImg && downloadQR(preview)} disabled={!previewImg}
                  className="flex-1 h-11 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-[13px] font-semibold flex items-center justify-center gap-2 transition-all shadow-lg shadow-orange-500/25 disabled:opacity-40">
                  <Download size={15} /> Download PNG
                </button>
                <button
                  onClick={() => {
                    if (previewImg) {
                      const w = window.open('', '_print');
                      w?.document.write(`<img src="${previewImg}" style="width:100%;max-width:400px;"/>`);
                      w?.print();
                    }
                  }}
                  disabled={!previewImg}
                  className="h-11 px-4 rounded-xl bg-white/5 border border-white/10 text-white/60 text-[13px] font-semibold flex items-center gap-2 hover:bg-white/10 hover:text-white/80 transition-all disabled:opacity-40">
                  <Printer size={15} /> Print
                </button>
              </div>

              <div className="mt-3 text-center">
                <a href={preview.encodedUrl} target="_blank" rel="noopener noreferrer"
                  className="text-[12px] text-orange-400 hover:text-orange-300 underline underline-offset-2 flex items-center justify-center gap-1 transition-colors">
                  <ExternalLink size={12} /> Test this QR link in a new tab
                </a>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Add Table Modal ── */}
      {showNewForm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-6"
          onClick={e => e.target === e.currentTarget && setShowNewForm(false)}>
          <div className="bg-gray-900 border border-white/[0.07] rounded-3xl w-[380px] p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-[18px] font-bold text-white">Add New Table</h2>
              <button onClick={() => setShowNewForm(false)}
                className="w-8 h-8 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center hover:bg-white/10 transition-all">
                <X size={14} className="text-white/50" />
              </button>
            </div>

            <div className="mb-4">
              <label className="block text-[11px] text-white/30 uppercase tracking-widest font-semibold mb-1.5">Table Number</label>
              <input
                value={newTable.number}
                onChange={e => setNewTable(p => ({ ...p, number: e.target.value }))}
                placeholder="e.g. 13" type="number" min="1" max="99"
                className="w-full h-10 px-3 rounded-xl bg-gray-800 border border-white/10 text-white text-[13px] placeholder-white/20 focus:outline-none focus:border-orange-500/50 transition"
              />
            </div>

            <div className="mb-4">
              <label className="block text-[11px] text-white/30 uppercase tracking-widest font-semibold mb-2">Zone</label>
              <div className="flex gap-2 flex-wrap">
                {['Main Hall', 'Garden Terrace', 'Private Dining', 'Lounge Bar'].map(z => (
                  <button key={z} onClick={() => setNewTable(p => ({ ...p, zone: z, outlet: z }))}
                    className={`px-3 py-1.5 rounded-full border text-[12px] font-semibold transition-all ${
                      newTable.zone === z
                        ? 'bg-orange-500 border-orange-500 text-white'
                        : 'bg-white/5 border-white/10 text-white/50 hover:bg-white/10'
                    }`}>
                    {z}
                  </button>
                ))}
              </div>
            </div>

            {/* Preview URL */}
            <div className="bg-orange-500/5 border border-orange-500/15 rounded-xl p-3 mb-5">
              <p className="text-[11px] text-orange-400/70 font-semibold mb-1">QR will encode:</p>
              <p className="text-[10px] text-white/30 font-mono break-all">
                {typeof window !== 'undefined' ? window.location.origin : DEFAULT_BASE}
                {`/guest?rid=${RESTAURANT_ID.slice(0, 8)}…&tid=T${(newTable.number || '??').padStart(2, '0')}`}
              </p>
            </div>

            <div className="flex gap-2">
              <button onClick={() => setShowNewForm(false)}
                className="flex-1 h-10 rounded-xl bg-white/5 border border-white/10 text-[13px] font-semibold text-white/40 hover:bg-white/10 hover:text-white/60 transition-all">
                Cancel
              </button>
              <button onClick={addTable} disabled={!newTable.number.trim()}
                className="flex-[2] h-10 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-[13px] font-semibold flex items-center justify-center gap-2 transition-all shadow-lg shadow-orange-500/25 disabled:opacity-40">
                <Plus size={15} /> Create & Generate QR
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}