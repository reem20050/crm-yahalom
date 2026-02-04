import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { format, startOfWeek, addDays } from 'date-fns';
import { he } from 'date-fns/locale';
import toast from 'react-hot-toast';
import { ChevronRight, ChevronLeft, Users, Plus, X, Clock, MapPin, Shield, Car } from 'lucide-react';
import { shiftsApi, customersApi, sitesApi } from '../services/api';

const shiftSchema = z.object({
  site_id: z.string().min(1, 'נדרש לבחור אתר'),
  customer_id: z.string().optional(),
  date: z.string().min(1, 'נדרש תאריך'),
  start_time: z.string().min(1, 'נדרשת שעת התחלה'),
  end_time: z.string().min(1, 'נדרשת שעת סיום'),
  required_employees: z.number().min(1, 'נדרש לפחות עובד אחד'),
  requires_weapon: z.boolean().optional(),
  requires_vehicle: z.boolean().optional(),
  notes: z.string().optional(),
});

type ShiftForm = z.infer<typeof shiftSchema>;

export default function Shifts() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<string>('');
  const weekStart = startOfWeek(currentDate, { weekStartsOn: 0 });
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['shifts', format(weekStart, 'yyyy-MM-dd')],
    queryFn: () =>
      shiftsApi
        .getAll({
          start_date: format(weekStart, 'yyyy-MM-dd'),
          end_date: format(addDays(weekStart, 6), 'yyyy-MM-dd'),
        })
        .then((res) => res.data),
  });

  // Fetch customers for dropdown
  const { data: customersData } = useQuery({
    queryKey: ['customers-list'],
    queryFn: () => customersApi.getAll({ limit: 100, status: 'active' }).then((res) => res.data),
  });

  // Fetch sites based on selected customer
  const { data: sitesData } = useQuery({
    queryKey: ['sites', selectedCustomer],
    queryFn: () =>
      selectedCustomer
        ? sitesApi.getByCustomer(selectedCustomer).then((res) => res.data)
        : Promise.resolve({ sites: [] }),
    enabled: !!selectedCustomer,
  });

  const createMutation = useMutation({
    mutationFn: (data: ShiftForm) => shiftsApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shifts'] });
      toast.success('משמרת נוצרה בהצלחה');
      setIsModalOpen(false);
      reset();
      setSelectedCustomer('');
    },
    onError: () => {
      toast.error('שגיאה ביצירת משמרת');
    },
  });

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors },
  } = useForm<ShiftForm>({
    resolver: zodResolver(shiftSchema),
    defaultValues: {
      date: format(new Date(), 'yyyy-MM-dd'),
      required_employees: 1,
      requires_weapon: false,
      requires_vehicle: false,
    },
  });

  const onSubmit = (data: ShiftForm) => {
    createMutation.mutate({
      ...data,
      customer_id: selectedCustomer || undefined,
    });
  };

  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const getShiftsForDay = (date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    return data?.shifts?.filter((s: { date: string }) => s.date === dateStr) || [];
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">משמרות</h1>
          <p className="text-gray-500">לוח משמרות שבועי</p>
        </div>
        <button onClick={() => setIsModalOpen(true)} className="btn-primary flex items-center gap-2">
          <Plus className="w-5 h-5" />
          משמרת חדשה
        </button>
      </div>

      {/* Week navigation */}
      <div className="card">
        <div className="flex items-center justify-between">
          <button
            onClick={() => setCurrentDate(addDays(currentDate, -7))}
            className="btn-secondary p-2"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
          <h2 className="text-lg font-semibold">
            {format(weekStart, 'd MMMM', { locale: he })} -{' '}
            {format(addDays(weekStart, 6), 'd MMMM yyyy', { locale: he })}
          </h2>
          <button
            onClick={() => setCurrentDate(addDays(currentDate, 7))}
            className="btn-secondary p-2"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-4 border-primary-500 border-t-transparent"></div>
        </div>
      ) : (
        <div className="grid grid-cols-7 gap-4">
          {days.map((day) => {
            const shifts = getShiftsForDay(day);
            const isToday = format(day, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd');

            return (
              <div
                key={day.toISOString()}
                className={`card p-3 min-h-[200px] ${isToday ? 'ring-2 ring-primary-500' : ''}`}
              >
                <div className="text-center mb-3">
                  <p className="text-sm text-gray-500">
                    {format(day, 'EEEE', { locale: he })}
                  </p>
                  <p className={`text-lg font-bold ${isToday ? 'text-primary-600' : ''}`}>
                    {format(day, 'd')}
                  </p>
                </div>

                <div className="space-y-2">
                  {shifts.length > 0 ? (
                    shifts.map((shift: {
                      id: string;
                      company_name: string;
                      site_name: string;
                      start_time: string;
                      end_time: string;
                      assigned_count: number;
                      required_employees: number;
                      requires_weapon: boolean;
                      requires_vehicle: boolean;
                      status: string;
                    }) => (
                      <div
                        key={shift.id}
                        className={`p-2 rounded text-xs cursor-pointer hover:shadow-md transition-shadow ${
                          shift.assigned_count >= shift.required_employees
                            ? 'bg-green-50 border border-green-200'
                            : 'bg-yellow-50 border border-yellow-200'
                        }`}
                      >
                        <p className="font-medium truncate">{shift.company_name}</p>
                        <p className="text-gray-500 truncate">{shift.site_name}</p>
                        <p className="text-gray-500">
                          {shift.start_time} - {shift.end_time}
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          <div className="flex items-center gap-1">
                            <Users className="w-3 h-3" />
                            <span>{shift.assigned_count}/{shift.required_employees}</span>
                          </div>
                          {shift.requires_weapon && <Shield className="w-3 h-3 text-orange-500" />}
                          {shift.requires_vehicle && <Car className="w-3 h-3 text-blue-500" />}
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-gray-400 text-center">אין משמרות</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create Shift Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b">
              <h2 className="text-xl font-bold">משמרת חדשה</h2>
              <button
                onClick={() => {
                  setIsModalOpen(false);
                  reset();
                  setSelectedCustomer('');
                }}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-4">
              {/* Customer Selection */}
              <div>
                <label className="label">לקוח *</label>
                <select
                  value={selectedCustomer}
                  onChange={(e) => {
                    setSelectedCustomer(e.target.value);
                    setValue('site_id', ''); // Reset site when customer changes
                  }}
                  className="input"
                >
                  <option value="">בחר לקוח...</option>
                  {customersData?.customers?.map((customer: { id: string; company_name: string }) => (
                    <option key={customer.id} value={customer.id}>
                      {customer.company_name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Site Selection */}
              <div>
                <label className="label">אתר *</label>
                <select
                  {...register('site_id')}
                  className="input"
                  disabled={!selectedCustomer}
                >
                  <option value="">בחר אתר...</option>
                  {sitesData?.sites?.map((site: { id: string; name: string; address: string }) => (
                    <option key={site.id} value={site.id}>
                      {site.name} - {site.address}
                    </option>
                  ))}
                </select>
                {errors.site_id && (
                  <p className="text-sm text-red-600 mt-1">{errors.site_id.message}</p>
                )}
              </div>

              {/* Date and Time */}
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="label">תאריך *</label>
                  <input {...register('date')} type="date" className="input" />
                  {errors.date && (
                    <p className="text-sm text-red-600 mt-1">{errors.date.message}</p>
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
              </div>

              {/* Required Employees */}
              <div>
                <label className="label">מספר עובדים נדרש *</label>
                <input
                  {...register('required_employees', { valueAsNumber: true })}
                  type="number"
                  min="1"
                  className="input w-32"
                />
                {errors.required_employees && (
                  <p className="text-sm text-red-600 mt-1">{errors.required_employees.message}</p>
                )}
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
                    setSelectedCustomer('');
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
