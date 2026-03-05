import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import {
  ArrowRight,
  PartyPopper,
  Calendar,
  MapPin,
  Users,
  Clock,
  Shield,
  Car,
  Pencil,
  Save,
  X,
  Trash2,
  CheckCircle,
  UserPlus,
  Phone,
  Building2,
} from 'lucide-react';
import { eventsApi, employeesApi, contractorsApi } from '../services/api';

const statusOptions = [
  { value: 'quote', label: 'הצעת מחיר' },
  { value: 'approved', label: 'מאושר' },
  { value: 'staffed', label: 'מאויש' },
  { value: 'completed', label: 'הושלם' },
  { value: 'cancelled', label: 'בוטל' },
];

const statusColors: Record<string, string> = {
  quote: 'badge-warning',
  approved: 'badge-info',
  staffed: 'badge-info',
  completed: 'badge-success',
  cancelled: 'badge-gray',
};

interface Assignment {
  id: string;
  employee_id: string;
  employee_name: string;
  employee_phone: string;
  role: string;
  status: string;
}

interface ContractorAssignment {
  id: string;
  contractor_id: string;
  company_name: string;
  contact_name: string;
  contractor_phone: string;
  workers_count: number;
  hourly_rate: number;
  notes: string;
}

interface Contractor {
  id: string;
  company_name: string;
  contact_name: string;
  phone: string;
  status: string;
}

interface Employee {
  id: string;
  first_name: string;
  last_name: string;
  phone: string;
  role: string;
  status: string;
}

