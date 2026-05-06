import { useState, useCallback, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useUser } from '@clerk/clerk-react';
import { useVideoList } from '../hooks/useVideos';
import { profileApi, videoApi, historyApi } from '../services/api';
import SearchBar from '../components/SearchBar';
import VideoGallery from '../components/VideoGallery';
import toast from 'react-hot-toast';

function formatTimeLeft(position, duration) {
  if (!duration) return null;
  const left = Math.max(duration - position, 0);
  if (left < 60) return `${left}s left`;
  return `${Math.round(left / 60)}m left`;
}

function ContinueWatching({ items, onDismiss }) {
  if (!items.length) return null;
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-500 dark:text-gray-500 uppercase tracking-wider">Continue Watching</h2>
        <button onClick={onDismiss} className="text-xs text-slate-400 dark:text-gray-600 hover:text-slate-600 dark:hover:text-gray-400 transition-colors">
          Dismiss
        </button>
      </div>
      <div className="flex gap-4 overflow-x-auto pb-2 -mx-1 px-1" style={{ scrollbarWidth: 'thin' }}>
        {items.map((v) => {
          const pct = v.duration ? Math.min((v.position / v.duration) * 100, 100) : 0;
          return (
            <Link key={v.id} to={`/watch/${v.id}`} className="flex-shrink-0 w-48 group">
              <div className="relative aspect-video rounded-xl overflow-hidden bg-slate-100 dark:bg-gray-800 shadow-sm">
                {v.thumbnailUrl
                  ? <img src={v.thumbnailUrl} alt={v.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"/>
                  : <div className="w-full h-full bg-slate-200 dark:bg-gray-800"/>
                }
                <div className="absolute bottom-0 left-0 right-0 h-1 bg-black/30">
                  <div className="h-full bg-brand-500 transition-all" style={{ width: `${pct}%` }}/>
                </div>
              </div>
              <p className="text-xs text-slate-700 dark:text-gray-300 mt-2 line-clamp-2 font-medium group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors leading-snug">
                {v.title}
              </p>
              {v.duration > 0 && (
                <p className="text-[11px] text-slate-400 dark:text-gray-500 mt-0.5">{formatTimeLeft(v.position, v.duration)}</p>
              )}
            </Link>
          );
        })}
      </div>
    </div>
  );
}

