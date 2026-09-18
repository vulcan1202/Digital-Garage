import { RecurringExpenseCategory, SmartPreFillResult } from '../../types/recurringExpense';

/**
 * 判斷是否為閏年
 */
export function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

/**
 * 取得指定年月的天數（1-indexed month: 1 ~ 12）
 */
export function daysInMonth(year: number, month: number): number {
  switch (month) {
    case 1:
    case 3:
    case 5:
    case 7:
    case 8:
    case 10:
    case 12:
      return 31;
    case 4:
    case 6:
    case 9:
    case 11:
      return 30;
    case 2:
      return isLeapYear(year) ? 29 : 28;
    default:
      return 30;
  }
}

/**
 * 日期加減月份並落實 Clamping 防溢位
 * clampedDay = min(day, daysInMonth(targetYear, targetMonth))
 */
export function addMonthsClamped(
  year: number,
  month: number,
  day: number,
  deltaMonths: number
): { year: number; month: number; day: number } {
  // 將月份轉為 0-indexed 累計月數以安全處理跨年加減
  const totalMonths = year * 12 + (month - 1) + deltaMonths;
  const targetYear = Math.floor(totalMonths / 12);
  const targetMonth = ((totalMonths % 12) + 12) % 12 + 1; // 1 ~ 12

  const maxDay = daysInMonth(targetYear, targetMonth);
  const clampedDay = Math.min(day, maxDay);

  return { year: targetYear, month: targetMonth, day: clampedDay };
}

/**
 * 格式化為 YYYY-MM-DD 字串
 */
export function formatYMD(year: number, month: number, day: number): string {
  const mStr = String(month).padStart(2, '0');
  const dStr = String(day).padStart(2, '0');
  return `${year}-${mStr}-${dStr}`;
}

export function parseYMD(dateStr: string): { year: number; month: number; day: number } | null {
  const parts = dateStr.split('-');
  if (parts.length !== 3) return null;
  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10);
  const day = parseInt(parts[2], 10);
  if (isNaN(year) || isNaN(month) || isNaN(day)) return null;
  return { year, month, day };
}

/**
 * 依車輛規格與自訂今日時間，取得台灣監理智慧預填資料
 */
export function getSmartPreFill(
  category: RecurringExpenseCategory,
  vehicle: {
    year?: number | null;
    manufacture_date?: string | null;
    vehicle_type: string;
    engine_displacement_cc?: number | null;
  },
  today: Date = new Date()
): SmartPreFillResult {
  const currentYear = today.getFullYear();
  const todayYMD = formatYMD(today.getFullYear(), today.getMonth() + 1, today.getDate());

  switch (category) {
    case 'license_tax': {
      return {
        category,
        title: `${currentYear}年 牌照稅`,
        defaultAmount: 0,
        paidDate: todayYMD,
        coverageStartDate: `${currentYear}-01-01`,
        coverageEndDate: `${currentYear}-12-31`,
        notice: '自用車法定開徵期間為每年 04/01 至 04/30，涵蓋全年度用路資格。',
      };
    }

    case 'road_maintenance_fee': {
      return {
        category,
        title: `${currentYear}年 公路使用養護安全管理費`,
        defaultAmount: 0,
        paidDate: todayYMD,
        coverageStartDate: `${currentYear}-01-01`,
        coverageEndDate: `${currentYear}-12-31`,
        notice: '原汽車燃料使用費（公路養管費），自用車每年 07/01 至 07/31 開徵。',
      };
    }

    case 'inspection': {
      return calculateInspectionPreFill(vehicle, today);
    }

    case 'compulsory_insurance': {
      const todayParsed = {
        year: today.getFullYear(),
        month: today.getMonth() + 1,
        day: today.getDate(),
      };
      // 1 年期 - 1 天
      const nextYear = todayParsed.year + 1;
      const targetMonth = todayParsed.month;
      const targetDay = todayParsed.day;
      const nextYearDate = new Date(nextYear, targetMonth - 1, targetDay);
      nextYearDate.setDate(nextYearDate.getDate() - 1);
      const endYMD = formatYMD(
        nextYearDate.getFullYear(),
        nextYearDate.getMonth() + 1,
        nextYearDate.getDate()
      );

      return {
        category,
        title: '強制汽車責任保險',
        defaultAmount: 0,
        paidDate: todayYMD,
        coverageStartDate: todayYMD,
        coverageEndDate: endYMD,
        notice: '法定強制責任險通常為 1 年期保障。',
      };
    }

    case 'liability_insurance': {
      const nextYearDate = new Date(today.getFullYear() + 1, today.getMonth(), today.getDate());
      nextYearDate.setDate(nextYearDate.getDate() - 1);
      const endYMD = formatYMD(
        nextYearDate.getFullYear(),
        nextYearDate.getMonth() + 1,
        nextYearDate.getDate()
      );

      return {
        category,
        title: '任意第三人責任保險',
        defaultAmount: 0,
        paidDate: todayYMD,
        coverageStartDate: todayYMD,
        coverageEndDate: endYMD,
        notice: '商業任意第三人責任險通常為 1 年期保障。',
      };
    }

    default: {
      const nextYearDate = new Date(today.getFullYear() + 1, today.getMonth(), today.getDate());
      nextYearDate.setDate(nextYearDate.getDate() - 1);
      const endYMD = formatYMD(
        nextYearDate.getFullYear(),
        nextYearDate.getMonth() + 1,
        nextYearDate.getDate()
      );

      return {
        category: 'other',
        title: '其他車輛週期規費',
        defaultAmount: 0,
        paidDate: todayYMD,
        coverageStartDate: todayYMD,
        coverageEndDate: endYMD,
      };
    }
  }
}

