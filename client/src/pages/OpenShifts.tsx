import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { CalendarPlus, MapPin, Clock, Users, Loader2, CalendarX } from 'lucide-react';
import { shiftsApi } from '../services/api';
import toast from 'react-hot-toast';

interface OpenShift {
  shift_id: string;
  date: string;
  start_time: string;
  end_time: string;
  site_name: string;
  site_address: string;
  customer_name: string;
  required_employees: number;
  assigned_count: number;
  slots_available: number;
}

function formatTime(timeStr: string) {
  if (!timeStr) return '';
  return timeStr.slice(0, 5);
}

function formatHebrewDate(dateStr: string) {
  const date = new Date(dateStr + 'T00:00:00');
  const days = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
  const months = ['ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'];
  const day = days[date.getDay()];
  return `יום ${day}, ${date.getDate()} ${months[date.getMonth()]}`;
}

function isToday(dateStr: string) {
  const today = new Date().toISOString().split('T')[0];
  return dateStr === today;
}

function isTomorrow(dateStr: string) {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  return dateStr === tomorrow.toISOString().split('T')[0];
}

function getDateLabel(dateStr: string) {
  if (isToday(dateStr)) return 'היום';
  if (isTomorrow(dateStr)) return 'מחר';
  return formatHebrewDate(dateStr);
}

export default function OpenShifts() {
  const queryClient = useQueryClient();
  const [confirmingShift, setConfirmingShift] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['open-shifts'],
    queryFn: () => shiftsApi.getOpen().then((res) => res.data),
    refetchInterval: 60000,
  });

  const selfAssignMutation = useMutation({
    mutationFn: (shiftId: string) => shiftsApi.selfAssign(shiftId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['open-shifts'] });
      queryClient.invalidateQueries({ queryKey: ['my-active-assignment'] });
      toast.success('נרשמת למשמרת בהצלחה!');
      setConfirmingShift(null);
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.error || 'שגיאה ברישום למשמרת');
      setConfirmingShift(null);
    },
  });

  const shifts: OpenShift[] = data?.shifts || [];

  // Group shifts by date
  const shiftsByDate: Record<string, OpenShift[]> = {};
  for (const shift of shifts) {
    if (!shiftsByDate[shift.date]) shiftsByDate[shift.date] = [];
    shiftsByDate[shift.date].push(shift);
  }
  const sortedDates = Object.keys(shiftsByDate).sort();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-10 h-10 animate-spin text-primary-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">משמרות פתוחות</h1>
        <p className="text-gray-500">משמרות שחסר בהן כוח אדם - הירשם כדי להשתבץ</p>
      </div>

      {shifts.length === 0 ? (
        <div className="card text-center py-16 px-8">
          <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <CalendarX className="w-10 h-10 text-gray-400" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">אין משמרות פתוחות</h2>
          <p className="text-gray-500">כרגע כל המשמרות מאוישות. בדוק שוב מאוחר יותר.</p>
        </div>
      ) : (
        <div className="space-y-8">
          {sortedDates.map((date) => (
            <div key={date}>
              {/* Date header */}
              <div className="flex items-center gap-2 mb-3">
                <h3 className="text-lg font-semibold text-gray-900">
                  {getDateLabel(date)}
                </h3>
                {(isToday(date) || isTomorrow(date)) && (
                  <span className="text-sm text-gray-400">{formatHebrewDate(date)}</span>
                )}
              </div>

              {/* Shift cards */}
              <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
                {shiftsByDate[date].map((shift) => (
                  <div key={shift.shift_id} className="card hover:shadow-md transition-shadow">
                    <div className="space-y-3">
                      {/* Site name */}
                      <div className="flex items-start gap-2">
                        <MapPin className="w-4 h-4 text-primary-500 flex-shrink-0 mt-0.5" />
                        <div>
                          <p className="font-semibold text-gray-900">{shift.site_name || 'אתר לא ידוע'}</p>
                          {shift.customer_name && (
                            <p className="text-sm text-gray-500">{shift.customer_name}</p>
                          )}
                        </div>
                      </div>

                      {/* Time */}
                      <div className="flex items-center gap-2 text-gray-600">
                        <Clock className="w-4 h-4 text-gray-400" />
                        <span>{formatTime(shift.start_time)} - {formatTime(shift.end_time)}</span>
                      </div>

                      {/* Available slots */}
                      <div className="flex items-center gap-2 text-gray-600">
                        <Users className="w-4 h-4 text-gray-400" />
                        <span>
                          {shift.slots_available} {shift.slots_available === 1 ? 'מקום פנוי' : 'מקומות פנויים'}
                          <span className="text-gray-400"> (מתוך {shift.required_employees})</span>
                        </span>
                      </div>

                      {/* Action button */}
                      <div className="pt-2">
                        {confirmingShift === shift.shift_id ? (
                          <div className="space-y-2">
                            <p className="text-sm text-gray-600 text-center">האם להירשם למשמרת זו?</p>
                            <div className="flex gap-2">
                              <button
                                onClick={() => selfAssignMutation.mutate(shift.shift_id)}
                                disabled={selfAssignMutation.isPending}
                                className="flex-1 btn-success text-sm py-2 flex items-center justify-center gap-1"
                              >
                                {selfAssignMutation.isPending ? (
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                  'אישור'
                                )}
                              </button>
                              <button
                                onClick={() => setConfirmingShift(null)}
                                disabled={selfAssignMutation.isPending}
                                className="flex-1 btn-secondary text-sm py-2"
                              >
                                ביטול
                              </button>
                            </div>
                          </div>
                        ) : (
                          <button
                            onClick={() => setConfirmingShift(shift.shift_id)}
                            className="w-full btn-success text-sm py-2.5 flex items-center justify-center gap-2"
                          >
                            <CalendarPlus className="w-4 h-4" />
                            הירשם למשמרת
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
