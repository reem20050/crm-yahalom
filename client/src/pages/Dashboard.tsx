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
} from 'lucide-react';
import { dashboardApi } from '../services/api';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

export default function Dashboard() {
  const { data, isLoading } = useQuery({
    queryKey: ['dashboard'],
    queryFn: () => dashboardApi.get().then((res) => res.data),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary-500 border-t-transparent"></div>
      </div>
    );
  }

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
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">דשבורד</h1>
        <p className="text-gray-500">ברוך הבא למערכת צוות יהלום</p>
      </div>

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
              {data.upcomingEvents.map((event: {
                id: string;
                event_name: string;
                event_date: string;
                start_time: string;
                company_name: string;
                assigned_count: number;
                required_guards: number;
              }) => (
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
              {data.unassignedShifts.map((shift: {
                id: string;
                company_name: string;
                site_name: string;
                start_time: string;
                end_time: string;
              }) => (
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
              ✓ כל המשמרות מאוישות
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
              {data.overdueInvoices.map((invoice: {
                id: string;
                company_name: string;
                invoice_number: string;
                total_amount: number;
                days_overdue: number;
              }) => (
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
              ✓ אין חשבוניות באיחור
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
              {data.contractsExpiring.map((contract: {
                id: string;
                company_name: string;
                end_date: string;
                monthly_value: number;
                customer_id: string;
              }) => (
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
    </div>
  );
}
