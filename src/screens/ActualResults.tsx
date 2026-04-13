import { useState, useMemo } from 'react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import { useApp } from '../contexts/AppContext';
import { Transaction, TransactionType } from '../types';
import MoneyForwardImport from '../components/MoneyForwardImport';
import { saveCategoryRule } from '../lib/categoryRules';
import { getMajorCategories, getMinorCategories, getEffectiveTag } from '../lib/categoryConfig';
import CategorySettings from '../components/CategorySettings';

const MF_CATEGORY_COLORS: Record<string, string> = {
  '食費': '#E94B3C', '外食': '#E94B3C', '食料品': '#E94B3C',
  '日用品': '#8BC34A', 'スキンケア用品': '#8BC34A', '雑費': '#8BC34A',
  '交際費': '#42A5F5', '娯楽費': '#5C6BC0', '家族交際費': '#42A5F5',
  'サブスク': '#26A65B', '通信費': '#00ACC1', 'ローン返済': '#26A65B',
  '税金': '#78909C', '光熱費': '#00897B',
  'ガソリン': '#546E7A', '自動車保険': '#546E7A', '駐車場': '#607D8B',
  '株式投資': '#37474F', '積立投資': '#37474F', '定期預金': '#455A64',
  '給与': '#1E88E5', '利子所得': '#29B6F6', '共有NISA積立分': '#0288D1',
  '事業投資': '#8D6E63', 'その他': '#90A4AE',
};
const CHART_COLORS = ['#E94B3C','#26A65B','#42A5F5','#546E7A','#8BC34A','#5C6BC0','#00ACC1','#78909C','#37474F','#FF7043'];

function getCategoryColor(name: string, index: number): string {
  return MF_CATEGORY_COLORS[name] ?? CHART_COLORS[index % CHART_COLORS.length];
}

function fmt(n: number): string { return n.toLocaleString('ja-JP') + '円'; }
function fmtShort(n: number): string {
  if (n >= 10000) return (n / 10000).toFixed(1).replace(/\.0$/, '') + '万円';
  return n.toLocaleString('ja-JP') + '円';
}

interface FormState {
  type: TransactionType;
  subcategory: string;
  itemName: string;
  amount: string;
  note: string;
}
const defaultForm: FormState = { type: 'expense', subcategory: '', itemName: '', amount: '', note: '' };

