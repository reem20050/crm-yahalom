import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import {
  Phone,
  Users,
  FileText,
  MessageCircle,
  RefreshCw,
  Mail,
  Plus,
  Save,
  Clock,
} from 'lucide-react';
import { activitiesApi } from '../services/api';

// --- Types ---

interface Activity {
  id: string;
  action: string;
  description: string;
  user_name?: string;
  created_at: string;
}

interface ActivityLogProps {
  entityType: 'lead' | 'customer';
  entityId: string;
}

// --- Activity type config ---

const ACTIVITY_TYPES: Record<
  string,
  { label: string; icon: typeof Phone; colorClass: string; bgClass: string }
> = {
  call: {
    label: 'שיחה',
    icon: Phone,
    colorClass: 'text-blue-600',
    bgClass: 'bg-blue-100',
  },
  meeting: {
    label: 'פגישה',
    icon: Users,
    colorClass: 'text-purple-600',
    bgClass: 'bg-purple-100',
  },
  proposal: {
    label: 'הצעת מחיר',
    icon: FileText,
    colorClass: 'text-orange-600',
    bgClass: 'bg-orange-100',
  },
  note: {
    label: 'הערה',
    icon: MessageCircle,
    colorClass: 'text-gray-600',
    bgClass: 'bg-gray-100',
  },
  whatsapp: {
    label: 'WhatsApp',
    icon: MessageCircle,
    colorClass: 'text-green-600',
    bgClass: 'bg-green-100',
  },
  status_change: {
    label: 'שינוי סטטוס',
    icon: RefreshCw,
    colorClass: 'text-yellow-600',
    bgClass: 'bg-yellow-100',
  },
  email: {
    label: 'אימייל',
    icon: Mail,
    colorClass: 'text-cyan-600',
    bgClass: 'bg-cyan-100',
  },
};

const ACTIVITY_TYPE_OPTIONS = Object.entries(ACTIVITY_TYPES).map(
  ([value, { label }]) => ({ value, label })
);

// --- Hebrew relative time formatting ---

function formatRelativeTime(isoDate: string): string {
  const date = new Date(isoDate);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMinutes = Math.floor(diffMs / 60_000);
  const diffHours = Math.floor(diffMs / 3_600_000);
  const diffDays = Math.floor(diffMs / 86_400_000);

  const time = date.toLocaleTimeString('he-IL', {
    hour: '2-digit',
    minute: '2-digit',
  });

  // Same calendar day check
  const isToday =
    date.getDate() === now.getDate() &&
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear();

  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const isYesterday =
    date.getDate() === yesterday.getDate() &&
    date.getMonth() === yesterday.getMonth() &&
    date.getFullYear() === yesterday.getFullYear();

  if (diffMinutes < 1) return 'עכשיו';
  if (diffMinutes < 60) return `לפני ${diffMinutes} דקות`;
  if (isToday) {
    if (diffHours === 1) return `לפני שעה`;
    if (diffHours < 4) return `לפני ${diffHours} שעות`;
    return `היום ${time}`;
  }
  if (isYesterday) return `אתמול ${time}`;
  if (diffDays < 7) return `לפני ${diffDays} ימים`;

  return date.toLocaleDateString('he-IL', {
    day: 'numeric',
    month: 'short',
    year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
  }) + ` ${time}`;
}

// --- Component ---

export default function ActivityLog({ entityType, entityId }: ActivityLogProps) {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [actionType, setActionType] = useState('call');
  const [description, setDescription] = useState('');

  const queryKey = ['activities', entityType, entityId];

  // Fetch activities
  const { data, isLoading } = useQuery({
    queryKey,
    queryFn: () => {
      const fetcher =
        entityType === 'lead'
          ? activitiesApi.getForLead
          : activitiesApi.getForCustomer;
      return fetcher(entityId).then((res) => res.data);
    },
    enabled: !!entityId,
  });

  const activities: Activity[] = data?.activities ?? [];

  // Add activity mutation
  const addMutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) => {
      const adder =
        entityType === 'lead'
          ? activitiesApi.addToLead
          : activitiesApi.addToCustomer;
      return adder(entityId, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      toast.success('הפעולה נוספה בהצלחה');
      setDescription('');
      setActionType('call');
      setShowForm(false);
    },
    onError: () => {
      toast.error('שגיאה בהוספת פעולה');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!description.trim()) {
      toast.error('נא להזין תיאור');
      return;
    }
    addMutation.mutate({ action: actionType, description: description.trim() });
  };

  // --- Render ---

  return (
    <div className="card">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">יומן פעולות</h2>
        <button
          onClick={() => setShowForm(!showForm)}
          className="btn-primary text-sm flex items-center gap-1 px-3 py-1.5"
        >
          {showForm ? (
            <>סגור</>
          ) : (
            <>
              <Plus className="w-4 h-4" />
              הוסף פעולה
            </>
          )}
        </button>
      </div>

      {/* Add activity form */}
      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="mb-6 p-4 bg-blue-50 rounded-lg space-y-3"
        >
          <div>
            <label className="label">סוג פעולה</label>
            <select
              value={actionType}
              onChange={(e) => setActionType(e.target.value)}
              className="input"
            >
              {ACTIVITY_TYPE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="label">תיאור</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="input"
              rows={3}
              placeholder="תאר את הפעולה..."
            />
          </div>

          <button
            type="submit"
            disabled={addMutation.isPending || !description.trim()}
            className="btn-primary text-sm flex items-center gap-1"
          >
            <Save className="w-4 h-4" />
            {addMutation.isPending ? 'שומר...' : 'שמור'}
          </button>
        </form>
      )}

      {/* Loading state */}
      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-4 border-primary-500 border-t-transparent"></div>
        </div>
      )}

      {/* Empty state */}
      {!isLoading && activities.length === 0 && (
        <div className="text-center py-12">
          <Clock className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">אין פעולות עדיין</p>
          <p className="text-gray-400 text-sm mt-1">
            הוסף פעולה ראשונה כדי להתחיל לעקוב
          </p>
        </div>
      )}

      {/* Timeline */}
      {!isLoading && activities.length > 0 && (
        <div className="relative">
          {/* Vertical line */}
          <div className="absolute right-[19px] top-0 bottom-0 w-0.5 bg-gray-200" />

          <div className="space-y-0">
            {activities.map((activity, index) => {
              const config = ACTIVITY_TYPES[activity.action] ?? {
                label: activity.action,
                icon: Clock,
                colorClass: 'text-gray-600',
                bgClass: 'bg-gray-100',
              };
              const Icon = config.icon;

              return (
                <div key={activity.id} className="relative flex gap-4 pb-6">
                  {/* Icon circle */}
                  <div
                    className={`relative z-10 flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${config.bgClass}`}
                  >
                    <Icon className={`w-5 h-5 ${config.colorClass}`} />
                  </div>

                  {/* Content */}
                  <div className="flex-1 pt-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-gray-900">
                        {config.label}
                      </span>
                      <span className="text-xs text-gray-400">
                        {formatRelativeTime(activity.created_at)}
                      </span>
                    </div>

                    {activity.description && (
                      <p className="text-sm text-gray-700 mt-1 whitespace-pre-wrap">
                        {activity.description}
                      </p>
                    )}

                    {activity.user_name && (
                      <p className="text-xs text-gray-400 mt-1">
                        {activity.user_name}
                      </p>
                    )}
                  </div>

                  {/* Hide line tail after last item */}
                  {index === activities.length - 1 && (
                    <div className="absolute right-[19px] bottom-0 h-6 w-0.5 bg-white" />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
