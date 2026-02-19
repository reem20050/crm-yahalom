import { useQuery } from '@tanstack/react-query';
import { CheckCircle, AlertTriangle, XCircle, Clock, MapPin } from 'lucide-react';
import { patrolsApi } from '../services/api';

interface PatrolLogViewProps {
  siteId: string;
  assignmentId?: string;
}

const STATUS_CONFIG: Record<string, { icon: typeof CheckCircle; color: string; badgeClass: string; label: string }> = {
  ok: { icon: CheckCircle, color: 'text-green-500', badgeClass: 'badge-success', label: 'תקין' },
  issue_found: { icon: AlertTriangle, color: 'text-yellow-500', badgeClass: 'badge-warning', label: 'נמצאה בעיה' },
  requires_attention: { icon: XCircle, color: 'text-red-500', badgeClass: 'badge-danger', label: 'דורש טיפול' },
};

export default function PatrolLogView({ siteId, assignmentId }: PatrolLogViewProps) {
  const { data: siteData, isLoading: loadingSite } = useQuery({
    queryKey: ['patrols-site-today', siteId],
    queryFn: () => patrolsApi.getSiteToday(siteId).then((r) => r.data),
    enabled: !!siteId && !assignmentId,
  });

  const { data: shiftData, isLoading: loadingShift } = useQuery({
    queryKey: ['patrols-shift', assignmentId],
    queryFn: () => patrolsApi.getShiftLogs(assignmentId!).then((r) => r.data),
    enabled: !!assignmentId,
  });

  const isLoading = loadingSite || loadingShift;
  const logs = assignmentId ? shiftData?.logs : siteData?.logs;
  const checkpoints = siteData?.checkpoints || [];
  const totalCheckpoints = siteData?.total_checkpoints || checkpoints.length;
  const visitedToday = siteData?.visited_today || 0;
  const completionPct = totalCheckpoints > 0 ? Math.round((visitedToday / totalCheckpoints) * 100) : 0;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-4">
        <div className="animate-spin rounded-full h-6 w-6 border-2 border-primary-500 border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Progress bar (site view only) */}
      {!assignmentId && totalCheckpoints > 0 && (
        <div className="card p-4">
          <div className="section-header mb-3">
            <div className="section-header-icon bg-gradient-to-br from-primary-100 to-primary-50">
              <MapPin className="w-4 h-4 text-primary-600" />
            </div>
            <h4 className="section-header-title text-sm">התקדמות סיורים היום</h4>
            <span className="font-heading font-bold text-sm text-gray-700 mr-auto">
              {visitedToday}/{totalCheckpoints} ({completionPct}%)
            </span>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-3 overflow-hidden">
            <div
              className={`h-3 rounded-full transition-all duration-500 ${
                completionPct >= 80
                  ? 'bg-gradient-to-l from-green-500 to-emerald-400'
                  : completionPct >= 50
                  ? 'bg-gradient-to-l from-yellow-500 to-amber-400'
                  : 'bg-gradient-to-l from-red-500 to-rose-400'
              }`}
              style={{ width: `${completionPct}%` }}
            />
          </div>
        </div>
      )}

      {/* Checkpoints status (site view only) */}
      {!assignmentId && checkpoints.length > 0 && (
        <div className="space-y-1.5">
          {checkpoints.map((cp: { id: string; name: string; description?: string }) => {
            const visited = logs?.some((l: { checkpoint_id: string }) => l.checkpoint_id === cp.id);
            return (
              <div
                key={cp.id}
                className={`flex items-center gap-2 p-2.5 rounded-lg text-sm transition-colors ${
                  visited ? 'bg-gradient-to-l from-green-50 to-emerald-50 text-green-800 border border-green-100' : 'bg-gray-50 text-gray-600 border border-gray-100'
                }`}
              >
                {visited ? (
                  <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                ) : (
                  <Clock className="w-4 h-4 text-gray-400 flex-shrink-0" />
                )}
                <span className="font-medium font-heading">{cp.name}</span>
                {cp.description && <span className="text-xs text-gray-400">- {cp.description}</span>}
              </div>
            );
          })}
        </div>
      )}

      {/* Timeline logs */}
      {logs && logs.length > 0 ? (
        <div className="space-y-2">
          <div className="section-header mb-2">
            <div className="section-header-icon bg-gradient-to-br from-gray-100 to-gray-50">
              <Clock className="w-3.5 h-3.5 text-gray-600" />
            </div>
            <h4 className="section-header-title text-sm">רישום סיורים</h4>
          </div>
          {logs.map((log: {
            id: string;
            checkpoint_name?: string;
            checked_at: string;
            status: string;
            observation?: string;
            employee_name?: string;
          }) => {
            const config = STATUS_CONFIG[log.status] || STATUS_CONFIG.ok;
            const Icon = config.icon;
            return (
              <div key={log.id} className="card flex items-start gap-3 p-3 hover:shadow-card-hover transition-all duration-200">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-gray-100 to-gray-50 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Icon className={`w-4 h-4 ${config.color}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <p className="font-medium font-heading text-sm">{log.checkpoint_name || 'נקודת ביקורת'}</p>
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-gray-100 text-gray-500">
                      {new Date(log.checked_at).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  {log.employee_name && (
                    <p className="text-xs text-gray-500">{log.employee_name}</p>
                  )}
                  {log.observation && (
                    <p className="text-xs text-gray-600 mt-1">{log.observation}</p>
                  )}
                  <span className={`${config.badgeClass} text-[10px] mt-1 inline-block`}>{config.label}</span>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-6">
          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-gray-100 to-gray-50 flex items-center justify-center mx-auto mb-2">
            <MapPin className="w-6 h-6 text-gray-300" />
          </div>
          <p className="text-gray-400 text-sm font-heading">אין רישומי סיורים</p>
        </div>
      )}
    </div>
  );
}
