import { useRef, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useUser } from '@clerk/clerk-react';
import toast from 'react-hot-toast';
import { useVideo } from '../hooks/useVideos';
import { useChannelProfile } from '../hooks/useProfile';
import VideoPlayer from '../components/VideoPlayer';
import LikeButton from '../components/LikeButton';
import TranscriptPanel from '../components/TranscriptPanel';
import { videoApi } from '../services/api';

function formatDuration(s) {
  if (!s) return '—';
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  return h > 0 ? `${h}h ${m}m` : m > 0 ? `${m}m ${sec}s` : `${sec}s`;
}

const PRIVACY_BADGE = {
  public:   null,
  unlisted: { label: 'Unlisted', cls: 'bg-yellow-500/15 text-yellow-600 dark:text-yellow-400' },
  private:  { label: 'Private',  cls: 'bg-red-500/15 text-red-600 dark:text-red-400' },
};

function ShareButton({ videoId, privacy }) {
  if (privacy === 'private') return null;
  const copy = () => {
    navigator.clipboard.writeText(`${window.location.origin}/share/${videoId}`)
      .then(() => toast.success('Share link copied!'))
      .catch(() => toast.error('Could not copy link.'));
  };
  return (
    <button
      onClick={copy}
      className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium bg-white dark:bg-gray-800 text-slate-500 dark:text-gray-400 border border-slate-200 dark:border-gray-700 hover:bg-slate-50 dark:hover:bg-gray-700 hover:text-slate-900 dark:hover:text-white transition-all"
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
        <path strokeLinecap="round" strokeLinejoin="round" d="M7.217 10.907a2.25 2.25 0 100 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186l9.566-5.314m-9.566 7.5l9.566 5.314m0 0a2.25 2.25 0 103.935 2.186 2.25 2.25 0 00-3.935-2.186zm0-12.814a2.25 2.25 0 103.933-2.185 2.25 2.25 0 00-3.933 2.185z"/>
      </svg>
      Share
    </button>
  );
}

function UploaderCard({ uploaderId }) {
  const { user: currentUser } = useUser();
  const { profile, loading } = useChannelProfile(uploaderId);
  const isOwn = currentUser?.id === uploaderId;

  if (loading) {
    return (
      <div className="flex items-center gap-4 py-4 border-t border-slate-200 dark:border-gray-800/60 animate-pulse">
        <div className="w-11 h-11 rounded-full bg-slate-200 dark:bg-gray-800 flex-shrink-0"/>
        <div className="flex-1 space-y-2">
          <div className="h-4 bg-slate-200 dark:bg-gray-800 rounded w-32"/>
          <div className="h-3 bg-slate-200 dark:bg-gray-800 rounded w-48"/>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="flex items-center gap-4 py-4 border-t border-slate-200 dark:border-gray-800/60">
        <div className="w-11 h-11 rounded-full bg-slate-100 dark:bg-gray-800 flex items-center justify-center flex-shrink-0">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-5 h-5 text-slate-400 dark:text-gray-600">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z"/>
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-medium text-slate-500 dark:text-gray-400 text-sm">Unknown Channel</p>
          {isOwn && (
            <Link to="/upload" className="text-xs text-brand-500 hover:text-brand-600 dark:hover:text-brand-300 transition-colors">
              Set up your channel →
            </Link>
          )}
        </div>
      </div>
    );
  }

  const avatarSrc = profile.avatarUrl || profile.clerkImageUrl;
  return (
    <div className="flex items-center gap-4 py-4 border-t border-slate-200 dark:border-gray-800/60">
      <Link to={`/channel/${uploaderId}`} className="flex-shrink-0">
        {avatarSrc ? (
          <img src={avatarSrc} alt={profile.channelName}
            className="w-11 h-11 rounded-full object-cover ring-2 ring-brand-500/20 hover:ring-brand-500/50 transition-all"/>
        ) : (
          <div className="w-11 h-11 rounded-full bg-gradient-to-br from-brand-600 to-brand-800 flex items-center justify-center ring-2 ring-brand-500/20 hover:ring-brand-500/50 transition-all">
            <span className="text-white font-bold text-sm">{profile.channelName?.[0]?.toUpperCase()}</span>
          </div>
        )}
      </Link>
      <div className="flex-1 min-w-0">
        <Link to={`/channel/${uploaderId}`} className="font-semibold text-slate-900 dark:text-white hover:text-brand-500 dark:hover:text-brand-400 transition-colors block truncate">
          {profile.channelName}
          {isOwn && <span className="ml-2 text-xs text-slate-400 dark:text-gray-500 font-normal">(you)</span>}
        </Link>
        {profile.bio && <p className="text-xs text-slate-400 dark:text-gray-500 mt-0.5 line-clamp-1">{profile.bio}</p>}
      </div>
      <Link to={`/channel/${uploaderId}`} className="flex-shrink-0 btn-ghost text-sm px-3 py-1.5">
        View Channel
      </Link>
    </div>
  );
}

