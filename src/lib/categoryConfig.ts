import { TransactionType } from '../types';

export interface SubcategoryNode {
  name: string;
  expenseType?: '毎月固定' | '毎月変動' | '不定期固定' | '不定期変動';
  budgetType?: '予算内' | '予算外';
}

export interface CategoryNode {
  id: string;
  name: string;
  subcategories: SubcategoryNode[];
  expenseType?: '毎月固定' | '毎月変動' | '不定期固定' | '不定期変動';
  budgetType?: '予算内' | '予算外';
}

export interface CategoryConfig {
  income: CategoryNode[];
  expense: CategoryNode[];
  investment: CategoryNode[];
  savings: CategoryNode[];
}

const STORAGE_KEY = 'lifeplan_category_config';

const DEFAULT_CONFIG: CategoryConfig = {
  income: [
    { id: 'inc-1', name: '収入', subcategories: [], budgetType: '予算内' },
    { id: 'inc-2', name: '臨時収入', subcategories: [], budgetType: '予算外' },
  ],
  expense: [
    { id: 'exp-1', name: '食費', subcategories: [], expenseType: '毎月変動' },
    { id: 'exp-2', name: '日用品', subcategories: [], expenseType: '毎月変動' },
    { id: 'exp-3', name: '住宅', subcategories: [], expenseType: '毎月固定' },
    { id: 'exp-4', name: '自動車', subcategories: [], expenseType: '毎月固定' },
    { id: 'exp-5', name: '交際費', subcategories: [], expenseType: '不定期変動' },
    { id: 'exp-6', name: 'その他', subcategories: [], expenseType: '不定期変動' },
  ],
  investment: [
    { id: 'inv-1', name: '投資', subcategories: [] },
  ],
  savings: [],
};

export function resetCategoryConfig(): void {
  localStorage.removeItem(STORAGE_KEY);
}

function migrateConfig(raw: any): CategoryConfig {
  const migrateNodes = (nodes: any[]): CategoryNode[] =>
    (nodes || []).map((n: any) => ({
      ...n,
      subcategories: (n.subcategories || []).map((s: any) =>
        typeof s === 'string' ? { name: s } : s
      ),
    }));
  return {
    income: migrateNodes(raw.income),
    expense: migrateNodes(raw.expense),
    investment: migrateNodes(raw.investment),
    savings: migrateNodes(raw.savings ?? DEFAULT_CONFIG.savings),
  };
}

export function getCategoryConfig(): CategoryConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return migrateConfig(JSON.parse(raw));
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
  return node ? node.subcategories.map(s => s.name) : [];
}

export function getEffectiveTag(
  type: TransactionType,
  majorName: string,
  minorName?: string
): { expenseType?: string; budgetType?: string } {
  const node = getMajorCategories(type).find(n => n.name === majorName);
  if (!node) return {};

  // ⑤ Subcategory-first: check the specified minor category
  if (minorName) {
    const sub = node.subcategories.find(s => s.name === minorName);
    if (sub && (sub.expenseType || sub.budgetType)) {
      return { expenseType: sub.expenseType, budgetType: sub.budgetType };
    }
  }

  // ⑤ If no minorName, look for the auto-created subcategory (same name as major)
  const autoSub = node.subcategories.find(s => s.name === node.name);
  if (autoSub && (autoSub.expenseType || autoSub.budgetType)) {
    return { expenseType: autoSub.expenseType, budgetType: autoSub.budgetType };
  }

  // ⑤ Fall back to major category setting as reference only (not primary source)
  return { expenseType: node.expenseType, budgetType: node.budgetType };
}

export function getTagForCategory(type: TransactionType, majorName: string): { expenseType?: string; budgetType?: string } {
  return getEffectiveTag(type, majorName);
}