function ChannelResults({ results }) {
  if (!results.length) return null;
  return (
    <div className="card-flat overflow-hidden">
      <div className="px-5 py-3 border-b border-slate-200 dark:border-gray-800">
        <p className="section-label">Channels</p>
      </div>
      <div className="divide-y divide-slate-100 dark:divide-gray-800/60">
        {results.map((p) => {
          const avatar = p.avatarUrl || p.clerkImageUrl;
          return (
            <Link key={p.userId} to={`/channel/${p.userId}`}
              className="flex items-center gap-4 px-5 py-3.5 hover:bg-slate-50 dark:hover:bg-gray-800/50 transition-colors">
              {avatar
                ? <img src={avatar} alt={p.channelName} className="w-9 h-9 rounded-full object-cover flex-shrink-0"/>
                : <div className="w-9 h-9 rounded-full bg-gradient-to-br from-brand-500 to-indigo-500 flex items-center justify-center flex-shrink-0">
                    <span className="text-white font-bold text-sm">{p.channelName?.[0]?.toUpperCase()}</span>
                  </div>
              }
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-slate-900 dark:text-white text-sm truncate">{p.channelName}</p>
                {p.bio && <p className="text-xs text-slate-400 dark:text-gray-500 truncate">{p.bio}</p>}
              </div>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4 text-slate-300 dark:text-gray-600 flex-shrink-0">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7"/>
              </svg>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

export default function Home() {
  const { user }   = useUser();
  const isAdmin    = user?.publicMetadata?.role === 'admin';
  const { videos, pagination, loading, error, query, updateQuery, refetch } = useVideoList();

  const [channelResults, setChannelResults] = useState([]);
  const [history, setHistory]               = useState([]);
  const [showHistory, setShowHistory]       = useState(true);
  const [selectionMode, setSelectionMode]   = useState(false);
  const [selectedIds, setSelectedIds]       = useState(new Set());
  const [bulkLoading, setBulkLoading]       = useState(false);

  useEffect(() => { historyApi.get().then(setHistory).catch(() => {}); }, []);

  const handleSearchUpdate = useCallback((updates) => {
    updateQuery(updates);
    const term = updates.search ?? query.search;
    if (term && term.length >= 2) {
      profileApi.search(term).then(setChannelResults).catch(() => setChannelResults([]));
    } else {
      setChannelResults([]);
    }
  }, [updateQuery, query.search]);

  const handleDeleted = useCallback(() => {
    refetch();
    historyApi.get().then(setHistory).catch(() => {});
  }, [refetch]);

  const toggleSelect = useCallback((id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }, []);

  const exitSelection = () => { setSelectionMode(false); setSelectedIds(new Set()); };

  const handleBulkDelete = async () => {
    if (!confirm(`Permanently delete ${selectedIds.size} video${selectedIds.size > 1 ? 's' : ''}?`)) return;
    setBulkLoading(true);
    const ids = [...selectedIds];
    const results = await Promise.allSettled(ids.map((id) => videoApi.delete(id)));
    const failed = results.filter((r) => r.status === 'rejected').length;
    if (failed) toast.error(`${failed} deletion(s) failed`);
    else toast.success(`Deleted ${ids.length} video${ids.length > 1 ? 's' : ''}`);
    exitSelection(); refetch(); setBulkLoading(false);
  };

  const handleBulkPrivacy = async (privacy) => {
    setBulkLoading(true);
    const ids = [...selectedIds];
    await Promise.allSettled(ids.map((id) => videoApi.update(id, { privacy })));
    toast.success(`${ids.length} video${ids.length > 1 ? 's' : ''} set to ${privacy}`);
    exitSelection(); refetch(); setBulkLoading(false);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">Library</h1>
          <p className="text-slate-400 dark:text-gray-500 mt-1 text-sm">Adaptive HLS · FFmpeg · AWS S3</p>
        </div>
        <div className="flex items-center gap-2.5 self-start sm:self-auto">
          {isAdmin && (
            <Link to="/admin" className="btn-ghost border border-slate-200 dark:border-gray-700 text-sm">
              Admin Panel
            </Link>
          )}
          {!selectionMode ? (
            <>
              <button
                onClick={() => setSelectionMode(true)}
                className="btn-ghost border border-slate-200 dark:border-gray-700 text-sm"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
                  <rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/>
                  <rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>
                </svg>
                Select
              </button>
              <Link to="/upload" className="btn-primary text-sm">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"/>
                </svg>
                Upload
              </Link>
            </>
          ) : (
            <button onClick={exitSelection} className="btn-secondary text-sm">
              Cancel
            </button>
          )}
        </div>
      </div>

      {/* Continue Watching */}
      {!selectionMode && showHistory && history.length > 0 && (
        <ContinueWatching items={history} onDismiss={() => setShowHistory(false)}/>
      )}

      <SearchBar query={query} onUpdate={handleSearchUpdate} total={pagination.total}/>

      {channelResults.length > 0 && <ChannelResults results={channelResults}/>}

      <VideoGallery
        videos={videos} loading={loading} error={error}
        onVideoDeleted={handleDeleted}
        pagination={pagination} onPageChange={(page) => updateQuery({ page })}
        selectionMode={selectionMode} selectedIds={selectedIds} onToggleSelect={toggleSelect}
      />

      {/* Bulk action bar */}
      {selectionMode && selectedIds.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-slide-up">
          <div className="flex items-center gap-3 bg-white dark:bg-gray-900 border border-slate-200 dark:border-gray-700 rounded-2xl px-5 py-3 shadow-2xl shadow-slate-200/60 dark:shadow-black/60">
            <span className="font-semibold text-slate-900 dark:text-white text-sm">{selectedIds.size} selected</span>
            <div className="w-px h-5 bg-slate-200 dark:bg-gray-700"/>
            <button disabled={bulkLoading} onClick={() => handleBulkPrivacy('public')}
              className="text-sm text-slate-600 dark:text-gray-300 hover:text-slate-900 dark:hover:text-white transition-colors disabled:opacity-50">
              Make Public
            </button>
            <button disabled={bulkLoading} onClick={() => handleBulkPrivacy('private')}
              className="text-sm text-slate-600 dark:text-gray-300 hover:text-slate-900 dark:hover:text-white transition-colors disabled:opacity-50">
              Make Private
            </button>
            <button disabled={bulkLoading} onClick={handleBulkDelete}
              className="text-sm text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 font-semibold transition-colors disabled:opacity-50">
              {bulkLoading ? 'Working…' : 'Delete'}
            </button>
            <button onClick={exitSelection} className="text-slate-400 dark:text-gray-500 hover:text-slate-600 dark:hover:text-gray-300 transition-colors text-lg leading-none">×</button>
          </div>
        </div>
      )}
    </div>
  );
}
