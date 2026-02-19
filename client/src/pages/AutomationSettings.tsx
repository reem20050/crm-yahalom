import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import {
  Settings,
  Zap,
  Play,
  Pause,
  RefreshCw,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  BarChart3,
  History,
  ListChecks,
  ChevronDown,
  ChevronUp,
  Filter,
  TrendingUp,
  Activity,
  Bell,
  Eye,
  Calendar,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { automationApi } from '../services/api';
import { SkeletonPulse } from '../components/Skeleton';

// ── Types ───────────────────────────────────────────────────────────────

interface AutomationJob {
  id: string;
  job_name: string;
  display_name: string;
  description: string;
  cron_schedule: string;
  is_enabled: number;
  last_run_at: string | null;
  last_run_status: string | null;
  last_run_details: string | null;
  next_run_at: string | null;
  retry_count: number;
  max_retries: number;
  category: string;
  is_registered: boolean;
  has_pending_retry: boolean;
  created_at: string;
  updated_at: string;
}

interface RunLog {
  id: string;
  job_name: string;
  started_at: string;
  completed_at: string | null;
  status: string;
  items_processed: number;
  items_created: number;
  items_skipped: number;
  error_message: string | null;
  details: string | null;
  display_name?: string;
  category?: string;
}

interface AutomationStats {
  today: { count: number; success_count: number; failed_count: number };
  week: { count: number; success_count: number; failed_count: number };
  month: { count: number; success_count: number; failed_count: number; total_processed: number; total_created: number };
  successRate: number;
  mostActive: { job_name: string; run_count: number; display_name: string } | null;
  mostFailed: { job_name: string; fail_count: number; display_name: string } | null;
  runsOverTime: Array<{ day: string; total: number; success: number; failed: number }>;
  jobCounts: { total: number; enabled: number; disabled: number };
}

type TabType = 'jobs' | 'history' | 'stats';

// ── Helpers ─────────────────────────────────────────────────────────────

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '-';
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

function formatShortDate(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('he-IL', { month: '2-digit', day: '2-digit' });
  } catch {
    return dateStr;
  }
}

