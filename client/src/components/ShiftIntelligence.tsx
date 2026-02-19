import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import {
  Brain,
  AlertTriangle,
  Users,
  TrendingUp,
  Calendar,
  RefreshCw,
  ArrowUpRight,
  ArrowDownRight,
  Clock,
  Shield,
  MapPin,
  Zap,
} from 'lucide-react';
import { intelligenceApi } from '../services/api';
import { SkeletonPulse } from './Skeleton';

// ── Types ──────────────────────────────────────────────────────────────────

interface ShortagePattern {
  site_id: string;
  site_name: string;
  day_of_week: number;
  total_shifts: number;
  understaffed_count: number;
  rate: number;
}

interface FatigueRisk {
  employee_id: string;
  employee_name: string;
  weekly_shifts: number;
  min_rest_gap_hours: number | null;
  weekly_hours: number;
  risk_level: 'high' | 'medium' | 'low';
  risk_factors: string[];
}

interface StaffingSuggestion {
  site_id: string;
  site_name: string;
  day_of_week: number;
  current_required: number;
  suggested_required: number;
  no_show_rate: number;
  avg_assigned: number;
}

interface HeatmapSite {
  site_id: string;
  site_name: string;
  days: Record<number, { total: number; understaffed: number; rate: number }>;
}

interface WeeklyInsights {
  analysis_date: string;
  details: string | {
    date: string;
    shortage_sites: number;
    fatigue_risk_employees: number;
    optimization_opportunities: number;
    high_no_show_sites: number;
    declining_ratings_count: number;
    overtime_employees_count: number;
    details: {
      shortages: ShortagePattern[];
      fatigue: FatigueRisk[];
      staffing: StaffingSuggestion[];
    };
  };
  severity: string;
  created_at: string;
}

// ── Helpers ────────────────────────────────────────────────────────────────

const DAY_NAMES: Record<number, string> = {
  0: '\u05D0\u05F3', // א'
  1: '\u05D1\u05F3', // ב'
  2: '\u05D2\u05F3', // ג'
  3: '\u05D3\u05F3', // ד'
  4: '\u05D4\u05F3', // ה'
  5: '\u05D5\u05F3', // ו'
  6: '\u05E9\u05F3', // ש'
};

