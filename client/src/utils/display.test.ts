import { describe, expect, it } from 'vitest';
import { fmtDate, fmtStamp, localIsoDate } from './display';

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
