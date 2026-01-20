import { useEffect, useState } from 'react';
import { Calendar as BigCalendar, dateFnsLocalizer } from 'react-big-calendar';
import { format, parse, startOfWeek, getDay } from 'date-fns';
import { he } from 'date-fns/locale';
import api from '../api';
import 'react-big-calendar/lib/css/react-big-calendar.css';

const locales = { he };
const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek: (date) => startOfWeek(date, { locale: he }),
  getDay,
  locales,
});

function Calendar() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchCalendarData = async () => {
    try {
      const [shiftsRes, tasksRes] = await Promise.all([
        api.get('/shifts/'),
        api.get('/tasks/'),
      ]);

      const shiftEvents = shiftsRes.data.map((shift) => ({
        title: `משמרת - עובד ${shift.employee_id}`,
        start: new Date(shift.start_time),
        end: new Date(shift.end_time),
        resource: { type: 'shift' },
      }));

      const taskEvents = tasksRes.data
        .filter((task) => task.due_date)
        .map((task) => ({
          title: `משימה - ${task.title}`,
          start: new Date(task.due_date),
          end: new Date(task.due_date),
          resource: { type: 'task' },
        }));

      setEvents([...shiftEvents, ...taskEvents]);
    } catch (error) {
      console.error('Error fetching calendar data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCalendarData();
  }, []);

  if (loading) {
    return (
      <div className="text-center" style={{ padding: '4rem' }}>
        <div className="stat-value">💎</div>
        <p className="mt-2">טוען...</p>
      </div>
    );
  }

  return (
    <div>
      <header className="page-header">
        <h1 className="page-title text-gradient">לוח שנה</h1>
        <p className="page-subtitle">צפייה במשמרות ובמשימות לפי תאריך</p>
      </header>
      <div className="card">
        <div className="card-header">
          <h3 className="card-title">תצוגת לוח שנה</h3>
        </div>
        <div style={{ height: '70vh' }}>
          <BigCalendar
            localizer={localizer}
            events={events}
            defaultView="week"
            views={['month', 'week', 'day']}
            startAccessor="start"
            endAccessor="end"
            style={{ height: '100%' }}
          />
        </div>
      </div>
    </div>
  );
}

export default Calendar;
