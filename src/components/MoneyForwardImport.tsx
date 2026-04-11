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
  isTransfer: boolean;
  isExcluded: boolean;
}

// 大項目・中項目から種別を判定
function detectType(bigCat: string, midCat: string, amount: number): TransactionType {
  // 収入カテゴリ
  if (bigCat === '収入') return 'income';

  // 投資・貯蓄カテゴリ
  const investWords = ['株式投資', '積立', 'NISA', 'iDeCo', '投資信託', '定期預金', '貯蓄', '投資'];
  if (investWords.some(w => midCat.includes(w) || bigCat.includes(w))) return 'investment';

  // プラス金額で収入カテゴリ以外 → 収入（その他）
  if (amount > 0) return 'income';

  return 'expense';
}

// 種別からアプリのカテゴリを判定
function detectCategory(type: TransactionType, bigCat: string, midCat: string): string {
  if (type === 'income') {
    const budgetWords = ['給与', '賞与', '年金', '共有'];
    return budgetWords.some(w => midCat.includes(w) || bigCat.includes(w)) ? '予算内' : '予算外';
  }
  if (type === 'investment') return '積立投資';

  // 支出カテゴリ判定
  const fixedWords = ['家賃', '住宅ローン', 'ローン', '通信費', '保険', 'サブスク', 'NHK', '電気', 'ガス', '水道', '駐車場', '税金'];
  if (fixedWords.some(w => midCat.includes(w) || bigCat.includes(w))) return '毎月固定費';
  return '毎月変動費';
}

