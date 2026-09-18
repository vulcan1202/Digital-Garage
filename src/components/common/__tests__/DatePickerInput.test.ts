describe('DatePicker & Vehicle Date Specification (P2-2.5)', () => {
  describe('Date Parsing and Formatting Rules', () => {
    function parseDateStr(str?: string): { year: number; month: number; day: number } {
      if (str && /^\d{4}-\d{2}-\d{2}$/.test(str.trim())) {
        const [y, m, d] = str.trim().split('-').map((v) => parseInt(v, 10));
        if (!isNaN(y) && !isNaN(m) && !isNaN(d)) {
          return { year: y, month: m, day: d };
        }
      }
      const now = new Date();
      return {
        year: now.getFullYear(),
        month: now.getMonth() + 1,
        day: now.getDate(),
      };
    }

    function padZero(n: number): string {
      return n < 10 ? '0' + n : '' + n;
    }

    function formatDateStr(year: number, month: number, day: number): string {
      return `${year}-${padZero(month)}-${padZero(day)}`;
    }

    it('TC-DP-01: 應能正確解析合法的 YYYY-MM-DD 字串', () => {
      const parsed = parseDateStr('2023-08-15');
      expect(parsed).toEqual({ year: 2023, month: 8, day: 15 });
    });

    it('TC-DP-02: 空字串或非法格式應平穩回退至當前日期而不拋出例外', () => {
      const parsed1 = parseDateStr('');
      const parsed2 = parseDateStr('invalid-date');
      const now = new Date();

      expect(parsed1.year).toBe(now.getFullYear());
      expect(parsed1.month).toBe(now.getMonth() + 1);
      expect(parsed2.year).toBe(now.getFullYear());
    });

    it('TC-DP-03: 應正確格式化帶前導 0 的日期字串', () => {
      expect(formatDateStr(2024, 3, 5)).toBe('2024-03-05');
      expect(formatDateStr(2022, 11, 28)).toBe('2022-11-28');
    });
  });

  describe('Month Mode (mode="month") Parsing and Formatting', () => {
    function parseMonthStr(str?: string): { year: number; month: number } {
      if (str && /^\d{4}-\d{2}/.test(str.trim())) {
        const [y, m] = str.trim().split('-').map((v) => parseInt(v, 10));
        if (!isNaN(y) && !isNaN(m)) {
          return { year: y, month: m };
        }
      }
      const now = new Date();
      return { year: now.getFullYear(), month: now.getMonth() + 1 };
    }

    function formatMonthStr(year: number, month: number): string {
      const mStr = month < 10 ? '0' + month : '' + month;
      return `${year}-${mStr}`;
    }

    it('TC-DP-MONTH-01: 應能正確解析 YYYY-MM 與 YYYY-MM-DD 前綴之出廠年月', () => {
      expect(parseMonthStr('2023-08')).toEqual({ year: 2023, month: 8 });
      expect(parseMonthStr('2023-08-15')).toEqual({ year: 2023, month: 8 });
    });

    it('TC-DP-MONTH-02: 應能正確輸出 YYYY-MM 格式字串', () => {
      expect(formatMonthStr(2025, 4)).toBe('2025-04');
      expect(formatMonthStr(2025, 11)).toBe('2025-11');
    });
  });

  describe('Vehicle Manufacture Date & Year Extraction Integration', () => {
    it('TC-DP-04: 選定出廠年月 (YYYY-MM) 後應能正確自動解析出廠年份 (西元整數)', () => {
      const manufactureDate = '2022-03';
      const derivedYear = manufactureDate.trim()
        ? parseInt(manufactureDate.split('-')[0], 10)
        : null;

      expect(derivedYear).toBe(2022);
    });

    it('TC-DP-05: 編輯模式下若車輛僅有 year 無 manufacture_date，應預設以 ${year}-01 作為基線', () => {
      const vehicle = {
        id: 1,
        year: 2019,
        manufacture_date: null,
      };

      const initManufactureDate =
        vehicle.manufacture_date || (vehicle.year ? `${vehicle.year}-01` : '');

      expect(initManufactureDate).toBe('2019-01');
      const derivedYear = parseInt(initManufactureDate.split('-')[0], 10);
      expect(derivedYear).toBe(2019);
    });

    it('TC-DP-06: 編輯模式下若車輛具備出廠年月 (YYYY-MM)，應優先採用', () => {
      const vehicle = {
        id: 2,
        year: 2020,
        manufacture_date: '2020-07',
      };

      const initManufactureDate =
        vehicle.manufacture_date || (vehicle.year ? `${vehicle.year}-01` : '');

      expect(initManufactureDate).toBe('2020-07');
      const derivedYear = parseInt(initManufactureDate.split('-')[0], 10);
      expect(derivedYear).toBe(2020);
    });

    it('TC-DP-06-REG: 行照原發照日期 (registration_date) 保留完整年月日 (YYYY-MM-DD)', () => {
      const registrationDate = '2021-06-18';
      expect(/^\d{4}-\d{2}-\d{2}$/.test(registrationDate)).toBe(true);
      const [year, month, day] = registrationDate.split('-').map((v) => parseInt(v, 10));
      expect(year).toBe(2021);
      expect(month).toBe(6);
      expect(day).toBe(18);
    });
  });

  describe('Date Range & Boundary Constraints', () => {
    function isDateDisabled(
      year: number,
      month: number,
      day: number,
      maximumDate?: Date,
      minimumDate?: Date
    ): boolean {
      const d = new Date(year, month - 1, day);
      if (maximumDate) {
        const max = new Date(maximumDate.getFullYear(), maximumDate.getMonth(), maximumDate.getDate(), 23, 59, 59);
        if (d > max) return true;
      }
      if (minimumDate) {
        const min = new Date(minimumDate.getFullYear(), minimumDate.getMonth(), minimumDate.getDate(), 0, 0, 0);
        if (d < min) return true;
      }
      return false;
    }

    it('TC-DP-07: 超過 maximumDate 之未來日期應被正確標記為 disabled', () => {
      const today = new Date(2026, 8, 18);
      const tomorrowDisabled = isDateDisabled(2026, 9, 19, today);
      const todayDisabled = isDateDisabled(2026, 9, 18, today);
      const yesterdayDisabled = isDateDisabled(2026, 9, 17, today);

      expect(tomorrowDisabled).toBe(true);
      expect(todayDisabled).toBe(false);
      expect(yesterdayDisabled).toBe(false);
    });

    it('TC-DP-08: 閏年與平年二月份天數計算邊界防護', () => {
      const leapDays = new Date(2024, 2, 0).getDate();
      const normalDays = new Date(2023, 2, 0).getDate();

      expect(leapDays).toBe(29);
      expect(normalDays).toBe(28);
    });
  });
});