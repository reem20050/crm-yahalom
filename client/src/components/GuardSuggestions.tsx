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

const reasonColors: Record<string, string> = {
  available: 'bg-green-100 text-green-700',
  certified: 'bg-blue-100 text-blue-700',
  preferred: 'bg-purple-100 text-purple-700',
  low_workload: 'bg-teal-100 text-teal-700',
  nearby: 'bg-cyan-100 text-cyan-700',
};

function getScoreColor(score: number): string {
  if (score >= 80) return 'bg-green-500';
  if (score >= 60) return 'bg-blue-500';
  if (score >= 40) return 'bg-yellow-500';
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
        <h4 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
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
      <h4 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
        <Star className="w-4 h-4 text-blue-500" />
        הצעות שיבוץ חכם
        <span className="text-xs font-normal text-gray-400">
          ({topSuggestions.length} הצעות)
        </span>
      </h4>

      <div className="grid gap-2">
        {topSuggestions.map((suggestion) => (
          <div
            key={suggestion.employee_id}
            className="flex items-center gap-3 p-3 rounded-xl border border-blue-100 bg-gradient-to-l from-blue-50/40 to-green-50/30 hover:shadow-sm transition-shadow"
          >
            {/* Avatar / score circle */}
            <div className="relative flex-shrink-0">
              <div
                className={`w-11 h-11 rounded-full flex items-center justify-center text-white font-bold text-sm ${getScoreColor(
                  suggestion.score
                )}`}
              >
                {suggestion.score}
              </div>
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <p className="font-medium text-gray-900 text-sm truncate">
                {suggestion.employee_name}
              </p>

              {/* Score bar */}
              <div className="flex items-center gap-2 mt-1">
                <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden max-w-[120px]">
                  <div
                    className={`h-full rounded-full transition-all ${getScoreColor(
                      suggestion.score
                    )}`}
                    style={{ width: `${suggestion.score}%` }}
                  />
                </div>
                <span
                  className={`text-xs font-medium ${getScoreTextColor(
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
                      className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-medium ${
                        reasonColors[reason] || 'bg-gray-100 text-gray-600'
                      }`}
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
