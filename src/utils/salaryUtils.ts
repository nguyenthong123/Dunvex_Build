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

/** Đếm số ngày làm việc từ dữ liệu checkin + attendance tính chuẩn theo giờ và ca nửa ngày */
export function calculateDaysWorked(
  checkins: Array<{ userId?: string; userEmail?: string; createdAt: any }>,
  attendance: Array<{ userId?: string; userEmail?: string; type?: string; createdAt: any; checkInAt?: any; checkOutAt?: any; date?: any }>,
  marketPointsRequired: number = 1
): number {
  const dailyDetails: Record<string, { checkin?: any; attendances: any[] }> = {};

  checkins.forEach(c => {
    const date = extractDate(c.createdAt);
    if (date) {
      if (!dailyDetails[date]) dailyDetails[date] = { attendances: [] };
      dailyDetails[date].checkin = c;
    }
  });

  // Bỏ qua các request (nghỉ phép, đi muộn)
  attendance
    .filter(a => a.type !== 'request')
    .forEach(a => {
      const date = extractDate(a.date || a.createdAt || a.checkInAt);
      if (date) {
        if (!dailyDetails[date]) dailyDetails[date] = { attendances: [] };
        dailyDetails[date].attendances.push(a);
      }
    });

  const todayStr = new Date().toISOString().slice(0, 10);
  let daysWorked = 0;

  Object.keys(dailyDetails).forEach(day => {
    const dayData = dailyDetails[day];
    const officeCheckins = dayData.attendances.filter((a: any) => a.type !== 'customer' && a.type !== 'request');
    const marketCheckinsCount = (dayData.checkin ? 1 : 0) + dayData.attendances.filter((a: any) => a.type === 'customer').length;

    let officeFraction = 0;
    if (officeCheckins.length > 0) {
      const hasDetailedTime = officeCheckins.some((a: any) => a.checkInAt || a.checkOutAt);
      if (hasDetailedTime) {
        let totalWorkedMs = 0;
        officeCheckins.forEach((a: any) => {
          const inTime = toMs(a.checkInAt || a.createdAt);
          const outTime = toMs(a.checkOutAt);

          if (inTime) {
            if (outTime && outTime > inTime) {
              totalWorkedMs += (outTime - inTime);
            } else if (day === todayStr) {
              // Ca đang diễn ra trong ngày hôm nay
              const nowMs = Date.now();
              const currentMs = Math.max(0, nowMs - inTime);
              totalWorkedMs += currentMs;
            } else {
              // Ngày cũ quên check-out -> Tối đa 0.5 công (4 giờ)
              totalWorkedMs += 4 * 3600 * 1000;
            }
          }
        });

        const hours = totalWorkedMs / (1000 * 3600);
        if (hours >= 6.5) {
          officeFraction = 1.0;
        } else if (hours >= 3.5) {
          officeFraction = 0.5;
        } else if (hours > 0) {
          officeFraction = Math.min(0.5, Math.round((hours / 8) * 100) / 100);
        } else {
          officeFraction = 0.5;
        }
      } else {
        // Điểm danh thông thường (không có chia ca/giờ chi tiết) -> 1 ngày công
        officeFraction = 1.0;
      }
    }

    let marketFraction = 0;
    if (marketCheckinsCount > 0) {
      marketFraction = marketPointsRequired > 0 ? Math.min(1, marketCheckinsCount / marketPointsRequired) : 1;
    }

    const dayFraction = Math.max(officeFraction, marketFraction);
    daysWorked += dayFraction;
  });

  return Math.round(daysWorked * 100) / 100;
}

function toMs(val: any): number | null {
  if (!val) return null;
  if (typeof val === 'number') return val;
  if (val.seconds !== undefined) return val.seconds * 1000;
  if (val.toDate) return val.toDate().getTime();
  const d = new Date(val);
  return isNaN(d.getTime()) ? null : d.getTime();
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
    marketPointsRequired?: number;
  }>,
  allCheckins: Array<{ userId?: string; userEmail?: string; createdAt: any }>,
  allAttendance: Array<{ userId?: string; userEmail?: string; type?: string; createdAt: any }>,
  workingDays: number = DEFAULT_WORKING_DAYS,
  marketPointsRequired: number = 1
) {
  return users.map(user => {
    const userCheckins = allCheckins.filter(
      c => c.userId === user.id || c.userEmail === user.email
    );
    const userAttendance = allAttendance.filter(
      a => a.userId === user.id || a.userEmail === user.email
    );

    const userMarketPointsRequired = Number(user.marketPointsRequired) || marketPointsRequired || 1;
    const daysWorked = calculateDaysWorked(userCheckins, userAttendance, userMarketPointsRequired);
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
