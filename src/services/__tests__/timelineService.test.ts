import { timelineService } from '../timelineService';
import { requestApi } from '../apiClient';

jest.mock('../apiClient', () => ({
  requestApi: jest.fn(),
}));

describe('timelineService (Go REST API decoupled)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('getVehicleTimeline 呼叫 GET /vehicles/:vehicleId/timeline 帶正確 query 參數', async () => {
    const mockTimeline = [
      {
        vehicle_id: 10,
        event_type: 'refuel' as const,
        event_id: 1,
        event_date: '2026-09-14',
        mileage: 12000,
        cost: 1350,
        title: 'gasoline_95',
        description: null,
        created_at: '2026-09-14T10:00:00Z',
      },
      {
        vehicle_id: 10,
        event_type: 'maintenance' as const,
        event_id: 1,
        event_date: '2026-09-10',
        mileage: 11500,
        cost: 2500,
        title: '定期小保養',
        description: '機油更換',
        created_at: '2026-09-10T09:00:00Z',
      },
    ];
    (requestApi as jest.Mock).mockResolvedValue(mockTimeline);

    const result = await timelineService.getVehicleTimeline({
      vehicleId: 10,
      limit: 20,
      offset: 0,
    });

    expect(requestApi).toHaveBeenCalledWith('/vehicles/10/timeline?limit=20&offset=0');
    expect(result).toEqual(mockTimeline);
  });

  it('getVehicleTimeline 支援自訂分頁 limit 與 offset', async () => {
    (requestApi as jest.Mock).mockResolvedValue([]);

    await timelineService.getVehicleTimeline({
      vehicleId: 5,
      limit: 10,
      offset: 20,
    });

    expect(requestApi).toHaveBeenCalledWith('/vehicles/5/timeline?limit=10&offset=20');
  });
});
