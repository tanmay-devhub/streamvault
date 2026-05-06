import { Link } from 'react-router-dom';
import { useState } from 'react';
import { useUser } from '@clerk/clerk-react';
import { videoApi } from '../services/api';
import toast from 'react-hot-toast';

function renderSnippet(text) {
  if (!text) return null;
  return text.split('<<<').flatMap((chunk, i) => {
    if (i === 0) return [<span key={`s${i}`}>{chunk}</span>];
    const [hl, rest] = chunk.split('>>>');
    return [
      <mark key={`m${i}`} className="bg-brand-500/20 text-brand-700 dark:text-brand-300 rounded-sm px-0.5 not-italic">{hl}</mark>,
      <span key={`r${i}`}>{rest}</span>,
    ];
  });
}

function formatDuration(seconds) {
  if (!seconds) return null;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function formatDate(iso) {
  return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

const STATUS_DOT = {
  ready:      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 flex-shrink-0"/>,
  processing: <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse flex-shrink-0"/>,
  failed:     <span className="w-1.5 h-1.5 rounded-full bg-red-500 flex-shrink-0"/>,
};

export default function VideoCard({ video, onDeleted, selectionMode = false, isSelected = false, onToggleSelect }) {
  const { user }   = useUser();
  const [deleting, setDeleting] = useState(false);

  const isOwner   = user?.id === video.uploaderId;
  const isAdmin   = user?.publicMetadata?.role === 'admin';
  const canDelete = isOwner || isAdmin;
  const isReady   = video.status === 'ready';
  const dur       = formatDuration(video.duration);

  const handleDelete = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm(`Delete "${video.title}"? This cannot be undone.`)) return;
    setDeleting(true);
    try {
      await videoApi.delete(video.id);
      toast.success('Video deleted');
      onDeleted?.(video.id);
    } catch (err) {
      toast.error(err.message);
      setDeleting(false);
    }
  };

  /* ── Selection mode ─────────────────────────────────── */
  if (selectionMode) {
    return (
      <div
        onClick={() => onToggleSelect?.(video.id)}
        className={`group relative rounded-2xl overflow-hidden cursor-pointer transition-all duration-200
          ${isSelected
            ? 'ring-2 ring-brand-500 ring-offset-2 ring-offset-white dark:ring-offset-gray-950 shadow-lg shadow-brand-500/20'
            : 'ring-1 ring-slate-200 dark:ring-gray-800 hover:ring-slate-300 dark:hover:ring-gray-700'
          }
          bg-white dark:bg-gray-900`}
      >
        <div className="aspect-video bg-slate-100 dark:bg-gray-800 relative overflow-hidden">
          {video.thumbnailUrl
            ? <img src={video.thumbnailUrl} alt={video.title} loading="lazy"
                className={`w-full h-full object-cover transition-all duration-300 ${isSelected ? 'scale-105 brightness-75' : 'group-hover:scale-105'}`}/>
            : <div className="w-full h-full flex items-center justify-center text-slate-300 dark:text-gray-700">
                <svg viewBox="0 0 24 24" fill="currentColor" className="w-10 h-10"><path d="M18 4H6c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm-8 8l4.5-3L18 12l-3.5 2L10 12z"/></svg>
              </div>
          }
          {/* Checkbox */}
          <div className={`absolute top-2.5 left-2.5 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all duration-150
            ${isSelected ? 'bg-brand-500 border-brand-500 shadow-md' : 'bg-black/40 border-white/70'}`}>
            {isSelected && <svg viewBox="0 0 24 24" fill="currentColor" className="w-3 h-3 text-white"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/></svg>}
          </div>
        </div>
        <div className="p-3.5">
          <p className="font-semibold text-slate-900 dark:text-gray-100 line-clamp-2 text-sm leading-snug">{video.title}</p>
          <p className="text-xs text-slate-400 dark:text-gray-500 mt-1">{formatDate(video.createdAt)}</p>
        </div>
      </div>
    );
  }

  /* ── Normal card ─────────────────────────────────────── */
  return (
    <div className="card group relative">
      {/* Thumbnail */}
      <Link
        to={isReady ? `/watch/${video.id}` : '#'}
        className="block aspect-video bg-slate-100 dark:bg-gray-800 overflow-hidden relative"
        tabIndex={isReady ? 0 : -1}
      >
        {video.thumbnailUrl ? (
          <img
            src={video.thumbnailUrl}
            alt={video.title}
            loading="lazy"
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-slate-300 dark:text-gray-700">
            <svg viewBox="0 0 24 24" fill="currentColor" className="w-12 h-12">
              <path d="M4 6h16v12H4z" opacity=".25"/>
              <path d="M18 4H6c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zM6 18V6h12v12H6zm5.5-6.8l3.3 2.5c.3.2.3.7 0 .9l-3.3 2.5c-.3.2-.8 0-.8-.4V11.6c0-.4.5-.6.8-.4z"/>
            </svg>
          </div>
        )}

        {/* Duration */}
        {dur && (
          <span className="absolute bottom-2 right-2 bg-black/75 text-white text-[11px] px-1.5 py-0.5 rounded font-mono font-medium backdrop-blur-sm">
            {dur}
          </span>
        )}

        {/* Processing overlay */}
        {video.status === 'processing' && (
          <div className="absolute inset-0 bg-black/55 flex items-center justify-center backdrop-blur-sm">
            <svg className="animate-spin w-9 h-9 text-brand-400" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
            </svg>
          </div>
        )}

        {/* Hover play icon for ready */}
        {isReady && (
          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
            <div className="w-12 h-12 rounded-full bg-white/15 backdrop-blur-sm flex items-center justify-center ring-2 ring-white/30">
              <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 text-white ml-0.5">
                <path d="M8 5v14l11-7z"/>
              </svg>
            </div>
          </div>
        )}
      </Link>

      {/* Info */}
      <div className="p-4">
        <div className="flex items-start justify-between gap-2 mb-2">
          <Link
            to={isReady ? `/watch/${video.id}` : '#'}
            className="font-semibold text-slate-900 dark:text-gray-100 hover:text-brand-600 dark:hover:text-brand-400 line-clamp-2 leading-snug flex-1 text-[15px] transition-colors duration-150"
          >
            {video.title}
          </Link>
          {canDelete && (
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 dark:text-gray-600 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-400/10 transition-all opacity-0 group-hover:opacity-100"
              title="Delete video"
            >
              {deleting
                ? <svg className="animate-spin w-3.5 h-3.5" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>
                : <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>
              }
            </button>
          )}
        </div>

        {/* Transcript snippet */}
        {video.transcriptSnippet && (
          <p className="mt-1 mb-2 text-xs text-slate-500 dark:text-gray-500 line-clamp-2 leading-relaxed">
            <span className="text-brand-500 font-medium">↳ </span>
            {renderSnippet(video.transcriptSnippet)}
          </p>
        )}

        {/* Meta row */}
        <div className="flex items-center justify-between gap-2 mt-1.5">
          <span className="text-xs text-slate-400 dark:text-gray-500">{formatDate(video.createdAt)}</span>
          <div className="flex items-center gap-2">
            {video.resolution && (
              <span className="text-xs text-slate-400 dark:text-gray-500 font-mono">{video.resolution.split('x')[1]}p</span>
            )}
            <div className="flex items-center gap-1.5">
              {STATUS_DOT[video.status]}
              <span className={`text-xs font-medium capitalize ${
                video.status === 'ready'      ? 'text-emerald-600 dark:text-emerald-400' :
                video.status === 'processing' ? 'text-amber-600  dark:text-amber-400'  :
                                                'text-red-600    dark:text-red-400'
              }`}>{video.status}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
