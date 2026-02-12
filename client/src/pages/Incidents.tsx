import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle,
  Plus,
  Search,
  X,
  Clock,
  CheckCircle,
  Eye,
  MessageSquarePlus,
  Shield,
} from 'lucide-react';
import { incidentsApi, customersApi, sitesApi } from '../services/api';
import { usePermissions } from '../hooks/usePermissions';

const incidentTypes: Record<string, string> = {
  theft: 'גניבה',
  break_in: 'פריצה',
  trespassing: 'חדירה',
  vandalism: 'ונדליזם',
  suspicious_activity: 'פעילות חשודה',
  accident: 'תאונה',
  injury: 'פגיעה',
  alarm: 'אזעקה',
  fire: 'שריפה',
  violence: 'אלימות',
  other: 'אחר',
};

const severityLabels: Record<string, string> = {
  critical: 'קריטי',
  high: 'גבוה',
  medium: 'בינוני',
  low: 'נמוך',
};

const severityColors: Record<string, string> = {
  critical: 'bg-red-100 text-red-800 border-red-300',
  high: 'bg-orange-100 text-orange-800 border-orange-300',
  medium: 'bg-yellow-100 text-yellow-800 border-yellow-300',
  low: 'bg-green-100 text-green-800 border-green-300',
};

const statusLabels: Record<string, string> = {
  open: 'פתוח',
  investigating: 'בחקירה',
  resolved: 'טופל',
  closed: 'סגור',
};

const statusColors: Record<string, string> = {
  open: 'badge-danger',
  investigating: 'badge-warning',
  resolved: 'badge-success',
  closed: 'bg-gray-100 text-gray-700',
};

