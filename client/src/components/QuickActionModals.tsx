import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { X } from 'lucide-react';
import toast from 'react-hot-toast';
import { leadsApi, shiftsApi, invoicesApi, incidentsApi, sitesGlobalApi, customersApi } from '../services/api';

/* ======== QuickLeadModal ======== */

const leadSchema = z.object({
  contact_name: z.string().min(1, 'שם חובה'),
  phone: z.string().min(1, 'טלפון חובה'),
  source: z.string().optional(),
});

type LeadForm = z.infer<typeof leadSchema>;

export function QuickLeadModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const queryClient = useQueryClient();
  const { register, handleSubmit, reset, formState: { errors } } = useForm<LeadForm>({
    resolver: zodResolver(leadSchema),
    defaultValues: { source: 'phone' },
  });

  const mutation = useMutation({
    mutationFn: (data: LeadForm) => leadsApi.create(data),
    onSuccess: () => {
      toast.success('ליד נוצר בהצלחה');
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      reset();
      onClose();
    },
    onError: () => {
      toast.error('שגיאה ביצירת ליד');
    },
  });

  const onSubmit = (data: LeadForm) => mutation.mutate(data);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-white rounded-2xl shadow-elevated max-w-md w-full p-6 animate-scale-in">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold font-heading">ליד חדש</h3>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-xl transition-colors text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="label">שם איש קשר *</label>
            <input {...register('contact_name')} className="input" placeholder="שם מלא" />
            {errors.contact_name && <p className="text-red-500 text-xs mt-1">{errors.contact_name.message}</p>}
          </div>
          <div>
            <label className="label">טלפון *</label>
            <input {...register('phone')} className="input" placeholder="050-0000000" dir="ltr" />
            {errors.phone && <p className="text-red-500 text-xs mt-1">{errors.phone.message}</p>}
          </div>
          <div>
            <label className="label">מקור</label>
            <select {...register('source')} className="input">
              <option value="phone">טלפון</option>
              <option value="website">אתר</option>
              <option value="whatsapp">וואטסאפ</option>
              <option value="referral">המלצה</option>
            </select>
          </div>
          <div className="flex gap-2 justify-end pt-2">
            <button type="button" onClick={onClose} className="btn-secondary">ביטול</button>
            <button type="submit" className="btn-primary" disabled={mutation.isPending}>
              {mutation.isPending ? 'שומר...' : 'צור'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ======== QuickShiftModal ======== */

const shiftSchema = z.object({
  site_id: z.string().min(1, 'אתר חובה'),
  date: z.string().min(1, 'תאריך חובה'),
  start_time: z.string().min(1, 'שעת התחלה חובה'),
  end_time: z.string().min(1, 'שעת סיום חובה'),
});

type ShiftForm = z.infer<typeof shiftSchema>;

export function QuickShiftModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const queryClient = useQueryClient();
  const { register, handleSubmit, reset, formState: { errors } } = useForm<ShiftForm>({
    resolver: zodResolver(shiftSchema),
    defaultValues: {
      date: new Date().toISOString().split('T')[0],
    },
  });

  const { data: sitesData } = useQuery({
    queryKey: ['sites-all'],
    queryFn: () => sitesGlobalApi.getAll().then((res) => res.data),
    enabled: isOpen,
  });

  const sites = sitesData?.sites || sitesData || [];

  const mutation = useMutation({
    mutationFn: (data: ShiftForm) => shiftsApi.create(data),
    onSuccess: () => {
      toast.success('משמרת נוצרה בהצלחה');
      queryClient.invalidateQueries({ queryKey: ['shifts'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-operations'] });
      reset();
      onClose();
    },
    onError: () => {
      toast.error('שגיאה ביצירת משמרת');
    },
  });

  const onSubmit = (data: ShiftForm) => mutation.mutate(data);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-white rounded-2xl shadow-elevated max-w-md w-full p-6 animate-scale-in">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold font-heading">משמרת חדשה</h3>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-xl transition-colors text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="label">אתר *</label>
            <select {...register('site_id')} className="input">
              <option value="">בחר אתר...</option>
              {Array.isArray(sites) && sites.map((site: any) => (
                <option key={site.id} value={site.id}>
                  {site.name} {site.company_name ? `(${site.company_name})` : ''}
                </option>
              ))}
            </select>
            {errors.site_id && <p className="text-red-500 text-xs mt-1">{errors.site_id.message}</p>}
          </div>
          <div>
            <label className="label">תאריך *</label>
            <input {...register('date')} type="date" className="input" dir="ltr" />
            {errors.date && <p className="text-red-500 text-xs mt-1">{errors.date.message}</p>}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">שעת התחלה *</label>
              <input {...register('start_time')} type="time" className="input" dir="ltr" />
              {errors.start_time && <p className="text-red-500 text-xs mt-1">{errors.start_time.message}</p>}
            </div>
            <div>
              <label className="label">שעת סיום *</label>
              <input {...register('end_time')} type="time" className="input" dir="ltr" />
              {errors.end_time && <p className="text-red-500 text-xs mt-1">{errors.end_time.message}</p>}
            </div>
          </div>
          <div className="flex gap-2 justify-end pt-2">
            <button type="button" onClick={onClose} className="btn-secondary">ביטול</button>
            <button type="submit" className="btn-primary" disabled={mutation.isPending}>
              {mutation.isPending ? 'שומר...' : 'צור'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ======== QuickInvoiceModal ======== */

const invoiceSchema = z.object({
  customer_id: z.string().min(1, 'לקוח חובה'),
  total_amount: z.string().min(1, 'סכום חובה'),
  description: z.string().optional(),
});

type InvoiceForm = z.infer<typeof invoiceSchema>;

export function QuickInvoiceModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const queryClient = useQueryClient();
  const { register, handleSubmit, reset, formState: { errors } } = useForm<InvoiceForm>({
    resolver: zodResolver(invoiceSchema),
  });

  const { data: customersData } = useQuery({
    queryKey: ['customers'],
    queryFn: () => customersApi.getAll().then((res) => res.data),
    enabled: isOpen,
  });

  const customers = customersData?.customers || customersData || [];

  const mutation = useMutation({
    mutationFn: (data: InvoiceForm) => {
      const today = new Date();
      const dueDate = new Date(today);
      dueDate.setDate(dueDate.getDate() + 30);
      return invoicesApi.create({
        ...data,
        total_amount: parseFloat(data.total_amount),
        issue_date: today.toISOString().split('T')[0],
        due_date: dueDate.toISOString().split('T')[0],
      });
    },
    onSuccess: () => {
      toast.success('חשבונית נוצרה בהצלחה');
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      reset();
      onClose();
    },
    onError: () => {
      toast.error('שגיאה ביצירת חשבונית');
    },
  });

  const onSubmit = (data: InvoiceForm) => mutation.mutate(data);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-white rounded-2xl shadow-elevated max-w-md w-full p-6 animate-scale-in">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold font-heading">חשבונית חדשה</h3>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-xl transition-colors text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="label">לקוח *</label>
            <select {...register('customer_id')} className="input">
              <option value="">בחר לקוח...</option>
              {Array.isArray(customers) && customers.map((customer: any) => (
                <option key={customer.id} value={customer.id}>
                  {customer.company_name}
                </option>
              ))}
            </select>
            {errors.customer_id && <p className="text-red-500 text-xs mt-1">{errors.customer_id.message}</p>}
          </div>
          <div>
            <label className="label">סכום *</label>
            <input
              {...register('total_amount')}
              type="number"
              step="0.01"
              min="0"
              className="input"
              placeholder="0.00"
              dir="ltr"
            />
            {errors.total_amount && <p className="text-red-500 text-xs mt-1">{errors.total_amount.message}</p>}
          </div>
          <div>
            <label className="label">תיאור</label>
            <textarea {...register('description')} className="input" rows={2} placeholder="תיאור החשבונית..." />
          </div>
          <div className="flex gap-2 justify-end pt-2">
            <button type="button" onClick={onClose} className="btn-secondary">ביטול</button>
            <button type="submit" className="btn-primary" disabled={mutation.isPending}>
              {mutation.isPending ? 'שומר...' : 'צור'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ======== QuickIncidentModal ======== */

const incidentSchema = z.object({
  type: z.string().min(1, 'סוג אירוע חובה'),
  description: z.string().min(1, 'תיאור חובה'),
  severity: z.string().min(1, 'חומרה חובה'),
});

type IncidentForm = z.infer<typeof incidentSchema>;

export function QuickIncidentModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const queryClient = useQueryClient();
  const { register, handleSubmit, reset, formState: { errors } } = useForm<IncidentForm>({
    resolver: zodResolver(incidentSchema),
    defaultValues: { type: 'other', severity: 'medium' },
  });

  const mutation = useMutation({
    mutationFn: (data: IncidentForm) => incidentsApi.create(data),
    onSuccess: () => {
      toast.success('אירוע דווח בהצלחה');
      queryClient.invalidateQueries({ queryKey: ['incidents'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-operations'] });
      reset();
      onClose();
    },
    onError: () => {
      toast.error('שגיאה בדיווח אירוע');
    },
  });

  const onSubmit = (data: IncidentForm) => mutation.mutate(data);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-white rounded-2xl shadow-elevated max-w-md w-full p-6 animate-scale-in">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold font-heading">דיווח אירוע</h3>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-xl transition-colors text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="label">סוג אירוע *</label>
            <select {...register('type')} className="input">
              <option value="security_breach">פריצת אבטחה</option>
              <option value="unauthorized_access">גישה לא מורשית</option>
              <option value="theft">גניבה</option>
              <option value="vandalism">ונדליזם</option>
              <option value="fire">שריפה</option>
              <option value="medical">רפואי</option>
              <option value="other">אחר</option>
            </select>
            {errors.type && <p className="text-red-500 text-xs mt-1">{errors.type.message}</p>}
          </div>
          <div>
            <label className="label">תיאור *</label>
            <textarea {...register('description')} className="input" rows={3} placeholder="תאר את האירוע..." />
            {errors.description && <p className="text-red-500 text-xs mt-1">{errors.description.message}</p>}
          </div>
          <div>
            <label className="label">חומרה *</label>
            <select {...register('severity')} className="input">
              <option value="low">נמוך</option>
              <option value="medium">בינוני</option>
              <option value="high">גבוה</option>
              <option value="critical">קריטי</option>
            </select>
            {errors.severity && <p className="text-red-500 text-xs mt-1">{errors.severity.message}</p>}
          </div>
          <div className="flex gap-2 justify-end pt-2">
            <button type="button" onClick={onClose} className="btn-secondary">ביטול</button>
            <button type="submit" className="btn-primary" disabled={mutation.isPending}>
              {mutation.isPending ? 'שומר...' : 'צור'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