export default function Watch() {
  const { id } = useParams();
  const { video, loading, error, refetch } = useVideo(id);
  const playerRef    = useRef(null);
  const thumbInputRef = useRef(null);
  const { user }     = useUser();
  const [thumbUploading, setThumbUploading] = useState(false);

  const handleThumbnailChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setThumbUploading(true);
    try {
      await videoApi.uploadThumbnail(id, file);
      toast.success('Thumbnail updated!');
      refetch?.();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setThumbUploading(false);
      e.target.value = '';
    }
  };

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10 space-y-6 animate-pulse">
        <div className="aspect-video bg-slate-100 dark:bg-gray-900 rounded-2xl"/>
        <div className="h-7 bg-slate-200 dark:bg-gray-800 rounded w-2/3"/>
        <div className="h-4 bg-slate-200 dark:bg-gray-800 rounded w-1/4"/>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-24 text-center">
        <p className="text-slate-500 dark:text-gray-400 font-medium">Video not found or failed to load.</p>
        <Link to="/" className="btn-ghost mt-4 inline-flex">← Back to Library</Link>
      </div>
    );
  }

  if (!video) return null;

  const isOwner       = user?.id === video.uploaderId;
  const isAdmin       = user?.publicMetadata?.role === 'admin';
  const canManage     = isOwner || isAdmin;
  const isProcessing  = video.status === 'processing';
  const isFailed      = video.status === 'failed';
  const privacyBadge  = PRIVACY_BADGE[video.privacy];

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10 animate-slide-up">
      {/* Player or status */}
      {video.masterUrl ? (
        <VideoPlayer ref={playerRef} masterUrl={video.masterUrl} thumbnailUrl={video.thumbnailUrl} title={video.title}/>
      ) : isProcessing ? (
        <div className="aspect-video bg-slate-100 dark:bg-gray-900 rounded-2xl flex flex-col items-center justify-center gap-4">
          <svg className="animate-spin w-14 h-14 text-brand-500" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
          </svg>
          <p className="text-slate-500 dark:text-gray-400 font-medium">Processing video, please wait…</p>
          <p className="text-slate-400 dark:text-gray-600 text-sm">This page refreshes automatically every 5 seconds.</p>
        </div>
      ) : isFailed ? (
        <div className="aspect-video bg-slate-100 dark:bg-gray-900 rounded-2xl flex flex-col items-center justify-center gap-3">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-14 h-14 text-red-500/60">
            <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          <p className="text-slate-500 dark:text-gray-400 font-medium">Processing failed</p>
          {video.errorMessage && <p className="text-slate-400 dark:text-gray-600 text-sm">{video.errorMessage}</p>}
        </div>
      ) : null}

      {/* Meta */}
      <div className="mt-6 space-y-1">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white leading-tight flex-1 min-w-0">{video.title}</h1>
          <Link to="/" className="btn-ghost flex-shrink-0">← Library</Link>
        </div>

        {/* Action row */}
        <div className="flex items-center gap-3 pt-1 pb-1 flex-wrap">
          {video.status === 'ready' && <LikeButton videoId={video.id}/>}
          <ShareButton videoId={video.id} privacy={video.privacy}/>
          {privacyBadge && <span className={`badge ${privacyBadge.cls}`}>{privacyBadge.label}</span>}

          {canManage && video.status === 'ready' && (
            <>
              <Link to={`/analytics/${video.id}`}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium bg-white dark:bg-gray-800 text-slate-500 dark:text-gray-400 border border-slate-200 dark:border-gray-700 hover:bg-slate-50 dark:hover:bg-gray-700 hover:text-slate-900 dark:hover:text-white transition-all">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 13l4-4 4 4 4-8 4 4"/>
                </svg>
                Analytics
              </Link>

              <input ref={thumbInputRef} type="file" accept="image/*" className="hidden" onChange={handleThumbnailChange}/>
              <button
                onClick={() => thumbInputRef.current?.click()}
                disabled={thumbUploading}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium bg-white dark:bg-gray-800 text-slate-500 dark:text-gray-400 border border-slate-200 dark:border-gray-700 hover:bg-slate-50 dark:hover:bg-gray-700 hover:text-slate-900 dark:hover:text-white transition-all disabled:opacity-50"
              >
                {thumbUploading
                  ? <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>
                  : <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>
                }
                {thumbUploading ? 'Uploading…' : 'Thumbnail'}
              </button>
            </>
          )}
        </div>

        {/* Uploader */}
        {video.uploaderId && <UploaderCard uploaderId={video.uploaderId}/>}

        {video.description && (
          <p className="text-slate-500 dark:text-gray-400 text-sm leading-relaxed pt-2">{video.description}</p>
        )}

        {/* Stats pills */}
        <div className="flex flex-wrap gap-2 pt-3">
          {video.duration     && <span className="badge bg-slate-100 dark:bg-gray-800 text-slate-500 dark:text-gray-400">{formatDuration(video.duration)}</span>}
          {video.resolution   && <span className="badge bg-slate-100 dark:bg-gray-800 text-slate-500 dark:text-gray-400">{video.resolution}</span>}
          {video.videoCodec   && <span className="badge bg-slate-100 dark:bg-gray-800 text-slate-500 dark:text-gray-400 uppercase">{video.videoCodec}</span>}
          {video.viewsCount > 0 && <span className="badge bg-slate-100 dark:bg-gray-800 text-slate-500 dark:text-gray-400">{video.viewsCount.toLocaleString()} views</span>}
          {video.renditionUrls && Object.keys(video.renditionUrls).length > 0 && (
            <span className="badge bg-brand-500/20 text-brand-600 dark:text-brand-400">
              {Object.keys(video.renditionUrls).join(' · ')} HLS
            </span>
          )}
          <span className={`badge ${video.status === 'ready' ? 'badge-ready' : video.status === 'processing' ? 'badge-process' : 'badge-failed'}`}>
            {video.status}
          </span>
        </div>

        <p className="text-xs text-slate-400 dark:text-gray-600">Uploaded {new Date(video.createdAt).toLocaleString()}</p>
      </div>

      {/* Transcript panel — only shown for ready videos */}
      {video.status === 'ready' && (
        <TranscriptPanel
          videoId={video.id}
          onSeek={(s) => playerRef.current?.seekTo(s)}
          getCurrentTime={() => playerRef.current?.getCurrentTime() || 0}
        />
      )}
    </div>
  );
}
