import { useState } from 'react';
import { useApp } from '../contexts/AppContext';
import { TransactionType } from '../types';

interface ParsedRow {
  date: string;
  year: number;
  month: number;
  content: string;
  amount: number;
  type: TransactionType;
  category: string;
  subcategory: string;
  selected: boolean;
}

// マネーフォワードMEの大項目→分類マッピング
const INCOME_KEYWORDS = ['給与', '副収入', '年金', '賞与', '事業', '不動産', '利子', '配当', '臨時'];
const INVESTMENT_KEYWORDS = ['投資', '株式', '投信', '積立', 'iDeCo', 'NISA', '貯蓄', '定期'];

function detectType(category: string, amount: number): TransactionType {
  if (amount > 0) {
    if (INVESTMENT_KEYWORDS.some(k => category.includes(k))) return 'investment';
    return 'income';
  }
  if (INVESTMENT_KEYWORDS.some(k => category.includes(k))) return 'investment';
  return 'expense';
}

function detectCategory(type: TransactionType, mfCategory: string): string {
  if (type === 'income') return INCOME_KEYWORDS.some(k => mfCategory.includes(k)) ? '予算内' : '予算外';
  if (type === 'investment') return '積立投資';
  // 支出カテゴリの推定
  const fixed = ['家賃', '住宅', '保険', '通信', '水道', '電気', 'ガス', 'サブスク', 'NHK', 'ローン'];
  if (fixed.some(k => mfCategory.includes(k))) return '毎月固定費';
  return '毎月変動費';
}

function parseCSV(text: string): ParsedRow[] {
  const lines = text.trim().split('\n').filter(l => l.trim());
  if (lines.length < 2) return [];

  // ヘッダー行を検出
  const headerLine = lines[0];
  const isHeader = headerLine.includes('日付') || headerLine.includes('内容') || headerLine.includes('金額');
  const dataLines = isHeader ? lines.slice(1) : lines;

  const results: ParsedRow[] = [];

  for (const line of dataLines) {
    // CSV パース（カンマ区切り、ダブルクォート対応）
    const cols = line.match(/("(?:[^"]|"")*"|[^,]*)/g)?.map(c =>
      c.replace(/^"|"$/g, '').replace(/""/g, '"').trim()
    ) ?? [];

    if (cols.length < 4) continue;

    // マネーフォワードME形式を検出
    // 形式: 計算対象,日付,内容,金額（円）,保有金融機関,大項目,中項目,メモ,振替,ID
    let dateStr = '', content = '', amountStr = '', bigCat = '', midCat = '';

    if (cols.length >= 7 && (cols[0] === '0' || cols[0] === '1')) {
      // 標準フォーマット（計算対象フラグあり）
      dateStr = cols[1];
      content = cols[2];
      amountStr = cols[3];
      bigCat = cols[5] || '';
      midCat = cols[6] || '';
    } else if (cols[0]?.match(/^\d{4}[\/\-]/)) {
      // 日付が1列目
      dateStr = cols[0];
      content = cols[1];
      amountStr = cols[2];
      bigCat = cols[4] || '';
      midCat = cols[5] || '';
    } else {
      continue;
    }

    // 日付パース
    const dateParts = dateStr.match(/(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/);
    if (!dateParts) continue;
    const year = parseInt(dateParts[1]);
    const month = parseInt(dateParts[2]);

    // 金額パース（カンマ除去、マイナス対応）
    const rawAmount = parseFloat(amountStr.replace(/,/g, '').replace(/[^\d\-\.]/g, ''));
    if (isNaN(rawAmount)) continue;

    const type = detectType(bigCat || content, rawAmount);
    const category = detectCategory(type, bigCat || content);
    const absAmount = Math.abs(rawAmount);

    results.push({
      date: dateStr,
      year,
      month,
      content,
      amount: absAmount,
      type,
      category,
      subcategory: midCat || bigCat || '',
      selected: true
    });
  }

  return results;
}

interface Props {
  onClose: () => void;
}

