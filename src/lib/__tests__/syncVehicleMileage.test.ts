jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn().mockResolvedValue(null),
  setItemAsync: jest.fn().mockResolvedValue(null),
}));

import { localStore } from '../localStore';

const TEST_USER_ID = 'test-user-123';

describe('syncVehicleMaxMileage & initial_mileage logic', () => {
  beforeEach(async () => {
    // 建立一輛測試車輛
    await localStore.createVehicle({
      user_id: TEST_USER_ID,
      brand: 'Toyota',
      model: 'GR Yaris',
      vehicle_type: 'car',
      year: 2023,
      initial_mileage: 10000,
      current_mileage: 10000,
    });
  });

  it('correctly updates current_mileage to the maximum of records and initial_mileage', async () => {
    const vehicles = await localStore.getVehicles(TEST_USER_ID);
    const vehicle = vehicles[0];
    expect(vehicle.initial_mileage).toBe(10000);
    expect(vehicle.current_mileage).toBe(10000);

    // 1. 新增加油紀錄 12000 KM -> current_mileage 升至 12000
    const refuel1 = await localStore.addRefuel({
      vehicle_id: vehicle.id,
      refuel_date: '2024-01-01',
      mileage: 12000,
      volume: 35,
      total_cost: 1100,
      fuel_type: 'gasoline_98',
    });

    let updatedVehicle = (await localStore.getVehicles(TEST_USER_ID)).find((v) => v.id === vehicle.id)!;
    expect(updatedVehicle.current_mileage).toBe(12000);
    expect(updatedVehicle.initial_mileage).toBe(10000); // initial_mileage 保持不變

    // 2. 新增保養紀錄手誤輸入超大里程 99999 KM -> current_mileage 升至 99999
    const maint1 = await localStore.addMaintenanceRecord({
      vehicle_id: vehicle.id,
      record_type: 'maintenance',
      item_name: '換機油',
      service_date: '2024-01-05',
      mileage: 99999,
      cost: 3500,
    });

    updatedVehicle = (await localStore.getVehicles(TEST_USER_ID)).find((v) => v.id === vehicle.id)!;
    expect(updatedVehicle.current_mileage).toBe(99999);

    // 3. 刪除該筆錯誤的 99999 KM 保養紀錄 -> 自動下修至剩餘最大紀錄 (12000 KM)
    await localStore.deleteMaintenanceRecord(maint1.id);

    updatedVehicle = (await localStore.getVehicles(TEST_USER_ID)).find((v) => v.id === vehicle.id)!;
    expect(updatedVehicle.current_mileage).toBe(12000); // 成功回滾下修，未受污染！
    expect(updatedVehicle.initial_mileage).toBe(10000);

    // 4. 刪除該筆 12000 KM 加油紀錄 -> 無任何紀錄時，下修至 initial_mileage (10000 KM)
    await localStore.deleteRefuel(refuel1.id);

    updatedVehicle = (await localStore.getVehicles(TEST_USER_ID)).find((v) => v.id === vehicle.id)!;
    expect(updatedVehicle.current_mileage).toBe(10000);
    expect(updatedVehicle.initial_mileage).toBe(10000);
  });

  it('recalibrates current_mileage when records are added or deleted while initial_mileage remains immutable', async () => {
    const vehicles = await localStore.getVehicles(TEST_USER_ID);
    const vehicle = vehicles[0];

    // 新增加油 15000 KM
    await localStore.addRefuel({
      vehicle_id: vehicle.id,
      refuel_date: '2024-01-01',
      mileage: 15000,
      volume: 35,
      total_cost: 1100,
      fuel_type: 'gasoline_98',
    });

    let updatedVehicle = (await localStore.getVehicles(TEST_USER_ID)).find((v) => v.id === vehicle.id)!;
    expect(updatedVehicle.initial_mileage).toBe(10000); // 基準里程維持不變
    expect(updatedVehicle.current_mileage).toBe(15000); // 由加油自動推進至 15000

    // 更新車輛當前里程：手動校正為 18000
    await localStore.updateVehicle(vehicle.id, {
      current_mileage: 18000,
    });

    updatedVehicle = (await localStore.getVehicles(TEST_USER_ID)).find((v) => v.id === vehicle.id)!;
    expect(updatedVehicle.initial_mileage).toBe(10000);
    expect(updatedVehicle.current_mileage).toBe(18000);
  });
});