function formatDuration(start: string, end: string | null): string {
  if (!end) return 'רץ...';
  const ms = new Date(end).getTime() - new Date(start).getTime();
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${Math.round(ms / 1000)}s`;
  return `${Math.round(ms / 60000)}m`;
}

function cronToHebrew(cron: string): string {
  const parts = cron.split(' ');
  if (parts.length !== 5) return cron;
  const [min, hour, dom, , dow] = parts;

  if (min.startsWith('*/')) {
    return `כל ${min.substring(2)} דקות`;
  }

  const time = `${hour.padStart(2, '0')}:${min.padStart(2, '0')}`;

  const dayNames: Record<string, string> = {
    '0': 'ראשון', '1': 'שני', '2': 'שלישי', '3': 'רביעי',
    '4': 'חמישי', '5': 'שישי', '6': 'שבת',
  };

  if (dow !== '*') {
    return `כל יום ${dayNames[dow] || dow} ב-${time}`;
  }
  if (dom !== '*') {
    return `ב-${dom} לחודש ב-${time}`;
  }
  return `כל יום ב-${time}`;
}

function getStatusBadge(status: string | null) {
  switch (status) {
    case 'success':
      return { className: 'badge-success', icon: CheckCircle2, text: 'הצלחה' };
    case 'failed':
    case 'failed_max_retries':
      return { className: 'badge-danger', icon: XCircle, text: 'נכשל' };
    case 'running':
      return { className: 'badge-info', icon: RefreshCw, text: 'רץ' };
    case 'skipped':
      return { className: 'bg-gray-100 text-gray-600', icon: Pause, text: 'דולג' };
    default:
      return { className: 'bg-gray-100 text-gray-500', icon: Clock, text: 'טרם רץ' };
  }
}

const categoryConfig: Record<string, { label: string; icon: typeof Bell; color: string; bg: string }> = {
  reminders: { label: 'תזכורות', icon: Bell, color: 'text-blue-600', bg: 'from-blue-100 to-blue-50' },
  generation: { label: 'יצירה אוטומטית', icon: Zap, color: 'text-green-600', bg: 'from-green-100 to-green-50' },
  predictive: { label: 'התראות חיזוי', icon: AlertTriangle, color: 'text-amber-600', bg: 'from-amber-100 to-amber-50' },
  monitoring: { label: 'מעקב', icon: Eye, color: 'text-purple-600', bg: 'from-purple-100 to-purple-50' },
  intelligence: { label: 'אינטליגנציה', icon: BarChart3, color: 'text-indigo-600', bg: 'from-indigo-100 to-indigo-50' },
};

// ── Main Component ──────────────────────────────────────────────────────

export default function AutomationSettings() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<TabType>('jobs');
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);

  // ── Data Fetching ─────────────────────────────────────────────────

  const { data: jobsData, isLoading: jobsLoading } = useQuery<AutomationJob[]>({
    queryKey: ['automation-jobs'],
    queryFn: async () => {
      const res = await automationApi.getJobs();
      return res.data?.jobs || [];
    },
    refetchInterval: 30000,
  });

  const { data: runsData, isLoading: runsLoading } = useQuery<RunLog[]>({
    queryKey: ['automation-runs', activeTab],
    queryFn: async () => {
      const res = await automationApi.getRuns({ limit: 100 });
      return res.data?.runs || [];
    },
    enabled: activeTab === 'history',
    refetchInterval: 30000,
  });

  const { data: statsData, isLoading: statsLoading } = useQuery<AutomationStats>({
    queryKey: ['automation-stats'],
    queryFn: async () => {
      const res = await automationApi.getStats();
      return res.data;
    },
    enabled: activeTab === 'stats',
    staleTime: 60000,
  });

  // ── Mutations ─────────────────────────────────────────────────────

  const toggleMutation = useMutation({
    mutationFn: ({ name, enabled }: { name: string; enabled: boolean }) =>
      automationApi.toggleJob(name, enabled),
    onSuccess: (_, vars) => {
      toast.success(vars.enabled ? 'המשימה הופעלה' : 'המשימה הושבתה');
      queryClient.invalidateQueries({ queryKey: ['automation-jobs'] });
    },
    onError: () => toast.error('שגיאה בעדכון המשימה'),
  });

  const triggerMutation = useMutation({
    mutationFn: (name: string) => automationApi.triggerJob(name),
    onSuccess: (res) => {
      toast.success(res.data?.message || 'המשימה הופעלה בהצלחה');
      queryClient.invalidateQueries({ queryKey: ['automation-jobs'] });
      queryClient.invalidateQueries({ queryKey: ['automation-runs'] });
      queryClient.invalidateQueries({ queryKey: ['automation-stats'] });
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error || 'שגיאה בהפעלת המשימה');
    },
  });

  // ── Group jobs by category ────────────────────────────────────────

  const groupedJobs = (jobsData || []).reduce((acc, job) => {
    const cat = job.category || 'general';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(job);
    return acc;
  }, {} as Record<string, AutomationJob[]>);

  const categoryOrder = ['reminders', 'generation', 'predictive', 'monitoring', 'intelligence'];

  // ── Run History Filters ───────────────────────────────────────────

  const [historyFilter, setHistoryFilter] = useState({ jobName: '', status: '' });
  const filteredRuns = (runsData || []).filter((run) => {
    if (historyFilter.jobName && run.job_name !== historyFilter.jobName) return false;
    if (historyFilter.status && run.status !== historyFilter.status) return false;
    return true;
  });

  const uniqueJobNames = Array.from(new Set((runsData || []).map((r) => r.job_name)));

  // ── Tabs ──────────────────────────────────────────────────────────

  const tabs: { key: TabType; label: string; icon: typeof ListChecks }[] = [
    { key: 'jobs', label: 'משימות', icon: ListChecks },
    { key: 'history', label: 'היסטוריית ריצות', icon: History },
    { key: 'stats', label: 'סטטיסטיקות', icon: BarChart3 },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="page-header">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-primary-100 to-primary-50 rounded-xl flex items-center justify-center">
            <Settings className="w-5 h-5 text-primary-600" />
          </div>
          <div>
            <h1 className="page-title">לוח בקרה אוטומציה</h1>
            <p className="text-gray-500 text-sm">
              ניהול, מעקב והפעלה של כל המשימות האוטומטיות במערכת
            </p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-sm font-medium transition-all ${
              activeTab === tab.key
                ? 'bg-white text-primary-700 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'jobs' && (
        <JobsTab
          groupedJobs={groupedJobs}
          categoryOrder={categoryOrder}
          isLoading={jobsLoading}
          expandedCategory={expandedCategory}
          setExpandedCategory={setExpandedCategory}
          onToggle={(name: string, enabled: boolean) => toggleMutation.mutate({ name, enabled })}
          onTrigger={(name: string) => triggerMutation.mutate(name)}
          triggerPending={triggerMutation.isPending}
          triggerJobName={triggerMutation.variables as string | undefined}
        />
      )}

      {activeTab === 'history' && (
        <HistoryTab
          runs={filteredRuns}
          isLoading={runsLoading}
          filter={historyFilter}
          setFilter={setHistoryFilter}
          uniqueJobNames={uniqueJobNames}
          allJobs={jobsData || []}
          onRefresh={() => queryClient.invalidateQueries({ queryKey: ['automation-runs'] })}
        />
      )}

      {activeTab === 'stats' && (
        <StatsTab stats={statsData} isLoading={statsLoading} />
      )}
    </div>
  );
}

// ── Jobs Tab ────────────────────────────────────────────────────────────

function JobsTab({
  groupedJobs,
  categoryOrder,
  isLoading,
  expandedCategory,
  setExpandedCategory,
  onToggle,
  onTrigger,
  triggerPending,
  triggerJobName,
}: {
  groupedJobs: Record<string, AutomationJob[]>;
  categoryOrder: string[];
  isLoading: boolean;
  expandedCategory: string | null;
  setExpandedCategory: (cat: string | null) => void;
  onToggle: (name: string, enabled: boolean) => void;
  onTrigger: (name: string) => void;
  triggerPending: boolean;
  triggerJobName?: string;
}) {
  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="card">
            <SkeletonPulse className="h-6 w-48 mb-4" />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <SkeletonPulse className="h-32" />
              <SkeletonPulse className="h-32" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {categoryOrder.map((catKey) => {
        const jobs = groupedJobs[catKey];
        if (!jobs || jobs.length === 0) return null;

        const config = categoryConfig[catKey] || {
          label: catKey,
          icon: Settings,
          color: 'text-gray-600',
          bg: 'from-gray-100 to-gray-50',
        };
        const CatIcon = config.icon;
        const isExpanded = expandedCategory === null || expandedCategory === catKey;
        const enabledCount = jobs.filter((j) => j.is_enabled).length;

        return (
          <div key={catKey} className="card">
            <button
              onClick={() =>
                setExpandedCategory(expandedCategory === catKey ? null : catKey)
              }
              className="w-full flex items-center justify-between mb-4"
            >
              <div className="flex items-center gap-3">
                <div
                  className={`w-9 h-9 bg-gradient-to-br ${config.bg} rounded-lg flex items-center justify-center`}
                >
                  <CatIcon className={`w-4 h-4 ${config.color}`} />
                </div>
                <div className="text-right">
                  <h3 className="font-semibold text-gray-900 font-heading">
                    {config.label}
                  </h3>
                  <span className="text-xs text-gray-500">
                    {enabledCount}/{jobs.length} פעילות
                  </span>
                </div>
              </div>
              {isExpanded ? (
                <ChevronUp className="w-5 h-5 text-gray-400" />
              ) : (
                <ChevronDown className="w-5 h-5 text-gray-400" />
              )}
            </button>

            {isExpanded && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {jobs.map((job) => (
                  <JobCard
                    key={job.job_name}
                    job={job}
                    onToggle={onToggle}
                    onTrigger={onTrigger}
                    triggerPending={triggerPending && triggerJobName === job.job_name}
                  />
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Job Card ────────────────────────────────────────────────────────────

function JobCard({
  job,
  onToggle,
  onTrigger,
  triggerPending,
}: {
  job: AutomationJob;
  onToggle: (name: string, enabled: boolean) => void;
  onTrigger: (name: string) => void;
  triggerPending: boolean;
}) {
  const statusInfo = getStatusBadge(job.last_run_status);
  const StatusIcon = statusInfo.icon;
  const isEnabled = job.is_enabled === 1;

  return (
    <div
      className={`rounded-xl border p-4 transition-all ${
        isEnabled
          ? 'border-gray-200 bg-white hover:shadow-md'
          : 'border-gray-100 bg-gray-50 opacity-70'
      }`}
    >
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="flex-1 min-w-0">
          <h4 className="font-semibold text-gray-900 text-sm truncate">
            {job.display_name}
          </h4>
          <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">
            {job.description}
          </p>
        </div>

        {/* Toggle Switch */}
        <button
          onClick={() => onToggle(job.job_name, !isEnabled)}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors flex-shrink-0 ${
            isEnabled ? 'bg-primary-600' : 'bg-gray-300'
          }`}
          aria-label={isEnabled ? 'השבת משימה' : 'הפעל משימה'}
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
              isEnabled ? 'translate-x-1' : 'translate-x-6'
            }`}
          />
        </button>
      </div>

      {/* Schedule */}
      <div className="flex items-center gap-1.5 text-xs text-gray-500 mb-2">
        <Clock className="w-3.5 h-3.5" />
        <span>{cronToHebrew(job.cron_schedule)}</span>
      </div>

      {/* Status Row */}
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-1.5">
          <span
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${statusInfo.className}`}
          >
            <StatusIcon className={`w-3 h-3 ${job.last_run_status === 'running' ? 'animate-spin' : ''}`} />
            {statusInfo.text}
          </span>
          {job.retry_count > 0 && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">
              <AlertTriangle className="w-3 h-3" />
              {job.retry_count}/{job.max_retries}
            </span>
          )}
        </div>
      </div>

      {/* Times */}
      <div className="flex flex-col gap-1 text-xs text-gray-500 mb-3">
        {job.last_run_at && (
          <div className="flex items-center gap-1">
            <History className="w-3 h-3" />
            <span>ריצה אחרונה: {formatDate(job.last_run_at)}</span>
          </div>
        )}
        {job.next_run_at && isEnabled && (
          <div className="flex items-center gap-1">
            <Clock className="w-3 h-3" />
            <span>הבא: {formatDate(job.next_run_at)}</span>
          </div>
        )}
      </div>

      {/* Error Details */}
      {job.last_run_status === 'failed' && job.last_run_details && (
        <div className="mb-3 p-2 bg-red-50 rounded-lg border border-red-100">
          <p className="text-xs text-red-700 line-clamp-2">{job.last_run_details}</p>
        </div>
      )}

      {/* Manual Trigger */}
      <button
        onClick={() => onTrigger(job.job_name)}
        disabled={triggerPending}
        className="w-full btn-ghost text-xs py-1.5 flex items-center justify-center gap-1.5"
      >
        {triggerPending ? (
          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
        ) : (
          <Play className="w-3.5 h-3.5" />
        )}
        {triggerPending ? 'מריץ...' : 'הפעל עכשיו'}
      </button>
    </div>
  );
}

