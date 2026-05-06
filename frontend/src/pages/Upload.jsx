import { useState, useRef, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useVideoUpload } from '../hooks/useVideos';
import { useMyProfile } from '../hooks/useProfile';
import { videoApi } from '../services/api';
import ProfileSetupModal from '../components/ProfileSetupModal';

const MAX_SIZE_GB  = 2;
const ALLOWED_EXTS = ['mp4', 'mov', 'avi', 'mkv', 'webm', 'mpeg', 'flv'];

function FileDropZone({ onFile }) {
  const [dragging, setDragging] = useState(false);
  const [preview,  setPreview]  = useState(null);
  const [selected, setSelected] = useState(null);
  const inputRef = useRef(null);

  const validate = (file) => {
    const ext = file.name.split('.').pop().toLowerCase();
    if (!ALLOWED_EXTS.includes(ext)) { toast.error(`Unsupported format. Use: ${ALLOWED_EXTS.join(', ')}`); return false; }
    if (file.size > MAX_SIZE_GB * 1024 ** 3) { toast.error(`File too large. Max ${MAX_SIZE_GB} GB`); return false; }
    return true;
  };

  const handleFile = (file) => {
    if (!validate(file)) return;
    setSelected(file);
    setPreview(URL.createObjectURL(file));
    onFile(file);
  };

  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  if (selected) {
    return (
      <div className="border-2 border-brand-500/40 border-dashed rounded-2xl p-6 bg-brand-500/5 text-center animate-fade-in">
        <video src={preview} className="max-h-44 mx-auto rounded-xl mb-4 shadow-lg" controls={false}/>
        <p className="font-semibold text-slate-900 dark:text-gray-100 truncate text-sm">{selected.name}</p>
        <p className="text-sm text-slate-400 dark:text-gray-500 mt-0.5">{(selected.size / 1e6).toFixed(1)} MB</p>
        <button onClick={() => { setSelected(null); setPreview(null); onFile(null); }}
          className="mt-4 text-sm text-slate-400 dark:text-gray-500 hover:text-red-500 dark:hover:text-red-400 transition-colors">
          Remove file
        </button>
      </div>
    );
  }

  return (
    <div
      className={`border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer transition-all duration-200 ${
        dragging
          ? 'drop-active scale-[1.01]'
          : 'border-slate-200 dark:border-gray-700 hover:border-slate-300 dark:hover:border-gray-600 hover:bg-slate-50 dark:hover:bg-white/[0.02]'
      }`}
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
      onClick={() => inputRef.current?.click()}
    >
      <input ref={inputRef} type="file" accept="video/*" className="hidden"
        onChange={(e) => { const f = e.target.files[0]; if (f) handleFile(f); }}/>
      <div className="w-16 h-16 rounded-2xl bg-brand-500/10 flex items-center justify-center mx-auto mb-4">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-8 h-8 text-brand-500">
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"/>
        </svg>
      </div>
      <h3 className="font-bold text-slate-900 dark:text-gray-100 text-lg">Drop your video here</h3>
      <p className="text-slate-500 dark:text-gray-500 text-sm mt-2">
        or <span className="text-brand-500 font-medium">browse files</span>
      </p>
      <p className="text-slate-400 dark:text-gray-600 text-xs mt-3">
        {ALLOWED_EXTS.join(', ').toUpperCase()} · Max {MAX_SIZE_GB} GB
      </p>
    </div>
  );
}

