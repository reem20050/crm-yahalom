import { useState } from 'react';
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
} from 'lucide-react';
import api from '../services/api';

// Types
interface IntegrationSettings {
  google: {
    connected: boolean;
    email?: string;
  };
  whatsapp: {
    connected: boolean;
    phoneNumber?: string;
  };
  greenInvoice: {
    connected: boolean;
    businessName?: string;
  };
}

interface WhatsAppForm {
  phoneNumberId: string;
  accessToken: string;
  phoneDisplay: string;
}

interface GreenInvoiceForm {
  apiKey: string;
  apiSecret: string;
}

export default function Settings() {
  const queryClient = useQueryClient();
  const [showWhatsAppForm, setShowWhatsAppForm] = useState(false);
  const [showGreenInvoiceForm, setShowGreenInvoiceForm] = useState(false);
  const [testPhone, setTestPhone] = useState('');
  const [showWhatsAppGuide, setShowWhatsAppGuide] = useState(false);

  // Fetch integration settings
  const { data: settings, isLoading } = useQuery<IntegrationSettings>({
    queryKey: ['integrationSettings'],
    queryFn: async () => {
      const res = await api.get('/integrations/settings');
      return res.data;
    },
  });

  // WhatsApp form
  const whatsAppForm = useForm<WhatsAppForm>();

  // Green Invoice form
  const greenInvoiceForm = useForm<GreenInvoiceForm>();

  // Google connect mutation
  const googleConnectMutation = useMutation({
    mutationFn: async () => {
      const res = await api.get('/integrations/google/auth-url');
      return res.data.authUrl;
    },
    onSuccess: (authUrl) => {
      window.location.href = authUrl;
    },
    onError: () => {
      toast.error('שגיאה בהתחברות ל-Google');
    },
  });

  // Google disconnect mutation
  const googleDisconnectMutation = useMutation({
    mutationFn: () => api.post('/integrations/google/disconnect'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['integrationSettings'] });
      toast.success('Google נותק בהצלחה');
    },
  });

  // WhatsApp save mutation
  const whatsAppSaveMutation = useMutation({
    mutationFn: (data: WhatsAppForm) => api.post('/integrations/whatsapp/settings', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['integrationSettings'] });
      toast.success('WhatsApp הוגדר בהצלחה');
      setShowWhatsAppForm(false);
    },
    onError: () => {
      toast.error('שגיאה בשמירת הגדרות WhatsApp');
    },
  });

  // WhatsApp disconnect mutation
  const whatsAppDisconnectMutation = useMutation({
    mutationFn: () => api.post('/integrations/whatsapp/disconnect'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['integrationSettings'] });
      toast.success('WhatsApp נותק בהצלחה');
    },
  });

  // WhatsApp test mutation
  const whatsAppTestMutation = useMutation({
    mutationFn: (to: string) => api.post('/integrations/whatsapp/test', { to }),
    onSuccess: () => {
      toast.success('הודעת בדיקה נשלחה בהצלחה! ✅');
      setTestPhone('');
    },
    onError: (err: any) => {
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
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-4 border-primary-500 border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">הגדרות</h1>
        <p className="text-gray-500">ניהול אינטגרציות וחיבורים חיצוניים</p>
      </div>

      {/* Integrations Section */}
      <div className="grid gap-6">
        {/* Google Workspace */}
        <div className="card">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 bg-red-100 rounded-xl flex items-center justify-center">
              <Mail className="w-6 h-6 text-red-600" />
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-gray-900">Google Workspace</h3>
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
                <div className="mt-4">
                  <p className="text-sm text-gray-600 mb-3">
                    חבר את חשבון Google שלך כדי לשלוח מיילים, לסנכרן יומן ולשמור מסמכים
                  </p>
                  <button
                    onClick={() => googleConnectMutation.mutate()}
                    disabled={googleConnectMutation.isPending}
                    className="btn-primary flex items-center gap-2"
                  >
                    <Link className="w-4 h-4" />
                    התחבר עם Google
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* WhatsApp Business */}
        <div className="card">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
              <MessageCircle className="w-6 h-6 text-green-600" />
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-gray-900">WhatsApp Business</h3>
                  <p className="text-sm text-gray-500">שליחת הודעות אוטומטיות</p>
                </div>
                {settings?.whatsapp.connected ? (
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

              {settings?.whatsapp.connected && !showWhatsAppForm ? (
                <div className="mt-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-gray-600">
                      מספר: <span className="font-medium">{settings.whatsapp.phoneNumber}</span>
                    </p>
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
              ) : showWhatsAppForm ? (
                <form
                  onSubmit={whatsAppForm.handleSubmit((data) => whatsAppSaveMutation.mutate(data))}
                  className="mt-4 space-y-4"
                >
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="label">Phone Number ID</label>
                      <input
                        {...whatsAppForm.register('phoneNumberId', { required: true })}
                        className="input"
                        dir="ltr"
                        placeholder="מתוך Meta Business"
                      />
                    </div>
                    <div>
                      <label className="label">מספר להצגה</label>
                      <input
                        {...whatsAppForm.register('phoneDisplay')}
                        className="input"
                        dir="ltr"
                        placeholder="050-1234567"
                      />
                    </div>
                    <div className="col-span-2">
                      <label className="label">Access Token</label>
                      <input
                        {...whatsAppForm.register('accessToken', { required: true })}
                        type="password"
                        className="input"
                        dir="ltr"
                        placeholder="מתוך Meta Business"
                      />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="submit"
                      disabled={whatsAppSaveMutation.isPending}
                      className="btn-primary"
                    >
                      {whatsAppSaveMutation.isPending ? 'שומר...' : 'שמור'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowWhatsAppForm(false)}
                      className="btn-secondary"
                    >
                      ביטול
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowWhatsAppGuide(!showWhatsAppGuide)}
                    className="text-primary-600 hover:underline text-sm flex items-center gap-1"
                  >
                    {showWhatsAppGuide ? '▲ הסתר מדריך' : '▼ איך להשיג את הפרטים?'}
                  </button>
                  {showWhatsAppGuide && (
                    <div className="bg-blue-50 rounded-lg p-4 text-sm space-y-2 border border-blue-200">
                      <h4 className="font-bold text-blue-900">מדריך הגדרת WhatsApp Business API</h4>
                      <ol className="list-decimal list-inside space-y-1 text-blue-800">
                        <li>
                          היכנס ל-
                          <a href="https://business.facebook.com" target="_blank" rel="noopener noreferrer" className="underline font-medium">Meta Business Suite</a>
                          {' '}עם חשבון הפייסבוק שלך
                        </li>
                        <li>
                          ודא שיש לך WhatsApp Business Account (אם אין - צור חדש דרך ההגדרות)
                        </li>
                        <li>
                          היכנס ל-
                          <a href="https://developers.facebook.com" target="_blank" rel="noopener noreferrer" className="underline font-medium">Meta Developer Console</a>
                        </li>
                        <li>לחץ על <span className="font-bold">"Create App"</span> → בחר סוג <span className="font-bold">"Business"</span></li>
                        <li>הוסף את מוצר <span className="font-bold">"WhatsApp"</span> לאפליקציה (לחץ "Set up")</li>
                        <li>
                          בתפריט WhatsApp → API Setup:
                          <ul className="list-disc list-inside mr-4 mt-1 space-y-0.5">
                            <li>העתק את <span className="font-bold">Phone Number ID</span> (מספר ארוך)</li>
                            <li>לחץ <span className="font-bold">"Generate"</span> ליצירת Access Token זמני (24 שעות)</li>
                            <li>ל-Token קבוע: System Users → Generate Token עם הרשאות whatsapp_business_messaging</li>
                          </ul>
                        </li>
                        <li>הכנס את הפרטים למעלה ולחץ "שמור"</li>
                      </ol>
                      <p className="text-xs text-blue-600 mt-2">
                        💡 מומלץ ליצור Token קבוע (System User) כדי שלא יפוג כל 24 שעות
                      </p>
                    </div>
                  )}
                </form>
              ) : (
                <div className="mt-4">
                  <p className="text-sm text-gray-600 mb-3">
                    חבר את WhatsApp Business כדי לשלוח תזכורות משמרות, אישורי הזמנות ועוד
                  </p>
                  <button
                    onClick={() => setShowWhatsAppForm(true)}
                    className="btn-primary flex items-center gap-2"
                  >
                    <Link className="w-4 h-4" />
                    הגדר WhatsApp
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Green Invoice */}
        <div className="card">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
              <FileText className="w-6 h-6 text-blue-600" />
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-gray-900">חשבונית ירוקה</h3>
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
                  <div className="grid grid-cols-2 gap-4">
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
          <a href="#" className="text-primary-600 text-sm hover:underline flex items-center gap-1">
            מדריך WhatsApp Business
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
