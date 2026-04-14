import { useMemo } from 'react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import { Transaction } from '../../types';
import { fmt } from '../../lib/format';

export const MF_CATEGORY_COLORS: Record<string, string> = {
  '食費': '#E94B3C', '外食': '#E94B3C', '食料品': '#E94B3C',
  '日用品': '#8BC34A', 'スキンケア用品': '#8BC34A', '雑費': '#8BC34A',
  '交際費': '#42A5F5', '娯楽費': '#5C6BC0', '家族交際費': '#42A5F5',
  'サブスク': '#26A65B', '通信費': '#00ACC1', 'ローン返済': '#26A65B',
  '税金': '#78909C', '光熱費': '#00897B',
  'ガソリン': '#546E7A', '自動車保険': '#546E7A', '駐車場': '#607D8B',
  '株式投資': '#37474F', '積立投資': '#37474F', '定期預金': '#455A64',
  '給与': '#1E88E5', '利子所得': '#29B6F6', '共有NISA積立分': '#0288D1',
  '事業投資': '#8D6E63', 'その他': '#90A4AE',
};
export const CHART_COLORS = ['#E94B3C','#26A65B','#42A5F5','#546E7A','#8BC34A','#5C6BC0','#00ACC1','#78909C','#37474F','#FF7043'];

export function getCategoryColor(name: string, index: number): string {
  return MF_CATEGORY_COLORS[name] ?? CHART_COLORS[index % CHART_COLORS.length];
}

export const ChevronIcon = ({ expanded }: { expanded: boolean }) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"
    className={`w-3 h-3 text-gray-300 shrink-0 transition-transform ${expanded ? 'rotate-180' : ''}`}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
  </svg>
);

export const ExcludeIcon = ({ excluded }: { excluded: boolean }) => excluded ? (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-3.5 h-3.5">
    <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
  </svg>
) : (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-3.5 h-3.5">
    <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
  </svg>
);

export const ReclassifyIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-3.5 h-3.5">
    <path strokeLinecap="round" strokeLinejoin="round" d="M9.568 3H5.25A2.25 2.25 0 003 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 005.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 009.568 3z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M6 6h.008v.008H6V6z" />
  </svg>
);

interface Props {
  type: 'income' | 'expense';
  monthlyTx: Transaction[];
  expandedGroups: Set<string>;
  toggleGroup: (key: string) => void;
  selectedMonth: number;
  openReclassify: (tx: Transaction) => void;
  updateTransaction: (tx: Transaction) => void;
}

