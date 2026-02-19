import { X } from 'lucide-react';

interface BulkAction {
  label: string;
  onClick: () => void;
  icon?: React.ReactNode;
  variant?: 'primary' | 'danger' | 'success' | 'secondary';
  disabled?: boolean;
  loading?: boolean;
}

interface BulkActionBarProps {
  selectedCount: number;
  onClear: () => void;
  actions: BulkAction[];
}

const variantClasses: Record<string, string> = {
  primary: 'bg-primary-500 hover:bg-primary-400 text-white rounded-xl transition-colors',
  danger: 'bg-red-500/90 hover:bg-red-400 text-white rounded-xl transition-colors',
  success: 'bg-emerald-500/90 hover:bg-emerald-400 text-white rounded-xl transition-colors',
  secondary: 'bg-white/10 hover:bg-white/20 text-white rounded-xl transition-colors',
};

export default function BulkActionBar({ selectedCount, onClear, actions }: BulkActionBarProps) {
  if (selectedCount === 0) return null;

  return (
    <div className="fixed bottom-[84px] lg:bottom-6 left-4 right-4 lg:left-auto lg:right-8 z-30 animate-bounce-in">
      <div className="bg-gradient-to-r from-gray-900 to-gray-800 text-white rounded-2xl shadow-2xl px-3.5 py-3 sm:px-5 sm:py-3.5 flex items-center gap-3 sm:gap-4 max-w-2xl mx-auto lg:mx-0">
        {/* Count */}
        <div className="flex items-center gap-2.5 flex-shrink-0">
          <span className="bg-gradient-to-r from-primary-500 to-primary-400 text-white text-sm font-bold w-7 h-7 rounded-lg flex items-center justify-center">
            {selectedCount}
          </span>
          <span className="text-sm text-gray-300">נבחרו</span>
        </div>

        {/* Divider */}
        <div className="w-px h-8 bg-gray-700" />

        {/* Actions */}
        <div className="flex items-center gap-2 flex-wrap">
          {actions.map((action, index) => (
            <button
              key={index}
              onClick={action.onClick}
              disabled={action.disabled || action.loading}
              className={`${variantClasses[action.variant || 'primary']} text-sm py-1.5 px-3.5 flex items-center gap-1.5 disabled:opacity-50`}
            >
              {action.icon}
              {action.label}
            </button>
          ))}
        </div>

        {/* Clear */}
        <button
          onClick={onClear}
          className="mr-auto flex-shrink-0 w-8 h-8 rounded-lg hover:bg-gray-700 flex items-center justify-center transition-colors"
          title="בטל בחירה"
        >
          <X className="w-4 h-4 text-gray-400" />
        </button>
      </div>
    </div>
  );
}
