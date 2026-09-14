/**
 * Cost Calculator (純函式)
 * 零依賴、無副作用、相同輸入必得相同輸出
 */

export interface CostBreakdown {
  fuelCost: number;
  maintenanceCost: number;
  modificationPurchaseCost: number;
  modificationInstallCost: number;
  operationalCost: number;
  purchasePrice: number | null;
  totalOwnershipCost: number | null;
  // 向後相容 totalCost (等同 operationalCost)
  totalCost: number;
}

/**
 * 累加全車花費與總擁有成本
 * - 運作花費 (Operational Cost)：加油 + 保養維修 + 改裝品購買與安裝工資
 * - 總持有成本 (Total Ownership Cost)：購車金額 + 運作花費。
 *   若 purchasePrice 為 null，totalOwnershipCost 必須為 null，不得視為 0。
 */
export function calculateVehicleTotalCost(
  fuelRecords: { total_cost?: number | null }[] = [],
  maintenanceRecords: { cost?: number | null }[] = [],
  modifications: { purchase_price?: number | null; install_price?: number | null }[] = [],
  purchasePrice?: number | null
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

  const operationalCost = Number(
    (fuelCost + maintenanceCost + modificationPurchaseCost + modificationInstallCost).toFixed(2)
  );

  let totalOwnershipCost: number | null = null;
  let validPurchasePrice: number | null = null;

  if (typeof purchasePrice === 'number' && Number.isFinite(purchasePrice) && purchasePrice >= 0) {
    validPurchasePrice = Number(purchasePrice.toFixed(2));
    totalOwnershipCost = Number((validPurchasePrice + operationalCost).toFixed(2));
  }

  return {
    fuelCost: Number(fuelCost.toFixed(2)),
    maintenanceCost: Number(maintenanceCost.toFixed(2)),
    modificationPurchaseCost: Number(modificationPurchaseCost.toFixed(2)),
    modificationInstallCost: Number(modificationInstallCost.toFixed(2)),
    operationalCost,
    purchasePrice: validPurchasePrice,
    totalOwnershipCost,
    totalCost: operationalCost,
  };
}

/**
 * 計算全車平均每公里花費
 * @param cost 費用總額
 * @param minMileage 起始基準里程 (例如 initial_mileage)
 * @param maxMileage 當前里程 (例如 current_mileage)
 * @returns 若 mileageSpan <= 0 或 cost 非有效正數，一律回傳 null，嚴禁除以 0 產生 NaN 或 Infinity。
 */
export function calculateAverageCostPerKm(
  cost: number | null | undefined,
  minMileage: number,
  maxMileage: number
): number | null {
  if (
    cost === null ||
    cost === undefined ||
    !Number.isFinite(cost) ||
    !Number.isFinite(minMileage) ||
    !Number.isFinite(maxMileage) ||
    cost < 0
  ) {
    return null;
  }

  const mileageSpan = maxMileage - minMileage;
  if (mileageSpan <= 0) {
    return null;
  }

  return Number((cost / mileageSpan).toFixed(2));
}
