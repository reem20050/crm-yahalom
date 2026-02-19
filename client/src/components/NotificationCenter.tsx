import { useState, useEffect, useRef, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Bell,
  Clock,
  FileWarning,
  FileText,
  Users,
  Info,
  CheckCheck,
  X,
  Loader2,
  BellOff,
  VolumeX,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { he } from 'date-fns/locale';
import toast from 'react-hot-toast';
import { dashboardApi, alertsApi } from '../services/api';

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  is_read: number;
  related_entity_type?: string;
  related_entity_id?: string;
  created_at: string;
}

interface NotificationCenterProps {
  isOpen: boolean;
  onClose: () => void;
}

type NotificationType = 'shift_reminder' | 'invoice_overdue' | 'contract_expiry' | 'lead_new' | 'general';

const typeConfig: Record<
  NotificationType,
  { icon: typeof Bell; color: string; bg: string; borderAccent: string }
> = {
  shift_reminder: {
    icon: Clock,
    color: 'text-purple-600',
    bg: 'bg-purple-50',
    borderAccent: 'border-r-purple-400',
  },
  invoice_overdue: {
    icon: FileWarning,
    color: 'text-red-600',
    bg: 'bg-red-50',
    borderAccent: 'border-r-red-400',
  },
  contract_expiry: {
    icon: FileText,
    color: 'text-orange-600',
    bg: 'bg-orange-50',
    borderAccent: 'border-r-amber-400',
  },
  lead_new: {
    icon: Users,
    color: 'text-blue-600',
    bg: 'bg-blue-50',
    borderAccent: 'border-r-primary-400',
  },
  general: {
    icon: Info,
    color: 'text-gray-600',
    bg: 'bg-gray-100',
    borderAccent: 'border-r-primary-400',
  },
};

/**
 * Detect severity from notification title prefix emoji
 * Returns 'critical' | 'warning' | null
 */
function detectSeverity(title: string): 'critical' | 'warning' | null {
  if (title.startsWith('\uD83D\uDD34') || title.includes('\uD83D\uDD34')) return 'critical'; // red circle
  if (title.startsWith('\uD83D\uDFE1') || title.includes('\uD83D\uDFE1')) return 'warning';  // yellow circle
  if (title.startsWith('\u26A0')) return 'critical'; // escalation warning sign
  return null;
}

function getRelativeTime(dateStr: string): string {
  try {
    return formatDistanceToNow(new Date(dateStr), {
      addSuffix: true,
      locale: he,
    });
  } catch {
    return '';
  }
}

// ── Mute Dropdown ───────────────────────────────────────────────────────────

function MuteDropdown({
  notification,
  onMute,
  isMuting,
}: {
  notification: Notification;
  onMute: (data: Record<string, unknown>) => void;
  isMuting: boolean;
}) {
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showDropdown) return;
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showDropdown]);

  const handleMute = (hours: number | null) => {
    const mutedUntil = hours
      ? new Date(Date.now() + hours * 60 * 60 * 1000).toISOString()
      : null;

    onMute({
      alert_type: notification.type,
      related_entity_type: notification.related_entity_type || null,
      related_entity_id: notification.related_entity_id || null,
      muted_until: mutedUntil,
      reason: hours ? `השתקה ל-${hours} שעות` : 'השתקה לצמיתות',
    });
    setShowDropdown(false);
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={(e) => {
          e.stopPropagation();
          setShowDropdown(!showDropdown);
        }}
        disabled={isMuting}
        className="p-1 rounded hover:bg-gray-200 transition-colors text-gray-400 hover:text-gray-600"
        title="השתק התראה"
      >
        <VolumeX className="w-3.5 h-3.5" />
      </button>

      {showDropdown && (
        <div className="absolute left-0 top-full mt-1 bg-white rounded-lg shadow-lg border border-gray-200 z-50 py-1 min-w-[140px]">
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleMute(24);
            }}
            className="w-full text-right px-3 py-1.5 text-xs hover:bg-gray-50 transition-colors"
          >
            השתק ל-24 שעות
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleMute(168);
            }}
            className="w-full text-right px-3 py-1.5 text-xs hover:bg-gray-50 transition-colors"
          >
            השתק לשבוע
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleMute(null);
            }}
            className="w-full text-right px-3 py-1.5 text-xs hover:bg-gray-50 transition-colors text-red-600"
          >
            השתק לצמיתות
          </button>
        </div>
      )}
    </div>
  );
}

