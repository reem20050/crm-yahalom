import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  Users,
  Building2,
  Calendar,
  PartyPopper,
  AlertCircle,
  TrendingUp,
  TrendingDown,
  Clock,
  FileWarning,
  Shield,
  MapPin,
  AlertTriangle,
  Phone,
  ArrowLeftRight,
  CheckCircle,
  Package,
} from 'lucide-react';
import { dashboardApi } from '../services/api';
import { usePermissions } from '../hooks/usePermissions';
import {
  LineChart,
  Line,
  AreaChart,
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

  const { data: trendsData } = useQuery({
    queryKey: ['dashboard-trends'],
    queryFn: () => dashboardApi.getTrends().then((res) => res.data),
    enabled: !isEmployee && viewMode === 'business',
  });

  const loading = isEmployee ? empLoading : (viewMode === 'business' ? isLoading : opsLoading);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary-600 border-t-transparent"></div>
      </div>
    );
  }

  // Employee view - no toggle needed
  if (isEmployee) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">דשבורד</h1>
          <p className="text-sm text-gray-500 mt-0.5">ברוך הבא למערכת צוות יהלום</p>
        </div>
        <EmployeeView data={empData} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">דשבורד</h1>
          <p className="text-sm text-gray-500 mt-0.5">ברוך הבא למערכת צוות יהלום</p>
        </div>
        {/* View Toggle */}
        <div className="flex bg-gray-100/80 rounded-xl p-1 gap-0.5">
          <button
            onClick={() => setViewMode('operations')}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
              viewMode === 'operations'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <Shield className="w-4 h-4" />
            תפעולי
          </button>
          <button
            onClick={() => setViewMode('business')}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
              viewMode === 'business'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <TrendingUp className="w-4 h-4" />
            עסקי
          </button>
        </div>
      </div>

      {viewMode === 'operations' ? (
        <OperationsView data={opsData} />
      ) : (
        <BusinessView data={data} trends={trendsData} />
      )}
    </div>
  );
}

