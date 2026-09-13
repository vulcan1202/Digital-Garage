export const queryKeys = {
  vehicles: ['vehicles'] as const,
  vehicle: (id: number) => ['vehicles', id] as const,
  refuels: (vehicleId: number) => ['refuels', vehicleId] as const,
  maintenance: (vehicleId: number) => ['maintenance', vehicleId] as const,
  reminders: (vehicleId: number) => ['reminders', vehicleId] as const,
  modifications: (vehicleId: number) => ['modifications', vehicleId] as const,
  modificationDetail: (id: number) => ['modifications', 'detail', id] as const,
  timeline: (vehicleId: number) => ['timeline', vehicleId] as const,
};