export default function CategorySection({ type, monthlyTx, expandedGroups, toggleGroup, selectedMonth, openReclassify, updateTransaction }: Props) {
  const isIncome = type === 'income';
  const labelColor = isIncome ? 'text-blue-600' : 'text-red-500';
  const label = isIncome ? '収入' : '支出';

  const pieData = useMemo(() => {
    const map: Record<string, number> = {};
    monthlyTx.filter(t => t.type === type && !t.excluded)
      .forEach(t => { const k = t.subcategory || t.itemName; map[k] = (map[k] || 0) + t.amount; });
    return Object.entries(map).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [monthlyTx, type]);

  const pieTotal = pieData.reduce((s, d) => s + d.value, 0);

  if (pieData.length === 0) {
    return (
      <div className="flex flex-col">
        <p className={`text-xs font-medium ${labelColor} text-center py-2 border-b border-gray-100`}>{label}</p>
        <div className="flex items-center justify-center py-10 text-gray-300">
          <p className="text-xs">データなし</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      <p className={`text-xs font-medium ${labelColor} text-center py-2 border-b border-gray-100`}>{label}</p>
      <ResponsiveContainer width="100%" height={110}>
        <PieChart>
          <Pie data={pieData} dataKey="value" cx="50%" cy="50%" innerRadius={22} outerRadius={38}>
            {pieData.map((entry, i) => (
              <Cell key={i} fill={getCategoryColor(entry.name, i)} />
            ))}
          </Pie>
          <Tooltip formatter={(v: number) => fmt(v)} />
        </PieChart>
      </ResponsiveContainer>
      <div className="divide-y divide-gray-50">
        {pieData.map((item, i) => {
          const pct = pieTotal > 0 ? Math.round(item.value / pieTotal * 100) : 0;
          const color = getCategoryColor(item.name, i);
          const majorKey = `${type}-${item.name}`;
          const majorExpanded = expandedGroups.has(majorKey);
          // 全明細（表示用・除外済み含む）
          const majorTx = monthlyTx.filter(t => t.type === type && (t.subcategory || t.itemName) === item.name);
          // ② 中分類合計は除外済みを含めない
          const minorMap: Record<string, number> = {};
          majorTx.filter(t => !t.excluded).forEach(t => { const k = t.minorCategory || t.itemName; minorMap[k] = (minorMap[k] || 0) + t.amount; });
          const minorGroups = Object.entries(minorMap).map(([name, total]) => ({ name, total })).sort((a, b) => b.total - a.total);

          return (
            <div key={item.name}>
              <button onClick={() => toggleGroup(majorKey)} className="w-full flex items-center pl-1 pr-2 py-2 gap-1.5 border-b border-gray-100 hover:bg-gray-50 transition-colors">
                <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
                <span className="text-xs font-semibold text-gray-800 flex-1 truncate text-left">{item.name}</span>
                <div className="text-right shrink-0 w-20">
                  <p className="text-xs font-medium text-gray-700 tabular-nums">{fmt(item.value)}</p>
                  <p className="text-[10px] text-gray-400">{pct}%</p>
                </div>
                <ChevronIcon expanded={majorExpanded} />
              </button>
              <div>
                {minorGroups.map(minor => {
                  const minorKey = `${type}-${item.name}-${minor.name}`;
                  const minorExpanded = expandedGroups.has(minorKey);
                  // ⑤ 中分類に属する全明細（除外済み含む・日付降順）
                  const minorTx = majorTx
                    .filter(t => (t.minorCategory || t.itemName) === minor.name)
                    .sort((a, b) => (b.day || 0) - (a.day || 0));
                  const showTx = minorExpanded || majorExpanded;
                  return (
                    <div key={minor.name} className="border-b border-gray-50 last:border-0">
                      <button
                        onClick={e => { e.stopPropagation(); toggleGroup(minorKey); }}
                        className="w-full flex items-center pl-5 pr-2 py-1.5 gap-1.5 bg-white hover:bg-gray-50 transition-colors"
                      >
                        <span className="text-[9px] shrink-0" style={{ color }}>●</span>
                        <span className="text-xs text-gray-600 flex-1 truncate text-left">{minor.name}</span>
                        <span className="text-xs text-gray-600 tabular-nums text-right w-20 shrink-0">{fmt(minor.total)}</span>
                        <ChevronIcon expanded={minorExpanded} />
                      </button>
                      {showTx && (
                        <div className="bg-gray-100 divide-y divide-gray-200">
                          {minorTx.map(tx => (
                            <div key={tx.id} className={`flex items-center pl-7 pr-2 py-1.5 gap-1 ${tx.excluded ? 'opacity-40' : ''}`}>
                              <div className="flex-1 min-w-0">
                                <p className={`text-xs text-gray-700 truncate ${tx.excluded ? 'line-through' : ''}`}>{tx.itemName}</p>
                                <p className="text-[10px] text-gray-400 tabular-nums">
                                  {tx.day ? `${selectedMonth}/${tx.day}` : `${selectedMonth}月`} · {fmt(tx.amount)}
                                </p>
                                <div className="flex gap-1 flex-wrap mt-0.5">
                                  {isIncome && tx.budgetType && (
                                    <span className={`text-[10px] px-1 py-0.5 rounded-full ${tx.budgetType === '予算内' ? 'bg-green-50 text-green-600' : 'bg-orange-50 text-orange-600'}`}>{tx.budgetType}</span>
                                  )}
                                  {!isIncome && tx.expenseType && (
                                    <span className="text-[10px] px-1 py-0.5 rounded-full bg-blue-50 text-blue-600">{tx.expenseType}</span>
                                  )}
                                  {tx.member && (
                                    <span className="text-[10px] px-1 py-0.5 rounded-full bg-purple-50 text-purple-600">{tx.member}</span>
                                  )}
                                </div>
                              </div>
                              <button
                                onClick={e => { e.stopPropagation(); updateTransaction({ ...tx, excluded: !tx.excluded }); }}
                                className={`p-1 shrink-0 ${tx.excluded ? 'text-orange-400' : 'text-gray-300 hover:text-orange-400'}`}
                                title={tx.excluded ? '集計に含める' : '集計から除外'}
                              >
                                <ExcludeIcon excluded={!!tx.excluded} />
                              </button>
                              <button
                                onClick={e => { e.stopPropagation(); openReclassify(tx); }}
                                className="text-gray-300 hover:text-indigo-500 p-1 shrink-0"
                                title="分類変更"
                              >
                                <ReclassifyIcon />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
