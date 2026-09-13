/**
 * Fuel Calculator (純函式)
 * 零依賴、無副作用、相同輸入必得相同輸出
 */

export interface RefuelEntry {
  id: number;
  mileage: number;
  volume: number;
  total_cost: number;
  refuel_date: string;
}

export interface FuelEconomyResult {
  kmPerLiter: number;
  litersPer100Km: number;
}

/**
 * 計算單筆加油的油耗 (以公升/公里換算)
 * @param current 當次加油紀錄
 * @param previous 前一次加油紀錄 (依日期/里程排序之前一筆)
 * @returns 若無前一筆紀錄 (即為第一筆) 或里程差 <= 0，一律回傳 null。嚴防 NaN / Infinity。
 */
export function calculateFuelEconomy(
  current: Pick<RefuelEntry, 'mileage' | 'volume'>,
  previous?: Pick<RefuelEntry, 'mileage'> | null
): FuelEconomyResult | null {
  // 鐵律 1: 若無前一筆加油紀錄的里程，不得直接用當前里程計算，回傳 null
  if (!previous || previous.mileage === undefined || previous.mileage === null) {
    return null;
  }

  const distance = current.mileage - previous.mileage;

  // 鐵律 2: 里程差 <= 0 或油量 <= 0 時防呆，嚴禁產生 Infinity 或 NaN
  if (distance <= 0 || current.volume <= 0 || !Number.isFinite(distance) || !Number.isFinite(current.volume)) {
    return null;
  }

  const kmPerLiter = Number((distance / current.volume).toFixed(2));
  const litersPer100Km = Number(((current.volume / distance) * 100).toFixed(2));

  return {
    kmPerLiter,
    litersPer100Km,
  };
}

/**
 * 計算全車平均每公里油資
 * 公式: 總油資 / (最大里程 - 最小里程)
 * @param records 所有加油紀錄清單
 * @returns 若紀錄不足或里程跨度 <= 0，一律回傳 null，嚴防除以 0。
 */
export function calculateAverageFuelCostPerKm(
  records: Pick<RefuelEntry, 'mileage' | 'total_cost'>[]
): number | null {
  if (!records || records.length < 2) {
    return null;
  }

  let minMileage = Infinity;
  let maxMileage = -Infinity;
  let totalCost = 0;

  for (const record of records) {
    if (typeof record.mileage === 'number' && Number.isFinite(record.mileage)) {
      if (record.mileage < minMileage) minMileage = record.mileage;
      if (record.mileage > maxMileage) maxMileage = record.mileage;
    }
    if (typeof record.total_cost === 'number' && Number.isFinite(record.total_cost)) {
      totalCost += record.total_cost;
    }
  }

  const mileageSpan = maxMileage - minMileage;

  // 里程差 <= 0 時防呆回傳 null，避免 Infinity / NaN
  if (mileageSpan <= 0 || !Number.isFinite(mileageSpan)) {
    return null;
  }

  return Number((totalCost / mileageSpan).toFixed(2));
}
