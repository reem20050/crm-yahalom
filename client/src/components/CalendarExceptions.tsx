import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import {
  Calendar,
  Plus,
  Edit3,
  Trash2,
  ChevronRight,
  ChevronLeft,
  X,
  AlertTriangle,
  Star,
  Ban,
} from 'lucide-react';
import { calendarExceptionsApi } from '../services/api';

// ── Types ───────────────────────────────────────────────────────────────────

interface CalendarException {
  id: string;
  date: string;
  exception_type: string;
  name: string;
  affects: string;
  action: string;
  modifier: number;
  notes: string | null;
  recurring: number;
  created_at: string;
}

interface ExceptionFormData {
  date: string;
  name: string;
  exception_type: string;
  affects: string;
  action: string;
  modifier: number;
  notes: string;
  recurring: boolean;
}

// ── Constants ───────────────────────────────────────────────────────────────

const HEBREW_MONTHS = [
  'ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני',
  'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר',
];

const HEBREW_DAYS = ['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ש'];

const TYPE_OPTIONS = [
  { value: 'holiday', label: 'חג' },
  { value: 'blackout', label: 'חסימה' },
  { value: 'special', label: 'מיוחד' },
];

const AFFECTS_OPTIONS = [
  { value: 'all', label: 'הכל' },
  { value: 'shifts', label: 'משמרות' },
  { value: 'invoices', label: 'חשבוניות' },
];

const ACTION_OPTIONS = [
  { value: 'skip', label: 'דלג' },
  { value: 'reduce', label: 'צמצום' },
  { value: 'increase', label: 'הגדלה' },
];

const typeBadgeColors: Record<string, string> = {
  holiday: 'bg-red-100 text-red-700',
  blackout: 'bg-gray-200 text-gray-700',
  special: 'bg-purple-100 text-purple-700',
};

const typeLabels: Record<string, string> = {
  holiday: 'חג',
  blackout: 'חסימה',
  special: 'מיוחד',
};

const actionLabels: Record<string, string> = {
  skip: 'דלג',
  reduce: 'צמצום',
  increase: 'הגדלה',
};

const affectsLabels: Record<string, string> = {
  all: 'הכל',
  shifts: 'משמרות',
  invoices: 'חשבוניות',
};

// ── Helpers ──────────────────────────────────────────────────────────────────

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year: number, month: number): number {
  return new Date(year, month, 1).getDay(); // 0=Sunday
}

function formatDateHebrew(dateStr: string): string {
  try {
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('he-IL', { year: 'numeric', month: 'long', day: 'numeric' });
  } catch {
    return dateStr;
  }
}

const emptyForm: ExceptionFormData = {
  date: '',
  name: '',
  exception_type: 'holiday',
  affects: 'all',
  action: 'skip',
  modifier: 0,
  notes: '',
  recurring: false,
};

// ── Component ───────────────────────────────────────────────────────────────

