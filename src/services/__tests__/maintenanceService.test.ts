import { maintenanceService } from '../maintenanceService';
import { requestApi } from '../apiClient';
import { storageService } from '../storageService';
import { reminderService } from '../reminderService';

jest.mock('../apiClient', () => ({
  requestApi: jest.fn(),
}));

jest.mock('../storageService', () => ({
  storageService: {
    deleteVehicleMedia: jest.fn().mockResolvedValue(undefined),
  },
}));

jest.mock('../reminderService', () => ({
  reminderService: {
    syncReminderBaseFromMaintenance: jest.fn().mockResolvedValue(undefined),
  },
}));

describe('maintenanceService (Go REST API decoupled)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('getMaintenanceRecords 呼叫 GET /vehicles/:vehicleId/maintenance', async () => {
    const mockList = [
      {
        id: 1,
        vehicle_id: 10,
        record_type: 'maintenance',
        item_name: '定期小保養',
        service_date: '2026-09-14',
        mileage: 15000,
        cost: 2800,
        photos: [],
      },
    ];
    (requestApi as jest.Mock).mockResolvedValue(mockList);

    const result = await maintenanceService.getMaintenanceRecords(10);

    expect(requestApi).toHaveBeenCalledWith('/vehicles/10/maintenance');
    expect(result).toEqual(mockList);
  });

  it('createRecordWithPhotos 呼叫 POST /vehicles/:vehicleId/maintenance 並附帶 photo_urls', async () => {
    const recordInput = {
      vehicle_id: 10,
      record_type: 'maintenance' as const,
      item_name: '定期小保養',
      service_date: '2026-09-14',
      mileage: 15000,
      cost: 2800,
    };
    const photoUrls = ['https://example.com/photo1.jpg'];
    const mockCreated = {
      id: 100,
      ...recordInput,
      photos: [{ id: 1, url: photoUrls[0], sort_order: 0 }],
    };
    (requestApi as jest.Mock).mockResolvedValue(mockCreated);

    const result = await maintenanceService.createRecordWithPhotos(recordInput, photoUrls);

    expect(requestApi).toHaveBeenCalledWith('/vehicles/10/maintenance', {
      method: 'POST',
      body: JSON.stringify({ ...recordInput, photo_urls: photoUrls }),
    });
    expect(result).toEqual(mockCreated);
  });

  it('updateMaintenanceRecord 呼叫 PATCH /maintenance/:id 並同步 reminderService 基準', async () => {
    const updateInput = {
      mileage: 16000,
      cost: 3200,
      service_date: '2026-09-15',
    };
    const updatedRecord = {
      id: 100,
      vehicle_id: 10,
      record_type: 'maintenance',
      item_name: '定期小保養',
      ...updateInput,
    };
    (requestApi as jest.Mock).mockResolvedValue(updatedRecord);

    const result = await maintenanceService.updateMaintenanceRecord(100, updateInput);

    expect(requestApi).toHaveBeenCalledWith('/maintenance/100', {
      method: 'PATCH',
      body: JSON.stringify(updateInput),
    });
    expect(reminderService.syncReminderBaseFromMaintenance).toHaveBeenCalledWith(
      100,
      16000,
      '2026-09-15'
    );
    expect(result).toEqual(updatedRecord);
  });

  it('deleteMaintenanceRecord 呼叫 DELETE /maintenance/:id', async () => {
    (requestApi as jest.Mock).mockResolvedValue(undefined);

    await maintenanceService.deleteMaintenanceRecord(100, 10);

    expect(requestApi).toHaveBeenCalledWith('/maintenance/100', {
      method: 'DELETE',
    });
  });

  it('addMaintenancePhotos 呼叫 POST /maintenance/:id/photos', async () => {
    const photoUrls = ['https://example.com/photo2.jpg'];
    const mockAdded = [{ id: 2, url: photoUrls[0], sort_order: 0 }];
    (requestApi as jest.Mock).mockResolvedValue(mockAdded);

    const result = await maintenanceService.addMaintenancePhotos(100, photoUrls);

    expect(requestApi).toHaveBeenCalledWith('/maintenance/100/photos', {
      method: 'POST',
      body: JSON.stringify({ photo_urls: photoUrls }),
    });
    expect(result).toEqual(mockAdded);
  });

  it('deleteMaintenancePhoto 呼叫 DELETE /maintenance/photos/:photoId 並清除 Storage 實體', async () => {
    (requestApi as jest.Mock).mockResolvedValue({ photo_url: 'https://example.com/photo2.jpg' });

    await maintenanceService.deleteMaintenancePhoto(2);

    expect(requestApi).toHaveBeenCalledWith('/maintenance/photos/2', {
      method: 'DELETE',
    });
    expect(storageService.deleteVehicleMedia).toHaveBeenCalledWith('https://example.com/photo2.jpg');
  });
});