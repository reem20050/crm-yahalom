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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-xl font-bold">דירוג מאבטח</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="text-center mb-2">
            <p className="text-lg font-medium text-gray-900">{employeeName}</p>
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
            <div className="flex items-center justify-center gap-2 py-3">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onMouseEnter={() => setHoverRating(star)}
                  onMouseLeave={() => setHoverRating(0)}
                  onClick={() => setRating(star)}
                  className="transition-transform hover:scale-110"
                >
                  <Star
                    className={`w-10 h-10 ${
                      star <= (hoverRating || rating)
                        ? 'text-yellow-400 fill-yellow-400'
                        : 'text-gray-300'
                    }`}
                  />
                </button>
              ))}
            </div>
            <p className="text-center text-sm text-gray-500">
              {rating === 1 && 'גרוע'}
              {rating === 2 && 'מתחת לממוצע'}
              {rating === 3 && 'סביר'}
              {rating === 4 && 'טוב'}
              {rating === 5 && 'מצוין'}
            </p>
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
            <button type="button" onClick={onClose} className="btn-secondary">
              ביטול
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
