import { describe, expect, it } from 'vitest';
import { fmtDate, fmtStamp, humanizeNotes, localIsoDate, paymentTermsLabel } from './display';

describe('fmtStamp', () => {
  it('חותמת זמן → 22/10/2026 בשעון מקומי (לא 22.10.2026)', () => {
    expect(fmtStamp(new Date(2026, 9, 22, 15, 29))).toBe('22/10/2026');
    expect(fmtStamp(new Date(2026, 9, 22, 15, 29).toISOString())).toBe('22/10/2026');
  });

  it('ריק / לא תקין', () => {
    expect(fmtStamp(null)).toBe('—');
    expect(fmtStamp('')).toBe('—');
    expect(fmtStamp('לא תאריך')).toBe('לא תאריך');
  });
});

describe('localIsoDate', () => {
  it('אחרי חצות — התאריך של היום, לא של אתמול (toISOString נותן את אתמול בשעון ישראל)', () => {
    expect(localIsoDate(new Date(2026, 9, 23, 1, 30))).toBe('2026-10-23');
  });

  it('ריפוד חודש ויום', () => {
    expect(localIsoDate(new Date(2026, 0, 5, 12, 0))).toBe('2026-01-05');
  });
});

describe('fmtDate', () => {
  it('"2026-10-21" → "21/10/2026"', () => {
    expect(fmtDate('2026-10-21')).toBe('21/10/2026');
    expect(fmtDate(null)).toBe('—');
  });
});

describe('paymentTermsLabel', () => {
  it('קודים מהייבוא ומהטפסים → עברית', () => {
    expect(paymentTermsLabel('eom')).toBe('שוטף');
    expect(paymentTermsLabel('eom10')).toBe('שוטף + 10');
    expect(paymentTermsLabel('net30')).toBe('שוטף + 30');
    expect(paymentTermsLabel('net15')).toBe('שוטף + 15');
    expect(paymentTermsLabel('immediate')).toBe('מיידי');
    expect(paymentTermsLabel(null)).toBe('-');
  });
});

describe('humanizeNotes', () => {
  it('הערת הייבוא בעברית', () => {
    expect(humanizeNotes('Imported from Green Invoice archive; documents=0')).toBe('יובא מארכיון חשבונית ירוקה; מסמכים: 0');
    expect(humanizeNotes('חמוש: True')).toBe('חמוש: כן');
  });
});
