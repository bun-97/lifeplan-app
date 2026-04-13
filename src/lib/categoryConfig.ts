import { TransactionType } from '../types';

export interface CategoryNode {
  id: string;
  name: string;
  subcategories: string[];
  expenseType?: '毎月固定' | '毎月変動' | '不定期固定' | '不定期変動';
  budgetType?: '予算内' | '予算外';
}

export interface CategoryConfig {
  income: CategoryNode[];
  expense: CategoryNode[];
  investment: CategoryNode[];
}

const STORAGE_KEY = 'lifeplan_category_config';

const DEFAULT_CONFIG: CategoryConfig = {
  income: [
    { id: 'inc-1', name: '収入', subcategories: ['給与', '賞与'], budgetType: '予算内' },
    { id: 'inc-2', name: '配当金', subcategories: [], budgetType: '予算外' },
    { id: 'inc-3', name: '副業', subcategories: [], budgetType: '予算外' },
    { id: 'inc-4', name: '賞与', subcategories: [], budgetType: '予算外' },
    { id: 'inc-5', name: '臨時収入', subcategories: [], budgetType: '予算外' },
  ],
  expense: [
    { id: 'exp-1', name: '食費', subcategories: ['外食', '食料品'], expenseType: '毎月変動' },
    { id: 'exp-2', name: '日用品', subcategories: [], expenseType: '毎月変動' },
    { id: 'exp-3', name: '住宅', subcategories: ['家賃', '住宅ローン', '管理費'], expenseType: '毎月固定' },
    { id: 'exp-4', name: '通信費', subcategories: ['スマホ', 'ネット'], expenseType: '毎月固定' },
    { id: 'exp-5', name: '保険', subcategories: ['生命保険', '医療保険', '火災保険'], expenseType: '毎月固定' },
    { id: 'exp-6', name: '教養・教育', subcategories: [], expenseType: '毎月固定' },
    { id: 'exp-7', name: '水道光熱費', subcategories: ['電気', 'ガス', '水道'], expenseType: '毎月固定' },
    { id: 'exp-8', name: '自動車', subcategories: ['ガソリン', '駐車場', '自動車保険'], expenseType: '毎月固定' },
    { id: 'exp-9', name: '交際費', subcategories: [], expenseType: '不定期変動' },
    { id: 'exp-10', name: '衣服・美容', subcategories: [], expenseType: '不定期変動' },
    { id: 'exp-11', name: '健康・医療', subcategories: [], expenseType: '不定期変動' },
    { id: 'exp-12', name: 'サブスク費', subcategories: [], expenseType: '不定期固定' },
    { id: 'exp-13', name: '税・社会保障', subcategories: [], expenseType: '不定期固定' },
    { id: 'exp-14', name: 'その他', subcategories: [], expenseType: '不定期変動' },
  ],
  investment: [
    { id: 'inv-1', name: '株式投資', subcategories: [] },
    { id: 'inv-2', name: '自己投資', subcategories: [] },
    { id: 'inv-3', name: '貯金', subcategories: [] },
  ],
};

export function getCategoryConfig(): CategoryConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as CategoryConfig;
  } catch {}
  return DEFAULT_CONFIG;
}

export function saveCategoryConfig(config: CategoryConfig): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
}

export function getMajorCategories(type: TransactionType): CategoryNode[] {
  return getCategoryConfig()[type] ?? [];
}

export function getMinorCategories(type: TransactionType, majorName: string): string[] {
  const node = getMajorCategories(type).find(n => n.name === majorName);
  return node ? node.subcategories : [];
}

export function getTagForCategory(type: TransactionType, majorName: string): { expenseType?: string; budgetType?: string } {
  const node = getMajorCategories(type).find(n => n.name === majorName);
  if (!node) return {};
  return {
    expenseType: node.expenseType,
    budgetType: node.budgetType,
  };
}
