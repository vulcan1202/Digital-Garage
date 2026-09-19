import type zhTW from './locales/zh-TW.json';

type Join<K, P> = K extends string | number
  ? P extends string | number
    ? `${K}${'' extends P ? '' : '.'}${P}`
    : never
  : never;

type Prev = [never, 0, 1, 2, 3, 4, 5, 6, 7, 8, ...0[]];

export type Leaves<T, D extends number = 8> = [D] extends [never]
  ? never
  : T extends string
  ? ''
  : T extends readonly unknown[] | Date | RegExp
  ? never
  : T extends object
  ? { [K in keyof T]-?: Join<K, Leaves<T[K], Prev[D]>> }[keyof T]
  : never;

export type Resources = typeof zhTW;
export type TranslationKey = Leaves<Resources>;
export type SupportedLanguage = 'zh-TW' | 'en-US';

declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: 'translation';
    resources: {
      translation: Resources;
    };
  }
}
