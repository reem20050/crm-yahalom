import { type LucideIcon, Inbox } from 'lucide-react';

interface EmptyStateProps {
  icon?: LucideIcon;
  title?: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}

export default function EmptyState({
  icon: Icon = Inbox,
  title = 'אין נתונים',
  description = 'לא נמצאו תוצאות להצגה',
  action,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-3">
      <div className="w-14 h-14 rounded-2xl bg-gray-50 flex items-center justify-center">
        <Icon className="w-7 h-7 text-gray-300" />
      </div>
      <h3 className="text-base font-semibold text-gray-900">{title}</h3>
      <p className="text-sm text-gray-400 max-w-xs text-center">{description}</p>
      {action && (
        <button
          onClick={action.onClick}
          className="btn-primary mt-2"
        >
          {action.label}
        </button>
      )}
    </div>
  );
}
