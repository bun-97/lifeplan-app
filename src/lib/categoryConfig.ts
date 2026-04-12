import { TransactionType } from '../types';

export interface CategoryNode {
  id: string;
  name: string;
  subcategories: string[];
}

export interface CategoryConfig {
  income: CategoryNode[];
  expense: CategoryNode[];
  investment: CategoryNode[];
}

const STORAGE_KEY = 'lifeplan_category_config';

const DEFAULT_CONFIG: CategoryConfig = {
  income: [
    { id: 'inc-1', name: '収入', subcategories: ['給与', '賞与'] },
    { id: 'inc-2', name: '配当金', subcategories: [] },
    { id: 'inc-3', name: '副業', subcategories: [] },
    { id: 'inc-4', name: '賞与', subcategories: [] },
    { id: 'inc-5', name: '臨時収入', subcategories: [] },
  ],
  expense: [
    { id: 'exp-1', name: '食費', subcategories: ['外食', '食料品'] },
    { id: 'exp-2', name: '日用品', subcategories: [] },
    { id: 'exp-3', name: '住宅', subcategories: ['家賃', '住宅ローン', '管理費'] },
    { id: 'exp-4', name: '通信費', subcategories: ['スマホ', 'ネット'] },
    { id: 'exp-5', name: '保険', subcategories: ['生命保険', '医療保険', '火災保険'] },
    { id: 'exp-6', name: '教養・教育', subcategories: [] },
    { id: 'exp-7', name: '水道光熱費', subcategories: ['電気', 'ガス', '水道'] },
    { id: 'exp-8', name: '自動車', subcategories: ['ガソリン', '駐車場', '自動車保険'] },
    { id: 'exp-9', name: '交際費', subcategories: [] },
    { id: 'exp-10', name: '衣服・美容', subcategories: [] },
    { id: 'exp-11', name: '健康・医療', subcategories: [] },
    { id: 'exp-12', name: 'サブスク費', subcategories: [] },
    { id: 'exp-13', name: '税・社会保障', subcategories: [] },
    { id: 'exp-14', name: 'その他', subcategories: [] },
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
