import { describe, expect, it } from 'vitest';
import { explainValidation } from './validation';

describe('explainValidation', () => {
  it('הודעה בעברית מהשרת — כמו שהיא; הודעה באנגלית — שם השדה בעברית', () => {
    const d: Record<string, unknown> = {
      errors: [
        { path: 'first_name', msg: 'נדרש שם פרטי' },
        { path: 'email', msg: 'Invalid value' },
        { path: 'email', msg: 'Invalid value' },
      ],
    };
    explainValidation(d);
    expect(d.error).toBe('נדרש שם פרטי · השדה "אימייל" לא תקין');
    expect(d.message).toBe(d.error);
  });

  it('לא דורס error קיים, ולא נוגע בתשובה בלי errors', () => {
    const a = { error: 'כבר יש', errors: [{ path: 'phone', msg: 'Invalid value' }] };
    explainValidation(a);
    expect(a.error).toBe('כבר יש');
    const b: Record<string, unknown> = { foo: 1 };
    explainValidation(b);
    expect(b.error).toBeUndefined();
    explainValidation(undefined);
  });
});
