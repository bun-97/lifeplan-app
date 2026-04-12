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

  // Last 12 months list
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

  // Per-month income/expense for last 12 months
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

  const avgIncome = monthsWithData.length > 0
    ? Math.round(monthsWithData.reduce((s, m) => s + m.income, 0) / monthsWithData.length)
    : 0;

  const avgExpense = monthsWithData.length > 0
    ? Math.round(monthsWithData.reduce((s, m) => s + m.expense, 0) / monthsWithData.length)
    : 0;

  const avgRate = monthsWithData.filter(m => m.income > 0).length > 0
    ? Math.round(monthsWithData.filter(m => m.income > 0).reduce((s, m) => s + m.rate, 0) / monthsWithData.filter(m => m.income > 0).length)
    : null;

  // This year totals
  const thisYearTx = useMemo(() => transactions.filter(t => t.year === currentYear), [transactions, currentYear]);
  const annualIncome = thisYearTx.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const annualExpense = thisYearTx.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);

  if (!currentProfile) {
    return <div className="flex items-center justify-center h-64"><p className="text-gray-500">プロファイルを作成してください</p></div>;
  }

  const cards = [
    {
      label: '直近12か月 平均月収入',
      value: fmt(avgIncome),
      color: 'text-blue-600',
      sub: `${monthsWithData.length}か月分のデータ`,
    },
    {
      label: '直近12か月 平均月支出',
      value: fmt(avgExpense),
      color: 'text-red-500',
      sub: `${monthsWithData.length}か月分のデータ`,
    },
    {
      label: `${currentYear}年 年間収入合計`,
      value: fmt(annualIncome),
      color: 'text-blue-600',
      sub: '今年の実績',
    },
    {
      label: `${currentYear}年 年間支出合計`,
      value: fmt(annualExpense),
      color: 'text-red-500',
      sub: '今年の実績',
    },
    {
      label: '直近12か月 平均支出率',
      value: avgRate !== null ? `${avgRate}%` : 'データなし',
      color: avgRate === null ? 'text-gray-400' : avgRate >= 80 ? 'text-red-500' : 'text-gray-800',
      sub: avgRate !== null && avgRate >= 80 ? '⚠️ 支出が収入の80%超' : '収入に対する支出の割合',
    },
  ];

  return (
    <div className="w-full p-4">
      <div className="grid grid-cols-2 gap-3">
        {cards.map((card, i) => (
          <div
            key={i}
            className={`bg-white rounded-xl shadow-sm border border-gray-100 p-4 ${i === 4 ? 'col-span-2' : ''}`}
          >
            <p className="text-xs text-gray-400 mb-1">{card.label}</p>
            <p className={`text-2xl font-bold ${card.color}`}>{card.value}</p>
            <p className="text-xs text-gray-400 mt-1">{card.sub}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
