import React, { useState, useMemo } from 'react';
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { useApp } from '../contexts/AppContext';
import { TransactionType } from '../types';

const MONTHS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
const CHART_COLORS = [
  '#6366f1', '#8b5cf6', '#ec4899', '#f43f5e', '#f97316',
  '#eab308', '#22c55e', '#14b8a6', '#06b6d4', '#3b82f6'
];

function formatAmount(n: number): string {
  if (n === 0) return '0';
  if (Math.abs(n) >= 10000) {
    return (n / 10000).toFixed(1) + '万';
  }
  return n.toLocaleString('ja-JP');
}

function formatFull(n: number): string {
  return n.toLocaleString('ja-JP') + '円';
}

const typeLabel: Record<TransactionType, string> = {
  income: '収入',
  expense: '支出',
  investment: '投資・貯蓄'
};

const typeTextColor: Record<TransactionType, string> = {
  income: 'text-emerald-600',
  expense: 'text-red-500',
  investment: 'text-blue-500'
};

export default function AnnualBudget() {
  const { currentProfile, transactions, budgets } = useApp();
  const now = new Date();
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());

  // Budget per item per month
  const budgetByItemMonth = useMemo(() => {
    // Returns: { budgetId -> monthly amount (0 if year out of range) }
    const result: Record<string, number> = {};
    budgets.forEach(b => {
      if (selectedYear >= b.startYear && selectedYear <= b.endYear) {
        result[b.id] = b.amount;
      } else {
        result[b.id] = 0;
      }
    });
    return result;
  }, [budgets, selectedYear]);

  // Actual per type per month
  const actualByTypeMonth = useMemo(() => {
    const result: Record<TransactionType, Record<number, number>> = {
      income: {}, expense: {}, investment: {}
    };
    MONTHS.forEach(m => {
      result.income[m] = 0;
      result.expense[m] = 0;
      result.investment[m] = 0;
    });
    transactions.filter(t => t.year === selectedYear).forEach(t => {
      result[t.type][t.month] = (result[t.type][t.month] || 0) + t.amount;
    });
    return result;
  }, [transactions, selectedYear]);

  // Budget totals per type per month
  const budgetByTypeMonth = useMemo(() => {
    const result: Record<TransactionType, Record<number, number>> = {
      income: {}, expense: {}, investment: {}
    };
    MONTHS.forEach(m => {
      result.income[m] = 0;
      result.expense[m] = 0;
      result.investment[m] = 0;
    });
    budgets.forEach(b => {
      if (selectedYear >= b.startYear && selectedYear <= b.endYear) {
        MONTHS.forEach(m => {
          result[b.type][m] = (result[b.type][m] || 0) + b.amount;
        });
      }
    });
    return result;
  }, [budgets, selectedYear]);

  // Annual totals
  const annualBudget = useMemo(() => {
    const result: Record<TransactionType, number> = { income: 0, expense: 0, investment: 0 };
    budgets.forEach(b => {
      if (selectedYear >= b.startYear && selectedYear <= b.endYear) {
        result[b.type] += b.amount * 12;
      }
    });
    return result;
  }, [budgets, selectedYear]);

  const annualActual = useMemo(() => {
    const result: Record<TransactionType, number> = { income: 0, expense: 0, investment: 0 };
    transactions.filter(t => t.year === selectedYear).forEach(t => {
      result[t.type] += t.amount;
    });
    return result;
  }, [transactions, selectedYear]);

  // Pie chart data (budget by subcategory for expenses)
  const expensePieData = useMemo(() => {
    const map: Record<string, number> = {};
    budgets.filter(b => b.type === 'expense').forEach(b => {
      if (selectedYear >= b.startYear && selectedYear <= b.endYear) {
        map[b.subcategory] = (map[b.subcategory] || 0) + b.amount * 12;
      }
    });
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  }, [budgets, selectedYear]);

  const expenseRate = annualBudget.income > 0
    ? (annualBudget.expense / annualBudget.income) * 100
    : 0;

  if (!currentProfile) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-500">プロファイルを作成してください</p>
      </div>
    );
  }

  return (
    <div className="p-4 max-w-full space-y-4">
      {/* Year selector */}
      <div className="flex items-center justify-between bg-white rounded-xl p-3 shadow-sm border border-gray-100">
        <button
          onClick={() => setSelectedYear(y => y - 1)}
          className="p-2 rounded-lg hover:bg-gray-100 text-gray-600"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
        </button>
        <span className="text-base font-semibold text-gray-800">{selectedYear}年</span>
        <button
          onClick={() => setSelectedYear(y => y + 1)}
          className="p-2 rounded-lg hover:bg-gray-100 text-gray-600"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
          </svg>
        </button>
      </div>

      {/* Alert */}
      {expenseRate > 80 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-3 flex items-center gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 text-red-500 shrink-0">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
          </svg>
          <p className="text-sm text-red-700">予算上の支出が収入の{Math.round(expenseRate)}%です。計画を見直しましょう。</p>
        </div>
      )}

      {/* Annual summary cards */}
      <div className="grid grid-cols-3 gap-2">
        {(['income', 'expense', 'investment'] as TransactionType[]).map(type => (
          <div key={type} className="bg-white rounded-xl p-3 shadow-sm border border-gray-100">
            <p className="text-xs text-gray-500 mb-1">{typeLabel[type]}</p>
            <div className="space-y-0.5">
              <p className={`text-sm font-bold ${typeTextColor[type]}`}>{formatAmount(annualBudget[type])}</p>
              <p className="text-xs text-gray-400">予算</p>
              <p className={`text-sm font-semibold ${typeTextColor[type]} opacity-70`}>{formatAmount(annualActual[type])}</p>
              <p className="text-xs text-gray-400">実績</p>
            </div>
          </div>
        ))}
      </div>

      {/* Annual balance */}
      <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs text-gray-500">年間収支（予算）</p>
            {(() => {
              const net = annualBudget.income - annualBudget.expense - annualBudget.investment;
              return <p className={`text-base font-bold ${net >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                {net >= 0 ? '+' : ''}{formatFull(net)}
              </p>;
            })()}
          </div>
          <div>
            <p className="text-xs text-gray-500">年間収支（実績）</p>
            {(() => {
              const net = annualActual.income - annualActual.expense - annualActual.investment;
              return <p className={`text-base font-bold ${net >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                {net >= 0 ? '+' : ''}{formatFull(net)}
              </p>;
            })()}
          </div>
        </div>
      </div>

      {/* Monthly breakdown table */}
      {(['income', 'expense', 'investment'] as TransactionType[]).map(type => {
        const typeBudgets = budgets.filter(b => b.type === type && selectedYear >= b.startYear && selectedYear <= b.endYear);
        if (typeBudgets.length === 0) return null;

        return (
          <div key={type} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="px-4 py-2.5 border-b border-gray-100 bg-gray-50">
              <span className={`text-sm font-bold ${typeTextColor[type]}`}>{typeLabel[type]}</span>
            </div>
            <div className="overflow-x-auto">
              <table className="text-xs min-w-max w-full">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left px-3 py-2 font-semibold text-gray-600 sticky left-0 bg-white min-w-[120px] z-10">項目</th>
                    {MONTHS.map(m => (
                      <th key={m} className="px-1.5 py-2 font-semibold text-gray-500 text-center min-w-[52px]">{m}月</th>
                    ))}
                    <th className="px-2 py-2 font-semibold text-gray-600 text-center min-w-[60px]">年間計</th>
                  </tr>
                </thead>
                <tbody>
                  {typeBudgets.map(budget => {
                    const budgetMonthly = budgetByItemMonth[budget.id] || 0;
                    const annualBudgetAmt = budgetMonthly * 12;
                    return (
                      <React.Fragment key={budget.id}>
                        {/* Budget row */}
                        <tr className="border-b border-gray-50">
                          <td className="px-3 py-1.5 sticky left-0 bg-white z-10">
                            <p className="font-medium text-gray-700">{budget.subcategory}</p>
                            <p className="text-gray-400 text-[10px]">予算</p>
                          </td>
                          {MONTHS.map(m => (
                            <td key={m} className="px-1.5 py-1.5 text-center text-gray-600">
                              {formatAmount(budgetMonthly)}
                            </td>
                          ))}
                          <td className="px-2 py-1.5 text-center font-semibold text-gray-700">
                            {formatAmount(annualBudgetAmt)}
                          </td>
                        </tr>
                        {/* Actual row */}
                        <tr className="border-b border-gray-50">
                          <td className="px-3 py-1.5 sticky left-0 bg-white z-10">
                            <p className="text-gray-400 text-[10px]">実績</p>
                          </td>
                          {MONTHS.map(m => {
                            const actual = transactions
                              .filter(t => t.year === selectedYear && t.month === m && t.type === type && t.subcategory === budget.subcategory)
                              .reduce((s, t) => s + t.amount, 0);
                            const isOver = actual > budgetMonthly && budgetMonthly > 0;
                            return (
                              <td key={m} className={`px-1.5 py-1.5 text-center font-medium ${actual > 0 ? (isOver ? 'text-red-500' : 'text-emerald-600') : 'text-gray-300'}`}>
                                {actual > 0 ? formatAmount(actual) : '-'}
                              </td>
                            );
                          })}
                          <td className="px-2 py-1.5 text-center font-semibold text-gray-600">
                            {(() => {
                              const total = MONTHS.reduce((s, m) => s + transactions
                                .filter(t => t.year === selectedYear && t.month === m && t.type === type && t.subcategory === budget.subcategory)
                                .reduce((ss, t) => ss + t.amount, 0), 0);
                              return total > 0 ? formatAmount(total) : '-';
                            })()}
                          </td>
                        </tr>
                        {/* Diff row */}
                        <tr className="border-b border-gray-100 bg-gray-50/50">
                          <td className="px-3 py-1 sticky left-0 bg-gray-50/50 z-10">
                            <p className="text-gray-400 text-[10px]">差異</p>
                          </td>
                          {MONTHS.map(m => {
                            const actual = transactions
                              .filter(t => t.year === selectedYear && t.month === m && t.type === type && t.subcategory === budget.subcategory)
                              .reduce((s, t) => s + t.amount, 0);
                            const diff = budgetMonthly - actual;
                            if (budgetMonthly === 0) return <td key={m} className="px-1.5 py-1 text-center text-gray-300">-</td>;
                            return (
                              <td key={m} className={`px-1.5 py-1 text-center text-[10px] ${diff >= 0 ? 'text-emerald-500' : 'text-red-400'}`}>
                                {diff >= 0 ? '+' : ''}{formatAmount(diff)}
                              </td>
                            );
                          })}
                          <td className="px-2 py-1 text-center text-[10px] text-gray-400">-</td>
                        </tr>
                      </React.Fragment>
                    );
                  })}

                  {/* Type subtotal */}
                  <tr className="border-t-2 border-gray-200 bg-gray-50 font-semibold">
                    <td className="px-3 py-2 sticky left-0 bg-gray-50 z-10 text-gray-700">合計（予算）</td>
                    {MONTHS.map(m => (
                      <td key={m} className={`px-1.5 py-2 text-center ${typeTextColor[type]}`}>
                        {formatAmount(budgetByTypeMonth[type][m] || 0)}
                      </td>
                    ))}
                    <td className={`px-2 py-2 text-center ${typeTextColor[type]}`}>
                      {formatAmount(annualBudget[type])}
                    </td>
                  </tr>
                  <tr className="bg-gray-50">
                    <td className="px-3 py-1.5 sticky left-0 bg-gray-50 z-10 text-gray-500 text-[11px]">合計（実績）</td>
                    {MONTHS.map(m => (
                      <td key={m} className={`px-1.5 py-1.5 text-center text-[11px] ${typeTextColor[type]} opacity-70`}>
                        {actualByTypeMonth[type][m] > 0 ? formatAmount(actualByTypeMonth[type][m]) : '-'}
                      </td>
                    ))}
                    <td className={`px-2 py-1.5 text-center text-[11px] ${typeTextColor[type]} opacity-70`}>
                      {annualActual[type] > 0 ? formatAmount(annualActual[type]) : '-'}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        );
      })}

      {budgets.length === 0 && (
        <div className="bg-white rounded-xl p-8 text-center shadow-sm border border-gray-100">
          <p className="text-gray-400 text-sm">予算が設定されていません</p>
          <p className="text-gray-400 text-xs mt-1">「予算計画」タブから予算を設定してください</p>
        </div>
      )}

      {/* Pie chart */}
      {expensePieData.length > 0 && (
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">年間支出予算の内訳</h3>
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie
                data={expensePieData}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius={90}
                label={({ name, percent }) => `${name} ${Math.round((percent || 0) * 100)}%`}
                labelLine={false}
              >
                {expensePieData.map((_, index) => (
                  <Cell key={index} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(value: number) => formatFull(value)} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
