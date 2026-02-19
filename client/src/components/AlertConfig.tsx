import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import {
  Bell,
  BellOff,
  Shield,
  Save,
  Trash2,
  AlertTriangle,
  ArrowUpCircle,
  RefreshCw,
  Clock,
  ToggleLeft,
  ToggleRight,
} from 'lucide-react';
import { alertsApi } from '../services/api';
import { SkeletonPulse } from './Skeleton';

// ── Types ───────────────────────────────────────────────────────────────────

interface AlertConfigItem {
  id: string;
  alert_type: string;
  display_name: string;
  description: string;
  is_enabled: number;
  threshold_value: number;
  threshold_unit: string;
  warning_threshold: number | null;
  critical_threshold: number | null;
  dedup_hours: number;
  escalation_delay_hours: number;
  channels: string;
  updated_at: string;
}

interface AlertMute {
  id: string;
  user_id: string;
  alert_type: string;
  alert_display_name?: string;
  related_entity_type: string | null;
  related_entity_id: string | null;
  muted_until: string | null;
  reason: string | null;
  created_at: string;
}

interface AlertEscalation {
  id: string;
  notification_id: string;
  alert_type: string;
  alert_display_name?: string;
  notification_title?: string;
  notification_message?: string;
  escalation_level: number;
  escalated_at: string;
  escalated_to: string;
}

// ── Helpers ─────────────────────────────────────────────────────────────────

const unitLabels: Record<string, string> = {
  days: 'ימים',
  count: 'כמות',
  hours: 'שעות',
};

function formatDate(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('he-IL', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return dateStr || '-';
  }
}

function formatMutedUntil(dateStr: string | null): string {
  if (!dateStr) return 'לצמיתות';
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('he-IL', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return dateStr;
  }
}

// ── Inline Edit Row ─────────────────────────────────────────────────────────

