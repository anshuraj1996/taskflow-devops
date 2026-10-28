import { Link } from 'react-router-dom';

export function NotFoundPage() {
  return (
    <div className="py-20 text-center">
      <p className="text-5xl font-bold text-indigo-600">404</p>
      <p className="mt-2 text-slate-600">This page does not exist.</p>
      <Link to="/" className="btn btn-primary mt-6">
        Back to dashboard
      </Link>
    </div>
  );
}
