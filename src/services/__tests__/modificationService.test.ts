import { modificationService } from '../modificationService';
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

describe('modificationService (Go REST API decoupled)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('getModifications 呼叫 GET /vehicles/:vehicleId/modifications', async () => {
    const mockList = [
      {
        id: 1,
        vehicle_id: 10,
        item_name: 'Brembo 前大六活塞煞車套件',
        category: 'braking',
      },
    ];
    (requestApi as jest.Mock).mockResolvedValue(mockList);

    const result = await modificationService.getModifications(10);

    expect(requestApi).toHaveBeenCalledWith('/vehicles/10/modifications');
    expect(result).toEqual(mockList);
  });

  it('getModificationDetails 呼叫 GET /modifications/:id', async () => {
    const mockDetails = {
      id: 1,
      vehicle_id: 10,
      item_name: 'Ohlins DFV 避震器',
      category: 'suspension',
      photos: [],
      setting_sets: [],
    };
    (requestApi as jest.Mock).mockResolvedValue(mockDetails);

    const result = await modificationService.getModificationDetails(1);

    expect(requestApi).toHaveBeenCalledWith('/modifications/1');
    expect(result).toEqual(mockDetails);
  });

  it('addModification 呼叫 POST /vehicles/:vehicleId/modifications', async () => {
    const inputData = {
      vehicle_id: 10,
      item_name: '進氣肥腸',
      category: 'intake' as const,
      purchase_price: 3500,
      install_price: 500,
    };
    const createdData = { id: 2, ...inputData };
    (requestApi as jest.Mock).mockResolvedValue(createdData);

    const result = await modificationService.addModification(inputData);

    expect(requestApi).toHaveBeenCalledWith('/vehicles/10/modifications', {
      method: 'POST',
      body: JSON.stringify(inputData),
    });
    expect(result).toEqual(createdData);
  });

  it('updateModification 呼叫 PATCH /modifications/:id', async () => {
    const updateInput = {
      note: '已更換進氣濾芯',
    };
    (requestApi as jest.Mock).mockResolvedValue({ id: 2, ...updateInput });

    const result = await modificationService.updateModification(2, updateInput);

    expect(requestApi).toHaveBeenCalledWith('/modifications/2', {
      method: 'PATCH',
      body: JSON.stringify(updateInput),
    });
    expect(result.note).toBe('已更換進氣濾芯');
  });

  it('createSettingSet 呼叫 POST /modifications/:id/setting-sets 並格式化 payload', async () => {
    const setData = {
      name: '賽道調校版本',
      recorded_date: '2026-09-14',
      mileage: 18000,
      is_current: true,
    };
    const settings = [
      { setting_name: '阻尼段數', setting_value: '10', unit: '段' },
    ];
    const mockCreatedSet = {
      id: 5,
      modification_id: 2,
      ...setData,
      settings: [{ id: 10, setting_set_id: 5, ...settings[0] }],
    };
    (requestApi as jest.Mock).mockResolvedValue(mockCreatedSet);

    const result = await modificationService.createSettingSet(2, setData, settings);

    expect(requestApi).toHaveBeenCalledWith('/modifications/2/setting-sets', {
      method: 'POST',
      body: JSON.stringify({
        name: '賽道調校版本',
        recorded_date: '2026-09-14',
        mileage: 18000,
        note: null,
        is_current: true,
        settings: [{ setting_name: '阻尼段數', setting_value: '10', unit: '段' }],
      }),
    });
    expect(result).toEqual(mockCreatedSet);
  });

  it('setCurrentSettingSet 呼叫 PUT /modifications/:id/setting-sets/:setId/current', async () => {
    (requestApi as jest.Mock).mockResolvedValue({ status: 'ok' });

    await modificationService.setCurrentSettingSet(2, 5);

    expect(requestApi).toHaveBeenCalledWith('/modifications/2/setting-sets/5/current', {
      method: 'PUT',
    });
  });

  it('deleteModification 呼叫 DELETE /modifications/:id', async () => {
    (requestApi as jest.Mock).mockResolvedValue(undefined);

    await modificationService.deleteModification(2, 10);

    expect(requestApi).toHaveBeenCalledWith('/modifications/2', {
      method: 'DELETE',
    });
  });

  it('addModificationPhotos 呼叫 POST /modifications/:id/photos', async () => {
    const photos = [{ url: 'https://example.com/mod.jpg', photo_type: 'installed' }];
    const mockAdded = [{ id: 1, modification_id: 2, ...photos[0], sort_order: 0 }];
    (requestApi as jest.Mock).mockResolvedValue(mockAdded);

    const result = await modificationService.addModificationPhotos(2, photos);

    expect(requestApi).toHaveBeenCalledWith('/modifications/2/photos', {
      method: 'POST',
      body: JSON.stringify({ photos }),
    });
    expect(result).toEqual(mockAdded);
  });

  it('deleteModificationPhoto 呼叫 DELETE /modifications/photos/:photoId 並清除 Storage', async () => {
    (requestApi as jest.Mock).mockResolvedValue({ photo_url: 'https://example.com/mod.jpg' });

    await modificationService.deleteModificationPhoto(1);

    expect(requestApi).toHaveBeenCalledWith('/modifications/photos/1', {
      method: 'DELETE',
    });
    expect(storageService.deleteVehicleMedia).toHaveBeenCalledWith('https://example.com/mod.jpg');
  });
});
