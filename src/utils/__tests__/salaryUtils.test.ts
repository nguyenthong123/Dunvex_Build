import { describe, it, expect } from 'vitest';
import {
  calculateDailyWage,
  calculateDaysWorked,
  calculateTotalSalary,
  calculateSalaryTable,
} from '../salaryUtils';

// ─── Helpers ────────────────────────────────────────
function ts(iso: string) {
  return { toDate: () => new Date(iso) };
}

// ─── calculateDailyWage ─────────────────────────────
describe('calculateDailyWage', () => {
  it('tính lương ngày từ lương tháng (26 ngày công)', () => {
    expect(calculateDailyWage(7_800_000)).toBe(300_000); // 7.8M / 26 = 300k
    expect(calculateDailyWage(13_000_000)).toBe(500_000); // 13M / 26 = 500k
  });

  it('trả về 0 nếu lương tháng = 0 hoặc âm', () => {
    expect(calculateDailyWage(0)).toBe(0);
    expect(calculateDailyWage(-100_000)).toBe(0);
  });

  it('hỗ trợ số ngày công tùy chỉnh', () => {
    expect(calculateDailyWage(5_200_000, 20)).toBe(260_000);
    expect(calculateDailyWage(7_800_000, 26)).toBe(300_000);
  });

  it('làm tròn đến đơn vị đồng', () => {
    expect(calculateDailyWage(10_000_000, 26)).toBe(384_615); // 10000000/26 = 384615.38... → 384615
    expect(calculateDailyWage(5_000_000, 26)).toBe(192_308); // 5000000/26 = 192307.69... → 192308
  });
});

// ─── calculateDaysWorked ────────────────────────────
describe('calculateDaysWorked', () => {
  it('đếm đúng số ngày duy nhất từ checkin', () => {
    const checkins = [
      { createdAt: ts('2026-08-01') },
      { createdAt: ts('2026-08-01') }, // trùng ngày
      { createdAt: ts('2026-08-02') },
      { createdAt: ts('2026-08-03') },
    ];
    expect(calculateDaysWorked(checkins, [])).toBe(3);
  });

  it('đếm cả checkin + attendance (loại bỏ request)', () => {
    const checkins = [
      { createdAt: ts('2026-08-01') },
    ];
    const attendance = [
      { createdAt: ts('2026-08-02'), type: 'checkin' },
      { createdAt: ts('2026-08-03'), type: 'checkout' },
      { createdAt: ts('2026-08-04'), type: 'request' }, // bỏ qua
    ];
    expect(calculateDaysWorked(checkins, attendance)).toBe(3);
  });

  it('trả về 0 nếu không có dữ liệu', () => {
    expect(calculateDaysWorked([], [])).toBe(0);
  });

  it('xử lý createdAt null/undefined', () => {
    const checkins = [
      { createdAt: ts('2026-08-01') },
      { createdAt: null },
    ];
    expect(calculateDaysWorked(checkins, [])).toBe(1);
  });
});

// ─── calculateTotalSalary ───────────────────────────
describe('calculateTotalSalary', () => {
  it('tính lương = ngày công × lương ngày', () => {
    expect(calculateTotalSalary(20, 300_000)).toBe(6_000_000);
    expect(calculateTotalSalary(26, 500_000)).toBe(13_000_000);
  });

  it('trả về 0 nếu không có ngày công', () => {
    expect(calculateTotalSalary(0, 300_000)).toBe(0);
  });
});

// ─── calculateSalaryTable ───────────────────────────
describe('calculateSalaryTable', () => {
  const users = [
    { id: 'u1', displayName: 'Anh A', email: 'a@test.com', role: 'sale', monthlyWage: 7_800_000 },
    { id: 'u2', displayName: 'Chị B', email: 'b@test.com', role: 'warehouse', monthlyWage: 5_200_000 },
    { id: 'u3', displayName: 'Anh C', email: 'c@test.com', role: 'sale', dailyWage: 250_000 }, // không có monthlyWage
  ];

  const checkins = [
    { userId: 'u1', createdAt: ts('2026-08-01') },
    { userId: 'u1', createdAt: ts('2026-08-02') },
    { userId: 'u2', createdAt: ts('2026-08-01') },
    { userId: 'u3', createdAt: ts('2026-08-01') },
    { userId: 'u3', createdAt: ts('2026-08-02') },
    { userId: 'u3', createdAt: ts('2026-08-03') },
  ];

  it('tính đúng bảng lương cho nhiều nhân viên', () => {
    const result = calculateSalaryTable(users, checkins, []);

    expect(result).toHaveLength(3);

    // Anh A: 2 ngày, lương tháng 7.8M → lương ngày 300k → 600k
    const a = result.find(r => r.userId === 'u1')!;
    expect(a.daysWorked).toBe(2);
    expect(a.dailyWage).toBe(300_000);
    expect(a.monthlyWage).toBe(7_800_000);
    expect(a.totalSalary).toBe(600_000);
    expect(a.name).toBe('Anh A');

    // Chị B: 1 ngày, lương tháng 5.2M → lương ngày 200k → 200k
    const b = result.find(r => r.userId === 'u2')!;
    expect(b.daysWorked).toBe(1);
    expect(b.dailyWage).toBe(200_000);
    expect(b.totalSalary).toBe(200_000);

    // Anh C: 3 ngày, không có lương tháng → fallback lương ngày 250k → 750k
    const c = result.find(r => r.userId === 'u3')!;
    expect(c.daysWorked).toBe(3);
    expect(c.monthlyWage).toBe(0);
    expect(c.dailyWage).toBe(250_000);
    expect(c.totalSalary).toBe(750_000);
  });

  it('xử lý nhân viên không có checkin nào', () => {
    const noCheckinUser = [{ id: 'u4', displayName: 'Người mới', email: 'new@test.com', monthlyWage: 10_000_000 }];
    const result = calculateSalaryTable(noCheckinUser, [], []);
    expect(result[0].daysWorked).toBe(0);
    expect(result[0].totalSalary).toBe(0);
  });

  it('dùng fallback name từ email nếu không có displayName', () => {
    const user = [{ id: 'u5', email: 'nam@test.com' }];
    const result = calculateSalaryTable(user, [], []);
    expect(result[0].name).toBe('nam');
  });
});
