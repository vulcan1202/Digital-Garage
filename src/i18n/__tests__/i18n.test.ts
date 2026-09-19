import i18n, { getEnglishText } from '../index';
import zhTW from '../locales/zh-TW.json';
import enUS from '../locales/en-US.json';
import type { TranslationKey } from '../types';

const IMMUTABLE_TOKENS = ['us-central1', 'km', 'L', 'km/L'];

describe('i18n Core & Dictionary Quality Matrix', () => {
  beforeAll(async () => {
    await i18n.changeLanguage('zh-TW');
  });

  // 遞迴取得所有字串葉節點路徑與值的 Helper
  function getLeaves(obj: Record<string, any>, prefix = ''): { key: string; val: string }[] {
    let leaves: { key: string; val: string }[] = [];
    for (const k of Object.keys(obj)) {
      const fullPath = prefix ? `${prefix}.${k}` : k;
      const val = obj[k];
      if (typeof val === 'string') {
        leaves.push({ key: fullPath, val });
      } else if (val && typeof val === 'object' && !Array.isArray(val)) {
        leaves = leaves.concat(getLeaves(val, fullPath));
      }
    }
    return leaves;
  }

  const zhLeaves = getLeaves(zhTW);
  const enLeaves = getLeaves(enUS);

  const zhKeyMap = new Map(zhLeaves.map((l) => [l.key, l.val]));
  const enKeyMap = new Map(enLeaves.map((l) => [l.key, l.val]));

  it('1. 鍵值結構 100% 對稱 (Symmetric Keys)', () => {
    const zhKeys = Array.from(zhKeyMap.keys()).sort();
    const enKeys = Array.from(enKeyMap.keys()).sort();

    const missingInEn = zhKeys.filter((k) => !enKeyMap.has(k));
    const missingInZh = enKeys.filter((k) => !zhKeyMap.has(k));

    expect(missingInEn).toEqual([]);
    expect(missingInZh).toEqual([]);
    expect(zhKeys.length).toBe(enKeys.length);
  });

  it('2. 禁止空字串 (No Empty or Whitespace-only Leaves)', () => {
    zhLeaves.forEach(({ key, val }) => {
      expect(val.trim().length).toBeGreaterThan(0);
    });
    enLeaves.forEach(({ key, val }) => {
      expect(val.trim().length).toBeGreaterThan(0);
    });
  });

  it('3. 變數插值對稱性檢驗 (Interpolation Parameters Alignment)', () => {
    // 檢查 {{variable}}
    const interpolationRegex = /\{\{([^}]+)\}\}/g;

    zhLeaves.forEach(({ key, val }) => {
      const zhVars = Array.from(val.matchAll(interpolationRegex), (m) => m[1].trim()).sort();
      const enVal = enKeyMap.get(key) || '';
      const enVars = Array.from(enVal.matchAll(interpolationRegex), (m) => m[1].trim()).sort();

      expect(enVars).toEqual(zhVars);
    });
  });

  it('4. 不可變標記保留 (Immutable Tokens Preservation)', () => {
    IMMUTABLE_TOKENS.forEach((token) => {
      // 使用邊界或精確單詞正則匹配，避免 'SQL' 中的 'L' 造成誤判
      const tokenRegex = new RegExp(`(^|[^a-zA-Z0-9])${token.replace(/([.*+?^=!:${}()|\[\]\/\\])/g, '\\$1')}([^a-zA-Z0-9]|$)`);

      zhLeaves.forEach(({ key, val }) => {
        if (tokenRegex.test(val)) {
          const enVal = enKeyMap.get(key);
          expect(enVal).toBeDefined();
          expect(tokenRegex.test(enVal!)).toBe(true);
        }
      });
    });
  });

  it('5. 內容質量檢查 (英文不可複製中文長文字)', () => {
    const cjkRegex = /[\u4e00-\u9fa5]/;
    enLeaves.forEach(({ key, val }) => {
      // 英文翻譯檔內不應殘留中文字
      const hasChinese = cjkRegex.test(val);
      if (hasChinese) {
        throw new Error(`en-US key "${key}" contains Chinese characters: "${val}"`);
      }
      expect(hasChinese).toBe(false);
    });
  });

  it('6. getEnglishText Helper 解析與 Fallback 驗證', () => {
    // 正常取值 (固定 en-US)
    const enInspection = getEnglishText('recurring.labels.inspection' as TranslationKey);
    expect(enInspection).toBe('Periodic Inspection');

    // 帶參數插值
    const enActiveFleet = getEnglishText('vehicle.activeFleet' as TranslationKey, { count: 3 });
    expect(enActiveFleet).toBe('ACTIVE FLEET (3)');

    // 當語系為 zh-TW 時，getEnglishText 依然固定回傳英文
    expect(i18n.language).toBe('zh-TW');
    expect(getEnglishText('common.actions.save' as TranslationKey)).toBe('Save');

    // 不存在的 key 或空 key 回傳 ''
    const emptyResult = getEnglishText('non.existing.key' as any);
    expect(emptyResult).toBe('');
  });
});
