import { ModificationSettingRow } from '../../types/database';

export type DiffStatus = 'UNCHANGED' | 'CHANGED' | 'ADDED' | 'REMOVED';

export interface ParameterDiffItem {
  name: string;
  status: DiffStatus;
  valueA: string | null;
  unitA: string | null;
  valueB: string | null;
  unitB: string | null;
}

export interface SettingCompareResult {
  diffs: ParameterDiffItem[];
  isIdentical: boolean;
  stats: {
    unchangedCount: number;
    changedCount: number;
    addedCount: number;
    removedCount: number;
    totalParams: number;
  };
}

/**
 * 比較兩組改裝設定版本之細項參數差異 (Deterministic Map-based Union 比對)
 * 
 * @param paramsA 基準版本 A 的參數列表
 * @param paramsB 比較版本 B 的參數列表
 * @returns 比對結果，包含各參數差異狀態 (UNCHANGED, CHANGED, ADDED, REMOVED) 與是否完全相同 (isIdentical)
 */
export function compareSettingSets(
  paramsA: Array<Pick<ModificationSettingRow, 'setting_name' | 'setting_value' | 'unit'>> = [],
  paramsB: Array<Pick<ModificationSettingRow, 'setting_name' | 'setting_value' | 'unit'>> = []
): SettingCompareResult {
  // 1. 建立 Map A，以正規化 trim 後的參數名稱作為唯一 Key
  const mapA = new Map<string, { value: string; unit: string | null }>();
  for (const item of paramsA) {
    const key = item.setting_name.trim();
    if (key) {
      mapA.set(key, {
        value: item.setting_value.trim(),
        unit: item.unit ? item.unit.trim() : null,
      });
    }
  }

  // 2. 建立 Map B
  const mapB = new Map<string, { value: string; unit: string | null }>();
  for (const item of paramsB) {
    const key = item.setting_name.trim();
    if (key) {
      mapB.set(key, {
        value: item.setting_value.trim(),
        unit: item.unit ? item.unit.trim() : null,
      });
    }
  }

  // 3. Union 所有 Key，並依照字典序 deterministic 排序
  const allKeys = Array.from(new Set([...mapA.keys(), ...mapB.keys()])).sort((a, b) =>
    a.localeCompare(b, 'zh-Hant', { sensitivity: 'base' })
  );

  let unchangedCount = 0;
  let changedCount = 0;
  let addedCount = 0;
  let removedCount = 0;

  const diffs: ParameterDiffItem[] = [];

  for (const key of allKeys) {
    const itemA = mapA.get(key);
    const itemB = mapB.get(key);

    if (itemA && !itemB) {
      // 僅存在於 A，B 中被移除
      diffs.push({
        name: key,
        status: 'REMOVED',
        valueA: itemA.value,
        unitA: itemA.unit,
        valueB: null,
        unitB: null,
      });
      removedCount++;
    } else if (!itemA && itemB) {
      // 僅存在於 B，B 中新增加
      diffs.push({
        name: key,
        status: 'ADDED',
        valueA: null,
        unitA: null,
        valueB: itemB.value,
        unitB: itemB.unit,
      });
      addedCount++;
    } else if (itemA && itemB) {
      // 兩邊皆存在：檢查數值與單位是否相同
      const valueMatch = itemA.value === itemB.value;
      const unitMatch = (itemA.unit || '') === (itemB.unit || '');

      if (valueMatch && unitMatch) {
        diffs.push({
          name: key,
          status: 'UNCHANGED',
          valueA: itemA.value,
          unitA: itemA.unit,
          valueB: itemB.value,
          unitB: itemB.unit,
        });
        unchangedCount++;
      } else {
        diffs.push({
          name: key,
          status: 'CHANGED',
          valueA: itemA.value,
          unitA: itemA.unit,
          valueB: itemB.value,
          unitB: itemB.unit,
        });
        changedCount++;
      }
    }
  }

  // 完全相同的條件：無任何新增、刪除、變更
  const isIdentical = changedCount === 0 && addedCount === 0 && removedCount === 0;

  return {
    diffs,
    isIdentical,
    stats: {
      unchangedCount,
      changedCount,
      addedCount,
      removedCount,
      totalParams: allKeys.length,
    },
  };
}
