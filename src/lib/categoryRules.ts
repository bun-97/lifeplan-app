import { TransactionType } from '../types';

export interface CategoryRule {
  type: TransactionType;
  category: string;
  subcategory: string;
}

const RULES_KEY = 'lifeplan_category_rules';

export function getCategoryRules(): Record<string, CategoryRule> {
  try {
    const raw = localStorage.getItem(RULES_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function saveCategoryRule(storeName: string, rule: CategoryRule): void {
  if (!storeName.trim()) return;
  const rules = getCategoryRules();
  rules[storeName.trim()] = rule;
  localStorage.setItem(RULES_KEY, JSON.stringify(rules));
}

export function applyRules<T extends { itemName: string; type: TransactionType; category: string; subcategory: string }>(
  items: T[]
): T[] {
  const rules = getCategoryRules();
  return items.map(item => {
    const rule = rules[item.itemName.trim()];
    if (rule) return { ...item, type: rule.type, category: rule.category, subcategory: rule.subcategory };
    return item;
  });
}