function parseData(text: string): ParsedRow[] {
  const lines = text.trim().split('\n').filter(l => l.trim());
  if (lines.length < 2) return [];

  // タブ区切り or カンマ区切りを自動検出
  const firstLine = lines[0];
  const delimiter = firstLine.includes('\t') ? '\t' : ',';

  // ヘッダー行をスキップ
  const isHeader = firstLine.includes('日付') || firstLine.includes('内容') || firstLine.includes('金額');
  const dataLines = isHeader ? lines.slice(1) : lines;

  const results: ParsedRow[] = [];

  for (const line of dataLines) {
    let cols: string[];

    if (delimiter === '\t') {
      cols = line.split('\t').map(c => c.trim());
    } else {
      cols = line.match(/("(?:[^"]|"")*"|[^,]*)/g)
        ?.map(c => c.replace(/^"|"$/g, '').replace(/""/g, '"').trim()) ?? [];
    }

    if (cols.length < 4) continue;

    // フォーマット: 計算対象, 日付, 内容, 金額（円）, 保有金融機関, 大項目, 中項目, メモ, 振替, ID
    const calcTarget = cols[0];
    const dateStr = cols[1];
    const content = cols[2] || '（内容なし）';
    const amountStr = cols[3];
    const bigCat = cols[5] || '';
    const midCat = cols[6] || '';
    const isTransfer = cols[8] === '1';

    // 日付パース
    const dateParts = dateStr.match(/(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/);
    if (!dateParts) continue;
    const year = parseInt(dateParts[1]);
    const month = parseInt(dateParts[2]);

    // 金額パース
    const rawAmount = parseFloat(amountStr.replace(/,/g, '').replace(/[^\d\-\.]/g, ''));
    if (isNaN(rawAmount)) continue;

    const type = detectType(bigCat, midCat, rawAmount);
    const category = detectCategory(type, bigCat, midCat);

    results.push({
      date: dateStr,
      year,
      month,
      content,
      amount: Math.abs(rawAmount),
      type,
      category,
      subcategory: midCat || bigCat || '',
      // 計算対象=1 かつ 振替でないものをデフォルト選択
      selected: calcTarget === '1' && !isTransfer,
      isTransfer,
      isExcluded: calcTarget === '0'
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
  const [showAll, setShowAll] = useState(false);

  function handleParse() {
    const parsed = parseData(csvText);
    if (parsed.length === 0) {
      alert('データを読み取れませんでした。マネーフォワードMEのデータを貼り付けてください。');
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
    for (const row of rows.filter(r => r.selected)) {
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

  const TYPE_LABEL: Record<TransactionType, string> = { income: '収入', expense: '支出', investment: '投資' };
  const TYPE_COLOR: Record<TransactionType, string> = {
    income: 'text-green-700 bg-green-50',
    expense: 'text-red-700 bg-red-50',
    investment: 'text-blue-700 bg-blue-50'
  };
  const TYPE_AMOUNT_COLOR: Record<TransactionType, string> = {
    income: 'text-green-600',
    expense: 'text-red-600',
    investment: 'text-blue-600'
  };

  const displayRows = showAll ? rows : rows.filter(r => !r.isTransfer && !r.isExcluded);
  const selectedCount = rows.filter(r => r.selected).length;
  const hiddenCount = rows.filter(r => r.isTransfer || r.isExcluded).length;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end md:items-center justify-center p-0 md:p-4">
      <div className="bg-white rounded-t-2xl md:rounded-2xl w-full md:max-w-2xl max-h-[90vh] flex flex-col">

        {/* ヘッダー */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 shrink-0">
          <div>
            <h2 className="font-bold text-gray-800">マネーフォワードME 取込</h2>
            <p className="text-xs text-gray-500">データを貼り付けてインポート</p>
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
              <p className="text-sm text-gray-500 mt-1">{selectedCount}件を追加しました</p>
            </div>

          ) : step === 'input' ? (
            <div className="space-y-4">
              <div className="bg-indigo-50 rounded-xl p-4 text-sm text-indigo-800 space-y-1">
                <p className="font-semibold">📋 データの貼り付け方</p>
                <p>① マネーフォワードMEを開く</p>
                <p>② 「家計簿」→「入出金明細」を開く</p>
                <p>③ 表の1行目（「計算対象」の行）から最終行まで選択してコピー</p>
                <p>④ 下のエリアに貼り付け（Cmd+V）</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  データを貼り付け
                </label>
                <textarea
                  value={csvText}
                  onChange={e => setCsvText(e.target.value)}
                  placeholder="ここにマネーフォワードMEのデータを貼り付けてください"
                  className="w-full h-40 text-xs font-mono border border-gray-300 rounded-xl p-3 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                />
                {csvText && (
                  <p className="text-xs text-green-600 mt-1">
                    ✓ {csvText.trim().split('\n').length}行のデータを検出
                  </p>
                )}
              </div>
            </div>

          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-gray-700">
                  <span className="text-indigo-600 font-bold">{selectedCount}件</span>選択中（全{rows.length}件）
                </p>
                <div className="flex gap-2 text-xs">
                  <button onClick={() => toggleAll(true)} className="text-indigo-600 hover:underline">全選択</button>
                  <span className="text-gray-300">|</span>
                  <button onClick={() => toggleAll(false)} className="text-gray-500 hover:underline">全解除</button>
                </div>
              </div>

              <div className="bg-amber-50 border border-amber-200 rounded-lg p-2.5 text-xs text-amber-800 space-y-1">
                <p>⚠️ 収入・支出・投資の分類は自動推定です。取込後に個別修正できます。</p>
                {hiddenCount > 0 && (
                  <p>
                    振替・計算対象外の{hiddenCount}件は非選択にしています。
                    <button onClick={() => setShowAll(!showAll)} className="ml-1 underline">
                      {showAll ? '隠す' : '表示する'}
                    </button>
                  </p>
                )}
              </div>

              <div className="space-y-1">
                {displayRows.map((row, i) => {
                  const originalIndex = rows.indexOf(row);
                  return (
                    <label
                      key={i}
                      className={`flex items-center gap-3 p-2.5 rounded-lg cursor-pointer border transition-colors ${
                        row.selected
                          ? 'border-indigo-200 bg-indigo-50/40'
                          : 'border-gray-100 bg-gray-50 opacity-50'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={row.selected}
                        onChange={() => toggleRow(originalIndex)}
                        className="rounded text-indigo-600 shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${TYPE_COLOR[row.type]}`}>
                            {TYPE_LABEL[row.type]}
                          </span>
                          <span className="text-xs text-gray-400">{row.date}</span>
                          {row.isTransfer && <span className="text-xs text-gray-400 bg-gray-100 px-1 rounded">振替</span>}
                          {row.isExcluded && <span className="text-xs text-gray-400 bg-gray-100 px-1 rounded">計算対象外</span>}
                        </div>
                        <p className="text-sm font-medium text-gray-800 truncate">{row.content}</p>
                        <p className="text-xs text-gray-500 truncate">{row.category} ／ {row.subcategory}</p>
                      </div>
                      <span className={`text-sm font-bold whitespace-nowrap ${TYPE_AMOUNT_COLOR[row.type]}`}>
                        {row.amount.toLocaleString()}円
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* フッター */}
        {!done && (
          <div className="px-4 py-3 border-t border-gray-100 flex gap-3 shrink-0">
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
                  内容を確認する →
                </button>
              </>
            ) : (
              <>
                <button onClick={() => setStep('input')} className="flex-1 py-2.5 border border-gray-300 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50">
                  ← 戻る
                </button>
                <button
                  onClick={handleImport}
                  disabled={importing || selectedCount === 0}
                  className="flex-1 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-medium hover:bg-indigo-700 disabled:opacity-40"
                >
                  {importing ? '取込中...' : `${selectedCount}件を取込む`}
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
