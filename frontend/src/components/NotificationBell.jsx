import { useEffect, useState } from 'react';
import api from '../api';

function NotificationBell({ userId }) {
  const [unreadCount, setUnreadCount] = useState(0);

  const fetchNotifications = async () => {
    try {
      const response = await api.get('/notifications/');
      const notifications = response.data || [];
      const unread = notifications.filter((item) => !item.is_read).length;
      setUnreadCount(unread);
    } catch (error) {
      console.error('Error fetching notifications:', error);
      setUnreadCount(0);
    }
  };

  useEffect(() => {
    fetchNotifications();
    // Refresh every 30 seconds
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="nav-link" title="התראות">
      <span className="nav-icon">🔔</span>
      {unreadCount > 0 && (
        <span className="badge" style={{ marginInlineStart: '0.25rem' }}>
          {unreadCount}
        </span>
      )}
    </div>
  );
}

export default NotificationBell;
