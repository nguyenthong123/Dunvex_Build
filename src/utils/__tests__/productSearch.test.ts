import { describe, it, expect } from 'vitest';
import { normalizeVN, findMatchingProduct } from '../productSearch';

describe('normalizeVN', () => {
    it('bỏ dấu tiếng Việt', () => {
        expect(normalizeVN('Đá Ốp Lát')).toBe('daoplat');
    });

    it('lowercase', () => {
        expect(normalizeVN('SƠN JOTUN')).toBe('sonjotun');
    });

    it('bỏ dấu câu và khoảng trắng', () => {
        expect(normalizeVN('Keo A.200 - Xanh')).toBe('keoa200xanh');
    });

    it('xử lý chữ đ', () => {
        expect(normalizeVN('Đinh Vít')).toBe('dinhvit');
    });

    it('chuỗi rỗng trả về rỗng', () => {
        expect(normalizeVN('')).toBe('');
    });
});

describe('findMatchingProduct', () => {
    const products = [
        { name: 'Keo Chà Ron A200', category: 'Keo', priceSell: 50000 },
        { name: 'Sơn Jotun Majestic', category: 'Sơn', priceSell: 350000 },
        { name: 'Gạch Ốp Lát 60x60', category: 'Gạch', priceSell: 180000 },
        { name: 'Đinh Vít 3cm', category: 'Vật tư', priceSell: 5000 },
    ];

    it('khớp chính xác tên', () => {
        const result = findMatchingProduct('Keo Chà Ron A200', products);
        expect(result).not.toBeNull();
        expect(result!.name).toBe('Keo Chà Ron A200');
    });

    it('khớp tên + category', () => {
        const result = findMatchingProduct('Keo Chà Ron A200', products, 'Keo');
        expect(result).not.toBeNull();
        expect(result!.name).toBe('Keo Chà Ron A200');
    });

    it('khớp khi tên chứa search', () => {
        const result = findMatchingProduct('Sơn Jotun', products);
        expect(result).not.toBeNull();
        expect(result!.name).toBe('Sơn Jotun Majestic');
    });

    it('khớp không dấu', () => {
        const result = findMatchingProduct('gach op lat', products);
        expect(result).not.toBeNull();
        expect(result!.name).toBe('Gạch Ốp Lát 60x60');
    });

    it('trả null nếu không tìm thấy', () => {
        const result = findMatchingProduct('Xi Măng', products);
        expect(result).toBeNull();
    });

    it('trả null với danh sách rỗng', () => {
        const result = findMatchingProduct('ABC', []);
        expect(result).toBeNull();
    });
});
