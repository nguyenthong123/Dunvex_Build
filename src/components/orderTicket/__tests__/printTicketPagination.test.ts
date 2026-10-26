import { describe, it, expect } from 'vitest';
import { generateA4PrintHtml } from '../printTicket';

describe('A4 / A5 Multi-page Print Ticket Suite (WEB-02 & WEB-03)', () => {
  const baseOrder = {
    id: 'ord_test_12345678',
    order_code: 'DH123456',
    orderDate: '2026-10-26T08:00:00Z',
    customerName: 'Nguyễn Văn A',
    customerBusinessName: 'Cửa hàng Nhôm Kính Dunvex',
    customerPhone: '0901234567',
    subTotal: 10000000,
    discountValue: 500000,
    adjustmentValue: 100000,
    totalAmount: 9600000,
    note: 'Giao hàng buổi sáng trước 11h',
    status: 'Đơn chốt',
    totalWeight: 120,
    items: [
      { id: 'p1', name: 'Keo dán gạch Dunvex Pro 3X', qty: 10, price: 150000, unit: 'Bao', specification: '25kg/bao' },
      { id: 'p2', name: 'Tôn mạ màu 0.45mm hoa sen', qty: 20, price: 350000, unit: 'Tấm', specification: 'Dài 6m' },
    ],
  };

  const sampleCompany = {
    name: 'CÔNG TY TNHH VẬT LIỆU DUNVEX',
    address: '123 Đường Số 1, Lâm Đồng',
    phone: '0988765444',
    email: 'contact@dunvex.com',
  };

  it('should generate multi-page ready A4 HTML without single-page height constraints', () => {
    const html = generateA4PrintHtml(baseOrder, sampleCompany, [], 'Admin User', 'a4');

    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('size: A4 portrait');
    // Crucial: Must NOT contain the bug where max-height: 297mm forces everything onto one page
    expect(html).not.toContain('max-height: 297mm');
    expect(html).not.toContain('max-height: 210mm');
    expect(html).not.toContain('overflow: hidden');

    // Multi-page table features
    expect(html).toContain('display: table-header-group');
    expect(html).toContain('page-break-inside: avoid');

    // Order data
    expect(html).toContain('DH123456');
    expect(html).toContain('Cửa hàng Nhôm Kính Dunvex');
    expect(html).toContain('Keo dán gạch Dunvex Pro 3X');
    expect(html).toContain('Tôn mạ màu 0.45mm hoa sen');
  });

  it('should support A5 paper size with proper @page definition', () => {
    const html = generateA4PrintHtml(baseOrder, sampleCompany, [], 'Admin User', 'a5');

    expect(html).toContain('size: A5 portrait');
    expect(html).not.toContain('max-height: 210mm');
  });

  it('should naturally paginate orders with 60+ items without truncating any rows', () => {
    const largeItems = Array.from({ length: 65 }, (_, i) => ({
      id: `p_${i + 1}`,
      name: `Sản phẩm thứ ${i + 1} - Phụ kiện xây dựng công trình cao cấp`,
      qty: (i % 5) + 1,
      price: 100000 + i * 5000,
      unit: 'Cái',
      specification: `Quy cách loại ${i + 1}`,
      imageUrl: i % 2 === 0 ? `https://dunvex.com/uploads/images/img_${i}.jpg` : undefined,
    }));

    const largeOrder = {
      ...baseOrder,
      items: largeItems,
    };

    const html = generateA4PrintHtml(largeOrder, sampleCompany, [], 'Admin User', 'a4');

    // Verify all 65 rows exist in HTML
    for (let i = 1; i <= 65; i++) {
      expect(html).toContain(`Sản phẩm thứ ${i} - Phụ kiện xây dựng công trình cao cấp`);
    }

    // Verify fixed image cell dimension exists to prevent layout breaking (WEB-02)
    expect(html).toContain('width: 44px; height: 44px');
    expect(html).toContain('border-radius: 50%');
  });

  it('should render image fallback with product initials without shifting table layout', () => {
    const orderWithImage = {
      ...baseOrder,
      items: [
        { id: 'p1', name: 'Sơn Chống Thấm', qty: 2, price: 450000, imageUrl: 'https://dunvex.com/uploads/broken.jpg' },
        { id: 'p2', name: 'Đinh Vít', qty: 100, price: 500 },
      ],
    };

    const html = generateA4PrintHtml(orderWithImage, sampleCompany, [], 'Admin User', 'a4');

    expect(html).toContain('SƠ'); // Initials for "Sơn Chống Thấm"
    expect(html).toContain('width: 44px; height: 44px');
  });
});
