import { useState, useMemo } from 'react';
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { useApp } from '../contexts/AppContext';
import { Transaction, TransactionType } from '../types';
import MoneyForwardImport from '../components/MoneyForwardImport';

const EXPENSE_CATEGORIES = ['毎月固定費', '毎月変動費', '不定期固定費', '不定期変動費'];
const INCOME_CATEGORIES = ['予算内', '予算外'];
const INVESTMENT_CATEGORIES = ['積立投資', '定期預金', 'その他'];

// マネーフォワードMEに合わせた中項目カラーマッピング
const MF_CATEGORY_COLORS: Record<string, string> = {
  // 食費
  '食費': '#E94B3C', '外食': '#E94B3C', '食料品': '#E94B3C',
  // 日用品
  '日用品': '#8BC34A', 'スキンケア用品': '#8BC34A', '雑費': '#8BC34A',
  // 交際費・娯楽
  '交際費': '#42A5F5', '娯楽費': '#5C6BC0', '家族交際費': '#42A5F5',
  // 住宅
  'サブスク': '#26A65B', '通信費': '#00ACC1', 'ローン返済': '#26A65B',
  '税金': '#78909C', '光熱費': '#00897B',
  // 自動車
  'ガソリン': '#546E7A', '自動車保険': '#546E7A', '駐車場': '#607D8B',
  // 投資
  '株式投資': '#37474F', '積立投資': '#37474F', '定期預金': '#455A64',
  // 収入
  '給与': '#1E88E5', '利子所得': '#29B6F6', '共有NISA積立分': '#0288D1',
  // その他
  '事業投資': '#8D6E63', 'その他': '#90A4AE',
};

const CHART_COLORS = [
  '#E94B3C', '#26A65B', '#42A5F5', '#546E7A', '#8BC34A',
  '#5C6BC0', '#00ACC1', '#78909C', '#37474F', '#FF7043'
];

function getCategoryColor(subcategory: string, index: number): string {
  return MF_CATEGORY_COLORS[subcategory] ?? CHART_COLORS[index % CHART_COLORS.length];
}

function formatAmount(n: number): string {
  return n.toLocaleString('ja-JP') + '円';
}

interface FormState {
  type: TransactionType;
  category: string;
  subcategory: string;
  itemName: string;
  amount: string;
  note: string;
}

const defaultForm: FormState = {
  type: 'expense',
  category: '毎月固定費',
  subcategory: '',
  itemName: '',
  amount: '',
  note: ''
};

function getCategoriesForType(type: TransactionType): string[] {
  if (type === 'income') return INCOME_CATEGORIES;
  if (type === 'expense') return EXPENSE_CATEGORIES;
  return INVESTMENT_CATEGORIES;
}

