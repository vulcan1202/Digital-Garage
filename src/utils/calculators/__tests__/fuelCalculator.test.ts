import { calculateFuelEconomy, calculateAverageFuelCostPerKm } from '../fuelCalculator';

describe('fuelCalculator', () => {
  describe('calculateFuelEconomy', () => {
    it('returns null if there is no previous refuel record (first refuel)', () => {
      const current = { mileage: 15000, volume: 45 };
      expect(calculateFuelEconomy(current, null)).toBeNull();
      expect(calculateFuelEconomy(current, undefined)).toBeNull();
    });

    it('calculates correct kmPerLiter and litersPer100Km for valid consecutive records', () => {
      const prev = { mileage: 10000 };
      const current = { mileage: 10500, volume: 50 }; // distance = 500km, volume = 50L -> 10 km/L, 10 L/100km
      const result = calculateFuelEconomy(current, prev);
      expect(result).toEqual({
        kmPerLiter: 10,
        litersPer100Km: 10,
      });
    });

    it('returns null if current mileage is less than or equal to previous mileage (distance <= 0)', () => {
      const prev = { mileage: 10000 };
      expect(calculateFuelEconomy({ mileage: 10000, volume: 50 }, prev)).toBeNull();
      expect(calculateFuelEconomy({ mileage: 9800, volume: 50 }, prev)).toBeNull();
    });

    it('returns null if volume is zero or negative', () => {
      const prev = { mileage: 10000 };
      expect(calculateFuelEconomy({ mileage: 10500, volume: 0 }, prev)).toBeNull();
      expect(calculateFuelEconomy({ mileage: 10500, volume: -10 }, prev)).toBeNull();
    });
  });

  describe('calculateAverageFuelCostPerKm', () => {
    it('returns null if records has less than 2 items', () => {
      expect(calculateAverageFuelCostPerKm([])).toBeNull();
      expect(calculateAverageFuelCostPerKm([{ mileage: 1000, total_cost: 1500 }])).toBeNull();
    });

    it('calculates correct average cost per km across multiple records', () => {
      const records = [
        { mileage: 10000, total_cost: 1200 },
        { mileage: 10500, total_cost: 1400 },
        { mileage: 11000, total_cost: 1400 },
      ];
      // Total cost = 4000, distance span = 11000 - 10000 = 1000 -> 4.00 $/km
      expect(calculateAverageFuelCostPerKm(records)).toBe(4);
    });

    it('returns null if mileage span <= 0 (e.g. all records have same mileage)', () => {
      const records = [
        { mileage: 10000, total_cost: 1200 },
        { mileage: 10000, total_cost: 1400 },
      ];
      expect(calculateAverageFuelCostPerKm(records)).toBeNull();
    });
  });
});
