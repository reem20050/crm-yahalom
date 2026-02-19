import { useQuery } from '@tanstack/react-query';
import { UserCheck, Star, Loader2 } from 'lucide-react';
import { shiftsApi } from '../services/api';
import { SkeletonPulse } from './Skeleton';

// ── Types ───────────────────────────────────────────────────────────────────

interface GuardSuggestion {
  employee_id: string;
  employee_name: string;
  score: number;
  reasons: string[];
}

interface GuardSuggestionsProps {
  date: string;
  startTime: string;
  endTime: string;
  requiresWeapon?: boolean;
  siteId?: string;
  templateId?: string;
  onAssign: (employeeId: string) => void;
}

// ── Helpers ─────────────────────────────────────────────────────────────────

const reasonLabels: Record<string, string> = {
  available: 'זמין',
  certified: 'מוסמך',
  preferred: 'מועדף',
  low_workload: 'עומס נמוך',
  nearby: 'קרוב לאתר',
};

const reasonBadgeClasses: Record<string, string> = {
  available: 'badge-success',
  certified: 'badge-info',
  preferred: 'badge-purple',
  low_workload: 'badge-info',
  nearby: 'badge-warning',
};

function getScoreGradient(score: number): string {
  if (score >= 80) return 'bg-gradient-to-br from-green-500 to-emerald-600';
  if (score >= 60) return 'bg-gradient-to-br from-blue-500 to-indigo-600';
  if (score >= 40) return 'bg-gradient-to-br from-yellow-500 to-amber-600';
  return 'bg-gradient-to-br from-gray-400 to-gray-500';
}

function getScoreBarColor(score: number): string {
  if (score >= 80) return 'bg-gradient-to-l from-green-500 to-emerald-400';
  if (score >= 60) return 'bg-gradient-to-l from-blue-500 to-indigo-400';
  if (score >= 40) return 'bg-gradient-to-l from-yellow-500 to-amber-400';
  return 'bg-gray-400';
}

function getScoreTextColor(score: number): string {
  if (score >= 80) return 'text-green-700';
  if (score >= 60) return 'text-blue-700';
  if (score >= 40) return 'text-yellow-700';
  return 'text-gray-500';
}

// ── Component ───────────────────────────────────────────────────────────────

export default function GuardSuggestions({
  date,
  startTime,
  endTime,
  requiresWeapon,
  siteId,
  templateId,
  onAssign,
}: GuardSuggestionsProps) {
  const isReady = !!(date && startTime && endTime);

  const {
    data: suggestions,
    isLoading,
    isError,
  } = useQuery<GuardSuggestion[]>({
    queryKey: [
      'guard-suggestions',
      date,
      startTime,
      endTime,
      requiresWeapon,
      siteId,
      templateId,
    ],
    queryFn: async () => {
      const res = await shiftsApi.getGuardSuggestions({
        date,
        start_time: startTime,
        end_time: endTime,
        requires_weapon: requiresWeapon,
        site_id: siteId,
        template_id: templateId,
      });
      return res.data?.suggestions || res.data || [];
    },
    enabled: isReady,
    staleTime: 30_000,
  });

  // Don't render anything until we have the minimum parameters
  if (!isReady) {
    return null;
  }

  // Loading state
  if (isLoading) {
    return (
      <div className="space-y-3">
        <h4 className="text-sm font-semibold font-heading text-gray-700 flex items-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin text-primary-500" />
          טוען הצעות שיבוץ...
        </h4>
        <div className="grid gap-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="flex items-center gap-3 p-3 rounded-xl border border-gray-100"
            >
              <SkeletonPulse className="w-10 h-10 rounded-full" />
              <div className="flex-1 space-y-2">
                <SkeletonPulse className="h-4 w-32" />
                <SkeletonPulse className="h-3 w-48" />
              </div>
              <SkeletonPulse className="h-8 w-16 rounded-lg" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Error state
  if (isError) {
    return null;
  }

  // Empty state
  if (!suggestions || suggestions.length === 0) {
    return (
      <div className="text-center py-4 px-3 bg-gray-50 rounded-xl border border-gray-100">
        <UserCheck className="w-8 h-8 mx-auto mb-1.5 text-gray-300" />
        <p className="text-sm text-gray-400">אין הצעות זמינות</p>
      </div>
    );
  }

  // Show up to 5 suggestions
  const topSuggestions = suggestions.slice(0, 5);

  return (
    <div className="space-y-3">
      <div className="section-header">
        <div className="section-header-icon bg-gradient-to-br from-primary-100 to-primary-50">
          <Star className="w-4 h-4 text-primary-600" />
        </div>
        <h4 className="section-header-title text-sm">
          הצעות שיבוץ חכם
        </h4>
        <span className="text-xs font-normal text-gray-400 mr-2">
          ({topSuggestions.length} הצעות)
        </span>
      </div>

      <div className="grid gap-2">
        {topSuggestions.map((suggestion) => (
          <div
            key={suggestion.employee_id}
            className="card flex items-center gap-3 p-3 hover:shadow-card-hover transition-all duration-200"
          >
            {/* Avatar / score circle */}
            <div className="relative flex-shrink-0">
              <div
                className={`w-11 h-11 rounded-full flex items-center justify-center text-white font-bold font-heading text-sm shadow-md ${getScoreGradient(
                  suggestion.score
                )}`}
              >
                {suggestion.score}
              </div>
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <p className="font-medium font-heading text-gray-900 text-sm truncate">
                {suggestion.employee_name}
              </p>

              {/* Score bar */}
              <div className="flex items-center gap-2 mt-1">
                <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden max-w-[120px]">
                  <div
                    className={`h-full rounded-full transition-all ${getScoreBarColor(
                      suggestion.score
                    )}`}
                    style={{ width: `${suggestion.score}%` }}
                  />
                </div>
                <span
                  className={`text-xs font-semibold ${getScoreTextColor(
                    suggestion.score
                  )}`}
                >
                  {suggestion.score}%
                </span>
              </div>

              {/* Reason badges */}
              {suggestion.reasons.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1.5">
                  {suggestion.reasons.map((reason) => (
                    <span
                      key={reason}
                      className={`${
                        reasonBadgeClasses[reason] || 'badge-gray'
                      } text-[10px]`}
                    >
                      {reasonLabels[reason] || reason}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Assign button */}
            <button
              onClick={() => onAssign(suggestion.employee_id)}
              className="btn-primary text-xs px-3 py-1.5 flex items-center gap-1 flex-shrink-0"
            >
              <UserCheck className="w-3.5 h-3.5" />
              שבץ
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
