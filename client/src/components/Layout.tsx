import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useState, useEffect, useCallback } from 'react';
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
  AlertTriangle,
  Crosshair,
  WifiOff,
  Moon,
  Sun,
  Keyboard,
} from 'lucide-react';
import { useAuthStore } from '../stores/authStore';
import { usePermissions } from '../hooks/usePermissions';
import { dashboardApi } from '../services/api';
import { clsx } from 'clsx';
import SearchCommand from './SearchCommand';
import NotificationCenter from './NotificationCenter';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { useThemeStore } from '../stores/themeStore';

const navigation = [
  { name: 'דשבורד', href: '/', icon: LayoutDashboard, permission: 'page:dashboard' },
  { name: 'לידים', href: '/leads', icon: Users, permission: 'page:leads' },
  { name: 'לקוחות', href: '/customers', icon: Building2, permission: 'page:customers' },
  { name: 'עובדים', href: '/employees', icon: UserCircle, permission: 'page:employees' },
  { name: 'משמרות', href: '/shifts', icon: Calendar, permission: 'page:shifts' },
  { name: 'אירועים', href: '/events', icon: PartyPopper, permission: 'page:events' },
  { name: 'לוח שנה', href: '/calendar', icon: CalendarDays, permission: 'page:calendar' },
  { name: 'אירועי אבטחה', href: '/incidents', icon: AlertTriangle, permission: 'page:incidents' },
  { name: 'נשק וציוד', href: '/weapons', icon: Crosshair, permission: 'page:weapons' },
  { name: 'חשבוניות', href: '/invoices', icon: Receipt, permission: 'page:invoices' },
  { name: 'דוחות', href: '/reports', icon: BarChart3, permission: 'page:reports' },
  { name: 'משתמשים', href: '/users', icon: ShieldCheck, permission: 'page:users' },
  { name: 'הגדרות', href: '/settings', icon: Settings, permission: 'page:settings' },
];

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [isShortcutsOpen, setIsShortcutsOpen] = useState(false);
  const { user, logout } = useAuthStore();
  const { can } = usePermissions();
  const navigate = useNavigate();
  const location = useLocation();
  const isOnline = useOnlineStatus();
  const { theme, setTheme } = useThemeStore();

  const filteredNavigation = navigation.filter((item) => can(item.permission));

  // Close sidebar on route change (mobile)
  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  // Fetch notifications for unread count badge
  const { data: notificationsData } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => dashboardApi.getNotifications().then((res) => res.data),
    refetchInterval: 60000,
  });

  const unreadCount = (notificationsData?.notifications || []).filter(
    (n: { is_read: number }) => !n.is_read
  ).length;

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;

      // Ctrl+K / Cmd+K → open search
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setIsSearchOpen(true);
        return;
      }

      // Escape → close any open modal
      if (e.key === 'Escape') {
        setIsShortcutsOpen(false);
        setIsNotificationsOpen(false);
        setUserMenuOpen(false);
        return;
      }

      // ? → open shortcuts modal (when not in input)
      if (e.key === '?' && !isInput) {
        e.preventDefault();
        setIsShortcutsOpen(true);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  // Get current page title
  const currentPage = filteredNavigation.find(
    (item) => item.href === '/' ? location.pathname === '/' : location.pathname.startsWith(item.href)
  );

  const toggleTheme = useCallback(() => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  }, [theme, setTheme]);

  return (
    <div className="min-h-screen bg-gray-50/80 dark:bg-gray-900">
      {/* Offline Banner */}
      {!isOnline && (
        <div className="fixed top-0 left-0 right-0 z-[100] bg-red-600 text-white text-center py-2 px-4 text-sm font-medium flex items-center justify-center gap-2 animate-slide-up">
          <WifiOff className="w-4 h-4" />
          אין חיבור לאינטרנט - חלק מהפעולות לא יהיו זמינות
        </div>
      )}

      {/* Mobile sidebar backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-gray-900/40 backdrop-blur-sm lg:hidden animate-fade-in"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={clsx(
          'fixed inset-y-0 right-0 z-50 w-[272px] bg-white border-l border-gray-100 transform transition-transform duration-300 ease-out lg:translate-x-0',
          sidebarOpen ? 'translate-x-0' : 'translate-x-full lg:translate-x-0'
        )}
      >
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="flex items-center justify-between h-16 px-6">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-primary-600 flex items-center justify-center">
                <ShieldCheck className="w-4.5 h-4.5 text-white" />
              </div>
              <span className="text-lg font-bold text-gray-900">צוות יהלום</span>
            </div>
            <button
              onClick={() => setSidebarOpen(false)}
              className="lg:hidden p-1.5 rounded-lg hover:bg-gray-100 text-gray-400"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-3 py-2 space-y-0.5 overflow-y-auto">
            {filteredNavigation.map((item) => (
              <NavLink
                key={item.name}
                to={item.href}
                className={({ isActive }) =>
                  clsx('sidebar-link', isActive && 'sidebar-link-active')
                }
                end={item.href === '/'}
              >
                <item.icon className="w-[18px] h-[18px] flex-shrink-0" />
                <span>{item.name}</span>
              </NavLink>
            ))}
          </nav>

          {/* User section */}
          <div className="border-t border-gray-100 p-3">
            <div className="relative">
              <button
                onClick={() => setUserMenuOpen(!userMenuOpen)}
                className="flex items-center gap-3 w-full p-2.5 rounded-xl hover:bg-gray-50 transition-colors"
              >
                <div className="w-9 h-9 rounded-xl bg-primary-50 flex items-center justify-center flex-shrink-0">
                  <span className="text-primary-700 font-semibold text-sm">
                    {user?.firstName?.[0]}
                    {user?.lastName?.[0]}
                  </span>
                </div>
                <div className="flex-1 text-right min-w-0">
                  <p className="font-medium text-gray-900 text-sm truncate">
                    {user?.firstName} {user?.lastName}
                  </p>
                  <p className="text-xs text-gray-400">
                    {user?.role === 'admin' ? 'מנהל' : user?.role === 'manager' ? 'מנהל משמרות' : 'עובד'}
                  </p>
                </div>
                <ChevronDown className={clsx(
                  'w-4 h-4 text-gray-400 transition-transform duration-200',
                  userMenuOpen && 'rotate-180'
                )} />
              </button>

              {userMenuOpen && (
                <div className="absolute bottom-full right-0 left-0 mb-2 bg-white rounded-xl shadow-elevated border border-gray-100 py-1 animate-slide-up">
                  <button
                    onClick={() => {
                      navigate('/profile');
                      setUserMenuOpen(false);
                    }}
                    className="flex items-center gap-2.5 w-full px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    <User className="w-4 h-4" />
                    <span>פרופיל</span>
                  </button>
                  <div className="mx-3 my-1 border-t border-gray-100" />
                  <button
                    onClick={handleLogout}
                    className="flex items-center gap-2.5 w-full px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors"
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
      <div className="lg:mr-[272px]">
        {/* Top bar */}
        <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-lg border-b border-gray-100">
          <div className="flex items-center justify-between h-16 px-4 lg:px-8">
            {/* Left: mobile menu + page title */}
            <div className="flex items-center gap-3">
              <button
                onClick={() => setSidebarOpen(true)}
                className="lg:hidden p-2 -mr-2 rounded-xl hover:bg-gray-100 text-gray-600 transition-colors"
              >
                <Menu className="w-5 h-5" />
              </button>
              {currentPage && (
                <h2 className="text-lg font-semibold text-gray-900 hidden sm:block">
                  {currentPage.name}
                </h2>
              )}
            </div>

            {/* Right: actions */}
            <div className="flex items-center gap-1.5">
              {/* Search */}
              <button
                onClick={() => setIsSearchOpen(true)}
                className="flex items-center gap-2 px-3 py-2 rounded-xl hover:bg-gray-100 text-gray-500 transition-colors"
                title="חיפוש (Ctrl+K)"
              >
                <Search className="w-[18px] h-[18px]" />
                <span className="hidden md:inline text-sm">חיפוש</span>
                <kbd className="hidden md:inline-flex items-center px-1.5 py-0.5 text-[10px] text-gray-400 bg-gray-100 rounded-md border border-gray-200 font-mono">
                  ⌘K
                </kbd>
              </button>

              {/* Dark mode toggle */}
              <button
                onClick={toggleTheme}
                className="p-2 rounded-xl hover:bg-gray-100 text-gray-500 transition-colors"
                title={theme === 'dark' ? 'מצב בהיר' : 'מצב כהה'}
              >
                {theme === 'dark' ? <Sun className="w-[18px] h-[18px]" /> : <Moon className="w-[18px] h-[18px]" />}
              </button>

              {/* Keyboard shortcuts */}
              <button
                onClick={() => setIsShortcutsOpen(true)}
                className="hidden md:flex p-2 rounded-xl hover:bg-gray-100 text-gray-500 transition-colors"
                title="קיצורי מקלדת (?)"
              >
                <Keyboard className="w-[18px] h-[18px]" />
              </button>

              {/* Notifications */}
              <div className="relative">
                <button
                  onClick={() => setIsNotificationsOpen(!isNotificationsOpen)}
                  className="relative p-2 rounded-xl hover:bg-gray-100 transition-colors"
                >
                  <Bell className="w-[18px] h-[18px] text-gray-500" />
                  {unreadCount > 0 && (
                    <span className="absolute top-1 left-1 min-w-[16px] h-4 flex items-center justify-center px-1 text-[10px] font-bold text-white bg-red-500 rounded-full">
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
        <main className="p-4 lg:p-8 max-w-[1600px]">
          <Outlet />
        </main>
      </div>

      {/* Search Command Palette */}
      <SearchCommand isOpen={isSearchOpen} onClose={() => setIsSearchOpen(false)} />

      {/* Keyboard Shortcuts Modal */}
      {isShortcutsOpen && (
        <>
          <div
            className="fixed inset-0 z-[60] bg-gray-900/40 backdrop-blur-sm animate-fade-in"
            onClick={() => setIsShortcutsOpen(false)}
          />
          <div className="fixed inset-0 z-[61] flex items-center justify-center p-4">
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-modal w-full max-w-md animate-slide-up" dir="rtl">
              <div className="flex items-center justify-between p-5 border-b border-gray-100">
                <h3 className="text-lg font-bold text-gray-900">קיצורי מקלדת</h3>
                <button
                  onClick={() => setIsShortcutsOpen(false)}
                  className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-5 space-y-3">
                {[
                  { keys: 'Ctrl + K', desc: 'חיפוש מהיר' },
                  { keys: '?', desc: 'קיצורי מקלדת (חלון זה)' },
                  { keys: 'Escape', desc: 'סגירת חלון / תפריט' },
                ].map((shortcut) => (
                  <div key={shortcut.keys} className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">{shortcut.desc}</span>
                    <kbd className="px-2.5 py-1 text-xs font-mono text-gray-500 bg-gray-100 rounded-lg border border-gray-200">
                      {shortcut.keys}
                    </kbd>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
