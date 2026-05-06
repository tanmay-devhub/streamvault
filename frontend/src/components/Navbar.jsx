import { Link, useLocation } from 'react-router-dom';
import { useUser, UserButton, SignedIn, SignedOut } from '@clerk/clerk-react';
import { useState } from 'react';

export default function Navbar() {
  const { pathname }    = useLocation();
  const { user }        = useUser();
  const [mobileOpen, setMobileOpen] = useState(false);
  const isAdmin = user?.publicMetadata?.role === 'admin';

  const navLinks = [
    { to: '/library', label: 'Library' },
    { to: '/upload',  label: 'Upload' },
    ...(user ? [{ to: `/channel/${user.id}`, label: 'My Channel' }] : []),
    ...(isAdmin ? [{ to: '/admin', label: 'Admin', badge: true }] : []),
  ];

  const isActive = (to) => pathname === to || (to !== '/' && pathname.startsWith(to));

  return (
    <header className="sticky top-0 z-50 glass border-b border-slate-200 dark:border-gray-800/60">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between h-16">

        {/* Logo */}
        <Link to="/" className="flex items-center gap-2.5 group flex-shrink-0">
          <div className="w-8 h-8 rounded-lg bg-brand-500 flex items-center justify-center shadow-md shadow-brand-500/30 group-hover:shadow-brand-500/50 group-hover:scale-105 transition-all duration-200">
            <svg viewBox="0 0 24 24" fill="currentColor" className="w-4.5 h-4.5 text-white w-5 h-5">
              <path d="M8 5v14l11-7z"/>
            </svg>
          </div>
          <span className="font-bold text-xl tracking-tight text-slate-900 dark:text-white">
            Stream<span className="text-brand-500">Vault</span>
          </span>
        </Link>

        {/* Desktop nav */}
        <SignedIn>
          <nav className="hidden sm:flex items-center gap-1">
            {navLinks.map(({ to, label, badge }) => (
              <Link
                key={to}
                to={to}
                className={`relative px-3.5 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                  isActive(to)
                    ? 'bg-brand-500/10 text-brand-600 dark:text-brand-400'
                    : 'text-slate-600 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5'
                }`}
              >
                {label}
                {badge && (
                  <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-brand-500 ring-2 ring-white dark:ring-gray-950"/>
                )}
              </Link>
            ))}
          </nav>
        </SignedIn>

        {/* Right side */}
        <div className="flex items-center gap-2">

<SignedOut>
            <Link to="/sign-in" className="btn-ghost text-sm px-3 py-1.5 hidden sm:inline-flex">
              Sign in
            </Link>
            <Link to="/sign-up" className="btn-primary text-sm px-4 py-2">
              Get started
            </Link>
          </SignedOut>

          <SignedIn>
            {/* Mobile menu */}
            <button
              className="sm:hidden w-9 h-9 rounded-xl flex items-center justify-center text-slate-600 dark:text-gray-400 hover:bg-slate-100 dark:hover:bg-gray-800 transition-colors"
              onClick={() => setMobileOpen((o) => !o)}
              aria-label="Menu"
            >
              {mobileOpen
                ? <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
                : <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16"/></svg>
              }
            </button>
            <UserButton
              afterSignOutUrl="/"
              appearance={{
                elements: { avatarBox: 'w-8 h-8 ring-2 ring-brand-500/30 hover:ring-brand-500/60 transition-all' },
              }}
            />
          </SignedIn>
        </div>
      </div>

      {/* Mobile dropdown */}
      <SignedIn>
        {mobileOpen && (
          <div className="sm:hidden border-t border-slate-200 dark:border-gray-800 bg-white/95 dark:bg-gray-950/95 backdrop-blur-xl px-4 py-3 space-y-1 animate-slide-down">
            {navLinks.map(({ to, label }) => (
              <Link
                key={to}
                to={to}
                onClick={() => setMobileOpen(false)}
                className={`flex items-center px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  isActive(to)
                    ? 'bg-brand-500/10 text-brand-600 dark:text-brand-400'
                    : 'text-slate-600 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5'
                }`}
              >
                {label}
              </Link>
            ))}
          </div>
        )}
      </SignedIn>
    </header>
  );
}
