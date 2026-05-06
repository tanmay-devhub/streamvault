import VideoCard from './VideoCard';

function Skeleton() {
  return (
    <div className="rounded-2xl overflow-hidden bg-white dark:bg-gray-900 border border-slate-200 dark:border-gray-800">
      <div className="aspect-video skeleton"/>
      <div className="p-4 space-y-2.5">
        <div className="skeleton h-4 rounded-lg w-4/5"/>
        <div className="skeleton h-3 rounded-lg w-2/5"/>
      </div>
    </div>
  );
}

export default function VideoGallery({ videos, loading, error, onVideoDeleted, pagination, onPageChange, selectionMode = false, selectedIds = new Set(), onToggleSelect }) {
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <div className="w-14 h-14 rounded-2xl bg-red-50 dark:bg-red-500/10 flex items-center justify-center mb-4">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-7 h-7 text-red-500/70">
            <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
        </div>
        <p className="text-slate-700 dark:text-gray-300 font-semibold">Failed to load videos</p>
        <p className="text-slate-400 dark:text-gray-500 text-sm mt-1">{error}</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
        {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i}/>)}
      </div>
    );
  }

  if (!videos.length) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center animate-fade-in">
        <div className="w-20 h-20 rounded-3xl bg-slate-100 dark:bg-gray-800 flex items-center justify-center mb-5">
          <svg viewBox="0 0 24 24" fill="currentColor" className="w-10 h-10 text-slate-300 dark:text-gray-600">
            <path d="M18 4H6c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm-8 8l4.5-3L18 12l-3.5 2L10 12z"/>
          </svg>
        </div>
        <h3 className="text-lg font-bold text-slate-800 dark:text-gray-200 mb-2">No videos found</h3>
        <p className="text-slate-400 dark:text-gray-500 text-sm max-w-xs">
          Try a different search term, or upload your first video.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
        {videos.map((v) => (
          <VideoCard
            key={v.id}
            video={v}
            onDeleted={onVideoDeleted}
            selectionMode={selectionMode}
            isSelected={selectedIds.has(v.id)}
            onToggleSelect={onToggleSelect}
          />
        ))}
      </div>

      {/* Pagination */}
      {pagination?.pages > 1 && (
        <div className="flex items-center justify-center gap-1.5">
          <button
            onClick={() => onPageChange(pagination.page - 1)}
            disabled={pagination.page <= 1}
            className="btn-ghost px-3 py-2 text-sm disabled:opacity-30"
          >
            ← Prev
          </button>
          <div className="flex items-center gap-1">
            {Array.from({ length: Math.min(pagination.pages, 7) }, (_, i) => {
              const pg = i + 1;
              return (
                <button
                  key={pg}
                  onClick={() => onPageChange(pg)}
                  className={`w-9 h-9 rounded-xl text-sm font-medium transition-all ${
                    pg === pagination.page
                      ? 'bg-brand-500 text-white shadow-md shadow-brand-500/25'
                      : 'text-slate-500 dark:text-gray-400 hover:bg-slate-100 dark:hover:bg-gray-800 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  {pg}
                </button>
              );
            })}
          </div>
          <button
            onClick={() => onPageChange(pagination.page + 1)}
            disabled={pagination.page >= pagination.pages}
            className="btn-ghost px-3 py-2 text-sm disabled:opacity-30"
          >
            Next →
          </button>
        </div>
      )}
    </div>
  );
}