// ── Severity Badge ──────────────────────────────────────────────────────────

function SeverityBadge({ severity }: { severity: 'critical' | 'warning' | null }) {
  if (!severity) return null;

  if (severity === 'critical') {
    return (
      <span className="inline-flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-red-100 text-red-700 flex-shrink-0">
        קריטי
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-yellow-100 text-yellow-700 flex-shrink-0">
      אזהרה
    </span>
  );
}

// ── Main Component ──────────────────────────────────────────────────────────

export default function NotificationCenter({ isOpen, onClose }: NotificationCenterProps) {
  const dropdownRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();

  // Fetch notifications
  const { data, isLoading } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => dashboardApi.getNotifications().then((res) => res.data),
    enabled: isOpen,
    refetchInterval: isOpen ? 30000 : false,
  });

  const notifications: Notification[] = data?.notifications || [];

  // Mark single notification as read
  const markReadMutation = useMutation({
    mutationFn: (id: string) => dashboardApi.markNotificationRead(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
    onError: () => {
      toast.error('שגיאה בעדכון ההתראה');
    },
  });

  // Mark all as read
  const markAllReadMutation = useMutation({
    mutationFn: () => dashboardApi.markAllNotificationsRead(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      toast.success('כל ההתראות סומנו כנקראו');
    },
    onError: () => {
      toast.error('שגיאה בעדכון ההתראות');
    },
  });

  // Mute alert mutation
  const muteAlertMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => alertsApi.muteAlert(data),
    onSuccess: () => {
      toast.success('התראה הושתקה');
      queryClient.invalidateQueries({ queryKey: ['alert-mutes'] });
    },
    onError: () => {
      toast.error('שגיאה בהשתקת התראה');
    },
  });

  // SSE real-time connection
  const eventSourceRef = useRef<EventSource | null>(null);
  const sseConnected = useRef(false);

  const connectSSE = useCallback(() => {
    if (eventSourceRef.current) return; // Already connected

    const token = localStorage.getItem('token');
    if (!token) return;

    try {
      const baseUrl = import.meta.env.VITE_API_URL || '';
      const url = `${baseUrl}/api/dashboard/notifications/stream?token=${encodeURIComponent(token)}`;
      const es = new EventSource(url);

      es.onopen = () => {
        sseConnected.current = true;
      };

      es.onmessage = (event) => {
        try {
          const parsed = JSON.parse(event.data);
          if (parsed.type === 'notification') {
            // Refetch notifications when a new one arrives
            queryClient.invalidateQueries({ queryKey: ['notifications'] });
            // Show toast for the new notification
            if (parsed.data?.title) {
              toast(parsed.data.title, { icon: '\uD83D\uDD14', duration: 5000 });
            }
          }
        } catch {
          // Ignore parse errors (heartbeats, etc.)
        }
      };

      es.onerror = () => {
        sseConnected.current = false;
        es.close();
        eventSourceRef.current = null;
        // Retry after 10 seconds
        setTimeout(connectSSE, 10000);
      };

      eventSourceRef.current = es;
    } catch {
      // SSE not supported or connection failed - fall back to polling
    }
  }, [queryClient]);

  // Connect SSE on mount, disconnect on unmount
  useEffect(() => {
    connectSSE();
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
    };
  }, [connectSSE]);

  // Click outside to close
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        onClose();
      }
    };

    // Delay to prevent the opening click from immediately closing
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
    }, 0);

    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onClose]);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const handleNotificationClick = (notification: Notification) => {
    if (!notification.is_read) {
      markReadMutation.mutate(notification.id);
    }
  };

  const handleMarkAllRead = () => {
    markAllReadMutation.mutate();
  };

  const handleMuteAlert = (data: Record<string, unknown>) => {
    muteAlertMutation.mutate(data);
  };

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  if (!isOpen) return null;

  return (
    <div
      ref={dropdownRef}
      className="absolute top-full left-0 mt-2 w-96 max-w-[calc(100vw-2rem)] bg-white rounded-2xl shadow-elevated border border-gray-100 z-50 overflow-hidden animate-scale-in"
      dir="rtl"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b bg-gray-50">
        <div className="flex items-center gap-2">
          <Bell className="w-5 h-5 text-gray-600" />
          <h3 className="font-heading font-semibold text-gray-900">התראות</h3>
          {unreadCount > 0 && (
            <span className="badge-danger text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700 font-medium">
              {unreadCount}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {unreadCount > 0 && (
            <button
              onClick={handleMarkAllRead}
              disabled={markAllReadMutation.isPending}
              className="flex items-center gap-1 text-xs text-primary-600 hover:text-primary-700 px-2 py-1 rounded-lg hover:bg-primary-50 transition-colors disabled:opacity-50"
            >
              <CheckCheck className="w-3.5 h-3.5" />
              <span>סמן הכל כנקרא</span>
            </button>
          )}
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-gray-200 transition-colors"
          >
            <X className="w-4 h-4 text-gray-400" />
          </button>
        </div>
      </div>

      {/* Notification list */}
      <div className="max-h-[400px] overflow-y-auto">
        {/* Loading state */}
        {isLoading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 text-primary-500 animate-spin" />
          </div>
        )}

        {/* Empty state */}
        {!isLoading && notifications.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 px-4">
            <div className="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center mb-3">
              <BellOff className="w-7 h-7 text-gray-400" />
            </div>
            <p className="text-sm font-medium text-gray-500">אין התראות חדשות</p>
            <p className="text-xs text-gray-400 mt-1">כשיהיו עדכונים, הם יופיעו כאן</p>
          </div>
        )}

        {/* Notifications */}
        {!isLoading &&
          notifications.map((notification) => {
            const config = typeConfig[notification.type as NotificationType] || typeConfig.general;
            const Icon = config.icon;
            const severity = detectSeverity(notification.title);

            return (
              <div
                key={notification.id}
                className={`w-full flex items-start gap-3 px-4 py-3 text-right transition-colors hover:bg-gray-50 border-b border-gray-100 last:border-b-0 border-r-2 ${config.borderAccent} ${
                  !notification.is_read ? 'bg-primary-50/30' : ''
                } ${severity === 'critical' ? 'border-r-red-500' : ''}`}
              >
                {/* Type icon */}
                <button
                  onClick={() => handleNotificationClick(notification)}
                  className={`w-9 h-9 rounded-lg ${config.bg} flex items-center justify-center flex-shrink-0 mt-0.5`}
                >
                  <Icon className={`w-4.5 h-4.5 ${config.color}`} />
                </button>

                {/* Content */}
                <button
                  onClick={() => handleNotificationClick(notification)}
                  className="flex-1 min-w-0 text-right"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <SeverityBadge severity={severity} />
                      <p
                        className={`text-sm truncate ${
                          !notification.is_read
                            ? 'font-semibold text-gray-900'
                            : 'font-medium text-gray-700'
                        }`}
                      >
                        {notification.title}
                      </p>
                    </div>
                    {!notification.is_read && (
                      <span className="w-2 h-2 rounded-full bg-primary-500 flex-shrink-0 mt-1.5" />
                    )}
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">
                    {notification.message}
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    {getRelativeTime(notification.created_at)}
                  </p>
                </button>

                {/* Mute button */}
                <div className="flex-shrink-0 mt-1">
                  <MuteDropdown
                    notification={notification}
                    onMute={handleMuteAlert}
                    isMuting={muteAlertMutation.isPending}
                  />
                </div>
              </div>
            );
          })}
      </div>

      {/* Footer */}
      {notifications.length > 0 && (
        <div className="px-4 py-2 border-t bg-gray-50 text-center">
          <p className="text-xs text-gray-400">
            {notifications.length} התראות סה"כ
          </p>
        </div>
      )}
    </div>
  );
}
