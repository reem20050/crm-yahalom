import { AlertTriangle, RefreshCw } from 'lucide-react';

interface ErrorStateProps {
  message?: string;
  onRetry?: () => void;
}

export default function ErrorState({
  message = 'אירעה שגיאה בטעינת הנתונים',
  onRetry,
}: ErrorStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-3">
      <div className="w-14 h-14 rounded-2xl bg-red-50 flex items-center justify-center">
        <AlertTriangle className="w-7 h-7 text-red-400" />
      </div>
      <h3 className="text-base font-semibold text-gray-900">שגיאה</h3>
      <p className="text-sm text-gray-400 max-w-xs text-center">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="btn-secondary flex items-center gap-2 mt-2"
        >
          <RefreshCw className="w-4 h-4" />
          נסה שוב
        </button>
      )}
    </div>
  );
}
