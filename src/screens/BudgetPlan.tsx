import React, { useState, useMemo } from 'react';
import { useApp } from '../contexts/AppContext';
import { Budget, TransactionType } from '../types';
import { getMajorCategories, getMinorCategories } from '../lib/categoryConfig';

const ALL_YEARS = Array.from({ length: 36 }, (_, i) => 2025 + i);
const VISIBLE_COUNT = 10;

function formatAmount(n: number): string {
  if (n === 0) return '-';
  return n.toLocaleString('ja-JP');
}

function getDefaultCategory(type: TransactionType): string {
  const cats = getMajorCategories(type);
  return cats.length > 0 ? cats[0].name : '';
}

interface FormState {
  type: TransactionType;
  category: string;
  subcategory: string;
  amount: string;
  startYear: number;
  endYear: number;
}

const defaultForm: FormState = {
  type: 'expense',
  category: '',
  subcategory: '',
  amount: '',
  startYear: 2025,
  endYear: 2060
};

const typeLabel: Record<TransactionType, string> = {
  income: '収入',
  expense: '支出',
  investment: '投資・貯蓄'
};

const typeColor: Record<TransactionType, string> = {
  income: 'text-blue-600',
  expense: 'text-red-500',
  investment: 'text-blue-500'
};

export default function BudgetPlan() {
  const { currentProfile, budgets, addBudget, deleteBudget } = useApp();
  const [startIdx, setStartIdx] = useState(0);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState<FormState>(defaultForm);

  const visibleYears = ALL_YEARS.slice(startIdx, startIdx + VISIBLE_COUNT);

  function handleTypeChange(type: TransactionType) {
    setForm(f => ({ ...f, type, category: getDefaultCategory(type), subcategory: '' }));
  }

  function handleSubmit() {
    if (!form.category.trim() || !form.amount) return;
    const amount = Number(form.amount);
    if (isNaN(amount) || amount <= 0) return;
    if (!currentProfile) return;
    addBudget({
      profileId: currentProfile.id,
      type: form.type,
      category: form.category,
      subcategory: form.subcategory || form.category,
      amount,
      startYear: form.startYear,
      endYear: form.endYear
    });
    setShowModal(false);
    setForm(defaultForm);
  }

  // Annual totals per visible year
  const yearTotals = useMemo(() => {
    const result: Record<number, Record<TransactionType, number>> = {};
    ALL_YEARS.forEach(year => {
      result[year] = { income: 0, expense: 0, investment: 0 };
      budgets.forEach(b => {
        if (year >= b.startYear && year <= b.endYear) {
          result[year][b.type] += b.amount * 12;
        }
      });
    });
    return result;
  }, [budgets]);

  if (!currentProfile) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-500">プロファイルを作成してください</p>
      </div>
    );
  }

  const groupedBudgets: Record<string, Budget[]> = {};
  (['income', 'expense', 'investment'] as TransactionType[]).forEach(type => {
    const items = budgets.filter(b => b.type === type);
    if (items.length > 0) groupedBudgets[type] = items;
  });

  return (
    <div className="p-4 max-w-full space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-gray-800">予算計画 (2025〜2060)</h2>
          <p className="text-xs text-gray-500 mt-0.5">月額予算を設定し、長期的な家計計画を立てましょう</p>
        </div>
        <button
          onClick={() => { setForm(defaultForm); setShowModal(true); }}
          className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors flex items-center gap-1.5 shrink-0"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          予算を追加
        </button>
      </div>

      {/* Year range navigator */}
      <div className="flex items-center gap-3 bg-white rounded-xl p-3 shadow-sm border border-gray-100">
        <button
          onClick={() => setStartIdx(i => Math.max(0, i - VISIBLE_COUNT))}
          disabled={startIdx === 0}
          className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-600 disabled:opacity-30"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
        </button>
        <span className="text-sm font-medium text-gray-700 flex-1 text-center">
          {visibleYears[0]}年 〜 {visibleYears[visibleYears.length - 1]}年
        </span>
        <button
          onClick={() => setStartIdx(i => Math.min(ALL_YEARS.length - VISIBLE_COUNT, i + VISIBLE_COUNT))}
          disabled={startIdx + VISIBLE_COUNT >= ALL_YEARS.length}
          className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-600 disabled:opacity-30"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
          </svg>
        </button>
      </div>

      {/* Budget table */}
      {budgets.length === 0 ? (
        <div className="bg-white rounded-xl p-8 text-center shadow-sm border border-gray-100">
          <p className="text-gray-400 text-sm">予算が登録されていません</p>
          <p className="text-gray-400 text-xs mt-1">「予算を追加」ボタンから始めましょう</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl shadow-sm border border-gray-100 bg-white">
          <table className="text-xs min-w-max">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="text-left px-3 py-2.5 font-semibold text-gray-600 sticky left-0 bg-gray-50 min-w-[160px] z-10">
                  予算項目
                </th>
                {visibleYears.map(y => (
                  <th key={y} className="px-2 py-2.5 font-semibold text-gray-600 text-center min-w-[72px]">
                    {y}年
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(['income', 'expense', 'investment'] as TransactionType[]).map(type => {
                const items = budgets.filter(b => b.type === type);
                if (items.length === 0) return null;
                return (
                  <React.Fragment key={type}>
                    <tr className="bg-gray-50 border-t border-gray-200">
                      <td colSpan={visibleYears.length + 1} className="px-3 py-1.5 sticky left-0 bg-gray-50 z-10">
                        <span className={`text-xs font-bold ${typeColor[type]}`}>{typeLabel[type]}</span>
                      </td>
                    </tr>
                    {items.map(budget => (
                      <tr key={budget.id} className="border-b border-gray-50 hover:bg-gray-50">
                        <td className="px-3 py-2.5 sticky left-0 bg-white z-10 hover:bg-gray-50">
                          <div className="flex items-center justify-between gap-2">
                            <div>
                              <p className="font-medium text-gray-800">{budget.subcategory}</p>
                              <p className="text-gray-400">{budget.category} · 月{budget.amount.toLocaleString()}</p>
                              <p className="text-gray-400">{budget.startYear}〜{budget.endYear}年</p>
                            </div>
                            <button
                              onClick={() => deleteBudget(budget.id)}
                              className="text-gray-300 hover:text-red-400 shrink-0"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          </div>
                        </td>
                        {visibleYears.map(y => {
                          const inRange = y >= budget.startYear && y <= budget.endYear;
                          const annual = inRange ? budget.amount * 12 : 0;
                          return (
                            <td key={y} className={`px-2 py-2.5 text-center ${inRange ? typeColor[type] + ' font-medium' : 'text-gray-300'}`}>
                              {inRange ? formatAmount(annual) : '-'}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </React.Fragment>
                );
              })}

              {/* Summary row */}
              <tr className="bg-indigo-50 border-t-2 border-indigo-200 font-semibold">
                <td className="px-3 py-2.5 sticky left-0 bg-indigo-50 z-10 text-indigo-700">年間合計（収支）</td>
                {visibleYears.map(y => {
                  const totals = yearTotals[y];
                  const net = totals.income - totals.expense - totals.investment;
                  return (
                    <td key={y} className={`px-2 py-2.5 text-center ${net >= 0 ? 'text-gray-800' : 'text-red-500'}`}>
                      {net >= 0 ? '+' : ''}{formatAmount(net)}
                    </td>
                  );
                })}
              </tr>
              <tr className="bg-gray-50">
                <td className="px-3 py-2 sticky left-0 bg-gray-50 z-10 text-gray-500">　うち収入</td>
                {visibleYears.map(y => (
                  <td key={y} className="px-2 py-2 text-center text-blue-600">
                    {formatAmount(yearTotals[y].income)}
                  </td>
                ))}
              </tr>
              <tr className="bg-gray-50">
                <td className="px-3 py-2 sticky left-0 bg-gray-50 z-10 text-gray-500">　うち支出</td>
                {visibleYears.map(y => (
                  <td key={y} className="px-2 py-2 text-center text-red-500">
                    {formatAmount(yearTotals[y].expense)}
                  </td>
                ))}
              </tr>
              <tr className="bg-gray-50">
                <td className="px-3 py-2 sticky left-0 bg-gray-50 z-10 text-gray-500">　うち投資・貯蓄</td>
                {visibleYears.map(y => (
                  <td key={y} className="px-2 py-2 text-center text-blue-500">
                    {formatAmount(yearTotals[y].investment)}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end md:items-center justify-center p-0 md:p-4">
          <div className="bg-white w-full md:max-w-md rounded-t-2xl md:rounded-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b border-gray-100">
              <h2 className="text-base font-semibold text-gray-800">予算を追加</h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-4 space-y-4">
              {/* Type */}
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

              {/* 大分類 */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">大分類</label>
                <select
                  value={form.category}
                  onChange={e => setForm(f => ({ ...f, category: e.target.value, subcategory: '' }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">選択してください</option>
                  {getMajorCategories(form.type).map(node => (
                    <option key={node.id} value={node.name}>{node.name}</option>
                  ))}
                </select>
              </div>

              {/* 中分類 */}
              {form.category && (
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1.5">中分類（任意）</label>
                  {getMinorCategories(form.type, form.category).length > 0 ? (
                    <select
                      value={form.subcategory}
                      onChange={e => setForm(f => ({ ...f, subcategory: e.target.value }))}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value="">なし</option>
                      {getMinorCategories(form.type, form.category).map(s => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="text"
                      value={form.subcategory}
                      onChange={e => setForm(f => ({ ...f, subcategory: e.target.value }))}
                      placeholder="自由入力（任意）"
                      className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  )}
                </div>
              )}

              {/* Monthly amount */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">月額予算（円）</label>
                <input
                  type="number"
                  value={form.amount}
                  onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                  placeholder="例：50000"
                  min="0"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                {form.amount && Number(form.amount) > 0 && (
                  <p className="text-xs text-gray-400 mt-1">年間: {(Number(form.amount) * 12).toLocaleString()}</p>
                )}
              </div>

              {/* Year range */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1.5">開始年</label>
                  <select
                    value={form.startYear}
                    onChange={e => setForm(f => ({ ...f, startYear: Number(e.target.value) }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    {ALL_YEARS.map(y => <option key={y} value={y}>{y}年</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1.5">終了年</label>
                  <select
                    value={form.endYear}
                    onChange={e => setForm(f => ({ ...f, endYear: Number(e.target.value) }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    {ALL_YEARS.filter(y => y >= form.startYear).map(y => <option key={y} value={y}>{y}年</option>)}
                  </select>
                </div>
              </div>

              <button
                onClick={handleSubmit}
                disabled={!form.subcategory.trim() || !form.amount}
                className="w-full bg-indigo-600 text-white py-3 rounded-xl font-medium hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                追加する
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
