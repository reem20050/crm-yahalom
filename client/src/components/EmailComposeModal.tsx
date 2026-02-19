import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { X, Mail, Send, FileText, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { integrationsApi } from '../services/api';

interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  body: string;
  category: string;
  variables: string;
}

interface EmailComposeModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultTo?: string;
  defaultName?: string;
  entityType?: string;
  entityId?: string;
}

export default function EmailComposeModal({
  isOpen,
  onClose,
  defaultTo = '',
  defaultName = '',
}: EmailComposeModalProps) {
  const [to, setTo] = useState(defaultTo);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const queryClient = useQueryClient();

  // Load email templates
  const { data: templatesData } = useQuery({
    queryKey: ['email-templates'],
    queryFn: () => integrationsApi.getEmailTemplates().then((res) => res.data),
    enabled: isOpen,
  });

  const templates: EmailTemplate[] = templatesData?.templates ?? [];

  // Send email mutation
  const sendMutation = useMutation({
    mutationFn: () => integrationsApi.sendEmail(to, subject, body),
    onSuccess: () => {
      toast.success('אימייל נשלח בהצלחה');
      queryClient.invalidateQueries({ queryKey: ['activity-logs'] });
      handleClose();
    },
    onError: (err: unknown) => {
      const error = err as { response?: { data?: { message?: string } } };
      toast.error(error.response?.data?.message || 'שגיאה בשליחת אימייל');
    },
  });

  const handleClose = () => {
    setTo(defaultTo);
    setSubject('');
    setBody('');
    onClose();
  };

  const handleTemplateSelect = (templateId: string) => {
    const template = templates.find((t) => t.id === templateId);
    if (!template) return;

    let processedSubject = template.subject;
    let processedBody = template.body;

    // Replace common variables
    if (defaultName) {
      processedSubject = processedSubject.replace(/\{customer_name\}/g, defaultName);
      processedBody = processedBody.replace(/\{customer_name\}/g, defaultName);
      processedSubject = processedSubject.replace(/\{employee_name\}/g, defaultName);
      processedBody = processedBody.replace(/\{employee_name\}/g, defaultName);
    }

    setSubject(processedSubject);
    setBody(processedBody);
  };

  const handleSend = () => {
    if (!to || !to.includes('@')) {
      toast.error('נדרשת כתובת אימייל תקינה');
      return;
    }
    if (!subject.trim()) {
      toast.error('נדרש נושא');
      return;
    }
    if (!body.trim()) {
      toast.error('נדרש תוכן ההודעה');
      return;
    }
    sendMutation.mutate();
  };

  if (!isOpen) return null;

  return (
    <div className="modal-backdrop">
      <div className="modal-content max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-100 to-blue-50 flex items-center justify-center">
              <Mail className="w-5 h-5 text-blue-600" />
            </div>
            <h2 className="text-xl font-bold font-heading">שליחת אימייל</h2>
          </div>
          <button
            onClick={handleClose}
            className="btn-icon"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4">
          {/* Template selector */}
          {templates.length > 0 && (
            <div>
              <label className="label flex items-center gap-2">
                <FileText className="w-4 h-4" />
                תבנית
              </label>
              <select
                onChange={(e) => handleTemplateSelect(e.target.value)}
                className="input"
                defaultValue=""
              >
                <option value="">בחר תבנית (אופציונלי)...</option>
                {templates.map((template) => (
                  <option key={template.id} value={template.id}>
                    {template.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* To */}
          <div>
            <label className="label">נמען *</label>
            <input
              type="email"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="input"
              dir="ltr"
              placeholder="email@example.com"
            />
          </div>

          {/* Subject */}
          <div>
            <label className="label">נושא *</label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="input"
              placeholder="נושא האימייל..."
            />
          </div>

          {/* Body */}
          <div>
            <label className="label">תוכן ההודעה *</label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              className="input min-h-[200px]"
              placeholder="כתוב את ההודעה כאן..."
            />
            <p className="text-xs text-gray-400 mt-1">ניתן להשתמש ב-HTML לעיצוב</p>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4">
            <button
              onClick={handleSend}
              disabled={sendMutation.isPending}
              className="btn-primary flex-1 flex items-center justify-center gap-2"
            >
              {sendMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  שולח...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  שלח אימייל
                </>
              )}
            </button>
            <button
              onClick={handleClose}
              className="btn-ghost"
            >
              ביטול
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
