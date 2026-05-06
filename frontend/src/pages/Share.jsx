import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { shareApi } from '../services/api';

function formatDuration(s) {
  if (!s) return null;
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  return h > 0 ? `${h}:${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}` : `${m}:${String(sec).padStart(2,'0')}`;
}

export default function Share() {
  const { id } = useParams();
  const [video,   setVideo]   = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(false);

  useEffect(() => {
    shareApi.get(id)
      .then(setVideo)
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-white dark:bg-gray-950 flex items-center justify-center">
        <svg className="animate-spin w-10 h-10 text-brand-500" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
        </svg>
      </div>
    );
  }

  if (error || !video) {
    return (
      <div className="min-h-screen bg-white dark:bg-gray-950 flex flex-col items-center justify-center gap-4 px-4 text-center">
        <div className="w-16 h-16 rounded-2xl bg-slate-100 dark:bg-gray-900 flex items-center justify-center mb-2">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-8 h-8 text-slate-400 dark:text-gray-600">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z"/>
          </svg>
        </div>
        <h1 className="text-xl font-bold text-slate-900 dark:text-white">Video unavailable</h1>
        <p className="text-slate-500 dark:text-gray-500 text-sm">This video is private or doesn't exist.</p>
        <Link to="/sign-in" className="mt-2 btn-primary text-sm">Sign in to StreamVault</Link>
      </div>
    );
  }

  const dur = formatDuration(video.duration);

  return (
    <div className="min-h-screen bg-white dark:bg-gray-950 flex flex-col">
      {/* Minimal header */}
      <header className="border-b border-slate-200 dark:border-gray-800/60 px-4 py-4">
        <Link to="/" className="inline-flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-brand-500 flex items-center justify-center">
            <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 text-white"><path d="M8 5v14l11-7z"/></svg>
          </div>
          <span className="font-bold text-slate-900 dark:text-white text-lg">Stream<span className="text-brand-500">Vault</span></span>
        </Link>
      </header>

      {/* Content */}
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-2xl">
          {/* Thumbnail preview */}
          <div className="aspect-video bg-slate-100 dark:bg-gray-900 rounded-2xl overflow-hidden relative mb-6 shadow-2xl">
            {video.thumbnailUrl ? (
              <>
                <img src={video.thumbnailUrl} alt={video.title} className="w-full h-full object-cover"/>
                <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                  <div className="w-20 h-20 rounded-full bg-white/10 backdrop-blur-sm border border-white/20 flex items-center justify-center">
                    <svg viewBox="0 0 24 24" fill="currentColor" className="w-9 h-9 text-white ml-1">
                      <path d="M8 5v14l11-7z"/>
                    </svg>
                  </div>
                </div>
                {dur && (
                  <span className="absolute bottom-3 right-3 bg-black/80 text-white text-xs px-2 py-1 rounded font-mono">
                    {dur}
                  </span>
                )}
              </>
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <svg viewBox="0 0 24 24" fill="currentColor" className="w-16 h-16 text-slate-300 dark:text-gray-700">
                  <path d="M8 5v14l11-7z"/>
                </svg>
              </div>
            )}
          </div>

          {/* Info */}
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-3">{video.title}</h1>

          {video.channel && (
            <div className="flex items-center gap-3 mb-4">
              {video.channel.avatarUrl ? (
                <img src={video.channel.avatarUrl} alt="" className="w-9 h-9 rounded-full object-cover"/>
              ) : (
                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-brand-600 to-brand-800 flex items-center justify-center">
                  <span className="text-white font-bold text-sm">{video.channel.channelName?.[0]?.toUpperCase()}</span>
                </div>
              )}
              <span className="font-medium text-slate-700 dark:text-gray-300">{video.channel.channelName}</span>
            </div>
          )}

          {video.description && (
            <p className="text-slate-500 dark:text-gray-400 text-sm leading-relaxed mb-6">{video.description}</p>
          )}

          {/* CTA */}
          <div className="bg-slate-50 dark:bg-gray-900 border border-slate-200 dark:border-gray-800 rounded-2xl p-6 text-center">
            <p className="text-slate-500 dark:text-gray-400 text-sm mb-4">Sign in to watch this video in full quality</p>
            <div className="flex gap-3 justify-center">
              <Link to="/sign-in" className="btn-primary px-6">Sign in</Link>
              <Link to="/sign-up" className="btn-ghost px-6">Create account</Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
