import { Link } from 'react-router-dom';
import { useAuth } from '@clerk/clerk-react';

const FEATURES = [
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-6 h-6">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z"/>
      </svg>
    ),
    title: 'Adaptive HLS Streaming',
    desc: 'Auto-switches between 360p, 720p, and 1080p based on connection speed — just like Netflix.',
    color: 'from-blue-500/20 to-indigo-500/20',
    iconColor: 'text-blue-500 dark:text-blue-400',
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-6 h-6">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z"/>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
      </svg>
    ),
    title: 'FFmpeg Processing',
    desc: 'Server-side H.264 encoding with auto thumbnail extraction. Smaller files, same quality.',
    color: 'from-orange-500/20 to-red-500/20',
    iconColor: 'text-orange-500 dark:text-orange-400',
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-6 h-6">
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15a4.5 4.5 0 004.5 4.5H18a3.75 3.75 0 001.332-7.257 3 3 0 00-3.758-3.848 5.25 5.25 0 00-10.233 2.33A4.502 4.502 0 002.25 15z"/>
      </svg>
    ),
    title: 'AWS S3 Private Storage',
    desc: 'Private bucket with presigned URLs. Every stream is authenticated and time-limited.',
    color: 'from-yellow-500/20 to-amber-500/20',
    iconColor: 'text-yellow-500 dark:text-yellow-400',
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-6 h-6">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z"/>
      </svg>
    ),
    title: 'AI Transcript Search',
    desc: 'Whisper-powered transcription via Groq. Search across spoken words in every video.',
    color: 'from-purple-500/20 to-violet-500/20',
    iconColor: 'text-purple-500 dark:text-purple-400',
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-6 h-6">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z"/>
      </svg>
    ),
    title: 'Creator Analytics',
    desc: 'Views, completion rates, engagement heatmaps, and daily view trends — all in one dashboard.',
    color: 'from-emerald-500/20 to-teal-500/20',
    iconColor: 'text-emerald-500 dark:text-emerald-400',
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-6 h-6">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z"/>
      </svg>
    ),
    title: 'Admin & Moderation',
    desc: 'Full control panel — suspend users, manage channels, view audit logs, moderate content.',
    color: 'from-rose-500/20 to-pink-500/20',
    iconColor: 'text-rose-500 dark:text-rose-400',
  },
];

const STATS = [
  { value: '3',   suffix: 'x',  label: 'Quality Levels' },
  { value: '6',   suffix: 's',  label: 'HLS Segment Size' },
  { value: '30',  suffix: '%',  label: 'Storage Savings' },
  { value: '∞',   suffix: '',   label: 'Upload Limit' },
];

const STEPS = [
  { n: '01', title: 'Upload', desc: 'Drop any MP4, MOV, MKV or AVI. Up to 2 GB per upload.' },
  { n: '02', title: 'Process', desc: 'FFmpeg transcodes to HLS at 360p, 720p, 1080p automatically.' },
  { n: '03', title: 'Stream', desc: 'Share anywhere. Viewers get the best quality their connection allows.' },
];

