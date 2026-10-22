/**
 * חלון אישור בעיצוב המערכת — במקום confirm() של הדפדפן.
 * שימוש: if (await confirmDialog('למחוק?')) { ... }
 * Enter = אישור, Escape או לחיצה מחוץ לחלון = ביטול.
 */
import { useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { AlertTriangle } from 'lucide-react';

function ConfirmBox({ message, onDone }: { message: string; onDone: (ok: boolean) => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onDone(false);
      if (e.key === 'Enter') onDone(true);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onDone]);

  return (
    <div className="modal-backdrop" onClick={() => onDone(false)} dir="rtl">
      <div className="modal-content max-w-sm" role="alertdialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <div className="p-5 flex items-start gap-3">
          <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center shrink-0">
            <AlertTriangle className="w-5 h-5 text-red-600" />
          </div>
          <p className="text-gray-800 pt-2">{message}</p>
        </div>
        <div className="flex justify-end gap-2 px-5 pb-5">
          <button className="btn-secondary" onClick={() => onDone(false)}>ביטול</button>
          <button className="btn-danger" autoFocus onClick={() => onDone(true)}>מחיקה</button>
        </div>
      </div>
    </div>
  );
}

export function confirmDialog(message: string): Promise<boolean> {
  return new Promise((resolve) => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = createRoot(host);
    const done = (ok: boolean) => {
      root.unmount();
      host.remove();
      resolve(ok);
    };
    root.render(<ConfirmBox message={message} onDone={done} />);
  });
}
