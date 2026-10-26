import { describe, it, expect } from 'vitest';
import { normalizePhoneDisplay, getZaloPhoneDigits } from '../validation';

describe('Customer Phone Normalization & Safe Zalo Linking (WEB-01)', () => {
  it('should preserve valid phone strings', () => {
    expect(normalizePhoneDisplay('0901234567')).toBe('0901234567');
    expect(normalizePhoneDisplay(' 0988 765 444 ')).toBe('0988 765 444');
    expect(normalizePhoneDisplay('+84901234567')).toBe('+84901234567');
  });

  it('should safely convert finite numbers to strings without crashing', () => {
    expect(normalizePhoneDisplay(901234567)).toBe('901234567');
    expect(normalizePhoneDisplay(988765444)).toBe('988765444');
    expect(normalizePhoneDisplay(0)).toBe('0');
  });

  it('should return empty string for null, undefined, booleans, objects, arrays, NaN, and Infinity', () => {
    expect(normalizePhoneDisplay(null)).toBe('');
    expect(normalizePhoneDisplay(undefined)).toBe('');
    expect(normalizePhoneDisplay(true)).toBe('');
    expect(normalizePhoneDisplay(false)).toBe('');
    expect(normalizePhoneDisplay(NaN)).toBe('');
    expect(normalizePhoneDisplay(Infinity)).toBe('');
    expect(normalizePhoneDisplay({})).toBe('');
    expect(normalizePhoneDisplay([])).toBe('');
    expect(normalizePhoneDisplay({ phone: '123' })).toBe('');
  });

  it('should extract digits for Zalo links correctly', () => {
    expect(getZaloPhoneDigits('090-123-4567')).toBe('0901234567');
    expect(getZaloPhoneDigits('090.123.4567')).toBe('0901234567');
    expect(getZaloPhoneDigits(901234567)).toBe('901234567');
    expect(getZaloPhoneDigits('+84901234567')).toBe('84901234567');
  });

  it('should return empty digits for invalid or non-numeric phones', () => {
    expect(getZaloPhoneDigits(null)).toBe('');
    expect(getZaloPhoneDigits(undefined)).toBe('');
    expect(getZaloPhoneDigits(true)).toBe('');
    expect(getZaloPhoneDigits({})).toBe('');
    expect(getZaloPhoneDigits('Chưa có SĐT')).toBe('');
  });

  it('should never throw when calling replace on extracted phone digits', () => {
    const rawPhones: any[] = [
      '0901234567',
      901234567,
      0,
      null,
      undefined,
      false,
      true,
      {},
      [],
      NaN,
      Infinity,
      'abc'
    ];

    for (const rawPhone of rawPhones) {
      expect(() => {
        const phoneStr = normalizePhoneDisplay(rawPhone);
        const zaloDigits = getZaloPhoneDigits(rawPhone);
        // Verify .replace works on phoneStr and zaloDigits because both are guaranteed strings
        phoneStr.replace(/\D/g, '');
        zaloDigits.replace(/\D/g, '');
      }).not.toThrow();
    }
  });
});