export default function MoneyForwardImport({ onClose }: Props) {
  const { currentProfile, addTransaction } = useApp();
  const [step, setStep] = useState<'input' | 'preview'>('input');
  const [csvText, setCsvText] = useState('');
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [importing, setImporting] = useState(false);
  const [done, setDone] = useState(false);

  function handleParse() {
    const parsed = parseCSV(csvText);
    if (parsed.length === 0) {
      alert('データを読み取れませんでした。マネーフォワードMEのCSV形式で貼り付けてください。');
      return;
    }
    setRows(parsed);
    setStep('preview');
  }

  function toggleRow(i: number) {
    setRows(prev => prev.map((r, idx) => idx === i ? { ...r, selected: !r.selected } : r));
  }

  function toggleAll(val: boolean) {
    setRows(prev => prev.map(r => ({ ...r, selected: val })));
  }

  async function handleImport() {
    if (!currentProfile) return;
    setImporting(true);
    const selected = rows.filter(r => r.selected);
    for (const row of selected) {
      addTransaction({
        profileId: currentProfile.id,
        year: row.year,
        month: row.month,
        type: row.type,
        category: row.category,
        subcategory: row.subcategory,
        itemName: row.content,
        amount: row.amount,
        note: 'MF取込'
      });
    }
    setImporting(false);
    setDone(true);
    setTimeout(() => onClose(), 1500);
  }

  const TYPE_LABEL: Record<TransactionType, string> = {
    income: '収入',
    expense: '支出',
    investment: '投資・貯蓄'
  };
  const TYPE_COLOR: Record<TransactionType, string> = {
    income: 'text-green-600 bg-green-50',
    expense: 'text-red-600 bg-red-50',
    investment: 'text-blue-600 bg-blue-50'
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end md:items-center justify-center p-0 md:p-4">
      <div className="bg-white rounded-t-2xl md:rounded-2xl w-full md:max-w-2xl max-h-[90vh] flex flex-col">
        {/* ヘッダー */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
          <div>
            <h2 className="font-bold text-gray-800">マネーフォワードME 取込</h2>
            <p className="text-xs text-gray-500">CSVデータを貼り付けてインポート</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {done ? (
            <div className="text-center py-12">
              <div className="text-5xl mb-4">✅</div>
              <p className="text-lg font-bold text-gray-800">取込完了！</p>
              <p className="text-sm text-gray-500 mt-1">{rows.filter(r => r.selected).length}件を追加しました</p>
            </div>
          ) : step === 'input' ? (
            <div className="space-y-4">
              {/* 手順 */}
              <div className="bg-indigo-50 rounded-xl p-4 text-sm text-indigo-800 space-y-1">
                <p className="font-semibold">📋 マネーフォワードMEからのデータ取得方法</p>
                <p>① マネーフォワードMEを開く</p>
                <p>② 「家計簿」→「入出金明細」を開く</p>
                <p>③ 右上の「CSVダウンロード」を押してファイルを開く</p>
                <p>④ 全選択（Cmd+A）してコピー → 下に貼り付け</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  CSVデータを貼り付け
                </label>
                <textarea
                  value={csvText}
                  onChange={e => setCsvText(e.target.value)}
                  placeholder={'計算対象,日付,内容,金額（円）,保有金融機関,大項目,中項目,メモ,振替,ID\n1,2024/01/15,スーパー,-3000,現金,食費,食料品,,0,xxxxx\n1,2024/01/20,給与,250000,銀行,給与,給与,,0,xxxxx'}
                  className="w-full h-48 text-xs font-mono border border-gray-300 rounded-xl p-3 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                />
                <p className="text-xs text-gray-400 mt-1">
                  ※ ヘッダー行（1行目）があっても自動で読み飛ばします
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-gray-700">{rows.length}件を読み取りました</p>
                <div className="flex gap-2 text-xs">
                  <button onClick={() => toggleAll(true)} className="text-indigo-600 hover:underline">全選択</button>
                  <span className="text-gray-300">|</span>
                  <button onClick={() => toggleAll(false)} className="text-gray-500 hover:underline">全解除</button>
                </div>
              </div>

              <div className="text-xs text-yellow-700 bg-yellow-50 rounded-lg p-2">
                ⚠️ 分類は自動推定です。取込後に個別修正できます。
              </div>

              <div className="space-y-1">
                {rows.map((row, i) => (
                  <label key={i} className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer border ${row.selected ? 'border-indigo-200 bg-indigo-50/50' : 'border-gray-100 bg-gray-50 opacity-50'}`}>
                    <input
                      type="checkbox"
                      checked={row.selected}
                      onChange={() => toggleRow(i)}
                      className="rounded text-indigo-600"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${TYPE_COLOR[row.type]}`}>
                          {TYPE_LABEL[row.type]}
                        </span>
                        <span className="text-xs text-gray-500">{row.date}</span>
                      </div>
                      <p className="text-sm font-medium text-gray-800 truncate">{row.content}</p>
                      <p className="text-xs text-gray-500">{row.category} / {row.subcategory}</p>
                    </div>
                    <span className={`text-sm font-bold whitespace-nowrap ${row.type === 'income' ? 'text-green-600' : row.type === 'investment' ? 'text-blue-600' : 'text-red-600'}`}>
                      {row.amount.toLocaleString()}円
                    </span>
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* フッター */}
        {!done && (
          <div className="px-4 py-3 border-t border-gray-100 flex gap-3">
            {step === 'input' ? (
              <>
                <button onClick={onClose} className="flex-1 py-2.5 border border-gray-300 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50">
                  キャンセル
                </button>
                <button
                  onClick={handleParse}
                  disabled={!csvText.trim()}
                  className="flex-1 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-medium hover:bg-indigo-700 disabled:opacity-40"
                >
                  データを確認する
                </button>
              </>
            ) : (
              <>
                <button onClick={() => setStep('input')} className="flex-1 py-2.5 border border-gray-300 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50">
                  戻る
                </button>
                <button
                  onClick={handleImport}
                  disabled={importing || rows.filter(r => r.selected).length === 0}
                  className="flex-1 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-medium hover:bg-indigo-700 disabled:opacity-40"
                >
                  {importing ? '取込中...' : `${rows.filter(r => r.selected).length}件を取込む`}
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
