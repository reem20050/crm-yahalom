import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { Settings, Zap, FileText, RefreshCw, Calendar } from 'lucide-react';
import { automationApi, shiftTemplatesApi } from '../services/api';
import { SkeletonPulse } from '../components/Skeleton';

// ── Types ───────────────────────────────────────────────────────────────────

interface AutoGenerationLog {
  id: string;
  type: string;
  generated_count: number;
  created_at: string;
  details?: string;
  error?: string;
}

interface AutomationStatus {
  auto_generate_count: number;
  total_templates: number;
}

// ── Helpers ─────────────────────────────────────────────────────────────────

const typeLabels: Record<string, string> = {
  shifts: 'משמרות',
  invoices: 'חשבוניות',
  shift_generation: 'יצירת משמרות',
  invoice_generation: 'יצירת חשבוניות',
  monthly_invoices: 'חשבוניות חודשיות',
};

function formatDate(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('he-IL', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return dateStr;
  }
}

function truncate(str: string, max: number): string {
  if (!str) return '-';
  return str.length > max ? str.slice(0, max) + '...' : str;
}

// ── Component ───────────────────────────────────────────────────────────────

export default function AutomationSettings() {
  const queryClient = useQueryClient();

  // Fetch automation status (template auto-generate counts)
  const {
    data: statusData,
    isLoading: statusLoading,
  } = useQuery<AutomationStatus>({
    queryKey: ['automation-status'],
    queryFn: async () => {
      const res = await automationApi.getStatus();
      return res.data;
    },
  });

  // Fetch templates to show auto_generate count
  const { data: templatesData } = useQuery({
    queryKey: ['shift-templates'],
    queryFn: async () => {
      const res = await shiftTemplatesApi.getAll();
      return res.data;
    },
  });

  // Fetch generation logs
  const {
    data: logsData,
    isLoading: logsLoading,
  } = useQuery<AutoGenerationLog[]>({
    queryKey: ['automation-logs'],
    queryFn: async () => {
      const res = await automationApi.getLogs({ limit: 20 });
      return res.data?.logs || res.data || [];
    },
  });

  // Generate shifts mutation
  const generateShiftsMutation = useMutation({
    mutationFn: () => automationApi.generateShifts(),
    onSuccess: (res) => {
      const msg = res.data?.message || 'משמרות נוצרו בהצלחה';
      const count = res.data?.generated_count;
      toast.success(count != null ? `${msg} (${count} משמרות)` : msg);
      queryClient.invalidateQueries({ queryKey: ['automation-logs'] });
      queryClient.invalidateQueries({ queryKey: ['shifts'] });
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'שגיאה ביצירת משמרות אוטומטית');
    },
  });

  // Generate monthly invoices mutation
  const generateInvoicesMutation = useMutation({
    mutationFn: () => automationApi.generateMonthlyInvoices(),
    onSuccess: (res) => {
      const msg = res.data?.message || 'חשבוניות נוצרו בהצלחה';
      const count = res.data?.generated_count;
      toast.success(count != null ? `${msg} (${count} חשבוניות)` : msg);
      queryClient.invalidateQueries({ queryKey: ['automation-logs'] });
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'שגיאה ביצירת חשבוניות חודשיות');
    },
  });

  // Count templates with auto_generate enabled
  const autoGenerateCount =
    statusData?.auto_generate_count ??
    (templatesData?.templates
      ? (templatesData.templates as Array<{ auto_generate?: boolean }>).filter(
          (t) => t.auto_generate
        ).length
      : 0);

  const totalTemplates =
    statusData?.total_templates ??
    (templatesData?.templates
      ? (templatesData.templates as Array<unknown>).length
      : 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-primary-100 rounded-xl flex items-center justify-center">
          <Settings className="w-5 h-5 text-primary-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            הגדרות אוטומציה
          </h1>
          <p className="text-gray-500 text-sm">
            ניהול יצירת משמרות וחשבוניות אוטומטית
          </p>
        </div>
      </div>

      {/* ── Auto-Shift Generation ──────────────────────────────────────── */}
      <div className="card">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center flex-shrink-0">
            <Calendar className="w-6 h-6 text-blue-600" />
          </div>
          <div className="flex-1">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <h3 className="font-semibold text-gray-900 text-lg">
                  יצירת משמרות אוטומטית
                </h3>
                <p className="text-sm text-gray-500 mt-1">
                  יצירת משמרות מתבניות פעילות לשבוע הקרוב
                </p>
              </div>

              {statusLoading ? (
                <SkeletonPulse className="h-8 w-36" />
              ) : (
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-700 rounded-lg text-sm font-medium">
                  <Zap className="w-4 h-4" />
                  {autoGenerateCount} / {totalTemplates} תבניות פעילות
                </span>
              )}
            </div>

            <div className="mt-4 flex items-center gap-3">
              <button
                onClick={() => generateShiftsMutation.mutate()}
                disabled={generateShiftsMutation.isPending}
                className="btn-primary flex items-center gap-2"
              >
                {generateShiftsMutation.isPending ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Calendar className="w-4 h-4" />
                )}
                {generateShiftsMutation.isPending
                  ? 'יוצר משמרות...'
                  : 'יצירת משמרות עכשיו'}
              </button>
            </div>

            {autoGenerateCount === 0 && !statusLoading && (
              <div className="mt-3 p-3 bg-amber-50 rounded-lg border border-amber-200">
                <p className="text-sm text-amber-800">
                  אין תבניות עם יצירה אוטומטית מופעלת. ניתן להפעיל מעמוד
                  המשמרות בלשונית "תבניות".
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Auto-Invoice Generation ────────────────────────────────────── */}
      <div className="card">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center flex-shrink-0">
            <FileText className="w-6 h-6 text-green-600" />
          </div>
          <div className="flex-1">
            <div>
              <h3 className="font-semibold text-gray-900 text-lg">
                יצירת חשבוניות חודשיות
              </h3>
              <p className="text-sm text-gray-500 mt-1">
                הפקת חשבוניות אוטומטית לכל הלקוחות הפעילים על בסיס חוזים ומשמרות
              </p>
            </div>

            <div className="mt-4 flex items-center gap-3">
              <button
                onClick={() => generateInvoicesMutation.mutate()}
                disabled={generateInvoicesMutation.isPending}
                className="btn-primary flex items-center gap-2"
              >
                {generateInvoicesMutation.isPending ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <FileText className="w-4 h-4" />
                )}
                {generateInvoicesMutation.isPending
                  ? 'יוצר חשבוניות...'
                  : 'יצירת חשבוניות חודשיות'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── Generation Logs ────────────────────────────────────────────── */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-gray-900 text-lg flex items-center gap-2">
            <RefreshCw className="w-5 h-5 text-gray-400" />
            יומן יצירות אוטומטיות
          </h3>
          <button
            onClick={() =>
              queryClient.invalidateQueries({ queryKey: ['automation-logs'] })
            }
            className="btn-secondary text-sm flex items-center gap-1.5"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            רענן
          </button>
        </div>

        {logsLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex gap-4">
                <SkeletonPulse className="h-5 w-24" />
                <SkeletonPulse className="h-5 w-16" />
                <SkeletonPulse className="h-5 w-36" />
                <SkeletonPulse className="h-5 flex-1" />
              </div>
            ))}
          </div>
        ) : !logsData || logsData.length === 0 ? (
          <div className="text-center py-8 text-gray-400">
            <RefreshCw className="w-10 h-10 mx-auto mb-2 opacity-40" />
            <p className="text-sm">אין רשומות יצירה אוטומטית עדיין</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-gray-500">
                  <th className="text-right py-3 px-3 font-medium">סוג</th>
                  <th className="text-right py-3 px-3 font-medium">כמות</th>
                  <th className="text-right py-3 px-3 font-medium">תאריך</th>
                  <th className="text-right py-3 px-3 font-medium">פרטים</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {logsData.map((log) => (
                  <tr key={log.id} className="hover:bg-gray-50 transition-colors">
                    <td className="py-3 px-3">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
                          log.type?.includes('invoice') || log.type?.includes('חשבונ')
                            ? 'bg-green-100 text-green-700'
                            : 'bg-blue-100 text-blue-700'
                        }`}
                      >
                        {log.type?.includes('invoice') || log.type?.includes('חשבונ') ? (
                          <FileText className="w-3 h-3" />
                        ) : (
                          <Calendar className="w-3 h-3" />
                        )}
                        {typeLabels[log.type] || log.type}
                      </span>
                    </td>
                    <td className="py-3 px-3 font-semibold text-gray-900">
                      {log.generated_count}
                    </td>
                    <td className="py-3 px-3 text-gray-600">
                      {formatDate(log.created_at)}
                    </td>
                    <td className="py-3 px-3 text-gray-500">
                      {log.error ? (
                        <span className="text-red-600 font-medium">
                          {truncate(log.error, 60)}
                        </span>
                      ) : (
                        truncate(log.details || '', 60)
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
