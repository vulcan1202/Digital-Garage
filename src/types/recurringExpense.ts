import { RecurringExpenseCategory, RecurringExpenseRow, RecurringExpenseInsert, RecurringExpenseUpdate } from './database';

export type { RecurringExpenseCategory, RecurringExpenseRow, RecurringExpenseInsert, RecurringExpenseUpdate };

export type RecurringExpenseStatus = 'good' | 'due_soon' | 'overdue' | 'unset';

export interface RecurringStatusSummary {
  category: RecurringExpenseCategory;
  latest_record_id?: number | null;
  title: string;
  last_paid_date?: string | null;
  coverage_end_date?: string | null;
  days_remaining?: number | null;
  status: RecurringExpenseStatus;
}

export interface SmartPreFillResult {
  category: RecurringExpenseCategory;
  title: string;
  defaultAmount: number;
  paidDate: string;           // YYYY-MM-DD
  coverageStartDate: string;  // YYYY-MM-DD
  coverageEndDate: string;    // YYYY-MM-DD
  notice?: string;
}

export const RECURRING_CATEGORY_LABELS: Record<RecurringExpenseCategory, string> = {
  license_tax: '牌照稅',
  road_maintenance_fee: '公路使用養護安全管理費（公路養管費）',
  inspection: '定期檢驗 / 排氣定檢',
  compulsory_insurance: '強制汽車責任保險',
  liability_insurance: '任意第三人責任保險',
  other: '其他規費',
};
