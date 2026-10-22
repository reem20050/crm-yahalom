import { describe, expect, it } from 'vitest';
import { fmtDate, localIsoDate } from './display';

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
