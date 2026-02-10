import { useState, useRef, useEffect } from 'react';
import { useMutation } from '@tanstack/react-query';
import { MessageCircle, X, Send, ExternalLink, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { integrationsApi } from '../services/api';

interface WhatsAppButtonProps {
  phone: string;
  name: string;
  size?: 'sm' | 'md';
}

function cleanPhone(phone: string): string {
  return phone.replace(/[\s\-+]/g, '');
}

export default function WhatsAppButton({ phone, name, size = 'md' }: WhatsAppButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [message, setMessage] = useState('');
  const popupRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const sendMutation = useMutation({
    mutationFn: () => integrationsApi.sendWhatsApp(phone, message),
    onSuccess: () => {
      toast.success('ההודעה נשלחה בהצלחה');
      setMessage('');
      setIsOpen(false);
    },
    onError: () => {
      toast.error('שגיאה בשליחת ההודעה');
    },
  });

  // Focus textarea when popup opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => textareaRef.current?.focus(), 50);
    }
  }, [isOpen]);

  // Click outside to close
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (popupRef.current && !popupRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
    }, 0);

    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  const handleSend = () => {
    if (!message.trim()) return;
    sendMutation.mutate();
  };

  const handleOpenWhatsAppWeb = () => {
    const cleaned = cleanPhone(phone);
    window.open(`https://wa.me/${cleaned}`, '_blank');
  };

  const iconSize = size === 'sm' ? 'w-4 h-4' : 'w-5 h-5';
  const buttonSize = size === 'sm' ? 'w-8 h-8' : 'w-10 h-10';

  return (
    <div className="relative inline-block" ref={popupRef}>
      {/* WhatsApp Icon Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        title="שלח הודעת WhatsApp"
        className={`${buttonSize} flex items-center justify-center rounded-lg bg-green-50 text-green-600 hover:bg-green-100 hover:text-green-700 transition-colors`}
      >
        <MessageCircle className={iconSize} />
      </button>

      {/* Popup */}
      {isOpen && (
        <div
          className="absolute top-full left-0 mt-2 w-80 bg-white rounded-xl shadow-2xl border border-gray-200 z-50 overflow-hidden"
          dir="rtl"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b bg-green-50">
            <div className="flex items-center gap-2">
              <MessageCircle className="w-4 h-4 text-green-600" />
              <h3 className="text-sm font-semibold text-gray-900">
                שלח הודעה ל-{name}
              </h3>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="p-1 rounded-lg hover:bg-green-100 transition-colors"
            >
              <X className="w-4 h-4 text-gray-400" />
            </button>
          </div>

          {/* Body */}
          <div className="p-4">
            <textarea
              ref={textareaRef}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="כתוב הודעה..."
              rows={4}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent placeholder-gray-400"
              dir="rtl"
            />
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 px-4 pb-4">
            <button
              onClick={handleSend}
              disabled={sendMutation.isPending || !message.trim()}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {sendMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
              <span>שלח</span>
            </button>
            <button
              onClick={handleOpenWhatsAppWeb}
              className="flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
            >
              <ExternalLink className="w-4 h-4" />
              <span>פתח ב-WhatsApp Web</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
