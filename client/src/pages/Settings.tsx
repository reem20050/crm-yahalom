import { useState, useEffect, useCallback, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import {
  Settings as SettingsIcon,
  Link,
  Unlink,
  Mail,
  MessageCircle,
  FileText,
  Check,
  X,
  ExternalLink,
  RefreshCw,
  AlertTriangle,
  QrCode,
  Smartphone,
  Wifi,
  WifiOff,
  Server,
} from 'lucide-react';
import api from '../services/api';
import type { MutationError } from '../types';

// Types
interface IntegrationSettings {
  google: {
    connected: boolean;
    email?: string;
  };
  whatsapp: {
    connected: boolean;
    phoneNumber?: string;
    wahaUrl?: string;
  };
  greenInvoice: {
    connected: boolean;
    businessName?: string;
  };
}

interface GreenInvoiceForm {
  apiKey: string;
  apiSecret: string;
}

export default function Settings() {
  const queryClient = useQueryClient();
  const [showGreenInvoiceForm, setShowGreenInvoiceForm] = useState(false);
  const [testPhone, setTestPhone] = useState('');
  const [googleSetupNeeded, setGoogleSetupNeeded] = useState(false);
  const [showGoogleGuide, setShowGoogleGuide] = useState(false);

  // WAHA WhatsApp states
  const [wahaStep, setWahaStep] = useState<'idle' | 'url' | 'qr' | 'connected'>('idle');
  const [wahaUrl, setWahaUrl] = useState('');
  const [wahaApiKey, setWahaApiKey] = useState('');
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [wahaStatus, setWahaStatus] = useState<string | null>(null);
  const [wahaPhone, setWahaPhone] = useState<string | null>(null);
  const qrIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Handle Google OAuth redirect query params
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const googleStatus = params.get('google');
    if (googleStatus === 'connected') {
      toast.success('Google חובר בהצלחה! 🎉');
      queryClient.invalidateQueries({ queryKey: ['integrationSettings'] });
      window.history.replaceState({}, '', '/settings');
    } else if (googleStatus === 'error') {
      const reason = params.get('reason') || '';
      if (reason.includes('access_denied') || reason.includes('blocked')) {
        toast.error('הגישה נחסמה על ידי Google. ודא שהאפליקציה מאומתת ושהמשתמש מורשה.');
      } else {
        toast.error('שגיאה בהתחברות ל-Google: ' + (reason || 'שגיאה לא ידועה'));
      }
      window.history.replaceState({}, '', '/settings');
    }
  }, [queryClient]);

  // Fetch integration settings
  const { data: settings, isLoading } = useQuery<IntegrationSettings>({
    queryKey: ['integrationSettings'],
    queryFn: async () => {
      const res = await api.get('/integrations/settings');
      return res.data;
    },
  });

  // Green Invoice form
  const greenInvoiceForm = useForm<GreenInvoiceForm>();

  // Google connect mutation
  const googleConnectMutation = useMutation({
    mutationFn: async () => {
      const res = await api.get('/integrations/google/auth-url');
      return res.data;
    },
    onSuccess: (data) => {
      if (data.authUrl) {
        window.location.href = data.authUrl;
      }
    },
    onError: (err: MutationError) => {
      const data = err.response?.data;
      if (data?.needsSetup) {
        setGoogleSetupNeeded(true);
        setShowGoogleGuide(true);
        toast.error('צריך להגדיר Google OAuth בשרת');
      } else {
        toast.error(data?.message || 'שגיאה בהתחברות ל-Google');
      }
    },
  });

  // Google disconnect mutation
  const googleDisconnectMutation = useMutation({
    mutationFn: () => api.post('/integrations/google/disconnect'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['integrationSettings'] });
      toast.success('Google נותק בהצלחה');
    },
    onError: () => toast.error('שגיאה בניתוק Google'),
  });

  // ========== WAHA WhatsApp Flow ==========

  // Save WAHA URL and start session
  const wahaSaveMutation = useMutation({
    mutationFn: async ({ url, apiKey }: { url: string; apiKey?: string }) => {
      const res = await api.post('/integrations/whatsapp/settings', { wahaUrl: url, apiKey: apiKey || '' });
      return res.data;
    },
    onSuccess: () => {
      toast.success('שרת WAHA מחובר! סרוק QR כדי לחבר את WhatsApp');
      setWahaStep('qr');
      startQrPolling();
    },
    onError: (err: MutationError) => {
      toast.error(err.response?.data?.message || 'שגיאה בהתחברות לשרת WAHA');
    },
  });

  // Fetch QR code
  const fetchQR = useCallback(async () => {
    try {
      const res = await api.get('/integrations/whatsapp/qr');
      if (res.data.authenticated) {
        // Already connected!
        setWahaStep('connected');
        stopQrPolling();
        queryClient.invalidateQueries({ queryKey: ['integrationSettings'] });
        toast.success('WhatsApp מחובר בהצלחה! 🎉');
        // Get phone number
        const statusRes = await api.get('/integrations/whatsapp/status');
        if (statusRes.data.phoneNumber) {
          setWahaPhone(statusRes.data.phoneNumber);
        }
        return;
      }
      if (res.data.qr) {
        setQrCode(res.data.qr);
      }
    } catch {
      // Ignore errors during polling
    }
  }, [queryClient]);

  // Check status
  const checkStatus = useCallback(async () => {
    try {
      const res = await api.get('/integrations/whatsapp/status');
      setWahaStatus(res.data.status);
      if (res.data.status === 'WORKING') {
        setWahaStep('connected');
        setWahaPhone(res.data.phoneNumber);
        stopQrPolling();
        queryClient.invalidateQueries({ queryKey: ['integrationSettings'] });
        toast.success('WhatsApp מחובר בהצלחה! 🎉');
      }
    } catch {
      // ignore
    }
  }, [queryClient]);

  // QR polling
  const startQrPolling = useCallback(() => {
    fetchQR();
    if (qrIntervalRef.current) clearInterval(qrIntervalRef.current);
    qrIntervalRef.current = setInterval(async () => {
      await checkStatus();
      // If still not connected, refresh QR
      if (wahaStep === 'qr') {
        await fetchQR();
      }
    }, 5000);
  }, [fetchQR, checkStatus, wahaStep]);

  const stopQrPolling = () => {
    if (qrIntervalRef.current) {
      clearInterval(qrIntervalRef.current);
      qrIntervalRef.current = null;
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => stopQrPolling();
  }, []);

  // If already connected via settings, verify actual WAHA status
  useEffect(() => {
    if (settings?.whatsapp.connected && wahaStep === 'idle') {
      // Check actual WAHA session status
      api.get('/integrations/whatsapp/status').then(res => {
        const status = res.data.status;
        if (status === 'WORKING') {
          setWahaStep('connected');
          setWahaPhone(res.data.phoneNumber || settings.whatsapp.phoneNumber || null);
        } else if (status === 'SCAN_QR_CODE') {
          setWahaStep('qr');
          startQrPolling();
        } else {
          // Session exists but not authenticated - show QR flow
          setWahaStep('qr');
          startQrPolling();
        }
      }).catch(() => {
        // Can't reach WAHA - show as connected based on DB
        setWahaStep('connected');
        setWahaPhone(settings.whatsapp.phoneNumber || null);
      });
    }
  }, [settings, wahaStep]);

  // WhatsApp disconnect mutation
  const whatsAppDisconnectMutation = useMutation({
    mutationFn: () => api.post('/integrations/whatsapp/disconnect'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['integrationSettings'] });
      toast.success('WhatsApp נותק בהצלחה');
      setWahaStep('idle');
      setQrCode(null);
      setWahaUrl('');
      setWahaPhone(null);
    },
    onError: () => toast.error('שגיאה בניתוק WhatsApp'),
  });

  // WhatsApp test mutation
  const whatsAppTestMutation = useMutation({
    mutationFn: (to: string) => api.post('/integrations/whatsapp/test', { to }),
    onSuccess: () => {
      toast.success('הודעת בדיקה נשלחה בהצלחה! ✅');
      setTestPhone('');
    },
    onError: (err: MutationError) => {
      toast.error(err.response?.data?.message || 'שגיאה בשליחת הודעת בדיקה');
    },
  });

  // Green Invoice save mutation
  const greenInvoiceSaveMutation = useMutation({
    mutationFn: (data: GreenInvoiceForm) => api.post('/integrations/green-invoice/settings', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['integrationSettings'] });
      toast.success('חשבונית ירוקה הוגדרה בהצלחה');
      setShowGreenInvoiceForm(false);
    },
    onError: () => {
      toast.error('שגיאה בחיבור לחשבונית ירוקה - בדוק את פרטי ההתחברות');
    },
  });

  // Green Invoice disconnect mutation
  const greenInvoiceDisconnectMutation = useMutation({
    mutationFn: () => api.post('/integrations/green-invoice/disconnect'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['integrationSettings'] });
      toast.success('חשבונית ירוקה נותקה בהצלחה');
    },
    onError: () => toast.error('שגיאה בניתוק חשבונית ירוקה'),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary-600 border-t-transparent"></div>
      </div>
    );
  }

  // ========== Render WhatsApp Section ==========
  const renderWhatsAppContent = () => {
    // Connected state
    if (wahaStep === 'connected' || (settings?.whatsapp.connected && wahaStep !== 'qr' && wahaStep !== 'url')) {
      return (
        <div className="mt-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Wifi className="w-4 h-4 text-green-500" />
              <p className="text-sm text-gray-600">
                {wahaPhone || settings?.whatsapp.phoneNumber ? (
                  <>מחובר: <span className="font-medium" dir="ltr">{wahaPhone || settings?.whatsapp.phoneNumber}</span></>
                ) : 'מחובר ופעיל'}
              </p>
            </div>
            <button
              onClick={() => whatsAppDisconnectMutation.mutate()}
              disabled={whatsAppDisconnectMutation.isPending}
              className="btn-secondary text-red-600 hover:bg-red-50 flex items-center gap-2"
            >
              <Unlink className="w-4 h-4" />
              נתק
            </button>
          </div>
          {/* Test connection */}
          <div className="flex items-center gap-2 p-3 bg-green-50 rounded-lg">
            <input
              type="text"
              value={testPhone}
              onChange={(e) => setTestPhone(e.target.value)}
              placeholder="מספר טלפון לבדיקה (050...)"
              className="input flex-1 text-sm"
              dir="ltr"
            />
            <button
              onClick={() => { if (testPhone) whatsAppTestMutation.mutate(testPhone); }}
              disabled={whatsAppTestMutation.isPending || !testPhone}
              className="btn-success text-sm px-3 py-2 flex items-center gap-1"
            >
              {whatsAppTestMutation.isPending ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <MessageCircle className="w-4 h-4" />
              )}
              בדוק חיבור
            </button>
          </div>
        </div>
      );
    }

    // QR code scanning step
    if (wahaStep === 'qr') {
      return (
        <div className="mt-4 space-y-4">
          <div className="text-center p-6 bg-green-50 rounded-xl border-2 border-green-200">
            <Smartphone className="w-8 h-8 text-green-600 mx-auto mb-3" />
            <h4 className="font-bold text-green-900 mb-2">סרוק QR Code עם WhatsApp</h4>
            <p className="text-sm text-green-700 mb-4">
              פתח WhatsApp בטלפון → הגדרות → מכשירים מקושרים → קשר מכשיר
            </p>

            {qrCode ? (
              <div className="inline-block bg-white p-4 rounded-xl shadow-lg">
                {typeof qrCode === 'string' && qrCode.startsWith('data:') ? (
                  <img src={qrCode} alt="WhatsApp QR Code" className="w-64 h-64" />
                ) : (
                  <div className="w-64 h-64 flex items-center justify-center bg-gray-50 rounded text-xs text-gray-500 break-all p-2 overflow-hidden">
                    <QrCode className="w-16 h-16 text-gray-300" />
                  </div>
                )}
              </div>
            ) : (
              <div className="inline-block">
                <div className="w-64 h-64 bg-white rounded-xl shadow-lg flex flex-col items-center justify-center gap-3">
                  <RefreshCw className="w-8 h-8 text-green-500 animate-spin" />
                  <p className="text-sm text-gray-500">טוען QR Code...</p>
                </div>
              </div>
            )}

            <div className="mt-4 flex items-center justify-center gap-2 text-xs text-green-600">
              <RefreshCw className="w-3 h-3 animate-spin" />
              ממתין לסריקה... (מתרענן אוטומטית)
            </div>
          </div>

          <button
            onClick={() => { setWahaStep('idle'); stopQrPolling(); setQrCode(null); }}
            className="btn-secondary w-full"
          >
            ביטול
          </button>
        </div>
      );
    }

    // WAHA URL input step
    if (wahaStep === 'url') {
      return (
        <div className="mt-4 space-y-4">
          <div className="bg-green-50 rounded-lg p-4 border border-green-200">
            <h4 className="font-bold text-green-900 mb-2">חיבור שרת WAHA</h4>
            <p className="text-sm text-green-700 mb-3">
              הכנס את כתובת שרת ה-WAHA שלך. אם עדיין אין לך, לחץ על הכפתור למטה כדי להקים אחד ב-Render בחינם.
            </p>

            <div className="space-y-3">
              <div>
                <label className="label">כתובת שרת WAHA</label>
                <input
                  type="url"
                  value={wahaUrl}
                  onChange={(e) => setWahaUrl(e.target.value)}
                  className="input"
                  dir="ltr"
                  placeholder="http://localhost:3000"
                />
              </div>

              <div>
                <label className="label">API Key (אופציונלי)</label>
                <input
                  type="text"
                  value={wahaApiKey}
                  onChange={(e) => setWahaApiKey(e.target.value)}
                  className="input"
                  dir="ltr"
                  placeholder="WAHA_API_KEY (מהלוגים של WAHA)"
                />
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => wahaSaveMutation.mutate({ url: wahaUrl, apiKey: wahaApiKey })}
                  disabled={!wahaUrl || wahaSaveMutation.isPending}
                  className="btn-primary flex items-center gap-2"
                >
                  {wahaSaveMutation.isPending ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <Link className="w-4 h-4" />
                  )}
                  {wahaSaveMutation.isPending ? 'מתחבר...' : 'התחבר'}
                </button>
                <button onClick={() => setWahaStep('idle')} className="btn-secondary">
                  ביטול
                </button>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-green-200">
              <p className="text-xs text-green-800 font-medium mb-2">אין לך שרת WAHA? הקם אחד בחינם:</p>
              <a
                href="https://github.com/devlikeapro/waha"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-3 py-2 bg-purple-600 text-white rounded-lg text-sm hover:bg-purple-700 transition-colors"
              >
                <Server className="w-4 h-4" />
                Deploy WAHA Server (חינם)
                <ExternalLink className="w-3 h-3" />
              </a>
              <p className="text-xs text-green-600 mt-2">
                אחרי ההקמה, העתק את ה-URL של השרת והכנס אותו למעלה.
              </p>
            </div>
          </div>
        </div>
      );
    }

    // Idle - show connect button
    return (
      <div className="mt-4">
        <p className="text-sm text-gray-600 mb-3">
          חבר את WhatsApp שלך כדי לשלוח תזכורות משמרות, אישורי הזמנות ועוד ישירות מהמערכת.
        </p>
        <p className="text-xs text-gray-400 mb-3">
          משתמש ב-WAHA (WhatsApp HTTP API) - חינמי, בלי Meta Business
        </p>
        <button
          onClick={() => setWahaStep('url')}
          className="btn-primary flex items-center gap-2"
        >
          <MessageCircle className="w-4 h-4" />
          הגדר WhatsApp
        </button>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="page-header">
        <h1 className="page-title">הגדרות</h1>
        <p className="page-subtitle">ניהול אינטגרציות וחיבורים חיצוניים</p>
      </div>

      {/* Integrations Section */}
      <div className="grid gap-6">
        {/* Google Workspace */}
        <div className="card">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 bg-gradient-to-br from-red-100 to-red-50 rounded-xl flex items-center justify-center">
              <Mail className="w-6 h-6 text-red-600" />
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-gray-900 font-heading">Google Workspace</h3>
                  <p className="text-sm text-gray-500">Gmail, Calendar, Drive</p>
                </div>
                {settings?.google.connected ? (
                  <span className="badge badge-success flex items-center gap-1">
                    <Check className="w-3 h-3" />
                    מחובר
                  </span>
                ) : (
                  <span className="badge badge-gray flex items-center gap-1">
                    <X className="w-3 h-3" />
                    לא מחובר
                  </span>
                )}
              </div>

              {settings?.google.connected ? (
                <div className="mt-4 flex items-center justify-between">
                  <p className="text-sm text-gray-600">
                    מחובר כ: <span className="font-medium">{settings.google.email}</span>
                  </p>
                  <button
                    onClick={() => googleDisconnectMutation.mutate()}
                    disabled={googleDisconnectMutation.isPending}
                    className="btn-secondary text-red-600 hover:bg-red-50 flex items-center gap-2"
                  >
                    <Unlink className="w-4 h-4" />
                    נתק
                  </button>
                </div>
              ) : (
                <div className="mt-4 space-y-3">
                  <p className="text-sm text-gray-600">
                    חבר את חשבון Google שלך כדי לשלוח מיילים, לסנכרן יומן ולשמור מסמכים
                  </p>

                  {googleSetupNeeded && (
                    <div className="flex items-start gap-2 p-3 bg-amber-50 rounded-lg border border-amber-200">
                      <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
                      <p className="text-sm text-amber-800">
                        צריך להגדיר Google OAuth בשרת. לחץ על "מדריך הגדרה" למטה.
                      </p>
                    </div>
                  )}

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => googleConnectMutation.mutate()}
                      disabled={googleConnectMutation.isPending}
                      className="btn-primary flex items-center gap-2"
                    >
                      <Link className="w-4 h-4" />
                      {googleConnectMutation.isPending ? 'מתחבר...' : 'התחבר עם Google'}
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => setShowGoogleGuide(!showGoogleGuide)}
                    className="text-primary-600 hover:underline text-sm flex items-center gap-1"
                  >
                    {showGoogleGuide ? '▲ הסתר מדריך' : '▼ מדריך הגדרת Google OAuth'}
                  </button>

                  {showGoogleGuide && (
                    <div className="bg-red-50 rounded-lg p-4 text-sm space-y-2 border border-red-200">
                      <h4 className="font-bold text-red-900">מדריך הגדרת Google OAuth</h4>
                      <ol className="list-decimal list-inside space-y-1.5 text-red-800">
                        <li>
                          היכנס ל-
                          <a href="https://console.cloud.google.com" target="_blank" rel="noopener noreferrer" className="underline font-medium">Google Cloud Console</a>
                        </li>
                        <li>צור פרויקט חדש או בחר קיים</li>
                        <li>
                          הפעל את ה-APIs הבאים:
                          <ul className="list-disc list-inside mr-4 mt-1 space-y-0.5">
                            <li>Gmail API</li>
                            <li>Google Calendar API</li>
                            <li>Google Drive API</li>
                          </ul>
                        </li>
                        <li>
                          הגדר <span className="font-bold">OAuth consent screen</span>:
                          <ul className="list-disc list-inside mr-4 mt-1 space-y-0.5">
                            <li>User type: External</li>
                            <li>הוסף את המיילים שלך ל-<span className="font-bold">Test users</span></li>
                            <li>הוסף scopes: Gmail Send, Calendar, Drive Files</li>
                          </ul>
                        </li>
                        <li>
                          צור <span className="font-bold">OAuth 2.0 Client ID</span> (Credentials → Create → Web Application):
                          <ul className="list-disc list-inside mr-4 mt-1 space-y-0.5">
                            <li>Authorized redirect URI: <code className="bg-red-100 px-1 rounded text-xs" dir="ltr">https://crm-yahalom.onrender.com/api/integrations/google/callback</code></li>
                          </ul>
                        </li>
                        <li>העתק את <span className="font-bold">Client ID</span> ו-<span className="font-bold">Client Secret</span></li>
                        <li>
                          הגדר ב-Render (Environment Variables):
                          <ul className="list-disc list-inside mr-4 mt-1 space-y-0.5">
                            <li><code className="bg-red-100 px-1 rounded text-xs" dir="ltr">GOOGLE_CLIENT_ID=your-client-id</code></li>
                            <li><code className="bg-red-100 px-1 rounded text-xs" dir="ltr">GOOGLE_CLIENT_SECRET=your-client-secret</code></li>
                          </ul>
                        </li>
                      </ol>
                      <div className="mt-3 p-2 bg-red-100 rounded text-xs text-red-700">
                        <p className="font-bold">⚠️ חשוב:</p>
                        <p>כל עוד האפליקציה לא מאומתת (Testing), רק משתמשים שהוספת ל-Test users יוכלו להתחבר.</p>
                        <p>אם מופיע "הגישה חסומה" - ודא שהמייל שלך מופיע ב-Test users.</p>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* WhatsApp - WAHA */}
        <div className="card">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 bg-gradient-to-br from-green-100 to-green-50 rounded-xl flex items-center justify-center">
              <MessageCircle className="w-6 h-6 text-green-600" />
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-gray-900 font-heading">WhatsApp</h3>
                  <p className="text-sm text-gray-500">שליחת הודעות אוטומטיות</p>
                </div>
                {(wahaStep === 'connected' || settings?.whatsapp.connected) ? (
                  <span className="badge badge-success flex items-center gap-1">
                    <Check className="w-3 h-3" />
                    מחובר
                  </span>
                ) : wahaStep === 'qr' ? (
                  <span className="badge bg-yellow-100 text-yellow-800 flex items-center gap-1">
                    <QrCode className="w-3 h-3" />
                    ממתין לסריקה
                  </span>
                ) : (
                  <span className="badge badge-gray flex items-center gap-1">
                    <X className="w-3 h-3" />
                    לא מחובר
                  </span>
                )}
              </div>

              {renderWhatsAppContent()}
            </div>
          </div>
        </div>

        {/* Green Invoice */}
        <div className="card">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 bg-gradient-to-br from-blue-100 to-blue-50 rounded-xl flex items-center justify-center">
              <FileText className="w-6 h-6 text-blue-600" />
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-gray-900 font-heading">חשבונית ירוקה</h3>
                  <p className="text-sm text-gray-500">הפקת חשבוניות וקבלות</p>
                </div>
                {settings?.greenInvoice.connected ? (
                  <span className="badge badge-success flex items-center gap-1">
                    <Check className="w-3 h-3" />
                    מחובר
                  </span>
                ) : (
                  <span className="badge badge-gray flex items-center gap-1">
                    <X className="w-3 h-3" />
                    לא מחובר
                  </span>
                )}
              </div>

              {settings?.greenInvoice.connected && !showGreenInvoiceForm ? (
                <div className="mt-4 flex items-center justify-between">
                  <p className="text-sm text-gray-600">
                    עסק: <span className="font-medium">{settings.greenInvoice.businessName}</span>
                  </p>
                  <button
                    onClick={() => greenInvoiceDisconnectMutation.mutate()}
                    disabled={greenInvoiceDisconnectMutation.isPending}
                    className="btn-secondary text-red-600 hover:bg-red-50 flex items-center gap-2"
                  >
                    <Unlink className="w-4 h-4" />
                    נתק
                  </button>
                </div>
              ) : showGreenInvoiceForm ? (
                <form
                  onSubmit={greenInvoiceForm.handleSubmit((data) =>
                    greenInvoiceSaveMutation.mutate(data)
                  )}
                  className="mt-4 space-y-4"
                >
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                    <div>
                      <label className="label">API Key</label>
                      <input
                        {...greenInvoiceForm.register('apiKey', { required: true })}
                        className="input"
                        dir="ltr"
                      />
                    </div>
                    <div>
                      <label className="label">API Secret</label>
                      <input
                        {...greenInvoiceForm.register('apiSecret', { required: true })}
                        type="password"
                        className="input"
                        dir="ltr"
                      />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="submit"
                      disabled={greenInvoiceSaveMutation.isPending}
                      className="btn-primary"
                    >
                      {greenInvoiceSaveMutation.isPending ? 'מתחבר...' : 'התחבר'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowGreenInvoiceForm(false)}
                      className="btn-secondary"
                    >
                      ביטול
                    </button>
                  </div>
                  <p className="text-xs text-gray-500">
                    <a
                      href="https://www.greeninvoice.co.il/api-docs/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary-600 hover:underline flex items-center gap-1"
                    >
                      מדריך לקבלת מפתחות API
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </p>
                </form>
              ) : (
                <div className="mt-4">
                  <p className="text-sm text-gray-600 mb-3">
                    חבר את חשבונית ירוקה כדי להפיק חשבוניות וקבלות ישירות מהמערכת
                  </p>
                  <button
                    onClick={() => setShowGreenInvoiceForm(true)}
                    className="btn-primary flex items-center gap-2"
                  >
                    <Link className="w-4 h-4" />
                    הגדר חשבונית ירוקה
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Help Section */}
      <div className="card bg-gray-50">
        <h3 className="font-semibold text-gray-900 mb-2">צריך עזרה?</h3>
        <p className="text-sm text-gray-600 mb-4">
          למדריכים מפורטים על הגדרת האינטגרציות, פנה לתמיכה הטכנית או עיין בתיעוד.
        </p>
        <div className="flex gap-4">
          <a href="#" className="text-primary-600 text-sm hover:underline flex items-center gap-1">
            מדריך Google Workspace
            <ExternalLink className="w-3 h-3" />
          </a>
          <a href="https://waha.devlike.pro/" target="_blank" rel="noopener noreferrer" className="text-primary-600 text-sm hover:underline flex items-center gap-1">
            מדריך WhatsApp (WAHA)
            <ExternalLink className="w-3 h-3" />
          </a>
          <a href="#" className="text-primary-600 text-sm hover:underline flex items-center gap-1">
            מדריך חשבונית ירוקה
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </div>
    </div>
  );
}