export default function CalendarExceptions() {
  const queryClient = useQueryClient();
  const today = new Date();
  const [currentYear, setCurrentYear] = useState(today.getFullYear());
  const [currentMonth, setCurrentMonth] = useState(today.getMonth());
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<ExceptionFormData>({ ...emptyForm });

  // Fetch exceptions for the displayed year
  const { data: exceptionsData, isLoading } = useQuery({
    queryKey: ['calendar-exceptions', currentYear],
    queryFn: async () => {
      const res = await calendarExceptionsApi.getAll(currentYear);
      return (res.data?.exceptions || []) as CalendarException[];
    },
  });

  const exceptions = exceptionsData || [];

  // Map exceptions by date for fast calendar lookup
  const exceptionsByDate = useMemo(() => {
    const map: Record<string, CalendarException[]> = {};
    for (const ex of exceptions) {
      if (!map[ex.date]) map[ex.date] = [];
      map[ex.date].push(ex);
    }
    return map;
  }, [exceptions]);

  // ── Mutations ─────────────────────────────────────────────────────────────

  const createMutation = useMutation({
    mutationFn: (data: ExceptionFormData) =>
      calendarExceptionsApi.create({
        ...data,
        modifier: data.modifier || 0,
        recurring: data.recurring ? 1 : 0,
      }),
    onSuccess: () => {
      toast.success('חריג נוצר בהצלחה');
      queryClient.invalidateQueries({ queryKey: ['calendar-exceptions'] });
      closeModal();
    },
    onError: () => toast.error('שגיאה ביצירת חריג'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: ExceptionFormData }) =>
      calendarExceptionsApi.update(id, {
        ...data,
        modifier: data.modifier || 0,
        recurring: data.recurring ? 1 : 0,
      }),
    onSuccess: () => {
      toast.success('חריג עודכן בהצלחה');
      queryClient.invalidateQueries({ queryKey: ['calendar-exceptions'] });
      closeModal();
    },
    onError: () => toast.error('שגיאה בעדכון חריג'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => calendarExceptionsApi.delete(id),
    onSuccess: () => {
      toast.success('חריג נמחק');
      queryClient.invalidateQueries({ queryKey: ['calendar-exceptions'] });
    },
    onError: () => toast.error('שגיאה במחיקת חריג'),
  });

  // ── Modal helpers ─────────────────────────────────────────────────────────

  function openCreateModal(presetDate?: string) {
    setEditingId(null);
    setForm({
      ...emptyForm,
      date: presetDate || '',
    });
    setModalOpen(true);
  }

  function openEditModal(ex: CalendarException) {
    setEditingId(ex.id);
    setForm({
      date: ex.date,
      name: ex.name,
      exception_type: ex.exception_type,
      affects: ex.affects,
      action: ex.action,
      modifier: ex.modifier || 0,
      notes: ex.notes || '',
      recurring: ex.recurring === 1,
    });
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    setEditingId(null);
    setForm({ ...emptyForm });
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.date || !form.name || !form.exception_type) {
      toast.error('נדרש תאריך, שם וסוג');
      return;
    }
    if (editingId) {
      updateMutation.mutate({ id: editingId, data: form });
    } else {
      createMutation.mutate(form);
    }
  }

  // ── Month navigation ─────────────────────────────────────────────────────

  function prevMonth() {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear((y) => y - 1);
    } else {
      setCurrentMonth((m) => m - 1);
    }
  }

  function nextMonth() {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear((y) => y + 1);
    } else {
      setCurrentMonth((m) => m + 1);
    }
  }

  // ── Calendar grid ─────────────────────────────────────────────────────────

  const daysInMonth = getDaysInMonth(currentYear, currentMonth);
  const firstDay = getFirstDayOfMonth(currentYear, currentMonth);
  const todayStr = today.toISOString().split('T')[0];

  const calendarDays: Array<{ day: number; dateStr: string } | null> = [];
  // Fill leading empty cells
  for (let i = 0; i < firstDay; i++) {
    calendarDays.push(null);
  }
  for (let d = 1; d <= daysInMonth; d++) {
    const mm = String(currentMonth + 1).padStart(2, '0');
    const dd = String(d).padStart(2, '0');
    calendarDays.push({ day: d, dateStr: `${currentYear}-${mm}-${dd}` });
  }

  function getCellStyle(dateStr: string): string {
    const exs = exceptionsByDate[dateStr];
    if (!exs || exs.length === 0) return '';
    const type = exs[0].exception_type;
    if (type === 'holiday') return 'bg-red-50 border-red-200';
    if (type === 'blackout') return 'bg-gray-100 border-gray-300';
    if (type === 'special') return 'bg-purple-50 border-purple-200';
    return '';
  }

  function getCellIcon(dateStr: string) {
    const exs = exceptionsByDate[dateStr];
    if (!exs || exs.length === 0) return null;
    const type = exs[0].exception_type;
    if (type === 'holiday') return <Star className="w-3 h-3 text-red-500" />;
    if (type === 'blackout') return <Ban className="w-3 h-3 text-gray-500" />;
    if (type === 'special') return <AlertTriangle className="w-3 h-3 text-purple-500" />;
    return null;
  }

  const isSaving = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="space-y-6">
      {/* ── Calendar View ────────────────────────────────────────────────── */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-primary-600" />
            <h3 className="font-semibold text-gray-900 text-lg font-heading">
              לוח חגים וחריגים
            </h3>
          </div>
          <button
            onClick={() => openCreateModal()}
            className="btn-primary flex items-center gap-1.5 text-sm"
          >
            <Plus className="w-4 h-4" />
            הוסף חריג
          </button>
        </div>

        {/* Month navigation */}
        <div className="flex items-center justify-between mb-4">
          <button onClick={nextMonth} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
            <ChevronRight className="w-5 h-5 text-gray-600" />
          </button>
          <h4 className="text-lg font-medium text-gray-900">
            {HEBREW_MONTHS[currentMonth]} {currentYear}
          </h4>
          <button onClick={prevMonth} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
            <ChevronLeft className="w-5 h-5 text-gray-600" />
          </button>
        </div>

        {/* Day headers */}
        <div className="grid grid-cols-7 gap-1 mb-1">
          {HEBREW_DAYS.map((day) => (
            <div
              key={day}
              className="text-center text-xs font-semibold text-gray-500 py-2"
            >
              {day}
            </div>
          ))}
        </div>

        {/* Calendar grid */}
        <div className="grid grid-cols-7 gap-1">
          {calendarDays.map((cell, idx) => {
            if (!cell) {
              return <div key={`empty-${idx}`} className="h-16" />;
            }
            const { day, dateStr } = cell;
            const cellExceptions = exceptionsByDate[dateStr] || [];
            const isToday = dateStr === todayStr;
            const cellStyle = getCellStyle(dateStr);

            return (
              <button
                key={dateStr}
                onClick={() => {
                  if (cellExceptions.length > 0) {
                    openEditModal(cellExceptions[0]);
                  } else {
                    openCreateModal(dateStr);
                  }
                }}
                className={`h-16 rounded-lg border text-right p-1.5 transition-all hover:shadow-sm hover:border-primary-300 cursor-pointer flex flex-col ${
                  isToday ? 'ring-2 ring-primary-400 border-primary-300' : 'border-gray-200'
                } ${cellStyle}`}
              >
                <span
                  className={`text-xs font-medium ${
                    isToday ? 'text-primary-600 font-bold' : 'text-gray-700'
                  }`}
                >
                  {day}
                </span>
                {cellExceptions.length > 0 && (
                  <div className="flex items-center gap-0.5 mt-auto">
                    {getCellIcon(dateStr)}
                    <span className="text-[10px] leading-tight truncate text-gray-600">
                      {cellExceptions[0].name}
                    </span>
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {/* Legend */}
        <div className="flex items-center gap-4 mt-4 text-xs text-gray-500">
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-red-100 border border-red-200" />
            חג
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-gray-200 border border-gray-300" />
            חסימה
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-purple-100 border border-purple-200" />
            מיוחד
          </div>
        </div>
      </div>

      {/* ── Exception List Table ─────────────────────────────────────────── */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-gray-900 text-lg font-heading">
            רשימת חריגים - {currentYear}
          </h3>
          <span className="text-sm text-gray-500">
            {exceptions.length} רשומות
          </span>
        </div>

        {isLoading ? (
          <div className="text-center py-8 text-gray-400">טוען...</div>
        ) : exceptions.length === 0 ? (
          <div className="text-center py-8 text-gray-400">
            <Calendar className="w-10 h-10 mx-auto mb-2 opacity-40" />
            <p className="text-sm">אין חריגים לשנה זו</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-gray-500">
                  <th className="text-right py-3 px-3 font-medium">תאריך</th>
                  <th className="text-right py-3 px-3 font-medium">שם</th>
                  <th className="text-right py-3 px-3 font-medium">סוג</th>
                  <th className="text-right py-3 px-3 font-medium">פעולה</th>
                  <th className="text-right py-3 px-3 font-medium">משפיע על</th>
                  <th className="text-right py-3 px-3 font-medium">מקדם</th>
                  <th className="text-right py-3 px-3 font-medium">פעולות</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {exceptions.map((ex) => (
                  <tr key={ex.id} className="hover:bg-gray-50 transition-colors">
                    <td className="py-3 px-3 text-gray-700">
                      {formatDateHebrew(ex.date)}
                    </td>
                    <td className="py-3 px-3 font-medium text-gray-900">
                      {ex.name}
                    </td>
                    <td className="py-3 px-3">
                      <span
                        className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${
                          typeBadgeColors[ex.exception_type] || 'bg-gray-100 text-gray-700'
                        }`}
                      >
                        {typeLabels[ex.exception_type] || ex.exception_type}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-gray-600">
                      {actionLabels[ex.action] || ex.action}
                    </td>
                    <td className="py-3 px-3 text-gray-600">
                      {affectsLabels[ex.affects] || ex.affects}
                    </td>
                    <td className="py-3 px-3 text-gray-600">
                      {ex.action === 'skip' ? '-' : ex.modifier || '-'}
                    </td>
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => openEditModal(ex)}
                          className="p-1.5 hover:bg-blue-50 rounded-lg transition-colors text-blue-600"
                          title="ערוך"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => {
                            if (confirm(`למחוק את "${ex.name}"?`)) {
                              deleteMutation.mutate(ex.id);
                            }
                          }}
                          className="p-1.5 hover:bg-red-50 rounded-lg transition-colors text-red-600"
                          title="מחק"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Exception Form Modal ─────────────────────────────────────────── */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-2xl shadow-elevated max-w-lg w-full p-6 animate-scale-in">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-bold font-heading">
                {editingId ? 'עריכת חריג' : 'חריג חדש'}
              </h3>
              <button
                onClick={closeModal}
                className="p-1.5 hover:bg-gray-100 rounded-xl transition-colors text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Date */}
              <div>
                <label className="label">תאריך *</label>
                <input
                  type="date"
                  value={form.date}
                  onChange={(e) => setForm({ ...form, date: e.target.value })}
                  className="input"
                  required
                />
              </div>

              {/* Name */}
              <div>
                <label className="label">שם *</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="input"
                  placeholder="למשל: ראש השנה"
                  required
                />
              </div>

              {/* Type + Affects (row) */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">סוג *</label>
                  <select
                    value={form.exception_type}
                    onChange={(e) => setForm({ ...form, exception_type: e.target.value })}
                    className="input"
                  >
                    {TYPE_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label">משפיע על</label>
                  <select
                    value={form.affects}
                    onChange={(e) => setForm({ ...form, affects: e.target.value })}
                    className="input"
                  >
                    {AFFECTS_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Action + Modifier (row) */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">פעולה</label>
                  <select
                    value={form.action}
                    onChange={(e) => setForm({ ...form, action: e.target.value })}
                    className="input"
                  >
                    {ACTION_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
                {(form.action === 'reduce' || form.action === 'increase') && (
                  <div>
                    <label className="label">מקדם כוח אדם</label>
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      max="3"
                      value={form.modifier || ''}
                      onChange={(e) =>
                        setForm({ ...form, modifier: parseFloat(e.target.value) || 0 })
                      }
                      className="input"
                      placeholder="0.5 = חצי, 1.5 = תוספת"
                    />
                  </div>
                )}
              </div>

              {/* Notes */}
              <div>
                <label className="label">הערות</label>
                <textarea
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  className="input"
                  rows={2}
                  placeholder="הערות נוספות..."
                />
              </div>

              {/* Recurring checkbox */}
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="recurring"
                  checked={form.recurring}
                  onChange={(e) => setForm({ ...form, recurring: e.target.checked })}
                  className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                />
                <label htmlFor="recurring" className="text-sm text-gray-700">
                  חוזר מדי שנה
                </label>
              </div>

              {/* Buttons */}
              <div className="flex gap-2 justify-end pt-2">
                <button type="button" onClick={closeModal} className="btn-secondary">
                  ביטול
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={isSaving}
                >
                  {isSaving ? 'שומר...' : editingId ? 'עדכן' : 'צור'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