export default function ActualResults() {
  const { currentProfile, transactions, addTransaction, deleteTransaction } = useApp();
  const now = new Date();
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1);
  const [showModal, setShowModal] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [form, setForm] = useState<FormState>(defaultForm);
  const [editingId, setEditingId] = useState<string | null>(null);

  const { updateTransaction } = useApp();

  const monthlyTx = useMemo(
    () => transactions.filter(t => t.year === selectedYear && t.month === selectedMonth),
    [transactions, selectedYear, selectedMonth]
  );

  const totalIncome = useMemo(
    () => monthlyTx.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0),
    [monthlyTx]
  );
  const totalExpense = useMemo(
    () => monthlyTx.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0),
    [monthlyTx]
  );
  const totalInvestment = useMemo(
    () => monthlyTx.filter(t => t.type === 'investment').reduce((s, t) => s + t.amount, 0),
    [monthlyTx]
  );
  const balance = totalIncome - totalExpense - totalInvestment;

  // Annual data for summary
  const annualTx = useMemo(
    () => transactions.filter(t => t.year === selectedYear),
    [transactions, selectedYear]
  );
  const annualIncome = annualTx.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const annualExpense = annualTx.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);

  // Monthly averages (only months that have data)
  const monthsWithData = useMemo(() => {
    const months = new Set(annualTx.map(t => t.month));
    return months.size || 1;
  }, [annualTx]);

  const avgMonthlyIncome = Math.round(annualIncome / monthsWithData);
  const avgMonthlyExpense = Math.round(annualExpense / monthsWithData);

  // Pie chart data
  const pieData = useMemo(() => {
    const map: Record<string, number> = {};
    monthlyTx.filter(t => t.type === 'expense').forEach(t => {
      const key = t.subcategory || t.category;
      map[key] = (map[key] || 0) + t.amount;
    });
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  }, [monthlyTx]);

  function prevMonth() {
    if (selectedMonth === 1) {
      setSelectedMonth(12);
      setSelectedYear(y => y - 1);
    } else {
      setSelectedMonth(m => m - 1);
    }
  }

  function nextMonth() {
    if (selectedMonth === 12) {
      setSelectedMonth(1);
      setSelectedYear(y => y + 1);
    } else {
      setSelectedMonth(m => m + 1);
    }
  }

  function handleTypeChange(type: TransactionType) {
    const cats = getCategoriesForType(type);
    setForm(f => ({ ...f, type, category: cats[0] }));
  }

  function openAdd() {
    setForm(defaultForm);
    setEditingId(null);
    setShowModal(true);
  }

  function openEdit(tx: Transaction) {
    setForm({
      type: tx.type,
      category: tx.category,
      subcategory: tx.subcategory,
      itemName: tx.itemName,
      amount: String(tx.amount),
      note: tx.note || ''
    });
    setEditingId(tx.id);
    setShowModal(true);
  }

  function handleSubmit() {
    if (!form.subcategory.trim() || !form.itemName.trim() || !form.amount) return;
    const amount = Number(form.amount);
    if (isNaN(amount) || amount <= 0) return;

    if (editingId) {
      const existing = transactions.find(t => t.id === editingId);
      if (existing) {
        updateTransaction({
          ...existing,
          type: form.type,
          category: form.category,
          subcategory: form.subcategory,
          itemName: form.itemName,
          amount,
          note: form.note || undefined
        });
      }
    } else {
      if (!currentProfile) return;
      addTransaction({
        profileId: currentProfile.id,
        year: selectedYear,
        month: selectedMonth,
        type: form.type,
        category: form.category,
        subcategory: form.subcategory,
        itemName: form.itemName,
        amount,
        note: form.note || undefined
      });
    }
    setShowModal(false);
    setForm(defaultForm);
    setEditingId(null);
  }

  if (!currentProfile) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-500">プロファイルを作成してください</p>
      </div>
    );
  }

  const typeLabel: Record<TransactionType, string> = {
    income: '収入',
    expense: '支出',
    investment: '投資・貯蓄'
  };

  const typeColor: Record<TransactionType, string> = {
    income: 'text-emerald-600',
    expense: 'text-red-500',
    investment: 'text-blue-500'
  };

  const typeBg: Record<TransactionType, string> = {
    income: 'bg-emerald-50 border-emerald-200',
    expense: 'bg-red-50 border-red-200',
    investment: 'bg-blue-50 border-blue-200'
  };

  const grouped: Record<string, Transaction[]> = {};
  (['income', 'expense', 'investment'] as TransactionType[]).forEach(type => {
    const items = monthlyTx.filter(t => t.type === type);
    if (items.length > 0) grouped[type] = items;
  });

  return (
    <div className="p-4 max-w-2xl mx-auto space-y-4">
      {/* Month navigation */}
      <div className="flex items-center justify-between bg-white rounded-xl p-3 shadow-sm border border-gray-100">
        <button onClick={prevMonth} className="p-2 rounded-lg hover:bg-gray-100 text-gray-600">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
        </button>
        <span className="text-base font-semibold text-gray-800">
          {selectedYear}年 {selectedMonth}月
        </span>
        <button onClick={nextMonth} className="p-2 rounded-lg hover:bg-gray-100 text-gray-600">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
          </svg>
        </button>
      </div>

      {/* Alert */}
      {totalIncome > 0 && totalExpense / totalIncome > 0.8 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-3 flex items-center gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 text-red-500 shrink-0">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
          </svg>
          <p className="text-sm text-red-700">支出が収入の{Math.round(totalExpense / totalIncome * 100)}%に達しています。予算を見直しましょう。</p>
        </div>
      )}

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <p className="text-xs text-gray-500 mb-1">収入合計</p>
          <p className="text-lg font-bold text-emerald-600">{formatAmount(totalIncome)}</p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <p className="text-xs text-gray-500 mb-1">支出合計</p>
          <p className="text-lg font-bold text-red-500">{formatAmount(totalExpense)}</p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <p className="text-xs text-gray-500 mb-1">投資・貯蓄</p>
          <p className="text-lg font-bold text-blue-500">{formatAmount(totalInvestment)}</p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <p className="text-xs text-gray-500 mb-1">収支バランス</p>
          <p className={`text-lg font-bold ${balance >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
            {balance >= 0 ? '+' : ''}{formatAmount(balance)}
          </p>
        </div>
      </div>

      {/* Add / Import buttons */}
      <div className="flex gap-2">
        <button
          onClick={openAdd}
          className="flex-1 bg-indigo-600 text-white py-3 rounded-xl font-medium hover:bg-indigo-700 transition-colors flex items-center justify-center gap-2"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          取引を追加
        </button>
        <button
          onClick={() => setShowImport(true)}
          className="flex-1 bg-white border border-indigo-300 text-indigo-600 py-3 rounded-xl font-medium hover:bg-indigo-50 transition-colors flex items-center justify-center gap-2"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
          </svg>
          MF取込
        </button>
      </div>

      {/* Transaction list */}
      {Object.entries(grouped).map(([type, items]) => (
        <div key={type} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className={`px-4 py-2.5 border-b ${typeBg[type as TransactionType]}`}>
            <span className={`text-sm font-semibold ${typeColor[type as TransactionType]}`}>
              {typeLabel[type as TransactionType]}
            </span>
            <span className={`ml-2 text-sm font-bold ${typeColor[type as TransactionType]}`}>
              {formatAmount(items.reduce((s, t) => s + t.amount, 0))}
            </span>
          </div>
          {items.map(tx => (
            <div key={tx.id} className="flex items-center px-4 py-3 border-b border-gray-50 last:border-0 hover:bg-gray-50">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full shrink-0">{tx.category}</span>
                  <span className="text-xs text-gray-500 truncate">{tx.subcategory}</span>
                </div>
                <p className="text-sm font-medium text-gray-800 mt-0.5">{tx.itemName}</p>
                {tx.note && <p className="text-xs text-gray-400 mt-0.5">{tx.note}</p>}
              </div>
              <div className="flex items-center gap-2 ml-2">
                <span className={`text-sm font-semibold ${typeColor[type as TransactionType]}`}>
                  {formatAmount(tx.amount)}
                </span>
                <button
                  onClick={() => openEdit(tx)}
                  className="text-gray-400 hover:text-indigo-500 p-1"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
                  </svg>
                </button>
                <button
                  onClick={() => deleteTransaction(tx.id)}
                  className="text-gray-400 hover:text-red-500 p-1"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                  </svg>
                </button>
              </div>
            </div>
          ))}
        </div>
      ))}

      {monthlyTx.length === 0 && (
        <div className="bg-white rounded-xl p-8 text-center shadow-sm border border-gray-100">
          <p className="text-gray-400 text-sm">この月の取引はありません</p>
          <p className="text-gray-400 text-xs mt-1">「取引を追加」ボタンから記録しましょう</p>
        </div>
      )}

      {/* Pie chart */}
      {pieData.length > 0 && (
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">支出内訳</h3>
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie
                data={pieData}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius={80}
                label={({ name, percent }) => `${name} ${Math.round((percent || 0) * 100)}%`}
                labelLine={false}
              >
                {pieData.map((entry, index) => (
                  <Cell key={index} fill={getCategoryColor(entry.name, index)} />
                ))}
              </Pie>
              <Tooltip formatter={(value: number) => formatAmount(value)} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Annual summary */}
      <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">{selectedYear}年 年間サマリー</h3>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className="text-xs text-gray-500">月平均収入</p>
            <p className="text-sm font-semibold text-emerald-600">{formatAmount(avgMonthlyIncome)}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">月平均支出</p>
            <p className="text-sm font-semibold text-red-500">{formatAmount(avgMonthlyExpense)}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">年間収入合計</p>
            <p className="text-sm font-semibold text-emerald-600">{formatAmount(annualIncome)}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">年間支出合計</p>
            <p className="text-sm font-semibold text-red-500">{formatAmount(annualExpense)}</p>
          </div>
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end md:items-center justify-center p-0 md:p-4">
          <div className="bg-white w-full md:max-w-md rounded-t-2xl md:rounded-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b border-gray-100">
              <h2 className="text-base font-semibold text-gray-800">
                {editingId ? '取引を編集' : '取引を追加'}
              </h2>
              <button onClick={() => { setShowModal(false); setEditingId(null); }} className="text-gray-400 hover:text-gray-600">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-4 space-y-4">
              {/* Type selector */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">種別</label>
                <div className="flex gap-2">
                  {(['income', 'expense', 'investment'] as TransactionType[]).map(t => (
                    <button
                      key={t}
                      onClick={() => handleTypeChange(t)}
                      className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${
                        form.type === t
                          ? t === 'income' ? 'bg-emerald-500 text-white border-emerald-500'
                            : t === 'expense' ? 'bg-red-500 text-white border-red-500'
                            : 'bg-blue-500 text-white border-blue-500'
                          : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      {typeLabel[t]}
                    </button>
                  ))}
                </div>
              </div>

              {/* Category */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">カテゴリ</label>
                <select
                  value={form.category}
                  onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  {getCategoriesForType(form.type).map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              {/* Subcategory */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">サブカテゴリ（例：食費、家賃）</label>
                <input
                  type="text"
                  value={form.subcategory}
                  onChange={e => setForm(f => ({ ...f, subcategory: e.target.value }))}
                  placeholder="食費、家賃、交通費など"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* Item name */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">品目名</label>
                <input
                  type="text"
                  value={form.itemName}
                  onChange={e => setForm(f => ({ ...f, itemName: e.target.value }))}
                  placeholder="スーパー、家賃支払いなど"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* Amount */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">金額（円）</label>
                <input
                  type="number"
                  value={form.amount}
                  onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                  placeholder="0"
                  min="0"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* Note */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">メモ（任意）</label>
                <input
                  type="text"
                  value={form.note}
                  onChange={e => setForm(f => ({ ...f, note: e.target.value }))}
                  placeholder="備考など"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <button
                onClick={handleSubmit}
                disabled={!form.subcategory.trim() || !form.itemName.trim() || !form.amount}
                className="w-full bg-indigo-600 text-white py-3 rounded-xl font-medium hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {editingId ? '更新する' : '追加する'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MoneyForward Import Modal */}
      {showImport && (
        <MoneyForwardImport onClose={() => setShowImport(false)} />
      )}
    </div>
  );
}
