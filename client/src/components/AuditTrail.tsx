import { useQuery } from '@tanstack/react-query';
import {
  Clock,
  Phone,
  Mail,
  FileText,
  UserPlus,
  Edit,
  Trash2,
  CheckCircle,
  AlertCircle,
  MessageSquare,
  Activity,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { he } from 'date-fns/locale';
import api from '../services/api';

interface ActivityLog {
  id: string;
  entity_type: string;
  entity_id: string;
  action: string;
  description: string;
  user_id: string;
  user_name: string;
  created_at: string;
}

interface AuditTrailProps {
  entityType: string;
  entityId: string;
}

const actionConfig: Record<string, { icon: typeof Activity; color: string; bg: string }> = {
  call: { icon: Phone, color: 'text-blue-600', bg: 'bg-blue-50' },
  email: { icon: Mail, color: 'text-purple-600', bg: 'bg-purple-50' },
  email_sent: { icon: Mail, color: 'text-purple-600', bg: 'bg-purple-50' },
  meeting: { icon: UserPlus, color: 'text-green-600', bg: 'bg-green-50' },
  note: { icon: MessageSquare, color: 'text-yellow-600', bg: 'bg-yellow-50' },
  status_change: { icon: Edit, color: 'text-orange-600', bg: 'bg-orange-50' },
  created: { icon: CheckCircle, color: 'text-emerald-600', bg: 'bg-emerald-50' },
  updated: { icon: Edit, color: 'text-sky-600', bg: 'bg-sky-50' },
  deleted: { icon: Trash2, color: 'text-red-600', bg: 'bg-red-50' },
  document: { icon: FileText, color: 'text-indigo-600', bg: 'bg-indigo-50' },
  alert: { icon: AlertCircle, color: 'text-red-600', bg: 'bg-red-50' },
};

function getActionConfig(action: string) {
  return actionConfig[action] || { icon: Activity, color: 'text-gray-600', bg: 'bg-gray-100' };
}

function getRelativeTime(dateStr: string): string {
  try {
    return formatDistanceToNow(new Date(dateStr), { addSuffix: true, locale: he });
  } catch {
    return '';
  }
}

export default function AuditTrail({ entityType, entityId }: AuditTrailProps) {
  const { data, isLoading } = useQuery({
    queryKey: ['activities', entityType, entityId],
    queryFn: () =>
      api.get(`/${entityType}s/${entityId}/activities`).then((res) => res.data),
    enabled: !!entityId,
  });

  const activities: ActivityLog[] = data?.activities || [];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-6 w-6 border-2 border-primary-600 border-t-transparent" />
      </div>
    );
  }

  if (activities.length === 0) {
    return (
      <div className="text-center py-8">
        <Clock className="w-8 h-8 text-gray-300 mx-auto mb-2" />
        <p className="text-sm text-gray-400">אין פעילות עדיין</p>
      </div>
    );
  }

  return (
    <div className="relative">
      {/* Timeline line */}
      <div className="absolute top-0 bottom-0 right-[19px] w-0.5 bg-gray-200" />

      <div className="space-y-4">
        {activities.map((activity) => {
          const config = getActionConfig(activity.action);
          const Icon = config.icon;

          return (
            <div key={activity.id} className="relative flex gap-3 pr-1">
              {/* Timeline dot */}
              <div
                className={`relative z-10 w-9 h-9 rounded-full ${config.bg} flex items-center justify-center flex-shrink-0 border-2 border-white shadow-sm`}
              >
                <Icon className={`w-4 h-4 ${config.color}`} />
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0 pb-2">
                <div className="bg-white rounded-lg border border-gray-100 p-3 shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-medium text-gray-900">
                      {activity.description || activity.action}
                    </p>
                    <span className="text-xs text-gray-400 flex-shrink-0 whitespace-nowrap">
                      {getRelativeTime(activity.created_at)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs text-gray-500">
                      {activity.user_name || 'מערכת'}
                    </span>
                    <span className="text-xs text-gray-300">•</span>
                    <span className="text-xs text-gray-400">
                      {new Date(activity.created_at).toLocaleDateString('he-IL')}{' '}
                      {new Date(activity.created_at).toLocaleTimeString('he-IL', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
