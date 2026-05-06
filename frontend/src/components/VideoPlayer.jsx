import { useEffect, useRef, useState, useCallback, forwardRef, useImperativeHandle } from 'react';
import { useAuth } from '@clerk/clerk-react';
import Hls from 'hls.js';

const SPEED_OPTIONS = [0.5, 0.75, 1, 1.25, 1.5, 2];

function formatTime(sec) {
  if (!sec || isNaN(sec)) return '0:00';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

const VideoPlayer = forwardRef(function VideoPlayer({ masterUrl, thumbnailUrl, title }, ref) {
  const { getToken }  = useAuth();
  const videoRef      = useRef(null);
  const hlsRef        = useRef(null);
  const containerRef  = useRef(null);
  const hideTimerRef  = useRef(null);
  const loopARef      = useRef(null);
  const loopBRef      = useRef(null);
  const tokenRef      = useRef(null);   // cached Clerk JWT for HLS requests

  useImperativeHandle(ref, () => ({
    seekTo(seconds)  { if (videoRef.current) videoRef.current.currentTime = seconds; },
    getCurrentTime() { return videoRef.current?.currentTime || 0; },
  }));

  const [playing, setPlaying]           = useState(false);
  const [currentTime, setCurrentTime]   = useState(0);
  const [duration, setDuration]         = useState(0);
  const [buffered, setBuffered]         = useState(0);
  const [volume, setVolume]             = useState(1);
  const [speedOpen, setSpeedOpen]       = useState(false);
  const [qualityOpen, setQualityOpen]   = useState(false);
  const [muted, setMuted]               = useState(false);
  const [fullscreen, setFullscreen]     = useState(false);
  const [levels, setLevels]             = useState([]);
  const [currentLevel, setCurrentLevel] = useState(-1);
  const [showControls, setShowControls] = useState(true);
  const [loading, setLoading]           = useState(true);
  const [error, setError]               = useState(null);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [loopA, setLoopA]               = useState(null);
  const [loopB, setLoopB]               = useState(null);

  // ── Keep Clerk token fresh so HLS requests are authenticated ─
  useEffect(() => {
    const refresh = async () => {
      try { tokenRef.current = await getToken(); } catch {}
    };
    refresh();
    const timer = setInterval(refresh, 55_000); // Clerk JWTs last ~60s
    return () => clearInterval(timer);
  }, [getToken]);

  // ── HLS init ─────────────────────────────────────────────
  useEffect(() => {
    if (!masterUrl || !videoRef.current) return;
    const video = videoRef.current;
    let hls = null;
    let cancelled = false;

    (async () => {
      // Fetch the auth token BEFORE creating HLS so the very first
      // manifest request already carries the Authorization header.
      if (!tokenRef.current) {
        try { tokenRef.current = await getToken(); } catch {}
      }
      if (cancelled) return;

      // Safari supports HLS natively — no token injection needed
      // because the page session cookie authenticates the request.
      if (video.canPlayType('application/vnd.apple.mpegurl')) {
        video.src = masterUrl;
        setLoading(false);
        return;
      }

      if (!Hls.isSupported()) {
        setError('HLS is not supported in this browser.');
        return;
      }

      hls = new Hls({
        enableWorker: true, lowLatencyMode: false,
        backBufferLength: 60, maxBufferLength: 30, maxMaxBufferLength: 60,
        maxBufferSize: 60 * 1000 * 1000, startLevel: -1,
        abrEwmaDefaultEstimate: 1_000_000,
        // Inject the Clerk JWT into every request HLS.js makes
        // (covers both XHR-loader and Fetch-loader depending on browser/version)
        xhrSetup: (xhr) => {
          if (tokenRef.current) {
            xhr.setRequestHeader('Authorization', `Bearer ${tokenRef.current}`);
          }
        },
        fetchSetup: (context, initParams) => {
          if (tokenRef.current) {
            initParams.headers = {
              ...(initParams.headers || {}),
              Authorization: `Bearer ${tokenRef.current}`,
            };
          }
          return new Request(context.url, initParams);
        },
      });

      if (cancelled) { hls.destroy(); return; }

      hlsRef.current = hls;
      hls.loadSource(masterUrl);
      hls.attachMedia(video);

      hls.on(Hls.Events.MANIFEST_PARSED, (_, data) => {
        setLevels(data.levels);
        setLoading(false);
      });
      hls.on(Hls.Events.LEVEL_SWITCHED, (_, data) => setCurrentLevel(data.level));
      hls.on(Hls.Events.ERROR, (_, data) => {
        if (data.fatal) {
          if (data.type === Hls.ErrorTypes.NETWORK_ERROR) hls.startLoad();
          else if (data.type === Hls.ErrorTypes.MEDIA_ERROR) hls.recoverMediaError();
          else { setError(`Playback error: ${data.details}`); setLoading(false); }
        }
      });
    })();

    return () => {
      cancelled = true;
      hls?.destroy();
      hlsRef.current = null;
    };
  }, [masterUrl, getToken]);

  // ── Video event listeners ─────────────────────────────────
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const onTimeUpdate = () => {
      const t = video.currentTime;
      setCurrentTime(t);
      if (loopARef.current !== null && loopBRef.current !== null && t >= loopBRef.current) {
        video.currentTime = loopARef.current;
      }
    };
    const onDuration = () => setDuration(video.duration);
    const onPlay     = () => setPlaying(true);
    const onPause    = () => setPlaying(false);
    const onWaiting  = () => setLoading(true);
    const onCanPlay  = () => setLoading(false);
    const onProgress = () => {
      if (video.buffered.length > 0)
        setBuffered(video.buffered.end(video.buffered.length - 1));
    };

    video.addEventListener('timeupdate',     onTimeUpdate);
    video.addEventListener('durationchange', onDuration);
    video.addEventListener('play',           onPlay);
    video.addEventListener('pause',          onPause);
    video.addEventListener('waiting',        onWaiting);
    video.addEventListener('canplay',        onCanPlay);
    video.addEventListener('progress',       onProgress);

    return () => {
      video.removeEventListener('timeupdate',     onTimeUpdate);
      video.removeEventListener('durationchange', onDuration);
      video.removeEventListener('play',           onPlay);
      video.removeEventListener('pause',          onPause);
      video.removeEventListener('waiting',        onWaiting);
      video.removeEventListener('canplay',        onCanPlay);
      video.removeEventListener('progress',       onProgress);
    };
  }, []);

  // ── Fullscreen change ─────────────────────────────────────
  useEffect(() => {
    const onFsChange = () => setFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

  // ── Controls ──────────────────────────────────────────────
  const togglePlay = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    playing ? v.pause() : v.play().catch(() => {});
  }, [playing]);

  const seek = useCallback((e) => {
    const bar  = e.currentTarget;
    const rect = bar.getBoundingClientRect();
    const pct  = (e.clientX - rect.left) / rect.width;
    if (videoRef.current) videoRef.current.currentTime = pct * duration;
  }, [duration]);

  const handleVolume = (e) => {
    const v = parseFloat(e.target.value);
    setVolume(v);
    if (videoRef.current) { videoRef.current.volume = v; videoRef.current.muted = v === 0; }
    setMuted(v === 0);
  };

  const toggleMute = () => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = !muted;
    setMuted(!muted);
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) containerRef.current?.requestFullscreen?.();
    else document.exitFullscreen?.();
  };

  const changeQuality = (idx) => {
    if (hlsRef.current) hlsRef.current.currentLevel = idx;
    setCurrentLevel(idx);
  };

  const changeSpeed = (rate) => {
    setPlaybackRate(rate);
    if (videoRef.current) videoRef.current.playbackRate = rate;
  };

  // ── A-B Loop ─────────────────────────────────────────────
  const setLoopPoint = (which) => {
    const t = Math.floor(videoRef.current?.currentTime || 0);
    if (which === 'A') {
      loopARef.current = t;
      setLoopA(t);
      if (loopBRef.current !== null && loopBRef.current <= t) {
        loopBRef.current = null; setLoopB(null);
      }
    } else {
      if (loopARef.current !== null && t <= loopARef.current) return;
      loopBRef.current = t; setLoopB(t);
    }
  };

  const clearLoop = () => {
    loopARef.current = null; loopBRef.current = null;
    setLoopA(null); setLoopB(null);
  };

  const showControlsTemporarily = () => {
    setShowControls(true);
    clearTimeout(hideTimerRef.current);
    if (playing) hideTimerRef.current = setTimeout(() => setShowControls(false), 3000);
  };

  // ── Keyboard shortcuts ────────────────────────────────────
  useEffect(() => {
    const onKey = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      switch (e.key) {
        case ' ': case 'k': e.preventDefault(); togglePlay(); break;
        case 'ArrowRight': if (videoRef.current) videoRef.current.currentTime += 10; break;
        case 'ArrowLeft':  if (videoRef.current) videoRef.current.currentTime -= 10; break;
        case 'ArrowUp':    if (videoRef.current) { videoRef.current.volume = Math.min(1, videoRef.current.volume + 0.1); setVolume(videoRef.current.volume); } break;
        case 'ArrowDown':  if (videoRef.current) { videoRef.current.volume = Math.max(0, videoRef.current.volume - 0.1); setVolume(videoRef.current.volume); } break;
        case 'f': toggleFullscreen(); break;
        case 'm': toggleMute(); break;
        case 'a': setLoopPoint('A'); break;
        case 'b': setLoopPoint('B'); break;
        case 'l': clearLoop(); break;
        case '>': case '.': changeSpeed(Math.min(2, playbackRate + 0.25)); break;
        case '<': case ',': changeSpeed(Math.max(0.5, playbackRate - 0.25)); break;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [togglePlay, playbackRate]);

  const progressPct = duration ? (currentTime / duration) * 100 : 0;
  const bufferedPct = duration ? (buffered / duration) * 100 : 0;
  const loopAPct    = (duration && loopA !== null) ? (loopA / duration) * 100 : null;
  const loopBPct    = (duration && loopB !== null) ? (loopB / duration) * 100 : null;

  if (error) {
    return (
      <div className="aspect-video bg-gray-900 rounded-2xl flex flex-col items-center justify-center text-center p-8">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-12 h-12 text-red-500/60 mb-3">
          <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
        </svg>
        <p className="text-gray-300 font-medium">Playback error</p>
        <p className="text-gray-500 text-sm mt-1">{error}</p>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="relative bg-black rounded-2xl overflow-hidden group select-none"
      onMouseMove={showControlsTemporarily}
      onMouseLeave={() => playing && setShowControls(false)}
      onDoubleClick={toggleFullscreen}
      onClick={togglePlay}
    >
      <video
        ref={videoRef}
        poster={thumbnailUrl}
        className="w-full aspect-video"
        playsInline
        preload="metadata"
      />

      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/40 pointer-events-none">
          <svg className="animate-spin w-12 h-12 text-brand-500" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
          </svg>
        </div>
      )}

      {/* A-B loop badge */}
      {(loopA !== null || loopB !== null) && (
        <div className="absolute top-3 right-3 flex items-center gap-1.5 bg-black/70 rounded-lg px-2.5 py-1.5 pointer-events-none">
          <span className={`text-xs font-mono font-bold ${loopA !== null ? 'text-green-400' : 'text-gray-600'}`}>
            A{loopA !== null ? `:${formatTime(loopA)}` : ''}
          </span>
          <span className="text-gray-600 text-xs">→</span>
          <span className={`text-xs font-mono font-bold ${loopB !== null ? 'text-orange-400' : 'text-gray-600'}`}>
            B{loopB !== null ? `:${formatTime(loopB)}` : ''}
          </span>
        </div>
      )}

      {/* Controls overlay */}
      <div
        className={`absolute inset-0 flex flex-col justify-end bg-gradient-to-t from-black/80 via-transparent to-transparent transition-opacity duration-300 pointer-events-none ${showControls ? 'opacity-100' : 'opacity-0'}`}
      >
        {/* Progress bar */}
        <div
          className="relative mx-4 mb-3 h-1 bg-gray-600/60 rounded-full cursor-pointer group/bar hover:h-2 transition-all pointer-events-auto"
          onClick={(e) => { e.stopPropagation(); seek(e); }}
        >
          {/* A-B loop zone */}
          {loopAPct !== null && loopBPct !== null && (
            <div className="absolute top-0 h-full bg-green-400/25 pointer-events-none"
              style={{ left: `${loopAPct}%`, width: `${loopBPct - loopAPct}%` }}/>
          )}
          <div className="absolute top-0 left-0 h-full bg-gray-400/40 rounded-full" style={{ width: `${bufferedPct}%` }}/>
          <div className="absolute top-0 left-0 h-full bg-brand-500 rounded-full progress-bar-glow" style={{ width: `${progressPct}%` }}/>
          <div className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full shadow opacity-0 group-hover/bar:opacity-100 transition-opacity"
            style={{ left: `calc(${progressPct}% - 6px)` }}/>
          {loopAPct !== null && (
            <div className="absolute top-1/2 -translate-y-1/2 w-1.5 h-4 bg-green-400 rounded-sm pointer-events-none" style={{ left: `${loopAPct}%` }}/>
          )}
          {loopBPct !== null && (
            <div className="absolute top-1/2 -translate-y-1/2 w-1.5 h-4 bg-orange-400 rounded-sm pointer-events-none" style={{ left: `${loopBPct}%` }}/>
          )}
        </div>

        {/* Bottom controls */}
        <div className="flex items-center gap-2 px-4 pb-3 pointer-events-auto" onClick={(e) => e.stopPropagation()}>

          {/* Play/Pause */}
          <button onClick={togglePlay} className="text-white hover:text-brand-400 transition-colors">
            {playing
              ? <svg viewBox="0 0 24 24" fill="currentColor" className="w-7 h-7"><path d="M6 4h4v16H6zM14 4h4v16h-4z"/></svg>
              : <svg viewBox="0 0 24 24" fill="currentColor" className="w-7 h-7"><path d="M8 5v14l11-7z"/></svg>
            }
          </button>

          {/* Volume */}
          <div className="flex items-center gap-1.5 group/vol">
            <button onClick={toggleMute} className="text-white hover:text-brand-400 transition-colors">
              {muted || volume === 0
                ? <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5"><path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"/></svg>
                : volume < 0.5
                ? <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5"><path d="M18.5 12c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM5 9v6h4l5 5V4L9 9H5z"/></svg>
                : <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/></svg>
              }
            </button>
            <input type="range" min="0" max="1" step="0.05" value={muted ? 0 : volume} onChange={handleVolume}
              className="w-0 group-hover/vol:w-16 transition-all duration-200 accent-brand-500 cursor-pointer"/>
          </div>

          {/* A-B Loop */}
          <div className="flex items-center gap-1 ml-1">
            <button onClick={() => setLoopPoint('A')} title="Set loop start (A)"
              className={`text-xs font-bold px-1.5 py-0.5 rounded transition-colors ${loopA !== null ? 'text-green-400 bg-green-400/15' : 'text-gray-500 hover:text-gray-300'}`}>A</button>
            <button onClick={() => setLoopPoint('B')} title="Set loop end (B)"
              className={`text-xs font-bold px-1.5 py-0.5 rounded transition-colors ${loopB !== null ? 'text-orange-400 bg-orange-400/15' : 'text-gray-500 hover:text-gray-300'}`}>B</button>
            {(loopA !== null || loopB !== null) && (
              <button onClick={clearLoop} title="Clear loop (L)" className="text-xs text-gray-600 hover:text-red-400 px-1 transition-colors">×</button>
            )}
          </div>

          {/* Time */}
          <span className="text-white text-xs font-mono ml-auto">
            {formatTime(currentTime)} / {formatTime(duration)}
          </span>

          {/* Speed */}
          <div
            className="relative"
            onMouseEnter={() => setSpeedOpen(true)}
            onMouseLeave={() => setSpeedOpen(false)}
          >
            <button className="text-xs text-white bg-white/10 hover:bg-white/20 px-2 py-1 rounded transition-colors font-mono min-w-[36px]">
              {playbackRate === 1 ? '1×' : `${playbackRate}×`}
            </button>
            {speedOpen && (
              <div className="absolute bottom-full right-0 mb-0.5 bg-gray-900 border border-gray-700 rounded-xl overflow-hidden shadow-xl min-w-[72px]">
                {SPEED_OPTIONS.map((rate) => (
                  <button
                    key={rate}
                    onClick={() => { changeSpeed(rate); setSpeedOpen(false); }}
                    className={`block w-full px-3 py-2 text-xs text-left hover:bg-gray-800 transition-colors ${rate === playbackRate ? 'text-brand-400 font-semibold' : 'text-gray-300'}`}
                  >{rate}×</button>
                ))}
              </div>
            )}
          </div>

          {/* Quality */}
          {levels.length > 0 && (
            <div
              className="relative"
              onMouseEnter={() => setQualityOpen(true)}
              onMouseLeave={() => setQualityOpen(false)}
            >
              <button className="text-xs text-white bg-white/10 hover:bg-white/20 px-2 py-1 rounded transition-colors font-mono">
                {currentLevel === -1 ? 'Auto' : (levels[currentLevel]?.height ? `${levels[currentLevel].height}p` : 'Auto')}
              </button>
              {qualityOpen && (
                <div className="absolute bottom-full right-0 mb-0.5 bg-gray-900 border border-gray-700 rounded-xl overflow-hidden shadow-xl min-w-[80px]">
                  <button
                    onClick={() => { changeQuality(-1); setQualityOpen(false); }}
                    className={`block w-full px-3 py-2 text-xs text-left hover:bg-gray-800 transition-colors ${currentLevel === -1 ? 'text-brand-400 font-semibold' : 'text-gray-300'}`}
                  >Auto</button>
                  {levels.map((lvl, idx) => (
                    <button
                      key={idx}
                      onClick={() => { changeQuality(idx); setQualityOpen(false); }}
                      className={`block w-full px-3 py-2 text-xs text-left hover:bg-gray-800 transition-colors ${currentLevel === idx ? 'text-brand-400 font-semibold' : 'text-gray-300'}`}
                    >{lvl.height}p</button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Fullscreen */}
          <button onClick={toggleFullscreen} className="text-white hover:text-brand-400 transition-colors">
            {fullscreen
              ? <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5"><path d="M5 16h3v3h2v-5H5v2zm3-8H5v2h5V5H8v3zm6 11h2v-3h3v-2h-5v5zm2-11V5h-2v5h5V8h-3z"/></svg>
              : <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5"><path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z"/></svg>
            }
          </button>
        </div>
      </div>
    </div>
  );
});

export default VideoPlayer;
