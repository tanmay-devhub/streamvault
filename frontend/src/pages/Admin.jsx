import { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { adminApi } from '../services/api';

// ── Helpers ───────────────────────────────────────────────
function formatDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}
function formatDateTime(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}
function formatDuration(s) {
  if (!s) return '—';
  const m = Math.floor(s / 60), sec = s % 60;
  return `${m}:${String(sec).padStart(2, '0')}`;
}

const STATUS_STYLES = { ready: 'badge-ready', processing: 'badge-process', failed: 'badge-failed' };
const Spinner = () => (
  <div className="flex justify-center py-16">
    <svg className="animate-spin w-8 h-8 text-brand-500" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
    </svg>
  </div>
);

// ── Stat Card ─────────────────────────────────────────────
function StatCard({ label, value, color, icon }) {
  return (
    <div className="bg-white dark:bg-gray-900 border border-slate-200 dark:border-gray-800 rounded-2xl p-6 flex items-center gap-4">
      <div className={`w-12 h-12 rounded-xl ${color} flex items-center justify-center flex-shrink-0`}>{icon}</div>
      <div>
        <p className="text-2xl font-bold text-slate-900 dark:text-white">{value ?? '—'}</p>
        <p className="text-sm text-slate-400 dark:text-gray-500">{label}</p>
      </div>
    </div>
  );
}

