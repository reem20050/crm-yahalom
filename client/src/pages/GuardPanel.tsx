import { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Shield, LogIn, LogOut, MapPin, Clock, AlertTriangle, CheckCircle, Loader2 } from 'lucide-react';
import { shiftsApi } from '../services/api';
import toast from 'react-hot-toast';

function getLocation(): Promise<{ latitude: number; longitude: number } | null> {
  if (!navigator.geolocation) return Promise.resolve(null);
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  });
}

function formatTime(timeStr: string) {
  if (!timeStr) return '';
  return timeStr.slice(0, 5);
}

function formatHebrewDate(dateStr: string) {
  const date = new Date(dateStr + 'T00:00:00');
  const days = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
  const day = days[date.getDay()];
  return `יום ${day}, ${date.getDate()}/${date.getMonth() + 1}/${date.getFullYear()}`;
}

function ElapsedTimer({ checkInTime }: { checkInTime: string }) {
  const [elapsed, setElapsed] = useState('');

  useEffect(() => {
    const update = () => {
      const start = new Date(checkInTime).getTime();
      const now = Date.now();
      const diff = Math.max(0, now - start);
      const hours = Math.floor(diff / 3600000);
      const mins = Math.floor((diff % 3600000) / 60000);
      const secs = Math.floor((diff % 60000) / 1000);
      setElapsed(
        `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
      );
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [checkInTime]);

  return <span className="font-mono text-3xl font-bold text-gray-900">{elapsed}</span>;
}

export default function GuardPanel() {
  const queryClient = useQueryClient();
  const [locationWarning, setLocationWarning] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['my-active-assignment'],
    queryFn: () => shiftsApi.getMyActiveAssignment().then((res) => res.data),
    refetchInterval: 30000,
  });

  const assignment = data?.assignment;

  const checkInMutation = useMutation({
    mutationFn: async (assignmentId: string) => {
      const location = await getLocation();
      return shiftsApi.checkIn(assignmentId, location || undefined);
    },
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['my-active-assignment'] });
      const data = res.data;
      if (data?.warning) {
        setLocationWarning(data.warning);
        toast.success('צ\'ק-אין בוצע בהצלחה (עם אזהרת מיקום)');
      } else {
        toast.success('צ\'ק-אין בוצע בהצלחה!');
      }
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.error || 'שגיאה בצ\'ק-אין');
    },
  });

  const checkOutMutation = useMutation({
    mutationFn: async (assignmentId: string) => {
      const location = await getLocation();
      return shiftsApi.checkOut(assignmentId, location || undefined);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-active-assignment'] });
      toast.success('צ\'ק-אאוט בוצע בהצלחה!');
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.error || 'שגיאה בצ\'ק-אאוט');
    },
  });

  const isActionLoading = checkInMutation.isPending || checkOutMutation.isPending;

  // Clear location warning after 10 seconds
  useEffect(() => {
    if (locationWarning) {
      const timer = setTimeout(() => setLocationWarning(''), 10000);
      return () => clearTimeout(timer);
    }
  }, [locationWarning]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-10 h-10 animate-spin text-primary-500" />
      </div>
    );
  }

  // No active assignment
  if (!assignment) {
    return (
      <div className="max-w-md mx-auto mt-12">
        <div className="card text-center py-16 px-8">
          <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <Shield className="w-10 h-10 text-gray-400" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">אין משמרת פעילה</h2>
          <p className="text-gray-500">אין לך משמרת מתוכננת להיום, או שהמשמרת טרם שובצה.</p>
        </div>
      </div>
    );
  }

  const isCheckedIn = assignment.status === 'checked_in';
  const isAssigned = assignment.status === 'assigned';

  return (
    <div className="max-w-md mx-auto mt-8 space-y-6">
      {/* Shift info card */}
      <div className="card">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-primary-100 rounded-lg flex items-center justify-center">
            <Shield className="w-5 h-5 text-primary-600" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-gray-900">המשמרת שלי</h2>
            <p className="text-sm text-gray-500">{formatHebrewDate(assignment.date)}</p>
          </div>
        </div>

        <div className="space-y-3">
          {assignment.site_name && (
            <div className="flex items-center gap-2 text-gray-700">
              <MapPin className="w-4 h-4 text-gray-400 flex-shrink-0" />
              <span className="font-medium">{assignment.site_name}</span>
              {assignment.customer_name && (
                <span className="text-gray-400">({assignment.customer_name})</span>
              )}
            </div>
          )}

          <div className="flex items-center gap-2 text-gray-700">
            <Clock className="w-4 h-4 text-gray-400 flex-shrink-0" />
            <span>{formatTime(assignment.start_time)} - {formatTime(assignment.end_time)}</span>
          </div>

          {isCheckedIn && assignment.check_in_time && (
            <div className="flex items-center gap-2 text-green-700">
              <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
              <span>נכנסת ב-{new Date(assignment.check_in_time).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}</span>
            </div>
          )}
        </div>
      </div>

      {/* Timer (when checked in) */}
      {isCheckedIn && assignment.check_in_time && (
        <div className="card text-center py-6">
          <p className="text-sm text-gray-500 mb-2">זמן במשמרת</p>
          <ElapsedTimer checkInTime={assignment.check_in_time} />
        </div>
      )}

      {/* Location warning */}
      {locationWarning && (
        <div className="bg-amber-50 border border-amber-200 text-amber-800 px-4 py-3 rounded-xl flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 flex-shrink-0" />
          <span className="text-sm">{locationWarning}</span>
        </div>
      )}

      {/* Big action button */}
      {isAssigned && (
        <button
          onClick={() => checkInMutation.mutate(assignment.assignment_id)}
          disabled={isActionLoading}
          className="w-full py-6 rounded-2xl text-white text-2xl font-bold bg-green-500 hover:bg-green-600 active:bg-green-700 disabled:opacity-50 transition-all shadow-lg flex items-center justify-center gap-3"
        >
          {isActionLoading ? (
            <Loader2 className="w-8 h-8 animate-spin" />
          ) : (
            <>
              <LogIn className="w-8 h-8" />
              צ'ק-אין
            </>
          )}
        </button>
      )}

      {isCheckedIn && (
        <button
          onClick={() => checkOutMutation.mutate(assignment.assignment_id)}
          disabled={isActionLoading}
          className="w-full py-6 rounded-2xl text-white text-2xl font-bold bg-orange-500 hover:bg-orange-600 active:bg-orange-700 disabled:opacity-50 transition-all shadow-lg flex items-center justify-center gap-3"
        >
          {isActionLoading ? (
            <Loader2 className="w-8 h-8 animate-spin" />
          ) : (
            <>
              <LogOut className="w-8 h-8" />
              צ'ק-אאוט
            </>
          )}
        </button>
      )}

      {/* GPS note */}
      <p className="text-center text-xs text-gray-400">
        המערכת תבקש את המיקום שלך לצורך אימות
      </p>
    </div>
  );
}
