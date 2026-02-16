import { Link } from 'react-router-dom';
import {
  Home,
  Search,
  ArrowRight,
  LayoutDashboard,
  Users,
  Calendar,
  BarChart3,
} from 'lucide-react';

const quickLinks = [
  { name: 'דשבורד', href: '/', icon: LayoutDashboard },
  { name: 'לידים', href: '/leads', icon: Users },
  { name: 'משמרות', href: '/shifts', icon: Calendar },
  { name: 'דוחות', href: '/reports', icon: BarChart3 },
];

function NotFound() {
  return (
    <div dir="rtl" className="min-h-[70vh] flex items-center justify-center p-4">
      <div className="text-center max-w-md">
        {/* Animated 404 */}
        <div className="relative mb-8">
          <p className="text-[140px] font-black text-gray-100 leading-none select-none">
            404
          </p>
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-20 h-20 rounded-2xl bg-primary-50 flex items-center justify-center animate-bounce" style={{ animationDuration: '2s' }}>
              <Search className="w-10 h-10 text-primary-400" />
            </div>
          </div>
        </div>

        <h2 className="text-2xl font-bold text-gray-900 mb-3">
          הדף לא נמצא
        </h2>
        <p className="text-gray-500 mb-8">
          הדף שחיפשת אינו קיים, הועבר או שאין לך הרשאת גישה
        </p>

        {/* Main action */}
        <Link
          to="/"
          className="inline-flex items-center gap-2 px-6 py-3 bg-primary-600 text-white rounded-xl hover:bg-primary-700 transition-all duration-200 font-medium shadow-sm hover:shadow-md"
        >
          <Home className="w-5 h-5" />
          חזרה לדשבורד
        </Link>

        {/* Quick links */}
        <div className="mt-10 pt-8 border-t border-gray-100">
          <p className="text-sm text-gray-400 mb-4">או נווט ישירות ל:</p>
          <div className="grid grid-cols-2 gap-2">
            {quickLinks.map((link) => (
              <Link
                key={link.href}
                to={link.href}
                className="flex items-center gap-2.5 p-3 rounded-xl bg-gray-50 hover:bg-gray-100 text-gray-700 transition-all text-sm font-medium group"
              >
                <link.icon className="w-4 h-4 text-gray-400 group-hover:text-primary-500 transition-colors" />
                {link.name}
                <ArrowRight className="w-3.5 h-3.5 text-gray-300 mr-auto group-hover:text-primary-400 transition-colors" />
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default NotFound;
