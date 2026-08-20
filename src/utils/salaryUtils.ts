/**
 * Hàm tính lương thuần túy — không phụ thuộc Firebase/React
 * Dễ test, dễ tái sử dụng
 */

const DEFAULT_WORKING_DAYS = 26;

/** Tính lương ngày từ lương tháng */
export function calculateDailyWage(monthlyWage: number, workingDays: number = DEFAULT_WORKING_DAYS): number {
  if (monthlyWage <= 0) return 0;
  return Math.round(monthlyWage / workingDays);
}

/** Đếm số ngày làm việc duy nhất từ dữ liệu checkin + attendance */
export function calculateDaysWorked(
  checkins: Array<{ userId?: string; userEmail?: string; createdAt: any }>,
  attendance: Array<{ userId?: string; userEmail?: string; type?: string; createdAt: any }>
): number {
  const days = new Set<string>();

  checkins.forEach(c => {
    const date = extractDate(c.createdAt);
    if (date) days.add(date);
  });

  // Bỏ qua các request (nghỉ phép, đi muộn)
  attendance
    .filter(a => a.type !== 'request')
    .forEach(a => {
      const date = extractDate(a.createdAt);
      if (date) days.add(date);
    });

  return days.size;
}

/** Tính tổng lương thực lãnh */
export function calculateTotalSalary(daysWorked: number, dailyWage: number): number {
  return daysWorked * dailyWage;
}

/** Tính bảng lương cho danh sách nhân viên */
export function calculateSalaryTable(
  users: Array<{
    id: string;
    displayName?: string;
    email?: string;
    role?: string;
    monthlyWage?: number;
    dailyWage?: number;
  }>,
  allCheckins: Array<{ userId?: string; userEmail?: string; createdAt: any }>,
  allAttendance: Array<{ userId?: string; userEmail?: string; type?: string; createdAt: any }>,
  workingDays: number = DEFAULT_WORKING_DAYS
) {
  return users.map(user => {
    const userCheckins = allCheckins.filter(
      c => c.userId === user.id || c.userEmail === user.email
    );
    const userAttendance = allAttendance.filter(
      a => a.userId === user.id || a.userEmail === user.email
    );

    const daysWorked = calculateDaysWorked(userCheckins, userAttendance);
    const monthlyWage = Number(user.monthlyWage) || 0;
    const dailyWage = monthlyWage > 0
      ? calculateDailyWage(monthlyWage, workingDays)
      : (Number(user.dailyWage) || 0);

    return {
      userId: user.id,
      name: user.displayName || user.email?.split('@')[0] || 'N/A',
      email: user.email || '',
      role: user.role || '',
      checkinCount: userCheckins.length + userAttendance.filter(a => a.type !== 'request').length,
      daysWorked,
      monthlyWage,
      dailyWage,
      totalSalary: calculateTotalSalary(daysWorked, dailyWage),
    };
  });
}

/** Trích xuất ngày dạng YYYY-MM-DD từ Timestamp/Date */
function extractDate(v: any): string | null {
  if (!v) return null;
  try {
    const d = v.toDate ? v.toDate() : new Date(v);
    if (isNaN(d.getTime())) return null;
    return d.toISOString().slice(0, 10);
  } catch {
    return null;
  }
}
