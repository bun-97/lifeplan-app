import { useState, useMemo } from 'react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import { useApp } from '../contexts/AppContext';
import { Transaction, TransactionType } from '../types';
import MoneyForwardImport from '../components/MoneyForwardImport';
import { saveCategoryRule, isGenericStoreName } from '../lib/categoryRules';
import { getMajorCategories, getMinorCategories, getEffectiveTag } from '../lib/categoryConfig';
import CategorySettings from '../components/CategorySettings';
import CategorySection, { getCategoryColor, ChevronIcon, ExcludeIcon, ReclassifyIcon } from '../components/actual/CategorySection';
import { fmt } from '../lib/format';

interface FormState {
  type: TransactionType;
  subcategory: string;
  itemName: string;
  amount: string;
  note: string;
}
const defaultForm: FormState = { type: 'expense', subcategory: '', itemName: '', amount: '', note: '' };

interface ReclassifyState {
  tx: Transaction;
  type: TransactionType;
  subcategory: string;
  minorCategory: string;
}

export default function ActualResults() {
  const { currentProfile, transactions, addTransaction, updateTransaction } = useApp();
  const members = currentProfile?.members ?? [];
  const now = new Date();
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1);
  const [showModal, setShowModal] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [showCategorySettings, setShowCategorySettings] = useState(false);
  const [form, setForm] = useState<FormState>(defaultForm);
  const [minorCategory, setMinorCategory] = useState('');
  const [expenseType, setExpenseType] = useState<'毎月固定'|'毎月変動'|'不定期固定'|'不定期変動'|''>('');
  const [budgetType, setBudgetType] = useState<'予算内'|'予算外'|''>('');
  const [member, setMember] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [reclassify, setReclassify] = useState<ReclassifyState | null>(null);
  const [applyToAll, setApplyToAll] = useState(false);

  const monthlyTx = useMemo(
    () => transactions.filter(t => t.year === selectedYear && t.month === selectedMonth),
    [transactions, selectedYear, selectedMonth]
  );

  const totalIncome = useMemo(() => monthlyTx.filter(t => t.type === 'income' && !t.excluded).reduce((s, t) => s + t.amount, 0), [monthlyTx]);
  const totalExpense = useMemo(() => monthlyTx.filter(t => t.type === 'expense' && !t.excluded).reduce((s, t) => s + t.amount, 0), [monthlyTx]);
  // 投資額 = investmentタイプの合計
  const totalInvestment = useMemo(() => monthlyTx.filter(t => t.type === 'investment' && !t.excluded).reduce((s, t) => s + t.amount, 0), [monthlyTx]);
  // 貯蓄 = 収入 - 支出 - 投資（投資・貯蓄は含まない）
  const totalSavings = totalIncome - totalExpense - totalInvestment;
  // 支出率 = 支出 ÷ 収入（投資・貯蓄は含まない）
  const expenseRate = totalIncome > 0 ? Math.round(totalExpense / totalIncome * 100) : 0;

  const investSavPieData = useMemo(() => {
    const map: Record<string, number> = {};
    monthlyTx.filter(t => (t.type === 'investment' || t.type === 'savings') && !t.excluded)
      .forEach(t => { const k = t.subcategory || t.itemName; map[k] = (map[k] || 0) + t.amount; });
    return Object.entries(map).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [monthlyTx]);

  const investSavPieDataFull = useMemo(() => {
    const displaySavings = Math.max(0, totalSavings);
    if (displaySavings <= 0) return investSavPieData;
    return [...investSavPieData, { name: '貯蓄', value: displaySavings }]
      .sort((a, b) => b.value - a.value);
  }, [investSavPieData, totalSavings]);

  const typeLabel: Record<TransactionType, string> = { income: '収入', expense: '支出', investment: '投資', savings: '貯蓄' };

  function toggleGroup(key: string) {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }

  function prevMonth() {
    if (selectedMonth === 1) { setSelectedMonth(12); setSelectedYear(y => y - 1); }
    else setSelectedMonth(m => m - 1);
  }
  function nextMonth() {
    if (selectedMonth === 12) { setSelectedMonth(1); setSelectedYear(y => y + 1); }
    else setSelectedMonth(m => m + 1);
  }

  function openAdd() {
    setForm(defaultForm); setMinorCategory(''); setExpenseType(''); setBudgetType(''); setMember(''); setEditingId(null); setShowModal(true);
  }

  function handleSubmit() {
    if (!form.subcategory.trim() || !form.itemName.trim() || !form.amount) return;
    const amount = Number(form.amount);
    if (isNaN(amount) || amount <= 0) return;
    if (editingId) {
      const existing = transactions.find(t => t.id === editingId);
      if (existing) updateTransaction({ ...existing, type: form.type, category: form.subcategory, subcategory: form.subcategory, minorCategory: minorCategory || undefined, itemName: form.itemName, amount, note: form.note || undefined, expenseType: expenseType || undefined, budgetType: budgetType || undefined, member: member || undefined });
    } else {
      if (!currentProfile) return;
      addTransaction({ profileId: currentProfile.id, year: selectedYear, month: selectedMonth, type: form.type, category: form.subcategory, subcategory: form.subcategory, minorCategory: minorCategory || undefined, itemName: form.itemName, amount, note: form.note || undefined, expenseType: expenseType || undefined, budgetType: budgetType || undefined, member: member || undefined });
    }
    setShowModal(false); setForm(defaultForm); setMinorCategory(''); setExpenseType(''); setBudgetType(''); setMember(''); setEditingId(null);
  }

  function openReclassify(tx: Transaction) {
    setReclassify({ tx, type: tx.type, subcategory: tx.subcategory, minorCategory: tx.minorCategory || '' });
    setApplyToAll(true);
  }

  function handleReclassify() {
    if (!reclassify) return;
    const { tx, type, subcategory, minorCategory } = reclassify;
    const update = (t: Transaction) => updateTransaction({ ...t, type, category: subcategory, subcategory, minorCategory: minorCategory || undefined });
    update(tx);
    if (applyToAll) {
      transactions.filter(t => t.itemName === tx.itemName && t.id !== tx.id && t.type === tx.type).forEach(update);
      // 汎用名称は学習ルールに保存しない（「内容なし」「不明」などは店名として適さない）
      if (!isGenericStoreName(tx.itemName)) {
        saveCategoryRule(tx.itemName, { type, category: subcategory, subcategory });
      }
    }
    setReclassify(null);
  }

  if (!currentProfile) return <div className="flex items-center justify-center h-64"><p className="text-gray-500">プロファイルを作成してください</p></div>;

  const categorySectionProps = { monthlyTx, expandedGroups, toggleGroup, selectedMonth, openReclassify, updateTransaction };

  // MF取込の種別ロック判定
  // - MF収入（プラス）→ 収入のみ許可
  // - MF支出（マイナス）→ 支出・投資・貯蓄のみ許可（収入禁止）
  function getMfTypeLock(tx: Transaction) {
    const isMf = tx.source === 'mf' || tx.note === 'MF取込';
    if (!isMf) return null;
    if (tx.type === 'income') return 'income-only';
    if (tx.type === 'expense') return 'no-income';
    return null; // investment/savingsは収入に変更可
  }

  return (
    <div className="w-full relative">

      {/* ===== TOP HEADER SECTION ===== */}
      <div className="bg-white border-b border-gray-100 px-4 pt-4 pb-4">
        <div className="flex items-center mb-3">
          <button onClick={prevMonth} className="p-2 rounded-lg hover:bg-gray-100 text-gray-600">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
          </button>
          <div className="flex-1 text-center font-semibold text-lg text-gray-800">
            {selectedYear}年{selectedMonth}月
          </div>
          <button onClick={nextMonth} className="p-2 rounded-lg hover:bg-gray-100 text-gray-600">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
            </svg>
          </button>
        </div>

        {/* 支出率 */}
        <div className="flex justify-center mb-4">
          <div className="text-center">
            <p className="text-xs text-gray-400 mb-1">支出率</p>
            <div className={`relative inline-block ${expenseRate >= 80 ? 'text-red-500' : 'text-gray-800'}`}>
              <span className="text-4xl font-bold">{expenseRate}</span>
              <span className="text-lg font-semibold absolute -right-5 bottom-1">%</span>
            </div>
          </div>
        </div>

        {/* 収入 / 支出 / 投資貯蓄 */}
        <div className="grid grid-cols-3 divide-x divide-gray-100">
          <div className="text-center px-2">
            <p className="text-xs text-gray-400 mb-0.5">収入</p>
            <p className="text-sm font-bold text-blue-600 tabular-nums">{fmt(totalIncome)}</p>
          </div>
          <div className="text-center px-2">
            <p className="text-xs text-gray-400 mb-0.5">支出</p>
            <p className="text-sm font-bold text-red-500 tabular-nums">{fmt(totalExpense)}</p>
          </div>
          <div className="text-center px-2">
            <p className="text-xs text-gray-400 mb-0.5">投資貯蓄</p>
            <p className={`text-sm font-bold tabular-nums ${totalSavings >= 0 ? 'text-green-600' : 'text-red-500'}`}>
              {totalSavings >= 0 ? '+' : ''}{fmt(totalSavings)}
            </p>
          </div>
        </div>
      </div>

      <div className="p-4 space-y-4">

        {/* ===== PIE CHART SECTION: 3-column ===== */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="grid grid-cols-3 divide-x divide-gray-100">
            <CategorySection type="income" {...categorySectionProps} />
            <CategorySection type="expense" {...categorySectionProps} />

            {/* 投資・貯蓄 column */}
            <div className="flex flex-col">
              <p className="text-xs font-medium text-green-600 text-center py-2 border-b border-gray-100">投資・貯蓄</p>
              {investSavPieDataFull.length > 0 ? (
                <>
                  <ResponsiveContainer width="100%" height={110}>
                    <PieChart>
                      <Pie data={investSavPieDataFull} dataKey="value" cx="50%" cy="50%" innerRadius={22} outerRadius={38}>
                        {investSavPieDataFull.map((entry, i) => (
                          <Cell key={i} fill={getCategoryColor(entry.name, i)} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(v: number) => fmt(v)} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="divide-y divide-gray-50">
                    {investSavPieData.map((item, i) => {
                      // ％は「投資+貯蓄の合計」に対する割合
                      const grandTotal = totalInvestment + totalSavings;
                      const pct = grandTotal > 0 ? Math.round(item.value / grandTotal * 100) : 0;
                      const color = getCategoryColor(item.name, i);
                      const groupKey = `invest-${item.name}`;
                      const isExpanded = expandedGroups.has(groupKey);
                      // このカテゴリに属する明細（除外済み含む・日付降順）
                      const itemTx = monthlyTx
                        .filter(t => (t.type === 'investment' || t.type === 'savings') && (t.subcategory || t.itemName) === item.name)
                        .sort((a, b) => (b.day || 0) - (a.day || 0));
                      return (
                        <div key={item.name}>
                          <button
                            onClick={() => toggleGroup(groupKey)}
                            className="w-full flex items-center pl-1 pr-2 py-2 gap-1.5 border-b border-gray-100 hover:bg-gray-50 transition-colors"
                          >
                            <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
                            <span className="text-xs text-gray-700 flex-1 truncate text-left">{item.name}</span>
                            <div className="text-right shrink-0 w-14">
                              <p className="text-xs font-medium text-gray-700 tabular-nums">{fmt(item.value)}</p>
                              <p className="text-[10px] text-gray-400">{pct}%</p>
                            </div>
                            <ChevronIcon expanded={isExpanded} />
                          </button>
                          {isExpanded && (
                            <div className="bg-gray-100 divide-y divide-gray-200">
                              {itemTx.map(tx => (
                                <div key={tx.id} className={`flex items-center pl-3 pr-1 py-1.5 gap-1 ${tx.excluded ? 'opacity-40' : ''}`}>
                                  <div className="flex-1 min-w-0">
                                    <p className={`text-[10px] text-gray-700 truncate ${tx.excluded ? 'line-through' : ''}`}>{tx.itemName}</p>
                                    <p className="text-[9px] text-gray-400 tabular-nums">
                                      {tx.day ? `${selectedMonth}/${tx.day}` : `${selectedMonth}月`} · {fmt(tx.amount)}
                                    </p>
                                  </div>
                                  <button
                                    onClick={e => { e.stopPropagation(); updateTransaction({ ...tx, excluded: !tx.excluded }); }}
                                    className={`p-1 shrink-0 ${tx.excluded ? 'text-orange-400' : 'text-gray-300 hover:text-orange-400'}`}
                                    title={tx.excluded ? '集計に含める' : '集計から除外'}
                                  >
                                    <ExcludeIcon excluded={!!tx.excluded} />
                                  </button>
                                  <button
                                    onClick={e => { e.stopPropagation(); openReclassify(tx); }}
                                    className="text-gray-300 hover:text-indigo-500 p-1 shrink-0"
                                    title="分類変更"
                                  >
                                    <ReclassifyIcon />
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                    {/* 貯蓄行（収入 - 支出 - 投資の計算値） */}
                    {(() => {
                      const grandTotal = totalInvestment + totalSavings;
                      const savingsPct = grandTotal > 0 ? Math.round(totalSavings / grandTotal * 100) : 0;
                      return (
                        <div className="flex items-center pl-1 pr-2 py-2 gap-1.5">
                          <div className="w-2.5 h-2.5 rounded-full shrink-0 bg-green-500" />
                          <span className="text-xs font-semibold text-gray-700 flex-1">貯蓄</span>
                          <div className="text-right shrink-0 w-14">
                            <p className="text-xs font-semibold tabular-nums text-gray-700">{fmt(Math.max(0, totalSavings))}</p>
                            {grandTotal > 0 && totalSavings > 0 && <p className="text-[10px] text-gray-400">{savingsPct}%</p>}
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                </>
              ) : (
                <div className="flex flex-col items-center justify-center py-8 text-gray-300 gap-1">
                  <p className="text-xs">収入 − 支出</p>
                  <p className="text-sm font-semibold text-green-600">{fmt(totalSavings)}</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ===== ACTION BUTTONS ===== */}
        <div className="flex gap-2">
          <button onClick={openAdd} className="flex-1 bg-indigo-600 text-white py-3 rounded-xl font-medium hover:bg-indigo-700 flex items-center justify-center gap-2 text-sm">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
            取引を追加
          </button>
          <button onClick={() => setShowImport(true)} className="flex-1 bg-white border border-indigo-300 text-indigo-600 py-3 rounded-xl font-medium hover:bg-indigo-50 flex items-center justify-center gap-2 text-sm">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" /></svg>
            MF取込
          </button>
        </div>

      </div>

      {/* ===== ADD/EDIT MODAL ===== */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end md:items-center justify-center p-0 md:p-4">
          <div className="bg-white w-full md:max-w-md rounded-t-2xl md:rounded-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b border-gray-100">
              <h2 className="text-base font-semibold text-gray-800">{editingId ? '取引を編集' : '取引を追加'}</h2>
              <button onClick={() => { setShowModal(false); setEditingId(null); }} className="text-gray-400 hover:text-gray-600">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">種別</label>
                <div className="flex gap-2">
                  {(['income', 'expense', 'investment', 'savings'] as TransactionType[]).map(t => (
                    <button key={t} onClick={() => { setForm(f => ({ ...f, type: t, subcategory: '' })); setMinorCategory(''); }}
                      className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${form.type === t ? (t === 'income' ? 'bg-blue-500 text-white border-blue-500' : t === 'expense' ? 'bg-red-500 text-white border-red-500' : t === 'savings' ? 'bg-green-600 text-white border-green-600' : 'bg-gray-600 text-white border-gray-600') : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'}`}>
                      {typeLabel[t]}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">大分類</label>
                <select
                  value={form.subcategory}
                  onChange={e => {
                    const newSubcat = e.target.value;
                    setForm(f => ({ ...f, subcategory: newSubcat }));
                    setMinorCategory('');
                    const tags = getEffectiveTag(form.type, newSubcat);
                    if (tags.expenseType) setExpenseType(tags.expenseType as '毎月固定'|'毎月変動'|'不定期固定'|'不定期変動');
                    if (tags.budgetType) setBudgetType(tags.budgetType as '予算内'|'予算外');
                  }}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm bg-white"
                >
                  <option value="">選択してください</option>
                  {getMajorCategories(form.type).map(node => (
                    <option key={node.id} value={node.name}>{node.name}</option>
                  ))}
                </select>
              </div>
              {getMinorCategories(form.type, form.subcategory).length > 0 && (
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">中分類</label>
                  <select
                    value={minorCategory}
                    onChange={e => {
                      const newMinor = e.target.value;
                      setMinorCategory(newMinor);
                      const tags = getEffectiveTag(form.type, form.subcategory, newMinor);
                      if (tags.expenseType) setExpenseType(tags.expenseType as '毎月固定'|'毎月変動'|'不定期固定'|'不定期変動');
                      if (tags.budgetType) setBudgetType(tags.budgetType as '予算内'|'予算外');
                    }}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm bg-white"
                  >
                    <option value="">選択してください</option>
                    {getMinorCategories(form.type, form.subcategory).map(sub => (
                      <option key={sub} value={sub}>{sub}</option>
                    ))}
                  </select>
                </div>
              )}
              {form.type === 'expense' && (
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">支出分類</label>
                  <select
                    value={expenseType}
                    onChange={e => setExpenseType(e.target.value as '毎月固定'|'毎月変動'|'不定期固定'|'不定期変動'|'')}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm bg-white"
                  >
                    <option value="">選択してください</option>
                    <option value="毎月固定">毎月固定</option>
                    <option value="毎月変動">毎月変動</option>
                    <option value="不定期固定">不定期固定</option>
                    <option value="不定期変動">不定期変動</option>
                  </select>
                </div>
              )}
              {form.type === 'income' && (
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">予算区分</label>
                  <select
                    value={budgetType}
                    onChange={e => setBudgetType(e.target.value as '予算内'|'予算外'|'')}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm bg-white"
                  >
                    <option value="">選択してください</option>
                    <option value="予算内">予算内（給与・定期収入）</option>
                    <option value="予算外">予算外（ボーナス・臨時収入）</option>
                  </select>
                </div>
              )}
              {members.length > 0 && (
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">メンバー</label>
                  <select
                    value={member}
                    onChange={e => setMember(e.target.value)}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm bg-white"
                  >
                    <option value="">全員 / 共通</option>
                    {members.map(m => (
                      <option key={m.id} value={m.name}>{m.name}</option>
                    ))}
                  </select>
                </div>
              )}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">店名・品目名</label>
                <input type="text" value={form.itemName} onChange={e => setForm(f => ({ ...f, itemName: e.target.value }))} placeholder="スーパー、家賃支払いなど" className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">金額（円）</label>
                <input type="number" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} placeholder="0" min="0" className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">メモ（任意）</label>
                <input type="text" value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))} placeholder="備考など" className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
              <button onClick={handleSubmit} disabled={!form.subcategory.trim() || !form.itemName.trim() || !form.amount} className="w-full bg-indigo-600 text-white py-3 rounded-xl font-medium hover:bg-indigo-700 disabled:opacity-50">
                {editingId ? '更新する' : '追加する'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===== RECLASSIFY MODAL ===== */}
      {reclassify && (() => {
        const mfLock = getMfTypeLock(reclassify.tx);
        // ロック判定: mfLock='income-only' → income以外無効, 'no-income' → income無効
        const isTypeLocked = (t: TransactionType) => {
          if (!mfLock) return false;
          if (mfLock === 'income-only') return t !== 'income';
          if (mfLock === 'no-income') return t === 'income';
          return false;
        };
        return (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-end md:items-center justify-center p-0 md:p-4">
            <div className="bg-white w-full md:max-w-md rounded-t-2xl md:rounded-2xl">
              <div className="flex items-center justify-between p-4 border-b border-gray-100">
                <h2 className="text-base font-semibold text-gray-800">分類を変更</h2>
                <button onClick={() => setReclassify(null)} className="text-gray-400 hover:text-gray-600">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
              <div className="p-4 space-y-4">
                <div className="bg-gray-50 rounded-lg px-3 py-2 text-sm text-gray-600 flex items-center gap-2">
                  <span className="font-medium flex-1">{reclassify.tx.itemName}</span>
                  <span className="text-xs text-gray-400">{fmt(reclassify.tx.amount)}</span>
                  {(reclassify.tx.source === 'mf' || reclassify.tx.note === 'MF取込') && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-500 shrink-0">MF取込</span>
                  )}
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1.5">種別</label>
                  <div className="flex gap-2">
                    {(['income', 'expense', 'investment', 'savings'] as TransactionType[]).map(t => {
                      const locked = isTypeLocked(t);
                      return (
                        <button
                          key={t}
                          onClick={() => !locked && setReclassify(r => r ? { ...r, type: t, subcategory: '' } : r)}
                          disabled={locked}
                          className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${
                            reclassify.type === t
                              ? (t === 'income' ? 'bg-blue-500 text-white border-blue-500'
                                : t === 'expense' ? 'bg-red-500 text-white border-red-500'
                                : t === 'savings' ? 'bg-green-600 text-white border-green-600'
                                : 'bg-gray-600 text-white border-gray-600')
                              : locked
                              ? 'bg-gray-100 text-gray-300 border-gray-200 cursor-not-allowed'
                              : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
                          }`}
                        >
                          {typeLabel[t]}
                        </button>
                      );
                    })}
                  </div>
                  {mfLock && (
                    <p className="text-[10px] text-gray-400 mt-1">
                      {mfLock === 'income-only'
                        ? '💡 MF取込の収入はカテゴリのみ変更できます'
                        : '💡 MF取込の支出は支出・投資・貯蓄に変更できます'}
                    </p>
                  )}
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">大分類</label>
                  <select
                    value={reclassify.subcategory}
                    onChange={e => setReclassify(r => r ? { ...r, subcategory: e.target.value, minorCategory: '' } : r)}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm bg-white"
                  >
                    <option value="">選択してください</option>
                    {getMajorCategories(reclassify.type).map(node => (
                      <option key={node.id} value={node.name}>{node.name}</option>
                    ))}
                  </select>
                </div>
                {getMinorCategories(reclassify.type, reclassify.subcategory).length > 0 && (
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">中分類</label>
                    <select
                      value={reclassify.minorCategory}
                      onChange={e => setReclassify(r => r ? { ...r, minorCategory: e.target.value } : r)}
                      className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm bg-white"
                    >
                      <option value="">選択してください</option>
                      {getMinorCategories(reclassify.type, reclassify.subcategory).map(sub => (
                        <option key={sub} value={sub}>{sub}</option>
                      ))}
                    </select>
                  </div>
                )}
                {isGenericStoreName(reclassify.tx.itemName) ? (
                  <div className="flex items-start gap-2 bg-amber-50 rounded-lg px-3 py-2.5">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4 text-amber-500 shrink-0 mt-0.5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                    </svg>
                    <p className="text-xs text-amber-700">「{reclassify.tx.itemName}」は汎用的な名称のため、分類の学習は行いません</p>
                  </div>
                ) : (
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input type="checkbox" checked={applyToAll} onChange={e => setApplyToAll(e.target.checked)} className="rounded text-indigo-600 w-4 h-4" />
                    <div>
                      <p className="text-sm font-medium text-gray-700">「{reclassify.tx.itemName}」を今後も同じ分類に</p>
                      <p className="text-xs text-gray-400">同じ店名の取引に一括適用し、次回取込時も自動分類します</p>
                    </div>
                  </label>
                )}
                <button onClick={handleReclassify} className="w-full bg-indigo-600 text-white py-3 rounded-xl font-medium hover:bg-indigo-700">
                  変更を保存
                </button>
                <div className="text-center pt-1">
                  <button onClick={() => { setReclassify(null); setShowCategorySettings(true); }} className="text-xs text-gray-400 hover:text-indigo-500">
                    カテゴリを追加・編集はこちら →
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {showImport && <MoneyForwardImport onClose={() => setShowImport(false)} />}
      {showCategorySettings && <CategorySettings onClose={() => setShowCategorySettings(false)} />}
    </div>
  );
}
