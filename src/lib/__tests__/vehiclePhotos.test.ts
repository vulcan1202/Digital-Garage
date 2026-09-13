jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn().mockResolvedValue(null),
  setItemAsync: jest.fn().mockResolvedValue(null),
}));

import { localStore } from '../localStore';

describe('Vehicle Photos & Cover Transfer Logic', () => {
  const testUserId = 'user-photo-test-uuid';

  it('刪除當前封面照片時，若仍有剩餘照片應自動將下一張設為封面', async () => {
    // 建立測試車輛
    const vehicle = await localStore.createVehicle({
      user_id: testUserId,
      brand: 'Porsche',
      model: '911 GT3',
      initial_mileage: 1000,
    });

    // 加入第 1 張照片 (設為封面)
    const photo1 = await localStore.addVehiclePhoto({
      vehicle_id: vehicle.id,
      url: 'https://example.com/photo1.jpg',
      is_cover: true,
      sort_order: 0,
    });

    // 加入第 2 張照片 (非封面)
    const photo2 = await localStore.addVehiclePhoto({
      vehicle_id: vehicle.id,
      url: 'https://example.com/photo2.jpg',
      is_cover: false,
      sort_order: 1,
    });

    let photos = await localStore.getVehiclePhotos(vehicle.id);
    expect(photos.find((p) => p.id === photo1.id)?.is_cover).toBe(true);
    expect(photos.find((p) => p.id === photo2.id)?.is_cover).toBe(false);

    // 刪除第 1 張封面照片
    await localStore.deleteVehiclePhoto(photo1.id, vehicle.id);

    // 驗證剩餘照片中的 photo2 是否自動被提升為封面
    photos = await localStore.getVehiclePhotos(vehicle.id);
    expect(photos.length).toBe(1);
    expect(photos[0].id).toBe(photo2.id);
    expect(photos[0].is_cover).toBe(true);

    // 刪除所有照片後，列表應清空
    await localStore.deleteVehiclePhoto(photo2.id, vehicle.id);
    photos = await localStore.getVehiclePhotos(vehicle.id);
    expect(photos.length).toBe(0);
  });
});
