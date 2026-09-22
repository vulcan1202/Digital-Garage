import { RecurringExpenseCategory, SmartPreFillResult, RecurringStatusSummary } from '../../types/recurringExpense';

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
  if (parts.length === 2) {
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10);
    if (isNaN(year) || isNaN(month)) return null;
    return { year, month, day: 1 };
  }
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
    registration_date?: string | null;
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
 * 依據下次定檢日，自動推算前後各 1 個月之法定檢驗寬限期
 */
export function deriveInspectionWindow(nextInspectionDateStr: string): {
  coverageStartDate: string;
  coverageEndDate: string;
} {
  const parsed = parseYMD(nextInspectionDateStr);
  if (!parsed) {
    return {
      coverageStartDate: nextInspectionDateStr,
      coverageEndDate: nextInspectionDateStr,
    };
  }
  const startObj = addMonthsClamped(parsed.year, parsed.month, parsed.day, -1);
  const endObj = addMonthsClamped(parsed.year, parsed.month, parsed.day, 1);
  return {
    coverageStartDate: formatYMD(startObj.year, startObj.month, startObj.day),
    coverageEndDate: formatYMD(endObj.year, endObj.month, endObj.day),
  };
}

/**
 * 台灣定期檢驗 / 排氣檢驗推算演算法 (實務車主習性對齊版)
 * - 車主僅需填寫：此次檢驗日（不論是否逾期）與 下次定檢日（行照蓋印）。
 * - 寬限期：由系統根據「下次定檢日」自動前後推 1 個月（共 2 個月有效視窗）。
 * - 第 5 年首檢預警：汽車在出廠第 4 年（即邁入第 5 年首檢前）即時給予提前提示。
 * - 無原發照日期：標記為資料不全 (isIncompleteData)，待首次驗車登記後啟動通知。
 */
export function calculateInspectionPreFill(
  vehicle: {
    year?: number | null;
    manufacture_date?: string | null;
    registration_date?: string | null;
    vehicle_type: string;
  },
  today: Date = new Date()
): SmartPreFillResult {
  const currentYear = today.getFullYear();
  const currentMonth = today.getMonth() + 1;
  const todayYMD = formatYMD(currentYear, currentMonth, today.getDate());

  let baseMonth = 1;
  let baseDay = 1;
  let hasRegistrationDate = false;

  // 1. 優先取用 registration_date 原發照日的月日
  if (vehicle.registration_date) {
    const parsedReg = parseYMD(vehicle.registration_date);
    if (parsedReg) {
      baseMonth = parsedReg.month;
      baseDay = parsedReg.day;
      hasRegistrationDate = true;
    }
  }

  // 2. 車齡推估（優先取用出廠年月，次選原發照年，最後取 year）
  let mfgYear = currentYear;
  if (vehicle.manufacture_date) {
    const parsedMfg = parseYMD(vehicle.manufacture_date);
    if (parsedMfg) {
      mfgYear = parsedMfg.year;
    } else if (vehicle.year) {
      mfgYear = vehicle.year;
    }
  } else if (vehicle.registration_date) {
    const parsedReg = parseYMD(vehicle.registration_date);
    if (parsedReg) {
      mfgYear = parsedReg.year;
    } else if (vehicle.year) {
      mfgYear = vehicle.year;
    }
  } else if (vehicle.year) {
    mfgYear = vehicle.year;
  }

  const age = currentYear - mfgYear;
  const isCar = vehicle.vehicle_type === 'car';

  // 3. 若車主無登記原發照日期無法判斷：回傳「資料不全」提示，直到車主第一次驗車填入資料
  if (!hasRegistrationDate) {
    const fallbackNext = addMonthsClamped(currentYear, currentMonth, today.getDate(), 12);
    const fallbackNextStr = formatYMD(fallbackNext.year, fallbackNext.month, fallbackNext.day);
    const window = deriveInspectionWindow(fallbackNextStr);

    return {
      category: 'inspection',
      title: `${currentYear}年 定期檢驗`,
      defaultAmount: isCar ? 450 : 0,
      paidDate: todayYMD,
      nextInspectionDate: fallbackNextStr,
      coverageStartDate: window.coverageStartDate,
      coverageEndDate: window.coverageEndDate,
      notice: '尚未設定行照發照日期，資料不全無法精準推算定檢排程，請對照行照蓋印填寫下次定檢日。',
      isIncompleteData: true,
      isFirstInspectionApproaching: false,
    };
  }

  // 4. 有原發照日期：判斷是否邁入第 5 年首檢前夕 (汽車出廠第 4 年即將邁入第 5 年)
  const isFirstInspectionApproaching = isCar && age === 4;

  // 5. 判定當年度定檢次數 (滿 10 年汽車每半年一驗)
  let timesPerYear = 1;
  if (isCar && age >= 10) {
    timesPerYear = 2;
  }

  // 6. 計算預設下次定檢基準日 (Next Inspection Date)
  let nextYear = currentYear;
  let nextMonth = baseMonth;

  if (isCar && age < 5) {
    // 未滿 5 年新車：首次定檢年為出廠第 5 年
    nextYear = mfgYear + 5;
    nextMonth = baseMonth;
  } else if (timesPerYear === 2) {
    // 滿 10 年老車：每半年一驗 (兩次基準分別為 earlyMonth 與 lateMonth)
    const m1 = baseMonth;
    const m2 = ((baseMonth + 6 - 1) % 12) + 1;
    const [earlyMonth, lateMonth] = m1 < m2 ? [m1, m2] : [m2, m1];

    if (currentMonth <= earlyMonth) {
      nextMonth = earlyMonth;
      nextYear = currentYear;
    } else if (currentMonth <= lateMonth) {
      nextMonth = lateMonth;
      nextYear = currentYear;
    } else {
      nextMonth = earlyMonth;
      nextYear = currentYear + 1;
    }
  } else {
    // 5~10 年汽車或 5 年以上機車：每年一驗 (+1 年)
    if (currentMonth < baseMonth - 1) {
      nextYear = currentYear;
    } else {
      nextYear = currentYear + 1;
    }
    nextMonth = baseMonth;
  }

  const nextBaseClamped = addMonthsClamped(nextYear, nextMonth, baseDay, 0);
  const nextInspectionDate = formatYMD(nextBaseClamped.year, nextBaseClamped.month, nextBaseClamped.day);
  const window = deriveInspectionWindow(nextInspectionDate);

  const title = `${currentYear}年 定期檢驗`;

  let notice = `依行照推算，下次指定定檢日為 ${nextInspectionDate}。前後各 1 個月（${window.coverageStartDate} ～ ${window.coverageEndDate}）皆可前往代檢廠驗車。`;
  if (isFirstInspectionApproaching) {
    notice = `車輛即將邁入第 5 年，將迎來首次法定定期檢驗！預估首檢基準日為 ${nextInspectionDate}，前後 1 個月皆可驗車。`;
  } else if (isCar && age < 4) {
    notice = `出廠未滿 5 年新車依法免定檢。系統預估首次定檢日為 ${nextInspectionDate}。`;
  }

  return {
    category: 'inspection',
    title,
    defaultAmount: isCar ? 450 : 0,
    paidDate: todayYMD,
    nextInspectionDate,
    coverageStartDate: window.coverageStartDate,
    coverageEndDate: window.coverageEndDate,
    notice,
    isIncompleteData: false,
    isFirstInspectionApproaching,
  };
}

