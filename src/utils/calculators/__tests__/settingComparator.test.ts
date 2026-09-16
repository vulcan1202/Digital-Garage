import { compareSettingSets } from '../settingComparator';

describe('compareSettingSets', () => {
  it('兩版本完全相同時，回傳 isIdentical = true 且所有項目為 UNCHANGED', () => {
    const paramsA = [
      { setting_name: '前伸側阻尼 (Rebound)', setting_value: '9', unit: '段' },
      { setting_name: '後壓側阻尼 (Compression)', setting_value: '6', unit: '段' },
    ];
    const paramsB = [
      { setting_name: '前伸側阻尼 (Rebound)', setting_value: '9', unit: '段' },
      { setting_name: '後壓側阻尼 (Compression)', setting_value: '6', unit: '段' },
    ];

    const result = compareSettingSets(paramsA, paramsB);
    expect(result.isIdentical).toBe(true);
    expect(result.stats.unchangedCount).toBe(2);
    expect(result.stats.changedCount).toBe(0);
    expect(result.stats.addedCount).toBe(0);
    expect(result.stats.removedCount).toBe(0);
    expect(result.diffs.every((d) => d.status === 'UNCHANGED')).toBe(true);
  });

  it('陣列亂序傳入時，仍能 deterministic 比對且正確識別相同', () => {
    const paramsA = [
      { setting_name: 'Preload', setting_value: '10', unit: 'mm' },
      { setting_name: 'Compression', setting_value: '12', unit: 'clicks' },
      { setting_name: 'Rebound', setting_value: '8', unit: 'clicks' },
    ];
    // B 順序與 A 完全相反
    const paramsB = [
      { setting_name: 'Rebound', setting_value: '8', unit: 'clicks' },
      { setting_name: 'Preload', setting_value: '10', unit: 'mm' },
      { setting_name: 'Compression', setting_value: '12', unit: 'clicks' },
    ];

    const result = compareSettingSets(paramsA, paramsB);
    expect(result.isIdentical).toBe(true);
    expect(result.stats.unchangedCount).toBe(3);
    // 驗證按字典序排序
    expect(result.diffs.map((d) => d.name)).toEqual(['Compression', 'Preload', 'Rebound']);
  });

  it('正確識別數值變更 (CHANGED)', () => {
    const paramsA = [{ setting_name: 'Compression', setting_value: '12', unit: 'clicks' }];
    const paramsB = [{ setting_name: 'Compression', setting_value: '10', unit: 'clicks' }];

    const result = compareSettingSets(paramsA, paramsB);
    expect(result.isIdentical).toBe(false);
    expect(result.stats.changedCount).toBe(1);
    expect(result.diffs[0]).toEqual({
      name: 'Compression',
      status: 'CHANGED',
      valueA: '12',
      unitA: 'clicks',
      valueB: '10',
      unitB: 'clicks',
    });
  });

  it('正確識別單位變更 (CHANGED)', () => {
    const paramsA = [{ setting_name: 'Preload', setting_value: '10', unit: 'mm' }];
    const paramsB = [{ setting_name: 'Preload', setting_value: '10', unit: 'cm' }];

    const result = compareSettingSets(paramsA, paramsB);
    expect(result.isIdentical).toBe(false);
    expect(result.stats.changedCount).toBe(1);
    expect(result.diffs[0].status).toBe('CHANGED');
  });

  it('正確識別新增參數 (ADDED)', () => {
    const paramsA = [{ setting_name: 'Compression', setting_value: '12', unit: 'clicks' }];
    const paramsB = [
      { setting_name: 'Compression', setting_value: '12', unit: 'clicks' },
      { setting_name: 'High Speed Compression', setting_value: '3', unit: 'turns' },
    ];

    const result = compareSettingSets(paramsA, paramsB);
    expect(result.isIdentical).toBe(false);
    expect(result.stats.addedCount).toBe(1);
    expect(result.stats.unchangedCount).toBe(1);
    const addedItem = result.diffs.find((d) => d.name === 'High Speed Compression');
    expect(addedItem).toEqual({
      name: 'High Speed Compression',
      status: 'ADDED',
      valueA: null,
      unitA: null,
      valueB: '3',
      unitB: 'turns',
    });
  });

  it('正確識別移除參數 (REMOVED)', () => {
    const paramsA = [
      { setting_name: 'Compression', setting_value: '12', unit: 'clicks' },
      { setting_name: 'Old Sensor Calibration', setting_value: 'OFF', unit: null },
    ];
    const paramsB = [{ setting_name: 'Compression', setting_value: '12', unit: 'clicks' }];

    const result = compareSettingSets(paramsA, paramsB);
    expect(result.isIdentical).toBe(false);
    expect(result.stats.removedCount).toBe(1);
    expect(result.stats.unchangedCount).toBe(1);
    const removedItem = result.diffs.find((d) => d.name === 'Old Sensor Calibration');
    expect(removedItem).toEqual({
      name: 'Old Sensor Calibration',
      status: 'REMOVED',
      valueA: 'OFF',
      unitA: null,
      valueB: null,
      unitB: null,
    });
  });

  it('兩組皆為空時回傳 isIdentical = true 且 totalParams = 0', () => {
    const result = compareSettingSets([], []);
    expect(result.isIdentical).toBe(true);
    expect(result.diffs).toEqual([]);
    expect(result.stats.totalParams).toBe(0);
  });
});
