import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { videoApi } from '../services/api';

function formatTime(s) {
  if (!s) return '0:00';
  const m = Math.floor(s / 60), sec = Math.floor(s % 60);
  return `${m}:${String(sec).padStart(2, '0')}`;
}

function StatCard({ label, value, sub, color = 'text-slate-900 dark:text-white' }) {
  return (
    <div className="bg-white dark:bg-gray-900 border border-slate-200 dark:border-gray-800 rounded-2xl p-5">
      <p className="text-xs text-slate-400 dark:text-gray-500 uppercase tracking-wider font-semibold mb-1">{label}</p>
      <p className={`text-3xl font-bold ${color}`}>{value}</p>
      {sub && <p className="text-xs text-slate-400 dark:text-gray-600 mt-1">{sub}</p>}
    </div>
  );
}

function ViewsChart({ data }) {
  if (!data.length) return <p className="text-slate-400 dark:text-gray-600 text-sm text-center py-8">No views in the last 14 days.</p>;
  const max = Math.max(...data.map((d) => d.views), 1);
  return (
    <div className="flex items-end gap-1 h-32 w-full">
      {data.map((d, i) => {
        const h = Math.max((d.views / max) * 100, 2);
        return (
          <div key={i} className="flex-1 flex flex-col items-center gap-1 group/bar">
            <span className="text-xs text-slate-400 dark:text-gray-600 opacity-0 group-hover/bar:opacity-100 transition-opacity">{d.views}</span>
            <div
              className="w-full bg-brand-500/70 hover:bg-brand-500 rounded-t transition-all"
              style={{ height: `${h}%` }}
              title={`${d.day}: ${d.views} views`}
            />
          </div>
        );
      })}
    </div>
  );
}

function HeatmapBar({ heatmap, duration }) {
  if (!heatmap.length || !duration) return <p className="text-slate-400 dark:text-gray-600 text-sm text-center py-4">No playback data yet.</p>;
  const max = Math.max(...heatmap.map((b) => b.count), 1);
  const totalBuckets = Math.ceil(duration / 5);
  const bucketMap = Object.fromEntries(heatmap.map((b) => [b.bucket, b.count]));

  return (
    <div>
      <div className="flex items-end gap-px h-16 w-full rounded overflow-hidden">
        {Array.from({ length: Math.min(totalBuckets, 200) }, (_, i) => {
          const count = bucketMap[i] || 0;
          const intensity = count / max;
          return (
            <div
              key={i}
              className="flex-1 rounded-sm"
              style={{ height: `${Math.max(intensity * 100, 2)}%`, backgroundColor: `rgba(239,68,68,${0.2 + intensity * 0.8})` }}
              title={`${formatTime(i * 5)}–${formatTime((i + 1) * 5)}: ${count} plays`}
            />
          );
        })}
      </div>
      <div className="flex justify-between mt-1 text-xs text-slate-400 dark:text-gray-600">
        <span>0:00</span>
        <span className="text-slate-400 dark:text-gray-500 text-xs">Most replayed</span>
        <span>{formatTime(duration)}</span>
      </div>
    </div>
  );
}

