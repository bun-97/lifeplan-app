import { useMemo, useState } from 'react';
import { useApp } from '../contexts/AppContext';
import { getEffectiveTag } from '../lib/categoryConfig';
import { fmt } from '../lib/format';
import { getCategoryColor } from '../components/actual/CategorySection';

const EXPENSE_TYPES = ['毎月固定', '毎月変動', '不定期固定', '不定期変動'] as const;
type ExpenseType = typeof EXPENSE_TYPES[number];

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
        .map(([name, amounts]) => ({ name, avg: Math.round(amounts.reduce((a, b) => a + b, 0) / amounts.length) }))
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
    return <div className="flex items-center justify-center h-64"><p className="text-gray-400 text-sm">プロファイルを作成してください</p></div>;
  }

  // 月別詳細画面
  if (showRateDetail) {
    return (
      <div className="w-full bg-gray-50 min-h-screen">
        <div className="bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-3">
          <button onClick={() => setShowRateDetail(false)} className="p-1.5 rounded-full hover:bg-gray-100 text-gray-500">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
          </button>
          <h2 className="text-sm font-semibold text-gray-800">月別支出率（過去12ヶ月）</h2>
        </div>
        <div className="bg-white mt-2">
          {monthlyRateDetail.map(({ year, month, expense, rate }, i) => {
            const over80 = rate !== null && rate >= 80;
            return (
              <div key={`${year}-${month}`} className={`flex items-center px-4 py-3.5 ${i > 0 ? 'border-t border-gray-100' : ''}`}>
                <span className="text-sm text-gray-600 flex-1">{year}年{month}月</span>
                <span className={`text-sm font-bold mr-4 tabular-nums ${over80 ? 'text-red-500' : 'text-gray-800'}`}>
                  {rate !== null ? `${rate}%` : '—'}
                </span>
                <span className="text-sm text-gray-500 tabular-nums w-24 text-right">{fmt(expense)}</span>
              </div>
            );
          })}
          {monthlyRateDetail.length === 0 && (
            <div className="px-4 py-12 text-center text-sm text-gray-400">データがありません</div>
          )}
        </div>
      </div>
    );
  }

  const totalExpenseAvg = EXPENSE_TYPES.reduce((s, et) => s + avgByTypeAndCategory[et].reduce((a, c) => a + c.avg, 0), 0);

  return (
    <div className="w-full bg-gray-50 min-h-screen">

      {/* 支出率バナー */}
      <button
        onClick={() => setShowRateDetail(true)}
        className="w-full bg-white border-b border-gray-200 px-4 py-5 flex items-center justify-between active:bg-gray-50"
      >
        <div className="text-left">
          <p className="text-xs text-gray-400 mb-0.5">過去12ヶ月 平均支出率</p>
          <div className="flex items-baseline gap-1">
            {avgRate === null ? (
              <span className="text-3xl font-bold text-gray-300">—</span>
            ) : (
              <>
                <span className={`text-3xl font-bold ${avgRate >= 80 ? 'text-red-500' : 'text-gray-800'}`}>{avgRate}</span>
                <span className={`text-base font-semibold ${avgRate >= 80 ? 'text-red-400' : 'text-gray-500'}`}>%</span>
              </>
            )}
          </div>
        </div>
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4 text-gray-300">
          <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
        </svg>
      </button>

      {/* 月平均・年間 */}
      <div className="bg-white mt-2 divide-y divide-gray-100">
        <div className="flex items-center px-4 py-3.5">
          <span className="text-sm text-gray-600 flex-1">月平均収入</span>
          <span className="text-sm font-semibold text-blue-600 tabular-nums">{fmt(avgIncome)}</span>
        </div>
        <div className="flex items-center px-4 py-3.5">
          <span className="text-sm text-gray-600 flex-1">月平均支出</span>
          <span className="text-sm font-semibold text-red-500 tabular-nums">{fmt(avgExpense)}</span>
        </div>
        <div className="flex items-center px-4 py-3.5">
          <span className="text-sm text-gray-600 flex-1">{currentYear}年 収入合計</span>
          <span className="text-sm font-semibold text-blue-600 tabular-nums">{fmt(annualIncome)}</span>
        </div>
        <div className="flex items-center px-4 py-3.5">
          <span className="text-sm text-gray-600 flex-1">{currentYear}年 支出合計</span>
          <span className="text-sm font-semibold text-red-500 tabular-nums">{fmt(annualExpense)}</span>
        </div>
      </div>

      {/* カテゴリ別月平均 */}
      <p className="text-xs text-gray-400 px-4 pt-5 pb-2">カテゴリ別 月平均支出（直近12か月）</p>

      {EXPENSE_TYPES.map(et => {
        const cats = avgByTypeAndCategory[et];
        const subtotal = cats.reduce((s, c) => s + c.avg, 0);
        const isExpanded = expandedTypes.has(et);
        return (
          <div key={et} className="bg-white mt-px">
            <button
              onClick={() => toggleType(et)}
              className="w-full flex items-center px-4 py-3.5 border-b border-gray-100 active:bg-gray-50"
            >
              <span className="text-sm font-medium text-gray-700 flex-1 text-left">{et}</span>
              <span className={`text-sm font-semibold tabular-nums mr-2 ${subtotal > 0 ? 'text-red-500' : 'text-gray-300'}`}>
                {subtotal > 0 ? fmt(subtotal) : '—'}
              </span>
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"
                className={`w-3.5 h-3.5 text-gray-300 transition-transform shrink-0 ${isExpanded ? 'rotate-180' : ''}`}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
              </svg>
            </button>
            {isExpanded && cats.length > 0 && (
              <div className="divide-y divide-gray-50">
                {cats.map((item, i) => (
                  <div key={item.name} className="flex items-center pl-8 pr-4 py-3 gap-3">
                    <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: getCategoryColor(item.name, i) }} />
                    <span className="text-sm text-gray-600 flex-1">{item.name}</span>
                    <span className="text-sm text-red-400 tabular-nums">{fmt(item.avg)}</span>
                  </div>
                ))}
              </div>
            )}
            {isExpanded && cats.length === 0 && (
              <div className="pl-8 pr-4 py-3">
                <span className="text-xs text-gray-300">データなし</span>
              </div>
            )}
          </div>
        );
      })}

      {/* 合計行 */}
      {totalExpenseAvg > 0 && (
        <div className="bg-white mt-px flex items-center px-4 py-4 border-t border-gray-200">
          <span className="text-sm font-semibold text-gray-700 flex-1">支出合計（月平均）</span>
          <span className="text-sm font-bold text-red-500 tabular-nums">{fmt(totalExpenseAvg)}</span>
        </div>
      )}

      <div className="h-8" />
    </div>
  );
}
