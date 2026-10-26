import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../platform', () => ({
  isNativeApp: vi.fn(),
}));

vi.mock('../../services/apiClient', () => ({
  getCollection: vi.fn(),
}));

vi.mock('../dateUtils', () => ({
  formatDateVN: (d: any) => '26/10/2026',
}));

vi.mock('../../services/firebase', () => ({
  db: {},
  collection: vi.fn(),
  getDocs: vi.fn(),
  query: vi.fn(),
  where: vi.fn(),
  doc: vi.fn(),
  getDoc: vi.fn().mockResolvedValue({ exists: () => false }),
  setDoc: vi.fn(),
  addDoc: vi.fn(),
  serverTimestamp: vi.fn(),
}));

import { isNativeApp } from '../platform';
import { getCollection } from '../../services/apiClient';
import { exportLocalDataToExcel } from '../excelExport';

describe('Excel Data Export Suite (WEB-04)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should correctly format and export all business collections on Web', async () => {
    vi.mocked(isNativeApp).mockReturnValue(false);

    vi.mocked(getCollection).mockImplementation(async (colName: string) => {
      if (colName === 'customers') {
        return [
          {
            id: 'cust_1',
            name: 'Nguyễn Văn A',
            businessName: 'Cửa hàng Nhôm Kính',
            phone: 901234567, // numeric phone
            debt: 5000000,
            creditLimit: 10000000,
            ownerId: 'owner_1',
          },
        ];
      }
      if (colName === 'products') {
        return [
          {
            id: 'prod_1',
            name: 'Keo 3X Bond',
            sku: 'KEO3X',
            priceSell: 150000,
            priceImport: 100000,
            stock: 50,
            ownerId: 'owner_1',
          },
        ];
      }
      if (colName === 'orders') {
        return [
          {
            id: 'ord_1',
            order_code: 'DH001',
            customerName: 'Nguyễn Văn A',
            totalAmount: 300000,
            paidAmount: 100000,
            debtAmount: 200000,
            items: [
              { id: 'prod_1', name: 'Keo 3X Bond', qty: 2, price: 150000, buyPrice: 100000 }
            ],
            ownerId: 'owner_1',
          },
        ];
      }
      if (colName === 'debts') {
        return [
          {
            id: 'debt_1',
            customerId: 'cust_1',
            customerName: 'Nguyễn Văn A',
            type: 'debt_increase',
            amount: 200000,
            orderId: 'ord_1',
            ownerId: 'owner_1',
          },
        ];
      }
      return [];
    });

    const result = await exportLocalDataToExcel({
      ownerId: 'owner_1',
    });

    expect(result.totalRows).toBeGreaterThan(0);
    expect(result.fileName).toContain('.xlsx');
  });

  it('should throw an informative error when all collections fail to fetch on Web', async () => {
    vi.mocked(isNativeApp).mockReturnValue(false);
    vi.mocked(getCollection).mockRejectedValue(new Error('Unauthorized 401'));

    await expect(exportLocalDataToExcel({ ownerId: 'owner_1' }))
      .rejects
      .toThrow('Không thể tải dữ liệu từ máy chủ để xuất Excel');
  });
});
