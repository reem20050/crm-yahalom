import { useQuery } from '@tanstack/react-query';
import { CheckCircle, AlertTriangle, XCircle, Clock, MapPin } from 'lucide-react';
import { patrolsApi } from '../services/api';

interface PatrolLogViewProps {
  siteId: string;
  assignmentId?: string;
}

const STATUS_CONFIG: Record<string, { icon: typeof CheckCircle; color: string; label: string }> = {
  ok: { icon: CheckCircle, color: 'text-green-500', label: 'תקין' },
  issue_found: { icon: AlertTriangle, color: 'text-yellow-500', label: 'נמצאה בעיה' },
  requires_attention: { icon: XCircle, color: 'text-red-500', label: 'דורש טיפול' },
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
        <div>
          <div className="flex items-center justify-between text-sm mb-1">
            <span className="text-gray-600">התקדמות סיורים היום</span>
            <span className="font-medium">{visitedToday}/{totalCheckpoints} ({completionPct}%)</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-3">
            <div
              className={`h-3 rounded-full transition-all ${
                completionPct >= 80 ? 'bg-green-500' : completionPct >= 50 ? 'bg-yellow-500' : 'bg-red-500'
              }`}
              style={{ width: `${completionPct}%` }}
            />
          </div>
        </div>
      )}

      {/* Checkpoints status (site view only) */}
      {!assignmentId && checkpoints.length > 0 && (
        <div className="space-y-1">
          {checkpoints.map((cp: { id: string; name: string; description?: string }) => {
            const visited = logs?.some((l: { checkpoint_id: string }) => l.checkpoint_id === cp.id);
            return (
              <div
                key={cp.id}
                className={`flex items-center gap-2 p-2 rounded text-sm ${
                  visited ? 'bg-green-50 text-green-800' : 'bg-gray-50 text-gray-600'
                }`}
              >
                {visited ? (
                  <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                ) : (
                  <Clock className="w-4 h-4 text-gray-400 flex-shrink-0" />
                )}
                <span className="font-medium">{cp.name}</span>
                {cp.description && <span className="text-xs text-gray-400">- {cp.description}</span>}
              </div>
            );
          })}
        </div>
      )}

      {/* Timeline logs */}
      {logs && logs.length > 0 ? (
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-gray-700">רישום סיורים</h4>
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
              <div key={log.id} className="flex items-start gap-3 p-2 bg-gray-50 rounded-lg">
                <Icon className={`w-5 h-5 mt-0.5 flex-shrink-0 ${config.color}`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <p className="font-medium text-sm">{log.checkpoint_name || 'נקודת ביקורת'}</p>
                    <span className="text-xs text-gray-500">
                      {new Date(log.checked_at).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  {log.employee_name && (
                    <p className="text-xs text-gray-500">{log.employee_name}</p>
                  )}
                  {log.observation && (
                    <p className="text-xs text-gray-600 mt-1">{log.observation}</p>
                  )}
                  <span className={`text-xs ${config.color}`}>{config.label}</span>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="text-gray-400 text-sm text-center py-4">אין רישומי סיורים</p>
      )}
    </div>
  );
}
