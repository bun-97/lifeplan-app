import { useMemo } from 'react';
import { useApp } from '../contexts/AppContext';

function fmt(n: number): string {
  if (n >= 10000) return (n / 10000).toFixed(1).replace(/\.0$/, '') + '万円';
  return n.toLocaleString('ja-JP') + '円';
}

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
      const monthTx = transactions.filter(t => t.year === year && t.month === month);
      const income = monthTx.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
      const expense = monthTx.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
      const rate = income > 0 ? Math.round(expense / income * 100) : 0;
      return { income, expense, rate, hasData: income > 0 || expense > 0 };
    });
  }, [last12Months, transactions]);

  const monthsWithData = monthlyStats.filter(m => m.hasData);
  const monthsWithRate = monthlyStats.filter(m => m.income > 0);

  const avgIncome = monthsWithData.length > 0
    ? Math.round(monthsWithData.reduce((s, m) => s + m.income, 0) / monthsWithData.length)
    : 0;
  const avgExpense = monthsWithData.length > 0
    ? Math.round(monthsWithData.reduce((s, m) => s + m.expense, 0) / monthsWithData.length)
    : 0;
  const avgRate = monthsWithRate.length > 0
    ? Math.round(monthsWithRate.reduce((s, m) => s + m.rate, 0) / monthsWithRate.length)
    : null;

  const thisYearTx = useMemo(() => transactions.filter(t => t.year === currentYear), [transactions, currentYear]);
  const annualIncome = thisYearTx.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const annualExpense = thisYearTx.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);

  if (!currentProfile) {
    return <div className="flex items-center justify-center h-64"><p className="text-gray-500">プロファイルを作成してください</p></div>;
  }

  return (
    <div className="w-full p-4 space-y-4">

      {/* ===== AVERAGE RATE: top large display ===== */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 text-center">
        <p className="text-xs text-gray-400 mb-2">直近12か月 平均支出率</p>
        {avgRate === null ? (
          <p className="text-4xl font-bold text-gray-300">データなし</p>
        ) : (
          <div className={`flex items-end justify-center gap-1 ${avgRate >= 80 ? 'text-red-500' : 'text-gray-800'}`}>
            <span className="text-6xl font-bold leading-none">{avgRate}</span>
            <span className="text-3xl font-semibold leading-none mb-1">%</span>
          </div>
        )}
        <p className="text-xs text-gray-400 mt-2">
          {monthsWithData.length > 0 ? `${monthsWithData.length}か月分のデータ` : 'まだデータがありません'}
        </p>
      </div>

      {/* ===== STAT CARDS ===== */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <p className="text-xs text-gray-400 mb-1">直近12か月 平均月収入</p>
          <p className="text-xl font-bold text-blue-600">{fmt(avgIncome)}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <p className="text-xs text-gray-400 mb-1">直近12か月 平均月支出</p>
          <p className="text-xl font-bold text-red-500">{fmt(avgExpense)}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <p className="text-xs text-gray-400 mb-1">{currentYear}年 年間収入合計</p>
          <p className="text-xl font-bold text-blue-600">{fmt(annualIncome)}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <p className="text-xs text-gray-400 mb-1">{currentYear}年 年間支出合計</p>
          <p className="text-xl font-bold text-red-500">{fmt(annualExpense)}</p>
        </div>
      </div>

    </div>
  );
}