// ── History Tab ─────────────────────────────────────────────────────────

function HistoryTab({
  runs,
  isLoading,
  filter,
  setFilter,
  uniqueJobNames,
  allJobs,
  onRefresh,
}: {
  runs: RunLog[];
  isLoading: boolean;
  filter: { jobName: string; status: string };
  setFilter: (f: { jobName: string; status: string }) => void;
  uniqueJobNames: string[];
  allJobs: AutomationJob[];
  onRefresh: () => void;
}) {
  const jobNameMap = allJobs.reduce((acc, j) => {
    acc[j.job_name] = j.display_name;
    return acc;
  }, {} as Record<string, string>);

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="card">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-gray-400" />
              <select
                value={filter.jobName}
                onChange={(e) => setFilter({ ...filter, jobName: e.target.value })}
                className="input text-sm py-1.5 min-w-[180px]"
              >
                <option value="">כל המשימות</option>
                {uniqueJobNames.map((name) => (
                  <option key={name} value={name}>
                    {jobNameMap[name] || name}
                  </option>
                ))}
              </select>
            </div>

            <select
              value={filter.status}
              onChange={(e) => setFilter({ ...filter, status: e.target.value })}
              className="input text-sm py-1.5 min-w-[140px]"
            >
              <option value="">כל הסטטוסים</option>
              <option value="success">הצלחה</option>
              <option value="failed">נכשל</option>
              <option value="running">רץ</option>
            </select>
          </div>

          <button onClick={onRefresh} className="btn-ghost text-sm flex items-center gap-1.5">
            <RefreshCw className="w-3.5 h-3.5" />
            רענן
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="card p-0">
        {isLoading ? (
          <div className="p-4 space-y-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="flex gap-4">
                <SkeletonPulse className="h-5 w-32" />
                <SkeletonPulse className="h-5 w-24" />
                <SkeletonPulse className="h-5 w-16" />
                <SkeletonPulse className="h-5 w-20" />
                <SkeletonPulse className="h-5 flex-1" />
              </div>
            ))}
          </div>
        ) : runs.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <History className="w-10 h-10 mx-auto mb-2 opacity-40" />
            <p className="text-sm">אין רשומות ריצה</p>
          </div>
        ) : (
          <>
          {/* Desktop table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-gray-500 bg-gray-50/50">
                  <th className="text-right py-3 px-4 font-medium">משימה</th>
                  <th className="text-right py-3 px-4 font-medium">התחלה</th>
                  <th className="text-right py-3 px-4 font-medium">משך</th>
                  <th className="text-right py-3 px-4 font-medium">סטטוס</th>
                  <th className="text-right py-3 px-4 font-medium">עיבוד</th>
                  <th className="text-right py-3 px-4 font-medium">נוצרו</th>
                  <th className="text-right py-3 px-4 font-medium">דולגו</th>
                  <th className="text-right py-3 px-4 font-medium">שגיאה / פרטים</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {runs.map((run) => {
                  const statusInfo = getStatusBadge(run.status);
                  const RunStatusIcon = statusInfo.icon;
                  return (
                    <tr
                      key={run.id}
                      className={`hover:bg-gray-50 transition-colors ${
                        run.status === 'failed' ? 'bg-red-50/30' : ''
                      }`}
                    >
                      <td className="py-3 px-4 font-medium text-gray-900">
                        {run.display_name || jobNameMap[run.job_name] || run.job_name}
                      </td>
                      <td className="py-3 px-4 text-gray-600 whitespace-nowrap">
                        {formatDate(run.started_at)}
                      </td>
                      <td className="py-3 px-4 text-gray-600 whitespace-nowrap">
                        {formatDuration(run.started_at, run.completed_at)}
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${statusInfo.className}`}
                        >
                          <RunStatusIcon className={`w-3 h-3 ${run.status === 'running' ? 'animate-spin' : ''}`} />
                          {statusInfo.text}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-gray-700 tabular-nums">
                        {run.items_processed}
                      </td>
                      <td className="py-3 px-4 text-gray-700 tabular-nums">
                        {run.items_created}
                      </td>
                      <td className="py-3 px-4 text-gray-700 tabular-nums">
                        {run.items_skipped}
                      </td>
                      <td className="py-3 px-4 max-w-[250px]">
                        {run.error_message ? (
                          <span className="text-red-600 text-xs truncate block">
                            {run.error_message}
                          </span>
                        ) : run.details ? (
                          <span className="text-gray-500 text-xs truncate block">
                            {run.details}
                          </span>
                        ) : (
                          <span className="text-gray-300">-</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile card view */}
          <div className="md:hidden p-3 space-y-3">
            {runs.map((run) => {
              const statusInfo = getStatusBadge(run.status);
              const RunStatusIcon = statusInfo.icon;
              return (
                <div
                  key={run.id}
                  className={`responsive-table-card rounded-xl border p-3 space-y-2 ${
                    run.status === 'failed' ? 'border-red-200 bg-red-50/30' : 'border-gray-200'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-gray-900 text-sm truncate">
                      {run.display_name || jobNameMap[run.job_name] || run.job_name}
                    </span>
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium flex-shrink-0 ${statusInfo.className}`}
                    >
                      <RunStatusIcon className={`w-3 h-3 ${run.status === 'running' ? 'animate-spin' : ''}`} />
                      {statusInfo.text}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-gray-500">
                    <span>{formatDate(run.started_at)}</span>
                    <span className="text-gray-300">|</span>
                    <span>{formatDuration(run.started_at, run.completed_at)}</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div>
                      <span className="text-gray-500 block">עיבוד</span>
                      <span className="text-gray-700 font-medium tabular-nums">{run.items_processed}</span>
                    </div>
                    <div>
                      <span className="text-gray-500 block">נוצרו</span>
                      <span className="text-gray-700 font-medium tabular-nums">{run.items_created}</span>
                    </div>
                    <div>
                      <span className="text-gray-500 block">דולגו</span>
                      <span className="text-gray-700 font-medium tabular-nums">{run.items_skipped}</span>
                    </div>
                  </div>
                  {run.error_message && (
                    <p className="text-xs text-red-600 bg-red-50 rounded-lg p-2 line-clamp-2">
                      {run.error_message}
                    </p>
                  )}
                  {!run.error_message && run.details && (
                    <p className="text-xs text-gray-500 line-clamp-2">{run.details}</p>
                  )}
                </div>
              );
            })}
          </div>
          </>
        )}
      </div>
    </div>
  );
}

