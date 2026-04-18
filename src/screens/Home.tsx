import { useMemo, useState } from 'react';
import { useApp } from '../contexts/AppContext';
import { getEffectiveTag } from '../lib/categoryConfig';
import { fmt } from '../lib/format';
import { getCategoryColor } from '../components/actual/CategorySection';

const EXPENSE_TYPES = ['毎月固定', '毎月変動', '不定期固定', '不定期変動'] as const;
type ExpenseType = typeof EXPENSE_TYPES[number];

const EXPENSE_TYPE_COLOR: Record<ExpenseType, { bg: string; text: string; badge: string }> = {
  '毎月固定':   { bg: 'bg-blue-50',   text: 'text-blue-700',   badge: 'bg-blue-100 text-blue-600' },
  '毎月変動':   { bg: 'bg-green-50',  text: 'text-green-700',  badge: 'bg-green-100 text-green-600' },
  '不定期固定': { bg: 'bg-orange-50', text: 'text-orange-700', badge: 'bg-orange-100 text-orange-600' },
  '不定期変動': { bg: 'bg-purple-50', text: 'text-purple-700', badge: 'bg-purple-100 text-purple-600' },
};

export default function Home() {
  const { currentProfile, transactions } = useApp();
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;

  const last12Months = useMemo(() => {
    const months = [];
    for (let i = 11; i >= 0; i--) {
      let month = currentMonth - i;
      let year = currentYear;
      while (month <= 0) { month += 12; year--; }
      months.push({ year, month });
    }
    return months;
  }, [currentYear, currentMonth]);

  const monthlyStats = useMemo(() => {
    return last12Months.map(({ year, month }) => {
      const monthTx = transactions.filter(t => t.year === year && t.month === month && !t.excluded);
      const income = monthTx.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
      const expense = monthTx.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
      const rate = income > 0 ? Math.round(expense / income * 100) : 0;
      return { income, expense, rate, hasData: income > 0 || expense > 0 };
    });
  }, [last12Months, transactions]);

  const monthsWithData = monthlyStats.filter(m => m.hasData);
  const monthsWithRate = monthlyStats.filter(m => m.income > 0);

  const avgIncome = monthsWithData.length > 0
    ? Math.round(monthsWithData.reduce((s, m) => s + m.income, 0) / monthsWithData.length) : 0;
  const avgExpense = monthsWithData.length > 0
    ? Math.round(monthsWithData.reduce((s, m) => s + m.expense, 0) / monthsWithData.length) : 0;
  const avgRate = monthsWithRate.length > 0
    ? Math.round(monthsWithRate.reduce((s, m) => s + m.rate, 0) / monthsWithRate.length) : null;

  const thisYearTx = useMemo(() => transactions.filter(t => t.year === currentYear), [transactions, currentYear]);
  const annualIncome = thisYearTx.filter(t => t.type === 'income' && !t.excluded).reduce((s, t) => s + t.amount, 0);
  const annualExpense = thisYearTx.filter(t => t.type === 'expense' && !t.excluded).reduce((s, t) => s + t.amount, 0);

  // 支出分類×大項目の月平均
  const avgByTypeAndCategory = useMemo(() => {
    const catTypeMonthly: Record<string, Record<string, number[]>> = {};

    for (const { year, month } of last12Months) {
      const monthBucket: Record<string, number> = {};
      transactions
        .filter(t => t.year === year && t.month === month && t.type === 'expense' && !t.excluded)
        .forEach(t => {
          const et = t.expenseType || getEffectiveTag('expense', t.subcategory, t.minorCategory).expenseType;
          if (!et) return;
          const key = `${et}::${t.subcategory || 'その他'}`;
          monthBucket[key] = (monthBucket[key] || 0) + t.amount;
        });

      for (const [key, amount] of Object.entries(monthBucket)) {
        const [et, cat] = key.split('::');
        if (!catTypeMonthly[et]) catTypeMonthly[et] = {};
        if (!catTypeMonthly[et][cat]) catTypeMonthly[et][cat] = [];
        catTypeMonthly[et][cat].push(amount);
      }
    }

    const result: Record<ExpenseType, { name: string; avg: number }[]> = {
      '毎月固定': [], '毎月変動': [], '不定期固定': [], '不定期変動': [],
    };
    for (const et of EXPENSE_TYPES) {
      const cats = catTypeMonthly[et];
      if (!cats) continue;
      result[et] = Object.entries(cats)
        .map(([name, amounts]) => ({
          name,
          avg: Math.round(amounts.reduce((a, b) => a + b, 0) / amounts.length),
        }))
        .filter(c => c.avg > 0)
        .sort((a, b) => b.avg - a.avg);
    }
    return result;
  }, [last12Months, transactions]);

  const [showRateDetail, setShowRateDetail] = useState(false);
  const [expandedTypes, setExpandedTypes] = useState<Set<ExpenseType>>(new Set(EXPENSE_TYPES));

  const toggleType = (et: ExpenseType) => {
    setExpandedTypes(prev => {
      const next = new Set(prev);
      if (next.has(et)) next.delete(et); else next.add(et);
      return next;
    });
  };

  const monthlyRateDetail = useMemo(() => {
    return last12Months.map(({ year, month }) => {
      const monthTx = transactions.filter(t => t.year === year && t.month === month && !t.excluded);
      const income = monthTx.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
      const expense = monthTx.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
      const rate = income > 0 ? Math.round(expense / income * 100) : null;
      return { year, month, income, expense, rate, hasData: income > 0 || expense > 0 };
    }).filter(m => m.hasData).reverse();
  }, [last12Months, transactions]);

  if (!currentProfile) {
    return <div className="flex items-center justify-center h-64"><p className="text-gray-500">プロファイルを作成してください</p></div>;
  }

  if (showRateDetail) {
    return (
      <div className="w-full p-4 space-y-4">
        <div className="flex items-center gap-3">
          <button onClick={() => setShowRateDetail(false)} className="p-2 rounded-lg hover:bg-gray-100 text-gray-600">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
          </button>
          <h2 className="text-base font-semibold text-gray-800">月別支出率（過去12ヶ月）</h2>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="text-left text-xs text-gray-500 font-medium px-4 py-2.5">月</th>
                <th className="text-right text-xs text-gray-500 font-medium px-4 py-2.5">支出率</th>
                <th className="text-right text-xs text-gray-500 font-medium px-4 py-2.5">支出額</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {monthlyRateDetail.map(({ year, month, expense, rate }) => {
                const over80 = rate !== null && rate >= 80;
                return (
                  <tr key={`${year}-${month}`} className={over80 ? 'bg-red-50' : ''}>
                    <td className="px-4 py-3 text-sm text-gray-700">{year}年{month}月</td>
                    <td className={`px-4 py-3 text-sm font-bold text-right ${over80 ? 'text-red-500' : 'text-gray-800'}`}>
                      {rate !== null ? `${rate}%` : '—'}
                    </td>
                    <td className={`px-4 py-3 text-sm font-semibold text-right ${over80 ? 'text-red-400' : 'text-gray-600'}`}>
                      {fmt(expense)}
                    </td>
                  </tr>
                );
              })}
              {monthlyRateDetail.length === 0 && (
                <tr><td colSpan={3} className="px-4 py-8 text-center text-sm text-gray-400">データがありません</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full p-4 space-y-3">

      {/* 平均支出率 */}
      <button
        onClick={() => setShowRateDetail(true)}
        className="w-full bg-white rounded-2xl shadow-sm border border-gray-100 px-6 py-8 text-center active:bg-gray-50 transition-colors"
      >
        <p className="text-xs text-gray-400 mb-3 tracking-wide">過去12ヶ月 平均支出率</p>
        {avgRate === null ? (
          <p className="text-4xl font-bold text-gray-300">—</p>
        ) : (
          <div className="flex items-end justify-center gap-1">
            <span className={`text-6xl font-bold leading-none ${avgRate >= 80 ? 'text-red-500' : 'text-gray-800'}`}>{avgRate}</span>
            <span className={`text-2xl font-semibold mb-1 ${avgRate >= 80 ? 'text-red-400' : 'text-gray-500'}`}>%</span>
          </div>
        )}
        <p className="text-[11px] text-gray-300 mt-3">タップで月別明細 →</p>
      </button>

      {/* 月平均・年間合計 */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
          <p className="text-[11px] text-gray-400 mb-1.5">月平均収入</p>
          <p className="text-lg font-bold text-blue-600 tabular-nums">{fmt(avgIncome)}</p>
          <p className="text-[10px] text-gray-300 mt-0.5">直近12か月</p>
        </div>
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
          <p className="text-[11px] text-gray-400 mb-1.5">月平均支出</p>
          <p className="text-lg font-bold text-red-500 tabular-nums">{fmt(avgExpense)}</p>
          <p className="text-[10px] text-gray-300 mt-0.5">直近12か月</p>
        </div>
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
          <p className="text-[11px] text-gray-400 mb-1.5">{currentYear}年 収入合計</p>
          <p className="text-lg font-bold text-blue-600 tabular-nums">{fmt(annualIncome)}</p>
        </div>
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
          <p className="text-[11px] text-gray-400 mb-1.5">{currentYear}年 支出合計</p>
          <p className="text-lg font-bold text-red-500 tabular-nums">{fmt(annualExpense)}</p>
        </div>
      </div>

      {/* 支出分類×大項目 月平均 */}
      <div className="space-y-2">
        <p className="text-xs font-semibold text-gray-500 px-1">カテゴリ別 月平均支出（直近12か月）</p>
        {EXPENSE_TYPES.map(et => {
          const cats = avgByTypeAndCategory[et];
          const subtotal = cats.reduce((s, c) => s + c.avg, 0);
          const color = EXPENSE_TYPE_COLOR[et];
          const isExpanded = expandedTypes.has(et);
          return (
            <div key={et} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <button
                onClick={() => toggleType(et)}
                className={`w-full flex items-center justify-between px-4 py-3 ${color.bg} transition-colors`}
              >
                <div className="flex items-center gap-2">
                  <span className={`text-sm font-semibold ${color.text}`}>{et}</span>
                  {cats.length > 0 && (
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${color.badge}`}>
                      {cats.length}項目
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-sm font-bold tabular-nums ${subtotal > 0 ? 'text-red-500' : 'text-gray-300'}`}>
                    {subtotal > 0 ? fmt(subtotal) : '—'}
                  </span>
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"
                    className={`w-3.5 h-3.5 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                  </svg>
                </div>
              </button>
              {isExpanded && (
                cats.length > 0 ? (
                  <div className="divide-y divide-gray-50">
                    {cats.map((item, i) => (
                      <div key={item.name} className="flex items-center px-4 py-2.5 gap-3">
                        <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: getCategoryColor(item.name, i) }} />
                        <span className="text-sm text-gray-700 flex-1">{item.name}</span>
                        <span className="text-sm font-medium text-red-500 tabular-nums">{fmt(item.avg)}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="px-4 py-4 text-center">
                    <p className="text-xs text-gray-300">データなし</p>
                  </div>
                )
              )}
            </div>
          );
        })}
      </div>

    </div>
  );
}
