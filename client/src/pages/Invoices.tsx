import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import toast from 'react-hot-toast';
import { Receipt, Calendar, Building2, AlertCircle, Plus, X, Trash2, Check, Printer } from 'lucide-react';
import { invoicesApi, customersApi } from '../services/api';

const statusLabels: Record<string, { label: string; class: string }> = {
  draft: { label: 'טיוטה', class: 'badge-gray' },
  sent: { label: 'נשלחה', class: 'badge-info' },
  paid: { label: 'שולמה', class: 'badge-success' },
  overdue: { label: 'באיחור', class: 'badge-danger' },
  cancelled: { label: 'בוטלה', class: 'badge-gray' },
};

const invoiceSchema = z.object({
  customer_id: z.string().min(1, 'נדרש לבחור לקוח'),
  invoice_number: z.string().optional(),
  issue_date: z.string().min(1, 'נדרש תאריך הפקה'),
  due_date: z.string().min(1, 'נדרש תאריך תשלום'),
  total_amount: z.coerce.number().min(0.01, 'סכום חייב להיות גדול מ-0'),
  description: z.string().optional(),
});

type InvoiceForm = z.infer<typeof invoiceSchema>;

type Invoice = {
  id: string;
  invoice_number: string;
  customer_id: string;
  company_name: string;
  issue_date: string;
  due_date: string;
  total_amount: number;
  status: string;
  computed_status: string;
  days_overdue: number;
  payment_date: string | null;
  description: string;
};

