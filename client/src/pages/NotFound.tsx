import { Link } from 'react-router-dom';
import { Home } from 'lucide-react';

function NotFound() {
  return (
    <div
      dir="rtl"
      className="min-h-[60vh] flex items-center justify-center p-4 animate-page-enter"
    >
      <div className="text-center relative">
        {/* Abstract decorative shapes */}
        <div className="absolute -top-16 -right-16 w-40 h-40 bg-primary-500/5 rounded-full blur-2xl" />
        <div className="absolute -bottom-12 -left-12 w-32 h-32 bg-secondary-500/5 rounded-full blur-2xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-56 h-56 bg-primary-500/3 rounded-full blur-3xl" />

        {/* Large decorative 404 */}
        <h1 className="text-[120px] font-heading font-bold gradient-text leading-none mb-4">404</h1>

        <h2 className="text-2xl font-heading font-bold text-gray-900 mb-3">
          הדף לא נמצא
        </h2>

        <p className="text-gray-500 mb-8 max-w-sm mx-auto">
          הדף שחיפשת אינו קיים או שהועבר
        </p>

        <Link
          to="/"
          className="btn-primary inline-flex items-center gap-2 px-6 py-2.5"
        >
          <Home className="w-4 h-4" />
          חזרה לדשבורד
        </Link>
      </div>
    </div>
  );
}

export default NotFound;
