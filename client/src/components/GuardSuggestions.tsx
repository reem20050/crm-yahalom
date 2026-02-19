import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { UserCheck, Star, Loader2, MapPin, AlertTriangle, Shield } from 'lucide-react';
import { shiftsApi } from '../services/api';
import { SkeletonPulse } from './Skeleton';

// ── Types ───────────────────────────────────────────────────────────────────

interface ScoreBreakdown {
  base: number;
  preferred: number;
  geographic: number;
  performance: number;
  workload: number;
  fatigue: number;
  specialization: number;
  team_cohesion: number;
  reliability: number;
  weapon_bonus: number;
}

interface GuardSuggestion {
  employee_id: string;
  employee_name: string;
  phone?: string;
  score: number;
  reasons: string[];
  score_breakdown?: ScoreBreakdown;
  weekly_shifts?: number;
  is_preferred?: boolean;
  distance_km?: number | null;
  avg_rating?: number | null;
  fatigue_warning?: boolean;
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

const reasonBadgeClasses: Record<string, string> = {
  preferred: 'bg-purple-100 text-purple-700 border border-purple-200',
  geographic: 'bg-blue-100 text-blue-700 border border-blue-200',
  performance: 'bg-amber-100 text-amber-700 border border-amber-200',
  team_cohesion: 'bg-teal-100 text-teal-700 border border-teal-200',
  reliable: 'bg-green-100 text-green-700 border border-green-200',
  fatigue_risk: 'bg-red-100 text-red-700 border border-red-200',
  weapon: 'bg-gray-100 text-gray-700 border border-gray-200',
  workload: 'bg-indigo-100 text-indigo-700 border border-indigo-200',
  specialization: 'bg-cyan-100 text-cyan-700 border border-cyan-200',
};

function classifyReason(reason: string): string {
  if (reason.includes('מועדף')) return 'preferred';
  if (reason.includes('ק"מ') || reason.includes('קרוב') || reason.includes('רחוק') || reason.includes('מרחק')) return 'geographic';
  if (reason.includes('דירוג')) return 'performance';
  if (reason.includes('היכרות')) return 'team_cohesion';
  if (reason.includes('אמינות')) return 'fatigue_risk';
  if (reason.includes('עומס יתר')) return 'fatigue_risk';
  if (reason.includes('נשק') || reason.includes('רישיון')) return 'weapon';
  if (reason.includes('משמרות') || reason.includes('ללא')) return 'workload';
  if (reason.includes('מוסמך')) return 'specialization';
  return 'workload';
}

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

function renderStars(rating: number): string {
  const full = Math.floor(rating);
  const half = rating - full >= 0.5;
  let stars = '';
  for (let i = 0; i < 5; i++) {
    if (i < full) stars += '\u2605';
    else if (i === full && half) stars += '\u2605';
    else stars += '\u2606';
  }
  return stars;
}

// ── Score Breakdown Labels ──────────────────────────────────────────────────

const breakdownLabels: Record<string, string> = {
  base: 'בסיס',
  preferred: 'עובד מועדף',
  geographic: 'קרבה גיאוגרפית',
  performance: 'ביצועים',
  workload: 'עומס עבודה',
  fatigue: 'עייפות',
  specialization: 'התמחות',
  team_cohesion: 'היכרות עם האתר',
  reliability: 'אמינות',
  weapon_bonus: 'רישיון נשק',
};

// ── Tooltip Component ───────────────────────────────────────────────────────

function ScoreTooltip({ breakdown }: { breakdown: ScoreBreakdown }) {
  return (
    <div
      className="absolute z-50 bottom-full right-0 mb-2 w-56 bg-gray-900 text-white text-xs rounded-xl shadow-xl p-3 pointer-events-none"
      style={{ direction: 'rtl' }}
    >
      <div className="font-heading font-semibold mb-2 text-gray-200">פירוט ניקוד</div>
      <div className="space-y-1">
        {Object.entries(breakdown).map(([key, value]) => {
          if (value === 0 && key !== 'base') return null;
          return (
            <div key={key} className="flex justify-between items-center">
              <span className="text-gray-300">{breakdownLabels[key] || key}</span>
              <span className={`font-mono font-bold ${value > 0 ? 'text-green-400' : value < 0 ? 'text-red-400' : 'text-gray-400'}`}>
                {value > 0 ? `+${value}` : value}
              </span>
            </div>
          );
        })}
      </div>
      <div className="border-t border-gray-700 mt-2 pt-1.5 flex justify-between font-bold">
        <span>סה"כ</span>
        <span className="text-yellow-300">
          {Object.values(breakdown).reduce((sum, v) => sum + v, 0)}
        </span>
      </div>
      {/* Arrow */}
      <div className="absolute top-full right-4 w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[6px] border-t-gray-900" />
    </div>
  );
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
  const [hoveredId, setHoveredId] = useState<string | null>(null);

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
            {/* Avatar / score circle with tooltip on hover */}
            <div
              className="relative flex-shrink-0"
              onMouseEnter={() => setHoveredId(suggestion.employee_id)}
              onMouseLeave={() => setHoveredId(null)}
            >
              <div
                className={`w-11 h-11 rounded-full flex items-center justify-center text-white font-bold font-heading text-sm shadow-md cursor-help ${getScoreGradient(
                  suggestion.score
                )}`}
              >
                {suggestion.score}
              </div>
              {/* Fatigue warning overlay */}
              {suggestion.fatigue_warning && (
                <div className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center shadow-sm">
                  <AlertTriangle className="w-3 h-3 text-white" />
                </div>
              )}
              {/* Score breakdown tooltip */}
              {hoveredId === suggestion.employee_id && suggestion.score_breakdown && (
                <ScoreTooltip breakdown={suggestion.score_breakdown} />
              )}
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="font-medium font-heading text-gray-900 text-sm truncate">
                  {suggestion.employee_name}
                </p>
                {suggestion.is_preferred && (
                  <Shield className="w-3.5 h-3.5 text-purple-500 flex-shrink-0" />
                )}
              </div>

              {/* Meta row: distance + rating + fatigue */}
              <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                {/* Distance badge */}
                {suggestion.distance_km != null && (
                  <span className="inline-flex items-center gap-0.5 text-[10px] text-blue-600 bg-blue-50 rounded-full px-1.5 py-0.5">
                    <MapPin className="w-2.5 h-2.5" />
                    {suggestion.distance_km} ק&quot;מ
                  </span>
                )}

                {/* Star rating */}
                {suggestion.avg_rating != null && suggestion.avg_rating > 0 && (
                  <span className="inline-flex items-center gap-0.5 text-[10px] text-amber-600 bg-amber-50 rounded-full px-1.5 py-0.5">
                    <span className="leading-none">{renderStars(suggestion.avg_rating)}</span>
                    <span className="font-semibold">{suggestion.avg_rating}</span>
                  </span>
                )}

                {/* Fatigue warning */}
                {suggestion.fatigue_warning && (
                  <span className="inline-flex items-center gap-0.5 text-[10px] text-red-600 bg-red-50 rounded-full px-1.5 py-0.5">
                    <AlertTriangle className="w-2.5 h-2.5" />
                    סיכון עייפות
                  </span>
                )}
              </div>

              {/* Score bar */}
              <div className="flex items-center gap-2 mt-1">
                <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden max-w-[120px]">
                  <div
                    className={`h-full rounded-full transition-all ${getScoreBarColor(
                      suggestion.score
                    )}`}
                    style={{ width: `${Math.min(100, suggestion.score)}%` }}
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
                  {suggestion.reasons.map((reason) => {
                    const category = classifyReason(reason);
                    return (
                      <span
                        key={reason}
                        className={`${
                          reasonBadgeClasses[category] || 'bg-gray-100 text-gray-600 border border-gray-200'
                        } text-[10px] rounded-full px-1.5 py-0.5`}
                      >
                        {reason}
                      </span>
                    );
                  })}
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
