import { useMemo, useState } from 'react';
import { useApp } from '../contexts/AppContext';
import { fmt } from '../lib/format';
import { getCategoryColor } from '../components/actual/CategorySection';

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

  // 大項目別月平均（支出）
  const avgByMajorCategory = useMemo(() => {
    const catMonthly: Record<string, number[]> = {};
    for (const { year, month } of last12Months) {
      const byCat: Record<string, number> = {};
      transactions
        .filter(t => t.year === year && t.month === month && t.type === 'expense' && !t.excluded)
        .forEach(t => {
          const cat = t.subcategory || 'その他';
          byCat[cat] = (byCat[cat] || 0) + t.amount;
        });
      for (const [cat, amt] of Object.entries(byCat)) {
        if (!catMonthly[cat]) catMonthly[cat] = [];
        catMonthly[cat].push(amt);
      }
    }
    return Object.entries(catMonthly)
      .map(([name, amounts]) => ({
        name,
        avg: Math.round(amounts.reduce((a, b) => a + b, 0) / amounts.length),
      }))
      .filter(c => c.avg > 0)
      .sort((a, b) => b.avg - a.avg);
  }, [last12Months, transactions]);

  const [showRateDetail, setShowRateDetail] = useState(false);

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

      {/* 月平均 */}
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
      </div>

      {/* 年間合計 */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
          <p className="text-[11px] text-gray-400 mb-1.5">{currentYear}年 収入合計</p>
          <p className="text-lg font-bold text-blue-600 tabular-nums">{fmt(annualIncome)}</p>
        </div>
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
          <p className="text-[11px] text-gray-400 mb-1.5">{currentYear}年 支出合計</p>
          <p className="text-lg font-bold text-red-500 tabular-nums">{fmt(annualExpense)}</p>
        </div>
      </div>

      {/* カテゴリ別月平均 */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-4 py-3.5 border-b border-gray-100">
          <p className="text-sm font-semibold text-gray-800">カテゴリ別 月平均支出</p>
          <p className="text-[11px] text-gray-400 mt-0.5">直近12か月の平均（除外済み除く）</p>
        </div>
        {avgByMajorCategory.length > 0 ? (
          <div className="divide-y divide-gray-50">
            {avgByMajorCategory.map((item, i) => (
              <div key={item.name} className="flex items-center px-4 py-3 gap-3">
                <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: getCategoryColor(item.name, i) }} />
                <span className="text-sm text-gray-700 flex-1">{item.name}</span>
                <span className="text-sm font-semibold text-red-500 tabular-nums">{fmt(item.avg)}</span>
              </div>
            ))}
            <div className="flex items-center px-4 py-3 gap-3 bg-gray-50">
              <div className="w-2.5 h-2.5 rounded-full shrink-0 bg-transparent" />
              <span className="text-sm font-semibold text-gray-600 flex-1">合計</span>
              <span className="text-sm font-bold text-red-600 tabular-nums">
                {fmt(avgByMajorCategory.reduce((s, c) => s + c.avg, 0))}
              </span>
            </div>
          </div>
        ) : (
          <div className="px-4 py-10 text-center">
            <p className="text-sm text-gray-400">支出データがありません</p>
            <p className="text-xs text-gray-300 mt-1">実績管理から取引を追加してください</p>
          </div>
        )}
      </div>

    </div>
  );
}
