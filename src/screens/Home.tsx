import { useMemo } from 'react';
import { useApp } from '../contexts/AppContext';

export default function Home() {
  const { currentProfile, transactions, budgets } = useApp();
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;

  // Generate last 12 months
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

  // Monthly stats
  const monthlyStats = useMemo(() => {
    return last12Months.map(({ year, month }) => {
      const monthTx = transactions.filter(t => t.year === year && t.month === month);
      const income = monthTx.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
      const expense = monthTx.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
      const rate = income > 0 ? Math.round(expense / income * 100) : 0;
      return { year, month, income, expense, rate, hasData: income > 0 || expense > 0 };
    });
  }, [last12Months, transactions]);

  // Average expense rate (only months with data)
  const avgRate = useMemo(() => {
    const withData = monthlyStats.filter(m => m.hasData && m.income > 0);
    if (withData.length === 0) return null;
    return Math.round(withData.reduce((s, m) => s + m.rate, 0) / withData.length);
  }, [monthlyStats]);

  // Annual budget
  const annualBudget = useMemo(() => {
    let income = 0, expense = 0;
    budgets.forEach(b => {
      if (currentYear >= b.startYear && currentYear <= b.endYear) {
        if (b.type === 'income') income += b.amount * 12;
        else if (b.type === 'expense') expense += b.amount * 12;
      }
    });
    return { income, expense, rate: income > 0 ? Math.round(expense / income * 100) : 0 };
  }, [budgets, currentYear]);

  if (!currentProfile) {
    return <div className="flex items-center justify-center h-64"><p className="text-gray-500">プロファイルを作成してください</p></div>;
  }

  return (
    <div className="p-4 max-w-2xl mx-auto space-y-4">
      {/* Header */}
      <div className="text-center py-2">
        <p className="text-sm text-gray-500">直近12か月の平均支出率</p>
        {avgRate === null ? (
          <p className="text-3xl font-bold text-gray-300 mt-1">データなし</p>
        ) : (
          <p className={`text-5xl font-bold mt-1 ${avgRate > 80 ? 'text-red-500' : 'text-blue-600'}`}>
            {avgRate}%
          </p>
        )}
        {avgRate !== null && avgRate > 80 && (
          <div className="mt-2 bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-700 flex items-center justify-center gap-2">
            ⚠️ 支出が収入の80%を超えています
          </div>
        )}
      </div>

      {/* Monthly breakdown */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-700">月別支出率</h2>
        </div>
        <div className="divide-y divide-gray-50">
          {monthlyStats.map(({ year, month, rate, hasData }) => (
            <div key={`${year}-${month}`} className="flex items-center px-4 py-2.5">
              <span className="text-sm text-gray-600 w-16 shrink-0">{year}年{month}月</span>
              <div className="flex-1 mx-3">
                {hasData ? (
                  <div className="w-full bg-gray-100 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full transition-all ${rate > 80 ? 'bg-red-400' : 'bg-emerald-400'}`}
                      style={{ width: `${Math.min(rate, 100)}%` }}
                    />
                  </div>
                ) : (
                  <div className="w-full bg-gray-100 rounded-full h-2" />
                )}
              </div>
              <span className={`text-sm font-bold w-12 text-right ${!hasData ? 'text-gray-300' : rate > 80 ? 'text-red-500' : 'text-blue-600'}`}>
                {hasData ? `${rate}%` : '-'}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Annual budget summary */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
        <h2 className="text-sm font-semibold text-gray-700 mb-3">{currentYear}年 年間予算</h2>
        {annualBudget.income === 0 && annualBudget.expense === 0 ? (
          <p className="text-sm text-gray-400 text-center py-2">予算が設定されていません</p>
        ) : (
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">収入予算</span>
              <span className="text-sm font-semibold text-blue-600">{annualBudget.income.toLocaleString()}円</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">支出予算</span>
              <span className="text-sm font-semibold text-red-500">{annualBudget.expense.toLocaleString()}円</span>
            </div>
            <div className="flex justify-between items-center pt-2 border-t border-gray-100">
              <span className="text-sm text-gray-600">予算支出率</span>
              <span className={`text-sm font-bold ${annualBudget.rate > 80 ? 'text-red-500' : 'text-gray-700'}`}>
                {annualBudget.income > 0 ? `${annualBudget.rate}%` : '-'}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
