import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Receipt, Calendar, Building2, AlertCircle } from 'lucide-react';
import { invoicesApi } from '../services/api';

const statusLabels: Record<string, { label: string; class: string }> = {
  draft: { label: 'טיוטה', class: 'badge-gray' },
  sent: { label: 'נשלחה', class: 'badge-info' },
  paid: { label: 'שולמה', class: 'badge-success' },
  overdue: { label: 'באיחור', class: 'badge-danger' },
  cancelled: { label: 'בוטלה', class: 'badge-gray' },
};

export default function Invoices() {
  const [statusFilter, setStatusFilter] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['invoices', { status: statusFilter }],
    queryFn: () => invoicesApi.getAll({ status: statusFilter, limit: 50 }).then((res) => res.data),
  });

  const { data: summary } = useQuery({
    queryKey: ['invoices-summary'],
    queryFn: () => invoicesApi.getMonthlySummary().then((res) => res.data),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">חשבוניות</h1>
        <p className="text-gray-500">ניהול חשבוניות ותשלומים</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="stat-card">
          <p className="stat-card-value">₪{(summary?.total_amount || 0).toLocaleString()}</p>
          <p className="stat-card-label">סה"כ החודש</p>
        </div>
        <div className="stat-card">
          <p className="stat-card-value text-green-600">₪{(summary?.paid_amount || 0).toLocaleString()}</p>
          <p className="stat-card-label">שולם</p>
        </div>
        <div className="stat-card">
          <p className="stat-card-value text-yellow-600">₪{(summary?.pending_amount || 0).toLocaleString()}</p>
          <p className="stat-card-label">ממתין לתשלום</p>
        </div>
        <div className="stat-card">
          <p className="stat-card-value">{summary?.total_invoices || 0}</p>
          <p className="stat-card-label">חשבוניות</p>
        </div>
      </div>

      <div className="card">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="input w-auto"
        >
          <option value="">כל הסטטוסים</option>
          {Object.entries(statusLabels).map(([key, { label }]) => (
            <option key={key} value={key}>{label}</option>
          ))}
        </select>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-4 border-primary-500 border-t-transparent"></div>
        </div>
      ) : data?.invoices?.length > 0 ? (
        <div className="card p-0 overflow-hidden">
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>מספר חשבונית</th>
                  <th>לקוח</th>
                  <th>תאריך הפקה</th>
                  <th>תאריך תשלום</th>
                  <th>סכום</th>
                  <th>סטטוס</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {data.invoices.map((invoice: {
                  id: string;
                  invoice_number: string;
                  company_name: string;
                  issue_date: string;
                  due_date: string;
                  total_amount: number;
                  status: string;
                  computed_status: string;
                  days_overdue: number;
                }) => (
                  <tr key={invoice.id}>
                    <td className="font-medium">#{invoice.invoice_number || invoice.id.slice(0, 8)}</td>
                    <td>
                      <span className="flex items-center gap-2">
                        <Building2 className="w-4 h-4 text-gray-400" />
                        {invoice.company_name}
                      </span>
                    </td>
                    <td>{invoice.issue_date}</td>
                    <td>
                      <span className="flex items-center gap-1">
                        {invoice.due_date}
                        {invoice.days_overdue > 0 && (
                          <span className="text-red-600 text-xs">({invoice.days_overdue} ימים)</span>
                        )}
                      </span>
                    </td>
                    <td className="font-medium">₪{invoice.total_amount?.toLocaleString()}</td>
                    <td>
                      <span className={statusLabels[invoice.computed_status || invoice.status]?.class || 'badge-gray'}>
                        {statusLabels[invoice.computed_status || invoice.status]?.label || invoice.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="card text-center py-12">
          <p className="text-gray-500">לא נמצאו חשבוניות</p>
        </div>
      )}
    </div>
  );
}
