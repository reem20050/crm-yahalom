import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  Users,
  Building2,
  Calendar,
  CalendarPlus,
  PartyPopper,
  AlertCircle,
  TrendingUp,
  Clock,
  FileWarning,
  Shield,
  MapPin,
  AlertTriangle,
  Phone,
  ArrowLeftRight,
  CheckCircle,
  Package,
  LogIn,
  LogOut,
  Loader2,
  UserPlus,
  Receipt,
} from 'lucide-react';
import { dashboardApi, shiftsApi } from '../services/api';
import { QuickLeadModal, QuickShiftModal, QuickInvoiceModal, QuickIncidentModal } from '../components/QuickActionModals';
import { SkeletonPulse, SkeletonStatCard, SkeletonCard } from '../components/Skeleton';
import { usePermissions } from '../hooks/usePermissions';
import { useAuthStore } from '../stores/authStore';
import {
  LineChart,
  Line,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

type ViewMode = 'business' | 'operations';

export default function Dashboard() {
  const [viewMode, setViewMode] = useState<ViewMode>('operations');
  const [quickModal, setQuickModal] = useState<string | null>(null);
  const { isEmployee } = usePermissions();

  // Employee dashboard - single query
  const { data: empData, isLoading: empLoading } = useQuery({
    queryKey: ['dashboard-employee'],
    queryFn: () => dashboardApi.get().then((res) => res.data),
    enabled: isEmployee,
    refetchInterval: 60000,
  });

  const { data, isLoading } = useQuery({
    queryKey: ['dashboard'],
    queryFn: () => dashboardApi.get().then((res) => res.data),
    enabled: !isEmployee && viewMode === 'business',
  });

  const { data: opsData, isLoading: opsLoading } = useQuery({
    queryKey: ['dashboard-operations'],
    queryFn: () => dashboardApi.getOperations().then((res) => res.data),
    enabled: !isEmployee && viewMode === 'operations',
    refetchInterval: 60000,
  });

  const loading = isEmployee ? empLoading : (viewMode === 'business' ? isLoading : opsLoading);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="space-y-2">
          <SkeletonPulse className="h-8 w-48" />
          <SkeletonPulse className="h-4 w-64" />
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => <SkeletonStatCard key={i} />)}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
      </div>
    );
  }

  // Employee view - no toggle needed
  if (isEmployee) {
    const hour = new Date().getHours();
    const user = useAuthStore.getState().user;
    const greeting = hour < 12 ? '☀️ בוקר טוב' : hour < 17 ? '🌤️ צהריים טובים' : '🌙 ערב טוב';
    return (
      <div className="space-y-6">
        <div>
          <h1 className="page-title">{greeting}, {user?.firstName || ''}</h1>
          <p className="page-subtitle">ברוך הבא למערכת צוות יהלום</p>
        </div>
        <EmployeeView data={empData} />
      </div>
    );
  }

  const hour = new Date().getHours();
  const user = useAuthStore.getState().user;
  const greeting = hour < 12 ? '☀️ בוקר טוב' : hour < 17 ? '🌤️ צהריים טובים' : '🌙 ערב טוב';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="page-title">{greeting}, {user?.firstName || ''}</h1>
          <div className="flex items-center gap-2 mt-0.5">
            <p className="page-subtitle">ברוך הבא למערכת צוות יהלום</p>
            <span className="flex items-center gap-1.5 text-[11px] text-gray-400">
              <span className="dot-live" />
              מתעדכן כל דקה
            </span>
          </div>
        </div>
        {/* View Toggle */}
        <div className="view-toggle">
          <button
            onClick={() => setViewMode('operations')}
            className={`view-toggle-btn ${
              viewMode === 'operations'
                ? 'view-toggle-btn-active'
                : 'view-toggle-btn-inactive'
            }`}
          >
            <Shield className="w-4 h-4" />
            <span className="hidden sm:inline">תפעולי</span>
          </button>
          <button
            onClick={() => setViewMode('business')}
            className={`view-toggle-btn ${
              viewMode === 'business'
                ? 'view-toggle-btn-active'
                : 'view-toggle-btn-inactive'
            }`}
          >
            <TrendingUp className="w-4 h-4" />
            <span className="hidden sm:inline">עסקי</span>
          </button>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <button onClick={() => setQuickModal('lead')} className="rounded-2xl p-4 flex items-center gap-3 text-right bg-gradient-to-br from-blue-500 to-blue-600 text-white border-0 hover:-translate-y-1 hover:shadow-lg transition-all duration-200">
          <div className="w-10 h-10 bg-white/20 text-white rounded-xl flex items-center justify-center flex-shrink-0">
            <UserPlus className="w-5 h-5" />
          </div>
          <div>
            <div className="font-semibold text-sm text-white truncate">ליד חדש</div>
            <div className="text-xs text-white/70">הוסף ליד מהיר</div>
          </div>
        </button>
        <button onClick={() => setQuickModal('shift')} className="rounded-2xl p-4 flex items-center gap-3 text-right bg-gradient-to-br from-violet-500 to-violet-600 text-white border-0 hover:-translate-y-1 hover:shadow-lg transition-all duration-200">
          <div className="w-10 h-10 bg-white/20 text-white rounded-xl flex items-center justify-center flex-shrink-0">
            <CalendarPlus className="w-5 h-5" />
          </div>
          <div>
            <div className="font-semibold text-sm text-white truncate">משמרת חדשה</div>
            <div className="text-xs text-white/70">צור משמרת מהירה</div>
          </div>
        </button>
        <button onClick={() => setQuickModal('invoice')} className="rounded-2xl p-4 flex items-center gap-3 text-right bg-gradient-to-br from-emerald-500 to-emerald-600 text-white border-0 hover:-translate-y-1 hover:shadow-lg transition-all duration-200">
          <div className="w-10 h-10 bg-white/20 text-white rounded-xl flex items-center justify-center flex-shrink-0">
            <Receipt className="w-5 h-5" />
          </div>
          <div>
            <div className="font-semibold text-sm text-white truncate">חשבונית חדשה</div>
            <div className="text-xs text-white/70">הפק חשבונית מהירה</div>
          </div>
        </button>
        <button onClick={() => setQuickModal('incident')} className="rounded-2xl p-4 flex items-center gap-3 text-right bg-gradient-to-br from-red-500 to-red-600 text-white border-0 hover:-translate-y-1 hover:shadow-lg transition-all duration-200">
          <div className="w-10 h-10 bg-white/20 text-white rounded-xl flex items-center justify-center flex-shrink-0">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div>
            <div className="font-semibold text-sm text-white truncate">דוח אירוע</div>
            <div className="text-xs text-white/70">דווח אירוע חדש</div>
          </div>
        </button>
      </div>

      {viewMode === 'operations' ? (
        <OperationsView data={opsData} />
      ) : (
        <BusinessView data={data} />
      )}

      {/* Quick Action Modals */}
      <QuickLeadModal isOpen={quickModal === 'lead'} onClose={() => setQuickModal(null)} />
      <QuickShiftModal isOpen={quickModal === 'shift'} onClose={() => setQuickModal(null)} />
      <QuickInvoiceModal isOpen={quickModal === 'invoice'} onClose={() => setQuickModal(null)} />
      <QuickIncidentModal isOpen={quickModal === 'incident'} onClose={() => setQuickModal(null)} />
    </div>
  );
}

