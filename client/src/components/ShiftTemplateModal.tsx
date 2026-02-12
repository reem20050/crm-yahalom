import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { X, Copy, Calendar, Check } from 'lucide-react';
import toast from 'react-hot-toast';
import { shiftTemplatesApi, customersApi, sitesApi } from '../services/api';

interface ShiftTemplateModalProps {
  template?: Record<string, unknown> | null;
  onClose: () => void;
}

const DAYS_OF_WEEK = [
  { value: 0, label: 'ראשון' },
  { value: 1, label: 'שני' },
  { value: 2, label: 'שלישי' },
  { value: 3, label: 'רביעי' },
  { value: 4, label: 'חמישי' },
  { value: 5, label: 'שישי' },
  { value: 6, label: 'שבת' },
];

const SHIFT_TYPES = [
  { value: 'regular', label: 'רגילה' },
  { value: 'night', label: 'לילה' },
  { value: 'weekend', label: 'סוף שבוע' },
  { value: 'holiday', label: 'חג' },
];

export default function ShiftTemplateModal({ template, onClose }: ShiftTemplateModalProps) {
  const queryClient = useQueryClient();
  const isEditing = !!template;

  const [form, setForm] = useState({
    name: (template?.name as string) || '',
    customer_id: (template?.customer_id as string) || '',
    site_id: (template?.site_id as string) || '',
    start_time: (template?.start_time as string) || '08:00',
    end_time: (template?.end_time as string) || '16:00',
    required_employees: (template?.required_employees as number) || 1,
    requires_weapon: !!(template?.requires_weapon),
    requires_vehicle: !!(template?.requires_vehicle),
    days_of_week: template?.days_of_week ? (typeof template.days_of_week === 'string' ? JSON.parse(template.days_of_week as string) : template.days_of_week) as number[] : [],
    shift_type: (template?.shift_type as string) || 'regular',
    default_notes: (template?.default_notes as string) || '',
  });

  const { data: customersData } = useQuery({
    queryKey: ['customers-list'],
    queryFn: () => customersApi.getAll({ limit: 100, status: 'active' }).then((r) => r.data),
  });

  const { data: sitesData } = useQuery({
    queryKey: ['sites', form.customer_id],
    queryFn: () => form.customer_id ? sitesApi.getByCustomer(form.customer_id).then((r) => r.data) : Promise.resolve({ sites: [] }),
    enabled: !!form.customer_id,
  });

  const saveMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      isEditing ? shiftTemplatesApi.update(template!.id as string, data) : shiftTemplatesApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shift-templates'] });
      toast.success(isEditing ? 'התבנית עודכנה' : 'התבנית נוצרה');
      onClose();
    },
    onError: () => toast.error('שגיאה בשמירת תבנית'),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return toast.error('נא להזין שם לתבנית');
    if (form.days_of_week.length === 0) return toast.error('נא לבחור ימים בשבוע');
    saveMutation.mutate(form);
  };

  const toggleDay = (day: number) => {
    setForm((prev) => ({
      ...prev,
      days_of_week: prev.days_of_week.includes(day)
        ? prev.days_of_week.filter((d) => d !== day)
        : [...prev.days_of_week, day].sort(),
    }));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/40 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-xl font-bold">{isEditing ? 'עריכת תבנית' : 'תבנית משמרת חדשה'}</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="label">שם התבנית *</label>
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="input"
              placeholder='לדוג׳ "שמירה לילית - מגדלי עזריאלי"'
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">לקוח</label>
              <select
                value={form.customer_id}
                onChange={(e) => setForm({ ...form, customer_id: e.target.value, site_id: '' })}
                className="input"
              >
                <option value="">בחר לקוח...</option>
                {customersData?.customers?.map((c: { id: string; company_name: string }) => (
                  <option key={c.id} value={c.id}>{c.company_name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">אתר</label>
              <select
                value={form.site_id}
                onChange={(e) => setForm({ ...form, site_id: e.target.value })}
                className="input"
                disabled={!form.customer_id}
              >
                <option value="">בחר אתר...</option>
                {sitesData?.sites?.map((s: { id: string; name: string }) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="label">שעת התחלה *</label>
              <input
                type="time"
                value={form.start_time}
                onChange={(e) => setForm({ ...form, start_time: e.target.value })}
                className="input"
              />
            </div>
            <div>
              <label className="label">שעת סיום *</label>
              <input
                type="time"
                value={form.end_time}
                onChange={(e) => setForm({ ...form, end_time: e.target.value })}
                className="input"
              />
            </div>
            <div>
              <label className="label">עובדים נדרשים</label>
              <input
                type="number"
                min="1"
                value={form.required_employees}
                onChange={(e) => setForm({ ...form, required_employees: parseInt(e.target.value) || 1 })}
                className="input"
              />
            </div>
          </div>

          <div>
            <label className="label">סוג משמרת</label>
            <select
              value={form.shift_type}
              onChange={(e) => setForm({ ...form, shift_type: e.target.value })}
              className="input"
            >
              {SHIFT_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>

          {/* Days of Week */}
          <div>
            <label className="label">ימים בשבוע *</label>
            <div className="flex flex-wrap gap-2 mt-1">
              {DAYS_OF_WEEK.map((day) => (
                <button
                  key={day.value}
                  type="button"
                  onClick={() => toggleDay(day.value)}
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    form.days_of_week.includes(day.value)
                      ? 'bg-primary-500 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {day.label}
                </button>
              ))}
            </div>
          </div>

          {/* Requirements */}
          <div className="flex items-center gap-6">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={form.requires_weapon}
                onChange={(e) => setForm({ ...form, requires_weapon: e.target.checked })}
                className="w-4 h-4 text-primary-600 rounded"
              />
              <span>נדרש נשק</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={form.requires_vehicle}
                onChange={(e) => setForm({ ...form, requires_vehicle: e.target.checked })}
                className="w-4 h-4 text-primary-600 rounded"
              />
              <span>נדרש רכב</span>
            </label>
          </div>

          <div>
            <label className="label">הערות ברירת מחדל</label>
            <textarea
              value={form.default_notes}
              onChange={(e) => setForm({ ...form, default_notes: e.target.value })}
              className="input min-h-[60px]"
              placeholder="הערות שייכללו בכל משמרת שתיווצר..."
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button type="submit" disabled={saveMutation.isPending} className="btn-primary flex-1">
              {saveMutation.isPending ? 'שומר...' : isEditing ? 'עדכן תבנית' : 'צור תבנית'}
            </button>
            <button type="button" onClick={onClose} className="btn-secondary">ביטול</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Sub-component: Generate shifts from template
export function GenerateFromTemplateModal({
  templateId,
  templateName,
  onClose,
}: {
  templateId: string;
  templateName: string;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const generateMutation = useMutation({
    mutationFn: () => shiftTemplatesApi.generate(templateId, startDate, endDate),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['shifts'] });
      toast.success(res.data.message || 'משמרות נוצרו בהצלחה');
      onClose();
    },
    onError: () => toast.error('שגיאה ביצירת משמרות מתבנית'),
  });

  const handleGenerate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!startDate || !endDate) return toast.error('נא לבחור טווח תאריכים');
    if (endDate < startDate) return toast.error('תאריך סיום חייב להיות אחרי תאריך התחלה');
    generateMutation.mutate();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/40 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            יצירת משמרות מתבנית
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleGenerate} className="p-6 space-y-4">
          <div className="bg-blue-50 rounded-lg p-3 mb-2">
            <p className="text-sm text-blue-800">
              <strong>תבנית:</strong> {templateName}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">מתאריך *</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="input"
              />
            </div>
            <div>
              <label className="label">עד תאריך *</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="input"
              />
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button type="submit" disabled={generateMutation.isPending} className="btn-primary flex-1 flex items-center justify-center gap-2">
              {generateMutation.isPending ? 'יוצר...' : (
                <>
                  <Copy className="w-4 h-4" />
                  צור משמרות
                </>
              )}
            </button>
            <button type="button" onClick={onClose} className="btn-secondary">ביטול</button>
          </div>
        </form>
      </div>
    </div>
  );
}
