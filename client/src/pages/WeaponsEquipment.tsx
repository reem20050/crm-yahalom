import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import {
  Crosshair,
  Package,
  Plus,
  X,
  Trash2,
  ArrowLeftRight,
  Search,
} from 'lucide-react';
import { weaponsApi, equipmentApi, employeesApi } from '../services/api';

type TabType = 'weapons' | 'equipment';

// No fixed weapon/equipment types - user enters free text
const CONDITION_OPTIONS = [
  { value: 'new', label: 'חדש' },
  { value: 'good', label: 'תקין' },
  { value: 'fair', label: 'סביר' },
  { value: 'needs_repair', label: 'דורש תיקון' },
  { value: 'damaged', label: 'פגום' },
];

export default function WeaponsEquipment() {
  const [activeTab, setActiveTab] = useState<TabType>('weapons');
  const [showForm, setShowForm] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [transferWeapon, setTransferWeapon] = useState<{ id: string; name: string } | null>(null);
  const [transferToEmployee, setTransferToEmployee] = useState('');
  const queryClient = useQueryClient();

  // Weapon form
  const [weaponForm, setWeaponForm] = useState({
    weapon_type: '', manufacturer: '', model: '', serial_number: '',
    license_number: '', license_expiry: '', employee_id: '', notes: '',
  });

  // Equipment form
  const [equipForm, setEquipForm] = useState({
    item_type: '', item_name: '', serial_number: '',
    condition: 'good', employee_id: '', notes: '',
  });

  // Queries
  const { data: weaponsData, isLoading: loadingWeapons } = useQuery({
    queryKey: ['all-weapons'],
    queryFn: () => weaponsApi.getAll().then((r) => r.data),
    enabled: activeTab === 'weapons',
  });

  const { data: equipmentData, isLoading: loadingEquipment } = useQuery({
    queryKey: ['all-equipment'],
    queryFn: () => equipmentApi.getAll().then((r) => r.data),
    enabled: activeTab === 'equipment',
  });

  const { data: employeesData } = useQuery({
    queryKey: ['employees-active'],
    queryFn: () => employeesApi.getAll({ status: 'active', limit: 200 }).then((r) => r.data),
  });

  const employees = employeesData?.employees || [];

  // Mutations
  const createWeaponMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => weaponsApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['all-weapons'] });
      toast.success('נשק נוסף בהצלחה');
      setShowForm(false);
      setWeaponForm({ weapon_type: '', manufacturer: '', model: '', serial_number: '', license_number: '', license_expiry: '', employee_id: '', notes: '' });
    },
    onError: () => toast.error('שגיאה בהוספת נשק'),
  });

  const deleteWeaponMutation = useMutation({
    mutationFn: (id: string) => weaponsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['all-weapons'] });
      toast.success('נשק נמחק');
    },
    onError: () => toast.error('שגיאה במחיקה'),
  });

  const transferMutation = useMutation({
    mutationFn: ({ id, employee_id }: { id: string; employee_id: string | null }) =>
      weaponsApi.transfer(id, employee_id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['all-weapons'] });
      toast.success('הנשק הועבר בהצלחה');
      setTransferWeapon(null);
      setTransferToEmployee('');
    },
    onError: () => toast.error('שגיאה בהעברה'),
  });

  const createEquipMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => equipmentApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['all-equipment'] });
      toast.success('ציוד נוסף בהצלחה');
      setShowForm(false);
      setEquipForm({ item_type: '', item_name: '', serial_number: '', condition: 'good', employee_id: '', notes: '' });
    },
    onError: () => toast.error('שגיאה בהוספת ציוד'),
  });

  const returnEquipMutation = useMutation({
    mutationFn: (id: string) => equipmentApi.returnItem(id, 'good'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['all-equipment'] });
      toast.success('ציוד הוחזר');
    },
    onError: () => toast.error('שגיאה בהחזרה'),
  });

  const deleteEquipMutation = useMutation({
    mutationFn: (id: string) => equipmentApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['all-equipment'] });
      toast.success('ציוד נמחק');
    },
    onError: () => toast.error('שגיאה במחיקה'),
  });

  const isLoading = activeTab === 'weapons' ? loadingWeapons : loadingEquipment;

  // Filter
  const filteredWeapons = (weaponsData?.weapons || []).filter((w: { weapon_type: string; serial_number: string; employee_name?: string; manufacturer?: string }) =>
    !searchTerm || [w.weapon_type, w.serial_number, w.employee_name, w.manufacturer].some(
      (v) => v?.toLowerCase().includes(searchTerm.toLowerCase())
    )
  );

  const filteredEquipment = (equipmentData?.equipment || []).filter((e: { item_type: string; item_name: string; employee_name?: string; serial_number?: string }) =>
    !searchTerm || [e.item_type, e.item_name, e.employee_name, e.serial_number].some(
      (v) => v?.toLowerCase().includes(searchTerm.toLowerCase())
    )
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">נשק וציוד</h1>
          <p className="text-gray-500">ניהול נשק, ציוד ומלאי</p>
        </div>
        <button onClick={() => setShowForm(!showForm)} className="btn-primary flex items-center gap-2">
          {showForm ? <X className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
          {showForm ? 'ביטול' : activeTab === 'weapons' ? 'הוסף נשק' : 'הוסף ציוד'}
        </button>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-4 border-b">
        <button
          onClick={() => { setActiveTab('weapons'); setShowForm(false); setSearchTerm(''); }}
          className={`flex items-center gap-2 px-4 py-3 border-b-2 transition-colors ${
            activeTab === 'weapons' ? 'border-primary-500 text-primary-600' : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <Crosshair className="w-5 h-5" />
          נשק ({weaponsData?.weapons?.length || 0})
        </button>
        <button
          onClick={() => { setActiveTab('equipment'); setShowForm(false); setSearchTerm(''); }}
          className={`flex items-center gap-2 px-4 py-3 border-b-2 transition-colors ${
            activeTab === 'equipment' ? 'border-primary-500 text-primary-600' : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <Package className="w-5 h-5" />
          ציוד ({equipmentData?.equipment?.length || 0})
        </button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="חיפוש..."
          className="input pr-10"
        />
      </div>

      {/* Weapon Form */}
      {showForm && activeTab === 'weapons' && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            createWeaponMutation.mutate({
              ...weaponForm,
              employee_id: weaponForm.employee_id || null,
              status: weaponForm.employee_id ? 'assigned' : 'in_armory',
            });
          }}
          className="card space-y-4"
        >
          <h3 className="font-semibold text-lg">הוספת נשק חדש</h3>
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="label">סוג נשק *</label>
              <input value={weaponForm.weapon_type} onChange={(e) => setWeaponForm({ ...weaponForm, weapon_type: e.target.value })} className="input" placeholder="לדוגמה: אקדח, רובה..." required />
            </div>
            <div>
              <label className="label">יצרן</label>
              <input value={weaponForm.manufacturer} onChange={(e) => setWeaponForm({ ...weaponForm, manufacturer: e.target.value })} className="input" />
            </div>
            <div>
              <label className="label">דגם</label>
              <input value={weaponForm.model} onChange={(e) => setWeaponForm({ ...weaponForm, model: e.target.value })} className="input" />
            </div>
            <div>
              <label className="label">מספר סידורי *</label>
              <input value={weaponForm.serial_number} onChange={(e) => setWeaponForm({ ...weaponForm, serial_number: e.target.value })} className="input" dir="ltr" required />
            </div>
            <div>
              <label className="label">מספר רישיון</label>
              <input value={weaponForm.license_number} onChange={(e) => setWeaponForm({ ...weaponForm, license_number: e.target.value })} className="input" dir="ltr" />
            </div>
            <div>
              <label className="label">תפוגת רישיון</label>
              <input type="date" value={weaponForm.license_expiry} onChange={(e) => setWeaponForm({ ...weaponForm, license_expiry: e.target.value })} className="input" />
            </div>
            <div>
              <label className="label">הקצה למאבטח</label>
              <select value={weaponForm.employee_id} onChange={(e) => setWeaponForm({ ...weaponForm, employee_id: e.target.value })} className="input">
                <option value="">במחסן</option>
                {employees.map((emp: { id: string; first_name: string; last_name: string }) => (
                  <option key={emp.id} value={emp.id}>{emp.first_name} {emp.last_name}</option>
                ))}
              </select>
            </div>
            <div className="lg:col-span-2">
              <label className="label">הערות</label>
              <input value={weaponForm.notes} onChange={(e) => setWeaponForm({ ...weaponForm, notes: e.target.value })} className="input" />
            </div>
          </div>
          <button type="submit" disabled={createWeaponMutation.isPending} className="btn-primary">
            {createWeaponMutation.isPending ? 'שומר...' : 'הוסף נשק'}
          </button>
        </form>
      )}

      {/* Equipment Form */}
      {showForm && activeTab === 'equipment' && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            createEquipMutation.mutate({
              ...equipForm,
              employee_id: equipForm.employee_id || null,
            });
          }}
          className="card space-y-4"
        >
          <h3 className="font-semibold text-lg">הוספת ציוד חדש</h3>
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="label">סוג ציוד *</label>
              <input value={equipForm.item_type} onChange={(e) => setEquipForm({ ...equipForm, item_type: e.target.value })} className="input" placeholder="לדוגמה: רדיו, אפוד, פנס..." required />
            </div>
            <div>
              <label className="label">שם פריט *</label>
              <input value={equipForm.item_name} onChange={(e) => setEquipForm({ ...equipForm, item_name: e.target.value })} className="input" required />
            </div>
            <div>
              <label className="label">מספר סידורי</label>
              <input value={equipForm.serial_number} onChange={(e) => setEquipForm({ ...equipForm, serial_number: e.target.value })} className="input" dir="ltr" />
            </div>
            <div>
              <label className="label">מצב</label>
              <select value={equipForm.condition} onChange={(e) => setEquipForm({ ...equipForm, condition: e.target.value })} className="input">
                {CONDITION_OPTIONS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>
            <div>
              <label className="label">הקצה למאבטח</label>
              <select value={equipForm.employee_id} onChange={(e) => setEquipForm({ ...equipForm, employee_id: e.target.value })} className="input">
                <option value="">לא מוקצה</option>
                {employees.map((emp: { id: string; first_name: string; last_name: string }) => (
                  <option key={emp.id} value={emp.id}>{emp.first_name} {emp.last_name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">הערות</label>
              <input value={equipForm.notes} onChange={(e) => setEquipForm({ ...equipForm, notes: e.target.value })} className="input" />
            </div>
          </div>
          <button type="submit" disabled={createEquipMutation.isPending} className="btn-primary">
            {createEquipMutation.isPending ? 'שומר...' : 'הוסף ציוד'}
          </button>
        </form>
      )}

      {/* Transfer Modal */}
      {transferWeapon && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <h3 className="text-lg font-bold mb-4">העברת נשק: {transferWeapon.name}</h3>
            <div className="space-y-4">
              <div>
                <label className="label">העבר למאבטח</label>
                <select value={transferToEmployee} onChange={(e) => setTransferToEmployee(e.target.value)} className="input">
                  <option value="">החזר למחסן</option>
                  {employees.map((emp: { id: string; first_name: string; last_name: string }) => (
                    <option key={emp.id} value={emp.id}>{emp.first_name} {emp.last_name}</option>
                  ))}
                </select>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => transferMutation.mutate({ id: transferWeapon.id, employee_id: transferToEmployee || null })}
                  disabled={transferMutation.isPending}
                  className="btn-primary flex-1"
                >
                  {transferMutation.isPending ? 'מעביר...' : 'העבר'}
                </button>
                <button onClick={() => setTransferWeapon(null)} className="btn-secondary">ביטול</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Content */}
      {isLoading ? (
        <div className="flex items-center justify-center h-48">
          <div className="animate-spin rounded-full h-8 w-8 border-4 border-primary-500 border-t-transparent"></div>
        </div>
      ) : activeTab === 'weapons' ? (
        <div className="space-y-3">
          {filteredWeapons.length > 0 ? filteredWeapons.map((w: {
            id: string; weapon_type: string; manufacturer?: string; model?: string;
            serial_number: string; license_number?: string; license_expiry?: string;
            status: string; employee_name?: string; employee_id?: string; notes?: string;
          }) => (
            <div key={w.id} className="card p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                    w.status === 'assigned' ? 'bg-green-100' : w.status === 'maintenance' ? 'bg-yellow-100' : 'bg-gray-100'
                  }`}>
                    <Crosshair className={`w-6 h-6 ${
                      w.status === 'assigned' ? 'text-green-600' : w.status === 'maintenance' ? 'text-yellow-600' : 'text-gray-600'
                    }`} />
                  </div>
                  <div>
                    <p className="font-semibold">{w.weapon_type} {w.manufacturer && `- ${w.manufacturer}`} {w.model || ''}</p>
                    <p className="text-sm text-gray-500">
                      מס"ס: <span dir="ltr">{w.serial_number}</span>
                      {w.license_number && ` | רישיון: ${w.license_number}`}
                    </p>
                    {w.employee_name && (
                      <p className="text-sm text-green-600">מוקצה ל: {w.employee_name}</p>
                    )}
                    {w.license_expiry && (
                      <p className="text-xs text-gray-400">תפוגת רישיון: {w.license_expiry}</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`badge ${
                    w.status === 'assigned' ? 'badge-success' : w.status === 'maintenance' ? 'badge-warning' : 'badge-gray'
                  }`}>
                    {w.status === 'assigned' ? 'מוקצה' : w.status === 'maintenance' ? 'בתחזוקה' : 'במחסן'}
                  </span>
                  <button
                    onClick={() => setTransferWeapon({ id: w.id, name: `${w.weapon_type} ${w.serial_number}` })}
                    className="btn-secondary text-xs px-2 py-1 flex items-center gap-1"
                    title="העבר"
                  >
                    <ArrowLeftRight className="w-3.5 h-3.5" />
                    העבר
                  </button>
                  <button
                    onClick={() => { if (confirm('למחוק נשק זה?')) deleteWeaponMutation.mutate(w.id); }}
                    className="text-red-400 hover:text-red-600 p-1"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          )) : (
            <p className="text-gray-400 text-center py-8">אין נשק רשום</p>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {filteredEquipment.length > 0 ? filteredEquipment.map((e: {
            id: string; item_type: string; item_name: string; serial_number?: string;
            condition: string; employee_name?: string; employee_id?: string;
            assigned_date?: string; return_date?: string; notes?: string;
          }) => {
            const isAssigned = !!e.employee_id && !e.return_date;
            const condLabel: Record<string, string> = { new: 'חדש', good: 'תקין', fair: 'סביר', needs_repair: 'דורש תיקון', damaged: 'פגום' };
            return (
              <div key={e.id} className="card p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center ${isAssigned ? 'bg-blue-100' : 'bg-gray-100'}`}>
                      <Package className={`w-6 h-6 ${isAssigned ? 'text-blue-600' : 'text-gray-600'}`} />
                    </div>
                    <div>
                      <p className="font-semibold">{e.item_name}</p>
                      <p className="text-sm text-gray-500">
                        {e.item_type}
                        {e.serial_number && ` | מס"ס: ${e.serial_number}`}
                      </p>
                      {isAssigned && e.employee_name && (
                        <p className="text-sm text-blue-600">מוקצה ל: {e.employee_name}</p>
                      )}
                      {e.return_date && (
                        <p className="text-xs text-gray-400">הוחזר: {e.return_date}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`badge ${
                      e.condition === 'good' || e.condition === 'new' ? 'badge-success' :
                      e.condition === 'fair' ? 'badge-warning' : 'badge-danger'
                    }`}>
                      {condLabel[e.condition] || e.condition}
                    </span>
                    {isAssigned && (
                      <button
                        onClick={() => returnEquipMutation.mutate(e.id)}
                        className="btn-secondary text-xs px-2 py-1"
                      >
                        החזר
                      </button>
                    )}
                    <button
                      onClick={() => { if (confirm('למחוק ציוד זה?')) deleteEquipMutation.mutate(e.id); }}
                      className="text-red-400 hover:text-red-600 p-1"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          }) : (
            <p className="text-gray-400 text-center py-8">אין ציוד רשום</p>
          )}
        </div>
      )}
    </div>
  );
}
