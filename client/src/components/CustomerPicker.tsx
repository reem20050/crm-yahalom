/**
 * בחירת לקוח עם חיפוש — במקום רשימה נפתחת של 300 שמות בלי סינון.
 * תיבת חיפוש מעל ה-select מסננת לפי חלק מהשם; הלקוח שכבר נבחר נשאר ברשימה גם כשהוא לא תואם לחיפוש.
 * שני מצבים: נשלט (value + onChange) או react-hook-form (selectProps = register(...), value = watch(...)).
 */
import { useMemo, useState, type SelectHTMLAttributes } from 'react';

interface Customer { id: string; company_name: string }

export default function CustomerPicker({ customers, value, onChange, selectProps, placeholder = 'בחר לקוח...' }: {
  customers: Customer[] | undefined;
  value?: string;
  onChange?: (id: string) => void;
  selectProps?: SelectHTMLAttributes<HTMLSelectElement> & Record<string, unknown>;
  placeholder?: string;
}) {
  const [q, setQ] = useState('');
  const list = useMemo(() => {
    const all = customers ?? [];
    const n = q.trim();
    if (!n) return all;
    return all.filter((c) => (c.company_name || '').includes(n) || c.id === value);
  }, [customers, q, value]);

  const controlled = onChange
    ? { value: value ?? '', onChange: (e: { target: { value: string } }) => onChange(e.target.value) }
    : {};

  return (
    <div className="space-y-2">
      <input
        type="text"
        className="input"
        placeholder="חיפוש לקוח…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        aria-label="חיפוש לקוח"
      />
      <select className="input" {...selectProps} {...controlled}>
        <option value="">{q.trim() ? `${placeholder} (${list.length} תוצאות)` : placeholder}</option>
        {list.map((c) => (
          <option key={c.id} value={c.id}>{c.company_name}</option>
        ))}
      </select>
    </div>
  );
}
