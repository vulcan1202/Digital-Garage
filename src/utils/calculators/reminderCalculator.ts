/**
 * Reminder Calculator (純函式)
 * 零依賴、無副作用、相同輸入必得相同輸出
 */

export type ReminderEvaluationStatus = 'OVERDUE' | 'DUE_SOON' | 'OK';

export interface ReminderInput {
  interval_km: number | null;
  interval_months: number | null;
  base_mileage: number | null;
  base_date: string | null; // 'YYYY-MM-DD'
  last_completed_mileage: number | null;
  last_completed_date: string | null; // 'YYYY-MM-DD'
}

export interface ReminderCalculationResult {
  nextDueMileage: number | null;
  nextDueDate: string | null; // 'YYYY-MM-DD'
  remainingMileage: number | null;
  remainingDays: number | null;
  status: ReminderEvaluationStatus;
}

/**
 * 輔助純函式: 為日期字串加上指定月份數
 * 安全處理月份天數溢位 (例如 1月31日 + 1個月 -> 2月28/29日)
 */
export function addMonthsToDateString(dateStr: string, months: number): string {
  const [yearStr, monthStr, dayStr] = dateStr.split('-');
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10) - 1; // 0-indexed
  const day = parseInt(dayStr, 10);

  const targetDate = new Date(Date.UTC(year, month + months, 1));
  const targetYear = targetDate.getUTCFullYear();
  const targetMonth = targetDate.getUTCMonth();

  // 取得目標月份的最大天數
  const daysInTargetMonth = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate();
  const targetDay = Math.min(day, daysInTargetMonth);

  const finalDate = new Date(Date.UTC(targetYear, targetMonth, targetDay));
  return finalDate.toISOString().split('T')[0];
}

/**
 * 輔助純函式: 計算兩日期字串之間的天數差 (target - base)
 */
export function getDaysDifference(baseDateStr: string, targetDateStr: string): number {
  const base = new Date(`${baseDateStr}T00:00:00Z`).getTime();
  const target = new Date(`${targetDateStr}T00:00:00Z`).getTime();
  const diffMs = target - base;
  return Math.round(diffMs / (1000 * 60 * 60 * 24));
}

/**
 * 計算保養提醒狀態與下次應保養里程/日期
 * @param reminder 保養提醒資料
 * @param currentMileage 車輛當前里程 (公里)
 * @param todayDateStr 今日日期字串 ('YYYY-MM-DD')，若未給則以 UTC 今日為準
 */
export function evaluateReminderStatus(
  reminder: ReminderInput,
  currentMileage: number,
  todayDateStr?: string
): ReminderCalculationResult {
  const today = todayDateStr || new Date().toISOString().split('T')[0];

  // 1. 里程維度計算 (next_due_mileage = (last_completed_mileage ?? base_mileage) + interval_km)
  let nextDueMileage: number | null = null;
  let remainingMileage: number | null = null;
  let isMileageOverdue = false;
  let isMileageDueSoon = false;

  if (typeof reminder.interval_km === 'number' && reminder.interval_km > 0) {
    const baseKm = reminder.last_completed_mileage ?? reminder.base_mileage ?? 0;
    nextDueMileage = baseKm + reminder.interval_km;
    remainingMileage = nextDueMileage - currentMileage;

    if (currentMileage >= nextDueMileage) {
      isMileageOverdue = true;
    } else if (remainingMileage <= 500) {
      isMileageDueSoon = true;
    }
  }

  // 2. 月份時間維度計算 (next_due_date = addMonths(last_completed_date ?? base_date, interval_months))
  let nextDueDate: string | null = null;
  let remainingDays: number | null = null;
  let isDateOverdue = false;
  let isDateDueSoon = false;

  if (typeof reminder.interval_months === 'number' && reminder.interval_months > 0) {
    const baseDate = reminder.last_completed_date ?? reminder.base_date;
    if (baseDate) {
      nextDueDate = addMonthsToDateString(baseDate, reminder.interval_months);
      remainingDays = getDaysDifference(today, nextDueDate);

      if (today >= nextDueDate) {
        isDateOverdue = true;
      } else if (remainingDays <= 14) {
        isDateDueSoon = true;
      }
    }
  }

  // 3. 狀態綜合判定:
  // - OVERDUE: 任一有定義之維度過期
  // - DUE_SOON: 未過期，但任一有定義之維度即期 (<= 500km 或 <= 14天)
  // - OK: 其餘情況
  let status: ReminderEvaluationStatus = 'OK';
  if (isMileageOverdue || isDateOverdue) {
    status = 'OVERDUE';
  } else if (isMileageDueSoon || isDateDueSoon) {
    status = 'DUE_SOON';
  }

  return {
    nextDueMileage,
    nextDueDate,
    remainingMileage,
    remainingDays,
    status,
  };
}