export default function EventDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState<Record<string, unknown>>({});
  const [showAssignDropdown, setShowAssignDropdown] = useState(false);
  const [showContractorDropdown, setShowContractorDropdown] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // ---------- Queries ----------

  const { data, isLoading } = useQuery({
    queryKey: ['event', id],
    queryFn: () => eventsApi.getOne(id!).then((res) => res.data),
    enabled: !!id,
  });

  const { data: employeesData } = useQuery({
    queryKey: ['employees', 'active'],
    queryFn: () => employeesApi.getAll({ status: 'active' }).then((res) => res.data),
    enabled: showAssignDropdown,
  });

  const { data: contractorsData } = useQuery({
    queryKey: ['contractors', 'active'],
    queryFn: () => contractorsApi.getAll({ status: 'active' }).then((res) => res.data),
    enabled: showContractorDropdown,
  });

  const event = data?.event;

  // Populate edit form when entering edit mode or when data loads
  useEffect(() => {
    if (event && isEditing) {
      setEditForm({
        event_name: event.event_name || '',
        event_date: event.event_date || '',
        start_time: event.start_time || '',
        end_time: event.end_time || '',
        location: event.location || '',
        address: event.address || '',
        required_guards: event.required_guards || 0,
        event_type: event.event_type || '',
        expected_attendance: event.expected_attendance || '',
        price: event.price || '',
        requires_weapon: event.requires_weapon || false,
        requires_vehicle: event.requires_vehicle || false,
        special_equipment: event.special_equipment || '',
        notes: event.notes || '',
        company_name: event.company_name || '',
      });
    }
  }, [event, isEditing]);

  // ---------- Mutations ----------

  const updateMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => eventsApi.update(id!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['event', id] });
      queryClient.invalidateQueries({ queryKey: ['events'] });
      toast.success('האירוע עודכן בהצלחה');
      setIsEditing(false);
    },
    onError: () => {
      toast.error('שגיאה בעדכון האירוע');
    },
  });

  const statusMutation = useMutation({
    mutationFn: (status: string) => eventsApi.update(id!, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['event', id] });
      queryClient.invalidateQueries({ queryKey: ['events'] });
      toast.success('סטטוס עודכן');
    },
    onError: () => {
      toast.error('שגיאה בעדכון סטטוס');
    },
  });

  const completeMutation = useMutation({
    mutationFn: () => eventsApi.complete(id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['event', id] });
      queryClient.invalidateQueries({ queryKey: ['events'] });
      toast.success('האירוע סומן כהושלם');
    },
    onError: () => {
      toast.error('שגיאה בסימון האירוע כהושלם');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => eventsApi.delete(id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
      toast.success('האירוע נמחק');
      navigate('/events');
    },
    onError: () => {
      toast.error('שגיאה במחיקת האירוע');
    },
  });

  const assignMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => eventsApi.assign(id!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['event', id] });
      toast.success('עובד שובץ בהצלחה');
      setShowAssignDropdown(false);
    },
    onError: () => {
      toast.error('שגיאה בשיבוץ עובד');
    },
  });

  const unassignMutation = useMutation({
    mutationFn: (assignmentId: string) => eventsApi.unassign(id!, assignmentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['event', id] });
      toast.success('שיבוץ עובד הוסר');
    },
    onError: () => {
      toast.error('שגיאה בהסרת שיבוץ');
    },
  });

  const assignContractorMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => eventsApi.assignContractor(id!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['event', id] });
      toast.success('קבלן שובץ בהצלחה');
      setShowContractorDropdown(false);
    },
    onError: () => {
      toast.error('שגיאה בשיבוץ קבלן');
    },
  });

  const unassignContractorMutation = useMutation({
    mutationFn: (assignmentId: string) => eventsApi.unassignContractor(id!, assignmentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['event', id] });
      toast.success('שיבוץ קבלן הוסר');
    },
    onError: () => {
      toast.error('שגיאה בהסרת שיבוץ קבלן');
    },
  });

  // ---------- Handlers ----------

  const handleSaveEdit = () => {
    const payload: Record<string, unknown> = { ...editForm };
    if (payload.price) payload.price = Number(payload.price);
    if (payload.required_guards) payload.required_guards = Number(payload.required_guards);
    if (payload.expected_attendance) payload.expected_attendance = Number(payload.expected_attendance);
    updateMutation.mutate(payload);
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditForm({});
  };

  const handleAssignEmployee = (employee: Employee) => {
    assignMutation.mutate({
      employee_id: employee.id,
      role: employee.role || 'מאבטח',
    });
  };

  const handleDelete = () => {
    deleteMutation.mutate();
    setShowDeleteConfirm(false);
  };

  const handleAssignContractor = (contractor: Contractor) => {
    assignContractorMutation.mutate({
      contractor_id: contractor.id,
      workers_count: 1,
    });
  };

  // Filter out already-assigned employees
  const assignedIds = (data?.assignments || []).map((a: Assignment) => a.employee_id);
  const availableEmployees = (employeesData?.employees || []).filter(
    (emp: Employee) => !assignedIds.includes(emp.id)
  );

  // Filter out already-assigned contractors
  const assignedContractorIds = (data?.contractorAssignments || []).map(
    (a: ContractorAssignment) => a.contractor_id
  );
  const availableContractors = (contractorsData?.contractors || []).filter(
    (c: Contractor) => !assignedContractorIds.includes(c.id)
  );

  // ---------- Loading ----------

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary-600 border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Back button */}
      <button
        onClick={() => navigate('/events')}
        className="flex items-center gap-2 text-gray-600 hover:text-gray-900"
      >
        <ArrowRight className="w-5 h-5" />
        חזרה לאירועים
      </button>

      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-4">
          <div className="w-16 h-16 bg-gradient-to-br from-orange-100 to-orange-50 rounded-xl flex items-center justify-center">
            <PartyPopper className="w-8 h-8 text-orange-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 font-heading">{event?.event_name}</h1>
            <p className="text-gray-500">{event?.company_name}</p>
            {event?.status && (
              <span className={`badge mt-1 ${statusColors[event.status] || 'badge-gray'}`}>
                {statusOptions.find((s) => s.value === event.status)?.label || event.status}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {!isEditing && (
            <button
              onClick={() => setIsEditing(true)}
              className="btn-secondary flex items-center gap-2"
            >
              <Pencil className="w-4 h-4" />
              עריכה
            </button>
          )}
          {isEditing && (
            <>
              <button
                onClick={handleSaveEdit}
                disabled={updateMutation.isPending}
                className="btn-primary flex items-center gap-2"
              >
                <Save className="w-4 h-4" />
                {updateMutation.isPending ? 'שומר...' : 'שמור'}
              </button>
              <button
                onClick={handleCancelEdit}
                className="btn-secondary flex items-center gap-2"
              >
                <X className="w-4 h-4" />
                ביטול
              </button>
            </>
          )}
          {!isEditing && event?.status !== 'completed' && event?.status !== 'cancelled' && (
            <button
              onClick={() => completeMutation.mutate()}
              disabled={completeMutation.isPending}
              className="btn-success flex items-center gap-2"
            >
              <CheckCircle className="w-4 h-4" />
              {completeMutation.isPending ? 'מעדכן...' : 'סמן כהושלם'}
            </button>
          )}
          {!isEditing && (
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="btn-danger flex items-center gap-2"
            >
              <Trash2 className="w-4 h-4" />
              מחק אירוע
            </button>
          )}
        </div>
      </div>

      {/* Delete confirmation modal */}
      {showDeleteConfirm && (
        <div className="modal-backdrop">
          <div className="modal-content max-w-md w-full mx-4 space-y-4">
            <h3 className="text-lg font-bold text-gray-900 font-heading">מחיקת אירוע</h3>
            <p className="text-gray-600">
              האם אתה בטוח שברצונך למחוק את האירוע "{event?.event_name}"? פעולה זו אינה ניתנת לביטול.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="btn-secondary"
              >
                ביטול
              </button>
              <button
                onClick={handleDelete}
                disabled={deleteMutation.isPending}
                className="btn-danger"
              >
                {deleteMutation.isPending ? 'מוחק...' : 'מחק'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Event info */}
          <div className="card">
            <h2 className="text-lg font-semibold mb-4 font-heading">פרטי האירוע</h2>

            {isEditing ? (
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                  <div>
                    <label className="label">שם האירוע</label>
                    <input
                      value={editForm.event_name as string}
                      onChange={(e) => setEditForm({ ...editForm, event_name: e.target.value })}
                      className="input"
                    />
                  </div>
                  <div>
                    <label className="label">שם חברה</label>
                    <input
                      value={editForm.company_name as string}
                      onChange={(e) => setEditForm({ ...editForm, company_name: e.target.value })}
                      className="input"
                    />
                  </div>
                  <div>
                    <label className="label">תאריך</label>
                    <input
                      type="date"
                      value={editForm.event_date as string}
                      onChange={(e) => setEditForm({ ...editForm, event_date: e.target.value })}
                      className="input"
                      dir="ltr"
                    />
                  </div>
                  <div>
                    <label className="label">סוג אירוע</label>
                    <input
                      value={editForm.event_type as string}
                      onChange={(e) => setEditForm({ ...editForm, event_type: e.target.value })}
                      className="input"
                    />
                  </div>
                  <div>
                    <label className="label">שעת התחלה</label>
                    <input
                      type="time"
                      value={editForm.start_time as string}
                      onChange={(e) => setEditForm({ ...editForm, start_time: e.target.value })}
                      className="input"
                      dir="ltr"
                    />
                  </div>
                  <div>
                    <label className="label">שעת סיום</label>
                    <input
                      type="time"
                      value={editForm.end_time as string}
                      onChange={(e) => setEditForm({ ...editForm, end_time: e.target.value })}
                      className="input"
                      dir="ltr"
                    />
                  </div>
                  <div>
                    <label className="label">מיקום</label>
                    <input
                      value={editForm.location as string}
                      onChange={(e) => setEditForm({ ...editForm, location: e.target.value })}
                      className="input"
                    />
                  </div>
                  <div>
                    <label className="label">כתובת</label>
                    <input
                      value={editForm.address as string}
                      onChange={(e) => setEditForm({ ...editForm, address: e.target.value })}
                      className="input"
                    />
                  </div>
                  <div>
                    <label className="label">מאבטחים נדרשים</label>
                    <input
                      type="number"
                      value={editForm.required_guards as number}
                      onChange={(e) => setEditForm({ ...editForm, required_guards: e.target.value })}
                      className="input"
                      dir="ltr"
                      min={0}
                    />
                  </div>
                  <div>
                    <label className="label">קהל צפוי</label>
                    <input
                      type="number"
                      value={editForm.expected_attendance as number}
                      onChange={(e) => setEditForm({ ...editForm, expected_attendance: e.target.value })}
                      className="input"
                      dir="ltr"
                      min={0}
                    />
                  </div>
                  <div>
                    <label className="label">מחיר (₪)</label>
                    <input
                      type="number"
                      value={editForm.price as number}
                      onChange={(e) => setEditForm({ ...editForm, price: e.target.value })}
                      className="input"
                      dir="ltr"
                      min={0}
                    />
                  </div>
                  <div>
                    <label className="label">ציוד מיוחד</label>
                    <input
                      value={editForm.special_equipment as string}
                      onChange={(e) => setEditForm({ ...editForm, special_equipment: e.target.value })}
                      className="input"
                    />
                  </div>
                  <div className="col-span-2 flex items-center gap-6">
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={editForm.requires_weapon as boolean}
                        onChange={(e) => setEditForm({ ...editForm, requires_weapon: e.target.checked })}
                        className="w-4 h-4 text-primary-600 rounded"
                      />
                      <span>דורש נשק</span>
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={editForm.requires_vehicle as boolean}
                        onChange={(e) => setEditForm({ ...editForm, requires_vehicle: e.target.checked })}
                        className="w-4 h-4 text-primary-600 rounded"
                      />
                      <span>דורש רכב</span>
                    </label>
                  </div>
                  <div className="col-span-2">
                    <label className="label">הערות</label>
                    <textarea
                      value={editForm.notes as string}
                      onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                      className="input"
                      rows={3}
                    />
                  </div>
                </div>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
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
                      <p className="font-medium">
                        {event?.start_time} - {event?.end_time}
                      </p>
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
              </>
            )}
          </div>

          {/* Assigned team — employees + contractors */}
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold font-heading">צוות משובץ</h2>
              {event?.status !== 'completed' && event?.status !== 'cancelled' && (
                <div className="flex gap-2">
                  <button
                    onClick={() => { setShowAssignDropdown(!showAssignDropdown); setShowContractorDropdown(false); }}
                    className="btn-primary text-sm flex items-center gap-1 px-3 py-1.5"
                  >
                    {showAssignDropdown ? <X className="w-4 h-4" /> : <UserPlus className="w-4 h-4" />}
                    {showAssignDropdown ? 'ביטול' : 'שבץ עובד'}
                  </button>
                  <button
                    onClick={() => { setShowContractorDropdown(!showContractorDropdown); setShowAssignDropdown(false); }}
                    className="btn-secondary text-sm flex items-center gap-1 px-3 py-1.5"
                  >
                    {showContractorDropdown ? <X className="w-4 h-4" /> : <Building2 className="w-4 h-4" />}
                    {showContractorDropdown ? 'ביטול' : 'שבץ קבלן'}
                  </button>
                </div>
              )}
            </div>

            {/* Assign employee dropdown */}
            {showAssignDropdown && (
              <div className="mb-4 p-4 bg-blue-50 rounded-lg">
                <p className="text-sm font-medium mb-2">בחר עובד לשיבוץ:</p>
                {availableEmployees.length > 0 ? (
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {availableEmployees.map((emp: Employee) => (
                      <button
                        key={emp.id}
                        onClick={() => handleAssignEmployee(emp)}
                        disabled={assignMutation.isPending}
                        className="w-full flex items-center justify-between p-3 bg-white rounded-lg hover:bg-gray-50 transition-colors text-right"
                      >
                        <div>
                          <p className="font-medium">{emp.first_name} {emp.last_name}</p>
                          <p className="text-sm text-gray-500">{emp.role || 'מאבטח'}</p>
                        </div>
                        <span className="text-sm text-gray-500" dir="ltr">{emp.phone}</span>
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-500 text-sm text-center py-2">אין עובדים זמינים לשיבוץ</p>
                )}
              </div>
            )}

            {/* Assign contractor dropdown */}
            {showContractorDropdown && (
              <div className="mb-4 p-4 bg-orange-50 rounded-lg">
                <p className="text-sm font-medium mb-2">בחר קבלן לשיבוץ:</p>
                {availableContractors.length > 0 ? (
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {availableContractors.map((contractor: Contractor) => (
                      <button
                        key={contractor.id}
                        onClick={() => handleAssignContractor(contractor)}
                        disabled={assignContractorMutation.isPending}
                        className="w-full flex items-center justify-between p-3 bg-white rounded-lg hover:bg-gray-50 transition-colors text-right"
                      >
                        <div>
                          <p className="font-medium">{contractor.company_name}</p>
                          <p className="text-sm text-gray-500">{contractor.contact_name}</p>
                        </div>
                        <span className="text-sm text-gray-500" dir="ltr">{contractor.phone}</span>
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-500 text-sm text-center py-2">אין קבלנים זמינים לשיבוץ</p>
                )}
              </div>
            )}

            {/* Employee assignments */}
            {data?.assignments?.length > 0 && (
              <div className="space-y-3 mb-4">
                <p className="text-sm text-gray-500 font-medium">עובדים</p>
                {data.assignments.map((assignment: Assignment) => (
                  <div key={assignment.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div>
                      <p className="font-medium">{assignment.employee_name}</p>
                      <p className="text-sm text-gray-500">{assignment.role || 'מאבטח'}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <a href={`tel:${assignment.employee_phone}`} className="flex items-center gap-1 text-primary-600 text-sm">
                        <Phone className="w-4 h-4" />
                        {assignment.employee_phone}
                      </a>
                      {event?.status !== 'completed' && event?.status !== 'cancelled' && (
                        <button
                          onClick={() => unassignMutation.mutate(assignment.id)}
                          disabled={unassignMutation.isPending}
                          className="text-red-500 hover:text-red-700 text-sm font-medium px-2 py-1 rounded hover:bg-red-50 transition-colors"
                        >
                          הסר
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Contractor assignments */}
            {data?.contractorAssignments?.length > 0 && (
              <div className="space-y-3 mb-4">
                <p className="text-sm text-gray-500 font-medium">קבלנים</p>
                {data.contractorAssignments.map((ca: ContractorAssignment) => (
                  <div key={ca.id} className="flex items-center justify-between p-3 bg-orange-50 rounded-lg">
                    <div className="flex items-center gap-2">
                      <Building2 className="w-4 h-4 text-orange-500" />
                      <div>
                        <p className="font-medium">{ca.company_name}</p>
                        <p className="text-sm text-gray-500">
                          {ca.contact_name}
                          {ca.workers_count > 0 && ` · ${ca.workers_count} עובדים`}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {ca.contractor_phone && (
                        <a href={`tel:${ca.contractor_phone}`} className="flex items-center gap-1 text-primary-600 text-sm">
                          <Phone className="w-4 h-4" />
                          {ca.contractor_phone}
                        </a>
                      )}
                      {event?.status !== 'completed' && event?.status !== 'cancelled' && (
                        <button
                          onClick={() => unassignContractorMutation.mutate(ca.id)}
                          disabled={unassignContractorMutation.isPending}
                          className="text-red-500 hover:text-red-700 text-sm font-medium px-2 py-1 rounded hover:bg-red-50 transition-colors"
                        >
                          הסר
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Empty state */}
            {(!data?.assignments || data.assignments.length === 0) &&
             (!data?.contractorAssignments || data.contractorAssignments.length === 0) && (
              <p className="text-gray-500 text-center py-4">אין עובדים או קבלנים משובצים</p>
            )}
          </div>

          {/* Notes (view mode only, edit mode has it inline above) */}
          {!isEditing && event?.notes && (
            <div className="card">
              <h2 className="text-lg font-semibold mb-4 font-heading">הערות</h2>
              <p className="text-gray-700 whitespace-pre-wrap">{event.notes}</p>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Status and payment */}
          <div className="card">
            <h2 className="text-lg font-semibold mb-4 font-heading">סטטוס ותשלום</h2>
            <dl className="space-y-3">
              <div>
                <dt className="text-sm text-gray-500 mb-1">סטטוס</dt>
                <dd>
                  <select
                    value={event?.status || ''}
                    onChange={(e) => statusMutation.mutate(e.target.value)}
                    disabled={statusMutation.isPending}
                    className="input"
                  >
                    {statusOptions.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </dd>
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
                  <dd className="font-bold text-lg font-heading">₪{event.price.toLocaleString()}</dd>
                </div>
              )}
            </dl>
          </div>

          {/* Staffing summary */}
          <div className="card">
            <h2 className="text-lg font-semibold mb-4 font-heading">סיכום איוש</h2>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-500">נדרשים</span>
              <span className="font-medium">{event?.required_guards || 0}</span>
            </div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-500">עובדים משובצים</span>
              <span className="font-medium">{data?.assignments?.length || 0}</span>
            </div>
            {(data?.contractorAssignments?.length || 0) > 0 && (
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-500">קבלנים משובצים</span>
                <span className="font-medium">{data.contractorAssignments.length}</span>
              </div>
            )}
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-500">חסרים</span>
              <span
                className={`font-bold ${
                  (event?.required_guards || 0) - (data?.assignments?.length || 0) > 0
                    ? 'text-red-600'
                    : 'text-green-600'
                }`}
              >
                {Math.max(0, (event?.required_guards || 0) - (data?.assignments?.length || 0))}
              </span>
            </div>
            {(event?.required_guards || 0) <= (data?.assignments?.length || 0) && (
              <p className="text-green-600 text-sm mt-2 font-medium text-center">
                האירוע מאויש במלואו
              </p>
            )}
          </div>

          {/* Special equipment (view mode) */}
          {!isEditing && event?.special_equipment && (
            <div className="card">
              <h2 className="text-lg font-semibold mb-4 font-heading">ציוד מיוחד</h2>
              <p className="text-gray-700">{event.special_equipment}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
