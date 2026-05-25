'use client';

import { useState } from 'react';
import { Edit2, Lock, X, ShieldCheck, ShieldX } from 'lucide-react';
import { ADMIN_USERS } from '@/lib/data';
import type { AdminUser, UserRole } from '@/lib/types';

const ROLE_CFG: Record<UserRole, { label: string; bg: string; text: string; border: string; avatar: string }> = {
  super:   { label: 'Super Admin',   bg: 'bg-orange-500/15', text: 'text-orange-400',  border: 'border-orange-500/25', avatar: 'bg-orange-500/15 text-orange-400'  },
  manager: { label: 'Manager',       bg: 'bg-blue-500/10',   text: 'text-blue-400',    border: 'border-blue-500/20',   avatar: 'bg-blue-500/10 text-blue-400'     },
  kitchen: { label: 'Kitchen Staff', bg: 'bg-purple-500/10', text: 'text-purple-400',  border: 'border-purple-500/20', avatar: 'bg-purple-500/10 text-purple-400' },
};

const PERMS = [
  'View Menu', 'Edit Menu', 'View Orders', 'Manage Users', 'QR Codes', 'Analytics',
];
const DEFAULT_PERMS_MANAGER = [true, true, true, false, true, false];

export default function AdminUsersPage() {
  const [users,  setUsers]  = useState<AdminUser[]>(ADMIN_USERS);
  const [modal,  setModal]  = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved,  setSaved]  = useState(false);
  const [perms,  setPerms]  = useState(DEFAULT_PERMS_MANAGER);

  const togglePerm = (i: number) =>
    setPerms(p => p.map((v, idx) => idx === i ? !v : v));

  const saveUser = async () => {
    setSaving(true);
    await new Promise(r => setTimeout(r, 1000));
    setSaving(false); setSaved(true);
    setTimeout(() => { setModal(false); setSaved(false); }, 900);
  };

  const STATS = [
    { label: 'Total Users', val: users.length,                                sub: 'Across all roles',     color: 'text-white'      },
    { label: 'Active Now',  val: users.filter(u => u.isOnline).length,        sub: 'Online this session',  color: 'text-green-400'  },
    { label: 'MFA Enabled', val: users.filter(u => u.mfaEnabled).length,      sub: `${Math.round(users.filter(u => u.mfaEnabled).length / users.length * 100)}% coverage`, color: 'text-orange-400' },
  ];

  return (
    <>
      {/* ── Top bar ── */}
      <div className="flex items-center justify-between px-8 py-5 border-b border-white/[0.06] bg-gray-950">
        <div>
          <h1 className="text-[22px] font-bold text-white tracking-tight">User Management</h1>
          <p className="text-[12px] text-white/30 mt-0.5">Role-based access control · Super Admin &amp; Manager permissions</p>
        </div>
        <button
          onClick={() => { setModal(true); setSaved(false); setPerms(DEFAULT_PERMS_MANAGER); }}
          className="h-9 px-4 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-[13px] font-semibold flex items-center gap-1.5 transition-all shadow-lg shadow-orange-500/25">
          + Add User
        </button>
      </div>

      <div className="flex-1 p-8 overflow-y-auto bg-gray-950 space-y-6">

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          {STATS.map(s => (
            <div key={s.label} className="bg-gray-900 border border-white/[0.07] rounded-2xl px-5 py-4">
              <p className="text-[10px] text-white/25 uppercase tracking-widest font-semibold mb-3">{s.label}</p>
              <p className={`text-[26px] font-bold ${s.color} leading-none`}>{s.val}</p>
              <p className="text-[11px] text-white/20 mt-1.5">{s.sub}</p>
            </div>
          ))}
        </div>

        {/* User table */}
        <div className="bg-gray-900 border border-white/[0.07] rounded-2xl overflow-hidden">
          {/* Header */}
          <div className="grid gap-3 px-5 py-3 border-b border-white/[0.06] bg-white/[0.02]"
            style={{ gridTemplateColumns: '200px 110px 110px 110px 1fr 90px' }}>
            {['User', 'Role', 'MFA', 'Status', 'Last Login', 'Actions'].map(h => (
              <p key={h} className="text-[10px] text-white/25 uppercase tracking-widest font-semibold">{h}</p>
            ))}
          </div>

          {/* Rows */}
          {users.map(user => {
            const role = ROLE_CFG[user.role];
            return (
              <div key={user.id}
                className="grid gap-3 px-5 py-3.5 border-b border-white/[0.04] last:border-0 items-center hover:bg-white/[0.02] transition-colors"
                style={{ gridTemplateColumns: '200px 110px 110px 110px 1fr 90px' }}>

                {/* Name + Avatar */}
                <div className="flex items-center gap-2.5">
                  <div className={`w-8 h-8 rounded-[10px] flex items-center justify-center text-[12px] font-bold flex-shrink-0 ${role.avatar}`}>
                    {user.initials}
                  </div>
                  <div className="min-w-0">
                    <p className="text-[13px] font-semibold text-white/80 truncate">{user.name}</p>
                    <p className="text-[11px] text-white/25 truncate">{user.email}</p>
                  </div>
                </div>

                {/* Role */}
                <span className={`inline-flex px-2.5 py-1 rounded-full text-[11px] font-semibold border ${role.bg} ${role.text} ${role.border}`}>
                  {role.label}
                </span>

                {/* MFA */}
                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] border ${
                  user.mfaEnabled
                    ? 'bg-green-500/10 border-green-500/20 text-green-400'
                    : 'bg-red-500/10 border-red-500/20 text-red-400'
                }`}>
                  {user.mfaEnabled ? <ShieldCheck size={11} /> : <ShieldX size={11} />}
                  {user.mfaEnabled ? 'On' : 'Off'}
                </span>

                {/* Status */}
                <div className={`flex items-center gap-1.5 text-[12px] ${user.isOnline ? 'text-green-400' : 'text-white/25'}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${user.isOnline ? 'bg-green-400 animate-pulse' : 'bg-white/15'}`} />
                  {user.isOnline ? 'Online' : 'Offline'}
                </div>

                {/* Last login */}
                <p className="text-[11px] text-white/25">{user.lastLogin}</p>

                {/* Actions */}
                <div className="flex gap-1.5">
                  <button className="w-7 h-7 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center hover:bg-orange-500/10 hover:border-orange-500/25 transition-all">
                    <Edit2 size={12} className="text-white/35" />
                  </button>
                  <button className="w-7 h-7 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center hover:bg-orange-500/10 hover:border-orange-500/25 transition-all">
                    <Lock size={12} className="text-white/35" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Create User Modal ── */}
      {modal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-6"
          onClick={e => e.target === e.currentTarget && setModal(false)}>
          <div className="bg-gray-900 border border-white/[0.07] rounded-3xl w-[400px] p-6 shadow-2xl">

            <div className="flex items-center justify-between mb-5">
              <h2 className="text-[18px] font-bold text-white">Create New User</h2>
              <button onClick={() => setModal(false)}
                className="w-8 h-8 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center hover:bg-white/10 transition-all">
                <X size={14} className="text-white/50" />
              </button>
            </div>

            <div className="mb-4">
              <label className="block text-[11px] text-white/30 uppercase tracking-widest font-semibold mb-1.5">Full Name</label>
              <input
                placeholder="e.g. Ahmed Raza"
                className="w-full h-10 px-3 rounded-xl bg-gray-800 border border-white/10 text-white text-[13px] placeholder-white/20 focus:outline-none focus:border-orange-500/50 transition"
              />
            </div>

            <div className="mb-4">
              <label className="block text-[11px] text-white/30 uppercase tracking-widest font-semibold mb-1.5">Email Address</label>
              <input
                type="email"
                placeholder="e.g. ahmed@restaurant.com"
                className="w-full h-10 px-3 rounded-xl bg-gray-800 border border-white/10 text-white text-[13px] placeholder-white/20 focus:outline-none focus:border-orange-500/50 transition"
              />
            </div>

            <div className="mb-4">
              <label className="block text-[11px] text-white/30 uppercase tracking-widest font-semibold mb-1.5">Role</label>
              <select
                className="w-full h-10 px-3 rounded-xl bg-gray-800 border border-white/10 text-white text-[13px] focus:outline-none focus:border-orange-500/50 transition appearance-none">
                <option value="manager">Manager</option>
                <option value="kitchen">Kitchen Staff</option>
              </select>
            </div>

            <div className="mb-4">
              <label className="block text-[11px] text-white/30 uppercase tracking-widest font-semibold mb-2">Permissions</label>
              <div className="grid grid-cols-2 gap-2">
                {PERMS.map((perm, i) => (
                  <div key={perm}
                    className={`flex items-center gap-2 p-2.5 rounded-xl border cursor-pointer transition-all ${
                      perms[i]
                        ? 'bg-orange-500/10 border-orange-500/25'
                        : 'bg-white/[0.03] border-white/[0.06] hover:bg-white/[0.05]'
                    }`}
                    onClick={() => togglePerm(i)}>
                    <div className={`w-4 h-4 rounded-[5px] border flex items-center justify-center flex-shrink-0 transition-all ${
                      perms[i] ? 'bg-orange-500 border-orange-500' : 'border-white/20'
                    }`}>
                      {perms[i] && <span className="text-white text-[10px] font-bold">✓</span>}
                    </div>
                    <span className={`text-[11px] font-medium ${perms[i] ? 'text-orange-300' : 'text-white/35'}`}>{perm}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex gap-2 mt-5">
              <button onClick={() => setModal(false)}
                className="flex-1 h-10 rounded-xl bg-white/5 border border-white/10 text-[13px] font-semibold text-white/40 hover:bg-white/10 hover:text-white/60 transition-all">
                Cancel
              </button>
              <button onClick={saveUser} disabled={saving}
                className={`flex-[2] h-10 rounded-xl flex items-center justify-center gap-1.5 text-[13px] font-semibold transition-all ${
                  saved
                    ? 'bg-green-500/15 border border-green-500/30 text-green-400'
                    : 'bg-orange-500 hover:bg-orange-600 text-white shadow-lg shadow-orange-500/25'
                }`}>
                {saving
                  ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  : saved ? '✓ User Created!' : '👤 Create User'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}