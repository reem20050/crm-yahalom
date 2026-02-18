import { useQuery } from '@tanstack/react-query';
import { TrendingUp, TrendingDown, Minus, Target } from 'lucide-react';
import { dashboardApi } from '../services/api';
import { SkeletonStatCard } from './Skeleton';

interface KpiItem {
  key: string;
  label: string;
  value: number;
  prevValue: number | null;
  target: number | null;
  format: 'currency' | 'number' | 'percent';
  invertTrend?: boolean;
}

const formatValue = (value: number, format: string) => {
  if (format === 'currency') return `\u20AA${value.toLocaleString()}`;
  if (format === 'percent') return `${value}%`;
  return value.toLocaleString();
};

const getTrendPercent = (current: number, previous: number | null): number | null => {
  if (previous === null || previous === 0) {
    return current > 0 ? 100 : null;
  }
  return Math.round(((current - previous) / previous) * 100);
};

function KpiCard({ kpi }: { kpi: KpiItem }) {
  const trendPercent = getTrendPercent(kpi.value, kpi.prevValue);
  const isPositiveTrend = trendPercent !== null && trendPercent > 0;
  const isNegativeTrend = trendPercent !== null && trendPercent < 0;

  // For inverted metrics (like incidents), positive trend (more incidents) is bad
  const isGood = kpi.invertTrend
    ? isNegativeTrend
    : isPositiveTrend;
  const isBad = kpi.invertTrend
    ? isPositiveTrend
    : isNegativeTrend;

  const progressPercent = kpi.target
    ? Math.min(Math.round((kpi.value / kpi.target) * 100), 100)
    : null;

  return (
    <div className="bg-white rounded-2xl shadow-card p-5 flex flex-col gap-3 hover:shadow-lg transition-shadow">
      {/* Label */}
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-gray-500">{kpi.label}</span>
        {kpi.target && (
          <div className="flex items-center gap-1 text-xs text-gray-400" title={`יעד: ${formatValue(kpi.target, kpi.format)}`}>
            <Target className="w-3.5 h-3.5" />
          </div>
        )}
      </div>

      {/* Value + Trend */}
      <div className="flex items-end justify-between">
        <span className="text-2xl font-bold text-gray-900">
          {formatValue(kpi.value, kpi.format)}
        </span>

        {trendPercent !== null && (
          <div
            className={`flex items-center gap-0.5 text-xs font-semibold rounded-full px-2 py-0.5 ${
              isGood
                ? 'text-green-700 bg-green-50'
                : isBad
                  ? 'text-red-700 bg-red-50'
                  : 'text-gray-500 bg-gray-50'
            }`}
          >
            {isPositiveTrend ? (
              <TrendingUp className="w-3.5 h-3.5" />
            ) : isNegativeTrend ? (
              <TrendingDown className="w-3.5 h-3.5" />
            ) : (
              <Minus className="w-3.5 h-3.5" />
            )}
            <span>{Math.abs(trendPercent)}%</span>
          </div>
        )}
      </div>

      {/* Progress toward target */}
      {progressPercent !== null && kpi.target && (
        <div>
          <div className="w-full bg-gray-100 rounded-full h-1.5">
            <div
              className={`h-1.5 rounded-full transition-all ${
                progressPercent >= 100
                  ? 'bg-green-500'
                  : progressPercent >= 70
                    ? 'bg-blue-500'
                    : progressPercent >= 40
                      ? 'bg-yellow-500'
                      : 'bg-red-400'
              }`}
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <p className="text-[11px] text-gray-400 mt-1">
            {progressPercent}% מהיעד ({formatValue(kpi.target, kpi.format)})
          </p>
        </div>
      )}
    </div>
  );
}

export default function KpiCards() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['dashboard-kpis'],
    queryFn: () => dashboardApi.getKpis().then((res) => res.data),
    refetchInterval: 60_000, // refresh every minute
    retry: 1,
  });

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <SkeletonStatCard key={i} />
        ))}
      </div>
    );
  }

  if (isError || !data?.kpis) {
    return null; // Fail silently - KPIs are supplementary
  }

  const kpis: KpiItem[] = data.kpis;

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {kpis.map((kpi) => (
        <KpiCard key={kpi.key} kpi={kpi} />
      ))}
    </div>
  );
}
