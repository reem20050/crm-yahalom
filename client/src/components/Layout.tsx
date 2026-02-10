import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  LayoutDashboard,
  Users,
  Building2,
  UserCircle,
  Calendar,
  CalendarDays,
  PartyPopper,
  Receipt,
  BarChart3,
  Bell,
  LogOut,
  Menu,
  X,
  ChevronDown,
  Settings,
  Search,
  User,
  ShieldCheck,
} from 'lucide-react';
import { useAuthStore } from '../stores/authStore';
import { dashboardApi } from '../services/api';
import { clsx } from 'clsx';
import SearchCommand from './SearchCommand';
import NotificationCenter from './NotificationCenter';

const navigation = [
  { name: 'דשבורד', href: '/', icon: LayoutDashboard },
  { name: 'לידים', href: '/leads', icon: Users },
  { name: 'לקוחות', href: '/customers', icon: Building2 },
  { name: 'עובדים', href: '/employees', icon: UserCircle },
  { name: 'משמרות', href: '/shifts', icon: Calendar },
  { name: 'אירועים', href: '/events', icon: PartyPopper },
  { name: 'לוח שנה', href: '/calendar', icon: CalendarDays },
  { name: 'חשבוניות', href: '/invoices', icon: Receipt },
  { name: 'דוחות', href: '/reports', icon: BarChart3 },
  { name: 'משתמשים', href: '/users', icon: ShieldCheck },
  { name: 'הגדרות', href: '/settings', icon: Settings },
];

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();

  // Fetch notifications for unread count badge
  const { data: notificationsData } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => dashboardApi.getNotifications().then((res) => res.data),
    refetchInterval: 60000,
  });

  const unreadCount = (notificationsData?.notifications || []).filter(
    (n: { is_read: number }) => !n.is_read
  ).length;

  // Ctrl+K / Cmd+K keyboard shortcut to open search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setIsSearchOpen(true);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Mobile sidebar backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-gray-600 bg-opacity-75 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={clsx(
          'fixed inset-y-0 right-0 z-50 w-64 bg-white shadow-lg transform transition-transform duration-300 ease-in-out lg:translate-x-0',
          sidebarOpen ? 'translate-x-0' : 'translate-x-full lg:translate-x-0'
        )}
      >
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="flex items-center justify-between h-16 px-6 border-b">
            <h1 className="text-xl font-bold text-primary-600">צוות יהלום</h1>
            <button
              onClick={() => setSidebarOpen(false)}
              className="lg:hidden p-2 rounded-lg hover:bg-gray-100"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto">
            {navigation.map((item) => (
              <NavLink
                key={item.name}
                to={item.href}
                onClick={() => setSidebarOpen(false)}
                className={({ isActive }) =>
                  clsx('sidebar-link', isActive && 'sidebar-link-active')
                }
                end={item.href === '/'}
              >
                <item.icon className="w-5 h-5" />
                <span>{item.name}</span>
              </NavLink>
            ))}
          </nav>

          {/* User menu */}
          <div className="border-t p-4">
            <div className="relative">
              <button
                onClick={() => setUserMenuOpen(!userMenuOpen)}
                className="flex items-center gap-3 w-full p-3 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center">
                  <span className="text-primary-700 font-medium">
                    {user?.firstName?.[0]}
                    {user?.lastName?.[0]}
                  </span>
                </div>
                <div className="flex-1 text-right">
                  <p className="font-medium text-gray-900">
                    {user?.firstName} {user?.lastName}
                  </p>
                  <p className="text-sm text-gray-500">
                    {user?.role === 'admin' ? 'מנהל' : user?.role}
                  </p>
                </div>
                <ChevronDown className="w-4 h-4 text-gray-400" />
              </button>

              {userMenuOpen && (
                <div className="absolute bottom-full right-0 left-0 mb-2 bg-white rounded-lg shadow-lg border py-1">
                  <button
                    onClick={() => {
                      navigate('/profile');
                      setUserMenuOpen(false);
                      setSidebarOpen(false);
                    }}
                    className="flex items-center gap-2 w-full px-4 py-2 text-gray-700 hover:bg-gray-50"
                  >
                    <User className="w-4 h-4" />
                    <span>פרופיל</span>
                  </button>
                  <button
                    onClick={handleLogout}
                    className="flex items-center gap-2 w-full px-4 py-2 text-red-600 hover:bg-red-50"
                  >
                    <LogOut className="w-4 h-4" />
                    <span>התנתק</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="lg:mr-64">
        {/* Top bar */}
        <header className="sticky top-0 z-30 bg-white shadow-sm">
          <div className="flex items-center justify-between h-16 px-4 lg:px-8">
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-2 rounded-lg hover:bg-gray-100"
            >
              <Menu className="w-6 h-6" />
            </button>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsSearchOpen(true)}
                className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors"
                title="חיפוש (Ctrl+K)"
              >
                <Search className="w-5 h-5" />
                <span className="hidden sm:inline text-sm">חיפוש</span>
                <kbd className="hidden sm:inline-flex items-center px-1.5 py-0.5 text-xs text-gray-400 bg-gray-100 rounded border border-gray-200">
                  Ctrl+K
                </kbd>
              </button>
              <div className="relative">
                <button
                  onClick={() => setIsNotificationsOpen(!isNotificationsOpen)}
                  className="relative p-2 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  <Bell className="w-6 h-6 text-gray-600" />
                  {unreadCount > 0 && (
                    <span className="absolute top-1 left-1 min-w-[18px] h-[18px] flex items-center justify-center px-1 text-[10px] font-bold text-white bg-red-500 rounded-full">
                      {unreadCount > 99 ? '99+' : unreadCount}
                    </span>
                  )}
                </button>
                <NotificationCenter
                  isOpen={isNotificationsOpen}
                  onClose={() => setIsNotificationsOpen(false)}
                />
              </div>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="p-4 lg:p-8">
          <Outlet />
        </main>
      </div>

      {/* Search Command Palette */}
      <SearchCommand isOpen={isSearchOpen} onClose={() => setIsSearchOpen(false)} />
    </div>
  );
}
