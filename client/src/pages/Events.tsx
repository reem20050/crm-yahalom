import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import toast from 'react-hot-toast';
import { Search, PartyPopper, Calendar, MapPin, Users, Plus, X, Shield, Car } from 'lucide-react';
import { eventsApi, customersApi, leadsApi } from '../services/api';
import { SkeletonPulse, SkeletonGrid } from '../components/Skeleton';
import { usePermissions } from '../hooks/usePermissions';

const eventSchema = z.object({
  event_name: z.string().min(1, 'נדרש שם אירוע'),
  customer_id: z.string().optional(),
  lead_id: z.string().optional(),
  event_type: z.string().optional(),
  event_date: z.string().min(1, 'נדרש תאריך'),
  start_time: z.string().min(1, 'נדרשת שעת התחלה'),
  end_time: z.string().min(1, 'נדרשת שעת סיום'),
  location: z.string().min(1, 'נדרש מיקום'),
  address: z.string().optional(),
  expected_attendance: z.number().optional(),
  required_guards: z.number().min(1, 'נדרש לפחות מאבטח אחד'),
  requires_weapon: z.boolean().optional(),
  requires_vehicle: z.boolean().optional(),
  special_equipment: z.string().optional(),
  price: z.number().optional(),
  notes: z.string().optional(),
});

type EventForm = z.infer<typeof eventSchema>;

const statusLabels: Record<string, { label: string; class: string }> = {
  quote: { label: 'הצעת מחיר', class: 'badge-gray' },
  approved: { label: 'מאושר', class: 'badge-info' },
  staffed: { label: 'מאויש', class: 'badge-success' },
  completed: { label: 'הושלם', class: 'badge-success' },
  invoiced: { label: 'חשבונית הופקה', class: 'badge-success' },
  cancelled: { label: 'בוטל', class: 'badge-danger' },
};

const eventTypes = [
  { value: 'wedding', label: 'חתונה' },
  { value: 'barmitzvah', label: 'בר/בת מצווה' },
  { value: 'corporate', label: 'אירוע חברה' },
  { value: 'conference', label: 'כנס' },
  { value: 'party', label: 'מסיבה' },
  { value: 'sport', label: 'אירוע ספורט' },
  { value: 'concert', label: 'הופעה/קונצרט' },
  { value: 'other', label: 'אחר' },
];

