import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
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
  ChevronLeft,
  Settings,
  Search,
  User,
  ShieldCheck,
  Shield,
  AlertTriangle,
  Crosshair,
  MapIcon,
  Navigation,
  CalendarPlus,
  Zap,
} from 'lucide-react';
import { useAuthStore } from '../stores/authStore';
import { usePermissions } from '../hooks/usePermissions';
import { dashboardApi } from '../services/api';
import { clsx } from 'clsx';
import SearchCommand from './SearchCommand';
import NotificationCenter from './NotificationCenter';
import PageTransition from './PageTransition';
import BottomNav from './BottomNav';
// LocationReporter disabled - GPS only on check-in/check-out
// import LocationReporter from './LocationReporter';

const navigationGroups = [
  {
    label: 'ראשי',
    items: [
      { name: 'דשבורד', href: '/', icon: LayoutDashboard, permission: 'page:dashboard' },
    ],
  },
  {
    label: 'מכירות',
    items: [
      { name: 'לידים', href: '/leads', icon: Users, permission: 'page:leads' },
      { name: 'לקוחות', href: '/customers', icon: Building2, permission: 'page:customers' },
    ],
  },
  {
    label: 'תפעול',
    items: [
      { name: 'עובדים', href: '/employees', icon: UserCircle, permission: 'page:employees' },
      { name: 'משמרות', href: '/shifts', icon: Calendar, permission: 'page:shifts' },
      { name: 'אירועים', href: '/events', icon: PartyPopper, permission: 'page:events' },
      { name: 'לוח שנה', href: '/calendar', icon: CalendarDays, permission: 'page:calendar' },
      { name: 'פאנל שומר', href: '/guard-panel', icon: Shield, permission: 'page:guard-panel' },
      { name: 'משמרות פתוחות', href: '/open-shifts', icon: CalendarPlus, permission: 'page:open-shifts' },
    ],
  },
  {
    label: 'אבטחה',
    items: [
      { name: 'אירועי אבטחה', href: '/incidents', icon: AlertTriangle, permission: 'page:incidents' },
      { name: 'מפת אתרים', href: '/sites-map', icon: MapIcon, permission: 'page:sites-map' },
      { name: 'מעקב שומרים', href: '/guard-tracking', icon: Navigation, permission: 'page:guard-tracking' },
      { name: 'נשק וציוד', href: '/weapons', icon: Crosshair, permission: 'page:weapons' },
    ],
  },
  {
    label: 'כספים',
    items: [
      { name: 'חשבוניות', href: '/invoices', icon: Receipt, permission: 'page:invoices' },
      { name: 'דוחות', href: '/reports', icon: BarChart3, permission: 'page:reports' },
    ],
  },
  {
    label: 'ניהול',
    items: [
      { name: 'משתמשים', href: '/users', icon: ShieldCheck, permission: 'page:users' },
      { name: 'אוטומציה', href: '/automation', icon: Zap, permission: 'page:settings' },
      { name: 'הגדרות', href: '/settings', icon: Settings, permission: 'page:settings' },
    ],
  },
];

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const { user, logout } = useAuthStore();
  const { can } = usePermissions();
  const navigate = useNavigate();
  const location = useLocation();

  const filteredGroups = navigationGroups
    .map(group => ({
      ...group,
      items: group.items.filter(item => can(item.permission)),
    }))
    .filter(group => group.items.length > 0);

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

  // Get current page title and group
  const currentPage = filteredGroups
    .flatMap(g => g.items)
    .find(item => item.href === '/' ? location.pathname === '/' : location.pathname.startsWith(item.href));

  const currentGroup = filteredGroups.find(g =>
    g.items.some(item => item.href === '/' ? location.pathname === '/' : location.pathname.startsWith(item.href))
  );

  return (
    <div className="min-h-screen bg-gray-50/80">
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
          'fixed inset-y-0 right-0 z-50 w-[272px] bg-gradient-to-b from-white via-white to-primary-50/30 border-l border-gray-100/50 transform transition-transform duration-300 ease-out lg:translate-x-0',
          sidebarOpen ? 'translate-x-0' : 'translate-x-full lg:translate-x-0'
        )}
      >
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="flex items-center justify-between h-16 px-6">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center">
                <ShieldCheck className="w-4.5 h-4.5 text-white" />
              </div>
              <div>
                <span className="text-lg font-bold text-gray-900 font-heading">צוות יהלום</span>
                <p className="text-[10px] text-gray-400 font-heading">CRM & Security</p>
              </div>
            </div>
            <button
              onClick={() => setSidebarOpen(false)}
              className="lg:hidden p-1.5 rounded-lg hover:bg-gray-100 text-gray-400"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-3 py-2 overflow-y-auto">
            {filteredGroups.map((group, groupIndex) => (
              <div key={group.label} className={groupIndex > 0 ? 'mt-2 pt-2 border-t border-gray-100/60' : ''}>
                <p className="px-4 mb-1.5 text-[11px] font-bold text-gray-400 uppercase tracking-widest font-heading">
                  {group.label}
                </p>
                <div className="space-y-0.5">
                  {group.items.map((item) => (
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
                </div>
              </div>
            ))}
          </nav>

          {/* User section */}
          <div className="border-t border-gray-100/60 p-3">
            <div className="relative">
              <button
                onClick={() => setUserMenuOpen(!userMenuOpen)}
                className="flex items-center gap-3 w-full p-2.5 rounded-xl hover:bg-gray-50 transition-colors"
              >
                <div className="relative w-9 h-9 rounded-full bg-gradient-to-br from-primary-400 to-secondary-500 flex items-center justify-center flex-shrink-0">
                  <span className="text-white font-semibold text-sm">
                    {user?.firstName?.[0]}
                    {user?.lastName?.[0]}
                  </span>
                  <span className="absolute -bottom-0.5 -left-0.5 w-3 h-3 bg-success-400 rounded-full border-2 border-white" />
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
                <div className="hidden sm:block">
                  <h2 className="text-lg font-semibold text-gray-900 font-heading">{currentPage.name}</h2>
                  {currentGroup && (
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="text-[11px] text-gray-400">{currentGroup.label}</span>
                      <ChevronLeft className="w-3 h-3 text-gray-300" />
                      <span className="text-[11px] text-primary-600 font-medium">{currentPage.name}</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Greeting */}
            <div className="hidden lg:flex items-center gap-2">
              <span className="text-sm text-gray-500">
                {new Date().getHours() < 12 ? 'בוקר טוב' : new Date().getHours() < 17 ? 'צהריים טובים' : 'ערב טוב'}, {user?.firstName} 👋
              </span>
            </div>

            {/* Right: actions */}
            <div className="flex items-center gap-1.5">
              {/* Search */}
              <button
                onClick={() => setIsSearchOpen(true)}
                className="flex items-center gap-3 px-4 py-2 rounded-xl bg-gray-100/80 border border-gray-200/50 hover:bg-gray-100 hover:border-gray-300 text-gray-500 transition-colors"
                title="חיפוש (Ctrl+K)"
              >
                <Search className="w-[18px] h-[18px]" />
                <span className="hidden md:inline text-sm">חיפוש</span>
                <kbd className="hidden md:inline-flex items-center px-1.5 py-0.5 text-[10px] text-gray-400 bg-gray-100 rounded-md border border-gray-200 font-mono">
                  ⌘K
                </kbd>
              </button>

              {/* Notifications */}
              <div className="relative">
                <button
                  onClick={() => setIsNotificationsOpen(!isNotificationsOpen)}
                  className="relative p-2 rounded-xl bg-gray-50 hover:bg-gray-100 transition-colors"
                >
                  <Bell className="w-[18px] h-[18px] text-gray-500" />
                  {unreadCount > 0 && (
                    <span className="absolute top-1 left-1 min-w-[16px] h-4 flex items-center justify-center px-1 text-[10px] font-bold text-white bg-gradient-to-r from-danger-500 to-danger-400 rounded-full">
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
        <main className="p-4 lg:p-8 pb-24 lg:pb-8">
          <PageTransition key={location.pathname}>
            <Outlet />
          </PageTransition>
        </main>
      </div>

      {/* Bottom Navigation - Mobile */}
      <BottomNav onMenuClick={() => setSidebarOpen(true)} />

      {/* Search Command Palette */}
      <SearchCommand isOpen={isSearchOpen} onClose={() => setIsSearchOpen(false)} />

      {/* GPS Location Reporter - disabled, GPS only on check-in/check-out */}
      {/* <LocationReporter /> */}
    </div>
  );
}