export default function Incidents() {
  const queryClient = useQueryClient();
  const { can } = usePermissions();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [severityFilter, setSeverityFilter] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [showDetail, setShowDetail] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [updateText, setUpdateText] = useState('');
  const [resolutionText, setResolutionText] = useState('');
  const [formData, setFormData] = useState({
    title: '', incident_type: 'suspicious_activity', severity: 'medium',
    customer_id: '', site_id: '', incident_date: new Date().toISOString().split('T')[0],
    incident_time: new Date().toTimeString().slice(0, 5), description: '',
    location_details: '', police_called: false, police_report_number: '',
    ambulance_called: false, injuries_reported: false, property_damage: false,
    actions_taken: '',
  });

  const { data: incidentsData, isLoading } = useQuery({
    queryKey: ['incidents', { search, status: statusFilter, severity: severityFilter }],
    queryFn: () => incidentsApi.getAll({ search: search || undefined, status: statusFilter || undefined, severity: severityFilter || undefined }).then(r => r.data),
  });

  const { data: statsData } = useQuery({
    queryKey: ['incidents-stats'],
    queryFn: () => incidentsApi.getStats().then(r => r.data),
  });

  const { data: detailData } = useQuery({
    queryKey: ['incident', showDetail],
    queryFn: () => incidentsApi.getOne(showDetail!).then(r => r.data),
    enabled: !!showDetail,
  });

  const { data: customersData } = useQuery({
    queryKey: ['customers-list'],
    queryFn: () => customersApi.getAll().then(r => r.data),
  });

  const { data: sitesData } = useQuery({
    queryKey: ['sites', formData.customer_id],
    queryFn: () => sitesApi.getByCustomer(formData.customer_id).then(r => r.data),
    enabled: !!formData.customer_id,
  });

  const createMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => editingId ? incidentsApi.update(editingId, data) : incidentsApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['incidents'] });
      queryClient.invalidateQueries({ queryKey: ['incidents-stats'] });
      setShowModal(false);
      setEditingId(null);
      resetForm();
    },
  });

  const addUpdateMutation = useMutation({
    mutationFn: ({ id, text }: { id: string; text: string }) => incidentsApi.addUpdate(id, text),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['incident', showDetail] });
      queryClient.invalidateQueries({ queryKey: ['incidents'] });
      setUpdateText('');
    },
  });

  const resolveMutation = useMutation({
    mutationFn: ({ id, resolution }: { id: string; resolution: string }) => incidentsApi.resolve(id, resolution),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['incident', showDetail] });
      queryClient.invalidateQueries({ queryKey: ['incidents'] });
      queryClient.invalidateQueries({ queryKey: ['incidents-stats'] });
      setResolutionText('');
      setShowDetail(null);
    },
  });

  const resetForm = () => {
    setFormData({
      title: '', incident_type: 'suspicious_activity', severity: 'medium',
      customer_id: '', site_id: '', incident_date: new Date().toISOString().split('T')[0],
      incident_time: new Date().toTimeString().slice(0, 5), description: '',
      location_details: '', police_called: false, police_report_number: '',
      ambulance_called: false, injuries_reported: false, property_damage: false,
      actions_taken: '',
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate(formData as any);
  };

  const incidents = incidentsData?.incidents || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Shield className="w-7 h-7 text-red-500" />
            אירועי אבטחה
          </h1>
          <p className="text-gray-500">ניהול ותיעוד אירועי אבטחה</p>
        </div>
        {can('incidents:create') && (
          <button onClick={() => { resetForm(); setEditingId(null); setShowModal(true); }} className="btn-primary flex items-center gap-2">
            <Plus className="w-4 h-4" />
            דיווח חדש
          </button>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="card !p-4 text-center">
          <p className="text-2xl font-bold text-red-600">{statsData?.open_count || 0}</p>
          <p className="text-sm text-gray-500">פתוחים</p>
        </div>
        <div className="card !p-4 text-center">
          <p className="text-2xl font-bold text-yellow-600">{statsData?.investigating_count || 0}</p>
          <p className="text-sm text-gray-500">בחקירה</p>
        </div>
        <div className="card !p-4 text-center">
          <p className="text-2xl font-bold text-green-600">{statsData?.resolved_this_month || 0}</p>
          <p className="text-sm text-gray-500">טופלו החודש</p>
        </div>
        <div className="card !p-4 text-center">
          <p className="text-2xl font-bold text-red-800">{statsData?.critical_open || 0}</p>
          <p className="text-sm text-gray-500">קריטיים</p>
        </div>
      </div>

      {/* Filters */}
      <div className="card !p-4">
        <div className="flex flex-wrap gap-4">
          <div className="flex-1 min-w-[200px] relative">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input type="text" placeholder="חיפוש..." value={search} onChange={e => setSearch(e.target.value)} className="input pr-10 w-full" />
          </div>
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="input">
            <option value="">כל הסטטוסים</option>
            {Object.entries(statusLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <select value={severityFilter} onChange={e => setSeverityFilter(e.target.value)} className="input">
            <option value="">כל החומרות</option>
            {Object.entries(severityLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary-600 border-t-transparent"></div>
        </div>
      ) : incidents.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <AlertTriangle className="w-12 h-12 mx-auto mb-4 text-gray-300" />
          <p>לא נמצאו אירועי אבטחה</p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-right px-4 py-3 text-sm font-medium text-gray-500">חומרה</th>
                  <th className="text-right px-4 py-3 text-sm font-medium text-gray-500">כותרת</th>
                  <th className="text-right px-4 py-3 text-sm font-medium text-gray-500">סוג</th>
                  <th className="text-right px-4 py-3 text-sm font-medium text-gray-500">אתר / לקוח</th>
                  <th className="text-right px-4 py-3 text-sm font-medium text-gray-500">תאריך</th>
                  <th className="text-right px-4 py-3 text-sm font-medium text-gray-500">סטטוס</th>
                  <th className="text-right px-4 py-3 text-sm font-medium text-gray-500">פעולות</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {incidents.map((inc: any) => (
                  <tr key={inc.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded text-xs font-bold border ${severityColors[inc.severity] || ''}`}>
                        {severityLabels[inc.severity] || inc.severity}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-medium text-gray-900">{inc.title}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{incidentTypes[inc.incident_type] || inc.incident_type}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{inc.site_name || inc.company_name || '-'}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{inc.incident_date} {inc.incident_time}</td>
                    <td className="px-4 py-3">
                      <span className={`badge ${statusColors[inc.status] || ''}`}>
                        {statusLabels[inc.status] || inc.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1">
                        <button onClick={() => setShowDetail(inc.id)} className="p-1.5 rounded hover:bg-gray-100" title="צפה">
                          <Eye className="w-4 h-4 text-gray-500" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/40 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl shadow-modal w-full max-w-2xl max-h-[90vh] overflow-y-auto animate-slide-up m-4">
            <div className="flex items-center justify-between p-6 border-b">
              <h2 className="text-lg font-bold">{editingId ? 'עריכת אירוע' : 'דיווח אירוע אבטחה'}</h2>
              <button onClick={() => setShowModal(false)} className="p-2 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="label">כותרת *</label>
                  <input type="text" required value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} className="input w-full" placeholder="תיאור קצר של האירוע" />
                </div>
                <div>
                  <label className="label">סוג אירוע *</label>
                  <select value={formData.incident_type} onChange={e => setFormData({...formData, incident_type: e.target.value})} className="input w-full">
                    {Object.entries(incidentTypes).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">חומרה *</label>
                  <select value={formData.severity} onChange={e => setFormData({...formData, severity: e.target.value})} className="input w-full">
                    {Object.entries(severityLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">לקוח</label>
                  <select value={formData.customer_id} onChange={e => setFormData({...formData, customer_id: e.target.value, site_id: ''})} className="input w-full">
                    <option value="">בחר לקוח</option>
                    {(customersData?.customers || []).map((c: any) => <option key={c.id} value={c.id}>{c.company_name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">אתר</label>
                  <select value={formData.site_id} onChange={e => setFormData({...formData, site_id: e.target.value})} className="input w-full" disabled={!formData.customer_id}>
                    <option value="">בחר אתר</option>
                    {(sitesData?.sites || []).map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">תאריך *</label>
                  <input type="date" required value={formData.incident_date} onChange={e => setFormData({...formData, incident_date: e.target.value})} className="input w-full" />
                </div>
                <div>
                  <label className="label">שעה *</label>
                  <input type="time" required value={formData.incident_time} onChange={e => setFormData({...formData, incident_time: e.target.value})} className="input w-full" />
                </div>
                <div className="md:col-span-2">
                  <label className="label">תיאור מפורט *</label>
                  <textarea required rows={3} value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} className="input w-full" placeholder="תאר את האירוע בפירוט..." />
                </div>
                <div className="md:col-span-2">
                  <label className="label">מיקום מדויק באתר</label>
                  <input type="text" value={formData.location_details} onChange={e => setFormData({...formData, location_details: e.target.value})} className="input w-full" placeholder="למשל: שער כניסה ראשי, חניון B" />
                </div>
                <div className="md:col-span-2 grid grid-cols-2 md:grid-cols-4 gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={formData.police_called} onChange={e => setFormData({...formData, police_called: e.target.checked})} className="rounded" />
                    <span className="text-sm">הוזעקה משטרה</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={formData.ambulance_called} onChange={e => setFormData({...formData, ambulance_called: e.target.checked})} className="rounded" />
                    <span className="text-sm">הוזעק אמבולנס</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={formData.injuries_reported} onChange={e => setFormData({...formData, injuries_reported: e.target.checked})} className="rounded" />
                    <span className="text-sm">דווח על נפגעים</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={formData.property_damage} onChange={e => setFormData({...formData, property_damage: e.target.checked})} className="rounded" />
                    <span className="text-sm">נזק לרכוש</span>
                  </label>
                </div>
                {formData.police_called && (
                  <div className="md:col-span-2">
                    <label className="label">מספר תיק משטרה</label>
                    <input type="text" value={formData.police_report_number} onChange={e => setFormData({...formData, police_report_number: e.target.value})} className="input w-full" />
                  </div>
                )}
                <div className="md:col-span-2">
                  <label className="label">פעולות שננקטו</label>
                  <textarea rows={2} value={formData.actions_taken} onChange={e => setFormData({...formData, actions_taken: e.target.value})} className="input w-full" placeholder="מה נעשה במקום?" />
                </div>
              </div>
              <div className="flex gap-3 pt-4 border-t">
                <button type="submit" className="btn-primary" disabled={createMutation.isPending}>
                  {createMutation.isPending ? 'שומר...' : editingId ? 'עדכן' : 'דווח אירוע'}
                </button>
                <button type="button" onClick={() => setShowModal(false)} className="btn-secondary">ביטול</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {showDetail && detailData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/40 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto m-4">
            <div className="flex items-center justify-between p-6 border-b">
              <div className="flex items-center gap-3">
                <span className={`px-2 py-1 rounded text-xs font-bold border ${severityColors[detailData.incident?.severity] || ''}`}>
                  {severityLabels[detailData.incident?.severity]}
                </span>
                <h2 className="text-lg font-bold">{detailData.incident?.title}</h2>
              </div>
              <button onClick={() => setShowDetail(null)} className="p-2 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-6">
              {/* Info grid */}
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div>
                  <p className="text-sm text-gray-500">סוג</p>
                  <p className="font-medium">{incidentTypes[detailData.incident?.incident_type]}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">תאריך ושעה</p>
                  <p className="font-medium">{detailData.incident?.incident_date} {detailData.incident?.incident_time}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">סטטוס</p>
                  <span className={`badge ${statusColors[detailData.incident?.status]}`}>{statusLabels[detailData.incident?.status]}</span>
                </div>
                <div>
                  <p className="text-sm text-gray-500">אתר</p>
                  <p className="font-medium">{detailData.incident?.site_name || '-'}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">לקוח</p>
                  <p className="font-medium">{detailData.incident?.company_name || '-'}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">מדווח</p>
                  <p className="font-medium">{detailData.incident?.reporter_name || '-'}</p>
                </div>
              </div>

              {/* Description */}
              <div>
                <p className="text-sm text-gray-500 mb-1">תיאור</p>
                <p className="bg-gray-50 p-3 rounded-lg">{detailData.incident?.description}</p>
              </div>

              {/* Flags */}
              <div className="flex flex-wrap gap-2">
                {detailData.incident?.police_called ? <span className="badge bg-blue-100 text-blue-800">משטרה הוזעקה</span> : null}
                {detailData.incident?.ambulance_called ? <span className="badge bg-red-100 text-red-800">אמבולנס הוזעק</span> : null}
                {detailData.incident?.injuries_reported ? <span className="badge bg-red-100 text-red-800">נפגעים</span> : null}
                {detailData.incident?.property_damage ? <span className="badge bg-orange-100 text-orange-800">נזק לרכוש</span> : null}
              </div>

              {/* Actions taken */}
              {detailData.incident?.actions_taken && (
                <div>
                  <p className="text-sm text-gray-500 mb-1">פעולות שננקטו</p>
                  <p className="bg-green-50 p-3 rounded-lg">{detailData.incident.actions_taken}</p>
                </div>
              )}

              {/* Updates Timeline */}
              <div>
                <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                  <Clock className="w-4 h-4" />
                  עדכונים ({detailData.updates?.length || 0})
                </h3>
                {detailData.updates?.length > 0 ? (
                  <div className="space-y-3 border-r-2 border-gray-200 pr-4 mr-2">
                    {detailData.updates.map((u: any) => (
                      <div key={u.id} className="relative">
                        <div className="absolute -right-[21px] top-1 w-3 h-3 rounded-full bg-primary-500 border-2 border-white"></div>
                        <p className="text-sm">{u.update_text}</p>
                        <p className="text-xs text-gray-400 mt-1">{u.user_name} | {new Date(u.created_at).toLocaleString('he-IL')}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-400">אין עדכונים עדיין</p>
                )}

                {/* Add update */}
                {detailData.incident?.status !== 'closed' && (
                  <div className="mt-4 flex gap-2">
                    <input type="text" placeholder="הוסף עדכון..." value={updateText} onChange={e => setUpdateText(e.target.value)} className="input flex-1" />
                    <button
                      onClick={() => { if (updateText.trim()) addUpdateMutation.mutate({ id: showDetail!, text: updateText }); }}
                      disabled={!updateText.trim() || addUpdateMutation.isPending}
                      className="btn-primary flex items-center gap-1"
                    >
                      <MessageSquarePlus className="w-4 h-4" />
                      עדכן
                    </button>
                  </div>
                )}
              </div>

              {/* Resolve */}
              {can('incidents:resolve') && detailData.incident?.status !== 'resolved' && detailData.incident?.status !== 'closed' && (
                <div className="border-t pt-4">
                  <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-green-500" />
                    סגירת אירוע
                  </h3>
                  <textarea rows={2} placeholder="תיאור הפתרון / סיכום..." value={resolutionText} onChange={e => setResolutionText(e.target.value)} className="input w-full mb-3" />
                  <button
                    onClick={() => { if (resolutionText.trim()) resolveMutation.mutate({ id: showDetail!, resolution: resolutionText }); }}
                    disabled={!resolutionText.trim() || resolveMutation.isPending}
                    className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
                  >
                    {resolveMutation.isPending ? 'סוגר...' : 'סגור אירוע'}
                  </button>
                </div>
              )}

              {/* Resolution */}
              {detailData.incident?.resolution && (
                <div className="bg-green-50 border border-green-200 p-4 rounded-lg">
                  <p className="text-sm text-green-700 font-medium mb-1">פתרון:</p>
                  <p>{detailData.incident.resolution}</p>
                  {detailData.incident.resolution_date && (
                    <p className="text-xs text-green-600 mt-2">נסגר: {detailData.incident.resolution_date}</p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
