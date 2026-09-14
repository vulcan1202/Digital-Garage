import {
  calculateVehicleTotalCost,
  calculateAverageCostPerKm,
} from '../costCalculator';

describe('costCalculator', () => {
  describe('calculateVehicleTotalCost', () => {
    it('sums fuel, maintenance, modification purchase and install costs accurately', () => {
      const fuelRecords = [{ total_cost: 1200 }, { total_cost: 1500 }];
      const maintenanceRecords = [{ cost: 3500 }, { cost: 800 }];
      const modifications = [
        { purchase_price: 25000, install_price: 3000 },
        { purchase_price: 12000, install_price: 1500 },
      ];

      const result = calculateVehicleTotalCost(fuelRecords, maintenanceRecords, modifications);
      expect(result).toEqual({
        fuelCost: 2700,
        maintenanceCost: 4300,
        modificationPurchaseCost: 37000,
        modificationInstallCost: 4500,
        operationalCost: 48500,
        purchasePrice: null,
        totalOwnershipCost: null,
        totalCost: 48500,
      });
    });

    it('sets totalOwnershipCost to null when purchasePrice is undefined or null', () => {
      const result = calculateVehicleTotalCost([{ total_cost: 1000 }], [], [], null);
      expect(result.purchasePrice).toBeNull();
      expect(result.totalOwnershipCost).toBeNull();
      expect(result.operationalCost).toBe(1000);
    });

    it('correctly calculates totalOwnershipCost when purchasePrice is 0 (gift or free)', () => {
      const result = calculateVehicleTotalCost([{ total_cost: 1000 }], [], [], 0);
      expect(result.purchasePrice).toBe(0);
      expect(result.totalOwnershipCost).toBe(1000);
      expect(result.operationalCost).toBe(1000);
    });

    it('correctly calculates totalOwnershipCost when purchasePrice is positive', () => {
      const result = calculateVehicleTotalCost([{ total_cost: 2000 }], [], [], 500000);
      expect(result.purchasePrice).toBe(500000);
      expect(result.operationalCost).toBe(2000);
      expect(result.totalOwnershipCost).toBe(502000);
    });

    it('safely tolerates null, undefined or empty arrays', () => {
      const fuelRecords = [{ total_cost: null }, { total_cost: 1000 }];
      const maintenanceRecords = [{ cost: undefined }];
      const modifications = [{ purchase_price: null, install_price: undefined }];

      const result = calculateVehicleTotalCost(fuelRecords, maintenanceRecords, modifications);
      expect(result).toEqual({
        fuelCost: 1000,
        maintenanceCost: 0,
        modificationPurchaseCost: 0,
        modificationInstallCost: 0,
        operationalCost: 1000,
        purchasePrice: null,
        totalOwnershipCost: null,
        totalCost: 1000,
      });
    });
  });

  describe('calculateAverageCostPerKm', () => {
    it('calculates average cost per km for valid mileage span', () => {
      // 30000 total cost, span: 20000 - 10000 = 10000 -> 3.00 $/km
      expect(calculateAverageCostPerKm(30000, 10000, 20000)).toBe(3);
    });

    it('returns null if maxMileage <= minMileage (span <= 0)', () => {
      expect(calculateAverageCostPerKm(10000, 15000, 15000)).toBeNull();
      expect(calculateAverageCostPerKm(10000, 15000, 10000)).toBeNull();
    });

    it('returns null if cost is null or undefined', () => {
      expect(calculateAverageCostPerKm(null, 0, 1000)).toBeNull();
      expect(calculateAverageCostPerKm(undefined, 0, 1000)).toBeNull();
    });

    it('returns null for non-finite or negative cost values', () => {
      expect(calculateAverageCostPerKm(-500, 0, 1000)).toBeNull();
      expect(calculateAverageCostPerKm(NaN, 0, 1000)).toBeNull();
    });
  });
});