// Category change modal state
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
  const totalInvestment = useMemo(() => monthlyTx.filter(t => t.type === 'investment' && !t.excluded).reduce((s, t) => s + t.amount, 0), [monthlyTx]);
  const balance = totalIncome - totalExpense - totalInvestment;
  const expenseRate = totalIncome > 0 ? Math.round(totalExpense / totalIncome * 100) : 0;

  // Pie data
  const expensePieData = useMemo(() => {
    const map: Record<string, number> = {};
    monthlyTx.filter(t => t.type === 'expense' && !t.excluded).forEach(t => { const k = t.subcategory || t.itemName; map[k] = (map[k] || 0) + t.amount; });
    return Object.entries(map).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [monthlyTx]);

  const incomePieData = useMemo(() => {
    const map: Record<string, number> = {};
    monthlyTx.filter(t => t.type === 'income' && !t.excluded).forEach(t => { const k = t.subcategory || t.itemName; map[k] = (map[k] || 0) + t.amount; });
    return Object.entries(map).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [monthlyTx]);

  const expensePieTotal = expensePieData.reduce((s, d) => s + d.value, 0);
  const incomePieTotal = incomePieData.reduce((s, d) => s + d.value, 0);

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

  function openAdd() { setForm(defaultForm); setMinorCategory(''); setExpenseType(''); setBudgetType(''); setMember(''); setEditingId(null); setShowModal(true); }

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
    setApplyToAll(false);
  }

  function handleReclassify() {
    if (!reclassify) return;
    const { tx, type, subcategory, minorCategory } = reclassify;
    const update = (t: Transaction) => updateTransaction({ ...t, type, category: subcategory, subcategory, minorCategory: minorCategory || undefined });
    update(tx);
    if (applyToAll) {
      transactions.filter(t => t.itemName === tx.itemName && t.id !== tx.id).forEach(update);
      saveCategoryRule(tx.itemName, { type, category: subcategory, subcategory });
    }
    setReclassify(null);
  }

  const typeLabel: Record<TransactionType, string> = { income: '収入', expense: '支出', investment: '投資・貯蓄' };

  if (!currentProfile) return <div className="flex items-center justify-center h-64"><p className="text-gray-500">プロファイルを作成してください</p></div>;

  return (
    <div className="w-full relative">

      {/* Settings gear button */}
      <button onClick={() => setShowCategorySettings(true)} className="absolute right-3 top-3 text-gray-400 text-lg z-10">⚙</button>

      {/* ===== TOP HEADER SECTION ===== */}
      <div className="bg-white border-b border-gray-100 px-4 pt-4 pb-4">
        {/* Month navigation - card style */}
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

        {/* Expense rate — large main number, % as right adornment */}
        <div className="text-center mb-4">
          <p className="text-xs text-gray-400 mb-1">支出率</p>
          <div className="flex justify-center">
            <div className={`relative inline-block ${expenseRate >= 80 ? 'text-red-500' : 'text-gray-800'}`}>
              <span className="text-5xl font-bold">{expenseRate}</span>
              <span className="text-xl font-semibold absolute -right-6 bottom-1.5">%</span>
            </div>
          </div>
        </div>

        {/* 3-column summary */}
        <div className="grid grid-cols-3 divide-x divide-gray-100">
          <div className="text-center px-2">
            <p className="text-xs text-gray-400 mb-0.5">収入</p>
            <p className="text-base font-bold text-blue-600">{fmtShort(totalIncome)}</p>
          </div>
          <div className="text-center px-2">
            <p className="text-xs text-gray-400 mb-0.5">支出</p>
            <p className="text-base font-bold text-red-500">{fmtShort(totalExpense)}</p>
          </div>
          <div className="text-center px-2">
            <p className="text-xs text-gray-400 mb-0.5">収支</p>
            <p className={`text-base font-bold ${balance >= 0 ? 'text-gray-800' : 'text-red-500'}`}>
              {balance >= 0 ? '+' : ''}{fmtShort(balance)}
            </p>
          </div>
        </div>
      </div>

      <div className="p-4 space-y-4">

        {/* ===== PIE CHART SECTION: 2-column ===== */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="grid grid-cols-2 divide-x divide-gray-100">
            {/* LEFT: Income */}
            <div className="flex flex-col">
              <p className="text-xs font-medium text-blue-600 text-center py-2 border-b border-gray-100">収入</p>
              {incomePieData.length > 0 ? (
                <>
                  <ResponsiveContainer width="100%" height={150}>
                    <PieChart>
                      <Pie data={incomePieData} dataKey="value" cx="50%" cy="50%" innerRadius={35} outerRadius={58}>
                        {incomePieData.map((entry, i) => (
                          <Cell key={i} fill={getCategoryColor(entry.name, i)} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(v: number) => fmt(v)} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="divide-y divide-gray-50">
                    {incomePieData.map((item, i) => {
                      const pct = incomePieTotal > 0 ? Math.round(item.value / incomePieTotal * 100) : 0;
                      const color = getCategoryColor(item.name, i);
                      const majorTx = monthlyTx.filter(t => t.type === 'income' && (t.subcategory || t.itemName) === item.name);
                      // Group by minor category
                      const minorMap: Record<string, number> = {};
                      majorTx.forEach(t => { const k = t.minorCategory || t.itemName; minorMap[k] = (minorMap[k] || 0) + t.amount; });
                      const minorGroups = Object.entries(minorMap).map(([name, total]) => ({ name, total })).sort((a, b) => b.total - a.total);
                      return (
                        <div key={item.name}>
                          {/* 大分類行 */}
                          <div className="w-full flex items-center pl-1 pr-2 py-2 gap-1.5 border-b border-gray-100">
                            <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
                            <span className="text-xs font-semibold text-gray-800 flex-1 truncate text-left">{item.name}</span>
                            <div className="text-right shrink-0">
                              <p className="text-xs font-medium text-gray-700">{fmt(item.value)}</p>
                              <p className="text-[10px] text-gray-400">{pct}%</p>
                            </div>
                          </div>
                          {/* 中分類・明細（常時表示） */}
                          <div>
                            {minorGroups.map(minor => {
                              const minorKey = `income-${item.name}-${minor.name}`;
                              const minorExpanded = expandedGroups.has(minorKey);
                              const minorTx = majorTx.filter(t => (t.minorCategory || t.itemName) === minor.name).sort((a, b) => (b.day || 0) - (a.day || 0));
                              return (
                                <div key={minor.name} className="border-b border-gray-50 last:border-0">
                                  {/* 中分類行 */}
                                  <button onClick={() => toggleGroup(minorKey)} className="w-full flex items-center pl-5 pr-2 py-1.5 gap-1.5 bg-white hover:bg-gray-50 transition-colors">
                                    <span className="text-[9px] shrink-0" style={{ color }}>●</span>
                                    <span className="text-xs text-gray-600 flex-1 truncate text-left">{minor.name}</span>
                                    <span className="text-xs text-gray-600 shrink-0">{fmt(minor.total)}</span>
                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className={`w-3 h-3 text-gray-300 shrink-0 transition-transform ${minorExpanded ? 'rotate-180' : ''}`}>
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                                    </svg>
                                  </button>
                                  {/* 明細行 */}
                                  {minorExpanded && (
                                    <div className="bg-gray-100 divide-y divide-gray-200">
                                      {minorTx.map(tx => (
                                        <div key={tx.id} className={`flex items-center pl-7 pr-2 py-1.5 gap-1 ${tx.excluded ? 'opacity-40' : ''}`}>
                                          <div className="flex-1 min-w-0">
                                            <p className={`text-xs text-gray-700 truncate ${tx.excluded ? 'line-through' : ''}`}>{tx.itemName}</p>
                                            <p className="text-[10px] text-gray-400">{selectedMonth}/{tx.day || '?'} · {fmt(tx.amount)}</p>
                                            <div className="flex gap-1 flex-wrap mt-0.5">
                                              {tx.budgetType && (
                                                <span className={`text-[10px] px-1 py-0.5 rounded-full ${tx.budgetType === '予算内' ? 'bg-green-50 text-green-600' : 'bg-orange-50 text-orange-600'}`}>{tx.budgetType}</span>
                                              )}
                                              {tx.member && (
                                                <span className="text-[10px] px-1 py-0.5 rounded-full bg-purple-50 text-purple-600">{tx.member}</span>
                                              )}
                                            </div>
                                          </div>
                                          <button onClick={() => updateTransaction({ ...tx, excluded: !tx.excluded })} className={`p-0.5 shrink-0 ${tx.excluded ? 'text-orange-400' : 'text-gray-300 hover:text-orange-400'}`} title={tx.excluded ? '集計に含める' : '集計から除外'}>
                                            {tx.excluded ? (
                                              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-3.5 h-3.5"><path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" /></svg>
                                            ) : (
                                              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-3.5 h-3.5"><path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" /></svg>
                                            )}
                                          </button>
                                          <button onClick={() => openReclassify(tx)} className="text-gray-300 hover:text-indigo-500 p-0.5 shrink-0" title="分類変更">
                                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-3.5 h-3.5"><path strokeLinecap="round" strokeLinejoin="round" d="M9.568 3H5.25A2.25 2.25 0 003 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 005.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 009.568 3z" /><path strokeLinecap="round" strokeLinejoin="round" d="M6 6h.008v.008H6V6z" /></svg>
                                          </button>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              ) : (
                <div className="flex items-center justify-center py-10 text-gray-300">
                  <p className="text-xs">データなし</p>
                </div>
              )}
            </div>

            {/* RIGHT: Expense */}
            <div className="flex flex-col">
              <p className="text-xs font-medium text-red-500 text-center py-2 border-b border-gray-100">支出</p>
              {expensePieData.length > 0 ? (
                <>
                  <ResponsiveContainer width="100%" height={150}>
                    <PieChart>
                      <Pie data={expensePieData} dataKey="value" cx="50%" cy="50%" innerRadius={35} outerRadius={58}>
                        {expensePieData.map((entry, i) => (
                          <Cell key={i} fill={getCategoryColor(entry.name, i)} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(v: number) => fmt(v)} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="divide-y divide-gray-50">
                    {expensePieData.map((item, i) => {
                      const pct = expensePieTotal > 0 ? Math.round(item.value / expensePieTotal * 100) : 0;
                      const color = getCategoryColor(item.name, i);
                      const majorTx = monthlyTx.filter(t => t.type === 'expense' && (t.subcategory || t.itemName) === item.name);
                      // Group by minor category
                      const minorMap: Record<string, number> = {};
                      majorTx.forEach(t => { const k = t.minorCategory || t.itemName; minorMap[k] = (minorMap[k] || 0) + t.amount; });
                      const minorGroups = Object.entries(minorMap).map(([name, total]) => ({ name, total })).sort((a, b) => b.total - a.total);
                      return (
                        <div key={item.name}>
                          {/* 大分類行 */}
                          <div className="w-full flex items-center pl-1 pr-2 py-2 gap-1.5 border-b border-gray-100">
                            <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
                            <span className="text-xs font-semibold text-gray-800 flex-1 truncate text-left">{item.name}</span>
                            <div className="text-right shrink-0">
                              <p className="text-xs font-medium text-gray-700">{fmt(item.value)}</p>
                              <p className="text-[10px] text-gray-400">{pct}%</p>
                            </div>
                          </div>
                          {/* 中分類・明細（常時表示） */}
                          <div>
                            {minorGroups.map(minor => {
                              const minorKey = `expense-${item.name}-${minor.name}`;
                              const minorExpanded = expandedGroups.has(minorKey);
                              const minorTx = majorTx.filter(t => (t.minorCategory || t.itemName) === minor.name).sort((a, b) => (b.day || 0) - (a.day || 0));
                              return (
                                <div key={minor.name} className="border-b border-gray-50 last:border-0">
                                  {/* 中分類行 */}
                                  <button onClick={() => toggleGroup(minorKey)} className="w-full flex items-center pl-5 pr-2 py-1.5 gap-1.5 bg-white hover:bg-gray-50 transition-colors">
                                    <span className="text-[9px] shrink-0" style={{ color }}>●</span>
                                    <span className="text-xs text-gray-600 flex-1 truncate text-left">{minor.name}</span>
                                    <span className="text-xs text-gray-600 shrink-0">{fmt(minor.total)}</span>
                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className={`w-3 h-3 text-gray-300 shrink-0 transition-transform ${minorExpanded ? 'rotate-180' : ''}`}>
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                                    </svg>
                                  </button>
                                  {/* 明細行 */}
                                  {minorExpanded && (
                                    <div className="bg-gray-100 divide-y divide-gray-200">
                                      {minorTx.map(tx => (
                                        <div key={tx.id} className={`flex items-center pl-7 pr-2 py-1.5 gap-1 ${tx.excluded ? 'opacity-40' : ''}`}>
                                          <div className="flex-1 min-w-0">
                                            <p className={`text-xs text-gray-700 truncate ${tx.excluded ? 'line-through' : ''}`}>{tx.itemName}</p>
                                            <p className="text-[10px] text-gray-400">{selectedMonth}/{tx.day || '?'} · {fmt(tx.amount)}</p>
                                            <div className="flex gap-1 flex-wrap mt-0.5">
                                              {tx.expenseType && (
                                                <span className="text-[10px] px-1 py-0.5 rounded-full bg-blue-50 text-blue-600">{tx.expenseType}</span>
                                              )}
                                              {tx.member && (
                                                <span className="text-[10px] px-1 py-0.5 rounded-full bg-purple-50 text-purple-600">{tx.member}</span>
                                              )}
                                            </div>
                                          </div>
                                          <button onClick={() => updateTransaction({ ...tx, excluded: !tx.excluded })} className={`p-0.5 shrink-0 ${tx.excluded ? 'text-orange-400' : 'text-gray-300 hover:text-orange-400'}`} title={tx.excluded ? '集計に含める' : '集計から除外'}>
                                            {tx.excluded ? (
                                              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-3.5 h-3.5"><path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" /></svg>
                                            ) : (
                                              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-3.5 h-3.5"><path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" /></svg>
                                            )}
                                          </button>
                                          <button onClick={() => openReclassify(tx)} className="text-gray-300 hover:text-indigo-500 p-0.5 shrink-0" title="分類変更">
                                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-3.5 h-3.5"><path strokeLinecap="round" strokeLinejoin="round" d="M9.568 3H5.25A2.25 2.25 0 003 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 005.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 009.568 3z" /><path strokeLinecap="round" strokeLinejoin="round" d="M6 6h.008v.008H6V6z" /></svg>
                                          </button>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              ) : (
                <div className="flex items-center justify-center py-10 text-gray-300">
                  <p className="text-xs">データなし</p>
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
                  {(['income', 'expense', 'investment'] as TransactionType[]).map(t => (
                    <button key={t} onClick={() => { setForm(f => ({ ...f, type: t, subcategory: '' })); setMinorCategory(''); }}
                      className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${form.type === t ? (t === 'income' ? 'bg-blue-500 text-white border-blue-500' : t === 'expense' ? 'bg-red-500 text-white border-red-500' : 'bg-gray-600 text-white border-gray-600') : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'}`}>
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
                    // Auto-fill from category config
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
      {reclassify && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end md:items-center justify-center p-0 md:p-4">
          <div className="bg-white w-full md:max-w-md rounded-t-2xl md:rounded-2xl">
            <div className="flex items-center justify-between p-4 border-b border-gray-100">
              <h2 className="text-base font-semibold text-gray-800">分類を変更</h2>
              <button onClick={() => setReclassify(null)} className="text-gray-400 hover:text-gray-600">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div className="bg-gray-50 rounded-lg px-3 py-2 text-sm text-gray-600">
                <span className="font-medium">{reclassify.tx.itemName}</span>
                <span className="text-xs text-gray-400 ml-2">{fmt(reclassify.tx.amount)}</span>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">種別</label>
                <div className="flex gap-2">
                  {(['income', 'expense', 'investment'] as TransactionType[]).map(t => (
                    <button key={t} onClick={() => setReclassify(r => r ? { ...r, type: t, subcategory: '' } : r)}
                      className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${reclassify.type === t ? (t === 'income' ? 'bg-blue-500 text-white border-blue-500' : t === 'expense' ? 'bg-red-500 text-white border-red-500' : 'bg-gray-600 text-white border-gray-600') : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'}`}>
                      {typeLabel[t]}
                    </button>
                  ))}
                </div>
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
              <label className="flex items-center gap-3 cursor-pointer">
                <input type="checkbox" checked={applyToAll} onChange={e => setApplyToAll(e.target.checked)} className="rounded text-indigo-600 w-4 h-4" />
                <div>
                  <p className="text-sm font-medium text-gray-700">「{reclassify.tx.itemName}」を今後も同じ分類に</p>
                  <p className="text-xs text-gray-400">同じ店名の取引に一括適用し、次回取込時も自動分類します</p>
                </div>
              </label>
              <button onClick={handleReclassify} className="w-full bg-indigo-600 text-white py-3 rounded-xl font-medium hover:bg-indigo-700">
                変更を保存
              </button>
            </div>
          </div>
        </div>
      )}

      {showImport && <MoneyForwardImport onClose={() => setShowImport(false)} />}
      {showCategorySettings && <CategorySettings onClose={() => setShowCategorySettings(false)} />}
    </div>
  );
}