export default function Analytics() {
  const { id } = useParams();
  const [data, setData]     = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState(null);

  useEffect(() => {
    videoApi.getAnalytics(id)
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 space-y-6 animate-pulse">
        <div className="h-8 bg-slate-200 dark:bg-gray-800 rounded w-64"/>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <div key={i} className="h-28 bg-slate-200 dark:bg-gray-800 rounded-2xl"/>)}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-24 text-center">
        <p className="text-red-500 dark:text-red-400">{error}</p>
        <Link to="/" className="btn-ghost mt-4 inline-flex">← Library</Link>
      </div>
    );
  }

  const completion  = Math.round((data.avgCompletion || 0) * 100);
  const likeRatioPct = Math.round((data.likeRatio || 0) * 100);

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8 animate-slide-up">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <Link to={`/watch/${id}`} className="text-sm text-slate-400 dark:text-gray-500 hover:text-slate-700 dark:hover:text-gray-300 transition-colors flex items-center gap-1 mb-2">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7"/></svg>
            Back to video
          </Link>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{data.title}</h1>
          <p className="text-slate-400 dark:text-gray-500 text-sm mt-1">Analytics · {data.duration ? `${Math.round(data.duration / 60)} min video` : ''}</p>
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Total Views"     value={data.totalViews.toLocaleString()}   color="text-slate-900 dark:text-white"/>
        <StatCard label="Unique Viewers"  value={data.uniqueViewers.toLocaleString()} color="text-blue-600 dark:text-blue-400"/>
        <StatCard label="Total Likes"     value={data.totalLikes.toLocaleString()}    color="text-red-600 dark:text-red-400"/>
        <StatCard label="Like Ratio"      value={`${likeRatioPct}%`}                 color="text-yellow-600 dark:text-yellow-400" sub="likes per view"/>
      </div>

      {/* Completion */}
      <div className="bg-white dark:bg-gray-900 border border-slate-200 dark:border-gray-800 rounded-2xl p-5">
        <p className="text-xs text-slate-400 dark:text-gray-500 uppercase tracking-wider font-semibold mb-3">Average Completion</p>
        <div className="flex items-center gap-4">
          <div className="relative w-16 h-16 flex-shrink-0">
            <svg viewBox="0 0 36 36" className="w-16 h-16 -rotate-90">
              <circle cx="18" cy="18" r="15" fill="none" stroke="currentColor" strokeWidth="3" className="text-slate-200 dark:text-gray-800"/>
              <circle cx="18" cy="18" r="15" fill="none" stroke="rgb(99 102 241)" strokeWidth="3"
                strokeDasharray={`${completion * 0.942} 94.2`} strokeLinecap="round"/>
            </svg>
            <span className="absolute inset-0 flex items-center justify-center text-sm font-bold text-slate-900 dark:text-white">{completion}%</span>
          </div>
          <div>
            <p className="text-slate-900 dark:text-white font-semibold">{completion >= 80 ? 'Excellent retention' : completion >= 50 ? 'Good retention' : 'Viewers drop off early'}</p>
            <p className="text-xs text-slate-400 dark:text-gray-500 mt-0.5">
              {completion >= 80 ? 'Most viewers watch to the end.' : completion >= 50 ? 'Many viewers watch more than half.' : 'Consider a stronger hook in the first 30 seconds.'}
            </p>
          </div>
        </div>
      </div>

      {/* Engagement Heatmap */}
      <div className="bg-white dark:bg-gray-900 border border-slate-200 dark:border-gray-800 rounded-2xl p-5">
        <p className="text-xs text-slate-400 dark:text-gray-500 uppercase tracking-wider font-semibold mb-4">Engagement Heatmap</p>
        <p className="text-xs text-slate-400 dark:text-gray-600 mb-3">Red = most replayed. Hover for exact counts.</p>
        <HeatmapBar heatmap={data.heatmap} duration={data.duration}/>
      </div>

      {/* Views per day */}
      <div className="bg-white dark:bg-gray-900 border border-slate-200 dark:border-gray-800 rounded-2xl p-5">
        <p className="text-xs text-slate-400 dark:text-gray-500 uppercase tracking-wider font-semibold mb-4">Views — Last 14 Days</p>
        <ViewsChart data={data.viewsPerDay}/>
        {data.viewsPerDay.length > 0 && (
          <div className="flex justify-between mt-2 text-xs text-slate-400 dark:text-gray-600">
            <span>{data.viewsPerDay[0]?.day}</span>
            <span>{data.viewsPerDay[data.viewsPerDay.length - 1]?.day}</span>
          </div>
        )}
      </div>
    </div>
  );
}