export default function LandingPage() {
  const { isSignedIn } = useAuth();

  return (
    <div className="overflow-x-hidden">

      {/* ── Hero ──────────────────────────────────────────── */}
      <section className="relative min-h-[92vh] flex items-center justify-center text-center px-4 py-20">

        {/* Background */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          {/* Grid */}
          <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(148,163,184,0.07)_1px,transparent_1px),linear-gradient(to_bottom,rgba(148,163,184,0.07)_1px,transparent_1px)] dark:bg-[linear-gradient(to_right,rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:56px_56px]"/>
          {/* Orbs */}
          <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[700px] h-[400px] bg-brand-500/8 dark:bg-brand-500/10 rounded-full blur-3xl animate-pulse-slow"/>
          <div className="absolute top-1/3 left-1/5 w-[350px] h-[350px] bg-indigo-500/6 dark:bg-indigo-500/8 rounded-full blur-3xl"/>
          <div className="absolute top-1/3 right-1/5 w-[300px] h-[300px] bg-purple-500/6 dark:bg-purple-500/8 rounded-full blur-3xl"/>
        </div>

        <div className="relative max-w-5xl mx-auto animate-fade-up">
          {/* Pill badge */}
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full
                          bg-brand-500/10 dark:bg-brand-500/10
                          border border-brand-500/20
                          text-brand-600 dark:text-brand-400 text-sm font-medium mb-8">
            <span className="w-1.5 h-1.5 rounded-full bg-brand-500 animate-pulse"/>
            Powered by HLS · FFmpeg · AWS S3 · AI
          </div>

          {/* Headline */}
          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-black text-slate-900 dark:text-white leading-[1.08] mb-6 tracking-tight">
            Stream Video at{' '}
            <span className="gradient-text">Any Quality,</span>
            <br />
            <span className="gradient-text">Anywhere</span>
          </h1>

          <p className="text-lg sm:text-xl text-slate-600 dark:text-gray-400 max-w-2xl mx-auto mb-10 leading-relaxed">
            Upload once, stream everywhere. StreamVault encodes your videos into adaptive HLS streams
            with AI-powered transcription, creator analytics, and enterprise-grade security.
          </p>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-14">
            {isSignedIn ? (
              <>
                <Link to="/library" className="btn-primary px-8 py-3.5 text-base">
                  Go to Library →
                </Link>
                <Link to="/upload" className="btn-secondary px-8 py-3.5 text-base">
                  Upload Video
                </Link>
              </>
            ) : (
              <>
                <Link to="/sign-up" className="btn-primary px-8 py-3.5 text-base">
                  Start Streaming Free →
                </Link>
                <Link to="/sign-in" className="btn-secondary px-8 py-3.5 text-base">
                  Sign In
                </Link>
              </>
            )}
          </div>

          {/* Social proof */}
          <p className="text-sm text-slate-400 dark:text-gray-600">
            No credit card · Sign in with Google or email · Free forever
          </p>
        </div>
      </section>

      {/* ── Stats ─────────────────────────────────────────── */}
      <section className="border-y border-slate-200 dark:border-gray-800 bg-slate-50/80 dark:bg-gray-900/40">
        <div className="max-w-5xl mx-auto px-4 py-12 grid grid-cols-2 sm:grid-cols-4 gap-8 text-center">
          {STATS.map(({ value, suffix, label }) => (
            <div key={label} className="group">
              <p className="text-4xl sm:text-5xl font-black text-slate-900 dark:text-white tabular-nums group-hover:scale-110 transition-transform duration-200 inline-block">
                {value}<span className="text-brand-500">{suffix}</span>
              </p>
              <p className="text-sm text-slate-500 dark:text-gray-500 mt-1.5 font-medium">{label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Features ──────────────────────────────────────── */}
      <section className="py-28 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <p className="section-label mb-3">Everything included</p>
            <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 dark:text-white mb-4">
              Production-grade infrastructure
            </h2>
            <p className="text-slate-500 dark:text-gray-500 max-w-xl mx-auto text-lg">
              Zero DevOps. Just upload and stream.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {FEATURES.map(({ icon, title, desc, color, iconColor }) => (
              <div
                key={title}
                className="group relative bg-white dark:bg-gray-900 border border-slate-200 dark:border-gray-800
                           rounded-2xl p-6 hover:border-slate-300 dark:hover:border-gray-700
                           hover:shadow-xl hover:shadow-slate-200/60 dark:hover:shadow-black/40
                           hover:-translate-y-1 transition-all duration-300 overflow-hidden"
              >
                {/* Gradient bg */}
                <div className={`absolute inset-0 bg-gradient-to-br ${color} opacity-0 group-hover:opacity-100 transition-opacity duration-300`}/>

                <div className="relative">
                  <div className={`w-11 h-11 rounded-xl bg-slate-100 dark:bg-gray-800 flex items-center justify-center mb-4 ${iconColor} group-hover:scale-110 transition-transform duration-200`}>
                    {icon}
                  </div>
                  <h3 className="font-semibold text-slate-900 dark:text-white mb-2 text-[15px]">{title}</h3>
                  <p className="text-slate-500 dark:text-gray-500 text-sm leading-relaxed">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How it works ──────────────────────────────────── */}
      <section className="py-24 px-4 bg-slate-50 dark:bg-gray-900/30 border-y border-slate-200 dark:border-gray-800">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <p className="section-label mb-3">Simple workflow</p>
            <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 dark:text-white">
              From upload to streaming in minutes
            </h2>
          </div>

          <div className="grid sm:grid-cols-3 gap-8 relative">
            {/* Connector line (desktop) */}
            <div className="hidden sm:block absolute top-8 left-[calc(16.67%+2rem)] right-[calc(16.67%+2rem)] h-px bg-gradient-to-r from-transparent via-slate-300 dark:via-gray-700 to-transparent"/>

            {STEPS.map(({ n, title, desc }) => (
              <div key={n} className="text-center group">
                <div className="relative inline-flex w-16 h-16 rounded-2xl bg-white dark:bg-gray-900 border border-slate-200 dark:border-gray-800 items-center justify-center mb-5 mx-auto
                                group-hover:border-brand-500/40 group-hover:shadow-brand dark:group-hover:shadow-brand transition-all duration-300">
                  <span className="text-2xl font-black text-slate-300 dark:text-gray-700 group-hover:text-brand-400 transition-colors duration-300">{n}</span>
                </div>
                <h3 className="font-bold text-slate-900 dark:text-white text-lg mb-2">{title}</h3>
                <p className="text-slate-500 dark:text-gray-500 text-sm leading-relaxed max-w-xs mx-auto">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ───────────────────────────────────────────── */}
      <section className="py-28 px-4 text-center relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[300px] bg-brand-500/8 dark:bg-brand-500/12 rounded-full blur-3xl"/>
        </div>
        <div className="relative max-w-2xl mx-auto">
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black text-slate-900 dark:text-white mb-5 tracking-tight">
            Ready to start streaming?
          </h2>
          <p className="text-slate-500 dark:text-gray-500 text-lg mb-10">
            Create a free account and upload your first video in minutes.
          </p>
          {isSignedIn ? (
            <Link to="/library" className="btn-primary px-10 py-4 text-base">
              Go to Library →
            </Link>
          ) : (
            <Link to="/sign-up" className="btn-primary px-10 py-4 text-base">
              Create Free Account →
            </Link>
          )}
        </div>
      </section>
    </div>
  );
}
