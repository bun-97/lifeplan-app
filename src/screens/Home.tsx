import { useMemo, useState } from 'react';
import { useApp } from '../contexts/AppContext';
import { getEffectiveTag } from '../lib/categoryConfig';
import { fmt } from '../lib/format';
import { getCategoryColor } from '../components/actual/CategorySection';

const EXPENSE_TYPES = ['毎月固定', '毎月変動', '不定期固定', '不定期変動'] as const;
const INCOME_TYPES = ['予算内', '予算外'] as const;
type ExpenseType = typeof EXPENSE_TYPES[number];
type IncomeType = typeof INCOME_TYPES[number];

// 月別明細モーダル
function MonthlyDetail({ title, color, months, onClose }: {
  title: string;
  color: string;
  months: { label: string; amount: number }[];
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-end justify-center" onClick={onClose}>
      <div className="bg-white w-full max-w-lg rounded-t-2xl max-h-[70vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 sticky top-0 bg-white">
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }} />
            <span className="text-sm font-semibold text-gray-800">{title}</span>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="divide-y divide-gray-50">
          {months.filter(m => m.amount > 0).map((m, i) => (
            <div key={i} className="flex items-center px-4 py-3">
              <span className="text-sm text-gray-600 flex-1">{m.label}</span>
              <span className="text-sm font-medium tabular-nums" style={{ color }}>{fmt(m.amount)}</span>
            </div>
          ))}
          {months.every(m => m.amount === 0) && (
            <div className="px-4 py-8 text-center text-sm text-gray-400">データがありません</div>
          )}
        </div>
      </div>
    </div>
  );
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
      const monthTx = transactions.filter(t => t.year === year && t.month === month && !t.excluded);
      const income = monthTx.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
      const expense = monthTx.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
      const rate = income > 0 ? Math.round(expense / income * 100) : 0;
      return { income, expense, rate, hasData: income > 0 || expense > 0 };
    });
  }, [last12Months, transactions]);

  const monthsWithRate = monthlyStats.filter(m => m.income > 0);
  const avgRate = monthsWithRate.length > 0
    ? Math.round(monthsWithRate.reduce((s, m) => s + m.rate, 0) / monthsWithRate.length) : null;

  const thisYearTx = useMemo(() => transactions.filter(t => t.year === currentYear), [transactions, currentYear]);
  const annualIncome = thisYearTx.filter(t => t.type === 'income' && !t.excluded).reduce((s, t) => s + t.amount, 0);
  const annualExpense = thisYearTx.filter(t => t.type === 'expense' && !t.excluded).reduce((s, t) => s + t.amount, 0);

  // 支出：4分類×大項目の月平均
  const expenseData = useMemo(() => {
    const catMonthly: Record<string, Record<string, number[]>> = {};
    let activeMonths = 0;
    for (const { year, month } of last12Months) {
      const bucket: Record<string, number> = {};
      transactions
        .filter(t => t.year === year && t.month === month && t.type === 'expense' && !t.excluded)
        .forEach(t => {
          const et = t.expenseType || getEffectiveTag('expense', t.subcategory, t.minorCategory).expenseType;
          if (!et) return;
          const key = `${et}::${t.subcategory || 'その他'}`;
          bucket[key] = (bucket[key] || 0) + t.amount;
        });
      if (Object.keys(bucket).length > 0) activeMonths++;
      for (const [key, amount] of Object.entries(bucket)) {
        const [et, cat] = key.split('::');
        if (!catMonthly[et]) catMonthly[et] = {};
        if (!catMonthly[et][cat]) catMonthly[et][cat] = [];
        catMonthly[et][cat].push(amount);
      }
    }
    const divisor = Math.max(1, activeMonths);
    const byType: Record<ExpenseType, { name: string; avg: number }[]> = {
      '毎月固定': [], '毎月変動': [], '不定期固定': [], '不定期変動': [],
    };
    for (const et of EXPENSE_TYPES) {
      const cats = catMonthly[et];
      if (!cats) continue;
      byType[et] = Object.entries(cats)
        .map(([name, amounts]) => ({ name, avg: Math.round(amounts.reduce((a, b) => a + b, 0) / divisor) }))
        .filter(c => c.avg > 0)
        .sort((a, b) => b.avg - a.avg);
    }
    const total = EXPENSE_TYPES.reduce((s, et) => s + byType[et].reduce((a, c) => a + c.avg, 0), 0);
    return { byType, total, divisor };
  }, [last12Months, transactions]);

  // 収入：予算内/予算外×大項目の月平均
  const incomeData = useMemo(() => {
    const catMonthly: Record<string, Record<string, number[]>> = {};
    let activeMonths = 0;
    for (const { year, month } of last12Months) {
      const bucket: Record<string, number> = {};
      transactions
        .filter(t => t.year === year && t.month === month && t.type === 'income' && !t.excluded)
        .forEach(t => {
          const bt = t.budgetType || getEffectiveTag('income', t.subcategory, t.minorCategory).budgetType;
          if (!bt) return;
          const key = `${bt}::${t.subcategory || 'その他'}`;
          bucket[key] = (bucket[key] || 0) + t.amount;
        });
      if (Object.keys(bucket).length > 0) activeMonths++;
      for (const [key, amount] of Object.entries(bucket)) {
        const [bt, cat] = key.split('::');
        if (!catMonthly[bt]) catMonthly[bt] = {};
        if (!catMonthly[bt][cat]) catMonthly[bt][cat] = [];
        catMonthly[bt][cat].push(amount);
      }
    }
    const divisor = Math.max(1, activeMonths);
    const byType: Record<IncomeType, { name: string; avg: number }[]> = { '予算内': [], '予算外': [] };
    for (const bt of INCOME_TYPES) {
      const cats = catMonthly[bt];
      if (!cats) continue;
      byType[bt] = Object.entries(cats)
        .map(([name, amounts]) => ({ name, avg: Math.round(amounts.reduce((a, b) => a + b, 0) / divisor) }))
        .filter(c => c.avg > 0)
        .sort((a, b) => b.avg - a.avg);
    }
    const total = INCOME_TYPES.reduce((s, bt) => s + byType[bt].reduce((a, c) => a + c.avg, 0), 0);
    return { byType, total, divisor };
  }, [last12Months, transactions]);

  // 月別明細データ生成（カテゴリ名とtypeを渡す）
  const getMonthlyBreakdown = (catName: string, txType: 'income' | 'expense') => {
    return last12Months.map(({ year, month }) => ({
      label: `${year}年${month}月`,
      amount: transactions
        .filter(t => t.year === year && t.month === month && t.type === txType && !t.excluded && (t.subcategory || 'その他') === catName)
        .reduce((s, t) => s + t.amount, 0),
    })).reverse();
  };

  const [showRateDetail, setShowRateDetail] = useState(false);
  const [detail, setDetail] = useState<{ title: string; color: string; months: { label: string; amount: number }[] } | null>(null);

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
            {avgRate === null ? <span className="text-3xl font-bold text-gray-300">—</span> : (
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

      {/* 年間合計 */}
      <div className="bg-white mt-2 divide-y divide-gray-100">
        <div className="flex items-center px-4 py-3.5">
          <span className="text-sm text-gray-600 flex-1">{currentYear}年 収入合計</span>
          <span className="text-sm font-semibold text-blue-600 tabular-nums">{fmt(annualIncome)}</span>
        </div>
        <div className="flex items-center px-4 py-3.5">
          <span className="text-sm text-gray-600 flex-1">{currentYear}年 支出合計</span>
          <span className="text-sm font-semibold text-red-500 tabular-nums">{fmt(annualExpense)}</span>
        </div>
      </div>

      {/* ── 収入セクション ── */}
      <div className="mt-4">
        <div className="flex items-center justify-between px-4 pb-2">
          <p className="text-xs text-gray-400">収入（直近12か月 月平均）</p>
          <p className="text-sm font-bold text-blue-600 tabular-nums">{fmt(incomeData.total)}</p>
        </div>
        <div className="px-3 grid grid-cols-2 gap-2">
          {INCOME_TYPES.map(bt => {
            const cats = incomeData.byType[bt];
            const subtotal = cats.reduce((s, c) => s + c.avg, 0);
            return (
              <div key={bt} className="bg-white rounded-xl border border-gray-100 overflow-hidden">
                <div className="px-3 py-2 border-b border-gray-100">
                  <p className="text-[11px] font-semibold text-gray-500">{bt}</p>
                  <p className={`text-sm font-bold tabular-nums ${subtotal > 0 ? 'text-blue-600' : 'text-gray-300'}`}>
                    {subtotal > 0 ? fmt(subtotal) : '—'}
                  </p>
                </div>
                <div className="divide-y divide-gray-50">
                  {cats.length > 0 ? cats.map((item, i) => {
                    const color = getCategoryColor(item.name, i);
                    return (
                      <button
                        key={item.name}
                        onClick={() => setDetail({ title: item.name, color, months: getMonthlyBreakdown(item.name, 'income') })}
                        className="w-full flex items-center px-3 py-1.5 gap-2 hover:bg-gray-50 active:bg-gray-100"
                      >
                        <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
                        <span className="text-[11px] text-gray-600 flex-1 truncate text-left">{item.name}</span>
                        <span className="text-[11px] text-blue-500 tabular-nums shrink-0">{fmt(item.avg)}</span>
                      </button>
                    );
                  }) : (
                    <div className="px-3 py-3 text-center">
                      <span className="text-[10px] text-gray-300">データなし</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── 支出セクション ── */}
      <div className="mt-4">
        <div className="flex items-center justify-between px-4 pb-2">
          <p className="text-xs text-gray-400">支出（直近12か月 月平均）</p>
          <p className="text-sm font-bold text-red-500 tabular-nums">{fmt(expenseData.total)}</p>
        </div>
        <div className="px-3 grid grid-cols-2 gap-2">
          {EXPENSE_TYPES.map(et => {
            const cats = expenseData.byType[et];
            const subtotal = cats.reduce((s, c) => s + c.avg, 0);
            return (
              <div key={et} className="bg-white rounded-xl border border-gray-100 overflow-hidden">
                <div className="px-3 py-2 border-b border-gray-100">
                  <p className="text-[11px] font-semibold text-gray-500">{et}</p>
                  <p className={`text-sm font-bold tabular-nums ${subtotal > 0 ? 'text-red-500' : 'text-gray-300'}`}>
                    {subtotal > 0 ? fmt(subtotal) : '—'}
                  </p>
                </div>
                <div className="divide-y divide-gray-50">
                  {cats.length > 0 ? cats.map((item, i) => {
                    const color = getCategoryColor(item.name, i);
                    return (
                      <button
                        key={item.name}
                        onClick={() => setDetail({ title: item.name, color, months: getMonthlyBreakdown(item.name, 'expense') })}
                        className="w-full flex items-center px-3 py-1.5 gap-2 hover:bg-gray-50 active:bg-gray-100"
                      >
                        <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
                        <span className="text-[11px] text-gray-600 flex-1 truncate text-left">{item.name}</span>
                        <span className="text-[11px] text-red-400 tabular-nums shrink-0">{fmt(item.avg)}</span>
                      </button>
                    );
                  }) : (
                    <div className="px-3 py-3 text-center">
                      <span className="text-[10px] text-gray-300">データなし</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="h-8" />

      {/* 月別明細モーダル */}
      {detail && (
        <MonthlyDetail
          title={detail.title}
          color={detail.color}
          months={detail.months}
          onClose={() => setDetail(null)}
        />
      )}
    </div>
  );
}
