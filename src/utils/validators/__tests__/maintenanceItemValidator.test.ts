import {
  validateMaintenanceItem,
  calculateValidTotalCost,
  MaintenanceItemInput,
} from '../maintenanceItemValidator';

describe('maintenanceItemValidator (TC-04, TC-05, TC-12)', () => {
  it('應正確驗證標準有效項目與整數金額', () => {
    const item: MaintenanceItemInput = { id: '1', name: '機油更換', cost: '2000' };
    const res = validateMaintenanceItem(item);
    expect(res.type).toBe('VALID');
    if (res.type === 'VALID') {
      expect(res.data.name).toBe('機油更換');
      expect(res.data.cost).toBe(2000);
    }
  });

  it('應正確驗證帶有小數之合法金額', () => {
    const item: MaintenanceItemInput = { id: '1', name: '特規墊片', cost: '120.5' };
    const res = validateMaintenanceItem(item);
    expect(res.type).toBe('VALID');
    if (res.type === 'VALID') {
      expect(res.data.cost).toBe(120.5);
    }
  });

  it('若金額留空但有名稱，應預設為 0 元 (TC-01)', () => {
    const item: MaintenanceItemInput = { id: '1', name: '胎壓檢查', cost: '' };
    const res = validateMaintenanceItem(item);
    expect(res.type).toBe('VALID');
    if (res.type === 'VALID') {
      expect(res.data.cost).toBe(0);
    }
  });

  it('應識別全空白項目 (TC-03)', () => {
    const item: MaintenanceItemInput = { id: '1', name: '   ', cost: '   ' };
    const res = validateMaintenanceItem(item);
    expect(res.type).toBe('EMPTY');
  });

  it('未填名稱但填寫金額應回傳錯誤 (TC-05)', () => {
    const item: MaintenanceItemInput = { id: '1', name: '', cost: '1000' };
    const res = validateMaintenanceItem(item);
    expect(res.type).toBe('ERROR');
    if (res.type === 'ERROR') {
      expect(res.reasonKey).toBe('maintenance.validation.itemNameRequired');
    }
  });

  it('TC-12 嚴格拒絕尾端帶有非數字字元 (例如 2000abc、12.3xyz)', () => {
    const item1: MaintenanceItemInput = { id: '1', name: '煞車皮', cost: '2000abc' };
    const res1 = validateMaintenanceItem(item1);
    expect(res1.type).toBe('ERROR');
    if (res1.type === 'ERROR') {
      expect(res1.reasonKey).toBe('maintenance.validation.costInvalid');
    }

    const item2: MaintenanceItemInput = { id: '2', name: '火星塞', cost: '12.3xyz' };
    const res2 = validateMaintenanceItem(item2);
    expect(res2.type).toBe('ERROR');
  });

  it('嚴格拒絕負數金額 (TC-04)', () => {
    const item: MaintenanceItemInput = { id: '1', name: '煞車油', cost: '-500' };
    const res = validateMaintenanceItem(item);
    expect(res.type).toBe('ERROR');
    if (res.type === 'ERROR') {
      expect(res.reasonKey).toBe('maintenance.validation.costInvalid');
    }
  });

  it('calculateValidTotalCost 應精確計算所有有效項目之總和，忽略錯誤與空白列', () => {
    const items: MaintenanceItemInput[] = [
      { id: '1', name: '機油', cost: '2000' },
      { id: '2', name: '機油濾心', cost: '350' },
      { id: '3', name: '', cost: '' }, // 空白
      { id: '4', name: '輪胎對調', cost: '0' },
      { id: '5', name: '非法項目', cost: '2000abc' }, // 錯誤
    ];
    const total = calculateValidTotalCost(items);
    expect(total).toBe(2350);
  });
});
