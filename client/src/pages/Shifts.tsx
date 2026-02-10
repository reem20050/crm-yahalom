import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { format, startOfWeek, addDays } from 'date-fns';
import { he } from 'date-fns/locale';
import toast from 'react-hot-toast';
import { ChevronRight, ChevronLeft, Users, Plus, X, Clock, MapPin, Shield, Car, Trash2, UserPlus, AlertTriangle } from 'lucide-react';
import { shiftsApi, customersApi, sitesApi, employeesApi } from '../services/api';

// ── Types ───────────────────────────────────────────────────────────────────

interface ShiftAssignment {
  id: string;
  employee_id: string;
  employee_name: string;
  role: string;
  status: string;
  check_in_time?: string;
  check_out_time?: string;
}

interface ShiftSummary {
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
}

interface ShiftDetail {
  id: string;
  customer_id: string;
  site_id: string;
  company_name: string;
  site_name: string;
  site_address?: string;
  date: string;
  start_time: string;
  end_time: string;
  required_employees: number;
  requires_weapon: boolean;
  requires_vehicle: boolean;
  notes?: string;
  status: string;
  assignments: ShiftAssignment[];
}

interface Employee {
  id: string;
  first_name: string;
  last_name: string;
}

// ── Schema ──────────────────────────────────────────────────────────────────

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

// ── Shift Detail Modal Component ────────────────────────────────────────────

