import { describe, it, expect } from 'vitest';
import { smartSearchMatch, calculateSearchScore, removeAccents } from '../searchUtils';

describe('Search Utilities Suite', () => {
  it('should remove accents and normalize text correctly', () => {
    expect(removeAccents('Keo 3X Bond')).toBe('Keo 3X Bond');
    expect(removeAccents('Tôn lợp 0.45mm')).toBe('Ton lop 0.45mm');
    expect(removeAccents('Đơn hàng #1234')).toBe('Don hang #1234');
  });

  it('should match products by partial query like "3x"', () => {
    expect(smartSearchMatch('Keo 3X Bond', '3x')).toBe(true);
    expect(smartSearchMatch(['Keo 3X Bond', 'SP001'], '3x')).toBe(true);
    expect(smartSearchMatch('Vít tôn 3x15', '3x')).toBe(true);
  });

  it('should support multi-word token matching regardless of word order', () => {
    expect(smartSearchMatch('Keo 3X Bond Siêu Dính', '3x keo')).toBe(true);
    expect(smartSearchMatch('Keo 3X Bond Siêu Dính', 'bond keo 3x')).toBe(true);
    expect(smartSearchMatch('Keo 3X Bond Siêu Dính', 'bond 3x')).toBe(true);
  });

  it('should match phone numbers ignoring spaces, dashes, and special characters', () => {
    expect(smartSearchMatch('090-123 4567', '0901234567')).toBe(true);
    expect(smartSearchMatch('090 123 4567', '090-123')).toBe(true);
    expect(smartSearchMatch('+84901234567', '0901234567')).toBe(true);
  });

  it('should match SKUs and order codes ignoring special characters', () => {
    expect(smartSearchMatch('SP-001/A', 'sp001a')).toBe(true);
    expect(smartSearchMatch('DH-2026-0012', 'dh0012')).toBe(true);
  });

  it('should correctly rank items by search score', () => {
    const p1 = { name: 'Keo 3X Bond', sku: 'K3X' };
    const p2 = { name: '3X Bond Premium', sku: '3XB' };
    const p3 = { name: 'Sơn chống thấm', note: 'dùng với 3x' };

    const score1 = calculateSearchScore(p1, '3x');
    const score2 = calculateSearchScore(p2, '3x');
    const score3 = calculateSearchScore(p3, '3x');

    expect(score2).toBeGreaterThan(score1); // Starts with 3X > Word 3X in name
    expect(score1).toBeGreaterThan(score3); // Name match > Note match
  });
});
