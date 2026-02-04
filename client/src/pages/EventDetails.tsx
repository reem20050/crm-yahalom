import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, PartyPopper, Calendar, MapPin, Users, Clock, Shield, Car } from 'lucide-react';
import { eventsApi } from '../services/api';

export default function EventDetails() {
  const { id } = useParams();
  const navigate = useNavigate();

  const { data, isLoading } = useQuery({
    queryKey: ['event', id],
    queryFn: () => eventsApi.getOne(id!).then((res) => res.data),
    enabled: !!id,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-4 border-primary-500 border-t-transparent"></div>
      </div>
    );
  }

  const event = data?.event;

  return (
    <div className="space-y-6">
      <button
        onClick={() => navigate('/events')}
        className="flex items-center gap-2 text-gray-600 hover:text-gray-900"
      >
        <ArrowRight className="w-5 h-5" />
        חזרה לאירועים
      </button>

      <div className="flex items-start gap-4">
        <div className="w-16 h-16 bg-orange-100 rounded-xl flex items-center justify-center">
          <PartyPopper className="w-8 h-8 text-orange-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{event?.event_name}</h1>
          <p className="text-gray-500">{event?.company_name}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Event info */}
          <div className="card">
            <h2 className="text-lg font-semibold mb-4">פרטי האירוע</h2>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center gap-3">
                <Calendar className="w-5 h-5 text-gray-400" />
                <div>
                  <p className="text-sm text-gray-500">תאריך</p>
                  <p className="font-medium">{event?.event_date}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Clock className="w-5 h-5 text-gray-400" />
                <div>
                  <p className="text-sm text-gray-500">שעות</p>
                  <p className="font-medium">{event?.start_time} - {event?.end_time}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 col-span-2">
                <MapPin className="w-5 h-5 text-gray-400" />
                <div>
                  <p className="text-sm text-gray-500">מיקום</p>
                  <p className="font-medium">{event?.location}</p>
                  {event?.address && <p className="text-sm text-gray-500">{event.address}</p>}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-4 mt-4 pt-4 border-t">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-gray-400" />
                <span>{event?.required_guards} מאבטחים</span>
              </div>
              {event?.requires_weapon && (
                <div className="flex items-center gap-2 text-yellow-600">
                  <Shield className="w-5 h-5" />
                  <span>דורש נשק</span>
                </div>
              )}
              {event?.requires_vehicle && (
                <div className="flex items-center gap-2 text-blue-600">
                  <Car className="w-5 h-5" />
                  <span>דורש רכב</span>
                </div>
              )}
            </div>
          </div>

          {/* Assigned employees */}
          <div className="card">
            <h2 className="text-lg font-semibold mb-4">צוות משובץ</h2>
            {data?.assignments?.length > 0 ? (
              <div className="space-y-3">
                {data.assignments.map((assignment: {
                  id: string;
                  employee_name: string;
                  employee_phone: string;
                  role: string;
                  status: string;
                }) => (
                  <div key={assignment.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div>
                      <p className="font-medium">{assignment.employee_name}</p>
                      <p className="text-sm text-gray-500">{assignment.role || 'מאבטח'}</p>
                    </div>
                    <a
                      href={`tel:${assignment.employee_phone}`}
                      className="text-primary-600 text-sm"
                    >
                      {assignment.employee_phone}
                    </a>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 text-center py-4">אין עובדים משובצים</p>
            )}
          </div>

          {/* Notes */}
          {event?.notes && (
            <div className="card">
              <h2 className="text-lg font-semibold mb-4">הערות</h2>
              <p className="text-gray-700 whitespace-pre-wrap">{event.notes}</p>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          <div className="card">
            <h2 className="text-lg font-semibold mb-4">סטטוס ותשלום</h2>
            <dl className="space-y-3">
              <div>
                <dt className="text-sm text-gray-500">סטטוס</dt>
                <dd className="font-medium">{event?.status}</dd>
              </div>
              <div>
                <dt className="text-sm text-gray-500">סוג אירוע</dt>
                <dd className="font-medium">{event?.event_type || '-'}</dd>
              </div>
              {event?.expected_attendance && (
                <div>
                  <dt className="text-sm text-gray-500">קהל צפוי</dt>
                  <dd className="font-medium">{event.expected_attendance} אנשים</dd>
                </div>
              )}
              {event?.price && (
                <div>
                  <dt className="text-sm text-gray-500">מחיר</dt>
                  <dd className="font-bold text-lg">₪{event.price.toLocaleString()}</dd>
                </div>
              )}
            </dl>
          </div>

          {event?.special_equipment && (
            <div className="card">
              <h2 className="text-lg font-semibold mb-4">ציוד מיוחד</h2>
              <p className="text-gray-700">{event.special_equipment}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
