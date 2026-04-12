import { useMemo } from 'react';
import { useApp } from '../contexts/AppContext';

function fmt(n: number): string {
  if (n >= 10000) return (n / 10000).toFixed(1).replace(/\.0$/, '') + '万円';
  return n.toLocaleString('ja-JP') + '円';
}

const EXPENSE_TYPES = ['毎月固定', '毎月変動', '不定期固定', '不定期変動'] as const;

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

  // Monthly expense summary based on expenseType tag
  const avgByExpenseType = useMemo(() => {
    const result: Record<string, number> = {};
    for (const et of EXPENSE_TYPES) {
      const monthAmounts = last12Months.map(({ year, month }) => {
        const monthTx = transactions.filter(t =>
          t.year === year && t.month === month &&
          t.type === 'expense' && t.expenseType === et
        );
        return monthTx.reduce((s, t) => s + t.amount, 0);
      }).filter(amt => amt > 0);

      result[et] = monthAmounts.length > 0
        ? Math.round(monthAmounts.reduce((a, b) => a + b, 0) / monthAmounts.length)
        : 0;
    }
    return result;
  }, [last12Months, transactions]);

  // Budget income breakdown (予算内/予算外)
  const avgBudgetIncome = useMemo(() => {
    const budgetNai = last12Months.map(({ year, month }) =>
      transactions.filter(t => t.year === year && t.month === month && t.type === 'income' && t.budgetType === '予算内')
        .reduce((s, t) => s + t.amount, 0)
    ).filter(a => a > 0);
    const budgetGai = last12Months.map(({ year, month }) =>
      transactions.filter(t => t.year === year && t.month === month && t.type === 'income' && t.budgetType === '予算外')
        .reduce((s, t) => s + t.amount, 0)
    ).filter(a => a > 0);

    return {
      予算内: budgetNai.length > 0 ? Math.round(budgetNai.reduce((a, b) => a + b, 0) / budgetNai.length) : 0,
      予算外: budgetGai.length > 0 ? Math.round(budgetGai.reduce((a, b) => a + b, 0) / budgetGai.length) : 0,
    };
  }, [last12Months, transactions]);

  // Current month totals for summary bar
  const currentMonthTx = useMemo(
    () => transactions.filter(t => t.year === currentYear && t.month === currentMonth),
    [transactions, currentYear, currentMonth]
  );
  const currentIncome = currentMonthTx.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const currentExpense = currentMonthTx.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
  const currentInvestment = currentMonthTx.filter(t => t.type === 'investment').reduce((s, t) => s + t.amount, 0);
  const currentExpenseRate = currentIncome > 0 ? Math.round(currentExpense / currentIncome * 100) : 0;

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

      {/* ===== 月間支出サマリー ===== */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100">
          <p className="text-sm font-semibold text-gray-800">月間支出サマリー</p>
          <p className="text-xs text-gray-400 mt-0.5">直近12か月の月平均（支出分類タグ基準）</p>
        </div>
        <table className="w-full">
          <thead>
            <tr className="bg-gray-50">
              <th className="text-left text-xs text-gray-500 font-medium px-4 py-2">カテゴリ</th>
              <th className="text-right text-xs text-gray-500 font-medium px-4 py-2">月平均</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {EXPENSE_TYPES.map(et => (
              <tr key={et}>
                <td className="px-4 py-3 text-sm text-gray-700">{et}費</td>
                <td className="px-4 py-3 text-sm font-semibold text-red-500 text-right">{fmt(avgByExpenseType[et] ?? 0)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {/* Budget income breakdown */}
        {(avgBudgetIncome['予算内'] > 0 || avgBudgetIncome['予算外'] > 0) && (
          <div className="px-4 py-3 border-t border-gray-100 space-y-1.5">
            <p className="text-xs font-medium text-gray-500 mb-2">収入内訳（予算区分）月平均</p>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">予算内（給与・定期収入）</span>
              <span className="font-semibold text-green-600">{fmt(avgBudgetIncome['予算内'])}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">予算外（ボーナス・臨時収入）</span>
              <span className="font-semibold text-orange-500">{fmt(avgBudgetIncome['予算外'])}</span>
            </div>
          </div>
        )}
        {/* Current month totals */}
        <div className="px-4 py-3 border-t border-gray-100 bg-gray-50 space-y-1.5">
          <p className="text-xs font-medium text-gray-500 mb-2">{currentYear}年{currentMonth}月 実績</p>
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">収入</span>
            <span className="font-semibold text-blue-600">{fmt(currentIncome)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">支出</span>
            <span className="font-semibold text-red-500">{fmt(currentExpense)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">投資・貯蓄</span>
            <span className="font-semibold text-gray-700">{fmt(currentInvestment)}</span>
          </div>
          <div className="flex justify-between text-sm pt-1 border-t border-gray-200">
            <span className="text-gray-600">支出率</span>
            <span className={`font-bold ${currentExpenseRate >= 80 ? 'text-red-500' : 'text-gray-800'}`}>
              {currentExpenseRate}%
            </span>
          </div>
        </div>
      </div>

    </div>
  );
}