/* ======== EMPLOYEE VIEW ======== */
function EmployeeView({ data }: { data: any }) {
  const myShifts = data?.myShiftsToday || [];
  const myEvents = data?.myUpcomingEvents || [];
  const myRecent = data?.myRecentShifts || [];
  const myEquipment = data?.myEquipment || [];

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
        <div className="stat-card">
          <div className="flex items-center justify-between">
            <div>
              <p className="stat-card-value">{myShifts.length}</p>
              <p className="stat-card-label">משמרות היום</p>
            </div>
            <div className="w-11 h-11 rounded-xl bg-sky-50 flex items-center justify-center">
              <Shield className="w-5 h-5 text-sky-600" />
            </div>
          </div>
        </div>
        <div className="stat-card">
          <div className="flex items-center justify-between">
            <div>
              <p className="stat-card-value">{myEvents.length}</p>
              <p className="stat-card-label">אירועים ב-7 ימים</p>
            </div>
            <div className="w-11 h-11 rounded-xl bg-amber-50 flex items-center justify-center">
              <PartyPopper className="w-5 h-5 text-amber-600" />
            </div>
          </div>
        </div>
        <div className="stat-card">
          <div className="flex items-center justify-between">
            <div>
              <p className="stat-card-value">{myEquipment.length}</p>
              <p className="stat-card-label">פריטי ציוד</p>
            </div>
            <div className="w-11 h-11 rounded-xl bg-violet-50 flex items-center justify-center">
              <Package className="w-5 h-5 text-violet-600" />
            </div>
          </div>
        </div>
        <div className="stat-card">
          <div className="flex items-center justify-between">
            <div>
              <p className="stat-card-value">{myRecent.length}</p>
              <p className="stat-card-label">משמרות אחרונות</p>
            </div>
            <div className="w-11 h-11 rounded-xl bg-emerald-50 flex items-center justify-center">
              <Clock className="w-5 h-5 text-emerald-600" />
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* My Shifts Today */}
        <div className="card">
          <h3 className="text-base font-semibold text-gray-900 mb-4 flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-sky-50 flex items-center justify-center">
              <Shield className="w-4 h-4 text-sky-600" />
            </div>
            המשמרות שלי היום
          </h3>
          {myShifts.length > 0 ? (
            <div className="space-y-2.5">
              {myShifts.map((shift: any) => (
                <div
                  key={shift.id}
                  className="p-3.5 rounded-xl bg-gray-50/80 border border-gray-100"
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
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-10">
              <Shield className="w-8 h-8 text-gray-200 mx-auto mb-2" />
              <p className="text-sm text-gray-400">אין משמרות היום</p>
            </div>
          )}
        </div>

        {/* My Upcoming Events */}
        <div className="card">
          <h3 className="text-base font-semibold text-gray-900 mb-4 flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center">
              <PartyPopper className="w-4 h-4 text-amber-600" />
            </div>
            אירועים קרובים שלי
          </h3>
          {myEvents.length > 0 ? (
            <div className="space-y-2.5">
              {myEvents.map((event: any) => (
                <div
                  key={event.id}
                  className="p-3.5 rounded-xl bg-gray-50/80 border border-gray-100"
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
              <PartyPopper className="w-8 h-8 text-gray-200 mx-auto mb-2" />
              <p className="text-sm text-gray-400">אין אירועים קרובים</p>
            </div>
          )}
        </div>

        {/* My Equipment */}
        {myEquipment.length > 0 && (
          <div className="card">
            <h3 className="text-base font-semibold text-gray-900 mb-4 flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-violet-50 flex items-center justify-center">
                <Package className="w-4 h-4 text-violet-600" />
              </div>
              הציוד שלי
            </h3>
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
          <h3 className="text-base font-semibold text-gray-900 mb-4 flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center">
              <Clock className="w-4 h-4 text-emerald-600" />
            </div>
            היסטוריית משמרות אחרונות
          </h3>
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
              <Clock className="w-8 h-8 text-gray-200 mx-auto mb-2" />
              <p className="text-sm text-gray-400">אין היסטוריה</p>
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
      bgColor: 'bg-sky-50',
    },
    {
      name: 'אתרים מכוסים',
      value: data?.sites_with_coverage || 0,
      icon: MapPin,
      iconColor: 'text-emerald-600',
      bgColor: 'bg-emerald-50',
    },
    {
      name: 'אירועי אבטחה פתוחים',
      value: data?.open_incidents?.count || 0,
      icon: AlertTriangle,
      iconColor: data?.open_incidents?.critical > 0 ? 'text-red-600' : 'text-red-500',
      bgColor: data?.open_incidents?.critical > 0 ? 'bg-red-100' : 'bg-red-50',
      href: '/incidents',
    },
    {
      name: 'רישיונות שפגים',
      value: data?.expiring_licenses?.length || 0,
      icon: FileWarning,
      iconColor: 'text-amber-600',
      bgColor: 'bg-amber-50',
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
              className="stat-card hover:shadow-elevated transition-all duration-200"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="stat-card-value">{stat.value}</p>
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
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center gap-3 animate-fade-in">
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
          <h3 className="text-base font-semibold text-gray-900 mb-4 flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-red-50 flex items-center justify-center">
              <AlertCircle className="w-4 h-4 text-red-500" />
            </div>
            מאבטחים שלא עשו צ'ק-אין
          </h3>
          {data?.guards_not_checked_in?.length > 0 ? (
            <div className="space-y-2.5">
              {data.guards_not_checked_in.map((guard: any) => (
                <div
                  key={guard.id}
                  className="p-3.5 rounded-xl bg-gray-50/80 border border-gray-100 flex items-center justify-between"
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
          <h3 className="text-base font-semibold text-gray-900 mb-4 flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center">
              <MapPin className="w-4 h-4 text-amber-600" />
            </div>
            אתרים ללא כיסוי
          </h3>
          {data?.sites_without_coverage?.length > 0 ? (
            <div className="space-y-2.5">
              {data.sites_without_coverage.map((site: any) => (
                <div
                  key={site.id}
                  className="p-3.5 rounded-xl bg-gray-50/80 border border-gray-100"
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
          <h3 className="text-base font-semibold text-gray-900 mb-4 flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-sky-50 flex items-center justify-center">
              <ArrowLeftRight className="w-4 h-4 text-sky-600" />
            </div>
            החלפות משמרות בשעתיים הקרובות
          </h3>
          {data?.upcoming_shift_changes?.length > 0 ? (
            <div className="space-y-2.5">
              {data.upcoming_shift_changes.map((shift: any) => (
                <div
                  key={shift.id}
                  className="p-3.5 rounded-xl bg-gray-50/80 border border-gray-100 flex items-center justify-between"
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
              <ArrowLeftRight className="w-8 h-8 text-gray-200 mx-auto mb-2" />
              <p className="text-sm text-gray-400">אין החלפות קרובות</p>
            </div>
          )}
        </div>

        {/* Expiring Licenses */}
        <div className="card">
          <h3 className="text-base font-semibold text-gray-900 mb-4 flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center">
              <FileWarning className="w-4 h-4 text-amber-600" />
            </div>
            רישיונות והסמכות שפגים ב-7 ימים
          </h3>
          {data?.expiring_licenses?.length > 0 ? (
            <div className="space-y-2.5">
              {data.expiring_licenses.map((cert: any) => (
                <div
                  key={cert.id}
                  className="p-3.5 rounded-xl bg-gray-50/80 border border-gray-100"
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
            <h3 className="text-base font-semibold text-gray-900 mb-4 flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-red-50 flex items-center justify-center">
                <AlertTriangle className="w-4 h-4 text-red-500" />
              </div>
              אירועי אבטחה היום
            </h3>
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

/* ======== SPARKLINE MINI CHART ======== */
function Sparkline({ data, color }: { data: { value: number }[]; color: string }) {
  if (!data || data.length === 0) return null;
  return (
    <div className="w-16 h-8">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 2, right: 0, left: 0, bottom: 2 }}>
          <defs>
            <linearGradient id={`spark-${color.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.3} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <Area
            type="monotone"
            dataKey="value"
            stroke={color}
            strokeWidth={1.5}
            fill={`url(#spark-${color.replace('#', '')})`}
            dot={false}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

function ChangeIndicator({ change }: { change: number | undefined }) {
  if (change === undefined || change === null) return null;
  const isPositive = change >= 0;
  return (
    <span className={`flex items-center gap-0.5 text-xs font-medium ${
      isPositive ? 'text-emerald-600' : 'text-red-500'
    }`}>
      {isPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
      {Math.abs(change)}%
    </span>
  );
}

/* ======== BUSINESS VIEW ======== */
function BusinessView({ data, trends }: { data: any; trends: any }) {
  const stats = [
    {
      name: 'לידים חדשים',
      value: data?.leads?.new_leads || 0,
      icon: Users,
      iconColor: 'text-sky-600',
      bgColor: 'bg-sky-50',
      href: '/leads?status=new',
      trendKey: 'leads',
      sparkColor: '#0ea5e9',
    },
    {
      name: 'לקוחות פעילים',
      value: data?.customers?.active_customers || 0,
      icon: Building2,
      iconColor: 'text-emerald-600',
      bgColor: 'bg-emerald-50',
      href: '/customers',
      trendKey: 'revenue',
      sparkColor: '#22c55e',
    },
    {
      name: 'משמרות היום',
      value: data?.shiftsToday?.total || 0,
      icon: Calendar,
      iconColor: 'text-violet-600',
      bgColor: 'bg-violet-50',
      href: '/shifts',
      trendKey: 'shifts',
      sparkColor: '#8b5cf6',
    },
    {
      name: 'אירועים השבוע',
      value: data?.upcomingEvents?.length || 0,
      icon: PartyPopper,
      iconColor: 'text-amber-600',
      bgColor: 'bg-amber-50',
      href: '/events',
      trendKey: 'incidents',
      sparkColor: '#f59e0b',
    },
  ];

  return (
    <>
      {/* Stats with sparklines */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
        {stats.map((stat) => {
          const trend = trends?.[stat.trendKey];
          return (
            <Link
              key={stat.name}
              to={stat.href}
              className="stat-card hover:shadow-elevated transition-all duration-200"
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="stat-card-value">{stat.value}</p>
                    <ChangeIndicator change={trend?.change} />
                  </div>
                  <p className="stat-card-label">{stat.name}</p>
                </div>
                <div className="flex flex-col items-end gap-1.5">
                  <div className={`w-11 h-11 rounded-xl ${stat.bgColor} flex items-center justify-center`}>
                    <stat.icon className={`w-5 h-5 ${stat.iconColor}`} />
                  </div>
                  <Sparkline data={trend?.data} color={stat.sparkColor} />
                </div>
              </div>
            </Link>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Revenue chart */}
        <div className="card">
          <h3 className="text-base font-semibold text-gray-900 mb-4 flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-primary-50 flex items-center justify-center">
              <TrendingUp className="w-4 h-4 text-primary-600" />
            </div>
            הכנסות - 6 חודשים אחרונים
          </h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data?.monthlyRevenue || []}>
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
                <Line
                  type="monotone"
                  dataKey="revenue"
                  stroke="#0070cc"
                  strokeWidth={2.5}
                  dot={{ r: 4, fill: '#0070cc', strokeWidth: 2, stroke: '#fff' }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Upcoming events */}
        <div className="card">
          <h3 className="text-base font-semibold text-gray-900 mb-4 flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center">
              <PartyPopper className="w-4 h-4 text-amber-600" />
            </div>
            אירועים קרובים
          </h3>
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
              <PartyPopper className="w-8 h-8 text-gray-200 mx-auto mb-2" />
              <p className="text-sm text-gray-400">אין אירועים קרובים</p>
            </div>
          )}
        </div>

        {/* Unassigned shifts */}
        <div className="card">
          <h3 className="text-base font-semibold text-gray-900 mb-4 flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-red-50 flex items-center justify-center">
              <AlertCircle className="w-4 h-4 text-red-500" />
            </div>
            משמרות לא מאוישות היום
          </h3>
          {data?.unassignedShifts?.length > 0 ? (
            <div className="space-y-2.5">
              {data.unassignedShifts.map((shift: any) => (
                <div
                  key={shift.id}
                  className="p-3.5 rounded-xl bg-gray-50/80 border border-gray-100"
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
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-semibold text-gray-900 flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center">
                <FileWarning className="w-4 h-4 text-amber-600" />
              </div>
              חשבוניות באיחור
            </h3>
            <Link to="/invoices?status=overdue" className="text-xs text-primary-600 hover:text-primary-700 font-medium">
              הצג הכל ←
            </Link>
          </div>
          {data?.overdueInvoices?.length > 0 ? (
            <div className="space-y-2.5">
              {data.overdueInvoices.map((invoice: any) => (
                <Link
                  key={invoice.id}
                  to={`/invoices`}
                  className="block p-3.5 rounded-xl bg-gray-50/80 border border-gray-100 hover:bg-gray-50 hover:border-gray-200 transition-all"
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
                </Link>
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
            <h3 className="text-base font-semibold text-gray-900 mb-4 flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-sky-50 flex items-center justify-center">
                <Clock className="w-4 h-4 text-sky-600" />
              </div>
              חוזים לחידוש בקרוב
            </h3>
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
