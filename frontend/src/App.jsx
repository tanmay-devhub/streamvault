import { useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from '@clerk/clerk-react';
import { setTokenGetter } from './services/api';
import { ProtectedRoute, AdminRoute } from './components/ProtectedRoute';
import Navbar from './components/Navbar';
import LandingPage from './pages/LandingPage';
import AuthPage from './pages/AuthPage';
import Home from './pages/Home';
import Upload from './pages/Upload';
import Watch from './pages/Watch';
import Admin from './pages/Admin';
import Channel from './pages/Channel';
import Share from './pages/Share';
import Analytics from './pages/Analytics';
import NotFound from './pages/NotFound';

function AppContent() {
  const { getToken, isSignedIn } = useAuth();

  // Wire Clerk token into all axios requests
  useEffect(() => {
    setTokenGetter(getToken);
  }, [getToken]);

  return (
    <div className="min-h-screen flex flex-col bg-gray-950">
      <Navbar />
      <main className="flex-1">
        <Routes>
          {/* Public */}
          <Route path="/"           element={<LandingPage />} />
          <Route path="/sign-in/*"  element={<AuthPage mode="sign-in" />} />
          <Route path="/sign-up/*"  element={<AuthPage mode="sign-up" />} />
          <Route path="/share/:id"  element={<Share />} />

          {/* Authenticated */}
          <Route path="/library"  element={<ProtectedRoute><Home /></ProtectedRoute>} />
          <Route path="/upload"   element={<ProtectedRoute><Upload /></ProtectedRoute>} />
          <Route path="/watch/:id"         element={<ProtectedRoute><Watch /></ProtectedRoute>} />
          <Route path="/analytics/:id"     element={<ProtectedRoute><Analytics /></ProtectedRoute>} />
          <Route path="/channel/:userId"   element={<ProtectedRoute><Channel /></ProtectedRoute>} />

          {/* Admin */}
          <Route path="/admin"    element={<AdminRoute><Admin /></AdminRoute>} />
          <Route path="/admin/*"  element={<AdminRoute><Admin /></AdminRoute>} />

          {/* Legacy redirect */}
          <Route path="/home"     element={<Navigate to="/library" replace />} />

          <Route path="*"         element={<NotFound />} />
        </Routes>
      </main>
      <footer className="border-t border-gray-800/60 py-5 text-center text-xs text-gray-600">
        © {new Date().getFullYear()} StreamVault · HLS streaming powered by FFmpeg + AWS S3
      </footer>
    </div>
  );
}

export default function App() {
  return <AppContent />;
}