export default function Invoices() {
  const [statusFilter, setStatusFilter] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [paymentDateModal, setPaymentDateModal] = useState<{ invoiceId: string; show: boolean }>({ invoiceId: '', show: false });
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
  const queryClient = useQueryClient();

  // Queries
  const { data, isLoading } = useQuery({
    queryKey: ['invoices', { status: statusFilter }],
    queryFn: () => invoicesApi.getAll({ status: statusFilter, limit: 50 }).then((res) => res.data),
  });

  const { data: summary } = useQuery({
    queryKey: ['invoices-summary'],
    queryFn: () => invoicesApi.getMonthlySummary().then((res) => res.data),
  });

  const { data: customersData } = useQuery({
    queryKey: ['customers-list'],
    queryFn: () => customersApi.getAll({ limit: 200 }).then((res) => res.data),
  });

  // Mutations
  const createMutation = useMutation({
    mutationFn: (data: InvoiceForm) => invoicesApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['invoices-summary'] });
      toast.success('חשבונית נוצרה בהצלחה');
      setIsModalOpen(false);
      reset();
    },
    onError: () => {
      toast.error('שגיאה ביצירת חשבונית');
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status, paymentDate }: { id: string; status: string; paymentDate?: string }) =>
      invoicesApi.updateStatus(id, status, paymentDate),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['invoices-summary'] });
      toast.success('סטטוס עודכן בהצלחה');
    },
    onError: () => {
      toast.error('שגיאה בעדכון סטטוס');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => invoicesApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['invoices-summary'] });
      toast.success('חשבונית נמחקה בהצלחה');
    },
    onError: () => {
      toast.error('שגיאה במחיקת חשבונית');
    },
  });

  // Form
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<InvoiceForm>({
    resolver: zodResolver(invoiceSchema),
    defaultValues: {
      issue_date: new Date().toISOString().split('T')[0],
    },
  });

  const onSubmit = (data: InvoiceForm) => {
    createMutation.mutate(data);
  };

  const handleStatusChange = (invoiceId: string, newStatus: string) => {
    if (newStatus === 'paid') {
      setPaymentDateModal({ invoiceId, show: true });
      setPaymentDate(new Date().toISOString().split('T')[0]);
      return;
    }
    updateStatusMutation.mutate({ id: invoiceId, status: newStatus });
  };

  const confirmPaidStatus = () => {
    updateStatusMutation.mutate({
      id: paymentDateModal.invoiceId,
      status: 'paid',
      paymentDate: paymentDate,
    });
    setPaymentDateModal({ invoiceId: '', show: false });
  };

  const getEffectiveStatus = (invoice: Invoice) => invoice.computed_status || invoice.status;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">חשבוניות</h1>
          <p className="text-gray-500">ניהול חשבוניות ותשלומים</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => window.print()} className="btn-secondary flex items-center gap-2 no-print">
            <Printer className="w-5 h-5" />
            הדפס
          </button>
          <button onClick={() => setIsModalOpen(true)} className="btn-primary flex items-center gap-2">
            <Plus className="w-5 h-5" />
            חשבונית חדשה
          </button>
        </div>
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
                  <th>פעולות</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {data.invoices.map((invoice: Invoice) => {
                  const effectiveStatus = getEffectiveStatus(invoice);
                  return (
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
                        <span className={statusLabels[effectiveStatus]?.class || 'badge-gray'}>
                          {statusLabels[effectiveStatus]?.label || invoice.status}
                        </span>
                      </td>
                      <td>
                        <div className="flex items-center gap-2">
                          {/* Status update dropdown - only show for non-paid and non-cancelled */}
                          {effectiveStatus !== 'paid' && effectiveStatus !== 'cancelled' && (
                            <select
                              className="input py-1 px-2 text-sm w-auto"
                              value=""
                              onChange={(e) => {
                                if (e.target.value) {
                                  handleStatusChange(invoice.id, e.target.value);
                                  e.target.value = '';
                                }
                              }}
                            >
                              <option value="">שנה סטטוס</option>
                              {effectiveStatus !== 'sent' && (
                                <option value="sent">נשלחה</option>
                              )}
                              <option value="paid">שולמה</option>
                              <option value="cancelled">בוטלה</option>
                            </select>
                          )}

                          {/* Delete button - only for draft status */}
                          {effectiveStatus === 'draft' && (
                            <button
                              onClick={() => {
                                if (confirm('האם אתה בטוח שברצונך למחוק חשבונית זו?')) {
                                  deleteMutation.mutate(invoice.id);
                                }
                              }}
                              className="text-red-400 hover:text-red-600 p-1"
                              title="מחק חשבונית"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="card text-center py-12">
          <Receipt className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500 mb-4">לא נמצאו חשבוניות</p>
          <button onClick={() => setIsModalOpen(true)} className="btn-primary">
            צור חשבונית ראשונה
          </button>
        </div>
      )}

      {/* Create Invoice Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b">
              <h2 className="text-xl font-bold">חשבונית חדשה</h2>
              <button
                onClick={() => {
                  setIsModalOpen(false);
                  reset();
                }}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                {/* Customer selection */}
                <div className="col-span-2">
                  <label className="label">לקוח *</label>
                  <select {...register('customer_id')} className="input">
                    <option value="">בחר לקוח...</option>
                    {customersData?.customers?.map((customer: { id: string; company_name: string }) => (
                      <option key={customer.id} value={customer.id}>
                        {customer.company_name}
                      </option>
                    ))}
                  </select>
                  {errors.customer_id && (
                    <p className="text-sm text-red-600 mt-1">{errors.customer_id.message}</p>
                  )}
                </div>

                {/* Invoice number */}
                <div>
                  <label className="label">מספר חשבונית</label>
                  <input {...register('invoice_number')} className="input" dir="ltr" placeholder="אוטומטי אם ריק" />
                </div>

                {/* Total amount */}
                <div>
                  <label className="label">סכום *</label>
                  <input
                    {...register('total_amount')}
                    type="number"
                    step="0.01"
                    min="0"
                    className="input"
                    dir="ltr"
                    placeholder="0.00"
                  />
                  {errors.total_amount && (
                    <p className="text-sm text-red-600 mt-1">{errors.total_amount.message}</p>
                  )}
                </div>

                {/* Issue date */}
                <div>
                  <label className="label">תאריך הפקה *</label>
                  <input {...register('issue_date')} type="date" className="input" dir="ltr" />
                  {errors.issue_date && (
                    <p className="text-sm text-red-600 mt-1">{errors.issue_date.message}</p>
                  )}
                </div>

                {/* Due date */}
                <div>
                  <label className="label">תאריך לתשלום *</label>
                  <input {...register('due_date')} type="date" className="input" dir="ltr" />
                  {errors.due_date && (
                    <p className="text-sm text-red-600 mt-1">{errors.due_date.message}</p>
                  )}
                </div>

                {/* Description */}
                <div className="col-span-2">
                  <label className="label">תיאור</label>
                  <textarea {...register('description')} className="input min-h-[80px]" placeholder="פירוט שירותים..." />
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="submit"
                  disabled={createMutation.isPending}
                  className="btn-primary flex-1"
                >
                  {createMutation.isPending ? 'שומר...' : 'צור חשבונית'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsModalOpen(false);
                    reset();
                  }}
                  className="btn-secondary"
                >
                  ביטול
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Payment Date Modal */}
      {paymentDateModal.show && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between p-6 border-b">
              <h2 className="text-lg font-bold">תאריך תשלום</h2>
              <button
                onClick={() => setPaymentDateModal({ invoiceId: '', show: false })}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="label">בחר תאריך תשלום</label>
                <input
                  type="date"
                  value={paymentDate}
                  onChange={(e) => setPaymentDate(e.target.value)}
                  className="input"
                  dir="ltr"
                />
              </div>
              <div className="flex gap-3">
                <button
                  onClick={confirmPaidStatus}
                  disabled={updateStatusMutation.isPending}
                  className="btn-primary flex-1 flex items-center justify-center gap-2"
                >
                  <Check className="w-4 h-4" />
                  {updateStatusMutation.isPending ? 'מעדכן...' : 'אשר תשלום'}
                </button>
                <button
                  onClick={() => setPaymentDateModal({ invoiceId: '', show: false })}
                  className="btn-secondary"
                >
                  ביטול
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
