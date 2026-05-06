import { useState, useEffect, useRef } from 'react';
import { videoApi } from '../services/api';

function formatTime(s) {
  const m = Math.floor(s / 60), sec = Math.floor(s % 60);
  return `${m}:${String(sec).padStart(2, '0')}`;
}

export default function TranscriptPanel({ videoId, onSeek, getCurrentTime }) {
  const [transcript, setTranscript]   = useState(null);
  const [loading, setLoading]         = useState(true);
  const [open, setOpen]               = useState(true);
  const [search, setSearch]           = useState('');
  const [currentTime, setCurrentTime] = useState(0);
  const activeRef                     = useRef(null);

  useEffect(() => {
    setLoading(true);
    videoApi.getTranscript(videoId)
      .then(setTranscript).catch(() => setTranscript(null))
      .finally(() => setLoading(false));
  }, [videoId]);

  useEffect(() => {
    if (!getCurrentTime) return;
    const timer = setInterval(() => setCurrentTime(getCurrentTime()), 500);
    return () => clearInterval(timer);
  }, [getCurrentTime]);

  useEffect(() => {
    if (activeRef.current) activeRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [currentTime]);

  if (loading) return (
    <div className="card-flat p-5 animate-pulse">
      <div className="skeleton h-4 rounded-lg w-28 mb-3"/>
      <div className="space-y-2">
        {[...Array(3)].map((_, i) => <div key={i} className="skeleton h-3 rounded-lg"/>)}
      </div>
    </div>
  );

  if (!transcript) return null;

  const segments  = transcript.segments || [];
  const activeIdx = segments.findIndex((s) => currentTime >= s.start && currentTime < s.end);
  const filtered  = search ? segments.filter((s) => s.text.toLowerCase().includes(search.toLowerCase())) : segments;

  return (
    <div className="card-flat overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-slate-50 dark:hover:bg-gray-800/50 transition-colors"
      >
        <div className="flex items-center gap-2.5">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4 text-brand-500">
            <path strokeLinecap="round" strokeLinejoin="round" d="M7 8h10M7 12h6m-6 4h10"/>
          </svg>
          <span className="font-semibold text-slate-900 dark:text-white text-sm">Transcript</span>
          {transcript.language && (
            <span className="text-[11px] text-slate-400 dark:text-gray-500 uppercase font-mono tracking-wider">{transcript.language}</span>
          )}
          <span className="text-xs text-slate-400 dark:text-gray-500">{segments.length} segments</span>
        </div>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
          className={`w-4 h-4 text-slate-400 dark:text-gray-500 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7"/>
        </svg>
      </button>

      {open && (
        <>
          {/* Search */}
          <div className="px-4 pb-3 border-b border-slate-200 dark:border-gray-800">
            <div className="relative">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 dark:text-gray-500">
                <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>
              </svg>
              <input
                type="text" placeholder="Search in transcript…" value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="input pl-9 text-xs py-2"
              />
            </div>
          </div>

          {/* Segments */}
          <div className="max-h-72 overflow-y-auto">
            {filtered.length === 0
              ? <p className="px-5 py-6 text-sm text-slate-400 dark:text-gray-500 text-center">No matches.</p>
              : filtered.map((seg, i) => {
                  const origIdx = segments.indexOf(seg);
                  const isActive = origIdx === activeIdx;
                  return (
                    <button
                      key={i}
                      ref={isActive ? activeRef : null}
                      onClick={() => onSeek?.(seg.start)}
                      className={`w-full text-left flex gap-3 px-5 py-2.5 transition-colors border-l-2
                        ${isActive
                          ? 'bg-brand-500/8 dark:bg-brand-500/10 border-brand-500 pl-[18px]'
                          : 'border-transparent hover:bg-slate-50 dark:hover:bg-gray-800/60'
                        }`}
                    >
                      <span className={`font-mono text-xs pt-0.5 flex-shrink-0 w-10 ${isActive ? 'text-brand-500' : 'text-slate-400 dark:text-gray-500'}`}>
                        {formatTime(seg.start)}
                      </span>
                      <span className={`text-sm leading-relaxed ${isActive ? 'text-slate-900 dark:text-white font-medium' : 'text-slate-600 dark:text-gray-400'}`}>
                        {seg.text}
                      </span>
                    </button>
                  );
                })
            }
          </div>
        </>
      )}
    </div>
  );
}
