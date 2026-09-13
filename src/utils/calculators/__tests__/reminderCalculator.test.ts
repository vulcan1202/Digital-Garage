import {
  evaluateReminderStatus,
  addMonthsToDateString,
  getDaysDifference,
} from '../reminderCalculator';

describe('reminderCalculator', () => {
  describe('addMonthsToDateString', () => {
    it('adds months accurately across standard months', () => {
      expect(addMonthsToDateString('2026-01-15', 6)).toBe('2026-07-15');
      expect(addMonthsToDateString('2026-10-10', 4)).toBe('2027-02-10');
    });

    it('safely handles month-end days rollover (e.g. Jan 31 + 1 month)', () => {
      // 2026 is not a leap year, February has 28 days
      expect(addMonthsToDateString('2026-01-31', 1)).toBe('2026-02-28');
    });
  });

  describe('getDaysDifference', () => {
    it('calculates days between two dates', () => {
      expect(getDaysDifference('2026-06-01', '2026-06-15')).toBe(14);
      expect(getDaysDifference('2026-06-15', '2026-06-01')).toBe(-14);
    });
  });

  describe('evaluateReminderStatus', () => {
    it('evaluates based on base_mileage when last_completed_mileage is null', () => {
      const reminder = {
        interval_km: 5000,
        interval_months: null,
        base_mileage: 10000,
        base_date: null,
        last_completed_mileage: null,
        last_completed_date: null,
      };

      // next due: 15000
      // current: 12000 -> remaining 3000 -> OK
      expect(evaluateReminderStatus(reminder, 12000).status).toBe('OK');
      // current: 14600 -> remaining 400 (<= 500) -> DUE_SOON
      expect(evaluateReminderStatus(reminder, 14600).status).toBe('DUE_SOON');
      // current: 15000 -> remaining 0 -> OVERDUE
      expect(evaluateReminderStatus(reminder, 15000).status).toBe('OVERDUE');
      // current: 15500 -> OVERDUE
      expect(evaluateReminderStatus(reminder, 15500).status).toBe('OVERDUE');
    });

    it('prioritizes last_completed_mileage over base_mileage for next cycle', () => {
      const reminder = {
        interval_km: 5000,
        interval_months: null,
        base_mileage: 10000,
        base_date: null,
        last_completed_mileage: 15200, // completed at 15200
        last_completed_date: null,
      };

      // next due: 15200 + 5000 = 20200
      const result = evaluateReminderStatus(reminder, 18000);
      expect(result.nextDueMileage).toBe(20200);
      expect(result.remainingMileage).toBe(2200);
      expect(result.status).toBe('OK');

      // at 19800: remaining 400 <= 500 -> DUE_SOON
      expect(evaluateReminderStatus(reminder, 19800).status).toBe('DUE_SOON');
    });

    it('evaluates based on date interval when interval_km is null', () => {
      const reminder = {
        interval_km: null,
        interval_months: 6,
        base_mileage: null,
        base_date: '2026-01-01',
        last_completed_mileage: null,
        last_completed_date: null,
      };

      // next due date: 2026-07-01
      const todayOk = '2026-05-01';
      expect(evaluateReminderStatus(reminder, 0, todayOk).status).toBe('OK');

      // today is 2026-06-20 (11 days remaining <= 14) -> DUE_SOON
      const todayDueSoon = '2026-06-20';
      expect(evaluateReminderStatus(reminder, 0, todayDueSoon).status).toBe('DUE_SOON');

      // today is 2026-07-01 -> OVERDUE
      const todayOverdue = '2026-07-01';
      expect(evaluateReminderStatus(reminder, 0, todayOverdue).status).toBe('OVERDUE');
    });

    it('triggers OVERDUE if either mileage or date exceeds due target', () => {
      const reminder = {
        interval_km: 5000,
        interval_months: 6,
        base_mileage: 10000,
        base_date: '2026-01-01',
        last_completed_mileage: null,
        last_completed_date: null,
      };

      // next due mileage: 15000, next due date: 2026-07-01
      // Case 1: Mileage ok (12000), but date overdue (2026-07-15) -> OVERDUE
      expect(evaluateReminderStatus(reminder, 12000, '2026-07-15').status).toBe('OVERDUE');

      // Case 2: Date ok (2026-03-01), but mileage overdue (15500) -> OVERDUE
      expect(evaluateReminderStatus(reminder, 15500, '2026-03-01').status).toBe('OVERDUE');

      // Case 3: Both within range -> OK
      expect(evaluateReminderStatus(reminder, 12000, '2026-03-01').status).toBe('OK');
    });
  });
});