/**
 * 台灣定期檢驗 / 排氣檢驗推算演算法
 * - 汽車：未滿 5 年免檢；滿 5 年未滿 10 年每年 1 次；滿 10 年每年 2 次 (每半年 1 次)。
 * - 機車：滿 5 年每年排氣定檢 1 次。
 * - 檢驗窗口：基準日前 1 個月至後 1 個月 (前後各 1 個月，共 2 個月)。
 */
export function calculateInspectionPreFill(
  vehicle: {
    year?: number | null;
    manufacture_date?: string | null;
    vehicle_type: string;
  },
  today: Date = new Date()
): SmartPreFillResult {
  const currentYear = today.getFullYear();
  const currentMonth = today.getMonth() + 1;
  const todayYMD = formatYMD(currentYear, currentMonth, today.getDate());

  let mfgYear = vehicle.year || currentYear;
  let mfgMonth = 1;
  let mfgDay = 1;
  let hasExactDate = false;

  if (vehicle.manufacture_date) {
    const parsed = parseYMD(vehicle.manufacture_date);
    if (parsed) {
      mfgYear = parsed.year;
      mfgMonth = parsed.month;
      mfgDay = parsed.day;
      hasExactDate = true;
    }
  }

  const age = currentYear - mfgYear;
  const isCar = vehicle.vehicle_type === 'car';

  // 判定當年度定檢次數
  let timesPerYear = 1;
  if (isCar && age >= 10) {
    timesPerYear = 2; // 滿 10 年每年 2 驗
  }

  // 決定檢驗基準月份
  let targetMonth = mfgMonth;
  let targetYear = currentYear;
  let isSecondHalf = false;

  if (timesPerYear === 2) {
    // 下半期基準月為 mfgMonth + 6
    const secondMonth = ((mfgMonth + 6 - 1) % 12) + 1;
    // 檢查當前月份離哪個窗口較近：若已過上半期窗口（mfgMonth + 1），則切換至下半期
    const firstHalfEndMonth = ((mfgMonth + 1 - 1) % 12) + 1;
    if (mfgMonth <= secondMonth) {
      if (currentMonth > firstHalfEndMonth) {
        targetMonth = secondMonth;
        isSecondHalf = true;
      }
    } else {
      // 跨年週期
      if (currentMonth > firstHalfEndMonth && currentMonth <= secondMonth + 1) {
        targetMonth = secondMonth;
        isSecondHalf = true;
      }
    }
  }

  // 基準日當天（經月底夾取處理）
  const baseClamped = addMonthsClamped(targetYear, targetMonth, mfgDay, 0);

  // 檢驗視窗：基準日前 1 個月至後 1 個月
  const startObj = addMonthsClamped(baseClamped.year, baseClamped.month, baseClamped.day, -1);
  const endObj = addMonthsClamped(baseClamped.year, baseClamped.month, baseClamped.day, 1);

  const startDateStr = formatYMD(startObj.year, startObj.month, startObj.day);
  const endDateStr = formatYMD(endObj.year, endObj.month, endObj.day);

  let title = `${currentYear}年 `;
  if (isCar) {
    title += timesPerYear === 2 ? `第${isSecondHalf ? '二' : '一'}次 定期檢驗` : '定期檢驗';
  } else {
    title += '機車排氣定期檢驗';
  }

  let notice = '';
  if (!hasExactDate) {
    notice = '尚未設定行照原發照（出廠）日期，預設使用出廠年份估算；建議於下方勾選同步更新出廠日。';
  } else {
    notice = `依行照出廠日 (${vehicle.manufacture_date}) 推算，法定檢驗窗口為基準日前後各 1 個月內有效。`;
    if (isCar && age < 5) {
      notice = `出廠未滿 5 年新車依法免定檢。此處為預估屆滿 5 年之首次檢驗窗口。`;
    }
  }

  return {
    category: 'inspection',
    title,
    defaultAmount: isCar ? 450 : 0,
    paidDate: todayYMD,
    coverageStartDate: startDateStr,
    coverageEndDate: endDateStr,
    notice,
  };
}
