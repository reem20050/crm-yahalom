/**
 * "קישור לטופס" במסך הלידים: בונה קישור ל-/join עם מקור וקמפיין (utm), להעתקה לפרסום / לאתר / לוואטסאפ.
 * כל ליד שנכנס מהקישור נשמר עם המקור — כך רואים איזה פרסום הביא לידים.
 */
import { useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { Copy, ExternalLink, Link2, X } from 'lucide-react';

const SOURCES: [string, string][] = [
  ['facebook', 'פייסבוק'], ['instagram', 'אינסטגרם'], ['google', 'גוגל'],
  ['whatsapp', 'וואטסאפ'], ['website', 'אתר החברה'], ['referral', 'המלצה'],
];

export default function LeadFormLink() {
  const [open, setOpen] = useState(false);
  const [source, setSource] = useState('facebook');
  const [campaign, setCampaign] = useState('');
  const link = useMemo(() => {
    const u = new URL('/join', window.location.origin);
    u.searchParams.set('utm_source', source);
    const c = campaign.trim().replace(/\s+/g, '-');
    if (c) u.searchParams.set('utm_campaign', c);
    return u.toString();
  }, [source, campaign]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      toast.success('הקישור הועתק');
    } catch {
      toast.error('לא הצלחתי להעתיק — סמנו והעתיקו ידנית');
    }
  };

  return (
    <>
      <button onClick={() => setOpen(true)} className="btn-secondary flex items-center gap-2">
        <Link2 className="w-5 h-5" />
        קישור לטופס
      </button>
      {open && (
        <div className="modal-backdrop" onClick={() => setOpen(false)}>
          <div className="modal-content max-w-lg" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b">
              <h2 className="text-lg font-bold">קישור לטופס הפנייה</h2>
              <button onClick={() => setOpen(false)} className="p-2 hover:bg-gray-100 rounded-lg" aria-label="סגירה">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <p className="text-sm text-gray-600">
                שימו את הקישור בפרסום, באתר או בוואטסאפ. כל פנייה נכנסת ללידים עם המקור והקמפיין — ומנהלים מקבלים התראה.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="label" htmlFor="lf-source">איפה הקישור יופיע?</label>
                  <select id="lf-source" className="input" value={source} onChange={(e) => setSource(e.target.value)}>
                    {SOURCES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label" htmlFor="lf-campaign">שם הקמפיין (לא חובה)</label>
                  <input id="lf-campaign" className="input" value={campaign} onChange={(e) => setCampaign(e.target.value)}
                    placeholder="למשל: אירועי-קיץ" />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <input readOnly dir="ltr" className="input text-xs flex-1" value={link} onFocus={(e) => e.target.select()} />
                <button onClick={copy} className="btn-primary px-3 py-2 flex items-center gap-1 shrink-0">
                  <Copy className="w-4 h-4" /> העתקה
                </button>
              </div>
              <a href={link} target="_blank" rel="noopener noreferrer" className="text-sm text-primary-600 hover:underline inline-flex items-center gap-1">
                <ExternalLink className="w-4 h-4" /> לראות את הטופס
              </a>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
