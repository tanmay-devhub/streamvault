import { useState, useCallback } from 'react';

const SORT_OPTIONS = [
  { value: 'createdAt:desc', label: 'Newest First' },
  { value: 'createdAt:asc',  label: 'Oldest First' },
  { value: 'title:asc',      label: 'Title A→Z' },
  { value: 'title:desc',     label: 'Title Z→A' },
  { value: 'duration:desc',  label: 'Longest' },
  { value: 'duration:asc',   label: 'Shortest' },
];

export default function SearchBar({ query, onUpdate, total }) {
  const [inputVal, setInputVal] = useState(query.search || '');

  const handleSearch = useCallback((e) => {
    e.preventDefault();
    onUpdate({ search: inputVal });
  }, [inputVal, onUpdate]);

  const handleSort = (e) => {
    const [sortBy, order] = e.target.value.split(':');
    onUpdate({ sortBy, order });
  };

  const currentSort = `${query.sortBy}:${query.order}`;

  return (
    <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
      {/* Search */}
      <form onSubmit={handleSearch} className="flex-1 flex gap-2">
        <div className="relative flex-1">
          <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-gray-500 pointer-events-none"
            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
          </svg>
          <input
            type="text"
            placeholder="Search videos or spoken words…"
            value={inputVal}
            onChange={(e) => setInputVal(e.target.value)}
            className="input pl-10 pr-9"
          />
          {inputVal && (
            <button
              type="button"
              onClick={() => { setInputVal(''); onUpdate({ search: '' }); }}
              className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full flex items-center justify-center text-slate-400 dark:text-gray-500 hover:text-slate-600 dark:hover:text-gray-300 hover:bg-slate-100 dark:hover:bg-gray-700 transition-all"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-3 h-3">
                <path strokeLinecap="round" d="M6 18L18 6M6 6l12 12"/>
              </svg>
            </button>
          )}
        </div>
        <button type="submit" className="btn-primary px-4 py-2.5 text-sm">Search</button>
      </form>

      {/* Sort */}
      <select
        value={currentSort}
        onChange={handleSort}
        className="input w-auto cursor-pointer text-sm bg-slate-50 dark:bg-gray-800 pr-8"
      >
        {SORT_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>

      {/* Count */}
      {total != null && (
        <span className="text-sm text-slate-400 dark:text-gray-500 whitespace-nowrap font-medium">
          {total.toLocaleString()} video{total !== 1 ? 's' : ''}
        </span>
      )}
    </div>
  );
}