// ── Stats Tab ───────────────────────────────────────────────────────────

function StatsTab({
  stats,
  isLoading,
}: {
  stats: AutomationStats | undefined;
  isLoading: boolean;
}) {
  if (isLoading || !stats) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <SkeletonPulse key={i} className="h-24 rounded-xl" />
          ))}
        </div>
        <SkeletonPulse className="h-64 rounded-xl" />
      </div>
    );
  }

  const statCards = [
    {
      label: 'ריצות היום',
      value: stats.today.count || 0,
      sub: `${stats.today.success_count || 0} הצלחות`,
      icon: Activity,
      color: 'text-blue-600',
      bg: 'from-blue-100 to-blue-50',
    },
    {
      label: 'ריצות השבוע',
      value: stats.week.count || 0,
      sub: `${stats.week.failed_count || 0} נכשלו`,
      icon: Calendar,
      color: 'text-green-600',
      bg: 'from-green-100 to-green-50',
    },
    {
      label: 'אחוז הצלחה',
      value: `${stats.successRate}%`,
      sub: `מתוך ${stats.month.count || 0} ריצות`,
      icon: TrendingUp,
      color: 'text-emerald-600',
      bg: 'from-emerald-100 to-emerald-50',
    },
    {
      label: 'משימות פעילות',
      value: stats.jobCounts.enabled || 0,
      sub: `מתוך ${stats.jobCounts.total || 0} סה"כ`,
      icon: Zap,
      color: 'text-purple-600',
      bg: 'from-purple-100 to-purple-50',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {statCards.map((card, idx) => {
          const CardIcon = card.icon;
          return (
            <div key={idx} className="stat-card">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-gray-500 font-medium">{card.label}</span>
                <div
                  className={`w-8 h-8 bg-gradient-to-br ${card.bg} rounded-lg flex items-center justify-center`}
                >
                  <CardIcon className={`w-4 h-4 ${card.color}`} />
                </div>
              </div>
              <p className="text-2xl font-bold text-gray-900 font-heading">{card.value}</p>
              <p className="text-xs text-gray-500 mt-1">{card.sub}</p>
            </div>
          );
        })}
      </div>

      {/* Info Cards Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Most Active */}
        <div className="card">
          <h4 className="section-header text-sm flex items-center gap-2 mb-3">
            <Activity className="w-4 h-4 text-blue-500" />
            המשימה הכי פעילה (30 יום)
          </h4>
          {stats.mostActive ? (
            <div className="flex items-center justify-between">
              <span className="font-medium text-gray-900">
                {stats.mostActive.display_name || stats.mostActive.job_name}
              </span>
              <span className="badge-info text-xs">
                {stats.mostActive.run_count} ריצות
              </span>
            </div>
          ) : (
            <p className="text-gray-400 text-sm">אין נתונים</p>
          )}
        </div>

        {/* Most Failed */}
        <div className="card">
          <h4 className="section-header text-sm flex items-center gap-2 mb-3">
            <XCircle className="w-4 h-4 text-red-500" />
            המשימה עם הכי הרבה כשלונות (30 יום)
          </h4>
          {stats.mostFailed ? (
            <div className="flex items-center justify-between">
              <span className="font-medium text-gray-900">
                {stats.mostFailed.display_name || stats.mostFailed.job_name}
              </span>
              <span className="badge-danger text-xs">
                {stats.mostFailed.fail_count} כשלונות
              </span>
            </div>
          ) : (
            <p className="text-gray-400 text-sm">אין כשלונות - מצוין!</p>
          )}
        </div>
      </div>

      {/* Monthly Summary */}
      <div className="card">
        <h4 className="section-header text-sm flex items-center gap-2 mb-3">
          <BarChart3 className="w-4 h-4 text-gray-500" />
          סיכום חודשי
        </h4>
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center p-3 bg-gray-50 rounded-lg">
            <p className="text-2xl font-bold text-gray-900">
              {stats.month.total_processed || 0}
            </p>
            <p className="text-xs text-gray-500">פריטים עובדו</p>
          </div>
          <div className="text-center p-3 bg-gray-50 rounded-lg">
            <p className="text-2xl font-bold text-gray-900">
              {stats.month.total_created || 0}
            </p>
            <p className="text-xs text-gray-500">פריטים נוצרו</p>
          </div>
          <div className="text-center p-3 bg-gray-50 rounded-lg">
            <p className="text-2xl font-bold text-gray-900">
              {stats.month.count || 0}
            </p>
            <p className="text-xs text-gray-500">סה"כ ריצות</p>
          </div>
        </div>
      </div>

      {/* Runs Over Time Chart */}
      {stats.runsOverTime && stats.runsOverTime.length > 0 && (
        <div className="card">
          <h4 className="section-header text-sm flex items-center gap-2 mb-4">
            <TrendingUp className="w-4 h-4 text-gray-500" />
            ריצות ב-14 ימים אחרונים
          </h4>
          <div className="h-[200px] sm:h-[280px]" style={{ width: '100%', direction: 'ltr' }}>
            <ResponsiveContainer>
              <BarChart data={stats.runsOverTime}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis
                  dataKey="day"
                  tickFormatter={formatShortDate}
                  tick={{ fontSize: 11 }}
                />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip
                  formatter={(value: number, name: string) => [
                    value,
                    name === 'success' ? 'הצלחה' : name === 'failed' ? 'נכשל' : 'סה"כ',
                  ]}
                  labelFormatter={(label) => formatShortDate(label as string)}
                />
                <Legend
                  formatter={(value) =>
                    value === 'success' ? 'הצלחה' : value === 'failed' ? 'נכשל' : value
                  }
                />
                <Bar dataKey="success" fill="#22c55e" radius={[4, 4, 0, 0]} />
                <Bar dataKey="failed" fill="#ef4444" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
}