function ProcessingStatus({ videoId }) {
  const [status, setStatus] = useState('processing');
  const [dots,   setDots]   = useState('');
  const navigate = useNavigate();
  const intervalRef = useRef(null);

  useEffect(() => {
    const dotTimer = setInterval(() => setDots((d) => d.length >= 3 ? '' : d + '.'), 500);
    intervalRef.current = setInterval(async () => {
      try {
        const res = await videoApi.status(videoId);
        setStatus(res.status);
        if (res.status === 'ready') {
          clearInterval(intervalRef.current); clearInterval(dotTimer);
          toast.success('Video ready! Redirecting…');
          setTimeout(() => navigate(`/watch/${videoId}`), 1500);
        } else if (res.status === 'failed') {
          clearInterval(intervalRef.current); clearInterval(dotTimer);
          toast.error(`Processing failed: ${res.errorMessage || 'Unknown error'}`);
        }
      } catch {}
    }, 4000);
    return () => { clearInterval(intervalRef.current); clearInterval(dotTimer); };
  }, [videoId, navigate]);

  const stages = [
    { label: 'Upload complete' },
    { label: 'Probing video metadata' },
    { label: 'Extracting thumbnail' },
    { label: 'Encoding HLS streams (360p · 720p · 1080p)' },
    { label: 'Uploading to S3' },
    { label: 'Ready for playback' },
  ];

  return (
    <div className="mt-8 card-flat p-8 animate-fade-in">
      <h3 className="font-bold text-slate-900 dark:text-white text-lg mb-6 flex items-center gap-3">
        <svg className="animate-spin w-5 h-5 text-brand-500 flex-shrink-0" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
        </svg>
        Processing{dots}
      </h3>
      <div className="space-y-4">
        {stages.map((stage, i) => {
          const done = status === 'ready' || i === 0;
          return (
            <div key={stage.label} className="flex items-center gap-3">
              <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 transition-all ${
                done || i === 1 ? 'bg-brand-500' : 'bg-slate-200 dark:bg-gray-700'
              }`}>
                {(done || i === 1) && (
                  <svg viewBox="0 0 24 24" fill="currentColor" className="w-3 h-3 text-white">
                    <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/>
                  </svg>
                )}
              </div>
              <span className={`text-sm ${done ? 'text-slate-700 dark:text-gray-300' : 'text-slate-400 dark:text-gray-600'}`}>
                {stage.label}
              </span>
            </div>
          );
        })}
      </div>
      <p className="mt-6 text-xs text-slate-400 dark:text-gray-600">
        Usually 1–5 minutes. You can close this page — processing continues in the background.
      </p>
    </div>
  );
}

export default function Upload() {
  const [file,    setFile]    = useState(null);
  const [title,   setTitle]   = useState('');
  const [description, setDesc]= useState('');
  const [privacy, setPrivacy] = useState('public');
  const [showProfileSetup, setShowProfileSetup] = useState(false);
  const [pendingUpload,    setPendingUpload]     = useState(false);
  const { upload, uploading, uploadPct, processingId, error } = useVideoUpload();
  const { profile, loading: profileLoading, refresh: refreshProfile } = useMyProfile();

  const doUpload = async () => {
    try { await upload(file, { title: title || file.name.replace(/\.[^.]+$/, ''), description, privacy }); } catch {}
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!file) { toast.error('Please select a video file.'); return; }
    // null = server confirmed no channel; undefined = fetch errored (don't block upload)
    if (!profileLoading && profile === null) { setShowProfileSetup(true); setPendingUpload(true); return; }
    await doUpload();
  };

  const handleProfileComplete = async (newProfile) => {
    setShowProfileSetup(false);
    await refreshProfile();
    if (pendingUpload) { setPendingUpload(false); await doUpload(); }
  };

  const PRIVACY_OPTIONS = [
    { val: 'public',   label: 'Public',   desc: 'Everyone can see', icon: '🌍' },
    { val: 'unlisted', label: 'Unlisted', desc: 'Only via direct link', icon: '🔗' },
    { val: 'private',  label: 'Private',  desc: 'Only you', icon: '🔒' },
  ];

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-10">
      {showProfileSetup && <ProfileSetupModal onComplete={handleProfileComplete}/>}

      <div className="mb-8">
        <h1 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">Upload Video</h1>
        <p className="text-slate-500 dark:text-gray-500 mt-1 text-sm">
          Encoded to HLS at multiple quality levels and stored on S3.
        </p>
      </div>

      {!processingId ? (
        <form onSubmit={handleSubmit} className="space-y-6">
          <FileDropZone onFile={setFile}/>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-1.5">Title</label>
              <input type="text" placeholder="My awesome video" value={title}
                onChange={(e) => setTitle(e.target.value)} className="input" maxLength={200}/>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-1.5">
                Description <span className="text-slate-400 dark:text-gray-600">(optional)</span>
              </label>
              <textarea placeholder="Describe your video…" value={description}
                onChange={(e) => setDesc(e.target.value)} rows={3} className="input resize-none" maxLength={1000}/>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-2">Visibility</label>
              <div className="grid grid-cols-3 gap-2">
                {PRIVACY_OPTIONS.map(({ val, label, desc, icon }) => (
                  <button key={val} type="button" onClick={() => setPrivacy(val)}
                    className={`p-3.5 rounded-xl border text-left transition-all ${
                      privacy === val
                        ? 'border-brand-500/50 bg-brand-500/8 dark:bg-brand-500/10 text-slate-900 dark:text-white'
                        : 'border-slate-200 dark:border-gray-700 text-slate-600 dark:text-gray-400 hover:border-slate-300 dark:hover:border-gray-600 hover:bg-slate-50 dark:hover:bg-gray-800/50'
                    }`}>
                    <span className="text-base mb-1 block">{icon}</span>
                    <p className="font-semibold text-sm">{label}</p>
                    <p className="text-xs mt-0.5 opacity-70">{desc}</p>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {error && (
            <div className="bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 rounded-xl px-4 py-3 text-sm text-red-600 dark:text-red-400">
              {error}
            </div>
          )}

          {uploading && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm text-slate-600 dark:text-gray-400">
                <span>Uploading…</span><span className="font-medium">{uploadPct}%</span>
              </div>
              <div className="h-2 bg-slate-100 dark:bg-gray-800 rounded-full overflow-hidden">
                <div className="h-full bg-brand-500 rounded-full transition-all duration-300 progress-bar-glow" style={{ width: `${uploadPct}%` }}/>
              </div>
            </div>
          )}

          <button type="submit" disabled={uploading || !file} className="btn-primary w-full justify-center py-3 text-base">
            {uploading ? (
              <><svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>Uploading ({uploadPct}%)</>
            ) : (
              <><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"/></svg>Upload & Process</>
            )}
          </button>
        </form>
      ) : (
        <ProcessingStatus videoId={processingId}/>
      )}
    </div>
  );
}
