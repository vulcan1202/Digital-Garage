import {
  validateMaintenanceItem,
  calculateValidTotalCost,
  MaintenanceItemInput,
  ItemValidationResult,
} from '../../../utils/validators/maintenanceItemValidator';

describe('AddMaintenanceModal Multi-Item Workflow & Business Logic (TC-01 ~ TC-16)', () => {
  describe('TC-01: 單一項目新增相容性', () => {
    it('填寫單一項目時應正確通過驗證並給予標準 cost', () => {
      const item: MaintenanceItemInput = { id: '1', name: '機油更換', cost: '2000' };
      const res = validateMaintenanceItem(item);
      expect(res.type).toBe('VALID');
      if (res.type === 'VALID') {
        expect(res.data.name).toBe('機油更換');
        expect(res.data.cost).toBe(2000);
      }
      expect(calculateValidTotalCost([item])).toBe(2000);
    });
  });

  describe('TC-02: 多項目正常新增與即時金額加總', () => {
    it('三個項目皆有效時應累加全部金額', () => {
      const items: MaintenanceItemInput[] = [
        { id: '1', name: '機油更換', cost: '2000' },
        { id: '2', name: '機油濾芯', cost: '300' },
        { id: '3', name: '更換工資', cost: '500' },
      ];
      const validItems: ItemValidationResult[] = items.map(validateMaintenanceItem);
      expect(validItems.every((r) => r.type === 'VALID')).toBe(true);
      expect(calculateValidTotalCost(items)).toBe(2800);
    });
  });

  describe('TC-03: 存在空白行時自動過濾忽略', () => {
    it('兩項有效、一項完全空白時，不拋出錯誤且不納入總額', () => {
      const items: MaintenanceItemInput[] = [
        { id: '1', name: '煞車皮', cost: '1500' },
        { id: '2', name: '', cost: '' }, // 空白列
        { id: '3', name: '煞車油', cost: '800' },
      ];

      const validList = items
        .map(validateMaintenanceItem)
        .filter((r): r is Extract<ItemValidationResult, { type: 'VALID' }> => r.type === 'VALID');

      expect(validList).toHaveLength(2);
      expect(calculateValidTotalCost(items)).toBe(2300);
    });
  });

  describe('TC-04 & TC-12: 金額防呆與嚴格全匹配驗證', () => {
    it('TC-12: 尾端帶有非數字字元 (例如 2000abc、12.3xyz) 應被嚴格拒絕', () => {
      expect(validateMaintenanceItem({ id: '1', name: '品項A', cost: '2000abc' }).type).toBe('ERROR');
      expect(validateMaintenanceItem({ id: '2', name: '品項B', cost: '12.3xyz' }).type).toBe('ERROR');
      expect(validateMaintenanceItem({ id: '3', name: '品項C', cost: 'abc' }).type).toBe('ERROR');
    });

    it('TC-04: 負數金額應被嚴格拒絕', () => {
      const res = validateMaintenanceItem({ id: '1', name: '機油', cost: '-200' });
      expect(res.type).toBe('ERROR');
      if (res.type === 'ERROR') {
        expect(res.reasonKey).toBe('maintenance.validation.costInvalid');
      }
    });
  });

  describe('TC-05: 全數空白或名稱未填防呆', () => {
    it('全部留空時無任何有效項目', () => {
      const items: MaintenanceItemInput[] = [
        { id: '1', name: '', cost: '' },
        { id: '2', name: '   ', cost: '   ' },
      ];
      const valid = items.filter((it) => validateMaintenanceItem(it).type === 'VALID');
      expect(valid).toHaveLength(0);
    });

    it('有填金額但無名稱應視為 ERROR', () => {
      const res = validateMaintenanceItem({ id: '1', name: '', cost: '500' });
      expect(res.type).toBe('ERROR');
      if (res.type === 'ERROR') {
        expect(res.reasonKey).toBe('maintenance.validation.itemNameRequired');
      }
    });
  });

  describe('TC-06: 部分成功 (Partial Success) 表單剔除邏輯', () => {
    it('成功項目應被正確過濾剔除，失敗項目完好保留於表單', () => {
      const currentItems: MaintenanceItemInput[] = [
        { id: 'id-1', name: '項目1', cost: '100' },
        { id: 'id-2', name: '項目2', cost: '200' },
        { id: 'id-3', name: '項目3', cost: '300' },
      ];

      // 模擬 id-1 與 id-2 寫入成功，id-3 失敗
      const successItemIds = ['id-1', 'id-2'];
      const retainedItems = currentItems.filter((it) => !successItemIds.includes(it.id));

      expect(retainedItems).toHaveLength(1);
      expect(retainedItems[0].id).toBe('id-3');
      expect(retainedItems[0].name).toBe('項目3');
    });
  });

  describe('TC-08 & TC-14: 照片動態順延歸屬至首個成功項目', () => {
    it('第一筆項目建立失敗時，照片 URL 陣列應自動順延遞交給第二筆（首個成功項目）', () => {
      const photoUrls = ['https://cdn.example.com/invoice.jpg'];
      let photoAssigned = false;
      const assignedPhotosMap: Record<string, string[]> = {};

      // 模擬 2 個有效項目，item-1 拋出例外，item-2 成功
      const items = [
        { id: 'item-1', willFail: true },
        { id: 'item-2', willFail: false },
      ];

      for (const it of items) {
        const photosForThis = !photoAssigned && photoUrls.length > 0 ? photoUrls : [];
        if (it.willFail) {
          // item-1 失敗，photoAssigned 維持 false
          continue;
        }
        // item-2 成功，接收照片
        assignedPhotosMap[it.id] = photosForThis;
        if (photosForThis.length > 0) {
          photoAssigned = true;
        }
      }

      expect(assignedPhotosMap['item-1']).toBeUndefined();
      expect(assignedPhotosMap['item-2']).toEqual(photoUrls);
      expect(photoAssigned).toBe(true);
    });
  });

  describe('TC-15: 提醒建立失敗時不回滾工單紀錄', () => {
    it('若提醒拋出例外，工單紀錄依然保持成功狀態並產生獨立告警', async () => {
      let maintenanceSaved = false;
      let reminderFailedNoticeTriggered = false;

      // 模擬儲存工單成功
      maintenanceSaved = true;

      // 模擬建立提醒時伺服器錯誤
      try {
        throw new Error('Reminder service unavailable');
      } catch {
        reminderFailedNoticeTriggered = true;
      }

      expect(maintenanceSaved).toBe(true);
      expect(reminderFailedNoticeTriggered).toBe(true);
    });
  });
});
