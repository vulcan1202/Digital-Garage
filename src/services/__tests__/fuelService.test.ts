import { fuelService } from '../fuelService';
import { requestApi } from '../apiClient';

jest.mock('../apiClient', () => ({
  requestApi: jest.fn(),
}));

describe('fuelService (Go REST API decoupled)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('getRefuels 呼叫 GET /vehicles/:vehicleId/refuels', async () => {
    const mockRefuels = [
      {
        id: 1,
        vehicle_id: 10,
        refuel_date: '2026-09-14',
        mileage: 12000,
        volume: 45,
        total_cost: 1350,
        fuel_type: 'gasoline_95',
      },
    ];
    (requestApi as jest.Mock).mockResolvedValue(mockRefuels);

    const result = await fuelService.getRefuels(10);

    expect(requestApi).toHaveBeenCalledWith('/vehicles/10/refuels');
    expect(result).toEqual(mockRefuels);
  });

  it('addRefuel 呼叫 POST /vehicles/:vehicleId/refuels', async () => {
    const inputData = {
      vehicle_id: 10,
      refuel_date: '2026-09-14',
      mileage: 12500,
      volume: 42.5,
      price_per_unit: 30,
      total_cost: 1275,
      fuel_type: 'gasoline_95' as const,
    };
    const createdData = { id: 2, ...inputData };
    (requestApi as jest.Mock).mockResolvedValue(createdData);

    const result = await fuelService.addRefuel(inputData);

    expect(requestApi).toHaveBeenCalledWith('/vehicles/10/refuels', {
      method: 'POST',
      body: JSON.stringify(inputData),
    });
    expect(result).toEqual(createdData);
  });

  it('updateRefuel 呼叫 PATCH /refuels/:id', async () => {
    const updateInput = {
      mileage: 12600,
      total_cost: 1300,
    };
    (requestApi as jest.Mock).mockResolvedValue({ id: 2, ...updateInput });

    const result = await fuelService.updateRefuel(2, updateInput);

    expect(requestApi).toHaveBeenCalledWith('/refuels/2', {
      method: 'PATCH',
      body: JSON.stringify(updateInput),
    });
    expect(result.mileage).toBe(12600);
  });

  it('deleteRefuel 呼叫 DELETE /refuels/:id', async () => {
    (requestApi as jest.Mock).mockResolvedValue(undefined);

    await fuelService.deleteRefuel(2);

    expect(requestApi).toHaveBeenCalledWith('/refuels/2', {
      method: 'DELETE',
    });
  });
});
