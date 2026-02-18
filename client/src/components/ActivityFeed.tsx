import { useQuery } from '@tanstack/react-query';
import {
  Building2,
  Users,
  Calendar,
  Receipt,
  AlertTriangle,
  Shield,
  UserPlus,
  FileText,
  Clock,
  Activity,
} from 'lucide-react';
import { dashboardApi } from '../services/api';

interface ActivityItem {
  id: string;
  user_id: string;
  entity_type: string;
  entity_id: string;
  action: string;
  changes: string | null;
  created_at: string;
  user_name: string | null;
}

const ENTITY_ICONS: Record<string, typeof Building2> = {
  customer: Building2,
  lead: UserPlus,
  shift: Calendar,
  invoice: Receipt,
  incident: AlertTriangle,
  employee: Users,
  event: Calendar,
  contract: FileText,
  weapon: Shield,
  certification: Shield,
  equipment: Shield,
};

const ENTITY_COLORS: Record<string, { text: string; bg: string }> = {
  customer: { text: 'text-blue-600', bg: 'bg-blue-50' },
  lead: { text: 'text-purple-600', bg: 'bg-purple-50' },
  shift: { text: 'text-green-600', bg: 'bg-green-50' },
  invoice: { text: 'text-orange-600', bg: 'bg-orange-50' },
  incident: { text: 'text-red-600', bg: 'bg-red-50' },
  employee: { text: 'text-cyan-600', bg: 'bg-cyan-50' },
  event: { text: 'text-indigo-600', bg: 'bg-indigo-50' },
  contract: { text: 'text-teal-600', bg: 'bg-teal-50' },
  weapon: { text: 'text-gray-600', bg: 'bg-gray-100' },
  certification: { text: 'text-yellow-600', bg: 'bg-yellow-50' },
  equipment: { text: 'text-slate-600', bg: 'bg-slate-50' },
};

const ACTION_LABELS: Record<string, string> = {
  create: 'נוצר',
  update: 'עודכן',
  delete: 'נמחק',
  status_change: 'שינוי סטטוס',
  assign: 'שובץ',
  check_in: 'צ\'ק-אין',
  check_out: 'צ\'ק-אאוט',
  convert: 'הומר',
  resolve: 'נפתר',
  send: 'נשלח',
  paid: 'שולם',
};

const getRelativeTime = (dateStr: string) => {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMin < 1) return 'עכשיו';
  if (diffMin < 60) return `לפני ${diffMin} דקות`;
  if (diffHours === 1) return 'לפני שעה';
  if (diffHours < 24) return `לפני ${diffHours} שעות`;
  if (diffDays === 1) return 'אתמול';
  return `לפני ${diffDays} ימים`;
};

const getActivityDescription = (activity: ActivityItem): string => {
  const actionLabel = ACTION_LABELS[activity.action] || activity.action;

  // Try to build a human-readable description from changes JSON
  if (activity.changes) {
    try {
      const changes = JSON.parse(activity.changes);
      if (changes.description) return changes.description;
      if (changes.company_name) return `${actionLabel}: ${changes.company_name}`;
      if (changes.name) return `${actionLabel}: ${changes.name}`;
      if (changes.title) return `${actionLabel}: ${changes.title}`;
      if (changes.event_name) return `${actionLabel}: ${changes.event_name}`;
    } catch {
      // If changes is a plain string, use it directly
      if (typeof activity.changes === 'string' && activity.changes.length < 200) {
        return activity.changes;
      }
    }
  }

  return actionLabel;
};

export default function ActivityFeed() {
  const { data, isLoading } = useQuery({
    queryKey: ['dashboard-recent-activity'],
    queryFn: () => dashboardApi.getRecentActivity(10).then((res) => res.data),
    refetchInterval: 30_000, // auto-refresh every 30 seconds
    retry: 1,
  });

  const activities: ActivityItem[] = data?.activities ?? [];

  return (
    <div className="card">
      {/* Header */}
      <div className="flex items-center gap-2 mb-4">
        <Activity className="w-5 h-5 text-primary-600" />
        <h2 className="text-lg font-semibold">פעילות אחרונה</h2>
      </div>

      {/* Loading state */}
      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary-600 border-t-transparent" />
        </div>
      )}

      {/* Empty state */}
      {!isLoading && activities.length === 0 && (
        <div className="text-center py-12">
          <Clock className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">אין פעילות אחרונה</p>
        </div>
      )}

      {/* Activity list */}
      {!isLoading && activities.length > 0 && (
        <div className="space-y-0 divide-y divide-gray-50">
          {activities.map((activity) => {
            const Icon = ENTITY_ICONS[activity.entity_type] || Clock;
            const colors = ENTITY_COLORS[activity.entity_type] || { text: 'text-gray-500', bg: 'bg-gray-50' };
            const description = getActivityDescription(activity);

            return (
              <div key={activity.id} className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
                {/* Icon */}
                <div className={`flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center ${colors.bg}`}>
                  <Icon className={`w-4 h-4 ${colors.text}`} />
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-800 leading-relaxed truncate">
                    {description}
                  </p>
                  <div className="flex items-center gap-2 mt-0.5">
                    {activity.user_name && (
                      <span className="text-xs text-gray-400">{activity.user_name}</span>
                    )}
                    {activity.user_name && (
                      <span className="text-xs text-gray-300">|</span>
                    )}
                    <span className="text-xs text-gray-400">
                      {getRelativeTime(activity.created_at)}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