/**
 * 計算指定車輛當前所有週期規費與法定排程的警報總數 (OVERDUE 與 DUE_SOON)
 * 涵蓋牌照稅 4 月開徵/逾期、公路養管費 7 月開徵/逾期、定檢雙階寬限期與保險到期
 */
export function calculateRecurringAlertCounts(
  recurringStatuses: RecurringStatusSummary[],
  today: Date = new Date()
): { overdue: number; dueSoon: number } {
  let overdue = 0;
  let dueSoon = 0;
  const todayStr = formatYMD(today.getFullYear(), today.getMonth() + 1, today.getDate());

  recurringStatuses.forEach((s) => {
    if (s.category === 'inspection' && s.coverage_end_date) {
      const parsedEnd = parseYMD(s.coverage_end_date);
      if (parsedEnd) {
        const baseObj = addMonthsClamped(parsedEnd.year, parsedEnd.month, parsedEnd.day, -1);
        const baseDateStr = formatYMD(baseObj.year, baseObj.month, baseObj.day);
        const startObj = addMonthsClamped(parsedEnd.year, parsedEnd.month, parsedEnd.day, -2);
        const startDateStr = formatYMD(startObj.year, startObj.month, startObj.day);

        if (todayStr > s.coverage_end_date) {
          overdue++;
        } else if (todayStr >= baseDateStr) {
          overdue++; // 後一個月（需要驗車，紅色警告）
        } else if (todayStr >= startDateStr) {
          dueSoon++; // 前一個月（可驗車，黃色標記）
        }
        return;
      }
    }

    if (s.category === 'license_tax' || s.category === 'road_maintenance_fee') {
      const currentYear = today.getFullYear();
      const currentMonth = today.getMonth() + 1;
      const levyMonth = s.category === 'license_tax' ? 4 : 7;

      let isPaidThisYear = false;
      if (s.status !== 'unset' && s.coverage_end_date) {
        const parsedEnd = parseYMD(s.coverage_end_date);
        if (parsedEnd && parsedEnd.year >= currentYear) {
          isPaidThisYear = true;
        }
      }
      if (s.last_paid_date) {
        const parsedPaid = parseYMD(s.last_paid_date);
        if (parsedPaid && parsedPaid.year >= currentYear) {
          isPaidThisYear = true;
        }
      }

      if (!isPaidThisYear) {
        if (currentMonth > levyMonth) {
          overdue++;
        } else if (currentMonth === levyMonth) {
          dueSoon++;
        }
      }
      return;
    }

    if (s.status === 'overdue') overdue++;
    else if (s.status === 'due_soon') dueSoon++;
  });

  return { overdue, dueSoon };
}
