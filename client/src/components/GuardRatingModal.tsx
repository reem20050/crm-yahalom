import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Star, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { performanceApi } from '../services/api';

interface GuardRatingModalProps {
  employeeId: string;
  employeeName: string;
  onClose: () => void;
}

const RATING_TYPES = [
  { value: 'manager', label: 'דירוג מנהל' },
  { value: 'client', label: 'דירוג לקוח' },
  { value: 'incident_handling', label: 'טיפול באירוע' },
];

const ratingLabels: Record<number, { text: string; color: string }> = {
  1: { text: 'גרוע', color: 'text-red-500' },
  2: { text: 'מתחת לממוצע', color: 'text-orange-500' },
  3: { text: 'סביר', color: 'text-yellow-500' },
  4: { text: 'טוב', color: 'text-blue-500' },
  5: { text: 'מצוין', color: 'text-green-500' },
};

export default function GuardRatingModal({ employeeId, employeeName, onClose }: GuardRatingModalProps) {
  const queryClient = useQueryClient();
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [ratingType, setRatingType] = useState('manager');
  const [shiftId, setShiftId] = useState('');
  const [comments, setComments] = useState('');

  const rateMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => performanceApi.rate(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['performance', employeeId] });
      queryClient.invalidateQueries({ queryKey: ['performance-rankings'] });
      toast.success('הדירוג נשמר בהצלחה');
      onClose();
    },
    onError: () => toast.error('שגיאה בשמירת דירוג'),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (rating === 0) {
      toast.error('נא לבחור דירוג');
      return;
    }
    rateMutation.mutate({
      employee_id: employeeId,
      rating_type: ratingType,
      rating,
      shift_id: shiftId || null,
      comments: comments || null,
    });
  };

  const activeRating = hoverRating || rating;

  return (
    <div className="modal-backdrop">
      <div className="modal-content max-w-md">
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-yellow-100 to-amber-50 flex items-center justify-center">
              <Star className="w-5 h-5 text-yellow-600" />
            </div>
            <h2 className="text-xl font-bold font-heading">דירוג מאבטח</h2>
          </div>
          <button onClick={onClose} className="btn-icon">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="text-center mb-2">
            <p className="text-lg font-semibold font-heading text-gray-900">{employeeName}</p>
          </div>

          <div>
            <label className="label">סוג דירוג *</label>
            <select
              value={ratingType}
              onChange={(e) => setRatingType(e.target.value)}
              className="input"
            >
              {RATING_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>

          {/* Star Rating */}
          <div>
            <label className="label">דירוג *</label>
            <div className="flex items-center justify-center gap-3 py-4">
              {[1, 2, 3, 4, 5].map((star) => {
                const isActive = star <= activeRating;
                return (
                  <button
                    key={star}
                    type="button"
                    onMouseEnter={() => setHoverRating(star)}
                    onMouseLeave={() => setHoverRating(0)}
                    onClick={() => setRating(star)}
                    className="transition-all duration-200 hover:scale-125 active:scale-95"
                  >
                    <Star
                      className={`w-10 h-10 transition-colors duration-150 ${
                        isActive
                          ? 'text-yellow-400 fill-yellow-400 drop-shadow-[0_0_6px_rgba(250,204,21,0.4)]'
                          : 'text-gray-200 hover:text-gray-300'
                      }`}
                    />
                  </button>
                );
              })}
            </div>
            {activeRating > 0 && (
              <p className={`text-center text-sm font-semibold font-heading ${ratingLabels[activeRating]?.color || 'text-gray-500'}`}>
                {ratingLabels[activeRating]?.text}
              </p>
            )}
          </div>

          <div>
            <label className="label">הערות</label>
            <textarea
              value={comments}
              onChange={(e) => setComments(e.target.value)}
              className="input min-h-[80px]"
              placeholder="הערות על הביצוע..."
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={rateMutation.isPending || rating === 0}
              className="btn-primary flex-1"
            >
              {rateMutation.isPending ? 'שומר...' : 'שמור דירוג'}
            </button>
            <button type="button" onClick={onClose} className="btn-ghost">
              ביטול
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
