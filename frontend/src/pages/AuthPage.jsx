import { SignIn, SignUp } from '@clerk/clerk-react';
import { useLocation, Navigate } from 'react-router-dom';
import { useAuth } from '@clerk/clerk-react';

export default function AuthPage({ mode }) {
  const { isSignedIn } = useAuth();
  const location = useLocation();
  const from = location.state?.from?.pathname || '/library';

  if (isSignedIn) return <Navigate to={from} replace />;

  return (
    <div className="min-h-[85vh] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        {/* Logo above card */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-brand-500 flex items-center justify-center shadow-lg shadow-brand-500/40">
              <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 text-white">
                <path d="M8 5v14l11-7z" />
              </svg>
            </div>
            <span className="font-bold text-2xl text-slate-900 dark:text-white">
              Stream<span className="text-brand-500">Vault</span>
            </span>
          </div>
          <p className="text-slate-500 dark:text-gray-500 text-sm mt-3">
            {mode === 'sign-in' ? 'Welcome back' : 'Start streaming for free'}
          </p>
        </div>

        {/* Clerk component */}
        <div className="flex justify-center">
          {mode === 'sign-in' ? (
            <SignIn
              routing="path"
              path="/sign-in"
              afterSignInUrl={from}
              signUpUrl="/sign-up"
            />
          ) : (
            <SignUp
              routing="path"
              path="/sign-up"
              afterSignUpUrl="/library"
              signInUrl="/sign-in"
            />
          )}
        </div>
      </div>
    </div>
  );
}
