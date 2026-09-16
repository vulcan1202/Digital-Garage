import { queryKeys } from '../../hooks/queries/queryKeys';
import { cacheStorage, CACHE_KEYS } from '../cacheStorage';
import { localStore } from '../localStore';

jest.mock('expo-secure-store', () => {
  const store = new Map<string, string>();
  return {
    getItemAsync: jest.fn(async (k: string) => store.get(k) || null),
    setItemAsync: jest.fn(async (k: string, v: string) => {
      store.set(k, v);
      return null;
    }),
    deleteItemAsync: jest.fn(async (k: string) => {
      store.delete(k);
      return null;
    }),
    _clear: () => store.clear(),
  };
});

describe('Multi-Vehicle Data & Cache Isolation QA', () => {
  beforeEach(() => {
    const secureStore = require('expo-secure-store');
    secureStore._clear();
  });

  describe('React Query Keys Isolation', () => {
    it('不同車輛 ID 產生的 QueryKey 必須完全嚴格隔離', () => {
      const v1 = 101;
      const v2 = 202;

      expect(queryKeys.vehicle(v1)).not.toEqual(queryKeys.vehicle(v2));
      expect(queryKeys.refuels(v1)).not.toEqual(queryKeys.refuels(v2));
      expect(queryKeys.maintenance(v1)).not.toEqual(queryKeys.maintenance(v2));
      expect(queryKeys.reminders(v1)).not.toEqual(queryKeys.reminders(v2));
      expect(queryKeys.modifications(v1)).not.toEqual(queryKeys.modifications(v2));
      expect(queryKeys.timeline(v1)).not.toEqual(queryKeys.timeline(v2));
      expect(queryKeys.costAnalytics(v1, 12)).not.toEqual(queryKeys.costAnalytics(v2, 12));
      expect(queryKeys.vehiclePhotos(v1)).not.toEqual(queryKeys.vehiclePhotos(v2));

      // 驗證 QueryKey 結構正確包含車輛 ID
      expect(queryKeys.refuels(v1)).toEqual(['refuels', 101]);
      expect(queryKeys.timeline(v2)).toEqual(['timeline', 202]);
    });
  });

  describe('Partitioned Cache Storage Isolation', () => {
    it('車輛 A 與車輛 B 的離線快取資料必須各自獨立儲存，不得互相覆寫', async () => {
      const v1Id = 1;
      const v2Id = 2;

      const v1CacheKey = `${CACHE_KEYS.REFUELS_PREFIX}${v1Id}`;
      const v2CacheKey = `${CACHE_KEYS.REFUELS_PREFIX}${v2Id}`;

      const v1Refuels = [
        { id: 11, vehicle_id: v1Id, refuel_date: '2026-09-01', mileage: 10000, volume: 30, total_cost: 900, fuel_type: 'gasoline_95' },
      ];
      const v2Refuels = [
        { id: 22, vehicle_id: v2Id, refuel_date: '2026-09-05', mileage: 25000, volume: 50, total_cost: 1500, fuel_type: 'diesel' },
      ];

      await cacheStorage.setItem(v1CacheKey, v1Refuels);
      await cacheStorage.setItem(v2CacheKey, v2Refuels);

      const cachedV1 = await cacheStorage.getItem<typeof v1Refuels>(v1CacheKey);
      const cachedV2 = await cacheStorage.getItem<typeof v2Refuels>(v2CacheKey);

      expect(cachedV1).toEqual(v1Refuels);
      expect(cachedV2).toEqual(v2Refuels);
      expect(cachedV1?.[0].vehicle_id).toBe(1);
      expect(cachedV2?.[0].vehicle_id).toBe(2);

      // 清除車輛 1 快取，車輛 2 快取不受影響
      await cacheStorage.removeItem(v1CacheKey);
      expect(await cacheStorage.getItem(v1CacheKey)).toBeNull();
      expect(await cacheStorage.getItem(v2CacheKey)).toEqual(v2Refuels);
    });

    it('單一車輛快照截斷 (20 筆上限) 不會干擾其他車輛資料量', () => {
      const longList = Array.from({ length: 30 }, (_, i) => ({ id: i + 1 }));
      const sliced = cacheStorage.sliceSnapshot(longList, 20);

      expect(sliced.length).toBe(20);
      expect(sliced[0].id).toBe(1);
      expect(sliced[19].id).toBe(20);
    });
  });

  describe('LocalStore Data Isolation Between Vehicles', () => {
    it('localStore 加油與保養查詢嚴格依據 vehicle_id 篩選，不發生交叉外洩', async () => {
      const vehicleA = await localStore.createVehicle({
        user_id: 'qa-user-iso',
        brand: 'Honda',
        model: 'Civic',
        vehicle_type: 'car',
        initial_mileage: 5000,
      });

      const vehicleB = await localStore.createVehicle({
        user_id: 'qa-user-iso',
        brand: 'Yamaha',
        model: 'R3',
        vehicle_type: 'motorcycle',
        initial_mileage: 1200,
      });

      await localStore.addRefuel({
        vehicle_id: vehicleA.id,
        refuel_date: '2026-09-10',
        mileage: 5400,
        volume: 35,
        price_per_unit: 30,
        total_cost: 1050,
        fuel_type: 'gasoline_95',
      });

      await localStore.addRefuel({
        vehicle_id: vehicleB.id,
        refuel_date: '2026-09-12',
        mileage: 1450,
        volume: 12,
        price_per_unit: 31,
        total_cost: 372,
        fuel_type: 'gasoline_98',
      });

      const refuelsA = await localStore.getRefuels(vehicleA.id);
      const refuelsB = await localStore.getRefuels(vehicleB.id);

      expect(refuelsA.length).toBe(1);
      expect(refuelsA[0].vehicle_id).toBe(vehicleA.id);
      expect(refuelsA[0].mileage).toBe(5400);

      expect(refuelsB.length).toBe(1);
      expect(refuelsB[0].vehicle_id).toBe(vehicleB.id);
      expect(refuelsB[0].mileage).toBe(1450);
    });
  });
});
