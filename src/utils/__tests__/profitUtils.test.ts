import { describe, it, expect } from 'vitest';
import { shouldExcludeFromProfit } from '../profitUtils';

describe('shouldExcludeFromProfit', () => {
    it('loại khi excludeProfit = true', () => {
        expect(shouldExcludeFromProfit('Sơn Jotun', true)).toBe(true);
    });

    it('loại khi tên chứa "ứng tiền"', () => {
        expect(shouldExcludeFromProfit('Thợ ứng tiền', false)).toBe(true);
    });

    it('loại khi tên chứa "tạm ứng"', () => {
        expect(shouldExcludeFromProfit('Tạm ứng công thợ', false)).toBe(true);
    });

    it('loại khi tên chứa "ứng trước"', () => {
        expect(shouldExcludeFromProfit('Ứng trước vật tư', false)).toBe(true);
    });

    it('loại không phân biệt hoa thường', () => {
        expect(shouldExcludeFromProfit('ỨNG TIỀN CÔNG THỢ', false)).toBe(true);
    });

    it('giữ lại sản phẩm bình thường', () => {
        expect(shouldExcludeFromProfit('Keo Chà Ron', false)).toBe(false);
    });

    it('giữ lại tên rỗng', () => {
        expect(shouldExcludeFromProfit('', false)).toBe(false);
    });

    it('giữ lại tên undefined', () => {
        expect(shouldExcludeFromProfit(undefined as unknown as string, false)).toBe(false);
    });
});
