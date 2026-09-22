import { TranslationKey } from '../../i18n/types';

export interface MaintenanceItemInput {
  id: string;
  name: string;
  cost: string;
}

export interface ValidatedMaintenanceItem {
  name: string;
  cost: number;
}

export type ItemValidationResult =
  | { type: 'VALID'; data: ValidatedMaintenanceItem }
  | { type: 'EMPTY' }
  | { type: 'ERROR'; reasonKey: TranslationKey };

/**
 * 嚴格金額與項目驗證純函式
 * 嚴格匹配正整數或有限小數，拒絕 2000abc、負數、非數字、無限大
 */
export function validateMaintenanceItem(item: MaintenanceItemInput): ItemValidationResult {
  const trimmedName = item.name.trim();
  const trimmedCost = item.cost.trim();

  // 1. 完全空白列判定 (項目名稱與金額皆未輸入)
  if (!trimmedName && !trimmedCost) {
    return { type: 'EMPTY' };
  }

  // 2. 名稱檢查
  if (!trimmedName) {
    return { type: 'ERROR', reasonKey: 'maintenance.validation.itemNameRequired' };
  }

  // 3. 嚴格金額格式檢查 (必須全為正整數或合法小數，若留空則預設 0)
  if (!trimmedCost) {
    return {
      type: 'VALID',
      data: {
        name: trimmedName,
        cost: 0,
      },
    };
  }

  const costRegex = /^\d+(\.\d+)?$/;
  if (!costRegex.test(trimmedCost)) {
    return { type: 'ERROR', reasonKey: 'maintenance.validation.costInvalid' };
  }

  const parsedCost = Number(trimmedCost);
  if (!Number.isFinite(parsedCost) || parsedCost < 0) {
    return { type: 'ERROR', reasonKey: 'maintenance.validation.costInvalid' };
  }

  return {
    type: 'VALID',
    data: {
      name: trimmedName,
      cost: parsedCost,
    },
  };
}

/**
 * 計算多項目的即時有效總計金額
 */
export function calculateValidTotalCost(items: MaintenanceItemInput[]): number {
  return items.reduce((sum, item) => {
    const res = validateMaintenanceItem(item);
    if (res.type === 'VALID') {
      return sum + res.data.cost;
    }
    return sum;
  }, 0);
}
