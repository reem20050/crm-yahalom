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
  Clock,
  FileWarning,
  Shield,
  MapPin,
  AlertTriangle,
  Phone,
  ArrowLeftRight,
  CheckCircle,
  Package,
  Crosshair,
} from 'lucide-react';
import { dashboardApi } from '../services/api';
import { usePermissions } from '../hooks/usePermissions';
import {
  LineChart,
  Line,
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

  const loading = isEmployee ? empLoading : (viewMode === 'business' ? isLoading : opsLoading);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary-500 border-t-transparent"></div>
      </div>
    );
  }

  // Employee view - no toggle needed
  if (isEmployee) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">דשבורד</h1>
          <p className="text-gray-500">ברוך הבא למערכת צוות יהלום</p>
        </div>
        <EmployeeView data={empData} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">דשבורד</h1>
          <p className="text-gray-500">ברוך הבא למערכת צוות יהלום</p>
        </div>
        {/* View Toggle */}
        <div className="flex bg-gray-100 rounded-lg p-1">
          <button
            onClick={() => setViewMode('operations')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              viewMode === 'operations'
                ? 'bg-primary-600 text-white shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <Shield className="w-4 h-4 inline-block ml-1" />
            תפעולי
          </button>
          <button
            onClick={() => setViewMode('business')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              viewMode === 'business'
                ? 'bg-primary-600 text-white shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <TrendingUp className="w-4 h-4 inline-block ml-1" />
            עסקי
          </button>
        </div>
      </div>

      {viewMode === 'operations' ? (
        <OperationsView data={opsData} />
      ) : (
        <BusinessView data={data} />
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
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="stat-card">
          <div className="flex items-center justify-between">
            <div>
              <p className="stat-card-value">{myShifts.length}</p>
              <p className="stat-card-label">משמרות היום</p>
            </div>
            <div className="p-3 rounded-lg bg-blue-500">
              <Shield className="w-6 h-6 text-white" />
            </div>
          </div>
        </div>
        <div className="stat-card">
          <div className="flex items-center justify-between">
            <div>
              <p className="stat-card-value">{myEvents.length}</p>
              <p className="stat-card-label">אירועים ב-7 ימים</p>
            </div>
            <div className="p-3 rounded-lg bg-orange-500">
              <PartyPopper className="w-6 h-6 text-white" />
            </div>
          </div>
        </div>
        <div className="stat-card">
          <div className="flex items-center justify-between">
            <div>
              <p className="stat-card-value">{myEquipment.length}</p>
              <p className="stat-card-label">פריטי ציוד</p>
            </div>
            <div className="p-3 rounded-lg bg-purple-500">
              <Package className="w-6 h-6 text-white" />
            </div>
          </div>
        </div>
        <div className="stat-card">
          <div className="flex items-center justify-between">
            <div>
              <p className="stat-card-value">{myRecent.length}</p>
              <p className="stat-card-label">משמרות אחרונות</p>
            </div>
            <div className="p-3 rounded-lg bg-green-500">
              <Clock className="w-6 h-6 text-white" />
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* My Shifts Today */}
        <div className="card">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Shield className="w-5 h-5 text-blue-500" />
            המשמרות שלי היום
          </h3>
          {myShifts.length > 0 ? (
            <div className="space-y-3">
              {myShifts.map((shift: any) => (
                <div
                  key={shift.id}
                  className="p-3 rounded-lg bg-blue-50 border border-blue-100"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-gray-900">
                        {shift.site_name || shift.company_name}
                      </p>
                      <p className="text-sm text-gray-500">
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
            <p className="text-gray-500 text-center py-8">אין משמרות היום</p>
          )}
        </div>

        {/* My Upcoming Events */}
        <div className="card">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <PartyPopper className="w-5 h-5 text-orange-500" />
            אירועים קרובים שלי
          </h3>
          {myEvents.length > 0 ? (
            <div className="space-y-3">
              {myEvents.map((event: any) => (
                <div
                  key={event.id}
                  className="p-3 rounded-lg bg-orange-50 border border-orange-100"
                >
                  <p className="font-medium text-gray-900">{event.event_name}</p>
                  <p className="text-sm text-gray-500">
                    {event.event_date} | {event.start_time} | {event.location || event.company_name}
                  </p>
                  {event.role && (
                    <p className="text-xs text-orange-600 mt-1">תפקיד: {event.role}</p>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 text-center py-8">אין אירועים קרובים</p>
          )}
        </div>

        {/* My Equipment */}
        {myEquipment.length > 0 && (
          <div className="card">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Package className="w-5 h-5 text-purple-500" />
              הציוד שלי
            </h3>
            <div className="space-y-2">
              {myEquipment.map((item: any, index: number) => (
                <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                  <div className="flex items-center gap-2">
                    <Package className="w-4 h-4 text-gray-400" />
                    <span className="font-medium text-sm">{item.item_name}</span>
                    <span className="text-xs text-gray-500">{item.item_type}</span>
                  </div>
                  {item.serial_number && (
                    <span className="text-xs text-gray-400 dir-ltr">{item.serial_number}</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Recent Shifts */}
        <div className="card">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Clock className="w-5 h-5 text-green-500" />
            היסטוריית משמרות אחרונות
          </h3>
          {myRecent.length > 0 ? (
            <div className="space-y-2">
              {myRecent.map((shift: any, index: number) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-2 bg-gray-50 rounded text-sm"
                >
                  <div>
                    <span className="font-medium">{shift.site_name || shift.company_name}</span>
                    <span className="text-gray-400 mx-2">|</span>
                    <span className="text-gray-500">{shift.date}</span>
                  </div>
                  <span className="text-gray-500">
                    {shift.start_time} - {shift.end_time}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 text-center py-8">אין היסטוריה</p>
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
      color: 'bg-blue-500',
    },
    {
      name: 'אתרים מכוסים',
      value: data?.sites_with_coverage || 0,
      icon: MapPin,
      color: 'bg-green-500',
    },
    {
      name: 'אירועי אבטחה פתוחים',
      value: data?.open_incidents?.count || 0,
      icon: AlertTriangle,
      color: data?.open_incidents?.critical > 0 ? 'bg-red-600' : 'bg-red-500',
      href: '/incidents',
    },
    {
      name: 'רישיונות שפגים',
      value: data?.expiring_licenses?.length || 0,
      icon: FileWarning,
      color: 'bg-yellow-500',
    },
  ];

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat) => {
          const Wrapper = stat.href ? Link : 'div';
          const wrapperProps = stat.href ? { to: stat.href } : {};
          return (
            <Wrapper
              key={stat.name}
              {...(wrapperProps as any)}
              className="stat-card hover:shadow-md transition-shadow"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="stat-card-value">{stat.value}</p>
                  <p className="stat-card-label">{stat.name}</p>
                </div>
                <div className={`p-3 rounded-lg ${stat.color}`}>
                  <stat.icon className="w-6 h-6 text-white" />
                </div>
              </div>
            </Wrapper>
          );
        })}
      </div>

      {/* Critical alerts row */}
      {data?.open_incidents?.critical > 0 && (
        <div className="bg-red-100 border border-red-300 rounded-lg p-4 flex items-center gap-3">
          <AlertTriangle className="w-6 h-6 text-red-600 flex-shrink-0" />
          <div>
            <p className="font-bold text-red-800">
              {data.open_incidents.critical} אירועי אבטחה קריטיים פתוחים!
            </p>
            <Link to="/incidents?severity=critical" className="text-red-700 underline text-sm">
              צפה באירועים
            </Link>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Guards Not Checked In */}
        <div className="card">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-red-500" />
            מאבטחים שלא עשו צ'ק-אין
          </h3>
          {data?.guards_not_checked_in?.length > 0 ? (
            <div className="space-y-3">
              {data.guards_not_checked_in.map((guard: any) => (
                <div
                  key={guard.id}
                  className="p-3 rounded-lg bg-red-50 border border-red-100 flex items-center justify-between"
                >
                  <div>
                    <p className="font-medium text-gray-900">
                      {guard.first_name} {guard.last_name}
                    </p>
                    <p className="text-sm text-gray-500">
                      {guard.site_name || guard.company_name} | {guard.start_time} - {guard.end_time}
                    </p>
                  </div>
                  {guard.phone && (
                    <a
                      href={`tel:${guard.phone}`}
                      className="p-2 rounded-lg bg-red-100 hover:bg-red-200 transition-colors"
                      title="התקשר"
                    >
                      <Phone className="w-4 h-4 text-red-600" />
                    </a>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-green-600 text-center py-8 font-medium">
              &#10003; כל המאבטחים עשו צ'ק-אין
            </p>
          )}
        </div>

        {/* Sites Without Coverage */}
        <div className="card">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <MapPin className="w-5 h-5 text-orange-500" />
            אתרים ללא כיסוי
          </h3>
          {data?.sites_without_coverage?.length > 0 ? (
            <div className="space-y-3">
              {data.sites_without_coverage.map((site: any) => (
                <div
                  key={site.id}
                  className="p-3 rounded-lg bg-orange-50 border border-orange-100"
                >
                  <p className="font-medium text-gray-900">{site.name}</p>
                  <p className="text-sm text-gray-500">
                    {site.company_name} | {site.start_time} - {site.end_time}
                  </p>
                  {site.address && (
                    <p className="text-xs text-gray-400 mt-1">{site.address}</p>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-green-600 text-center py-8 font-medium">
              &#10003; כל האתרים מכוסים
            </p>
          )}
        </div>

        {/* Upcoming Shift Changes */}
        <div className="card">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <ArrowLeftRight className="w-5 h-5 text-blue-500" />
            החלפות משמרות בשעתיים הקרובות
          </h3>
          {data?.upcoming_shift_changes?.length > 0 ? (
            <div className="space-y-3">
              {data.upcoming_shift_changes.map((shift: any) => (
                <div
                  key={shift.id}
                  className="p-3 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-between"
                >
                  <div>
                    <p className="font-medium text-gray-900">
                      {shift.site_name || shift.company_name}
                    </p>
                    <p className="text-sm text-gray-500">
                      {shift.start_time} - {shift.end_time} | {shift.assigned_count}/{shift.required_employees} משובצים
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
            <p className="text-gray-500 text-center py-8">אין החלפות קרובות</p>
          )}
        </div>

        {/* Expiring Licenses */}
        <div className="card">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <FileWarning className="w-5 h-5 text-yellow-500" />
            רישיונות והסמכות שפגים ב-7 ימים
          </h3>
          {data?.expiring_licenses?.length > 0 ? (
            <div className="space-y-3">
              {data.expiring_licenses.map((cert: any) => (
                <div
                  key={cert.id}
                  className="p-3 rounded-lg bg-yellow-50 border border-yellow-100"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-gray-900">{cert.employee_name}</p>
                      <p className="text-sm text-gray-500">{cert.cert_name}</p>
                    </div>
                    <span className={`text-sm font-bold ${
                      cert.days_left <= 3 ? 'text-red-600' : 'text-yellow-600'
                    }`}>
                      {cert.days_left} ימים
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-green-600 text-center py-8 font-medium">
              &#10003; אין רישיונות שפגים בקרוב
            </p>
          )}
        </div>

        {/* Today's Incidents */}
        {data?.today_incidents?.length > 0 && (
          <div className="card lg:col-span-2">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-red-500" />
              אירועי אבטחה היום
            </h3>
            <div className="space-y-3">
              {data.today_incidents.map((inc: any) => {
                const severityColors: Record<string, string> = {
                  critical: 'bg-red-100 border-red-300 text-red-800',
                  high: 'bg-orange-100 border-orange-300 text-orange-800',
                  medium: 'bg-yellow-100 border-yellow-300 text-yellow-800',
                  low: 'bg-green-100 border-green-300 text-green-800',
                };
                const severityLabels: Record<string, string> = {
                  critical: 'קריטי', high: 'גבוה', medium: 'בינוני', low: 'נמוך',
                };
                return (
                  <Link
                    key={inc.id}
                    to="/incidents"
                    className="block p-3 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className={`px-2 py-1 rounded text-xs font-bold border ${severityColors[inc.severity] || severityColors.low}`}>
                          {severityLabels[inc.severity] || inc.severity}
                        </span>
                        <div>
                          <p className="font-medium text-gray-900">{inc.title}</p>
                          <p className="text-sm text-gray-500">
                            {inc.site_name || inc.company_name} | {inc.incident_time}
                          </p>
                        </div>
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
      color: 'bg-blue-500',
      href: '/leads?status=new',
    },
    {
      name: 'לקוחות פעילים',
      value: data?.customers?.active_customers || 0,
      icon: Building2,
      color: 'bg-green-500',
      href: '/customers',
    },
    {
      name: 'משמרות היום',
      value: data?.shiftsToday?.total || 0,
      icon: Calendar,
      color: 'bg-purple-500',
      href: '/shifts',
    },
    {
      name: 'אירועים השבוע',
      value: data?.upcomingEvents?.length || 0,
      icon: PartyPopper,
      color: 'bg-orange-500',
      href: '/events',
    },
  ];

  return (
    <>
      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat) => (
          <Link
            key={stat.name}
            to={stat.href}
            className="stat-card hover:shadow-md transition-shadow"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="stat-card-value">{stat.value}</p>
                <p className="stat-card-label">{stat.name}</p>
              </div>
              <div className={`p-3 rounded-lg ${stat.color}`}>
                <stat.icon className="w-6 h-6 text-white" />
              </div>
            </div>
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Revenue chart */}
        <div className="card">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-primary-500" />
            הכנסות - 6 חודשים אחרונים
          </h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data?.monthlyRevenue || []}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip
                  formatter={(value: number) => [`₪${value?.toLocaleString()}`, 'הכנסות']}
                />
                <Line
                  type="monotone"
                  dataKey="revenue"
                  stroke="#0ea5e9"
                  strokeWidth={2}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Upcoming events */}
        <div className="card">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <PartyPopper className="w-5 h-5 text-orange-500" />
            אירועים קרובים
          </h3>
          {data?.upcomingEvents?.length > 0 ? (
            <div className="space-y-3">
              {data.upcomingEvents.map((event: any) => (
                <Link
                  key={event.id}
                  to={`/events/${event.id}`}
                  className="block p-3 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-gray-900">{event.event_name}</p>
                      <p className="text-sm text-gray-500">
                        {event.event_date} | {event.start_time} | {event.company_name}
                      </p>
                    </div>
                    <span
                      className={`badge ${
                        event.assigned_count >= event.required_guards
                          ? 'badge-success'
                          : 'badge-warning'
                      }`}
                    >
                      {event.assigned_count}/{event.required_guards} משובצים
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 text-center py-8">אין אירועים קרובים</p>
          )}
        </div>

        {/* Unassigned shifts */}
        <div className="card">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-red-500" />
            משמרות לא מאוישות היום
          </h3>
          {data?.unassignedShifts?.length > 0 ? (
            <div className="space-y-3">
              {data.unassignedShifts.map((shift: any) => (
                <div
                  key={shift.id}
                  className="p-3 rounded-lg bg-red-50 border border-red-100"
                >
                  <p className="font-medium text-gray-900">
                    {shift.company_name} - {shift.site_name}
                  </p>
                  <p className="text-sm text-gray-500">
                    {shift.start_time} - {shift.end_time}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-green-600 text-center py-8">
              &#10003; כל המשמרות מאוישות
            </p>
          )}
        </div>

        {/* Overdue invoices */}
        <div className="card">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <FileWarning className="w-5 h-5 text-yellow-500" />
            חשבוניות באיחור
          </h3>
          {data?.overdueInvoices?.length > 0 ? (
            <div className="space-y-3">
              {data.overdueInvoices.map((invoice: any) => (
                <div
                  key={invoice.id}
                  className="p-3 rounded-lg bg-yellow-50 border border-yellow-100"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-gray-900">
                        {invoice.company_name}
                      </p>
                      <p className="text-sm text-gray-500">
                        חשבונית #{invoice.invoice_number}
                      </p>
                    </div>
                    <div className="text-left">
                      <p className="font-bold text-gray-900">
                        ₪{invoice.total_amount?.toLocaleString()}
                      </p>
                      <p className="text-sm text-red-600">
                        {invoice.days_overdue} ימים באיחור
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-green-600 text-center py-8">
              &#10003; אין חשבוניות באיחור
            </p>
          )}
        </div>

        {/* Contracts expiring */}
        {data?.contractsExpiring?.length > 0 && (
          <div className="card lg:col-span-2">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Clock className="w-5 h-5 text-blue-500" />
              חוזים לחידוש בקרוב
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {data.contractsExpiring.map((contract: any) => (
                <Link
                  key={contract.id}
                  to={`/customers/${contract.customer_id}`}
                  className="p-3 rounded-lg bg-blue-50 border border-blue-100 hover:bg-blue-100 transition-colors"
                >
                  <p className="font-medium text-gray-900">{contract.company_name}</p>
                  <p className="text-sm text-gray-500">
                    תום חוזה: {contract.end_date} | ₪{contract.monthly_value?.toLocaleString()}/חודש
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