/* ======== EMPLOYEE VIEW ======== */

function getLocation(): Promise<{ latitude: number; longitude: number } | null> {
  if (!navigator.geolocation) return Promise.resolve(null);
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  });
}

function EmployeeView({ data }: { data: any }) {
  const myShifts = data?.myShiftsToday || [];
  const myEvents = data?.myUpcomingEvents || [];
  const myRecent = data?.myRecentShifts || [];
  const myEquipment = data?.myEquipment || [];

  const queryClient = useQueryClient();
  const [locationWarning, setLocationWarning] = useState<string | null>(null);

  const checkInMutation = useMutation({
    mutationFn: async (assignmentId: string) => {
      const loc = await getLocation();
      const res = await shiftsApi.checkIn(assignmentId, loc || {});
      return res.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['dashboard-employee'] });
      queryClient.invalidateQueries({ queryKey: ['my-active-assignment'] });
      if (data?.location_warning) {
        setLocationWarning(data.location_warning);
        setTimeout(() => setLocationWarning(null), 8000);
      }
    },
  });

  const checkOutMutation = useMutation({
    mutationFn: async (assignmentId: string) => {
      const loc = await getLocation();
      const res = await shiftsApi.checkOut(assignmentId, loc || {});
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dashboard-employee'] });
      queryClient.invalidateQueries({ queryKey: ['my-active-assignment'] });
    },
  });

  return (
    <div className="space-y-6">
      {/* Location warning */}
      {locationWarning && (
        <div className="bg-amber-50 border border-amber-200 text-amber-800 px-4 py-3 rounded-xl text-sm flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          {locationWarning}
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
        <div className="stat-card">
          <div className="flex items-center justify-between">
            <div>
              <p className="stat-card-value font-heading">{myShifts.length}</p>
              <p className="stat-card-label">משמרות היום</p>
            </div>
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-sky-100 to-sky-50 flex items-center justify-center">
              <Shield className="w-5 h-5 text-sky-600" />
            </div>
          </div>
        </div>
        <div className="stat-card">
          <div className="flex items-center justify-between">
            <div>
              <p className="stat-card-value font-heading">{myEvents.length}</p>
              <p className="stat-card-label">אירועים ב-7 ימים</p>
            </div>
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-amber-100 to-amber-50 flex items-center justify-center">
              <PartyPopper className="w-5 h-5 text-amber-600" />
            </div>
          </div>
        </div>
        <div className="stat-card">
          <div className="flex items-center justify-between">
            <div>
              <p className="stat-card-value font-heading">{myEquipment.length}</p>
              <p className="stat-card-label">פריטי ציוד</p>
            </div>
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-violet-100 to-violet-50 flex items-center justify-center">
              <Package className="w-5 h-5 text-violet-600" />
            </div>
          </div>
        </div>
        <div className="stat-card">
          <div className="flex items-center justify-between">
            <div>
              <p className="stat-card-value font-heading">{myRecent.length}</p>
              <p className="stat-card-label">משמרות אחרונות</p>
            </div>
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-emerald-100 to-emerald-50 flex items-center justify-center">
              <Clock className="w-5 h-5 text-emerald-600" />
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* My Shifts Today */}
        <div className="card">
          <div className="section-header">
            <div className="section-header-icon bg-gradient-to-br from-sky-100 to-sky-50">
              <Shield className="w-4 h-4 text-sky-600" />
            </div>
            <h3 className="section-header-title">המשמרות שלי היום</h3>
          </div>
          {myShifts.length > 0 ? (
            <div className="space-y-2.5">
              {myShifts.map((shift: any) => {
                const isAssigned = shift.assignment_status === 'assigned';
                const isCheckedIn = shift.assignment_status === 'checked_in';
                const isCompleted = shift.assignment_status === 'completed';
                const isBusy = checkInMutation.isPending || checkOutMutation.isPending;

                return (
                  <div
                    key={shift.assignment_id || shift.id}
                    className="p-3.5 rounded-xl bg-gray-50/60 border border-gray-100 hover:bg-gray-50 hover:border-gray-200 transition-all"
                  >
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div>
                        <p className="font-medium text-sm text-gray-900">
                          {shift.site_name || shift.company_name}
                        </p>
                        <p className="text-xs text-gray-500 mt-0.5">
                          {shift.start_time} - {shift.end_time}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {shift.check_in_time ? (
                          <span className="badge badge-success flex items-center gap-1">
                            <CheckCircle className="w-3 h-3" />
                            צ'ק-אין {shift.check_in_time}
                          </span>
                        ) : (
                          <span className="badge badge-warning">ממתין לצ'ק-אין</span>
                        )}
                        {shift.check_out_time && (
                          <span className="badge badge-gray">
                            צ'ק-אאוט {shift.check_out_time}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Check-in / Check-out buttons */}
                    {shift.assignment_id && !isCompleted && (
                      <div className="mt-3 flex gap-2">
                        {isAssigned && (
                          <button
                            onClick={() => checkInMutation.mutate(shift.assignment_id)}
                            disabled={isBusy}
                            className="flex-1 btn-success text-sm py-2 flex items-center justify-center gap-1.5"
                          >
                            {checkInMutation.isPending ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <LogIn className="w-4 h-4" />
                            )}
                            צ'ק-אין
                          </button>
                        )}
                        {isCheckedIn && !shift.check_out_time && (
                          <button
                            onClick={() => checkOutMutation.mutate(shift.assignment_id)}
                            disabled={isBusy}
                            className="flex-1 btn-danger text-sm py-2 flex items-center justify-center gap-1.5"
                          >
                            {checkOutMutation.isPending ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <LogOut className="w-4 h-4" />
                            )}
                            צ'ק-אאוט
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-10">
              <div className="w-14 h-14 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-3">
                <Shield className="w-6 h-6 text-gray-400" />
              </div>
              <p className="text-sm text-gray-400 font-medium">אין משמרות היום</p>
            </div>
          )}
        </div>

        {/* My Upcoming Events */}
        <div className="card">
          <div className="section-header">
            <div className="section-header-icon bg-gradient-to-br from-amber-100 to-amber-50">
              <PartyPopper className="w-4 h-4 text-amber-600" />
            </div>
            <h3 className="section-header-title">אירועים קרובים שלי</h3>
          </div>
          {myEvents.length > 0 ? (
            <div className="space-y-2.5">
              {myEvents.map((event: any) => (
                <div
                  key={event.id}
                  className="p-3.5 rounded-xl bg-gray-50/60 border border-gray-100 hover:bg-gray-50 hover:border-gray-200 transition-all"
                >
                  <p className="font-medium text-sm text-gray-900">{event.event_name}</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {event.event_date} | {event.start_time} | {event.location || event.company_name}
                  </p>
                  {event.role && (
                    <p className="text-xs text-amber-600 mt-1.5 font-medium">תפקיד: {event.role}</p>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-10">
              <div className="w-14 h-14 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-3">
                <PartyPopper className="w-6 h-6 text-gray-400" />
              </div>
              <p className="text-sm text-gray-400 font-medium">אין אירועים קרובים</p>
            </div>
          )}
        </div>

        {/* My Equipment */}
        {myEquipment.length > 0 && (
          <div className="card">
            <div className="section-header">
              <div className="section-header-icon bg-gradient-to-br from-violet-100 to-violet-50">
                <Package className="w-4 h-4 text-violet-600" />
              </div>
              <h3 className="section-header-title">הציוד שלי</h3>
            </div>
            <div className="space-y-1.5">
              {myEquipment.map((item: any, index: number) => (
                <div key={index} className="flex items-center justify-between p-2.5 bg-gray-50/60 rounded-lg">
                  <div className="flex items-center gap-2.5">
                    <Package className="w-4 h-4 text-gray-400" />
                    <span className="font-medium text-sm text-gray-900">{item.item_name}</span>
                    <span className="text-xs text-gray-500">{item.item_type}</span>
                  </div>
                  {item.serial_number && (
                    <span className="text-xs text-gray-400 font-mono" dir="ltr">{item.serial_number}</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Recent Shifts */}
        <div className="card">
          <div className="section-header">
            <div className="section-header-icon bg-gradient-to-br from-emerald-100 to-emerald-50">
              <Clock className="w-4 h-4 text-emerald-600" />
            </div>
            <h3 className="section-header-title">היסטוריית משמרות אחרונות</h3>
          </div>
          {myRecent.length > 0 ? (
            <div className="space-y-1.5">
              {myRecent.map((shift: any, index: number) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-2.5 bg-gray-50/60 rounded-lg text-sm"
                >
                  <div>
                    <span className="font-medium text-gray-900">{shift.site_name || shift.company_name}</span>
                    <span className="text-gray-300 mx-2">·</span>
                    <span className="text-gray-500">{shift.date}</span>
                  </div>
                  <span className="text-gray-500 font-mono text-xs">
                    {shift.start_time} - {shift.end_time}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-10">
              <div className="w-14 h-14 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-3">
                <Clock className="w-6 h-6 text-gray-400" />
              </div>
              <p className="text-sm text-gray-400 font-medium">אין היסטוריה</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ======== OPERATIONS VIEW ======== */
function OperationsView({ data }: { data: any }) {
  const stats = [
    {
      name: 'מאבטחים בשטח',
      value: `${data?.guards_on_duty || 0}/${data?.guards_expected_today || 0}`,
      icon: Shield,
      iconColor: 'text-sky-600',
      bgColor: 'bg-gradient-to-br from-sky-100 to-sky-50',
    },
    {
      name: 'אתרים מכוסים',
      value: data?.sites_with_coverage || 0,
      icon: MapPin,
      iconColor: 'text-emerald-600',
      bgColor: 'bg-gradient-to-br from-emerald-100 to-emerald-50',
    },
    {
      name: 'אירועי אבטחה פתוחים',
      value: data?.open_incidents?.count || 0,
      icon: AlertTriangle,
      iconColor: data?.open_incidents?.critical > 0 ? 'text-red-600' : 'text-red-500',
      bgColor: data?.open_incidents?.critical > 0 ? 'bg-gradient-to-br from-red-200 to-red-100' : 'bg-gradient-to-br from-red-100 to-red-50',
      urgent: (data?.open_incidents?.critical || 0) > 0,
      href: '/incidents',
    },
    {
      name: 'רישיונות שפגים',
      value: data?.expiring_licenses?.length || 0,
      icon: FileWarning,
      iconColor: 'text-amber-600',
      bgColor: 'bg-gradient-to-br from-amber-100 to-amber-50',
    },
  ];

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
        {stats.map((stat) => {
          const Wrapper = stat.href ? Link : 'div';
          const wrapperProps = stat.href ? { to: stat.href } : {};
          return (
            <Wrapper
              key={stat.name}
              {...(wrapperProps as any)}
              className={`stat-card hover:shadow-elevated transition-all duration-200 ${
                stat.urgent ? 'ring-2 ring-red-200 bg-red-50/30' : ''
              }`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="stat-card-value font-heading">{stat.value}</p>
                  <p className="stat-card-label">{stat.name}</p>
                </div>
                <div className={`w-11 h-11 rounded-xl ${stat.bgColor} flex items-center justify-center`}>
                  <stat.icon className={`w-5 h-5 ${stat.iconColor}`} />
                </div>
              </div>
            </Wrapper>
          );
        })}
      </div>

      {/* Critical alerts row */}
      {data?.open_incidents?.critical > 0 && (
        <div className="bg-gradient-to-r from-danger-50 to-danger-100/50 border border-danger-200 ring-1 ring-danger-200/50 rounded-xl p-4 flex items-center gap-3 animate-fade-in">
          <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center flex-shrink-0">
            <AlertTriangle className="w-5 h-5 text-red-600" />
          </div>
          <div>
            <p className="font-semibold text-red-800 text-sm">
              {data.open_incidents.critical} אירועי אבטחה קריטיים פתוחים!
            </p>
            <Link to="/incidents?severity=critical" className="text-red-600 hover:text-red-700 text-sm font-medium hover:underline">
              צפה באירועים ←
            </Link>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Guards Not Checked In */}
        <div className="card">
          <div className="section-header">
            <div className="section-header-icon bg-gradient-to-br from-red-100 to-red-50">
              <AlertCircle className="w-4 h-4 text-red-500" />
            </div>
            <h3 className="section-header-title">מאבטחים שלא עשו צ'ק-אין</h3>
          </div>
          {data?.guards_not_checked_in?.length > 0 ? (
            <div className="space-y-2.5">
              {data.guards_not_checked_in.map((guard: any) => (
                <div
                  key={guard.id}
                  className="p-3.5 rounded-xl bg-gray-50/60 border border-gray-100 hover:bg-gray-50 hover:border-gray-200 transition-all flex items-center justify-between"
                >
                  <div>
                    <p className="font-medium text-sm text-gray-900">
                      {guard.first_name} {guard.last_name}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {guard.site_name || guard.company_name} · {guard.start_time} - {guard.end_time}
                    </p>
                  </div>
                  {guard.phone && (
                    <a
                      href={`tel:${guard.phone}`}
                      className="w-8 h-8 rounded-lg bg-red-50 hover:bg-red-100 flex items-center justify-center transition-colors"
                      title="התקשר"
                    >
                      <Phone className="w-3.5 h-3.5 text-red-600" />
                    </a>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-10">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center mx-auto mb-2">
                <CheckCircle className="w-5 h-5 text-emerald-500" />
              </div>
              <p className="text-sm text-emerald-600 font-medium">כל המאבטחים עשו צ'ק-אין</p>
            </div>
          )}
        </div>

        {/* Sites Without Coverage */}
        <div className="card">
          <div className="section-header">
            <div className="section-header-icon bg-gradient-to-br from-amber-100 to-amber-50">
              <MapPin className="w-4 h-4 text-amber-600" />
            </div>
            <h3 className="section-header-title">אתרים ללא כיסוי</h3>
          </div>
          {data?.sites_without_coverage?.length > 0 ? (
            <div className="space-y-2.5">
              {data.sites_without_coverage.map((site: any) => (
                <div
                  key={site.id}
                  className="p-3.5 rounded-xl bg-gray-50/60 border border-gray-100 hover:bg-gray-50 hover:border-gray-200 transition-all"
                >
                  <p className="font-medium text-sm text-gray-900">{site.name}</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {site.company_name} · {site.start_time} - {site.end_time}
                  </p>
                  {site.address && (
                    <p className="text-xs text-gray-400 mt-1">{site.address}</p>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-10">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center mx-auto mb-2">
                <CheckCircle className="w-5 h-5 text-emerald-500" />
              </div>
              <p className="text-sm text-emerald-600 font-medium">כל האתרים מכוסים</p>
            </div>
          )}
        </div>

        {/* Upcoming Shift Changes */}
        <div className="card">
          <div className="section-header">
            <div className="section-header-icon bg-gradient-to-br from-sky-100 to-sky-50">
              <ArrowLeftRight className="w-4 h-4 text-sky-600" />
            </div>
            <h3 className="section-header-title">החלפות משמרות בשעתיים הקרובות</h3>
          </div>
          {data?.upcoming_shift_changes?.length > 0 ? (
            <div className="space-y-2.5">
              {data.upcoming_shift_changes.map((shift: any) => (
                <div
                  key={shift.id}
                  className="p-3.5 rounded-xl bg-gray-50/60 border border-gray-100 hover:bg-gray-50 hover:border-gray-200 transition-all flex items-center justify-between"
                >
                  <div>
                    <p className="font-medium text-sm text-gray-900">
                      {shift.site_name || shift.company_name}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {shift.start_time} - {shift.end_time} · {shift.assigned_count}/{shift.required_employees} משובצים
                    </p>
                  </div>
                  <span
                    className={`badge ${
                      shift.change_type === 'starting' ? 'badge-success' : 'badge-warning'
                    }`}
                  >
                    {shift.change_type === 'starting' ? 'מתחילה' : 'מסתיימת'}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-10">
              <div className="w-14 h-14 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-3">
                <ArrowLeftRight className="w-6 h-6 text-gray-400" />
              </div>
              <p className="text-sm text-gray-400 font-medium">אין החלפות קרובות</p>
            </div>
          )}
        </div>

        {/* Expiring Licenses */}
        <div className="card">
          <div className="section-header">
            <div className="section-header-icon bg-gradient-to-br from-amber-100 to-amber-50">
              <FileWarning className="w-4 h-4 text-amber-600" />
            </div>
            <h3 className="section-header-title">רישיונות והסמכות שפגים ב-7 ימים</h3>
          </div>
          {data?.expiring_licenses?.length > 0 ? (
            <div className="space-y-2.5">
              {data.expiring_licenses.map((cert: any) => (
                <div
                  key={cert.id}
                  className="p-3.5 rounded-xl bg-gray-50/60 border border-gray-100 hover:bg-gray-50 hover:border-gray-200 transition-all"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-sm text-gray-900">{cert.employee_name}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{cert.cert_name}</p>
                    </div>
                    <span className={`text-xs font-bold px-2.5 py-1 rounded-lg ${
                      cert.days_left <= 3 ? 'bg-red-50 text-red-600' : 'bg-amber-50 text-amber-600'
                    }`}>
                      {cert.days_left} ימים
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-10">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center mx-auto mb-2">
                <CheckCircle className="w-5 h-5 text-emerald-500" />
              </div>
              <p className="text-sm text-emerald-600 font-medium">אין רישיונות שפגים בקרוב</p>
            </div>
          )}
        </div>

        {/* Today's Incidents */}
        {data?.today_incidents?.length > 0 && (
          <div className="card lg:col-span-2">
            <div className="section-header">
              <div className="section-header-icon bg-gradient-to-br from-red-100 to-red-50">
                <AlertTriangle className="w-4 h-4 text-red-500" />
              </div>
              <h3 className="section-header-title">אירועי אבטחה היום</h3>
            </div>
            <div className="space-y-2.5">
              {data.today_incidents.map((inc: any) => {
                const severityColors: Record<string, string> = {
                  critical: 'bg-red-50 text-red-700 border-red-200',
                  high: 'bg-orange-50 text-orange-700 border-orange-200',
                  medium: 'bg-amber-50 text-amber-700 border-amber-200',
                  low: 'bg-emerald-50 text-emerald-700 border-emerald-200',
                };
                const severityLabels: Record<string, string> = {
                  critical: 'קריטי', high: 'גבוה', medium: 'בינוני', low: 'נמוך',
                };
                return (
                  <Link
                    key={inc.id}
                    to="/incidents"
                    className="block p-3.5 rounded-xl bg-gray-50/80 border border-gray-100 hover:bg-gray-50 hover:border-gray-200 transition-all"
                  >
                    <div className="flex items-center gap-3">
                      <span className={`px-2.5 py-1 rounded-lg text-xs font-bold border ${severityColors[inc.severity] || severityColors.low}`}>
                        {severityLabels[inc.severity] || inc.severity}
                      </span>
                      <div>
                        <p className="font-medium text-sm text-gray-900">{inc.title}</p>
                        <p className="text-xs text-gray-500 mt-0.5">
                          {inc.site_name || inc.company_name} · {inc.incident_time}
                        </p>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ======== BUSINESS VIEW ======== */
function BusinessView({ data }: { data: any }) {
  const stats = [
    {
      name: 'לידים חדשים',
      value: data?.leads?.new_leads || 0,
      icon: Users,
      iconColor: 'text-sky-600',
      bgColor: 'bg-gradient-to-br from-sky-100 to-sky-50',
      href: '/leads?status=new',
    },
    {
      name: 'לקוחות פעילים',
      value: data?.customers?.active_customers || 0,
      icon: Building2,
      iconColor: 'text-emerald-600',
      bgColor: 'bg-gradient-to-br from-emerald-100 to-emerald-50',
      href: '/customers',
    },
    {
      name: 'משמרות היום',
      value: data?.shiftsToday?.total || 0,
      icon: Calendar,
      iconColor: 'text-violet-600',
      bgColor: 'bg-gradient-to-br from-violet-100 to-violet-50',
      href: '/shifts',
    },
    {
      name: 'אירועים השבוע',
      value: data?.upcomingEvents?.length || 0,
      icon: PartyPopper,
      iconColor: 'text-amber-600',
      bgColor: 'bg-gradient-to-br from-amber-100 to-amber-50',
      href: '/events',
    },
  ];

  return (
    <>
      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
        {stats.map((stat) => (
          <Link
            key={stat.name}
            to={stat.href}
            className="stat-card hover:shadow-elevated transition-all duration-200"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="stat-card-value font-heading">{stat.value}</p>
                <p className="stat-card-label">{stat.name}</p>
              </div>
              <div className={`w-11 h-11 rounded-xl ${stat.bgColor} flex items-center justify-center`}>
                <stat.icon className={`w-5 h-5 ${stat.iconColor}`} />
              </div>
            </div>
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Revenue chart */}
        <div className="card">
          <div className="section-header">
            <div className="section-header-icon bg-gradient-to-br from-primary-100 to-primary-50">
              <TrendingUp className="w-4 h-4 text-primary-600" />
            </div>
            <h3 className="section-header-title">הכנסות - 6 חודשים אחרונים</h3>
          </div>
          <div className="h-48 sm:h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data?.monthlyRevenue || []}>
                <defs>
                  <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.15}/>
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#94a3b8' }} />
                <YAxis tick={{ fontSize: 12, fill: '#94a3b8' }} />
                <Tooltip
                  formatter={(value: number) => [`₪${value?.toLocaleString()}`, 'הכנסות']}
                  contentStyle={{
                    borderRadius: '12px',
                    border: '1px solid #e2e8f0',
                    boxShadow: '0 4px 16px -2px rgba(0,0,0,0.08)',
                    fontSize: '13px',
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="revenue"
                  stroke="none"
                  fill="url(#revenueGradient)"
                />
                <Line
                  type="monotone"
                  dataKey="revenue"
                  stroke="#6366f1"
                  strokeWidth={2.5}
                  dot={{ r: 4, fill: '#6366f1', strokeWidth: 2, stroke: '#fff' }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Upcoming events */}
        <div className="card">
          <div className="section-header">
            <div className="section-header-icon bg-gradient-to-br from-amber-100 to-amber-50">
              <PartyPopper className="w-4 h-4 text-amber-600" />
            </div>
            <h3 className="section-header-title">אירועים קרובים</h3>
          </div>
          {data?.upcomingEvents?.length > 0 ? (
            <div className="space-y-2.5">
              {data.upcomingEvents.map((event: any) => (
                <Link
                  key={event.id}
                  to={`/events/${event.id}`}
                  className="block p-3.5 rounded-xl bg-gray-50/80 border border-gray-100 hover:bg-gray-50 hover:border-gray-200 transition-all"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-sm text-gray-900">{event.event_name}</p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {event.event_date} · {event.start_time} · {event.company_name}
                      </p>
                    </div>
                    <span
                      className={`badge ${
                        event.assigned_count >= event.required_guards
                          ? 'badge-success'
                          : 'badge-warning'
                      }`}
                    >
                      {event.assigned_count}/{event.required_guards}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="text-center py-10">
              <div className="w-14 h-14 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-3">
                <PartyPopper className="w-6 h-6 text-gray-400" />
              </div>
              <p className="text-sm text-gray-400 font-medium">אין אירועים קרובים</p>
            </div>
          )}
        </div>

        {/* Unassigned shifts */}
        <div className="card">
          <div className="section-header">
            <div className="section-header-icon bg-gradient-to-br from-red-100 to-red-50">
              <AlertCircle className="w-4 h-4 text-red-500" />
            </div>
            <h3 className="section-header-title">משמרות לא מאוישות היום</h3>
          </div>
          {data?.unassignedShifts?.length > 0 ? (
            <div className="space-y-2.5">
              {data.unassignedShifts.map((shift: any) => (
                <div
                  key={shift.id}
                  className="p-3.5 rounded-xl bg-gray-50/60 border border-gray-100 hover:bg-gray-50 hover:border-gray-200 transition-all"
                >
                  <p className="font-medium text-sm text-gray-900">
                    {shift.company_name} - {shift.site_name}
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {shift.start_time} - {shift.end_time}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-10">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center mx-auto mb-2">
                <CheckCircle className="w-5 h-5 text-emerald-500" />
              </div>
              <p className="text-sm text-emerald-600 font-medium">כל המשמרות מאוישות</p>
            </div>
          )}
        </div>

        {/* Overdue invoices */}
        <div className="card">
          <div className="section-header">
            <div className="section-header-icon bg-gradient-to-br from-amber-100 to-amber-50">
              <FileWarning className="w-4 h-4 text-amber-600" />
            </div>
            <h3 className="section-header-title">חשבוניות באיחור</h3>
          </div>
          {data?.overdueInvoices?.length > 0 ? (
            <div className="space-y-2.5">
              {data.overdueInvoices.map((invoice: any) => (
                <div
                  key={invoice.id}
                  className="p-3.5 rounded-xl bg-gray-50/60 border border-gray-100 hover:bg-gray-50 hover:border-gray-200 transition-all"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-sm text-gray-900">
                        {invoice.company_name}
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        חשבונית #{invoice.invoice_number}
                      </p>
                    </div>
                    <div className="text-left">
                      <p className="font-bold text-sm text-gray-900">
                        ₪{invoice.total_amount?.toLocaleString()}
                      </p>
                      <p className="text-xs text-red-500 font-medium">
                        {invoice.days_overdue} ימים באיחור
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-10">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center mx-auto mb-2">
                <CheckCircle className="w-5 h-5 text-emerald-500" />
              </div>
              <p className="text-sm text-emerald-600 font-medium">אין חשבוניות באיחור</p>
            </div>
          )}
        </div>

        {/* Contracts expiring */}
        {data?.contractsExpiring?.length > 0 && (
          <div className="card lg:col-span-2">
            <div className="section-header">
              <div className="section-header-icon bg-gradient-to-br from-sky-100 to-sky-50">
                <Clock className="w-4 h-4 text-sky-600" />
              </div>
              <h3 className="section-header-title">חוזים לחידוש בקרוב</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
              {data.contractsExpiring.map((contract: any) => (
                <Link
                  key={contract.id}
                  to={`/customers/${contract.customer_id}`}
                  className="p-3.5 rounded-xl bg-gray-50/80 border border-gray-100 hover:bg-gray-50 hover:border-gray-200 transition-all"
                >
                  <p className="font-medium text-sm text-gray-900">{contract.company_name}</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    תום חוזה: {contract.end_date} · ₪{contract.monthly_value?.toLocaleString()}/חודש
                  </p>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
