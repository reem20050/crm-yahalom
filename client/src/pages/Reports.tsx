import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  BarChart3,
  TrendingUp,
  Users,
  Building2,
  Calendar,
  DollarSign,
  Download,
  Printer,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { reportsApi } from '../services/api';

const COLORS = ['#0ea5e9', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6'];

type ReportTab = 'sales' | 'customers' | 'employees' | 'financial';

function exportToCSV(data: Record<string, unknown>[], headers: Record<string, string>, filename: string) {
  if (!data || data.length === 0) return;
  const headerKeys = Object.keys(headers);
  const headerLabels = Object.values(headers);
  const csvRows = [headerLabels.join(',')];
  for (const row of data) {
    const values = headerKeys.map((key) => {
      const val = row[key] ?? '';
      const escaped = String(val).replace(/"/g, '""');
      return `"${escaped}"`;
    });
    csvRows.push(values.join(','));
  }
  const csvContent = '\uFEFF' + csvRows.join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export default function Reports() {
  const [activeTab, setActiveTab] = useState<ReportTab>('sales');

  const { data: salesData } = useQuery({
    queryKey: ['reports', 'sales'],
    queryFn: () => reportsApi.sales().then((res) => res.data),
    enabled: activeTab === 'sales',
  });

  const { data: customersData } = useQuery({
    queryKey: ['reports', 'customers'],
    queryFn: () => reportsApi.customers().then((res) => res.data),
    enabled: activeTab === 'customers',
  });

  const { data: employeesData } = useQuery({
    queryKey: ['reports', 'employees'],
    queryFn: () => reportsApi.employees().then((res) => res.data),
    enabled: activeTab === 'employees',
  });

  const { data: financialData } = useQuery({
    queryKey: ['reports', 'financial'],
    queryFn: () => reportsApi.financial().then((res) => res.data),
    enabled: activeTab === 'financial',
  });

  const tabs = [
    { id: 'sales' as const, label: 'מכירות', icon: TrendingUp },
    { id: 'customers' as const, label: 'לקוחות', icon: Building2 },
    { id: 'employees' as const, label: 'עובדים', icon: Users },
    { id: 'financial' as const, label: 'כספים', icon: DollarSign },
  ];

  const handleExport = () => {
    switch (activeTab) {
      case 'sales':
        if (salesData?.leadsBySource) {
          exportToCSV(salesData.leadsBySource, { source: 'מקור', count: 'כמות' }, 'sales-by-source.csv');
        }
        break;
      case 'customers':
        if (customersData?.revenueByCustomer) {
          exportToCSV(customersData.revenueByCustomer, { company_name: 'חברה', total_revenue: 'הכנסות' }, 'customers-revenue.csv');
        }
        break;
      case 'employees':
        if (employeesData?.hoursBreakdown) {
          exportToCSV(employeesData.hoursBreakdown, { name: 'עובד', total_hours: 'שעות', days_worked: 'ימי עבודה', saturday_hours: 'שעות שבת' }, 'employees-hours.csv');
        }
        break;
      case 'financial':
        if (financialData?.revenueByCustomer) {
          exportToCSV(financialData.revenueByCustomer, { company_name: 'לקוח', paid: 'שולם', pending: 'ממתין' }, 'financial-revenue.csv');
        }
        break;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">דוחות</h1>
          <p className="text-gray-500">ניתוח נתונים וביצועים</p>
        </div>
        <div className="flex items-center gap-2 no-print">
          <button onClick={handleExport} className="btn-secondary flex items-center gap-2">
            <Download className="w-5 h-5" />
            ייצוא לאקסל
          </button>
          <button onClick={() => window.print()} className="btn-secondary flex items-center gap-2">
            <Printer className="w-5 h-5" />
            הדפס
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b">
        <nav className="flex gap-4">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-3 border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <tab.icon className="w-5 h-5" />
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Sales Report */}
      {activeTab === 'sales' && salesData && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="card">
            <h3 className="text-lg font-semibold mb-4">המרת לידים</h3>
            <div className="grid grid-cols-3 gap-4 mb-6">
              <div className="text-center">
                <p className="text-3xl font-bold text-gray-900">{salesData.conversionRate?.total_leads || 0}</p>
                <p className="text-sm text-gray-500">לידים</p>
              </div>
              <div className="text-center">
                <p className="text-3xl font-bold text-green-600">{salesData.conversionRate?.won || 0}</p>
                <p className="text-sm text-gray-500">נסגרו</p>
              </div>
              <div className="text-center">
                <p className="text-3xl font-bold text-primary-600">{salesData.conversionRate?.conversion_rate || 0}%</p>
                <p className="text-sm text-gray-500">אחוז המרה</p>
              </div>
            </div>
          </div>

          <div className="card">
            <h3 className="text-lg font-semibold mb-4">לידים לפי מקור</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={salesData.leadsBySource || []}
                    dataKey="count"
                    nameKey="source"
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    label
                  >
                    {(salesData.leadsBySource || []).map((_: unknown, index: number) => (
                      <Cell key={index} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="card lg:col-span-2">
            <h3 className="text-lg font-semibold mb-4">לידים חודשיים</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={salesData.monthlyLeads || []}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="total" fill="#0ea5e9" name="סה״כ" />
                  <Bar dataKey="won" fill="#22c55e" name="נסגרו" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {/* Customers Report */}
      {activeTab === 'customers' && customersData && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="card">
            <h3 className="text-lg font-semibold mb-4">הכנסות לפי לקוח (Top 10)</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={customersData.revenueByCustomer || []} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" />
                  <YAxis dataKey="company_name" type="category" width={100} />
                  <Tooltip formatter={(value: number) => `₪${value.toLocaleString()}`} />
                  <Bar dataKey="total_revenue" fill="#0ea5e9" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="card">
            <h3 className="text-lg font-semibold mb-4">לקוחות בסיכון (90 יום ללא פעילות)</h3>
            {customersData.churnRisk?.length > 0 ? (
              <div className="space-y-2">
                {customersData.churnRisk.map((customer: { id: string; company_name: string }) => (
                  <div key={customer.id} className="p-3 bg-red-50 rounded-lg">
                    <p className="font-medium text-red-800">{customer.company_name}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-green-600 text-center py-8">אין לקוחות בסיכון</p>
            )}
          </div>
        </div>
      )}

      {/* Employees Report */}
      {activeTab === 'employees' && employeesData && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="card lg:col-span-2">
            <h3 className="text-lg font-semibold mb-4">שעות עבודה חודשיות</h3>
            <div className="table-container">
              <table className="table">
                <thead>
                  <tr>
                    <th>עובד</th>
                    <th>שעות</th>
                    <th>ימי עבודה</th>
                    <th>שעות שבת</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {(employeesData.hoursBreakdown || []).slice(0, 10).map((emp: {
                    id: string;
                    name: string;
                    total_hours: number;
                    days_worked: number;
                    saturday_hours: number;
                  }) => (
                    <tr key={emp.id}>
                      <td className="font-medium">{emp.name}</td>
                      <td>{emp.total_hours || 0}</td>
                      <td>{emp.days_worked || 0}</td>
                      <td>{emp.saturday_hours || 0}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Financial Report */}
      {activeTab === 'financial' && financialData && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="card lg:col-span-2">
            <h3 className="text-lg font-semibold mb-4">הכנסות חודשיות</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={financialData.monthlyRevenue || []}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis />
                  <Tooltip formatter={(value: number) => `₪${value?.toLocaleString()}`} />
                  <Bar dataKey="collected" fill="#22c55e" name="נגבה" />
                  <Bar dataKey="invoiced" fill="#0ea5e9" name="הופק" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="card">
            <h3 className="text-lg font-semibold mb-4">תשלומים פתוחים</h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 bg-yellow-50 rounded-lg">
                <span>ממתין לתשלום</span>
                <span className="font-bold">₪{(financialData.outstandingPayments?.pending || 0).toLocaleString()}</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-red-50 rounded-lg">
                <span>באיחור</span>
                <span className="font-bold text-red-600">₪{(financialData.outstandingPayments?.overdue || 0).toLocaleString()}</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-red-100 rounded-lg">
                <span>באיחור 60+ יום</span>
                <span className="font-bold text-red-700">₪{(financialData.outstandingPayments?.overdue_60 || 0).toLocaleString()}</span>
              </div>
            </div>
          </div>

          <div className="card">
            <h3 className="text-lg font-semibold mb-4">הכנסות לפי לקוח</h3>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {(financialData.revenueByCustomer || []).map((customer: {
                company_name: string;
                paid: number;
                pending: number;
              }) => (
                <div key={customer.company_name} className="flex items-center justify-between p-2 hover:bg-gray-50 rounded">
                  <span className="truncate">{customer.company_name}</span>
                  <span className="font-medium text-green-600">₪{(customer.paid || 0).toLocaleString()}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
