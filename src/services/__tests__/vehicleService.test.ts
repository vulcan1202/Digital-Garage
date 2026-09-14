import { vehicleService } from '../vehicleService';
import { requestApi } from '../apiClient';
import { storageService } from '../storageService';

jest.mock('../apiClient', () => ({
  requestApi: jest.fn(),
}));

jest.mock('../storageService', () => ({
  storageService: {
    deleteVehicleMedia: jest.fn().mockResolvedValue(undefined),
  },
}));

describe('vehicleService (Go REST API decoupled)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('getVehicles 呼叫 GET /vehicles 並回傳整合封面資料', async () => {
    const mockVehicles = [
      {
        id: 1,
        brand: 'Porsche',
        model: '911 GT3',
        cover_url: 'https://example.com/cover.jpg',
      },
    ];
    (requestApi as jest.Mock).mockResolvedValue(mockVehicles);

    const result = await vehicleService.getVehicles();

    expect(requestApi).toHaveBeenCalledWith('/vehicles');
    expect(result).toEqual(mockVehicles);
  });

  it('getVehicleById 呼叫 GET /vehicles/:id 並取得包含所有照片的車輛詳情', async () => {
    const mockVehicleWithPhotos = {
      id: 1,
      brand: 'Honda',
      model: 'Civic',
      photos: [{ id: 10, url: 'https://example.com/p1.jpg', is_cover: true }],
    };
    (requestApi as jest.Mock).mockResolvedValue(mockVehicleWithPhotos);

    const result = await vehicleService.getVehicleById(1);

    expect(requestApi).toHaveBeenCalledWith('/vehicles/1');
    expect(result).toEqual(mockVehicleWithPhotos);
  });

  it('createVehicle 呼叫 POST /vehicles', async () => {
    const newVehicleInput = {
      brand: 'Toyota',
      model: 'GR Yaris',
      vehicle_type: 'car' as const,
      license_plate: 'RAC-1234',
      initial_mileage: 500,
    };
    const createdVehicle = { id: 2, ...newVehicleInput, current_mileage: 500 };
    (requestApi as jest.Mock).mockResolvedValue(createdVehicle);

    const result = await vehicleService.createVehicle(newVehicleInput);

    expect(requestApi).toHaveBeenCalledWith('/vehicles', {
      method: 'POST',
      body: JSON.stringify(newVehicleInput),
    });
    expect(result).toEqual(createdVehicle);
  });

  it('updateVehicle 呼叫 PATCH /vehicles/:id', async () => {
    const updateInput = { brand: 'Toyota Gazoo', current_mileage: 1200 };
    (requestApi as jest.Mock).mockResolvedValue({ id: 2, ...updateInput });

    const result = await vehicleService.updateVehicle(2, updateInput);

    expect(requestApi).toHaveBeenCalledWith('/vehicles/2', {
      method: 'PATCH',
      body: JSON.stringify(updateInput),
    });
    expect(result.brand).toBe('Toyota Gazoo');
  });

  it('deleteVehicle 呼叫 DELETE /vehicles/:id', async () => {
    (requestApi as jest.Mock).mockResolvedValue(undefined);

    await vehicleService.deleteVehicle(2);

    expect(requestApi).toHaveBeenCalledWith('/vehicles/2', {
      method: 'DELETE',
    });
  });

  it('addVehiclePhoto 呼叫 POST /vehicles/:id/photos', async () => {
    const mockPhoto = { id: 100, vehicle_id: 1, url: 'https://example.com/car.jpg', is_cover: true };
    (requestApi as jest.Mock).mockResolvedValue(mockPhoto);

    const result = await vehicleService.addVehiclePhoto(1, 'https://example.com/car.jpg', true, 1);

    expect(requestApi).toHaveBeenCalledWith('/vehicles/1/photos', {
      method: 'POST',
      body: JSON.stringify({
        url: 'https://example.com/car.jpg',
        is_cover: true,
        sort_order: 1,
      }),
    });
    expect(result).toEqual(mockPhoto);
  });

  it('setCoverPhoto 呼叫 PATCH /vehicles/:id/photos/:photoId/cover', async () => {
    (requestApi as jest.Mock).mockResolvedValue({ success: true });

    await vehicleService.setCoverPhoto(1, 100);

    expect(requestApi).toHaveBeenCalledWith('/vehicles/1/photos/100/cover', {
      method: 'PATCH',
    });
  });

  it('deleteVehiclePhoto 呼叫 DELETE /vehicles/:id/photos/:photoId 並清理實體 Storage 檔案', async () => {
    (requestApi as jest.Mock)
      .mockResolvedValueOnce([{ id: 100, url: 'https://example.com/car.jpg' }]) // getVehiclePhotos
      .mockResolvedValueOnce(undefined); // DELETE

    await vehicleService.deleteVehiclePhoto(100, 1);

    expect(requestApi).toHaveBeenCalledWith('/vehicles/1/photos/100', {
      method: 'DELETE',
    });
    expect(storageService.deleteVehicleMedia).toHaveBeenCalledWith('https://example.com/car.jpg');
  });
});
