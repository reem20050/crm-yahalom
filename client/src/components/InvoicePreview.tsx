import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import {
  Eye,
  FileText,
  Save,
  RefreshCw,
  CheckSquare,
  Square,
  AlertTriangle,
  Receipt,
  Percent,
  Calendar,
  Calculator,
} from 'lucide-react';
import { invoiceAutomationApi, automationApi } from '../services/api';

// ── Types ───────────────────────────────────────────────────────────────

interface InvoicePreviewItem {
  customer_id?: string;
  customer_name: string;
  contract_id?: string;
  contract_name?: string;
  amount?: number;
  vat_rate?: number;
  vat_amount?: number;
  total?: number;
  issue_date?: string;
  due_date?: string;
  is_prorated?: boolean;
  description?: string;
  payment_days?: number;
  error?: string;
}

interface SystemConfig {
  [key: string]: { value: string; description: string };
}

// ── Helpers ─────────────────────────────────────────────────────────────

function formatCurrency(val: number | undefined): string {
  if (val == null) return '₪0';
  return `₪${val.toLocaleString('he-IL', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

function formatDate(dateStr: string | undefined): string {
  if (!dateStr) return '-';
  try {
    return new Date(dateStr).toLocaleDateString('he-IL');
  } catch {
    return dateStr;
  }
}

// ── Component ───────────────────────────────────────────────────────────

export default function InvoicePreview() {
  const queryClient = useQueryClient();
  const [selectedContracts, setSelectedContracts] = useState<Set<string>>(new Set());
  const [vatRate, setVatRate] = useState('');
  const [paymentDays, setPaymentDays] = useState('');
  const [configLoaded, setConfigLoaded] = useState(false);

  // ── Fetch system config ─────────────────────────────────────────────
  const { data: configData, isLoading: configLoading } = useQuery<SystemConfig>({
    queryKey: ['invoice-config'],
    queryFn: async () => {
      const res = await invoiceAutomationApi.getConfig();
      return res.data;
    },
  });

  // Populate form fields from config when loaded
  useEffect(() => {
    if (!configLoaded && configData) {
      setVatRate(configData.default_vat_rate?.value ?? '17.0');
      setPaymentDays(configData.default_payment_days?.value ?? '30');
      setConfigLoaded(true);
    }
  }, [configData, configLoaded]);

  // ── Save config mutation ─────────────────────────────────────────────
  const saveConfigMutation = useMutation({
    mutationFn: () =>
      invoiceAutomationApi.updateConfig({
        default_vat_rate: vatRate,
        default_payment_days: paymentDays,
      }),
    onSuccess: () => {
      toast.success('הגדרות נשמרו בהצלחה');
      queryClient.invalidateQueries({ queryKey: ['invoice-config'] });
    },
    onError: () => toast.error('שגיאה בשמירת הגדרות'),
  });

  // ── Preview query (manual trigger) ──────────────────────────────────
  const {
    data: previewData,
    isLoading: previewLoading,
    refetch: fetchPreview,
    isFetched: previewFetched,
  } = useQuery<InvoicePreviewItem[]>({
    queryKey: ['invoice-preview'],
    queryFn: async () => {
      const res = await invoiceAutomationApi.preview();
      return res.data?.invoices || [];
    },
    enabled: false, // manual trigger only
  });

  // ── Generate ALL invoices ───────────────────────────────────────────
  const generateAllMutation = useMutation({
    mutationFn: () => automationApi.generateMonthlyInvoices(),
    onSuccess: (res) => {
      const count = res.data?.created ?? 0;
      toast.success(`נוצרו ${count} חשבוניות בהצלחה`);
      queryClient.invalidateQueries({ queryKey: ['invoice-preview'] });
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['automation-logs'] });
      setSelectedContracts(new Set());
    },
    onError: () => toast.error('שגיאה ביצירת חשבוניות'),
  });

  // ── Generate SELECTED invoices ──────────────────────────────────────
  const generateSelectedMutation = useMutation({
    mutationFn: (contractIds: string[]) =>
      invoiceAutomationApi.generateSelected(contractIds),
    onSuccess: (res) => {
      const count = res.data?.created ?? 0;
      toast.success(`נוצרו ${count} חשבוניות נבחרות בהצלחה`);
      queryClient.invalidateQueries({ queryKey: ['invoice-preview'] });
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['automation-logs'] });
      setSelectedContracts(new Set());
    },
    onError: () => toast.error('שגיאה ביצירת חשבוניות נבחרות'),
  });

  // ── Selection helpers ───────────────────────────────────────────────
  const validItems = (previewData || []).filter((item) => !item.error && item.contract_id);

  const toggleSelect = (contractId: string) => {
    setSelectedContracts((prev) => {
      const next = new Set(prev);
      if (next.has(contractId)) {
        next.delete(contractId);
      } else {
        next.add(contractId);
      }
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedContracts.size === validItems.length) {
      setSelectedContracts(new Set());
    } else {
      setSelectedContracts(new Set(validItems.map((i) => i.contract_id!)));
    }
  };

  // ── Summary calculations ────────────────────────────────────────────
  const summaryAmount = validItems.reduce((s, i) => s + (i.amount || 0), 0);
  const summaryVat = validItems.reduce((s, i) => s + (i.vat_amount || 0), 0);
  const summaryTotal = validItems.reduce((s, i) => s + (i.total || 0), 0);
  const errorItems = (previewData || []).filter((item) => item.error);

  const isGenerating = generateAllMutation.isPending || generateSelectedMutation.isPending;

  return (
    <div className="space-y-6">
      {/* ── Config Section ──────────────────────────────────────────── */}
      <div className="card">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-gradient-to-br from-emerald-100 to-emerald-50 rounded-xl flex items-center justify-center">
            <Receipt className="w-5 h-5 text-emerald-600" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900 text-lg font-heading">
              הגדרות חשבוניות
            </h3>
            <p className="text-sm text-gray-500">
              ברירת מחדל לחישוב מע&quot;מ ותנאי תשלום
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* VAT Rate */}
          <div>
            <label className="label flex items-center gap-1.5">
              <Percent className="w-4 h-4 text-gray-400" />
              שיעור מע&quot;מ ברירת מחדל
            </label>
            <div className="relative">
              <input
                type="number"
                step="0.1"
                min="0"
                max="100"
                className="input text-left pl-8"
                value={vatRate}
                onChange={(e) => setVatRate(e.target.value)}
                disabled={configLoading}
                placeholder="17.0"
              />
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">
                %
              </span>
            </div>
          </div>

          {/* Payment Days */}
          <div>
            <label className="label flex items-center gap-1.5">
              <Calendar className="w-4 h-4 text-gray-400" />
              ימי תשלום ברירת מחדל
            </label>
            <div className="relative">
              <input
                type="number"
                step="1"
                min="0"
                max="365"
                className="input text-left pl-14"
                value={paymentDays}
                onChange={(e) => setPaymentDays(e.target.value)}
                disabled={configLoading}
                placeholder="30"
              />
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">
                ימים
              </span>
            </div>
          </div>
        </div>

        <div className="mt-4 flex items-center gap-3">
          <button
            onClick={() => saveConfigMutation.mutate()}
            disabled={saveConfigMutation.isPending}
            className="btn-primary flex items-center gap-2 text-sm"
          >
            {saveConfigMutation.isPending ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            שמור הגדרות
          </button>
        </div>
      </div>

      {/* ── Preview Section ─────────────────────────────────────────── */}
      <div className="card">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-100 to-blue-50 rounded-xl flex items-center justify-center">
              <Eye className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 text-lg font-heading">
                תצוגה מקדימה - חשבוניות חודשיות
              </h3>
              <p className="text-sm text-gray-500">
                חשבוניות שייווצרו לחודש הנוכחי על בסיס חוזים פעילים
              </p>
            </div>
          </div>

          <button
            onClick={() => fetchPreview()}
            disabled={previewLoading}
            className="btn-primary flex items-center gap-2"
          >
            {previewLoading ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <Eye className="w-4 h-4" />
            )}
            {previewLoading ? 'טוען...' : 'תצוגה מקדימה'}
          </button>
        </div>

        {/* Summary stats */}
        {previewFetched && validItems.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
            <div className="stat-card">
              <p className="stat-card-value font-heading">{validItems.length}</p>
              <p className="stat-card-label">חשבוניות</p>
            </div>
            <div className="stat-card">
              <p className="stat-card-value font-heading">{formatCurrency(summaryAmount)}</p>
              <p className="stat-card-label">סכום לפני מע&quot;מ</p>
            </div>
            <div className="stat-card">
              <p className="stat-card-value font-heading text-amber-600">{formatCurrency(summaryVat)}</p>
              <p className="stat-card-label">מע&quot;מ</p>
            </div>
            <div className="stat-card">
              <p className="stat-card-value font-heading text-emerald-600">{formatCurrency(summaryTotal)}</p>
              <p className="stat-card-label">סה&quot;כ כולל מע&quot;מ</p>
            </div>
          </div>
        )}

        {/* Error items */}
        {errorItems.length > 0 && (
          <div className="mb-4 p-3 bg-red-50 rounded-lg border border-red-200">
            <div className="flex items-center gap-2 text-red-700 font-medium text-sm mb-1">
              <AlertTriangle className="w-4 h-4" />
              {errorItems.length} שגיאות
            </div>
            <ul className="text-sm text-red-600 space-y-1 mr-6">
              {errorItems.map((item, idx) => (
                <li key={idx}>
                  {item.customer_name}: {item.error}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Preview table */}
        {previewFetched && validItems.length > 0 && (
          <>
            <div className="table-container">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 text-gray-500">
                    <th className="text-right py-3 px-3 font-medium w-10">
                      <button
                        onClick={toggleSelectAll}
                        className="p-0.5 hover:text-primary-600 transition-colors"
                        title={selectedContracts.size === validItems.length ? 'בטל הכל' : 'בחר הכל'}
                      >
                        {selectedContracts.size === validItems.length && validItems.length > 0 ? (
                          <CheckSquare className="w-4 h-4 text-primary-600" />
                        ) : (
                          <Square className="w-4 h-4" />
                        )}
                      </button>
                    </th>
                    <th className="text-right py-3 px-3 font-medium">לקוח</th>
                    <th className="text-right py-3 px-3 font-medium">חוזה</th>
                    <th className="text-right py-3 px-3 font-medium">סכום</th>
                    <th className="text-right py-3 px-3 font-medium">מע&quot;מ %</th>
                    <th className="text-right py-3 px-3 font-medium">מע&quot;מ</th>
                    <th className="text-right py-3 px-3 font-medium">סה&quot;כ</th>
                    <th className="text-right py-3 px-3 font-medium">תשלום עד</th>
                    <th className="text-right py-3 px-3 font-medium">סטטוס</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {validItems.map((item) => (
                    <tr
                      key={item.contract_id}
                      className={`hover:bg-gray-50 transition-colors ${
                        selectedContracts.has(item.contract_id!)
                          ? 'bg-primary-50/50'
                          : ''
                      }`}
                    >
                      <td className="py-3 px-3">
                        <button
                          onClick={() => toggleSelect(item.contract_id!)}
                          className="p-0.5 hover:text-primary-600 transition-colors"
                        >
                          {selectedContracts.has(item.contract_id!) ? (
                            <CheckSquare className="w-4 h-4 text-primary-600" />
                          ) : (
                            <Square className="w-4 h-4 text-gray-400" />
                          )}
                        </button>
                      </td>
                      <td className="py-3 px-3 font-medium text-gray-900">
                        {item.customer_name}
                      </td>
                      <td className="py-3 px-3 text-gray-600 max-w-[160px] truncate">
                        {item.contract_name || '-'}
                      </td>
                      <td className="py-3 px-3 font-semibold text-gray-900">
                        {formatCurrency(item.amount)}
                      </td>
                      <td className="py-3 px-3 text-gray-600">
                        {item.vat_rate != null ? `${item.vat_rate}%` : '-'}
                      </td>
                      <td className="py-3 px-3 text-gray-600">
                        {formatCurrency(item.vat_amount)}
                      </td>
                      <td className="py-3 px-3 font-bold text-emerald-700">
                        {formatCurrency(item.total)}
                      </td>
                      <td className="py-3 px-3 text-gray-600">
                        {formatDate(item.due_date)}
                      </td>
                      <td className="py-3 px-3">
                        {item.is_prorated ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full text-xs font-medium">
                            <Calculator className="w-3 h-3" />
                            יחסי
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-100 text-green-700 rounded-full text-xs font-medium">
                            מלא
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}

                  {/* Summary row */}
                  <tr className="bg-gray-50 font-bold border-t-2 border-gray-300">
                    <td className="py-3 px-3" colSpan={3}>
                      <span className="text-gray-700">סה&quot;כ</span>
                    </td>
                    <td className="py-3 px-3 text-gray-900">
                      {formatCurrency(summaryAmount)}
                    </td>
                    <td className="py-3 px-3" />
                    <td className="py-3 px-3 text-gray-700">
                      {formatCurrency(summaryVat)}
                    </td>
                    <td className="py-3 px-3 text-emerald-700 text-base">
                      {formatCurrency(summaryTotal)}
                    </td>
                    <td className="py-3 px-3" colSpan={2} />
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Action buttons */}
            <div className="mt-4 flex items-center gap-3 flex-wrap">
              <button
                onClick={() => generateAllMutation.mutate()}
                disabled={isGenerating}
                className="btn-primary flex items-center gap-2"
              >
                {generateAllMutation.isPending ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <FileText className="w-4 h-4" />
                )}
                {generateAllMutation.isPending
                  ? 'יוצר חשבוניות...'
                  : `צור את כל החשבוניות (${validItems.length})`}
              </button>

              {selectedContracts.size > 0 && (
                <button
                  onClick={() =>
                    generateSelectedMutation.mutate(Array.from(selectedContracts))
                  }
                  disabled={isGenerating}
                  className="btn-secondary flex items-center gap-2"
                >
                  {generateSelectedMutation.isPending ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <CheckSquare className="w-4 h-4" />
                  )}
                  {generateSelectedMutation.isPending
                    ? 'יוצר...'
                    : `צור נבחרים (${selectedContracts.size})`}
                </button>
              )}
            </div>
          </>
        )}

        {/* Empty state */}
        {previewFetched && validItems.length === 0 && errorItems.length === 0 && (
          <div className="text-center py-12 text-gray-400">
            <FileText className="w-12 h-12 mx-auto mb-3 opacity-40" />
            <p className="text-base font-medium">אין חשבוניות ליצירה</p>
            <p className="text-sm mt-1">
              ודא שיש חוזים פעילים עם &quot;יצירה אוטומטית&quot; מופעלת ושלא הופקו כבר החודש
            </p>
          </div>
        )}

        {/* Not fetched yet */}
        {!previewFetched && !previewLoading && (
          <div className="text-center py-10 text-gray-400">
            <Eye className="w-10 h-10 mx-auto mb-2 opacity-30" />
            <p className="text-sm">לחץ על &quot;תצוגה מקדימה&quot; לצפייה בחשבוניות שייווצרו</p>
          </div>
        )}
      </div>
    </div>
  );
}
