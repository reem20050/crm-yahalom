import { useState, useRef, useEffect } from 'react';
import { MessageCircle, X, Send, ExternalLink } from 'lucide-react';

interface WhatsAppButtonProps {
  phone: string;
  name: string;
  size?: 'sm' | 'md';
  defaultMessage?: string;
}

function formatPhoneForWhatsApp(phone: string): string {
  if (!phone) return '';
  let formatted = phone.replace(/[^0-9]/g, '');
  if (formatted.startsWith('0')) {
    formatted = '972' + formatted.slice(1);
  }
  if (formatted.length === 9) {
    formatted = '972' + formatted;
  }
  return formatted;
}

function openWhatsApp(phone: string, message?: string): void {
  const formattedPhone = formatPhoneForWhatsApp(phone);
  if (!formattedPhone) return;
  let url = `https://wa.me/${formattedPhone}`;
  if (message) {
    url += `?text=${encodeURIComponent(message)}`;
  }
  window.open(url, '_blank');
}

export default function WhatsAppButton({ phone, name, size = 'md', defaultMessage }: WhatsAppButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [message, setMessage] = useState(defaultMessage || '');
  const popupRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Update message when defaultMessage changes
  useEffect(() => {
    if (defaultMessage) setMessage(defaultMessage);
  }, [defaultMessage]);

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
    openWhatsApp(phone, message);
    setIsOpen(false);
  };

  const handleOpenDirect = () => {
    openWhatsApp(phone);
    setIsOpen(false);
  };

  const iconSize = size === 'sm' ? 'w-4 h-4' : 'w-5 h-5';
  const buttonSize = size === 'sm' ? 'w-8 h-8' : 'w-10 h-10';

  if (!phone) return null;

  return (
    <div className="relative inline-block" ref={popupRef}>
      {/* WhatsApp Icon Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        title="שלח הודעת WhatsApp"
        className={`${buttonSize} flex items-center justify-center rounded-lg bg-gradient-to-br from-green-500 to-emerald-600 text-white hover:from-green-600 hover:to-emerald-700 shadow-sm hover:shadow-md transition-all duration-200`}
      >
        <MessageCircle className={iconSize} />
      </button>

      {/* Popup */}
      {isOpen && (
        <div
          className="absolute top-full left-0 mt-2 w-80 bg-white rounded-xl shadow-elevated border border-gray-200 z-50 overflow-hidden animate-slide-up"
          dir="rtl"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b bg-gradient-to-l from-green-50 to-emerald-50">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center">
                <MessageCircle className="w-3.5 h-3.5 text-white" />
              </div>
              <h3 className="text-sm font-semibold font-heading text-gray-900">
                שלח הודעה ל-{name}
              </h3>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="btn-icon w-7 h-7"
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
              className="input resize-none text-sm"
              dir="rtl"
            />
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 px-4 pb-4">
            <button
              onClick={handleSend}
              disabled={!message.trim()}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-green-500 to-emerald-600 rounded-lg hover:from-green-600 hover:to-emerald-700 shadow-sm hover:shadow-md transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Send className="w-4 h-4" />
              <span>שלח עם הודעה</span>
            </button>
            <button
              onClick={handleOpenDirect}
              className="btn-ghost flex items-center justify-center gap-2 px-4 py-2 text-sm"
            >
              <ExternalLink className="w-4 h-4" />
              <span>פתח צ'אט</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// Simple inline WhatsApp icon (for tables and compact views)
export function WhatsAppIcon({ phone, message, size = 14 }: { phone: string; message?: string; size?: number }) {
  if (!phone) return null;
  return (
    <button
      onClick={(e) => { e.stopPropagation(); openWhatsApp(phone, message); }}
      title="שלח WhatsApp"
      className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-gradient-to-br from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white shadow-sm transition-all duration-200"
    >
      <MessageCircle size={size} />
    </button>
  );
}

// Export utility for other components
export { openWhatsApp, formatPhoneForWhatsApp };