// ── Dashboard Tab ─────────────────────────────────────────
function DashboardTab() {
  const [stats, setStats]   = useState(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    adminApi.getStats().then(setStats).catch((e) => toast.error(e.message)).finally(() => setLoading(false));
  }, []);
  if (loading) return <Spinner/>;
  return (
    <div className="space-y-8">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Videos" value={stats?.total}      color="bg-brand-500/10"   icon={<svg viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6 text-brand-500"><path d="M4 6h16v12H4z" opacity=".3"/><path d="M18 4H6c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2z"/></svg>}/>
        <StatCard label="Ready"         value={stats?.ready}      color="bg-emerald-500/10" icon={<svg viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6 text-emerald-500"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/></svg>}/>
        <StatCard label="Processing"    value={stats?.processing} color="bg-yellow-500/10"  icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-6 h-6 text-yellow-500"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>}/>
        <StatCard label="Failed"        value={stats?.failed}     color="bg-red-500/10"     icon={<svg viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6 text-red-500"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg>}/>
      </div>
      {stats?.recentUploads?.length > 0 && (
        <div className="bg-white dark:bg-gray-900 border border-slate-200 dark:border-gray-800 rounded-2xl overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200 dark:border-gray-800">
            <h3 className="font-semibold text-slate-900 dark:text-white">Recent Uploads</h3>
          </div>
          <div className="divide-y divide-slate-200 dark:divide-gray-800">
            {stats.recentUploads.map((v) => (
              <div key={v.id} className="px-6 py-4 flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <p className="font-medium text-slate-800 dark:text-gray-200 truncate">{v.title}</p>
                  <p className="text-xs text-slate-400 dark:text-gray-500">{formatDate(v.createdAt)}</p>
                </div>
                <span className={STATUS_STYLES[v.status] || 'badge bg-slate-100 dark:bg-gray-700 text-slate-500 dark:text-gray-400'}>{v.status}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Videos Tab ────────────────────────────────────────────
function VideosTab() {
  const [videos, setVideos]         = useState([]);
  const [pagination, setPagination] = useState({ total: 0, page: 1, pages: 1 });
  const [loading, setLoading]       = useState(true);
  const [search, setSearch]         = useState('');
  const [deleting, setDeleting]     = useState(null);

  const fetchVideos = useCallback((page = 1) => {
    setLoading(true);
    adminApi.listVideos({ search, page, limit: 15 })
      .then((r) => { setVideos(r.videos); setPagination(r.pagination); })
      .catch((e) => toast.error(e.message))
      .finally(() => setLoading(false));
  }, [search]);

  useEffect(() => { fetchVideos(1); }, [fetchVideos]);

  const handleDelete = async (video) => {
    if (!confirm(`Delete "${video.title}"?`)) return;
    setDeleting(video.id);
    try { await adminApi.deleteVideo(video.id); toast.success('Deleted'); fetchVideos(pagination.page); }
    catch (e) { toast.error(e.message); }
    finally { setDeleting(null); }
  };

  const handleDeleteAllFailed = async () => {
    if (!confirm('Delete ALL failed videos?')) return;
    try { const r = await adminApi.deleteAllFailed(); toast.success(r.message); fetchVideos(1); }
    catch (e) { toast.error(e.message); }
  };

  const PRIVACY_BADGE = { public: null, unlisted: 'bg-yellow-500/15 text-yellow-600 dark:text-yellow-400', private: 'bg-red-500/15 text-red-600 dark:text-red-400' };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
        <div className="relative flex-1">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
          <input type="text" placeholder="Search videos…" value={search} onChange={(e) => setSearch(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && fetchVideos(1)} className="input pl-10"/>
        </div>
        <button onClick={handleDeleteAllFailed} className="px-4 py-2.5 rounded-xl bg-red-500/10 text-red-600 dark:text-red-400 hover:bg-red-500/20 text-sm font-medium transition-all border border-red-500/20">Delete All Failed</button>
      </div>
      <div className="bg-white dark:bg-gray-900 border border-slate-200 dark:border-gray-800 rounded-2xl overflow-hidden">
        {loading ? <Spinner/> : videos.length === 0 ? (
          <div className="py-16 text-center text-slate-400 dark:text-gray-500">No videos found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-slate-200 dark:border-gray-800 text-xs uppercase text-slate-400 dark:text-gray-600">
                <th className="px-6 py-3 text-left">Title</th>
                <th className="px-6 py-3 text-left">Uploader</th>
                <th className="px-6 py-3 text-left">Status</th>
                <th className="px-6 py-3 text-left">Privacy</th>
                <th className="px-6 py-3 text-left">Duration</th>
                <th className="px-6 py-3 text-left">Uploaded</th>
                <th className="px-6 py-3 text-right">Actions</th>
              </tr></thead>
              <tbody className="divide-y divide-slate-100 dark:divide-gray-800">
                {videos.map((v) => (
                  <tr key={v.id} className="hover:bg-slate-50 dark:hover:bg-gray-800/40 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        {v.thumbnailUrl
                          ? <img src={v.thumbnailUrl} alt="" className="w-10 h-7 object-cover rounded-md flex-shrink-0"/>
                          : <div className="w-10 h-7 bg-slate-200 dark:bg-gray-800 rounded-md flex-shrink-0"/>}
                        <div className="min-w-0">
                          <p className="font-medium text-slate-800 dark:text-gray-200 truncate max-w-[160px]">{v.title}</p>
                          <p className="text-xs text-slate-400 dark:text-gray-600 font-mono">{v.id?.slice(0,8)}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {v.uploaderProfile ? (
                        <Link to={`/channel/${v.uploaderId}`} className="flex items-center gap-2 group/up min-w-0">
                          {v.uploaderProfile.avatarUrl ? (
                            <img src={v.uploaderProfile.avatarUrl} alt="" className="w-7 h-7 rounded-full object-cover flex-shrink-0"/>
                          ) : (
                            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-brand-600 to-brand-800 flex items-center justify-center flex-shrink-0">
                              <span className="text-white text-xs font-bold">{v.uploaderProfile.channelName?.[0]?.toUpperCase()}</span>
                            </div>
                          )}
                          <span className="text-slate-600 dark:text-gray-300 group-hover/up:text-brand-500 dark:group-hover/up:text-brand-400 transition-colors text-sm truncate max-w-[110px]">
                            {v.uploaderProfile.channelName}
                          </span>
                        </Link>
                      ) : v.uploaderId ? (
                        <Link to={`/channel/${v.uploaderId}`} className="text-xs text-slate-400 dark:text-gray-600 hover:text-slate-600 dark:hover:text-gray-400 font-mono transition-colors">
                          {v.uploaderId.slice(0, 10)}…
                        </Link>
                      ) : (
                        <span className="text-slate-300 dark:text-gray-700 text-xs">—</span>
                      )}
                    </td>
                    <td className="px-6 py-4"><span className={STATUS_STYLES[v.status] || 'badge bg-slate-100 dark:bg-gray-700 text-slate-500 dark:text-gray-400'}>{v.status}</span></td>
                    <td className="px-6 py-4">{PRIVACY_BADGE[v.privacy] ? <span className={`badge ${PRIVACY_BADGE[v.privacy]}`}>{v.privacy}</span> : <span className="text-slate-400 dark:text-gray-600 text-xs">{v.privacy}</span>}</td>
                    <td className="px-6 py-4 text-slate-500 dark:text-gray-400 font-mono text-xs">{formatDuration(v.duration)}</td>
                    <td className="px-6 py-4 text-slate-400 dark:text-gray-500 text-xs">{formatDate(v.createdAt)}</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        {v.status === 'ready' && <Link to={`/watch/${v.id}`} className="p-1.5 rounded-lg text-slate-400 dark:text-gray-500 hover:text-brand-500 dark:hover:text-brand-400 hover:bg-brand-400/10 transition-all" title="Watch"><svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4"><path d="M8 5v14l11-7z"/></svg></Link>}
                        <button onClick={() => handleDelete(v)} disabled={deleting === v.id} className="p-1.5 rounded-lg text-slate-400 dark:text-gray-500 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-400/10 transition-all" title="Delete">
                          {deleting === v.id
                            ? <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>
                            : <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {pagination.pages > 1 && (
          <div className="border-t border-slate-200 dark:border-gray-800 px-6 py-4 flex items-center justify-between text-sm">
            <span className="text-slate-400 dark:text-gray-500">{pagination.total} total</span>
            <div className="flex gap-2">
              <button onClick={() => fetchVideos(pagination.page - 1)} disabled={pagination.page <= 1} className="btn-ghost px-3 py-1.5 disabled:opacity-30 text-xs">← Prev</button>
              <span className="text-slate-500 dark:text-gray-400 px-2 py-1.5">{pagination.page} / {pagination.pages}</span>
              <button onClick={() => fetchVideos(pagination.page + 1)} disabled={pagination.page >= pagination.pages} className="btn-ghost px-3 py-1.5 disabled:opacity-30 text-xs">Next →</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Suspend Modal ─────────────────────────────────────────
function SuspendModal({ user, onDone, onClose }) {
  const [reason, setReason]   = useState('');
  const [days,   setDays]     = useState('');
  const [saving, setSaving]   = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await adminApi.suspendUser(user.id, { reason, durationDays: days ? parseInt(days, 10) : undefined });
      toast.success(days ? `Suspended for ${days} day(s)` : 'Permanently suspended');
      onDone();
    } catch (err) { toast.error(err.message); }
    finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 dark:bg-black/75 backdrop-blur-sm">
      <div className="bg-white dark:bg-gray-900 border border-slate-200 dark:border-gray-800 rounded-2xl max-w-sm w-full p-7 shadow-2xl animate-fade-in">
        <h3 className="font-bold text-slate-900 dark:text-white text-lg mb-1">Suspend User</h3>
        <p className="text-slate-500 dark:text-gray-500 text-sm mb-5">
          {user.firstName || user.email}
        </p>
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-1.5">Reason</label>
            <input type="text" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Violation of terms…" className="input"/>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-1.5">Duration (days)</label>
            <input type="number" min="1" value={days} onChange={(e) => setDays(e.target.value)} placeholder="Leave empty for permanent" className="input"/>
          </div>
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="btn-ghost flex-1 justify-center" disabled={saving}>Cancel</button>
            <button type="submit" disabled={saving} className="flex-1 justify-center px-4 py-2.5 rounded-xl bg-red-500/20 text-red-600 dark:text-red-400 border border-red-500/30 hover:bg-red-500/30 text-sm font-medium transition-all">
              {saving ? 'Suspending…' : 'Suspend'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Users Tab ─────────────────────────────────────────────
function UsersTab() {
  const [users,    setUsers]    = useState([]);
  const [total,    setTotal]    = useState(0);
  const [loading,  setLoading]  = useState(true);
  const [updating, setUpdating] = useState(null);
  const [suspendTarget, setSuspendTarget] = useState(null);

  const fetchUsers = () => {
    setLoading(true);
    adminApi.listUsers({ limit: 50 })
      .then((r) => { setUsers(r.users); setTotal(r.total); })
      .catch((e) => toast.error(e.message))
      .finally(() => setLoading(false));
  };
  useEffect(fetchUsers, []);

  const handleRoleChange = async (u) => {
    const newRole = u.role === 'admin' ? 'user' : 'admin';
    if (!confirm(`Change role to "${newRole}"?`)) return;
    setUpdating(u.id + '_role');
    try {
      await adminApi.setUserRole(u.id, newRole);
      setUsers((prev) => prev.map((x) => x.id === u.id ? { ...x, role: newRole } : x));
      toast.success(`Role updated to "${newRole}"`);
    } catch (e) { toast.error(e.message); }
    finally { setUpdating(null); }
  };

  const handleLiftSuspension = async (u) => {
    if (!confirm('Lift suspension for this user?')) return;
    setUpdating(u.id + '_susp');
    try {
      await adminApi.liftSuspension(u.id);
      setUsers((prev) => prev.map((x) => x.id === u.id ? { ...x, suspension: null } : x));
      toast.success('Suspension lifted');
    } catch (e) { toast.error(e.message); }
    finally { setUpdating(null); }
  };

  if (loading) return <Spinner/>;
  return (
    <>
      {suspendTarget && (
        <SuspendModal
          user={suspendTarget}
          onDone={() => { setSuspendTarget(null); fetchUsers(); }}
          onClose={() => setSuspendTarget(null)}
        />
      )}
      <div className="bg-white dark:bg-gray-900 border border-slate-200 dark:border-gray-800 rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 dark:border-gray-800 flex items-center justify-between">
          <h3 className="font-semibold text-slate-900 dark:text-white">Users <span className="text-slate-400 dark:text-gray-600 font-normal text-sm">({total})</span></h3>
        </div>
        <div className="divide-y divide-slate-100 dark:divide-gray-800">
          {users.map((u) => (
            <div key={u.id} className="px-6 py-4 flex items-center gap-4 hover:bg-slate-50 dark:hover:bg-gray-800/30 transition-colors flex-wrap">
              {u.imageUrl
                ? <img src={u.imageUrl} alt="" className="w-9 h-9 rounded-full flex-shrink-0 ring-2 ring-slate-200 dark:ring-gray-700"/>
                : <div className="w-9 h-9 rounded-full bg-brand-500/20 flex items-center justify-center flex-shrink-0 text-brand-500 dark:text-brand-400 font-bold text-sm">{(u.email || '?')[0].toUpperCase()}</div>
              }
              <div className="flex-1 min-w-0">
                <p className="font-medium text-slate-800 dark:text-gray-200 truncate">
                  {u.firstName || u.lastName ? `${u.firstName || ''} ${u.lastName || ''}`.trim() : u.email}
                </p>
                <p className="text-xs text-slate-400 dark:text-gray-500 truncate">{u.email}</p>
                {u.suspension && (
                  <p className="text-xs text-red-500 dark:text-red-400 mt-0.5">
                    Suspended{u.suspension.until ? ` until ${formatDate(u.suspension.until)}` : ' permanently'}
                    {u.suspension.reason ? ` — ${u.suspension.reason}` : ''}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2 flex-shrink-0 flex-wrap">
                <span className={`badge ${u.role === 'admin' ? 'bg-brand-500/20 text-brand-600 dark:text-brand-400' : 'bg-slate-100 dark:bg-gray-800 text-slate-500 dark:text-gray-500'}`}>{u.role}</span>
                <button onClick={() => handleRoleChange(u)} disabled={!!updating}
                  className="text-xs px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-gray-800 hover:bg-slate-200 dark:hover:bg-gray-700 text-slate-500 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white transition-all border border-slate-200 dark:border-gray-700">
                  {updating === u.id + '_role' ? '…' : u.role === 'admin' ? 'Demote' : 'Make Admin'}
                </button>
                {u.suspension ? (
                  <button onClick={() => handleLiftSuspension(u)} disabled={!!updating}
                    className="text-xs px-3 py-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 transition-all border border-emerald-500/20">
                    {updating === u.id + '_susp' ? '…' : 'Lift Ban'}
                  </button>
                ) : (
                  <button onClick={() => setSuspendTarget(u)}
                    className="text-xs px-3 py-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-600 dark:text-red-400 transition-all border border-red-500/20">
                    Suspend
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

// ── Channels Tab ──────────────────────────────────────────
function ChannelsTab() {
  const [profiles,    setProfiles]    = useState([]);
  const [total,       setTotal]       = useState(0);
  const [loading,     setLoading]     = useState(true);
  const [search,      setSearch]      = useState('');
  const [editTarget,  setEditTarget]  = useState(null);
  const [editName,    setEditName]    = useState('');
  const [editBio,     setEditBio]     = useState('');
  const [saving,      setSaving]      = useState(false);

  const fetchProfiles = useCallback((page = 1) => {
    setLoading(true);
    adminApi.listProfiles({ search, page, limit: 20 })
      .then((r) => { setProfiles(r.profiles); setTotal(r.total); })
      .catch((e) => toast.error(e.message))
      .finally(() => setLoading(false));
  }, [search]);

  useEffect(() => { fetchProfiles(1); }, [fetchProfiles]);

  const startEdit = (p) => { setEditTarget(p); setEditName(p.channelName); setEditBio(p.bio); };

  const saveEdit = async () => {
    setSaving(true);
    try {
      await adminApi.updateProfile(editTarget.userId, { channelName: editName, bio: editBio });
      toast.success('Channel updated');
      setEditTarget(null);
      fetchProfiles(1);
    } catch (e) { toast.error(e.message); }
    finally { setSaving(false); }
  };

  const deleteProfile = async (p) => {
    if (!confirm(`Delete channel "${p.channelName}"?`)) return;
    try {
      await adminApi.deleteProfile(p.userId);
      toast.success('Channel deleted');
      fetchProfiles(1);
    } catch (e) { toast.error(e.message); }
  };

  return (
    <div className="space-y-4">
      {editTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 dark:bg-black/75 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-900 border border-slate-200 dark:border-gray-800 rounded-2xl max-w-sm w-full p-7 shadow-2xl animate-fade-in">
            <h3 className="font-bold text-slate-900 dark:text-white text-lg mb-5">Edit Channel</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-1.5">Channel name</label>
                <input type="text" value={editName} onChange={(e) => setEditName(e.target.value)} className="input" maxLength={60}/>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-1.5">Bio</label>
                <textarea value={editBio} onChange={(e) => setEditBio(e.target.value)} rows={3} className="input resize-none" maxLength={500}/>
              </div>
              <div className="flex gap-3 pt-1">
                <button onClick={() => setEditTarget(null)} className="btn-ghost flex-1 justify-center" disabled={saving}>Cancel</button>
                <button onClick={saveEdit} disabled={saving || !editName.trim()} className="btn-primary flex-1 justify-center">{saving ? 'Saving…' : 'Save'}</button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="relative">
        <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
        <input type="text" placeholder="Search channels…" value={search} onChange={(e) => setSearch(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && fetchProfiles(1)} className="input pl-10"/>
      </div>

      <div className="bg-white dark:bg-gray-900 border border-slate-200 dark:border-gray-800 rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 dark:border-gray-800">
          <h3 className="font-semibold text-slate-900 dark:text-white">Channels <span className="text-slate-400 dark:text-gray-600 font-normal text-sm">({total})</span></h3>
        </div>
        {loading ? <Spinner/> : profiles.length === 0 ? (
          <div className="py-12 text-center text-slate-400 dark:text-gray-500">No channels found.</div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-gray-800">
            {profiles.map((p) => (
              <div key={p.userId} className="px-6 py-4 flex items-center gap-4 hover:bg-slate-50 dark:hover:bg-gray-800/30 transition-colors group">
                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-brand-600 to-brand-800 flex items-center justify-center flex-shrink-0">
                  <span className="text-white font-bold text-sm">{p.channelName?.[0]?.toUpperCase()}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-slate-800 dark:text-gray-200">{p.channelName}</p>
                  {p.bio && <p className="text-xs text-slate-400 dark:text-gray-500 truncate">{p.bio}</p>}
                  <p className="text-xs text-slate-300 dark:text-gray-600">ID: {p.userId?.slice(0, 12)}…</p>
                </div>
                <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                  <Link to={`/channel/${p.userId}`} className="p-1.5 rounded-lg text-slate-400 dark:text-gray-500 hover:text-brand-500 dark:hover:text-brand-400 hover:bg-brand-400/10 transition-all" title="View Channel">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>
                  </Link>
                  <button onClick={() => startEdit(p)} className="p-1.5 rounded-lg text-slate-400 dark:text-gray-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-gray-700 transition-all" title="Edit">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"/></svg>
                  </button>
                  <button onClick={() => deleteProfile(p)} className="p-1.5 rounded-lg text-slate-400 dark:text-gray-500 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-400/10 transition-all" title="Delete">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/></svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Audit Log Tab ─────────────────────────────────────────
const ACTION_COLORS = {
  delete_video:     'text-red-500 dark:text-red-400',
  delete_all_failed:'text-red-500 dark:text-red-400',
  set_role:         'text-brand-600 dark:text-brand-400',
  suspend_user:     'text-orange-500 dark:text-orange-400',
  lift_suspension:  'text-emerald-600 dark:text-emerald-400',
  edit_profile:     'text-yellow-600 dark:text-yellow-400',
  delete_profile:   'text-red-500 dark:text-red-400',
};

function AuditTab() {
  const [entries,    setEntries]    = useState([]);
  const [pagination, setPagination] = useState({ total: 0, page: 1, pages: 1 });
  const [loading,    setLoading]    = useState(true);

  const fetchAudit = useCallback((page = 1) => {
    setLoading(true);
    adminApi.getAuditLog({ page, limit: 50 })
      .then((r) => { setEntries(r.entries); setPagination(r.pagination); })
      .catch((e) => toast.error(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { fetchAudit(1); }, [fetchAudit]);

  return (
    <div className="bg-white dark:bg-gray-900 border border-slate-200 dark:border-gray-800 rounded-2xl overflow-hidden">
      <div className="px-6 py-4 border-b border-slate-200 dark:border-gray-800 flex items-center justify-between">
        <h3 className="font-semibold text-slate-900 dark:text-white">Audit Log <span className="text-slate-400 dark:text-gray-600 font-normal text-sm">({pagination.total})</span></h3>
        <p className="text-xs text-slate-400 dark:text-gray-600">All admin actions are recorded</p>
      </div>
      {loading ? <Spinner/> : entries.length === 0 ? (
        <div className="py-12 text-center text-slate-400 dark:text-gray-500">No audit entries yet.</div>
      ) : (
        <div className="divide-y divide-slate-100 dark:divide-gray-800">
          {entries.map((e) => (
            <div key={e.id} className="px-6 py-3.5 flex items-start gap-4">
              <span className={`font-mono text-sm font-medium mt-0.5 flex-shrink-0 ${ACTION_COLORS[e.action] || 'text-slate-500 dark:text-gray-400'}`}>
                {e.action.replace(/_/g, ' ')}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-slate-700 dark:text-gray-300">
                  <span className="text-slate-400 dark:text-gray-500">{e.targetType}</span>
                  {' · '}
                  <span className="font-mono text-xs text-slate-500 dark:text-gray-400">{String(e.targetId).slice(0, 16)}</span>
                  {Object.keys(e.details || {}).length > 0 && (
                    <span className="text-slate-400 dark:text-gray-600 text-xs ml-2">{JSON.stringify(e.details)}</span>
                  )}
                </p>
                <p className="text-xs text-slate-400 dark:text-gray-600 mt-0.5">
                  by <span className="font-mono">{e.adminId?.slice(0, 12)}…</span>
                  {' · '}{formatDateTime(e.createdAt)}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
      {pagination.pages > 1 && (
        <div className="border-t border-slate-200 dark:border-gray-800 px-6 py-4 flex items-center justify-between text-sm">
          <span className="text-slate-400 dark:text-gray-500">{pagination.total} total</span>
          <div className="flex gap-2">
            <button onClick={() => fetchAudit(pagination.page - 1)} disabled={pagination.page <= 1} className="btn-ghost px-3 py-1.5 disabled:opacity-30 text-xs">← Prev</button>
            <span className="text-slate-500 dark:text-gray-400 px-2 py-1.5">{pagination.page} / {pagination.pages}</span>
            <button onClick={() => fetchAudit(pagination.page + 1)} disabled={pagination.page >= pagination.pages} className="btn-ghost px-3 py-1.5 disabled:opacity-30 text-xs">Next →</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Admin Page ────────────────────────────────────────────
const TABS = [
  { id: 'dashboard', label: 'Dashboard', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg> },
  { id: 'videos',    label: 'Videos',    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2"/></svg> },
  { id: 'users',     label: 'Users',     icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg> },
  { id: 'channels',  label: 'Channels',  icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0"/></svg> },
  { id: 'audit',     label: 'Audit Log', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z"/></svg> },
];

export default function Admin() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const renderTab = () => {
    switch (activeTab) {
      case 'dashboard': return <DashboardTab/>;
      case 'videos':    return <VideosTab/>;
      case 'users':     return <UsersTab/>;
      case 'channels':  return <ChannelsTab/>;
      case 'audit':     return <AuditTab/>;
      default:          return <DashboardTab/>;
    }
  };
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className="w-8 h-8 rounded-lg bg-brand-500/10 flex items-center justify-center">
              <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 text-brand-500"><path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z"/></svg>
            </div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Admin Panel</h1>
          </div>
          <p className="text-slate-400 dark:text-gray-500 text-sm ml-11">Manage videos, users, channels, and audit logs</p>
        </div>
        <Link to="/library" className="btn-ghost text-sm">← Library</Link>
      </div>

      <div className="flex gap-1 bg-slate-50 dark:bg-gray-900 border border-slate-200 dark:border-gray-800 p-1 rounded-xl mb-8 w-fit flex-wrap">
        {TABS.map(({ id, label, icon }) => (
          <button key={id} onClick={() => setActiveTab(id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
              activeTab === id
                ? 'bg-brand-500 text-white shadow-lg shadow-brand-500/20'
                : 'text-slate-500 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-gray-800'
            }`}
          >
            {icon}<span className="hidden sm:inline">{label}</span>
          </button>
        ))}
      </div>

      <div className="animate-fade-in">{renderTab()}</div>
    </div>
  );
}
