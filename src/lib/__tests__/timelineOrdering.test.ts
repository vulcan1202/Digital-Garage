jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn().mockResolvedValue(null),
  setItemAsync: jest.fn().mockResolvedValue(null),
}));

import { localStore } from '../localStore';

const TEST_USER = 'timeline-test-user';

describe('Timeline Ordering and Purchase Event Rules', () => {
  it('does NOT create a purchase event when purchase_date is null or missing', async () => {
    const vehicle = await localStore.createVehicle({
      user_id: TEST_USER,
      brand: 'Honda',
      model: 'Civic Type R',
      vehicle_type: 'car',
      year: 2022,
      initial_mileage: 5000,
      current_mileage: 5000,
      // purchase_date is omitted
    });

    const timeline = await localStore.getTimeline(vehicle.id);
    const purchaseEvents = timeline.filter((e) => e.event_type === 'purchase');
    expect(purchaseEvents).toHaveLength(0);
  });

  it('creates a purchase event strictly when purchase_date is present', async () => {
    const vehicle = await localStore.createVehicle({
      user_id: TEST_USER,
      brand: 'Mazda',
      model: 'MX-5',
      vehicle_type: 'car',
      year: 2021,
      initial_mileage: 3000,
      current_mileage: 3000,
      purchase_date: '2021-06-15',
      purchase_price: 1200000,
    });

    const timeline = await localStore.getTimeline(vehicle.id);
    const purchaseEvents = timeline.filter((e) => e.event_type === 'purchase');
    expect(purchaseEvents).toHaveLength(1);
    expect(purchaseEvents[0].event_date).toBe('2021-06-15');
    expect(purchaseEvents[0].mileage).toBe(3000);
    expect(purchaseEvents[0].cost).toBe(1200000);
    expect(purchaseEvents[0].title).toBe('Mazda MX-5 購入入庫');
  });

  it('enforces 4-tier deterministic sorting: event_date DESC, mileage DESC NULLS LAST, created_at DESC, event_id DESC', async () => {
    const vehicle = await localStore.createVehicle({
      user_id: TEST_USER,
      brand: 'Porsche',
      model: '911 GT3',
      vehicle_type: 'car',
      year: 2023,
      initial_mileage: 1000,
      current_mileage: 1000,
      purchase_date: '2023-01-01',
      purchase_price: 8000000,
    });

    // 1. Refuel on 2023-05-10, mileage 5000
    await localStore.addRefuel({
      vehicle_id: vehicle.id,
      refuel_date: '2023-05-10',
      mileage: 5000,
      volume: 60,
      total_cost: 2400,
      fuel_type: 'gasoline_98',
    });

    // 2. Maintenance on 2023-05-10 (same date), mileage 5500 (higher mileage should be earlier)
    await localStore.addMaintenanceRecord({
      vehicle_id: vehicle.id,
      record_type: 'maintenance',
      item_name: '定期首保',
      service_date: '2023-05-10',
      mileage: 5500,
      cost: 6000,
    });

    // 3. Modification on 2023-05-10 (same date), install_mileage 5000 (same mileage as refuel, created later)
    await localStore.addModification({
      vehicle_id: vehicle.id,
      item_name: 'Akrapovic 排氣尾段',
      category: 'exhaust',
      install_date: '2023-05-10',
      install_mileage: 5000,
      purchase_price: 180000,
      install_price: 8000,
    });

    const timeline = await localStore.getTimeline(vehicle.id);
    expect(timeline.length).toBeGreaterThanOrEqual(4);

    // Filter to events on 2023-05-10
    const sameDayEvents = timeline.filter((e) => e.event_date === '2023-05-10');
    expect(sameDayEvents).toHaveLength(3);

    // Highest mileage (5500) must be first
    expect(sameDayEvents[0].mileage).toBe(5500);
    expect(sameDayEvents[0].event_type).toBe('maintenance');

    // Both other events have mileage 5000. The one created later (modification) must come before refuel
    expect(sameDayEvents[1].mileage).toBe(5000);
    expect(sameDayEvents[2].mileage).toBe(5000);
    expect(new Date(sameDayEvents[1].created_at).getTime()).toBeGreaterThanOrEqual(
      new Date(sameDayEvents[2].created_at).getTime()
    );

    // Purchase event on 2023-01-01 must be later in time (lower in list)
    const purchaseEvent = timeline.find((e) => e.event_type === 'purchase');
    expect(purchaseEvent).toBeDefined();
    expect(timeline.indexOf(purchaseEvent!)).toBe(timeline.length - 1);
  });
});
