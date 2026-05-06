import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { videoApi } from '../services/api';

export default function LikeButton({ videoId }) {
  const [liked, setLiked] = useState(false);
  const [count, setCount] = useState(0);
  const [busy,  setBusy]  = useState(false);

  useEffect(() => {
    videoApi.getLike(videoId)
      .then(({ liked, count }) => { setLiked(liked); setCount(count); })
      .catch(() => {});
  }, [videoId]);

  const toggle = async () => {
    if (busy) return;
    setBusy(true);
    const next = !liked;
    setLiked(next);
    setCount((c) => c + (next ? 1 : -1));
    try {
      const res = await videoApi.toggleLike(videoId);
      setLiked(res.liked);
      setCount(res.count);
    } catch (err) {
      setLiked(!next);
      setCount((c) => c + (next ? -1 : 1));
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      onClick={toggle}
      disabled={busy}
      aria-label={liked ? 'Unlike' : 'Like'}
      className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 border ${
        liked
          ? 'bg-brand-500/10 text-brand-600 dark:text-brand-400 border-brand-500/25 hover:bg-brand-500/15'
          : 'bg-white dark:bg-gray-900 text-slate-600 dark:text-gray-400 border-slate-200 dark:border-gray-700 hover:bg-slate-50 dark:hover:bg-gray-800 hover:text-slate-900 dark:hover:text-white'
      } disabled:opacity-60`}
    >
      <svg viewBox="0 0 24 24" className={`w-4 h-4 flex-shrink-0 transition-transform duration-200 ${liked ? 'scale-110' : ''}`}
        fill={liked ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2">
        <path strokeLinecap="round" strokeLinejoin="round"
          d="M6.633 10.5c.806 0 1.533-.446 2.031-1.08a9.041 9.041 0 012.861-2.4c.723-.384 1.35-.956 1.653-1.715a4.498 4.498 0 00.322-1.672V3a.75.75 0 01.75-.75A2.25 2.25 0 0116.5 4.5c0 1.152-.26 2.243-.723 3.218-.266.558.107 1.282.725 1.282h3.126c1.026 0 1.945.694 2.054 1.715.045.422.068.85.068 1.285a11.95 11.95 0 01-2.649 7.521c-.388.482-.987.729-1.605.729H13.48c-.483 0-.964-.078-1.423-.23l-3.114-1.04a4.501 4.501 0 00-1.423-.23H5.904M14.25 9h2.25M5.904 18.75c.083.205.173.405.27.602.197.4-.078.898-.523.898h-.908c-.889 0-1.713-.518-1.972-1.368a12 12 0 01-.521-3.507c0-1.553.295-3.036.831-4.398C3.387 10.203 4.167 9.75 5 9.75h1.053c.472 0 .745.556.5.96a8.958 8.958 0 00-1.302 4.665c0 1.194.232 2.333.654 3.375z"/>
      </svg>
      <span>{count > 0 ? count.toLocaleString() : 'Like'}</span>
    </button>
  );
}
