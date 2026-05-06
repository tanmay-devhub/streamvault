import { Link } from 'react-router-dom';

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] text-center px-4">
      <p className="text-9xl font-black text-slate-100 dark:text-gray-900 select-none leading-none mb-4">404</p>
      <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">Page Not Found</h2>
      <p className="text-slate-500 dark:text-gray-500 mb-8 max-w-sm">The page you're looking for doesn't exist or has been moved.</p>
      <Link to="/" className="btn-primary">← Back to Library</Link>
    </div>
  );
}
