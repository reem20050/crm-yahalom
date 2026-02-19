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
  customer: { text: 'text-blue-600', bg: 'bg-gradient-to-br from-blue-100 to-blue-50' },
  lead: { text: 'text-purple-600', bg: 'bg-gradient-to-br from-purple-100 to-purple-50' },
  shift: { text: 'text-green-600', bg: 'bg-gradient-to-br from-green-100 to-green-50' },
  invoice: { text: 'text-orange-600', bg: 'bg-gradient-to-br from-orange-100 to-orange-50' },
  incident: { text: 'text-red-600', bg: 'bg-gradient-to-br from-red-100 to-red-50' },
  employee: { text: 'text-cyan-600', bg: 'bg-gradient-to-br from-cyan-100 to-cyan-50' },
  event: { text: 'text-indigo-600', bg: 'bg-gradient-to-br from-indigo-100 to-indigo-50' },
  contract: { text: 'text-teal-600', bg: 'bg-gradient-to-br from-teal-100 to-teal-50' },
  weapon: { text: 'text-gray-600', bg: 'bg-gradient-to-br from-gray-200 to-gray-100' },
  certification: { text: 'text-yellow-600', bg: 'bg-gradient-to-br from-yellow-100 to-yellow-50' },
  equipment: { text: 'text-slate-600', bg: 'bg-gradient-to-br from-slate-100 to-slate-50' },
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
      <div className="section-header">
        <div className="section-header-icon bg-gradient-to-br from-primary-100 to-primary-50">
          <Activity className="w-4 h-4 text-primary-600" />
        </div>
        <h3 className="section-header-title font-heading">פעילות אחרונה</h3>
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
          <div className="w-14 h-14 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-3">
            <Clock className="w-6 h-6 text-gray-400" />
          </div>
          <p className="text-sm text-gray-400 font-medium">אין פעילות אחרונה</p>
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
                    <span className="text-[11px] text-gray-400 bg-gray-50 px-2 py-0.5 rounded-full">
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
