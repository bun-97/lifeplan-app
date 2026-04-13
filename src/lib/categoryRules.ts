import { TransactionType } from '../types';

export interface CategoryRule {
  type: TransactionType;
  category: string;
  subcategory: string;
}

export interface AutoClassifyResult {
  type: TransactionType;
  category: string;
  subcategory: string;
  matchedKeyword: string;
}

const RULES_KEY = 'lifeplan_category_rules';

// 管理番号・日付・記号を除去して店名の核となる部分を抽出
export function normalizeStoreName(name: string): string {
  return name
    .replace(/[_\-\/]?20\d{6}/g, '')    // _20260312 / 20260312
    .replace(/[_\-\/]?\d{8}/g, '')       // 任意の8桁数字
    .replace(/[_\-\/]?\d{6}/g, '')       // 任意の6桁数字
    .replace(/[_\-]\d{1,5}$/g, '')       // 末尾の _001 など
    .replace(/[_\-\s]+$/g, '')           // 末尾の区切り文字
    .replace(/\s{2,}/g, ' ')             // 連続スペース
    .trim();
}

// ルールベース自動分類テーブル
const AUTO_CLASSIFY_RULES: {
  keywords: string[];
  type: TransactionType;
  category: string;
  subcategory: string;
}[] = [
  {
    keywords: ['コープ', 'イオン', '西友', 'ライフ', 'マルエツ', 'ヨークマート', 'ヨーカドー',
      'ダイエー', 'ピーコック', 'サミット', 'ベルク', 'バロー', 'フジ', 'オークワ',
      'ハローデイ', '業務スーパー', 'コストコ', 'マックスバリュ', 'ミニピアゴ', 'ピアゴ',
      'ライフフーズ', 'オオゼキ', 'スーパーマーケット'],
    type: 'expense', category: '食費', subcategory: '食料品',
  },
  {
    keywords: ['セブンイレブン', 'セブン-イレブン', 'セブン‐イレブン', '7-ELEVEN', '7-11',
      'ファミリーマート', 'ファミマ', 'ローソン', 'ミニストップ', 'デイリーヤマザキ', 'ポプラ'],
    type: 'expense', category: '食費', subcategory: '食費',
  },
  {
    keywords: ['マツキヨ', 'マツモトキヨシ', 'ウエルシア', 'ツルハ', 'スギ薬局', 'クリエイトSD',
      'サンドラッグ', 'コクミン', 'カワチ薬品', 'キリン堂', 'ドラッグセイムス', 'ゲンキー'],
    type: 'expense', category: '日用品', subcategory: '日用品',
  },
  {
    keywords: ['やまや', 'カクヤス', 'リカーマウンテン', 'やまや', 'ワインショップ', '酒のやまや'],
    type: 'expense', category: '食費', subcategory: '食料品',
  },
  {
    keywords: ['ENEOS', 'エネオス', '出光', 'エクソン', 'Shell', 'シェル', 'コスモ石油',
      'コスモ', 'ゼネラル', 'エッソ', 'モービル', 'キグナス石油'],
    type: 'expense', category: '自動車', subcategory: '自動車',
  },
  {
    keywords: ['駐車場', 'パーキング', 'タイムズ', 'コインパーク', 'リパーク', 'エコロパーク',
      '三井のリパーク', 'NPC'],
    type: 'expense', category: '自動車', subcategory: '自動車',
  },
  {
    keywords: ['病院', 'クリニック', '医院', '歯科', '整形外科', '眼科', '皮膚科', '内科',
      '外科', '産婦人科', '小児科', '耳鼻科', '精神科', '泌尿器科', '消化器科'],
    type: 'expense', category: '健康・医療', subcategory: '医療費',
  },
  {
    keywords: ['薬局', 'ファーマシー', '調剤薬局', '処方薬', 'ハックドラッグ'],
    type: 'expense', category: '健康・医療', subcategory: '医療費',
  },
  {
    keywords: ['保険', 'インシュアランス', 'ほけん', '共済', '損保', '生命保険', '火災保険',
      '自動車保険', '医療保険'],
    type: 'expense', category: '保険', subcategory: '保険',
  },
  {
    keywords: ['ドコモ', 'NTTドコモ', 'au', 'KDDI', 'ソフトバンク', 'SoftBank',
      'ワイモバイル', 'UQモバイル', '楽天モバイル', 'IIJmio', 'mineo', 'OCNモバイル'],
    type: 'expense', category: '通信費', subcategory: '通信費',
  },
  {
    keywords: ['東京電力', '東京ガス', '大阪ガス', '関西電力', '中部電力', '九州電力',
      '東北電力', '北海道電力', '北陸電力', '東京都水道', '水道局', 'でんき'],
    type: 'expense', category: '光熱費', subcategory: '光熱費',
  },
  {
    keywords: ['Netflix', 'Spotify', 'Amazon Prime', 'Disney+', 'Hulu', 'Apple Music',
      'Apple One', 'YouTube Premium', 'U-NEXT', 'dTV', 'ABEMA'],
    type: 'expense', category: 'サブスク', subcategory: 'サブスク',
  },
  {
    keywords: ['吉野家', '松屋', 'すき家', 'マクドナルド', 'ケンタッキー', 'バーガーキング',
      'モスバーガー', 'サブウェイ', 'ガスト', 'デニーズ', 'ジョナサン', 'ファミレス'],
    type: 'expense', category: '食費', subcategory: '外食',
  },
];

export function autoClassify(itemName: string): AutoClassifyResult | null {
  const normalized = normalizeStoreName(itemName).toLowerCase();
  for (const rule of AUTO_CLASSIFY_RULES) {
    for (const keyword of rule.keywords) {
      if (normalized.includes(keyword.toLowerCase())) {
        return {
          type: rule.type,
          category: rule.category,
          subcategory: rule.subcategory,
          matchedKeyword: keyword,
        };
      }
    }
  }
  return null;
}

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
  // 正規化名でも保存（次回マッチングに使用）
  const normalized = normalizeStoreName(storeName);
  if (normalized && normalized !== storeName.trim()) {
    rules[normalized] = rule;
  }
  localStorage.setItem(RULES_KEY, JSON.stringify(rules));
}

// 正規化・部分一致を考慮したルール検索
export function findMatchingRule(itemName: string): CategoryRule | null {
  const rules = getCategoryRules();
  const trimmed = itemName.trim();

  // 1. 完全一致
  if (rules[trimmed]) return rules[trimmed];

  // 2. 正規化後の完全一致
  const normalized = normalizeStoreName(trimmed);
  if (normalized && rules[normalized]) return rules[normalized];

  // 3. 各ルールキーを正規化して比較・部分一致
  for (const [key, rule] of Object.entries(rules)) {
    const normalizedKey = normalizeStoreName(key);
    if (!normalizedKey || normalizedKey.length < 3) continue;
    if (normalizedKey === normalized) return rule;
    // 部分一致（一方が他方を含む、最低3文字）
    if (normalized.length >= 3) {
      if (normalized.includes(normalizedKey) || normalizedKey.includes(normalized)) return rule;
    }
  }

  return null;
}

export function applyRules<T extends { itemName: string; type: TransactionType; category: string; subcategory: string }>(
  items: T[]
): T[] {
  return items.map(item => {
    const rule = findMatchingRule(item.itemName);
    if (rule) return { ...item, type: rule.type, category: rule.category, subcategory: rule.subcategory };
    return item;
  });
}
