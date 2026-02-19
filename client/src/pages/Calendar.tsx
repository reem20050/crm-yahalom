import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  Calendar as CalendarIcon,
  ChevronRight,
  ChevronLeft,
  Clock,
  MapPin,
  Shield,
  PartyPopper,
  ExternalLink,
} from 'lucide-react';
import { shiftsApi, eventsApi, integrationsApi } from '../services/api';
import { usePermissions } from '../hooks/usePermissions';

// ── Types ───────────────────────────────────────────────────────────────────

interface Shift {
  id: string;
  site_id: string;
  customer_id: string;
  date: string;
  start_time: string;
  end_time: string;
  status: string;
  notes?: string;
  customer_name?: string;
  site_name?: string;
}

interface Event {
  id: string;
  event_name: string;
  event_type: string;
  event_date: string;
  start_time: string;
  end_time: string;
  location: string;
  status: string;
  required_guards: number;
}

interface GoogleCalendarEvent {
  id: string;
  title: string;
  description: string;
  location: string;
  start_date: string;
  start_time: string;
  end_time: string;
  all_day: boolean;
  html_link: string;
  source: 'google';
}

type FilterType = 'all' | 'shifts' | 'events' | 'google';

// ── Constants ───────────────────────────────────────────────────────────────

const HEBREW_MONTHS = [
  'ינואר',
  'פברואר',
  'מרץ',
  'אפריל',
  'מאי',
  'יוני',
  'יולי',
  'אוגוסט',
  'ספטמבר',
  'אוקטובר',
  'נובמבר',
  'דצמבר',
];

const HEBREW_DAYS = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];

const MAX_VISIBLE_ITEMS = 3;

// ── Helpers ─────────────────────────────────────────────────────────────────

function getMonthDays(year: number, month: number) {
  // month is 0-indexed
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);

  // Day of week for the first of the month (0 = Sunday)
  const startDayOfWeek = firstDay.getDay();

  const days: Array<{ date: Date; isCurrentMonth: boolean }> = [];

  // Fill in days from previous month to start on Sunday
  for (let i = startDayOfWeek - 1; i >= 0; i--) {
    const date = new Date(year, month, -i);
    days.push({ date, isCurrentMonth: false });
  }

  // Fill in days of the current month
  for (let d = 1; d <= lastDay.getDate(); d++) {
    days.push({ date: new Date(year, month, d), isCurrentMonth: true });
  }

  // Fill remaining cells to complete the last week (up to 42 cells = 6 rows)
  const remaining = 7 - (days.length % 7);
  if (remaining < 7) {
    for (let i = 1; i <= remaining; i++) {
      const date = new Date(year, month + 1, i);
      days.push({ date, isCurrentMonth: false });
    }
  }

  return days;
}