export default function Events() {
  const [statusFilter, setStatusFilter] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [sourceType, setSourceType] = useState<'customer' | 'lead' | 'new'>('new');
  const queryClient = useQueryClient();
  const { can } = usePermissions();

  const { data, isLoading } = useQuery({
    queryKey: ['events', { status: statusFilter }],
    queryFn: () => eventsApi.getAll({ status: statusFilter, limit: 50 }).then((res) => res.data),
  });

  // Fetch customers for dropdown
  const { data: customersData } = useQuery({
    queryKey: ['customers-list'],
    queryFn: () => customersApi.getAll({ limit: 100, status: 'active' }).then((res) => res.data),
  });

  // Fetch leads for dropdown
  const { data: leadsData } = useQuery({
    queryKey: ['leads-list'],
    queryFn: () => leadsApi.getAll({ limit: 100, status: 'new,contacted,quoted' }).then((res) => res.data),
  });

  const createMutation = useMutation({
    mutationFn: (data: EventForm) => eventsApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
      toast.success('אירוע נוצר בהצלחה');
      setIsModalOpen(false);
      reset();
    },
    onError: () => {
      toast.error('שגיאה ביצירת אירוע');
    },
  });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<EventForm>({
    resolver: zodResolver(eventSchema),
    defaultValues: {
      event_date: new Date().toISOString().split('T')[0],
      required_guards: 1,
      requires_weapon: false,
      requires_vehicle: false,
      event_type: 'other',
    },
  });

  const onSubmit = (data: EventForm) => {
    createMutation.mutate(data);
  };

  return (
    <div className="space-y-6">
      <div className="page-header">
        <div>
          <h1 className="page-title">אירועים</h1>
          <p className="page-subtitle">ניהול אירועים חד-פעמיים</p>
        </div>
        {can('events:create') && (
          <button onClick={() => setIsModalOpen(true)} className="btn-primary flex items-center gap-2">
            <Plus className="w-5 h-5" />
            אירוע חדש
          </button>
        )}
      </div>

      <div className="card">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="input w-auto"
        >
          <option value="">כל הסטטוסים</option>
          {Object.entries(statusLabels).map(([key, { label }]) => (
            <option key={key} value={key}>{label}</option>
          ))}
        </select>
      </div>

      {isLoading ? (
        <SkeletonGrid count={6} />
      ) : data?.events?.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {data.events.map((event: {
            id: string;
            event_name: string;
            event_date: string;
            start_time: string;
            end_time: string;
            location: string;
            company_name: string;
            required_guards: number;
            assigned_count: number;
            status: string;
            price: number;
          }) => (
            <Link
              key={event.id}
              to={`/events/${event.id}`}
              className="card hover:shadow-card-hover hover:-translate-y-0.5 transition-all duration-300"
            >
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-gradient-to-br from-orange-200 to-orange-100 rounded-xl flex items-center justify-center">
                  <PartyPopper className="w-6 h-6 text-orange-600" />
                </div>
                <div className="flex-1">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-heading font-semibold text-gray-900">{event.event_name}</h3>
                      <p className="text-sm text-gray-500">{event.company_name}</p>
                    </div>
                    <span className={statusLabels[event.status]?.class || 'badge-gray'}>
                      {statusLabels[event.status]?.label || event.status}
                    </span>
                  </div>

                  <div className="flex items-center gap-4 mt-3 text-sm text-gray-500">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-4 h-4" />
                      {event.event_date}
                    </span>
                    <span className="flex items-center gap-1">
                      <MapPin className="w-4 h-4" />
                      {event.location}
                    </span>
                  </div>

                  <div className="flex items-center justify-between mt-3">
                    <span className="flex items-center gap-1 text-sm">
                      <Users className="w-4 h-4" />
                      {event.assigned_count}/{event.required_guards} מאבטחים
                    </span>
                    {event.price && (
                      <span className="font-medium text-gray-900">
                        ₪{event.price.toLocaleString()}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="card text-center py-16">
          <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-4">
            <PartyPopper className="w-7 h-7 text-gray-400" />
          </div>
          <p className="text-gray-500 font-medium mb-1">לא נמצאו אירועים</p>
          <p className="text-sm text-gray-400 mb-6">הוסף אירוע חדש כדי להתחיל לנהל אירועים</p>
          <button onClick={() => setIsModalOpen(true)} className="btn-primary">
            הוסף אירוע ראשון
          </button>
        </div>
      )}

      {/* Create Event Modal */}
      {isModalOpen && (
        <div className="modal-backdrop">
          <div className="modal-content max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b">
              <h2 className="text-xl font-bold">אירוע חדש</h2>
              <button
                onClick={() => {
                  setIsModalOpen(false);
                  reset();
                }}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-4">
              {/* Source Selection */}
              <div>
                <label className="label">מקור האירוע</label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      checked={sourceType === 'new'}
                      onChange={() => setSourceType('new')}
                      className="w-4 h-4 text-primary-600"
                    />
                    <span>אירוע חדש</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      checked={sourceType === 'customer'}
                      onChange={() => setSourceType('customer')}
                      className="w-4 h-4 text-primary-600"
                    />
                    <span>לקוח קיים</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      checked={sourceType === 'lead'}
                      onChange={() => setSourceType('lead')}
                      className="w-4 h-4 text-primary-600"
                    />
                    <span>ליד</span>
                  </label>
                </div>
              </div>

              {/* Customer/Lead Selection */}
              {sourceType === 'customer' && (
                <div>
                  <label className="label">לקוח</label>
                  <select {...register('customer_id')} className="input">
                    <option value="">בחר לקוח...</option>
                    {customersData?.customers?.map((customer: { id: string; company_name: string }) => (
                      <option key={customer.id} value={customer.id}>
                        {customer.company_name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {sourceType === 'lead' && (
                <div>
                  <label className="label">ליד</label>
                  <select {...register('lead_id')} className="input">
                    <option value="">בחר ליד...</option>
                    {leadsData?.leads?.map((lead: { id: string; contact_name: string; company_name: string }) => (
                      <option key={lead.id} value={lead.id}>
                        {lead.company_name || lead.contact_name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Event Details */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div className="col-span-2 sm:col-span-2">
                  <label className="label">שם האירוע *</label>
                  <input {...register('event_name')} className="input" placeholder="חתונה של ישראל ישראלי" />
                  {errors.event_name && (
                    <p className="text-sm text-red-600 mt-1">{errors.event_name.message}</p>
                  )}
                </div>

                <div>
                  <label className="label">סוג אירוע</label>
                  <select {...register('event_type')} className="input">
                    {eventTypes.map((type) => (
                      <option key={type.value} value={type.value}>
                        {type.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="label">תאריך *</label>
                  <input {...register('event_date')} type="date" className="input" />
                  {errors.event_date && (
                    <p className="text-sm text-red-600 mt-1">{errors.event_date.message}</p>
                  )}
                </div>

                <div>
                  <label className="label">שעת התחלה *</label>
                  <input {...register('start_time')} type="time" className="input" />
                  {errors.start_time && (
                    <p className="text-sm text-red-600 mt-1">{errors.start_time.message}</p>
                  )}
                </div>

                <div>
                  <label className="label">שעת סיום *</label>
                  <input {...register('end_time')} type="time" className="input" />
                  {errors.end_time && (
                    <p className="text-sm text-red-600 mt-1">{errors.end_time.message}</p>
                  )}
                </div>

                <div className="col-span-2">
                  <label className="label">מיקום *</label>
                  <input {...register('location')} className="input" placeholder="אולמי הירדן, הרצליה" />
                  {errors.location && (
                    <p className="text-sm text-red-600 mt-1">{errors.location.message}</p>
                  )}
                </div>

                <div className="col-span-2">
                  <label className="label">כתובת מלאה</label>
                  <input {...register('address')} className="input" placeholder="רחוב הירקון 123" />
                </div>

                <div>
                  <label className="label">מספר משתתפים צפוי</label>
                  <input
                    {...register('expected_attendance', { valueAsNumber: true })}
                    type="number"
                    className="input"
                  />
                </div>

                <div>
                  <label className="label">מספר מאבטחים נדרש *</label>
                  <input
                    {...register('required_guards', { valueAsNumber: true })}
                    type="number"
                    min="1"
                    className="input"
                  />
                  {errors.required_guards && (
                    <p className="text-sm text-red-600 mt-1">{errors.required_guards.message}</p>
                  )}
                </div>
              </div>

              {/* Requirements */}
              <div className="border-t pt-4">
                <h3 className="font-medium mb-3">דרישות</h3>
                <div className="flex items-center gap-6">
                  <label className="flex items-center gap-2">
                    <input
                      {...register('requires_weapon')}
                      type="checkbox"
                      className="w-4 h-4 text-primary-600 rounded"
                    />
                    <Shield className="w-4 h-4 text-orange-500" />
                    <span>נדרש נשק</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      {...register('requires_vehicle')}
                      type="checkbox"
                      className="w-4 h-4 text-primary-600 rounded"
                    />
                    <Car className="w-4 h-4 text-blue-500" />
                    <span>נדרש רכב</span>
                  </label>
                </div>
              </div>

              {/* Special Equipment */}
              <div>
                <label className="label">ציוד מיוחד</label>
                <input {...register('special_equipment')} className="input" placeholder="מכשירי קשר, פנסים..." />
              </div>

              {/* Pricing */}
              <div className="border-t pt-4">
                <div>
                  <label className="label">מחיר (₪)</label>
                  <input
                    {...register('price', { valueAsNumber: true })}
                    type="number"
                    step="0.01"
                    className="input w-48"
                    dir="ltr"
                  />
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="label">הערות</label>
                <textarea {...register('notes')} className="input min-h-[80px]" />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="submit"
                  disabled={createMutation.isPending}
                  className="btn-primary flex-1"
                >
                  {createMutation.isPending ? 'שומר...' : 'שמור'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsModalOpen(false);
                    reset();
                  }}
                  className="btn-secondary"
                >
                  ביטול
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
