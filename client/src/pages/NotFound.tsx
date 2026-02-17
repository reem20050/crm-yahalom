import { Link } from 'react-router-dom';
import { FileQuestion } from 'lucide-react';

function NotFound() {
  return (
    <div
      dir="rtl"
      className="min-h-[60vh] flex items-center justify-center p-4"
    >
      <div className="text-center">
        <div className="flex justify-center mb-6">
          <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center">
            <FileQuestion className="w-10 h-10 text-gray-400" />
          </div>
        </div>

        <h1 className="text-8xl font-extrabold text-gray-200 mb-4">404</h1>

        <h2 className="text-2xl font-bold text-gray-900 mb-3">
          הדף לא נמצא
        </h2>

        <p className="text-gray-500 mb-8 max-w-sm mx-auto">
          הדף שחיפשת אינו קיים או שהועבר
        </p>

        <Link
          to="/"
          className="inline-flex items-center px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
        >
          חזרה לדשבורד
        </Link>
      </div>
    </div>
  );
}

export default NotFound;