const DAY_FULL_NAMES: Record<number, string> = {
  0: '\u05E8\u05D0\u05E9\u05D5\u05DF', // ראשון
  1: '\u05E9\u05E0\u05D9', // שני
  2: '\u05E9\u05DC\u05D9\u05E9\u05D9', // שלישי
  3: '\u05E8\u05D1\u05D9\u05E2\u05D9', // רביעי
  4: '\u05D7\u05DE\u05D9\u05E9\u05D9', // חמישי
  5: '\u05E9\u05D9\u05E9\u05D9', // שישי
  6: '\u05E9\u05D1\u05EA', // שבת
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

function getRateColor(rate: number): string {
  if (rate <= 10) return 'bg-green-100 text-green-800';
  if (rate <= 30) return 'bg-yellow-100 text-yellow-800';
  if (rate <= 50) return 'bg-orange-100 text-orange-800';
  return 'bg-red-100 text-red-800';
}

function getRateBg(rate: number): string {
  if (rate <= 10) return 'bg-green-50';
  if (rate <= 30) return 'bg-yellow-50';
  if (rate <= 50) return 'bg-orange-50';
  return 'bg-red-50';
}

function getRiskBadge(level: string): string {
  switch (level) {
    case 'high': return 'bg-red-100 text-red-700';
    case 'medium': return 'bg-amber-100 text-amber-700';
    default: return 'bg-green-100 text-green-700';
  }
}

function getRiskLabel(level: string): string {
  switch (level) {
    case 'high': return '\u05D2\u05D1\u05D5\u05D4'; // גבוה
    case 'medium': return '\u05D1\u05D9\u05E0\u05D5\u05E0\u05D9'; // בינוני
    default: return '\u05E0\u05DE\u05D5\u05DA'; // נמוך
  }
}

// ── Component ──────────────────────────────────────────────────────────────

export default function ShiftIntelligence() {
  const queryClient = useQueryClient();
  const [activeSection, setActiveSection] = useState<string | null>(null);

  // Fetch latest insights
  const { data: insightsData, isLoading: insightsLoading } = useQuery({
    queryKey: ['intelligence-insights'],
    queryFn: async () => {
      const res = await intelligenceApi.getInsights();
      return res.data?.insights as WeeklyInsights | null;
    },
  });

  // Fetch shortage heatmap
  const { data: heatmapData, isLoading: heatmapLoading } = useQuery({
    queryKey: ['intelligence-heatmap'],
    queryFn: async () => {
      const res = await intelligenceApi.getHeatmap();
      return (res.data?.heatmap || []) as HeatmapSite[];
    },
  });

  // Fetch fatigue risks
  const { data: fatigueData, isLoading: fatigueLoading } = useQuery({
    queryKey: ['intelligence-fatigue'],
    queryFn: async () => {
      const res = await intelligenceApi.getFatigue();
      return (res.data?.fatigue || []) as FatigueRisk[];
    },
  });

  // Fetch staffing suggestions
  const { data: staffingData, isLoading: staffingLoading } = useQuery({
    queryKey: ['intelligence-staffing'],
    queryFn: async () => {
      const res = await intelligenceApi.getStaffing();
      return (res.data?.staffing || []) as StaffingSuggestion[];
    },
  });

  // Generate insights mutation
  const generateMutation = useMutation({
    mutationFn: () => intelligenceApi.generateInsights(),
    onSuccess: () => {
      toast.success('\u05E0\u05D9\u05EA\u05D5\u05D7 \u05E9\u05D1\u05D5\u05E2\u05D9 \u05D7\u05D5\u05DC\u05DC \u05D1\u05D4\u05E6\u05DC\u05D7\u05D4'); // ניתוח שבועי חולל בהצלחה
      queryClient.invalidateQueries({ queryKey: ['intelligence-insights'] });
      queryClient.invalidateQueries({ queryKey: ['intelligence-heatmap'] });
      queryClient.invalidateQueries({ queryKey: ['intelligence-fatigue'] });
      queryClient.invalidateQueries({ queryKey: ['intelligence-staffing'] });
    },
    onError: () => {
      toast.error('\u05E9\u05D2\u05D9\u05D0\u05D4 \u05D1\u05D9\u05E6\u05D9\u05E8\u05EA \u05E0\u05D9\u05EA\u05D5\u05D7'); // שגיאה ביצירת ניתוח
    },
  });

  // Parse insights details
  const parsedInsights = insightsData?.details
    ? typeof insightsData.details === 'string'
      ? JSON.parse(insightsData.details)
      : insightsData.details
    : null;

  // Group staffing by site
  const staffingBySite: Record<string, StaffingSuggestion[]> = {};
  if (staffingData) {
    for (const s of staffingData) {
      if (!staffingBySite[s.site_id]) staffingBySite[s.site_id] = [];
      staffingBySite[s.site_id].push(s);
    }
  }

  const optimizationCount = staffingData
    ? staffingData.filter(s => s.suggested_required !== s.current_required).length
    : 0;

  return (
    <div className="space-y-6">
      {/* Section Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-gradient-to-br from-violet-100 to-violet-50 rounded-xl flex items-center justify-center">
          <Brain className="w-5 h-5 text-violet-600" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-gray-900 font-heading">
            {'\u05D0\u05D9\u05E0\u05D8\u05DC\u05D9\u05D2\u05E0\u05E6\u05D9\u05D9\u05EA \u05DE\u05E9\u05DE\u05E8\u05D5\u05EA'}
            {/* אינטליגנציית משמרות */}
          </h2>
          <p className="text-gray-500 text-sm">
            {'\u05E0\u05D9\u05EA\u05D5\u05D7 \u05D3\u05E4\u05D5\u05E1\u05D9\u05DD, \u05DE\u05D7\u05E1\u05D5\u05E8\u05D9\u05DD \u05D5\u05D4\u05DE\u05DC\u05E6\u05D5\u05EA \u05D0\u05D5\u05E4\u05D8\u05D9\u05DE\u05D9\u05D6\u05E6\u05D9\u05D4'}
            {/* ניתוח דפוסים, מחסורים והמלצות אופטימיזציה */}
          </p>
        </div>
      </div>

      {/* ── Summary Cards ───────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Shortage Sites */}
        <div
          className="card cursor-pointer hover:shadow-md transition-shadow border-r-4 border-r-amber-400"
          onClick={() => setActiveSection(activeSection === 'heatmap' ? null : 'heatmap')}
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-amber-50 rounded-lg flex items-center justify-center">
              <MapPin className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">
                {insightsLoading ? (
                  <SkeletonPulse className="h-7 w-10" />
                ) : (
                  (parsedInsights?.shortage_sites ?? heatmapData?.filter(
                    (s: HeatmapSite) => Object.values(s.days).some(d => d.rate > 30)
                  ).length ?? 0).toLocaleString('he-IL')
                )}
              </p>
              <p className="text-xs text-gray-500">
                {'\u05D0\u05EA\u05E8\u05D9\u05DD \u05E2\u05DD \u05DE\u05D7\u05E1\u05D5\u05E8'}
                {/* אתרים עם מחסור */}
              </p>
            </div>
          </div>
        </div>

        {/* Fatigue Risk */}
        <div
          className="card cursor-pointer hover:shadow-md transition-shadow border-r-4 border-r-red-400"
          onClick={() => setActiveSection(activeSection === 'fatigue' ? null : 'fatigue')}
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-red-50 rounded-lg flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">
                {fatigueLoading ? (
                  <SkeletonPulse className="h-7 w-10" />
                ) : (
                  (fatigueData?.length ?? 0).toLocaleString('he-IL')
                )}
              </p>
              <p className="text-xs text-gray-500">
                {'\u05E2\u05D5\u05D1\u05D3\u05D9\u05DD \u05D1\u05E1\u05D9\u05DB\u05D5\u05DF \u05E2\u05D9\u05D9\u05E4\u05D5\u05EA'}
                {/* עובדים בסיכון עייפות */}
              </p>
            </div>
          </div>
        </div>

        {/* Optimization Opportunities */}
        <div
          className="card cursor-pointer hover:shadow-md transition-shadow border-r-4 border-r-emerald-400"
          onClick={() => setActiveSection(activeSection === 'staffing' ? null : 'staffing')}
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-emerald-50 rounded-lg flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">
                {staffingLoading ? (
                  <SkeletonPulse className="h-7 w-10" />
                ) : (
                  optimizationCount.toLocaleString('he-IL')
                )}
              </p>
              <p className="text-xs text-gray-500">
                {'\u05D4\u05D6\u05D3\u05DE\u05E0\u05D5\u05D9\u05D5\u05EA \u05D0\u05D5\u05E4\u05D8\u05D9\u05DE\u05D9\u05D6\u05E6\u05D9\u05D4'}
                {/* הזדמנויות אופטימיזציה */}
              </p>
            </div>
          </div>
        </div>

        {/* Last Analysis */}
        <div
          className="card cursor-pointer hover:shadow-md transition-shadow border-r-4 border-r-blue-400"
          onClick={() => setActiveSection(activeSection === 'insights' ? null : 'insights')}
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center">
              <Calendar className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm font-bold text-gray-900">
                {insightsLoading ? (
                  <SkeletonPulse className="h-5 w-24" />
                ) : insightsData?.created_at ? (
                  formatDate(insightsData.created_at)
                ) : (
                  '\u05D8\u05E8\u05DD \u05D1\u05D5\u05E6\u05E2' /* טרם בוצע */
                )}
              </p>
              <p className="text-xs text-gray-500">
                {'\u05E0\u05D9\u05EA\u05D5\u05D7 \u05D0\u05D7\u05E8\u05D5\u05DF'}
                {/* ניתוח אחרון */}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Shortage Heatmap ────────────────────────────────────────── */}
      {(activeSection === 'heatmap' || activeSection === null) && (
        <div className="card">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 bg-gradient-to-br from-amber-100 to-orange-50 rounded-lg flex items-center justify-center">
              <MapPin className="w-4 h-4 text-amber-600" />
            </div>
            <h3 className="font-semibold text-gray-900 font-heading">
              {'\u05DE\u05E4\u05EA \u05D7\u05D5\u05DD \u05DE\u05D7\u05E1\u05D5\u05E8\u05D9\u05DD'}
              {/* מפת חום מחסורים */}
            </h3>
          </div>

          {heatmapLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <SkeletonPulse key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : !heatmapData || heatmapData.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              <MapPin className="w-10 h-10 mx-auto mb-2 opacity-40" />
              <p className="text-sm">{'\u05D0\u05D9\u05DF \u05E0\u05EA\u05D5\u05E0\u05D9 \u05DE\u05D7\u05E1\u05D5\u05E8\u05D9\u05DD'}</p>
              {/* אין נתוני מחסורים */}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-right py-2 px-3 font-medium text-gray-500 min-w-[120px]">
                      {'\u05D0\u05EA\u05E8'}
                      {/* אתר */}
                    </th>
                    {[0, 1, 2, 3, 4, 5, 6].map(day => (
                      <th key={day} className="text-center py-2 px-2 font-medium text-gray-500 w-16">
                        {DAY_NAMES[day]}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {heatmapData.map((site: HeatmapSite) => (
                    <tr key={site.site_id} className="hover:bg-gray-50 transition-colors">
                      <td className="py-2 px-3 font-medium text-gray-900 text-sm">
                        {site.site_name}
                      </td>
                      {[0, 1, 2, 3, 4, 5, 6].map(day => {
                        const dayData = site.days[day];
                        if (!dayData) {
                          return (
                            <td key={day} className="text-center py-2 px-2">
                              <span className="text-gray-300 text-xs">-</span>
                            </td>
                          );
                        }
                        return (
                          <td key={day} className="text-center py-2 px-2">
                            <span
                              className={`inline-flex items-center justify-center w-12 h-7 rounded text-xs font-medium ${getRateColor(dayData.rate)}`}
                              title={`${DAY_FULL_NAMES[day]}: ${dayData.understaffed}/${dayData.total} \u05DE\u05E9\u05DE\u05E8\u05D5\u05EA \u05D7\u05E1\u05E8\u05D5\u05EA`}
                            >
                              {dayData.rate}%
                            </span>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Legend */}
              <div className="flex items-center gap-4 mt-3 pt-3 border-t border-gray-100 text-xs text-gray-500">
                <span className="font-medium">{'\u05DE\u05E7\u05E8\u05D0'} {/* מקרא */}:</span>
                <span className="flex items-center gap-1">
                  <span className="w-4 h-4 rounded bg-green-100"></span> 0-10%
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-4 h-4 rounded bg-yellow-100"></span> 10-30%
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-4 h-4 rounded bg-orange-100"></span> 30-50%
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-4 h-4 rounded bg-red-100"></span> 50%+
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Fatigue Risk List ───────────────────────────────────────── */}
      {(activeSection === 'fatigue' || activeSection === null) && (
        <div className="card">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 bg-gradient-to-br from-red-100 to-red-50 rounded-lg flex items-center justify-center">
              <AlertTriangle className="w-4 h-4 text-red-600" />
            </div>
            <h3 className="font-semibold text-gray-900 font-heading">
              {'\u05E1\u05D9\u05DB\u05D5\u05DF \u05E2\u05D9\u05D9\u05E4\u05D5\u05EA'}
              {/* סיכון עייפות */}
            </h3>
          </div>

          {fatigueLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <SkeletonPulse key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : !fatigueData || fatigueData.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              <Shield className="w-10 h-10 mx-auto mb-2 opacity-40" />
              <p className="text-sm">
                {'\u05D0\u05D9\u05DF \u05E2\u05D5\u05D1\u05D3\u05D9\u05DD \u05D1\u05E1\u05D9\u05DB\u05D5\u05DF \u05E2\u05D9\u05D9\u05E4\u05D5\u05EA'}
                {/* אין עובדים בסיכון עייפות */}
              </p>
            </div>
          ) : (
            <div className="table-container">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 text-gray-500">
                    <th className="text-right py-3 px-3 font-medium">
                      {'\u05E9\u05DD' /* שם */}
                    </th>
                    <th className="text-right py-3 px-3 font-medium">
                      {'\u05DE\u05E9\u05DE\u05E8\u05D5\u05EA \u05E9\u05D1\u05D5\u05E2\u05D9\u05D5\u05EA' /* משמרות שבועיות */}
                    </th>
                    <th className="text-right py-3 px-3 font-medium">
                      {'\u05DE\u05E0\u05D5\u05D7\u05D4 \u05DE\u05D9\u05E0. (\u05E9\u05E2\u05D5\u05EA)' /* מנוחה מינ. (שעות) */}
                    </th>
                    <th className="text-right py-3 px-3 font-medium">
                      {'\u05E9\u05E2\u05D5\u05EA \u05E9\u05D1\u05D5\u05E2\u05D9\u05D5\u05EA' /* שעות שבועיות */}
                    </th>
                    <th className="text-right py-3 px-3 font-medium">
                      {'\u05E8\u05DE\u05EA \u05E1\u05D9\u05DB\u05D5\u05DF' /* רמת סיכון */}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {fatigueData.map((emp: FatigueRisk) => (
                    <tr key={emp.employee_id} className={`hover:bg-gray-50 transition-colors ${emp.risk_level === 'high' ? 'bg-red-50/30' : ''}`}>
                      <td className="py-3 px-3 font-medium text-gray-900">
                        <div className="flex items-center gap-2">
                          <Users className="w-4 h-4 text-gray-400" />
                          {emp.employee_name}
                        </div>
                      </td>
                      <td className="py-3 px-3 text-gray-700">
                        {emp.weekly_shifts.toLocaleString('he-IL')}
                      </td>
                      <td className="py-3 px-3">
                        {emp.min_rest_gap_hours !== null ? (
                          <span className={emp.min_rest_gap_hours < 8 ? 'text-red-600 font-medium' : 'text-gray-700'}>
                            {emp.min_rest_gap_hours.toLocaleString('he-IL')}
                          </span>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="py-3 px-3">
                        <span className={emp.weekly_hours > 50 ? 'text-red-600 font-medium' : 'text-gray-700'}>
                          {emp.weekly_hours.toLocaleString('he-IL')}
                        </span>
                      </td>
                      <td className="py-3 px-3">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${getRiskBadge(emp.risk_level)}`}>
                          {emp.risk_level === 'high' && <AlertTriangle className="w-3 h-3" />}
                          {getRiskLabel(emp.risk_level)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── Optimal Staffing Suggestions ────────────────────────────── */}
      {(activeSection === 'staffing' || activeSection === null) && (
        <div className="card">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 bg-gradient-to-br from-emerald-100 to-emerald-50 rounded-lg flex items-center justify-center">
              <TrendingUp className="w-4 h-4 text-emerald-600" />
            </div>
            <h3 className="font-semibold text-gray-900 font-heading">
              {'\u05D4\u05DE\u05DC\u05E6\u05D5\u05EA \u05D0\u05D9\u05D5\u05E9 \u05D0\u05D5\u05E4\u05D8\u05D9\u05DE\u05DC\u05D9'}
              {/* המלצות איוש אופטימלי */}
            </h3>
          </div>

          {staffingLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <SkeletonPulse key={i} className="h-32 w-full" />
              ))}
            </div>
          ) : !staffingData || Object.keys(staffingBySite).length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              <TrendingUp className="w-10 h-10 mx-auto mb-2 opacity-40" />
              <p className="text-sm">
                {'\u05D0\u05D9\u05DF \u05D4\u05DE\u05DC\u05E6\u05D5\u05EA \u05D0\u05D5\u05E4\u05D8\u05D9\u05DE\u05D9\u05D6\u05E6\u05D9\u05D4'}
                {/* אין המלצות אופטימיזציה */}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {Object.entries(staffingBySite).map(([siteId, suggestions]) => {
                const siteName = suggestions[0]?.site_name || siteId;
                const hasChanges = suggestions.some(s => s.suggested_required !== s.current_required);

                return (
                  <div
                    key={siteId}
                    className={`rounded-xl border p-4 ${hasChanges ? 'border-emerald-200 bg-emerald-50/30' : 'border-gray-200 bg-gray-50/30'}`}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="font-semibold text-gray-900 flex items-center gap-2">
                        <MapPin className="w-4 h-4 text-gray-400" />
                        {siteName}
                      </h4>
                      {hasChanges && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded-full text-xs font-medium">
                          <Zap className="w-3 h-3" />
                          {'\u05E9\u05D9\u05E0\u05D5\u05D9 \u05DE\u05D5\u05DE\u05DC\u05E5' /* שינוי מומלץ */}
                        </span>
                      )}
                    </div>

                    <div className="space-y-1.5">
                      {suggestions.map((s, idx) => (
                        <div
                          key={idx}
                          className={`flex items-center justify-between text-sm px-2 py-1 rounded ${
                            s.suggested_required !== s.current_required ? getRateBg(s.no_show_rate * 100) : ''
                          }`}
                        >
                          <span className="text-gray-600">{DAY_FULL_NAMES[s.day_of_week]}</span>
                          <div className="flex items-center gap-3">
                            <span className="text-gray-500 text-xs">
                              {'\u05D0\u05D9 \u05D4\u05D2\u05E2\u05D4' /* אי הגעה */}: {(s.no_show_rate * 100).toFixed(0)}%
                            </span>
                            <span className="flex items-center gap-1 font-medium">
                              <span className="text-gray-700">{s.current_required}</span>
                              {s.suggested_required !== s.current_required && (
                                <>
                                  {s.suggested_required > s.current_required ? (
                                    <ArrowUpRight className="w-3.5 h-3.5 text-amber-500" />
                                  ) : (
                                    <ArrowDownRight className="w-3.5 h-3.5 text-emerald-500" />
                                  )}
                                  <span className="text-emerald-700 font-bold">{s.suggested_required}</span>
                                </>
                              )}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Weekly Insights ──────────────────────────────────────────── */}
      {(activeSection === 'insights' || activeSection === null) && (
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-gradient-to-br from-blue-100 to-blue-50 rounded-lg flex items-center justify-center">
                <Brain className="w-4 h-4 text-blue-600" />
              </div>
              <h3 className="font-semibold text-gray-900 font-heading">
                {'\u05E1\u05D9\u05DB\u05D5\u05DD \u05E9\u05D1\u05D5\u05E2\u05D9'}
                {/* סיכום שבועי */}
              </h3>
            </div>
            <button
              onClick={() => generateMutation.mutate()}
              disabled={generateMutation.isPending}
              className="btn-primary flex items-center gap-2 text-sm"
            >
              {generateMutation.isPending ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <Zap className="w-4 h-4" />
              )}
              {generateMutation.isPending
                ? '\u05DE\u05E0\u05EA\u05D7...' /* מנתח... */
                : '\u05D7\u05D5\u05DC\u05DC \u05E0\u05D9\u05EA\u05D5\u05D7 \u05D7\u05D3\u05E9' /* חולל ניתוח חדש */
              }
            </button>
          </div>

          {insightsLoading ? (
            <div className="space-y-3">
              <SkeletonPulse className="h-6 w-48" />
              <SkeletonPulse className="h-16 w-full" />
            </div>
          ) : !parsedInsights ? (
            <div className="text-center py-8 text-gray-400">
              <Brain className="w-10 h-10 mx-auto mb-2 opacity-40" />
              <p className="text-sm mb-3">
                {'\u05D8\u05E8\u05DD \u05D1\u05D5\u05E6\u05E2 \u05E0\u05D9\u05EA\u05D5\u05D7 \u05E9\u05D1\u05D5\u05E2\u05D9'}
                {/* טרם בוצע ניתוח שבועי */}
              </p>
              <p className="text-xs text-gray-400">
                {'\u05DC\u05D7\u05E5 \u05E2\u05DC "\u05D7\u05D5\u05DC\u05DC \u05E0\u05D9\u05EA\u05D5\u05D7 \u05D7\u05D3\u05E9" \u05DC\u05D9\u05E6\u05D9\u05E8\u05EA \u05D4\u05E0\u05D9\u05EA\u05D5\u05D7 \u05D4\u05E8\u05D0\u05E9\u05D5\u05DF'}
                {/* לחץ על "חולל ניתוח חדש" ליצירת הניתוח הראשון */}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Analysis date */}
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <Clock className="w-4 h-4" />
                <span>
                  {'\u05EA\u05D0\u05E8\u05D9\u05DA \u05E0\u05D9\u05EA\u05D5\u05D7' /* תאריך ניתוח */}: {insightsData?.created_at ? formatDate(insightsData.created_at) : parsedInsights.date}
                </span>
              </div>

              {/* Key metrics grid */}
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                <div className="bg-amber-50 rounded-lg p-3">
                  <div className="text-lg font-bold text-amber-800">
                    {(parsedInsights.shortage_sites ?? 0).toLocaleString('he-IL')}
                  </div>
                  <div className="text-xs text-amber-600">
                    {'\u05D0\u05EA\u05E8\u05D9\u05DD \u05D7\u05E1\u05E8\u05D9\u05DD' /* אתרים חסרים */}
                  </div>
                </div>
                <div className="bg-red-50 rounded-lg p-3">
                  <div className="text-lg font-bold text-red-800">
                    {(parsedInsights.fatigue_risk_employees ?? 0).toLocaleString('he-IL')}
                  </div>
                  <div className="text-xs text-red-600">
                    {'\u05E1\u05D9\u05DB\u05D5\u05DF \u05E2\u05D9\u05D9\u05E4\u05D5\u05EA' /* סיכון עייפות */}
                  </div>
                </div>
                <div className="bg-emerald-50 rounded-lg p-3">
                  <div className="text-lg font-bold text-emerald-800">
                    {(parsedInsights.optimization_opportunities ?? 0).toLocaleString('he-IL')}
                  </div>
                  <div className="text-xs text-emerald-600">
                    {'\u05D0\u05D5\u05E4\u05D8\u05D9\u05DE\u05D9\u05D6\u05E6\u05D9\u05D5\u05EA' /* אופטימיזציות */}
                  </div>
                </div>
                {parsedInsights.high_no_show_sites > 0 && (
                  <div className="bg-orange-50 rounded-lg p-3">
                    <div className="text-lg font-bold text-orange-800">
                      {parsedInsights.high_no_show_sites.toLocaleString('he-IL')}
                    </div>
                    <div className="text-xs text-orange-600">
                      {'\u05D0\u05EA\u05E8\u05D9\u05DD \u05D0\u05D9-\u05D4\u05D2\u05E2\u05D4 \u05D2\u05D1\u05D5\u05D4\u05D4' /* אתרים אי-הגעה גבוהה */}
                    </div>
                  </div>
                )}
                {parsedInsights.declining_ratings_count > 0 && (
                  <div className="bg-purple-50 rounded-lg p-3">
                    <div className="text-lg font-bold text-purple-800">
                      {parsedInsights.declining_ratings_count.toLocaleString('he-IL')}
                    </div>
                    <div className="text-xs text-purple-600">
                      {'\u05D3\u05D9\u05E8\u05D5\u05D2 \u05D9\u05D5\u05E8\u05D3' /* דירוג יורד */}
                    </div>
                  </div>
                )}
                {parsedInsights.overtime_employees_count > 0 && (
                  <div className="bg-indigo-50 rounded-lg p-3">
                    <div className="text-lg font-bold text-indigo-800">
                      {parsedInsights.overtime_employees_count.toLocaleString('he-IL')}
                    </div>
                    <div className="text-xs text-indigo-600">
                      {'\u05E2\u05D5\u05D1\u05D3\u05D9\u05DD \u05D1\u05E9\u05E2\u05D5\u05EA \u05E0\u05D5\u05E1\u05E4\u05D5\u05EA' /* עובדים בשעות נוספות */}
                    </div>
                  </div>
                )}
              </div>

              {/* Severity badge */}
              {insightsData?.severity && insightsData.severity !== 'info' && (
                <div className={`flex items-center gap-2 p-2 rounded-lg ${
                  insightsData.severity === 'critical' ? 'bg-red-50 text-red-700' :
                  insightsData.severity === 'warning' ? 'bg-amber-50 text-amber-700' :
                  'bg-blue-50 text-blue-700'
                }`}>
                  <AlertTriangle className="w-4 h-4" />
                  <span className="text-sm font-medium">
                    {insightsData.severity === 'critical'
                      ? '\u05E0\u05DE\u05E6\u05D0\u05D5 \u05D1\u05E2\u05D9\u05D5\u05EA \u05E7\u05E8\u05D9\u05D8\u05D9\u05D5\u05EA \u05D4\u05D3\u05D5\u05E8\u05E9\u05D5\u05EA \u05D8\u05D9\u05E4\u05D5\u05DC' /* נמצאו בעיות קריטיות הדורשות טיפול */
                      : '\u05E0\u05DE\u05E6\u05D0\u05D5 \u05D1\u05E2\u05D9\u05D5\u05EA \u05E9\u05DE\u05D5\u05DE\u05DC\u05E5 \u05DC\u05D8\u05E4\u05DC \u05D1\u05D4\u05DF' /* נמצאו בעיות שמומלץ לטפל בהן */
                    }
                  </span>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