function ShiftDetailModal({
  shiftId,
  onClose,
}: {
  shiftId: string;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [assignRole, setAssignRole] = useState('מאבטח');
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Fetch shift details (includes assignments)
  const { data: shiftData, isLoading: isLoadingShift } = useQuery({
    queryKey: ['shift-detail', shiftId],
    queryFn: () => shiftsApi.getOne(shiftId).then((res) => res.data),
  });

  const shift: ShiftDetail | undefined = shiftData?.shift ?? shiftData;

  // Fetch active employees for the assign dropdown
  const { data: employeesData } = useQuery({
    queryKey: ['employees-active'],
    queryFn: () => employeesApi.getAll({ status: 'active', limit: 200 }).then((res) => res.data),
  });

  const employees: Employee[] = employeesData?.employees ?? [];

  // Assign employee mutation
  const assignMutation = useMutation({
    mutationFn: (data: { employee_id: string; role: string }) =>
      shiftsApi.assign(shiftId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shift-detail', shiftId] });
      queryClient.invalidateQueries({ queryKey: ['shifts'] });
      toast.success('העובד שובץ בהצלחה');
      setSelectedEmployeeId('');
      setAssignRole('מאבטח');
    },
    onError: () => {
      toast.error('שגיאה בשיבוץ העובד');
    },
  });

  // Unassign employee mutation
  const unassignMutation = useMutation({
    mutationFn: (assignmentId: string) =>
      shiftsApi.unassign(shiftId, assignmentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shift-detail', shiftId] });
      queryClient.invalidateQueries({ queryKey: ['shifts'] });
      toast.success('העובד הוסר מהמשמרת');
    },
    onError: () => {
      toast.error('שגיאה בהסרת העובד');
    },
  });

  // Delete shift mutation
  const deleteMutation = useMutation({
    mutationFn: () => shiftsApi.delete(shiftId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shifts'] });
      toast.success('המשמרת נמחקה בהצלחה');
      onClose();
    },
    onError: () => {
      toast.error('שגיאה במחיקת המשמרת');
    },
  });

  const handleAssign = () => {
    if (!selectedEmployeeId) {
      toast.error('נא לבחור עובד');
      return;
    }
    assignMutation.mutate({ employee_id: selectedEmployeeId, role: assignRole });
  };

  const handleDelete = () => {
    deleteMutation.mutate();
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'checked_in':
        return <span className="badge-success">נכנס</span>;
      case 'checked_out':
        return <span className="badge-info">יצא</span>;
      case 'no_show':
        return <span className="badge-danger">לא הגיע</span>;
      default:
        return <span className="badge-warning">משובץ</span>;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-xl font-bold">פרטי משמרת</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {isLoadingShift ? (
          <div className="flex items-center justify-center h-48">
            <div className="animate-spin rounded-full h-8 w-8 border-4 border-primary-500 border-t-transparent"></div>
          </div>
        ) : shift ? (
          <div className="p-6 space-y-6">
            {/* Shift Info */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <MapPin className="w-5 h-5 text-gray-400" />
                <div>
                  <p className="font-semibold text-lg">{shift.company_name}</p>
                  <p className="text-gray-500">{shift.site_name}{shift.site_address ? ` - ${shift.site_address}` : ''}</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-gray-400" />
                <div>
                  <p className="text-gray-700">
                    {shift.date ? format(new Date(shift.date + 'T00:00:00'), 'EEEE, d MMMM yyyy', { locale: he }) : ''}
                  </p>
                  <p className="text-gray-500">{shift.start_time} - {shift.end_time}</p>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <Users className="w-5 h-5 text-gray-400" />
                  <span>נדרשים: {shift.required_employees} עובדים</span>
                </div>
                {shift.requires_weapon && (
                  <div className="flex items-center gap-1 text-orange-600">
                    <Shield className="w-4 h-4" />
                    <span className="text-sm">נדרש נשק</span>
                  </div>
                )}
                {shift.requires_vehicle && (
                  <div className="flex items-center gap-1 text-blue-600">
                    <Car className="w-4 h-4" />
                    <span className="text-sm">נדרש רכב</span>
                  </div>
                )}
              </div>

              {shift.notes && (
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-sm text-gray-600">{shift.notes}</p>
                </div>
              )}
            </div>

            {/* Assigned Employees */}
            <div className="border-t pt-4">
              <h3 className="font-semibold text-lg mb-3 flex items-center gap-2">
                <Users className="w-5 h-5" />
                עובדים משובצים ({shift.assignments?.length || 0}/{shift.required_employees})
              </h3>

              {shift.assignments && shift.assignments.length > 0 ? (
                <div className="space-y-2">
                  {shift.assignments.map((assignment) => (
                    <div
                      key={assignment.id}
                      className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-primary-100 text-primary-700 rounded-full flex items-center justify-center text-sm font-medium">
                          {assignment.employee_name?.charAt(0) || '?'}
                        </div>
                        <div>
                          <p className="font-medium">{assignment.employee_name}</p>
                          <p className="text-sm text-gray-500">{assignment.role}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        {getStatusBadge(assignment.status)}
                        <button
                          onClick={() => unassignMutation.mutate(assignment.id)}
                          disabled={unassignMutation.isPending}
                          className="text-red-500 hover:text-red-700 hover:bg-red-50 p-1.5 rounded-lg transition-colors text-sm"
                          title="הסר מהמשמרת"
                        >
                          הסר
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-400 text-sm text-center py-4">
                  אין עובדים משובצים למשמרת זו
                </p>
              )}
            </div>

            {/* Assign Employee Section */}
            <div className="border-t pt-4">
              <h3 className="font-semibold text-lg mb-3 flex items-center gap-2">
                <UserPlus className="w-5 h-5" />
                שבץ עובד
              </h3>
              <div className="flex gap-3 items-end">
                <div className="flex-1">
                  <label className="label">עובד</label>
                  <select
                    value={selectedEmployeeId}
                    onChange={(e) => setSelectedEmployeeId(e.target.value)}
                    className="input"
                  >
                    <option value="">בחר עובד...</option>
                    {employees.map((emp) => (
                      <option key={emp.id} value={emp.id}>
                        {emp.first_name} {emp.last_name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="w-40">
                  <label className="label">תפקיד</label>
                  <input
                    type="text"
                    value={assignRole}
                    onChange={(e) => setAssignRole(e.target.value)}
                    className="input"
                    placeholder="מאבטח"
                  />
                </div>
                <button
                  onClick={handleAssign}
                  disabled={assignMutation.isPending || !selectedEmployeeId}
                  className="btn-primary whitespace-nowrap"
                >
                  {assignMutation.isPending ? 'משבץ...' : 'שבץ'}
                </button>
              </div>
            </div>

            {/* Delete Shift */}
            <div className="border-t pt-4">
              {!showDeleteConfirm ? (
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  className="btn-danger flex items-center gap-2"
                >
                  <Trash2 className="w-4 h-4" />
                  מחק משמרת
                </button>
              ) : (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <AlertTriangle className="w-5 h-5 text-red-600" />
                    <p className="font-medium text-red-800">
                      האם אתה בטוח שברצונך למחוק משמרת זו?
                    </p>
                  </div>
                  <p className="text-sm text-red-600 mb-3">
                    פעולה זו תמחק את המשמרת ואת כל השיבוצים שלה. לא ניתן לבטל פעולה זו.
                  </p>
                  <div className="flex gap-3">
                    <button
                      onClick={handleDelete}
                      disabled={deleteMutation.isPending}
                      className="btn-danger"
                    >
                      {deleteMutation.isPending ? 'מוחק...' : 'כן, מחק'}
                    </button>
                    <button
                      onClick={() => setShowDeleteConfirm(false)}
                      className="btn-secondary"
                    >
                      ביטול
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center h-48 text-gray-400">
            לא נמצאו פרטי משמרת
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main Shifts Page Component ──────────────────────────────────────────────

export default function Shifts() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedShiftId, setSelectedShiftId] = useState<string | null>(null);
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
                    shifts.map((shift: ShiftSummary) => (
                      <div
                        key={shift.id}
                        onClick={() => setSelectedShiftId(shift.id)}
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

      {/* Shift Detail Modal */}
      {selectedShiftId && (
        <ShiftDetailModal
          shiftId={selectedShiftId}
          onClose={() => setSelectedShiftId(null)}
        />
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
