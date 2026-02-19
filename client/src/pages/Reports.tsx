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
  Shield,
  Star,
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
  LineChart,
  Line,
  Legend,
} from 'recharts';
import { reportsApi, performanceApi, incidentsApi } from '../services/api';
import { FileText } from 'lucide-react';
import { exportTableToPDF } from '../utils/pdfExport';

const COLORS = ['#0ea5e9', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6'];

type ReportTab = 'sales' | 'customers' | 'employees' | 'financial' | 'profitloss' | 'performance';

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

  const { data: profitLossData } = useQuery({
    queryKey: ['reports', 'profit-loss'],
    queryFn: () => reportsApi.profitLoss().then((res) => res.data),
    enabled: activeTab === 'profitloss',
  });

  const { data: rankingsData } = useQuery({
    queryKey: ['reports', 'performance-rankings'],
    queryFn: () => performanceApi.getRankings().then((res) => res.data),
    enabled: activeTab === 'performance',
  });

  const { data: incidentStats } = useQuery({
    queryKey: ['reports', 'incident-stats'],
    queryFn: () => incidentsApi.getStats().then((res) => res.data),
    enabled: activeTab === 'performance',
  });

  const tabs = [
    { id: 'sales' as const, label: 'מכירות', icon: TrendingUp },
    { id: 'customers' as const, label: 'לקוחות', icon: Building2 },
    { id: 'employees' as const, label: 'עובדים', icon: Users },
    { id: 'financial' as const, label: 'כספים', icon: DollarSign },
    { id: 'profitloss' as const, label: 'רווח והפסד', icon: BarChart3 },
    { id: 'performance' as const, label: 'ביצועי מאבטחים', icon: Shield },
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
      case 'profitloss':
        if (profitLossData?.customerProfitability) {
          exportToCSV(profitLossData.customerProfitability, {
            company_name: 'לקוח', revenue: 'הכנסות', labor_cost: 'עלות עבודה',
            profit: 'רווח', margin: 'מרווח %', hours: 'שעות'
          }, 'profit-loss-by-customer.csv');
        }
        break;
      case 'performance':
        if (rankingsData?.rankings) {
          exportToCSV(rankingsData.rankings, {
            first_name: 'שם פרטי', last_name: 'שם משפחה', avg_rating: 'דירוג ממוצע',
            total_ratings: 'דירוגים', shifts_completed: 'משמרות הושלמו', shifts_total: 'סה"כ משמרות'
          }, 'guard-performance.csv');
        }
        break;
    }
  };

  const handlePDFExport = () => {
    const today = new Date().toLocaleDateString('he-IL');
    switch (activeTab) {
      case 'sales':
        if (salesData?.leadsBySource) {
          exportTableToPDF({
            title: 'Yahalom CRM - Sales Report',
            subtitle: today,
            columns: [
              { header: 'Source', dataKey: 'source' },
              { header: 'Count', dataKey: 'count' },
            ],
            data: salesData.leadsBySource,
            filename: 'sales-report.pdf',
          });
        }
        break;
      case 'customers':
        if (customersData?.revenueByCustomer) {
          exportTableToPDF({
            title: 'Yahalom CRM - Customers Revenue',
            subtitle: today,
            columns: [
              { header: 'Company', dataKey: 'company_name' },
              { header: 'Revenue', dataKey: 'total_revenue' },
            ],
            data: customersData.revenueByCustomer,
            filename: 'customers-revenue.pdf',
          });
        }
        break;
      case 'employees':
        if (employeesData?.hoursBreakdown) {
          exportTableToPDF({
            title: 'Yahalom CRM - Employee Hours',
            subtitle: today,
            columns: [
              { header: 'Employee', dataKey: 'name' },
              { header: 'Total Hours', dataKey: 'total_hours' },
              { header: 'Days Worked', dataKey: 'days_worked' },
              { header: 'Saturday Hours', dataKey: 'saturday_hours' },
            ],
            data: employeesData.hoursBreakdown,
            filename: 'employees-hours.pdf',
            orientation: 'landscape',
          });
        }
        break;
      case 'financial':
        if (financialData?.revenueByCustomer) {
          exportTableToPDF({
            title: 'Yahalom CRM - Financial Report',
            subtitle: today,
            columns: [
              { header: 'Customer', dataKey: 'company_name' },
              { header: 'Paid', dataKey: 'paid' },
              { header: 'Pending', dataKey: 'pending' },
            ],
            data: financialData.revenueByCustomer,
            filename: 'financial-report.pdf',
          });
        }
        break;
      case 'profitloss':
        if (profitLossData?.customerProfitability) {
          exportTableToPDF({
            title: 'Yahalom CRM - Profit & Loss',
            subtitle: today,
            columns: [
              { header: 'Customer', dataKey: 'company_name' },
              { header: 'Revenue', dataKey: 'revenue' },
              { header: 'Labor Cost', dataKey: 'labor_cost' },
              { header: 'Profit', dataKey: 'profit' },
              { header: 'Margin %', dataKey: 'margin' },
              { header: 'Hours', dataKey: 'hours' },
            ],
            data: profitLossData.customerProfitability,
            filename: 'profit-loss.pdf',
            orientation: 'landscape',
          });
        }
        break;
      case 'performance':
        if (rankingsData?.rankings) {
          exportTableToPDF({
            title: 'Yahalom CRM - Guard Performance',
            subtitle: today,
            columns: [
              { header: 'First Name', dataKey: 'first_name' },
              { header: 'Last Name', dataKey: 'last_name' },
              { header: 'Avg Rating', dataKey: 'avg_rating' },
              { header: 'Total Ratings', dataKey: 'total_ratings' },
              { header: 'Shifts Done', dataKey: 'shifts_completed' },
              { header: 'Total Shifts', dataKey: 'shifts_total' },
            ],
            data: rankingsData.rankings,
            filename: 'guard-performance.pdf',
            orientation: 'landscape',
          });
        }
        break;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="page-header">
          <h1 className="page-title">דוחות</h1>
          <p className="page-subtitle">ניתוח נתונים וביצועים</p>
        </div>
        <div className="flex items-center gap-2 no-print">
          <button onClick={handleExport} className="btn-secondary flex items-center gap-2">
            <Download className="w-5 h-5" />
            ייצוא לאקסל
          </button>
          <button onClick={handlePDFExport} className="btn-secondary flex items-center gap-2">
            <FileText className="w-5 h-5" />
            ייצוא PDF
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
            <h3 className="text-lg font-semibold mb-4 font-heading">המרת לידים</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 mb-6">
              <div className="text-center">
                <p className="text-3xl font-bold text-gray-900 font-heading">{salesData.conversionRate?.total_leads || 0}</p>
                <p className="text-sm text-gray-500">לידים</p>
              </div>
              <div className="text-center">
                <p className="text-3xl font-bold text-green-600 font-heading">{salesData.conversionRate?.won || 0}</p>
                <p className="text-sm text-gray-500">נסגרו</p>
              </div>
              <div className="text-center">
                <p className="text-3xl font-bold text-primary-600 font-heading">{salesData.conversionRate?.conversion_rate || 0}%</p>
                <p className="text-sm text-gray-500">אחוז המרה</p>
              </div>
            </div>
          </div>

          <div className="card">
            <h3 className="text-lg font-semibold mb-4 font-heading">לידים לפי מקור</h3>
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
            <h3 className="text-lg font-semibold mb-4 font-heading">לידים חודשיים</h3>
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
            <h3 className="text-lg font-semibold mb-4 font-heading">הכנסות לפי לקוח (Top 10)</h3>
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
            <h3 className="text-lg font-semibold mb-4 font-heading">לקוחות בסיכון (90 יום ללא פעילות)</h3>
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
            <h3 className="text-lg font-semibold mb-4 font-heading">שעות עבודה חודשיות</h3>
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
            <h3 className="text-lg font-semibold mb-4 font-heading">הכנסות חודשיות</h3>
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
            <h3 className="text-lg font-semibold mb-4 font-heading">תשלומים פתוחים</h3>
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
            <h3 className="text-lg font-semibold mb-4 font-heading">הכנסות לפי לקוח</h3>
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

      {/* Profit & Loss Report */}
      {activeTab === 'profitloss' && profitLossData && (
        <div className="space-y-6">
          {/* Totals KPI */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="card text-center">
              <p className="text-sm text-gray-500">הכנסות (שנתי)</p>
              <p className="text-2xl font-bold text-green-600 font-heading">
                ₪{(profitLossData.totals?.revenue || 0).toLocaleString()}
              </p>
            </div>
            <div className="card text-center">
              <p className="text-sm text-gray-500">עלות עבודה</p>
              <p className="text-2xl font-bold text-red-600 font-heading">
                ₪{(profitLossData.totals?.labor_cost || 0).toLocaleString()}
              </p>
            </div>
            <div className="card text-center">
              <p className="text-sm text-gray-500">רווח נקי</p>
              <p className={`text-2xl font-bold font-heading ${(profitLossData.totals?.profit || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                ₪{(profitLossData.totals?.profit || 0).toLocaleString()}
              </p>
            </div>
            <div className="card text-center">
              <p className="text-sm text-gray-500">מרווח רווח</p>
              <p className={`text-2xl font-bold font-heading ${(profitLossData.totals?.margin || 0) >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
                {profitLossData.totals?.margin || 0}%
              </p>
            </div>
          </div>

          {/* Monthly P&L Chart */}
          <div className="card">
            <h3 className="text-lg font-semibold mb-4 font-heading">רווח והפסד חודשי</h3>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={profitLossData.monthly || []}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis />
                  <Tooltip formatter={(value: number) => `₪${value?.toLocaleString()}`} />
                  <Legend />
                  <Bar dataKey="revenue" fill="#22c55e" name="הכנסות" />
                  <Bar dataKey="labor_cost" fill="#ef4444" name="עלות עבודה" />
                  <Bar dataKey="profit" fill="#3b82f6" name="רווח" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Profit Margin Trend */}
          <div className="card">
            <h3 className="text-lg font-semibold mb-4 font-heading">מגמת מרווח רווח</h3>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={profitLossData.monthly || []}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis unit="%" />
                  <Tooltip formatter={(value: number) => `${value}%`} />
                  <Line type="monotone" dataKey="margin" stroke="#8b5cf6" strokeWidth={2} name="מרווח %" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Monthly Breakdown Table */}
          <div className="card">
            <h3 className="text-lg font-semibold mb-4 font-heading">פירוט חודשי</h3>
            <div className="table-container">
              <table className="table">
                <thead>
                  <tr>
                    <th>חודש</th>
                    <th>הכנסות</th>
                    <th>עלות עבודה</th>
                    <th>רווח</th>
                    <th>מרווח</th>
                    <th>שעות</th>
                    <th>עובדים</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {(profitLossData.monthly || []).map((m: {
                    month: string; revenue: number; labor_cost: number;
                    profit: number; margin: number; total_hours: number; unique_employees: number;
                  }) => (
                    <tr key={m.month}>
                      <td className="font-medium">{m.month}</td>
                      <td className="text-green-600">₪{(m.revenue || 0).toLocaleString()}</td>
                      <td className="text-red-600">₪{(m.labor_cost || 0).toLocaleString()}</td>
                      <td className={m.profit >= 0 ? 'text-green-700 font-bold' : 'text-red-700 font-bold'}>
                        ₪{(m.profit || 0).toLocaleString()}
                      </td>
                      <td>
                        <span className={`badge ${m.margin >= 30 ? 'badge-success' : m.margin >= 10 ? 'badge-warning' : 'badge-danger'}`}>
                          {m.margin}%
                        </span>
                      </td>
                      <td>{(m.total_hours || 0).toLocaleString()}</td>
                      <td>{m.unique_employees || 0}</td>
                    </tr>
                  ))}
                  {/* Totals row */}
                  {profitLossData.monthly?.length > 0 && (
                    <tr className="bg-gray-50 font-bold">
                      <td>סה"כ</td>
                      <td className="text-green-600">₪{(profitLossData.totals?.revenue || 0).toLocaleString()}</td>
                      <td className="text-red-600">₪{(profitLossData.totals?.labor_cost || 0).toLocaleString()}</td>
                      <td className={profitLossData.totals?.profit >= 0 ? 'text-green-700' : 'text-red-700'}>
                        ₪{(profitLossData.totals?.profit || 0).toLocaleString()}
                      </td>
                      <td>{profitLossData.totals?.margin || 0}%</td>
                      <td></td>
                      <td></td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Customer Profitability */}
          <div className="card">
            <h3 className="text-lg font-semibold mb-4 font-heading">רווחיות לפי לקוח</h3>
            <div className="table-container">
              <table className="table">
                <thead>
                  <tr>
                    <th>לקוח</th>
                    <th>הכנסות</th>
                    <th>עלות עבודה</th>
                    <th>רווח</th>
                    <th>מרווח</th>
                    <th>שעות</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {(profitLossData.customerProfitability || []).map((c: {
                    company_name: string; revenue: number; labor_cost: number;
                    profit: number; margin: number; hours: number;
                  }) => (
                    <tr key={c.company_name}>
                      <td className="font-medium">{c.company_name}</td>
                      <td className="text-green-600">₪{(c.revenue || 0).toLocaleString()}</td>
                      <td className="text-red-600">₪{(c.labor_cost || 0).toLocaleString()}</td>
                      <td className={c.profit >= 0 ? 'text-green-700 font-bold' : 'text-red-700 font-bold'}>
                        ₪{(c.profit || 0).toLocaleString()}
                      </td>
                      <td>
                        <span className={`badge ${c.margin >= 30 ? 'badge-success' : c.margin >= 10 ? 'badge-warning' : 'badge-danger'}`}>
                          {c.margin}%
                        </span>
                      </td>
                      <td>{(c.hours || 0).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {(!profitLossData.customerProfitability || profitLossData.customerProfitability.length === 0) && (
              <p className="text-gray-400 text-center py-8">אין נתוני רווחיות</p>
            )}
          </div>
        </div>
      )}

      {/* Guard Performance Report */}
      {activeTab === 'performance' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Incident Stats */}
          {incidentStats && (
            <div className="card lg:col-span-2">
              <h3 className="text-lg font-semibold mb-4 font-heading">סטטיסטיקות אירועי אבטחה</h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
                <div className="text-center p-3 bg-red-50 rounded-lg">
                  <p className="text-2xl font-bold text-red-600 font-heading">{incidentStats.open || 0}</p>
                  <p className="text-sm text-gray-500">פתוחים</p>
                </div>
                <div className="text-center p-3 bg-yellow-50 rounded-lg">
                  <p className="text-2xl font-bold text-yellow-600 font-heading">{incidentStats.investigating || 0}</p>
                  <p className="text-sm text-gray-500">בחקירה</p>
                </div>
                <div className="text-center p-3 bg-green-50 rounded-lg">
                  <p className="text-2xl font-bold text-green-600 font-heading">{incidentStats.resolved || 0}</p>
                  <p className="text-sm text-gray-500">נפתרו</p>
                </div>
                <div className="text-center p-3 bg-blue-50 rounded-lg">
                  <p className="text-2xl font-bold text-blue-600 font-heading">{incidentStats.total || 0}</p>
                  <p className="text-sm text-gray-500">סה"כ</p>
                </div>
              </div>
            </div>
          )}

          {/* Rankings Table */}
          <div className="card lg:col-span-2">
            <h3 className="text-lg font-semibold mb-4 font-heading">דירוג מאבטחים</h3>
            <div className="table-container">
              <table className="table">
                <thead>
                  <tr>
                    <th>דירוג</th>
                    <th>מאבטח</th>
                    <th>ציון ממוצע</th>
                    <th>דירוגים</th>
                    <th>משמרות הושלמו</th>
                    <th>אחוז נוכחות</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {(rankingsData?.rankings || []).map((guard: {
                    id: string;
                    first_name: string;
                    last_name: string;
                    avg_rating: number;
                    total_ratings: number;
                    shifts_completed: number;
                    shifts_total: number;
                  }, index: number) => {
                    const attendancePct = guard.shifts_total > 0
                      ? Math.round((guard.shifts_completed / guard.shifts_total) * 100)
                      : 0;
                    return (
                      <tr key={guard.id}>
                        <td>
                          <span className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-sm font-bold ${
                            index === 0 ? 'bg-yellow-100 text-yellow-700' :
                            index === 1 ? 'bg-gray-100 text-gray-700' :
                            index === 2 ? 'bg-orange-100 text-orange-700' :
                            'bg-white text-gray-500'
                          }`}>
                            {index + 1}
                          </span>
                        </td>
                        <td className="font-medium">{guard.first_name} {guard.last_name}</td>
                        <td>
                          <div className="flex items-center gap-1">
                            {guard.avg_rating ? (
                              <>
                                {[1, 2, 3, 4, 5].map((s) => (
                                  <Star key={s} className={`w-3.5 h-3.5 ${
                                    s <= Math.round(guard.avg_rating) ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300'
                                  }`} />
                                ))}
                                <span className="text-sm mr-1">{guard.avg_rating}</span>
                              </>
                            ) : (
                              <span className="text-gray-400 text-sm">אין דירוג</span>
                            )}
                          </div>
                        </td>
                        <td>{guard.total_ratings || 0}</td>
                        <td>{guard.shifts_completed}/{guard.shifts_total}</td>
                        <td>
                          <span className={`font-medium ${
                            attendancePct >= 90 ? 'text-green-600' :
                            attendancePct >= 70 ? 'text-yellow-600' : 'text-red-600'
                          }`}>
                            {attendancePct}%
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {(!rankingsData?.rankings || rankingsData.rankings.length === 0) && (
              <p className="text-gray-400 text-center py-8">אין נתוני ביצועים</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
