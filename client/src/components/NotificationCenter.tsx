import { useEffect, useRef } from 'react';
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
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { he } from 'date-fns/locale';
import toast from 'react-hot-toast';
import { dashboardApi } from '../services/api';

interface Notification {
  id: string;
  type: 'shift_reminder' | 'invoice_overdue' | 'contract_expiry' | 'lead_new' | 'general';
  title: string;
  message: string;
  is_read: number;
  created_at: string;
}

interface NotificationCenterProps {
  isOpen: boolean;
  onClose: () => void;
}

const typeConfig: Record<
  Notification['type'],
  { icon: typeof Bell; color: string; bg: string }
> = {
  shift_reminder: {
    icon: Clock,
    color: 'text-purple-600',
    bg: 'bg-purple-50',
  },
  invoice_overdue: {
    icon: FileWarning,
    color: 'text-red-600',
    bg: 'bg-red-50',
  },
  contract_expiry: {
    icon: FileText,
    color: 'text-orange-600',
    bg: 'bg-orange-50',
  },
  lead_new: {
    icon: Users,
    color: 'text-blue-600',
    bg: 'bg-blue-50',
  },
  general: {
    icon: Info,
    color: 'text-gray-600',
    bg: 'bg-gray-100',
  },
};

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

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  if (!isOpen) return null;

  return (
    <div
      ref={dropdownRef}
      className="absolute top-full left-0 mt-2 w-96 max-w-[calc(100vw-2rem)] bg-white rounded-xl shadow-2xl border border-gray-200 z-50 overflow-hidden"
      dir="rtl"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b bg-gray-50">
        <div className="flex items-center gap-2">
          <Bell className="w-5 h-5 text-gray-600" />
          <h3 className="font-semibold text-gray-900">התראות</h3>
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
            <BellOff className="w-10 h-10 text-gray-300 mb-3" />
            <p className="text-sm text-gray-500">אין התראות חדשות</p>
          </div>
        )}

        {/* Notifications */}
        {!isLoading &&
          notifications.map((notification) => {
            const config = typeConfig[notification.type] || typeConfig.general;
            const Icon = config.icon;

            return (
              <button
                key={notification.id}
                onClick={() => handleNotificationClick(notification)}
                className={`w-full flex items-start gap-3 px-4 py-3 text-right transition-colors hover:bg-gray-50 border-b border-gray-100 last:border-b-0 ${
                  !notification.is_read ? 'bg-primary-50/30' : ''
                }`}
              >
                {/* Type icon */}
                <div
                  className={`w-9 h-9 rounded-lg ${config.bg} flex items-center justify-center flex-shrink-0 mt-0.5`}
                >
                  <Icon className={`w-4.5 h-4.5 ${config.color}`} />
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <p
                      className={`text-sm truncate ${
                        !notification.is_read
                          ? 'font-semibold text-gray-900'
                          : 'font-medium text-gray-700'
                      }`}
                    >
                      {notification.title}
                    </p>
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
                </div>
              </button>
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
