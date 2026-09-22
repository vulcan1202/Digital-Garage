import {
  isLeapYear,
  daysInMonth,
  addMonthsClamped,
  formatYMD,
  getSmartPreFill,
  calculateInspectionPreFill,
  deriveInspectionWindow,
  calculateRecurringAlertCounts,
} from '../recurringCalculator';

describe('recurringCalculator', () => {
  describe('Month Clamping & Date Arithmetic', () => {
    it('TC-REC-01: 正確判斷閏年與平年天數', () => {
      expect(isLeapYear(2020)).toBe(true);
      expect(isLeapYear(2024)).toBe(true);
      expect(isLeapYear(2000)).toBe(true);
      expect(isLeapYear(1900)).toBe(false);
      expect(isLeapYear(2025)).toBe(false);
      expect(isLeapYear(2026)).toBe(false);

      expect(daysInMonth(2024, 2)).toBe(29);
      expect(daysInMonth(2025, 2)).toBe(28);
      expect(daysInMonth(2026, 2)).toBe(28);
      expect(daysInMonth(2026, 4)).toBe(30);
      expect(daysInMonth(2026, 5)).toBe(31);
    });

    it('TC-REC-01: 閏年 2/29 出廠日於平年推算時安全夾至 2/28', () => {
      // 2020-02-29 在平年 2026 年計算，基準日夾至 2026-02-28
      const base = addMonthsClamped(2026, 2, 29, 0);
      expect(base).toEqual({ year: 2026, month: 2, day: 28 });

      // 基準日前一個月為 2026-01-28，後一個月為 2026-03-28
      const prevMonth = addMonthsClamped(2026, 2, 28, -1);
      const nextMonth = addMonthsClamped(2026, 2, 28, 1);
      expect(prevMonth).toEqual({ year: 2026, month: 1, day: 28 });
      expect(nextMonth).toEqual({ year: 2026, month: 3, day: 28 });
    });

    it('TC-REC-02: 跨年度檢驗窗口（1 月出廠之車輛，前一個月為前一年 12 月）', () => {
      const prevMonth = addMonthsClamped(2026, 1, 15, -1);
      expect(prevMonth).toEqual({ year: 2025, month: 12, day: 15 });

      const nextMonth = addMonthsClamped(2026, 1, 15, 1);
      expect(nextMonth).toEqual({ year: 2026, month: 2, day: 15 });
    });

    it('TC-REC-03: 3/31 大月月底向前後加減月份夾取保護', () => {
      // 3/31 向前 1 個月：2026 年 2 月只有 28 天，應夾至 2/28
      const febClamped = addMonthsClamped(2026, 3, 31, -1);
      expect(febClamped).toEqual({ year: 2026, month: 2, day: 28 });

      // 3/31 向後 1 個月：4 月只有 30 天，應夾至 4/30
      const aprClamped = addMonthsClamped(2026, 3, 31, 1);
      expect(aprClamped).toEqual({ year: 2026, month: 4, day: 30 });
    });
  });

  describe('Taiwan Regulatory Smart Pre-Fill', () => {
    const carUnder5 = {
      year: 2024,
      manufacture_date: '2024-05',
      registration_date: '2024-05-15',
      vehicle_type: 'car',
    };

    const car7Years = {
      year: 2019,
      manufacture_date: '2019-06',
      registration_date: '2019-06-20',
      vehicle_type: 'car',
    };

    const carFallback = {
      year: 2019,
      manufacture_date: '2019-06',
      registration_date: null,
      vehicle_type: 'car',
    };

    const car11Years = {
      year: 2015,
      manufacture_date: '2015-05',
      registration_date: '2015-05-10',
      vehicle_type: 'car',
    };

    const motorcycle = {
      year: 2020,
      manufacture_date: '2020-08',
      registration_date: '2020-08-10',
      vehicle_type: 'motorcycle',
    };

    it('牌照稅：自用車預填當年度 1/1 ~ 12/31 覆蓋期', () => {
      const today = new Date(2026, 3, 10); // 2026-04-10
      const res = getSmartPreFill('license_tax', car7Years, today);

      expect(res.category).toBe('license_tax');
      expect(res.title).toBe('2026年 牌照稅');
      expect(res.coverageStartDate).toBe('2026-01-01');
      expect(res.coverageEndDate).toBe('2026-12-31');
      expect(res.paidDate).toBe('2026-04-10');
    });

    it('公路使用養護安全管理費：自用車預填當年度 1/1 ~ 12/31 覆蓋期，正名符合規範', () => {
      const today = new Date(2026, 6, 15); // 2026-07-15
      const res = getSmartPreFill('road_maintenance_fee', car7Years, today);

      expect(res.category).toBe('road_maintenance_fee');
      expect(res.title).toBe('2026年 公路使用養護安全管理費');
      expect(res.coverageStartDate).toBe('2026-01-01');
      expect(res.coverageEndDate).toBe('2026-12-31');
      expect(res.paidDate).toBe('2026-07-15');
    });

    it('deriveInspectionWindow: 正確以指定日期前後各推 1 個月計算寬限期', () => {
      const window = deriveInspectionWindow('2027-09-15');
      expect(window.coverageStartDate).toBe('2027-08-15');
      expect(window.coverageEndDate).toBe('2027-10-15');
    });

    it('TC-REC-04: 車齡 7 年汽車（5~10 年）依 registration_date 月日推算下次定檢日與前後 1 個月寬限期', () => {
      const today = new Date(2026, 4, 1); // 2026-05-01
      const res = calculateInspectionPreFill(car7Years, today);

      expect(res.category).toBe('inspection');
      expect(res.title).toBe('2026年 定期檢驗');
      expect(res.defaultAmount).toBe(450);
      expect(res.paidDate).toBe('2026-05-01');
      // 下次定檢日為 2027-06-20，寬限期為 2027-05-20 至 2027-07-20
      expect(res.nextInspectionDate).toBe('2027-06-20');
      expect(res.coverageStartDate).toBe('2027-05-20');
      expect(res.coverageEndDate).toBe('2027-07-20');
      expect(res.isIncompleteData).toBe(false);
      expect(res.notice).toContain('2027-06-20');
      expect(res.notice).toContain('前後各 1 個月');
    });

    it('TC-REC-04-FALLBACK: 若車輛無 registration_date，標記資料不全並提示待首次驗車登記', () => {
      const today = new Date(2026, 4, 1);
      const res = calculateInspectionPreFill(carFallback, today);

      expect(res.category).toBe('inspection');
      expect(res.title).toBe('2026年 定期檢驗');
      expect(res.isIncompleteData).toBe(true);
      expect(res.notice).toContain('尚未設定行照發照日期');
      expect(res.notice).toContain('資料不全');
    });

    it('TC-REC-04-NEW: 未滿 5 年之新車顯示免定檢及預估 5 年檢驗日', () => {
      const today = new Date(2026, 4, 1);
      const res = calculateInspectionPreFill(carUnder5, today);

      expect(res.notice).toContain('出廠未滿 5 年新車依法免定檢');
      expect(res.nextInspectionDate).toBe('2029-05-15');
    });

    it('TC-REC-04-APPROACHING: 車輛邁入第 5 年（4 年車）提前提示即將迎來首檢', () => {
      const car4Years = {
        year: 2022,
        manufacture_date: '2022-08',
        registration_date: '2022-08-15',
        vehicle_type: 'car',
      };
      const today = new Date(2026, 7, 1); // 2026-08-01 (4 年車)
      const res = calculateInspectionPreFill(car4Years, today);

      expect(res.isFirstInspectionApproaching).toBe(true);
      expect(res.notice).toContain('車輛即將邁入第 5 年');
      expect(res.nextInspectionDate).toBe('2027-08-15');
      expect(res.coverageStartDate).toBe('2027-07-15');
      expect(res.coverageEndDate).toBe('2027-09-15');
    });

    it('TC-REC-05: 車齡 11 年汽車（滿 10 年）每年兩驗，下半期窗口自動切換', () => {
      // 5 月出廠/發照，若今日為 8 月，下次定檢為下半期 11 月 (10-10 ~ 12-10)
      const todayInAugust = new Date(2026, 7, 20); // 2026-08-20
      const res = calculateInspectionPreFill(car11Years, todayInAugust);

      expect(res.category).toBe('inspection');
      expect(res.nextInspectionDate).toBe('2026-11-10');
      expect(res.coverageStartDate).toBe('2026-10-10');
      expect(res.coverageEndDate).toBe('2026-12-10');
    });

    it('機車出廠滿 5 年預填每年定期檢驗，預設規費 0 元', () => {
      const today = new Date(2026, 7, 1);
      const res = calculateInspectionPreFill(motorcycle, today);

      expect(res.title).toBe('2026年 定期檢驗');
      expect(res.defaultAmount).toBe(0);
      expect(res.nextInspectionDate).toBe('2027-08-10');
      expect(res.coverageStartDate).toBe('2027-07-10');
      expect(res.coverageEndDate).toBe('2027-09-10');
    });

    it('強制汽車責任險：預設 1 年期日曆覆蓋', () => {
      const today = new Date(2026, 4, 15); // 2026-05-15
      const res = getSmartPreFill('compulsory_insurance', car7Years, today);

      expect(res.coverageStartDate).toBe('2026-05-15');
      expect(res.coverageEndDate).toBe('2027-05-14');
    });
  });

  describe('calculateRecurringAlertCounts', () => {
    it('固定規費在繳費月中觸發 dueSoon 警報（例如 4 月牌照稅）', () => {
      const statuses = [
        { category: 'license_tax' as const, title: '牌照稅', status: 'unset' as const },
        { category: 'road_maintenance_fee' as const, title: '汽燃費', status: 'unset' as const },
      ];
      const aprilDate = new Date(2026, 3, 10); // April
      const counts = calculateRecurringAlertCounts(statuses, aprilDate);

      expect(counts.dueSoon).toBe(1); // license_tax is due in April
      expect(counts.overdue).toBe(0);
    });

    it('固定規費在非繳費月不觸發警報（例如 2 月）', () => {
      const statuses = [
        { category: 'license_tax' as const, title: '牌照稅', status: 'unset' as const },
        { category: 'road_maintenance_fee' as const, title: '汽燃費', status: 'unset' as const },
      ];
      const febDate = new Date(2026, 1, 10); // February
      const counts = calculateRecurringAlertCounts(statuses, febDate);

      expect(counts.dueSoon).toBe(0);
      expect(counts.overdue).toBe(0);
    });

    it('定檢與保險依 status 正確統計 overdue 與 dueSoon', () => {
      const statuses = [
        { category: 'inspection' as const, title: '定檢', status: 'due_soon' as const },
        { category: 'compulsory_insurance' as const, title: '強制險', status: 'overdue' as const },
        { category: 'liability_insurance' as const, title: '第三責任險', status: 'good' as const },
      ];
      const counts = calculateRecurringAlertCounts(statuses);

      expect(counts.dueSoon).toBe(1);
      expect(counts.overdue).toBe(1);
    });
  });
});
