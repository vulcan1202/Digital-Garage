/**
 * Cost Calculator (純函式)
 * 零依賴、無副作用、相同輸入必得相同輸出
 */

export interface CostBreakdown {
  fuelCost: number;
  maintenanceCost: number;
  modificationPurchaseCost: number;
  modificationInstallCost: number;
  totalCost: number;
}

/**
 * 累加全車生命週期總花費
 * 包含：加油花費、保養維修花費、改裝品購買費用、改裝品安裝工資
 */
export function calculateVehicleTotalCost(
  fuelRecords: { total_cost?: number | null }[] = [],
  maintenanceRecords: { cost?: number | null }[] = [],
  modifications: { purchase_price?: number | null; install_price?: number | null }[] = []
): CostBreakdown {
  let fuelCost = 0;
  for (const f of fuelRecords) {
    if (typeof f.total_cost === 'number' && Number.isFinite(f.total_cost) && f.total_cost > 0) {
      fuelCost += f.total_cost;
    }
  }

  let maintenanceCost = 0;
  for (const m of maintenanceRecords) {
    if (typeof m.cost === 'number' && Number.isFinite(m.cost) && m.cost > 0) {
      maintenanceCost += m.cost;
    }
  }

  let modificationPurchaseCost = 0;
  let modificationInstallCost = 0;
  for (const mod of modifications) {
    if (typeof mod.purchase_price === 'number' && Number.isFinite(mod.purchase_price) && mod.purchase_price > 0) {
      modificationPurchaseCost += mod.purchase_price;
    }
    if (typeof mod.install_price === 'number' && Number.isFinite(mod.install_price) && mod.install_price > 0) {
      modificationInstallCost += mod.install_price;
    }
  }

  const totalCost = Number(
    (fuelCost + maintenanceCost + modificationPurchaseCost + modificationInstallCost).toFixed(2)
  );

  return {
    fuelCost: Number(fuelCost.toFixed(2)),
    maintenanceCost: Number(maintenanceCost.toFixed(2)),
    modificationPurchaseCost: Number(modificationPurchaseCost.toFixed(2)),
    modificationInstallCost: Number(modificationInstallCost.toFixed(2)),
    totalCost,
  };
}

/**
 * 計算全車平均每公里總花費
 * @param totalCost 全車總費用
 * @param minMileage 起始里程 (通常為購車里程或首筆事件里程)
 * @param maxMileage 當前里程或最大紀錄里程
 * @returns 若 mileageSpan <= 0，一律回傳 null，嚴禁除以 0 產生 NaN 或 Infinity。
 */
export function calculateAverageCostPerKm(
  totalCost: number,
  minMileage: number,
  maxMileage: number
): number | null {
  if (
    !Number.isFinite(totalCost) ||
    !Number.isFinite(minMileage) ||
    !Number.isFinite(maxMileage) ||
    totalCost < 0
  ) {
    return null;
  }

  const mileageSpan = maxMileage - minMileage;
  if (mileageSpan <= 0) {
    return null;
  }

  return Number((totalCost / mileageSpan).toFixed(2));
}