function AlertConfigRow({
  config,
  onSave,
  isSaving,
}: {
  config: AlertConfigItem;
  onSave: (type: string, data: Record<string, unknown>) => void;
  isSaving: boolean;
}) {
  const [localConfig, setLocalConfig] = useState({
    is_enabled: !!config.is_enabled,
    threshold_value: config.threshold_value,
    warning_threshold: config.warning_threshold ?? '',
    critical_threshold: config.critical_threshold ?? '',
    dedup_hours: config.dedup_hours,
    escalation_delay_hours: config.escalation_delay_hours,
  });
  const [dirty, setDirty] = useState(false);

  const handleChange = (field: string, value: unknown) => {
    setLocalConfig((prev) => ({ ...prev, [field]: value }));
    setDirty(true);
  };

  const handleSave = () => {
    onSave(config.alert_type, {
      is_enabled: localConfig.is_enabled,
      threshold_value: Number(localConfig.threshold_value),
      warning_threshold: localConfig.warning_threshold !== '' ? Number(localConfig.warning_threshold) : null,
      critical_threshold: localConfig.critical_threshold !== '' ? Number(localConfig.critical_threshold) : null,
      dedup_hours: Number(localConfig.dedup_hours),
      escalation_delay_hours: Number(localConfig.escalation_delay_hours),
    });
    setDirty(false);
  };

  return (
    <tr className="hover:bg-gray-50 transition-colors">
      {/* Name + Description */}
      <td className="py-3 px-3">
        <div className="flex items-center gap-2">
          <span className="font-medium text-gray-900">{config.display_name}</span>
        </div>
        <p className="text-xs text-gray-500 mt-0.5">{config.description}</p>
      </td>

      {/* Enabled toggle */}
      <td className="py-3 px-3">
        <button
          onClick={() => handleChange('is_enabled', !localConfig.is_enabled)}
          className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium transition-colors ${
            localConfig.is_enabled
              ? 'bg-green-100 text-green-700 hover:bg-green-200'
              : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
          }`}
        >
          {localConfig.is_enabled ? (
            <ToggleRight className="w-4 h-4" />
          ) : (
            <ToggleLeft className="w-4 h-4" />
          )}
          {localConfig.is_enabled ? 'פעיל' : 'כבוי'}
        </button>
      </td>

      {/* Threshold */}
      <td className="py-3 px-3">
        <div className="flex items-center gap-1">
          <input
            type="number"
            value={localConfig.threshold_value}
            onChange={(e) => handleChange('threshold_value', e.target.value)}
            className="input w-16 text-center text-sm py-1 px-2"
            min={0}
          />
          <span className="text-xs text-gray-500">{unitLabels[config.threshold_unit] || config.threshold_unit}</span>
        </div>
      </td>

      {/* Warning */}
      <td className="py-3 px-3">
        <input
          type="number"
          value={localConfig.warning_threshold}
          onChange={(e) => handleChange('warning_threshold', e.target.value)}
          className="input w-16 text-center text-sm py-1 px-2"
          placeholder="-"
          min={0}
        />
      </td>

      {/* Critical */}
      <td className="py-3 px-3">
        <input
          type="number"
          value={localConfig.critical_threshold}
          onChange={(e) => handleChange('critical_threshold', e.target.value)}
          className="input w-16 text-center text-sm py-1 px-2"
          placeholder="-"
          min={0}
        />
      </td>

      {/* Dedup */}
      <td className="py-3 px-3">
        <div className="flex items-center gap-1">
          <input
            type="number"
            value={localConfig.dedup_hours}
            onChange={(e) => handleChange('dedup_hours', e.target.value)}
            className="input w-16 text-center text-sm py-1 px-2"
            min={0}
          />
          <span className="text-xs text-gray-500">שעות</span>
        </div>
      </td>

      {/* Escalation */}
      <td className="py-3 px-3">
        <div className="flex items-center gap-1">
          <input
            type="number"
            value={localConfig.escalation_delay_hours}
            onChange={(e) => handleChange('escalation_delay_hours', e.target.value)}
            className="input w-16 text-center text-sm py-1 px-2"
            min={0}
          />
          <span className="text-xs text-gray-500">שעות</span>
        </div>
      </td>

      {/* Save */}
      <td className="py-3 px-3">
        <button
          onClick={handleSave}
          disabled={!dirty || isSaving}
          className={`btn-primary text-xs py-1.5 px-3 flex items-center gap-1 ${
            !dirty ? 'opacity-40 cursor-not-allowed' : ''
          }`}
        >
          {isSaving ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
          שמור
        </button>
      </td>
    </tr>
  );
}

// ── Main Component ──────────────────────────────────────────────────────────

export default function AlertConfig() {
  const queryClient = useQueryClient();

  // Fetch alert configs
  const { data: configData, isLoading: configLoading } = useQuery({
    queryKey: ['alert-configs'],
    queryFn: async () => {
      const res = await alertsApi.getConfig();
      return res.data?.configs || [];
    },
  });

  // Fetch mutes
  const { data: mutesData, isLoading: mutesLoading } = useQuery({
    queryKey: ['alert-mutes'],
    queryFn: async () => {
      const res = await alertsApi.getMutes();
      return res.data?.mutes || [];
    },
  });

  // Fetch escalations
  const { data: escalationsData, isLoading: escalationsLoading } = useQuery({
    queryKey: ['alert-escalations'],
    queryFn: async () => {
      const res = await alertsApi.getEscalations(20);
      return res.data?.escalations || [];
    },
  });

  // Update config mutation
  const updateConfigMutation = useMutation({
    mutationFn: ({ type, data }: { type: string; data: Record<string, unknown> }) =>
      alertsApi.updateConfig(type, data),
    onSuccess: () => {
      toast.success('הגדרות התראה עודכנו');
      queryClient.invalidateQueries({ queryKey: ['alert-configs'] });
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error || 'שגיאה בעדכון הגדרות');
    },
  });

  // Unmute mutation
  const unmuteMutation = useMutation({
    mutationFn: (id: string) => alertsApi.unmuteAlert(id),
    onSuccess: () => {
      toast.success('ביטול השתקה בוצע');
      queryClient.invalidateQueries({ queryKey: ['alert-mutes'] });
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error || 'שגיאה בביטול השתקה');
    },
  });

  const handleSaveConfig = (type: string, data: Record<string, unknown>) => {
    updateConfigMutation.mutate({ type, data });
  };

  const configs: AlertConfigItem[] = configData || [];
  const mutes: AlertMute[] = mutesData || [];
  const escalations: AlertEscalation[] = escalationsData || [];

  return (
    <div className="space-y-6">
      {/* ── Alert Configurations Table ───────────────────────────────── */}
      <div className="card">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-gradient-to-br from-amber-100 to-amber-50 rounded-xl flex items-center justify-center">
            <Bell className="w-5 h-5 text-amber-600" />
          </div>
          <div>
            <h3 className="font-heading font-semibold text-gray-900 text-lg">הגדרות התראות</h3>
            <p className="text-sm text-gray-500">ניהול ספי התראה, רמות חומרה ואסקלציות</p>
          </div>
        </div>

        {configLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <SkeletonPulse key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : configs.length === 0 ? (
          <div className="text-center py-8 text-gray-400">
            <Bell className="w-10 h-10 mx-auto mb-2 opacity-40" />
            <p className="text-sm">אין הגדרות התראות</p>
          </div>
        ) : (
          <div className="table-container overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-gray-500">
                  <th className="text-right py-3 px-3 font-medium">סוג התראה</th>
                  <th className="text-right py-3 px-3 font-medium">סטטוס</th>
                  <th className="text-right py-3 px-3 font-medium">סף</th>
                  <th className="text-right py-3 px-3 font-medium">
                    <span className="inline-flex items-center gap-1">
                      <span className="text-yellow-500">&#x1F7E1;</span> אזהרה
                    </span>
                  </th>
                  <th className="text-right py-3 px-3 font-medium">
                    <span className="inline-flex items-center gap-1">
                      <span className="text-red-500">&#x1F534;</span> קריטי
                    </span>
                  </th>
                  <th className="text-right py-3 px-3 font-medium">כפילות</th>
                  <th className="text-right py-3 px-3 font-medium">אסקלציה</th>
                  <th className="text-right py-3 px-3 font-medium"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {configs.map((config) => (
                  <AlertConfigRow
                    key={config.id}
                    config={config}
                    onSave={handleSaveConfig}
                    isSaving={updateConfigMutation.isPending}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Active Mutes Section ─────────────────────────────────────── */}
      <div className="card">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-gradient-to-br from-gray-100 to-gray-50 rounded-xl flex items-center justify-center">
            <BellOff className="w-5 h-5 text-gray-600" />
          </div>
          <div>
            <h3 className="font-heading font-semibold text-gray-900 text-lg">השתקות פעילות</h3>
            <p className="text-sm text-gray-500">רשימת ההתראות שהושתקו כרגע</p>
          </div>
        </div>

        {mutesLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <SkeletonPulse key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : mutes.length === 0 ? (
          <div className="text-center py-6 text-gray-400">
            <BellOff className="w-8 h-8 mx-auto mb-2 opacity-40" />
            <p className="text-sm">אין השתקות פעילות</p>
          </div>
        ) : (
          <div className="table-container overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-gray-500">
                  <th className="text-right py-3 px-3 font-medium">סוג התראה</th>
                  <th className="text-right py-3 px-3 font-medium">ישות</th>
                  <th className="text-right py-3 px-3 font-medium">עד</th>
                  <th className="text-right py-3 px-3 font-medium">סיבה</th>
                  <th className="text-right py-3 px-3 font-medium"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {mutes.map((mute) => (
                  <tr key={mute.id} className="hover:bg-gray-50 transition-colors">
                    <td className="py-3 px-3">
                      <span className="badge-warning text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
                        {mute.alert_display_name || mute.alert_type}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-gray-600">
                      {mute.related_entity_type
                        ? `${mute.related_entity_type} / ${mute.related_entity_id?.slice(0, 8) || '-'}...`
                        : 'כללי'}
                    </td>
                    <td className="py-3 px-3 text-gray-600">
                      <span className="inline-flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {formatMutedUntil(mute.muted_until)}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-gray-500">{mute.reason || '-'}</td>
                    <td className="py-3 px-3">
                      <button
                        onClick={() => unmuteMutation.mutate(mute.id)}
                        disabled={unmuteMutation.isPending}
                        className="btn-ghost text-xs py-1 px-2 text-red-600 hover:bg-red-50 flex items-center gap-1"
                      >
                        <Trash2 className="w-3 h-3" />
                        בטל
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Recent Escalations Section ───────────────────────────────── */}
      <div className="card">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-gradient-to-br from-red-100 to-red-50 rounded-xl flex items-center justify-center">
            <ArrowUpCircle className="w-5 h-5 text-red-600" />
          </div>
          <div>
            <h3 className="font-heading font-semibold text-gray-900 text-lg">אסקלציות אחרונות</h3>
            <p className="text-sm text-gray-500">התראות שהועלו לרמה גבוהה יותר</p>
          </div>
        </div>

        {escalationsLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <SkeletonPulse key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : escalations.length === 0 ? (
          <div className="text-center py-6 text-gray-400">
            <Shield className="w-8 h-8 mx-auto mb-2 opacity-40" />
            <p className="text-sm">אין אסקלציות אחרונות</p>
          </div>
        ) : (
          <div className="table-container overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-gray-500">
                  <th className="text-right py-3 px-3 font-medium">סוג התראה</th>
                  <th className="text-right py-3 px-3 font-medium">התראה מקורית</th>
                  <th className="text-right py-3 px-3 font-medium">רמה</th>
                  <th className="text-right py-3 px-3 font-medium">הועלה ב</th>
                  <th className="text-right py-3 px-3 font-medium">הועלה ל</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {escalations.map((esc) => (
                  <tr key={esc.id} className="hover:bg-gray-50 transition-colors">
                    <td className="py-3 px-3">
                      <span className="badge-danger text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700">
                        {esc.alert_display_name || esc.alert_type}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-gray-700 max-w-xs truncate">
                      <div className="flex items-center gap-1">
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
                        <span className="truncate">{esc.notification_title || '-'}</span>
                      </div>
                    </td>
                    <td className="py-3 px-3">
                      <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-red-100 text-red-700 text-xs font-bold">
                        {esc.escalation_level}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-gray-600">{formatDate(esc.escalated_at)}</td>
                    <td className="py-3 px-3 text-gray-600">{esc.escalated_to || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
