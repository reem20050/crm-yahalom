import { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import {
  MessageCircle,
  Send,
  Clock,
  CheckCheck,
  AlertCircle,
  Bell,
  FileText,
  User,
  RefreshCw,
} from 'lucide-react';
import { integrationsApi } from '../services/api';

interface WhatsAppMessage {
  id: string;
  phone: string;
  direction: 'incoming' | 'outgoing';
  message: string;
  context: string;
  entity_type: string;
  entity_id: string;
  status: string;
  waha_message_id: string;
  created_at: string;
}

interface WhatsAppHistoryProps {
  entityType: 'employee' | 'customer';
  entityId: string;
  phone?: string;
  entityName?: string;
}

const contextLabels: Record<string, { label: string; icon: typeof Bell; color: string }> = {
  shift_reminder: { label: 'תזכורת משמרת', icon: Bell, color: 'bg-blue-100 text-blue-700' },
  invoice_reminder: { label: 'תזכורת חשבונית', icon: FileText, color: 'bg-orange-100 text-orange-700' },
  assignment_confirmation: { label: 'אישור שיבוץ', icon: CheckCheck, color: 'bg-green-100 text-green-700' },
  booking_confirmation: { label: 'אישור הזמנה', icon: CheckCheck, color: 'bg-green-100 text-green-700' },
  guard_arrival: { label: 'הגעת מאבטח', icon: User, color: 'bg-purple-100 text-purple-700' },
  incoming: { label: 'נכנסת', icon: MessageCircle, color: 'bg-gray-100 text-gray-700' },
  manual: { label: 'ידנית', icon: Send, color: 'bg-gray-100 text-gray-600' },
};

export default function WhatsAppHistory({ entityType, entityId, phone, entityName }: WhatsAppHistoryProps) {
  const [newMessage, setNewMessage] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['whatsapp-messages', entityType, entityId],
    queryFn: () => integrationsApi.getWhatsAppMessages({
      entityType,
      entityId,
      ...(phone ? { phone } : {}),
    }),
    refetchInterval: 10000, // Auto-refresh every 10s
  });

  const messages: WhatsAppMessage[] = data?.data?.messages || [];

  const sendMutation = useMutation({
    mutationFn: (message: string) =>
      integrationsApi.sendWhatsAppChat(phone || '', message, entityType, entityId),
    onSuccess: () => {
      setNewMessage('');
      toast.success('הודעה נשלחה');
      queryClient.invalidateQueries({ queryKey: ['whatsapp-messages', entityType, entityId] });
    },
    onError: () => {
      toast.error('שגיאה בשליחת הודעה');
    },
  });

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !phone) return;
    sendMutation.mutate(newMessage.trim());
  };

  const formatTime = (dateStr: string) => {
    const d = new Date(dateStr);
    const now = new Date();
    const isToday = d.toDateString() === now.toDateString();
    const time = d.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });
    if (isToday) return time;
    return `${d.toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit' })} ${time}`;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <RefreshCw className="w-6 h-6 animate-spin text-green-600" />
        <span className="mr-2 text-gray-500">טוען הודעות...</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full" style={{ minHeight: '400px', maxHeight: '600px' }}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-[#075E54] text-white rounded-t-lg">
        <div className="flex items-center gap-2">
          <MessageCircle className="w-5 h-5" />
          <span className="font-medium">{entityName || phone || 'WhatsApp'}</span>
        </div>
        <button onClick={() => refetch()} className="p-1 hover:bg-white/20 rounded">
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Messages area */}
      <div
        className="flex-1 overflow-y-auto px-4 py-3 space-y-2"
        style={{ background: '#ECE5DD', minHeight: '300px' }}
      >
        {messages.length === 0 ? (
          <div className="text-center text-gray-500 mt-10">
            <MessageCircle className="w-12 h-12 mx-auto mb-2 opacity-30" />
            <p>אין הודעות עדיין</p>
          </div>
        ) : (
          messages.map((msg) => {
            const isOutgoing = msg.direction === 'outgoing';
            const ctx = contextLabels[msg.context] || contextLabels.manual;
            const CtxIcon = ctx.icon;

            return (
              <div
                key={msg.id}
                className={`flex ${isOutgoing ? 'justify-start' : 'justify-end'}`}
              >
                <div
                  className={`max-w-[80%] rounded-lg px-3 py-2 shadow-sm ${
                    isOutgoing
                      ? 'bg-[#DCF8C6] rounded-tl-none'
                      : 'bg-white rounded-tr-none'
                  }`}
                >
                  {/* Context badge */}
                  {msg.context && msg.context !== 'manual' && msg.context !== 'incoming' && (
                    <div className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full mb-1 ${ctx.color}`}>
                      <CtxIcon className="w-3 h-3" />
                      {ctx.label}
                    </div>
                  )}

                  {/* Message text */}
                  <p className="text-sm whitespace-pre-wrap text-gray-900 leading-relaxed">{msg.message}</p>

                  {/* Time + status */}
                  <div className={`flex items-center gap-1 mt-1 ${isOutgoing ? 'justify-start' : 'justify-end'}`}>
                    <span className="text-[10px] text-gray-500">{formatTime(msg.created_at)}</span>
                    {isOutgoing && (
                      msg.status === 'failed' ? (
                        <AlertCircle className="w-3 h-3 text-red-500" />
                      ) : msg.status === 'read' ? (
                        <CheckCheck className="w-3 h-3 text-blue-500" />
                      ) : msg.status === 'delivered' ? (
                        <CheckCheck className="w-3 h-3 text-gray-400" />
                      ) : (
                        <Clock className="w-3 h-3 text-gray-400" />
                      )
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Send message input */}
      {phone ? (
        <form onSubmit={handleSend} className="flex items-center gap-2 px-3 py-2 bg-gray-100 rounded-b-lg border-t">
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="הקלד הודעה..."
            className="flex-1 px-3 py-2 rounded-full border border-gray-300 text-sm focus:outline-none focus:border-green-500"
            dir="rtl"
          />
          <button
            type="submit"
            disabled={!newMessage.trim() || sendMutation.isPending}
            className="p-2 bg-[#128C7E] text-white rounded-full hover:bg-[#075E54] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Send className="w-5 h-5" />
          </button>
        </form>
      ) : (
        <div className="text-center py-3 bg-gray-100 rounded-b-lg text-gray-500 text-sm border-t">
          אין מספר טלפון - לא ניתן לשלוח הודעות
        </div>
      )}
    </div>
  );
}
