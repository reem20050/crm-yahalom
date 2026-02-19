import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { format, startOfWeek, addDays } from 'date-fns';
import { he } from 'date-fns/locale';
import toast from 'react-hot-toast';
import { ChevronRight, ChevronLeft, Users, Plus, X, Clock, MapPin, Shield, Car, Trash2, UserPlus, AlertTriangle, MessageCircle, Send, Copy, FileText, LogIn, LogOut, Check } from 'lucide-react';
import { shiftsApi, customersApi, sitesApi, employeesApi, shiftTemplatesApi } from '../services/api';
import { SkeletonPulse } from '../components/Skeleton';
import ShiftTemplateModal, { GenerateFromTemplateModal } from '../components/ShiftTemplateModal';
import PatrolLogView from '../components/PatrolLogView';
import { usePermissions } from '../hooks/usePermissions';
import { openWhatsApp, formatPhoneForWhatsApp } from '../components/WhatsAppButton';
import { useBulkSelection } from '../hooks/useBulkSelection';
import BulkActionBar from '../components/BulkActionBar';

// ── Types ───────────────────────────────────────────────────────────────────

interface ShiftAssignment {
  id: string;
  employee_id: string;
  employee_name: string;
  employee_phone?: string;
  role: string;
  status: string;
  check_in_time?: string;
  check_out_time?: string;
  check_in_distance_meters?: number;
  check_out_distance_meters?: number;
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
  site_id: z.string().optional(),
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

// ── GPS Helper ──────────────────────────────────────────────────────────────

function getLocation(): Promise<{ latitude: number; longitude: number } | null> {
  return new Promise((resolve) => {
    if (!navigator.geolocation) {
      resolve(null);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  });
}

// ── Shift Detail Modal Component ────────────────────────────────────────────

function ShiftDetailModal({
  shiftId,
  onClose,
}: {
  shiftId: string;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const { can } = usePermissions();
  const [assignRole, setAssignRole] = useState('מאבטח');
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Fetch shift details (includes assignments)
  const { data: shiftData, isLoading: isLoadingShift } = useQuery({
    queryKey: ['shift-detail', shiftId],
    queryFn: () => shiftsApi.getOne(shiftId).then((res) => res.data),
  });

  const shift: ShiftDetail | undefined = shiftData?.shift ?? shiftData;
  const assignments: ShiftAssignment[] = shiftData?.assignments ?? shift?.assignments ?? [];

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

  // WhatsApp reminder - opens WhatsApp Web with pre-filled message
  const sendReminder = (phone: string, name: string) => {
    const msg = `שלום ${name}, תזכורת למשמרת:\n📍 ${shift?.company_name} - ${shift?.site_name}\n📅 ${shift?.date}\n⏰ ${shift?.start_time} - ${shift?.end_time}${shift?.site_address ? `\n🗺️ ${shift.site_address}` : ''}\n\nצוות יהלום`;
    openWhatsApp(phone, msg);
  };

  // Check-in mutation (with GPS)
  const checkInMutation = useMutation({
    mutationFn: async (assignmentId: string) => {
      const location = await getLocation();
      return shiftsApi.checkIn(assignmentId, location ? { latitude: location.latitude, longitude: location.longitude } : undefined);
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['shift-detail', shiftId] });
      queryClient.invalidateQueries({ queryKey: ['shifts'] });
      toast.success('צ\'ק-אין בוצע בהצלחה');
      if (data?.data?.location_warning) {
        toast(data.data.location_warning, { icon: '\u26A0\uFE0F', duration: 6000 });
      }
    },
    onError: () => toast.error('שגיאה בביצוע צ\'ק-אין'),
  });

  // Check-out mutation (with GPS)
  const checkOutMutation = useMutation({
    mutationFn: async (assignmentId: string) => {
      const location = await getLocation();
      return shiftsApi.checkOut(assignmentId, location ? { latitude: location.latitude, longitude: location.longitude } : undefined);
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['shift-detail', shiftId] });
      queryClient.invalidateQueries({ queryKey: ['shifts'] });
      toast.success('צ\'ק-אאוט בוצע בהצלחה');
      if (data?.data?.location_warning) {
        toast(data.data.location_warning, { icon: '\u26A0\uFE0F', duration: 6000 });
      }
    },
    onError: () => toast.error('שגיאה בביצוע צ\'ק-אאוט'),
  });

  const isToday = shift?.date === format(new Date(), 'yyyy-MM-dd');

  const sendReminderToAll = () => {
    const withPhone = assignments.filter((a) => a.employee_phone);
    if (withPhone.length === 0) {
      toast.error('אין מספרי טלפון לעובדים המשובצים');
      return;
    }
    // Open WhatsApp Web for each employee (each in a new tab)
    withPhone.forEach((a) => {
      sendReminder(a.employee_phone!, a.employee_name);
    });
    toast.success(`נפתחו ${withPhone.length} חלונות WhatsApp - שלח את ההודעות`);
  };

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
    <div className="modal-backdrop">
      <div className="modal-content w-full max-w-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-xl font-bold font-heading">פרטי משמרת</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {isLoadingShift ? (
          <div className="flex items-center justify-center h-48">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary-600 border-t-transparent"></div>
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
              <div className="flex items-center justify-between mb-3">
                <div className="section-header">
                  <div className="section-header-icon">
                    <Users className="w-4 h-4" />
                  </div>
                  <h3 className="section-header-title">עובדים משובצים ({assignments.length}/{shift.required_employees})</h3>
                </div>
                {assignments.length > 0 && (
                  <button
                    onClick={sendReminderToAll}
                    className="text-sm flex items-center gap-1 px-3 py-1.5 rounded-lg bg-green-50 text-green-700 hover:bg-green-100 transition-colors"
                  >
                    <MessageCircle className="w-3.5 h-3.5" />
                    שלח תזכורת לכולם
                  </button>
                )}
              </div>

              {assignments.length > 0 ? (
                <div className="space-y-2">
                  {assignments.map((assignment) => (
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
                      <div className="flex items-center gap-2">
                        {getStatusBadge(assignment.status)}
                        {/* Check-in/out buttons for today's shifts */}
                        {isToday && assignment.status === 'assigned' && (
                          <button
                            onClick={() => checkInMutation.mutate(assignment.id)}
                            disabled={checkInMutation.isPending}
                            className="flex items-center gap-1 px-2 py-1 text-xs rounded-lg bg-green-100 text-green-700 hover:bg-green-200 transition-colors"
                            title="צ'ק-אין"
                          >
                            <LogIn className="w-3.5 h-3.5" />
                            כניסה
                          </button>
                        )}
                        {isToday && assignment.status === 'checked_in' && !assignment.check_out_time && (
                          <button
                            onClick={() => checkOutMutation.mutate(assignment.id)}
                            disabled={checkOutMutation.isPending}
                            className="flex items-center gap-1 px-2 py-1 text-xs rounded-lg bg-blue-100 text-blue-700 hover:bg-blue-200 transition-colors"
                            title="צ'ק-אאוט"
                          >
                            <LogOut className="w-3.5 h-3.5" />
                            יציאה
                          </button>
                        )}
                        {assignment.check_in_time && (
                          <span className="text-xs text-gray-400" title="שעת כניסה">
                            {new Date(assignment.check_in_time).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        )}
                        {assignment.check_in_distance_meters != null && (
                          <span
                            className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${
                              assignment.check_in_distance_meters <= 200
                                ? 'bg-green-100 text-green-700'
                                : 'bg-orange-100 text-orange-700'
                            }`}
                            title="מרחק כניסה מהאתר"
                          >
                            {Math.round(assignment.check_in_distance_meters)}מ'
                          </span>
                        )}
                        {assignment.check_out_time && (
                          <span className="text-xs text-gray-400" title="שעת יציאה">
                            - {new Date(assignment.check_out_time).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        )}
                        {assignment.check_out_distance_meters != null && (
                          <span
                            className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${
                              assignment.check_out_distance_meters <= 200
                                ? 'bg-green-100 text-green-700'
                                : 'bg-orange-100 text-orange-700'
                            }`}
                            title="מרחק יציאה מהאתר"
                          >
                            {Math.round(assignment.check_out_distance_meters)}מ'
                          </span>
                        )}
                        {assignment.employee_phone && (
                          <button
                            onClick={() => sendReminder(assignment.employee_phone!, assignment.employee_name)}
                            className="text-green-500 hover:text-green-700 hover:bg-green-50 p-1.5 rounded-lg transition-colors"
                            title="שלח תזכורת WhatsApp"
                          >
                            <MessageCircle className="w-4 h-4" />
                          </button>
                        )}
                        {can('shifts:assign') && (
                          <button
                            onClick={() => unassignMutation.mutate(assignment.id)}
                            disabled={unassignMutation.isPending}
                            className="text-red-500 hover:text-red-700 hover:bg-red-50 p-1.5 rounded-lg transition-colors text-sm"
                            title="הסר מהמשמרת"
                          >
                            הסר
                          </button>
                        )}
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

            {/* Patrol Logs Section */}
            {shift.site_id && (
              <div className="border-t pt-4">
                <div className="section-header mb-3">
                  <div className="section-header-icon">
                    <MapPin className="w-4 h-4" />
                  </div>
                  <h3 className="section-header-title">סיורים ונקודות ביקורת</h3>
                </div>
                <PatrolLogView siteId={shift.site_id} />
              </div>
            )}

            {/* Assign Employee Section */}
            {can('shifts:assign') && (
              <div className="border-t pt-4">
                <div className="section-header mb-3">
                  <div className="section-header-icon">
                    <UserPlus className="w-4 h-4" />
                  </div>
                  <h3 className="section-header-title">שבץ עובד</h3>
                </div>
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
            )}

            {/* Delete Shift */}
            {can('shifts:delete') && <div className="border-t pt-4">
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
            </div>}
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
  const [showTemplates, setShowTemplates] = useState(false);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [generateTemplate, setGenerateTemplate] = useState<{ id: string; name: string } | null>(null);
  const weekStart = startOfWeek(currentDate, { weekStartsOn: 0 });
  const queryClient = useQueryClient();
  const { can } = usePermissions();
  const { selectedIds, selectedCount, isSelected, toggleSelect, toggleAll, clearSelection } = useBulkSelection();

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

  // Fetch shift templates
  const { data: templatesData } = useQuery({
    queryKey: ['shift-templates'],
    queryFn: () => shiftTemplatesApi.getAll().then((res) => res.data),
    enabled: showTemplates,
  });

  const deleteTemplateMutation = useMutation({
    mutationFn: (tmplId: string) => shiftTemplatesApi.delete(tmplId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shift-templates'] });
      toast.success('התבנית נמחקה');
    },
    onError: () => toast.error('שגיאה במחיקה'),
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

  const bulkApproveMutation = useMutation({
    mutationFn: (ids: string[]) => shiftsApi.bulkApprove(ids),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['shifts'] });
      clearSelection();
      toast.success(res.data.message || 'משמרות אושרו בהצלחה');
    },
    onError: () => toast.error('שגיאה באישור משמרות'),
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: (ids: string[]) => shiftsApi.bulkDelete(ids),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['shifts'] });
      clearSelection();
      toast.success(res.data.message || 'משמרות נמחקו');
    },
    onError: () => toast.error('שגיאה במחיקת משמרות'),
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

  const allShifts: ShiftSummary[] = data?.shifts || [];

  return (
    <div className="space-y-6">
      <div className="page-header flex-wrap gap-4">
        <div>
          <h1 className="page-title">משמרות</h1>
          <p className="page-subtitle">לוח משמרות שבועי</p>
        </div>
        <div className="flex items-center gap-2">
          {allShifts.length > 0 && can('shifts:delete') && (
            <label className="flex items-center gap-2 text-sm text-gray-500 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={selectedCount > 0 && selectedCount === allShifts.length}
                onChange={() => toggleAll(allShifts.map((s: ShiftSummary) => s.id))}
                className="w-4 h-4 rounded border-gray-300"
              />
              בחר הכל
            </label>
          )}
          {can('shifts:create') && (
            <button onClick={() => setShowTemplates(!showTemplates)} className="btn-secondary flex items-center gap-2">
              <FileText className="w-4 h-4" />
              תבניות
            </button>
          )}
          {can('shifts:create') && (
            <button onClick={() => setIsModalOpen(true)} className="btn-primary flex items-center gap-2">
              <Plus className="w-4 h-4" />
              משמרת חדשה
            </button>
          )}
        </div>
      </div>

      {/* Shift Templates Section */}
      {showTemplates && (
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">תבניות משמרות</h2>
            <button onClick={() => setShowTemplateModal(true)} className="btn-primary text-sm flex items-center gap-1">
              <Plus className="w-4 h-4" />
              תבנית חדשה
            </button>
          </div>
          {templatesData?.templates?.length > 0 ? (
            <div className="space-y-2">
              {templatesData.templates.map((tmpl: { id: string; name: string; company_name?: string; site_name?: string; start_time: string; end_time: string; days_of_week: string; required_employees: number; is_active: number }) => {
                const days = typeof tmpl.days_of_week === 'string' ? JSON.parse(tmpl.days_of_week) : tmpl.days_of_week;
                const dayNames = ['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ש'];
                return (
                  <div key={tmpl.id} className={`flex items-center justify-between p-3 rounded-lg ${tmpl.is_active ? 'bg-primary-50 border border-primary-200' : 'bg-gray-50'}`}>
                    <div>
                      <p className="font-medium">{tmpl.name}</p>
                      <p className="text-sm text-gray-500">
                        {tmpl.company_name && `${tmpl.company_name} `}
                        {tmpl.site_name && `- ${tmpl.site_name} `}
                        | {tmpl.start_time}-{tmpl.end_time}
                        | {tmpl.required_employees} עובדים
                      </p>
                      <p className="text-xs text-gray-400 mt-1">
                        ימים: {(days || []).map((d: number) => dayNames[d]).join(', ')}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setGenerateTemplate({ id: tmpl.id, name: tmpl.name })}
                        className="btn-success text-xs flex items-center gap-1 px-2 py-1"
                      >
                        <Copy className="w-3.5 h-3.5" />
                        צור משמרות
                      </button>
                      <button
                        onClick={() => deleteTemplateMutation.mutate(tmpl.id)}
                        className="text-red-400 hover:text-red-600 p-1"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-gray-400 text-center py-4">אין תבניות. צור תבנית ראשונה כדי לחסוך זמן.</p>
          )}
        </div>
      )}

      {/* Template Modals */}
      {showTemplateModal && (
        <ShiftTemplateModal onClose={() => setShowTemplateModal(false)} />
      )}
      {generateTemplate && (
        <GenerateFromTemplateModal
          templateId={generateTemplate.id}
          templateName={generateTemplate.name}
          onClose={() => setGenerateTemplate(null)}
        />
      )}

      {/* Week navigation */}
      <div className="card !p-4">
        <div className="flex items-center justify-between">
          <button
            onClick={() => setCurrentDate(addDays(currentDate, -7))}
            className="w-9 h-9 flex items-center justify-center rounded-xl bg-gray-50 hover:bg-gray-100 text-gray-500 transition-colors"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
          <h2 className="text-sm font-semibold text-gray-900">
            {format(weekStart, 'd MMMM', { locale: he })} -{' '}
            {format(addDays(weekStart, 6), 'd MMMM yyyy', { locale: he })}
          </h2>
          <button
            onClick={() => setCurrentDate(addDays(currentDate, 7))}
            className="w-9 h-9 flex items-center justify-center rounded-xl bg-gray-50 hover:bg-gray-100 text-gray-500 transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-2">
              <SkeletonPulse className="h-8 w-32" />
              <SkeletonPulse className="h-4 w-48" />
            </div>
            <div className="flex gap-2">
              <SkeletonPulse className="h-10 w-10 rounded-xl" />
              <SkeletonPulse className="h-10 w-32 rounded-xl" />
              <SkeletonPulse className="h-10 w-10 rounded-xl" />
            </div>
          </div>
          <div className="grid grid-cols-7 gap-3">
            {Array.from({ length: 7 }).map((_, i) => (
              <div key={i} className="bg-white rounded-2xl shadow-card p-3 min-h-[200px] space-y-2">
                <SkeletonPulse className="h-5 w-16" />
                <SkeletonPulse className="h-4 w-10" />
                <SkeletonPulse className="h-16 w-full rounded-lg" />
                <SkeletonPulse className="h-16 w-full rounded-lg" />
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-7 gap-3">
          {days.map((day) => {
            const shifts = getShiftsForDay(day);
            const isToday = format(day, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd');

            return (
              <div
                key={day.toISOString()}
                className={`card !p-3 min-h-[200px] ${isToday ? 'ring-2 ring-primary-500/40 !shadow-sm' : ''}`}
              >
                <div className="text-center mb-3">
                  <p className="text-xs text-gray-400 font-medium">
                    {format(day, 'EEEE', { locale: he })}
                  </p>
                  <p className={`text-lg font-bold mt-0.5 ${isToday ? 'text-primary-600' : 'text-gray-900'}`}>
                    {format(day, 'd')}
                  </p>
                </div>

                <div className="space-y-2">
                  {shifts.length > 0 ? (
                    shifts.map((shift: ShiftSummary) => {
                      const isFull = shift.assigned_count >= shift.required_employees;
                      const isPartial = shift.assigned_count > 0 && shift.assigned_count < shift.required_employees;
                      const isUnassigned = shift.assigned_count === 0;
                      return (
                      <div
                        key={shift.id}
                        onClick={() => setSelectedShiftId(shift.id)}
                        className={`p-2 rounded-lg text-xs cursor-pointer hover:shadow-card-hover transition-all ${
                          isSelected(shift.id) ? 'ring-2 ring-primary-500 ' : ''
                        }${
                          isFull
                            ? 'bg-success-50/80 border border-success-100 border-r-4 border-r-success-300'
                            : isPartial
                            ? 'bg-warning-50/80 border border-warning-100 border-r-4 border-r-warning-300'
                            : 'bg-danger-50/80 border border-danger-100 border-r-4 border-r-danger-300'
                        }`}
                      >
                        <div className="flex items-center gap-1.5 mb-1">
                          <input
                            type="checkbox"
                            checked={isSelected(shift.id)}
                            onChange={() => toggleSelect(shift.id)}
                            className="w-3.5 h-3.5 rounded border-gray-300 flex-shrink-0"
                            onClick={(e) => e.stopPropagation()}
                          />
                          <p className="font-medium truncate text-gray-900 flex-1">{shift.company_name}</p>
                        </div>
                        <p className="text-gray-500 truncate">{shift.site_name}</p>
                        <p className="text-gray-400 mt-0.5 font-mono">
                          {shift.start_time} - {shift.end_time}
                        </p>
                        <div className="flex items-center gap-2 mt-1.5">
                          <div className="flex items-center gap-1 text-gray-500">
                            <Users className="w-3 h-3" />
                            <span>{shift.assigned_count}/{shift.required_employees}</span>
                          </div>
                          {shift.requires_weapon && <Shield className="w-3 h-3 text-amber-500" />}
                          {shift.requires_vehicle && <Car className="w-3 h-3 text-sky-500" />}
                        </div>
                      </div>
                      );
                    })
                  ) : (
                    <p className="text-xs text-gray-300 text-center py-4">—</p>
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

      {/* Bulk Action Bar */}
      <BulkActionBar
        selectedCount={selectedCount}
        onClear={clearSelection}
        actions={[
          {
            label: 'אשר נבחרים',
            onClick: () => bulkApproveMutation.mutate([...selectedIds]),
            icon: <Check className="w-4 h-4" />,
            variant: 'success',
            loading: bulkApproveMutation.isPending,
          },
          {
            label: 'מחק נבחרים',
            onClick: () => {
              if (confirm('האם למחוק את המשמרות הנבחרות?')) {
                bulkDeleteMutation.mutate([...selectedIds]);
              }
            },
            icon: <Trash2 className="w-4 h-4" />,
            variant: 'danger',
            loading: bulkDeleteMutation.isPending,
          },
        ]}
      />

      {/* Create Shift Modal */}
      {isModalOpen && (
        <div className="modal-backdrop">
          <div className="modal-content w-full max-w-lg">
            <div className="flex items-center justify-between p-6 border-b">
              <h2 className="text-xl font-bold font-heading">משמרת חדשה</h2>
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
                <label className="label">אתר</label>
                <select
                  {...register('site_id')}
                  className="input"
                  disabled={!selectedCustomer}
                >
                  <option value="">
                    {!selectedCustomer
                      ? 'יש לבחור לקוח תחילה...'
                      : sitesData?.sites?.length === 0
                        ? 'אין אתרים ללקוח זה'
                        : 'בחר אתר...'}
                  </option>
                  {sitesData?.sites?.map((site: { id: string; name: string; address: string }) => (
                    <option key={site.id} value={site.id}>
                      {site.name} - {site.address}
                    </option>
                  ))}
                </select>
                {!selectedCustomer && (
                  <p className="text-sm text-gray-400 mt-1">בחר לקוח כדי לראות את רשימת האתרים</p>
                )}
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