function formatDateStr(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function formatMonthRange(year: number, month: number) {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  return {
    start_date: formatDateStr(firstDay),
    end_date: formatDateStr(lastDay),
  };
}

// ── Component ───────────────────────────────────────────────────────────────

export default function Calendar() {
  const navigate = useNavigate();
  const { isEmployee } = usePermissions();
  const today = new Date();
  const [currentYear, setCurrentYear] = useState(today.getFullYear());
  const [currentMonth, setCurrentMonth] = useState(today.getMonth());
  const [filter, setFilter] = useState<FilterType>('all');
  const [showGoogle, setShowGoogle] = useState(true);

  const { start_date, end_date } = formatMonthRange(currentYear, currentMonth);

  // Fetch shifts for the displayed month
  const { data: shiftsData, isLoading: isLoadingShifts } = useQuery({
    queryKey: ['calendar-shifts', start_date, end_date],
    queryFn: () =>
      shiftsApi
        .getAll({ start_date, end_date })
        .then((res) => res.data),
  });

  // Fetch events for the displayed month
  const { data: eventsData, isLoading: isLoadingEvents } = useQuery({
    queryKey: ['calendar-events', start_date, end_date],
    queryFn: () =>
      eventsApi
        .getAll({ start_date, end_date })
        .then((res) => res.data),
  });

  // Fetch Google Calendar events for the displayed month (managers/admins only)
  const { data: googleData } = useQuery({
    queryKey: ['google-calendar-events', start_date, end_date],
    queryFn: () =>
      integrationsApi
        .getGoogleCalendarEvents(start_date, end_date)
        .then((res) => res.data),
    retry: false,
    enabled: !isEmployee,
  });

  const isLoading = isLoadingShifts || isLoadingEvents;

  const shifts: Shift[] = shiftsData?.shifts ?? [];
  const events: Event[] = eventsData?.events ?? [];
  const googleEvents: GoogleCalendarEvent[] = googleData?.events ?? [];
  const googleConnected: boolean = googleData?.connected ?? false;

  // Index items by date string for fast lookup
  const shiftsByDate = useMemo(() => {
    const map: Record<string, Shift[]> = {};
    for (const shift of shifts) {
      const key = shift.date;
      if (!map[key]) map[key] = [];
      map[key].push(shift);
    }
    return map;
  }, [shifts]);

  const eventsByDate = useMemo(() => {
    const map: Record<string, Event[]> = {};
    for (const event of events) {
      const key = event.event_date;
      if (!map[key]) map[key] = [];
      map[key].push(event);
    }
    return map;
  }, [events]);

  const googleEventsByDate = useMemo(() => {
    const map: Record<string, GoogleCalendarEvent[]> = {};
    for (const event of googleEvents) {
      const key = event.start_date;
      if (!map[key]) map[key] = [];
      map[key].push(event);
    }
    return map;
  }, [googleEvents]);

  const calendarDays = useMemo(
    () => getMonthDays(currentYear, currentMonth),
    [currentYear, currentMonth]
  );

  const todayStr = formatDateStr(today);

  // ── Navigation ──────────────────────────────────────────────────────────

  const goToPrevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear((y) => y - 1);
    } else {
      setCurrentMonth((m) => m - 1);
    }
  };

  const goToNextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear((y) => y + 1);
    } else {
      setCurrentMonth((m) => m + 1);
    }
  };

  const goToToday = () => {
    setCurrentYear(today.getFullYear());
    setCurrentMonth(today.getMonth());
  };

  // ── Render helpers ──────────────────────────────────────────────────────

  const renderShiftItem = (shift: Shift) => (
    <button
      key={`shift-${shift.id}`}
      onClick={(e) => {
        e.stopPropagation();
        navigate('/shifts');
      }}
      className="w-full text-right rounded px-1.5 py-0.5 text-[11px] leading-tight bg-blue-50 text-blue-800 border border-blue-200 hover:bg-blue-100 transition-colors cursor-pointer truncate flex items-center gap-1"
      title={`${shift.start_time} - ${shift.end_time} | ${shift.site_name || shift.customer_name || 'משמרת'}`}
    >
      <Shield className="w-3 h-3 flex-shrink-0 text-blue-500" />
      <span className="truncate">
        {shift.start_time} {shift.site_name || shift.customer_name || 'משמרת'}
      </span>
    </button>
  );

  const renderEventItem = (event: Event) => (
    <button
      key={`event-${event.id}`}
      onClick={(e) => {
        e.stopPropagation();
        navigate(`/events/${event.id}`);
      }}
      className="w-full text-right rounded px-1.5 py-0.5 text-[11px] leading-tight bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100 transition-colors cursor-pointer truncate flex items-center gap-1"
      title={`${event.start_time} - ${event.end_time} | ${event.event_name} | ${event.location}`}
    >
      <PartyPopper className="w-3 h-3 flex-shrink-0 text-emerald-500" />
      <span className="truncate">
        {event.start_time} {event.event_name}
      </span>
    </button>
  );

  const renderGoogleEventItem = (event: GoogleCalendarEvent) => (
    <a
      key={`google-${event.id}`}
      href={event.html_link}
      target="_blank"
      rel="noopener noreferrer"
      className="w-full text-right rounded px-1.5 py-0.5 text-[11px] leading-tight bg-purple-50 text-purple-800 border border-purple-200 hover:bg-purple-100 transition-colors cursor-pointer truncate flex items-center gap-1"
      title={`${event.start_time ? event.start_time + ' - ' + event.end_time + ' | ' : 'כל היום | '}${event.title}${event.location ? ' | ' + event.location : ''}`}
      onClick={(e) => e.stopPropagation()}
    >
      <CalendarIcon className="w-3 h-3 flex-shrink-0 text-purple-500" />
      <span className="truncate">
        {event.all_day ? '📅' : event.start_time} {event.title}
      </span>
      <ExternalLink className="w-2.5 h-2.5 flex-shrink-0 text-purple-400" />
    </a>
  );

  const renderDayItems = (dateStr: string) => {
    const dayShifts = shiftsByDate[dateStr] || [];
    const dayEvents = eventsByDate[dateStr] || [];
    const dayGoogleEvents = googleEventsByDate[dateStr] || [];

    let items: JSX.Element[] = [];

    if (filter === 'all' || filter === 'shifts') {
      items = items.concat(dayShifts.map(renderShiftItem));
    }
    if (filter === 'all' || filter === 'events') {
      items = items.concat(dayEvents.map(renderEventItem));
    }
    if ((filter === 'all' || filter === 'google') && showGoogle) {
      items = items.concat(dayGoogleEvents.map(renderGoogleEventItem));
    }

    const totalCount = items.length;
    const visibleItems = items.slice(0, MAX_VISIBLE_ITEMS);
    const overflowCount = totalCount - MAX_VISIBLE_ITEMS;

    return (
      <div className="flex flex-col gap-0.5 mt-1">
        {visibleItems}
        {overflowCount > 0 && (
          <span className="text-[10px] text-gray-400 text-center">
            +{overflowCount} נוספים
          </span>
        )}
      </div>
    );
  };

  // ── Count badges for summary ────────────────────────────────────────────

  const totalShiftsThisMonth = shifts.length;
  const totalEventsThisMonth = events.length;
  const totalGoogleEventsThisMonth = googleEvents.length;

  // ── Render ──────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="page-header">
          <h1 className="page-title">לוח שנה</h1>
          <p className="page-subtitle">{isEmployee ? 'המשמרות והאירועים שלי' : 'תצוגה חודשית של משמרות ואירועים'}</p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 rounded-sm bg-blue-100 border border-blue-300"></span>
              משמרות ({totalShiftsThisMonth})
            </span>
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 rounded-sm bg-emerald-100 border border-emerald-300"></span>
              אירועים ({totalEventsThisMonth})
            </span>
            {googleConnected && !isEmployee && (
              <span className="flex items-center gap-1">
                <span className="w-3 h-3 rounded-sm bg-purple-100 border border-purple-300"></span>
                Google ({totalGoogleEventsThisMonth})
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Controls: Navigation + Filter */}
      <div className="card">
        <div className="flex items-center justify-between flex-wrap gap-4">
          {/* Month navigation */}
          <div className="flex items-center gap-3">
            <button
              onClick={goToPrevMonth}
              className="btn-secondary p-2"
              aria-label="חודש קודם"
            >
              <ChevronRight className="w-5 h-5" />
            </button>

            <h2 className="text-lg font-semibold font-heading min-w-[160px] text-center">
              {HEBREW_MONTHS[currentMonth]} {currentYear}
            </h2>

            <button
              onClick={goToNextMonth}
              className="btn-secondary p-2"
              aria-label="חודש הבא"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>

            <button
              onClick={goToToday}
              className="btn-secondary text-sm px-3 py-1.5"
            >
              היום
            </button>
          </div>

          {/* Filter buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setFilter('all')}
              className={`text-sm px-3 py-1.5 rounded-lg transition-colors ${
                filter === 'all'
                  ? 'bg-primary-500 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              הכל
            </button>
            <button
              onClick={() => setFilter('shifts')}
              className={`text-sm px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1 ${
                filter === 'shifts'
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              <Shield className="w-3.5 h-3.5" />
              משמרות
            </button>
            <button
              onClick={() => setFilter('events')}
              className={`text-sm px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1 ${
                filter === 'events'
                  ? 'bg-emerald-500 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              <PartyPopper className="w-3.5 h-3.5" />
              אירועים
            </button>
            {googleConnected && !isEmployee && (
              <button
                onClick={() => {
                  if (filter === 'google') {
                    setFilter('all');
                  } else {
                    setFilter('google');
                  }
                }}
                className={`text-sm px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1 ${
                  filter === 'google'
                    ? 'bg-purple-500 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                <CalendarIcon className="w-3.5 h-3.5" />
                Google
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Loading */}
      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-2 border-primary-600 border-t-transparent"></div>
        </div>
      ) : (
        /* Calendar Grid */
        <div className="card p-0 overflow-hidden">
          {/* Day names header */}
          <div className="grid grid-cols-7 border-b bg-gray-50">
            {HEBREW_DAYS.map((day, idx) => (
              <div
                key={day}
                className={`py-3 text-center text-sm font-semibold text-gray-600 ${
                  idx < 6 ? 'border-l border-gray-200' : ''
                } ${idx === 6 ? 'text-red-500' : ''}`}
              >
                {day}
              </div>
            ))}
          </div>

          {/* Calendar cells */}
          <div className="grid grid-cols-7">
            {calendarDays.map(({ date, isCurrentMonth }, index) => {
              const dateStr = formatDateStr(date);
              const isToday = dateStr === todayStr;
              const dayOfWeek = date.getDay();
              const isShabbat = dayOfWeek === 6;
              const dayShifts = shiftsByDate[dateStr] || [];
              const dayEvents = eventsByDate[dateStr] || [];
              const dayGoogleEvents = googleEventsByDate[dateStr] || [];
              const hasItems =
                (filter === 'all' && (dayShifts.length > 0 || dayEvents.length > 0 || (showGoogle && dayGoogleEvents.length > 0))) ||
                (filter === 'shifts' && dayShifts.length > 0) ||
                (filter === 'events' && dayEvents.length > 0) ||
                (filter === 'google' && dayGoogleEvents.length > 0);

              return (
                <div
                  key={`${dateStr}-${index}`}
                  className={`
                    min-h-[120px] p-1.5 border-b border-l border-gray-200
                    transition-colors
                    ${!isCurrentMonth ? 'bg-gray-50' : 'bg-white'}
                    ${isToday ? 'bg-primary-50 ring-2 ring-inset ring-primary-400' : ''}
                    ${isShabbat && isCurrentMonth ? 'bg-red-50/30' : ''}
                    ${hasItems ? 'hover:bg-gray-50' : ''}
                  `}
                >
                  {/* Day number */}
                  <div className="flex items-center justify-between mb-0.5">
                    <span
                      className={`
                        text-sm font-medium w-7 h-7 flex items-center justify-center rounded-full
                        ${isToday ? 'bg-primary-500 text-white' : ''}
                        ${!isCurrentMonth ? 'text-gray-300' : ''}
                        ${isCurrentMonth && !isToday && isShabbat ? 'text-red-400' : ''}
                        ${isCurrentMonth && !isToday && !isShabbat ? 'text-gray-700' : ''}
                      `}
                    >
                      {date.getDate()}
                    </span>

                    {/* Dot indicators for quick glance */}
                    {isCurrentMonth && (dayShifts.length > 0 || dayEvents.length > 0 || dayGoogleEvents.length > 0) && (
                      <div className="flex items-center gap-0.5">
                        {dayShifts.length > 0 && (filter === 'all' || filter === 'shifts') && (
                          <span className="w-2 h-2 rounded-full bg-blue-400" />
                        )}
                        {dayEvents.length > 0 && (filter === 'all' || filter === 'events') && (
                          <span className="w-2 h-2 rounded-full bg-emerald-400" />
                        )}
                        {dayGoogleEvents.length > 0 && showGoogle && (filter === 'all' || filter === 'google') && (
                          <span className="w-2 h-2 rounded-full bg-purple-400" />
                        )}
                      </div>
                    )}
                  </div>

                  {/* Items list */}
                  {isCurrentMonth && renderDayItems(dateStr)}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Monthly summary footer */}
      {!isLoading && (
        <div className={`grid grid-cols-1 ${googleConnected && !isEmployee ? 'md:grid-cols-4' : 'md:grid-cols-3'} gap-4`}>
          <div className="card flex items-center gap-4">
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
              <Shield className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900 font-heading">{totalShiftsThisMonth}</p>
              <p className="text-sm text-gray-500">משמרות החודש</p>
            </div>
          </div>

          <div className="card flex items-center gap-4">
            <div className="w-12 h-12 bg-emerald-100 rounded-lg flex items-center justify-center">
              <PartyPopper className="w-6 h-6 text-emerald-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900 font-heading">{totalEventsThisMonth}</p>
              <p className="text-sm text-gray-500">אירועים החודש</p>
            </div>
          </div>

          {googleConnected && !isEmployee && (
            <div className="card flex items-center gap-4">
              <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                <CalendarIcon className="w-6 h-6 text-purple-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900 font-heading">{totalGoogleEventsThisMonth}</p>
                <p className="text-sm text-gray-500">אירועי Google</p>
              </div>
            </div>
          )}

          <div className="card flex items-center gap-4">
            <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center">
              <CalendarIcon className="w-6 h-6 text-gray-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900 font-heading">
                {totalShiftsThisMonth + totalEventsThisMonth + (showGoogle ? totalGoogleEventsThisMonth : 0)}
              </p>
              <p className="text-sm text-gray-500">סה"כ פריטים</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
