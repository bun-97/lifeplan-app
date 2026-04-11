import { useState, useMemo } from 'react';
import { useApp } from '../contexts/AppContext';
import { FamilyMember, LifeEvent } from '../types';
import { v4 as uuidv4 } from 'uuid';

const PLAN_YEARS = Array.from({ length: 36 }, (_, i) => 2025 + i);
const RELATIONS = ['本人', '配偶者', '子供', 'その他'];
const BIRTH_YEARS = Array.from({ length: 81 }, (_, i) => 1950 + i);

function formatAmount(n: number): string {
  if (n === 0) return '-';
  if (Math.abs(n) >= 10000) return (n / 10000).toFixed(0) + '万';
  return n.toLocaleString('ja-JP');
}

type Tab = 'family' | 'plan';

interface MemberForm {
  name: string;
  birthYear: number;
  relation: string;
}

const defaultMemberForm: MemberForm = {
  name: '',
  birthYear: 1990,
  relation: '本人'
};

interface EventForm {
  year: number;
  title: string;
  description: string;
  amount: string;
}

const defaultEventForm: EventForm = {
  year: new Date().getFullYear(),
  title: '',
  description: '',
  amount: ''
};

export default function LifePlan() {
  const { currentProfile, updateProfile, lifeEvents, addLifeEvent, deleteLifeEvent, transactions, budgets } = useApp();
  const [activeTab, setActiveTab] = useState<Tab>('family');
  const [showMemberModal, setShowMemberModal] = useState(false);
  const [showEventModal, setShowEventModal] = useState(false);
  const [memberForm, setMemberForm] = useState<MemberForm>(defaultMemberForm);
  const [editingMemberId, setEditingMemberId] = useState<string | null>(null);
  const [eventForm, setEventForm] = useState<EventForm>(defaultEventForm);

  const members = currentProfile?.members || [];

  function handleAddMember() {
    if (!memberForm.name.trim() || !currentProfile) return;
    const member: FamilyMember = {
      id: uuidv4(),
      name: memberForm.name.trim(),
      birthYear: memberForm.birthYear,
      relation: memberForm.relation
    };
    if (editingMemberId) {
      const updated = members.map(m => m.id === editingMemberId ? { ...member, id: editingMemberId } : m);
      updateProfile({ ...currentProfile, members: updated });
    } else {
      updateProfile({ ...currentProfile, members: [...members, member] });
    }
    setShowMemberModal(false);
    setMemberForm(defaultMemberForm);
    setEditingMemberId(null);
  }

  function handleDeleteMember(id: string) {
    if (!currentProfile) return;
    updateProfile({ ...currentProfile, members: members.filter(m => m.id !== id) });
  }

  function openEditMember(member: FamilyMember) {
    setMemberForm({ name: member.name, birthYear: member.birthYear, relation: member.relation });
    setEditingMemberId(member.id);
    setShowMemberModal(true);
  }

  function handleAddEvent() {
    if (!eventForm.title.trim() || !currentProfile) return;
    addLifeEvent({
      profileId: currentProfile.id,
      year: eventForm.year,
      title: eventForm.title.trim(),
      description: eventForm.description.trim() || undefined,
      amount: eventForm.amount ? Number(eventForm.amount) : undefined
    });
    setShowEventModal(false);
    setEventForm(defaultEventForm);
  }

  // Cash flow per year (from budgets + actuals)
  const cashFlow = useMemo(() => {
    return PLAN_YEARS.map(year => {
      // Budget amounts
      let budgetIncome = 0;
      let budgetExpense = 0;
      let budgetInvestment = 0;
      budgets.forEach(b => {
        if (year >= b.startYear && year <= b.endYear) {
          if (b.type === 'income') budgetIncome += b.amount * 12;
          else if (b.type === 'expense') budgetExpense += b.amount * 12;
          else budgetInvestment += b.amount * 12;
        }
      });

      // Actual amounts
      const yearTx = transactions.filter(t => t.year === year);
      const actualIncome = yearTx.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
      const actualExpense = yearTx.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
      const actualInvestment = yearTx.filter(t => t.type === 'investment').reduce((s, t) => s + t.amount, 0);

      // Use actual if available, else budget
      const income = actualIncome > 0 ? actualIncome : budgetIncome;
      const expense = actualExpense > 0 ? actualExpense : budgetExpense;
      const investment = actualInvestment > 0 ? actualInvestment : budgetInvestment;
      const balance = income - expense - investment;

      return { year, income, expense, investment, balance };
    });
  }, [budgets, transactions]);

  // Cumulative balance
  const cashFlowWithCumulative = useMemo(() => {
    let cumulative = 0;
    return cashFlow.map(row => {
      cumulative += row.balance;
      return { ...row, cumulative };
    });
  }, [cashFlow]);

  // Life events grouped by year
  const eventsByYear = useMemo(() => {
    const map: Record<number, LifeEvent[]> = {};
    lifeEvents.forEach(e => {
      if (!map[e.year]) map[e.year] = [];
      map[e.year].push(e);
    });
    return map;
  }, [lifeEvents]);

  if (!currentProfile) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-500">プロファイルを作成してください</p>
      </div>
    );
  }

  return (
    <div className="p-4 max-w-full space-y-4">
      {/* Tabs */}
      <div className="flex bg-gray-100 rounded-xl p-1 gap-1">
        {([['family', '家族設定'], ['plan', 'ライフプランシート']] as [Tab, string][]).map(([tab, label]) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === tab ? 'bg-white text-indigo-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Family tab */}
      {activeTab === 'family' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-700">家族メンバー</h2>
            <button
              onClick={() => { setMemberForm(defaultMemberForm); setEditingMemberId(null); setShowMemberModal(true); }}
              className="bg-indigo-600 text-white px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors flex items-center gap-1"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              メンバーを追加
            </button>
          </div>

          {members.length === 0 ? (
            <div className="bg-white rounded-xl p-8 text-center shadow-sm border border-gray-100">
              <p className="text-gray-400 text-sm">メンバーが登録されていません</p>
              <p className="text-gray-400 text-xs mt-1">家族のメンバーを追加してください</p>
            </div>
          ) : (
            members.map(member => (
              <div key={member.id} className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-gray-800">{member.name}</span>
                    <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full">{member.relation}</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">生年: {member.birthYear}年 · 現在 {new Date().getFullYear() - member.birthYear}歳</p>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => openEditMember(member)}
                    className="text-gray-400 hover:text-indigo-500 p-1.5"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" />
                    </svg>
                  </button>
                  <button
                    onClick={() => handleDeleteMember(member.id)}
                    className="text-gray-400 hover:text-red-500 p-1.5"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                    </svg>
                  </button>
                </div>
              </div>
            ))
          )}

          {/* Life events section */}
          <div className="mt-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-gray-700">ライフイベント</h2>
              <button
                onClick={() => { setEventForm(defaultEventForm); setShowEventModal(true); }}
                className="bg-purple-600 text-white px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-purple-700 transition-colors flex items-center gap-1"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
                イベントを追加
              </button>
            </div>
            {lifeEvents.length === 0 ? (
              <div className="bg-white rounded-xl p-6 text-center shadow-sm border border-gray-100">
                <p className="text-gray-400 text-sm">イベントが登録されていません</p>
              </div>
            ) : (
              <div className="space-y-2">
                {lifeEvents.sort((a, b) => a.year - b.year).map(event => (
                  <div key={event.id} className="bg-white rounded-xl p-3 shadow-sm border border-gray-100 flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full font-medium">{event.year}年</span>
                        <span className="text-sm font-semibold text-gray-800">{event.title}</span>
                      </div>
                      {event.description && <p className="text-xs text-gray-500 mt-1">{event.description}</p>}
                      {event.amount && (
                        <p className="text-xs text-indigo-600 mt-0.5 font-medium">予算: {event.amount.toLocaleString()}円</p>
                      )}
                    </div>
                    <button
                      onClick={() => deleteLifeEvent(event.id)}
                      className="text-gray-300 hover:text-red-400 p-1 ml-2"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Life Plan Sheet tab */}
      {activeTab === 'plan' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-700">ライフプランシート (2025〜2060)</h2>
            <button
              onClick={() => { setEventForm(defaultEventForm); setShowEventModal(true); }}
              className="text-xs bg-purple-100 text-purple-700 px-3 py-1.5 rounded-lg font-medium hover:bg-purple-200 transition-colors"
            >
              + イベント追加
            </button>
          </div>

          <div className="overflow-x-auto rounded-xl shadow-sm border border-gray-100 bg-white">
            <table className="text-xs min-w-max">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="text-left px-3 py-2.5 font-semibold text-gray-600 sticky left-0 bg-gray-50 min-w-[120px] z-10">項目</th>
                  {PLAN_YEARS.map(y => (
                    <th key={y} className="px-2 py-2.5 font-semibold text-gray-500 text-center min-w-[52px] whitespace-nowrap">
                      {y}年
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {/* Family members rows */}
                {members.length > 0 && (
                  <>
                    <tr className="bg-indigo-50/50 border-b border-indigo-100">
                      <td colSpan={PLAN_YEARS.length + 1} className="px-3 py-1.5 sticky left-0 bg-indigo-50/50 z-10">
                        <span className="text-xs font-bold text-indigo-600">家族の年齢</span>
                      </td>
                    </tr>
                    {members.map(member => (
                      <tr key={member.id} className="border-b border-gray-50 hover:bg-gray-50">
                        <td className="px-3 py-2 sticky left-0 bg-white z-10 hover:bg-gray-50">
                          <p className="font-medium text-gray-700">{member.name}</p>
                          <p className="text-gray-400 text-[10px]">{member.relation}</p>
                        </td>
                        {PLAN_YEARS.map(y => {
                          const age = y - member.birthYear;
                          const isSpecial = [20, 25, 30, 40, 50, 60, 65].includes(age);
                          return (
                            <td key={y} className={`px-2 py-2 text-center ${isSpecial ? 'font-bold text-indigo-600' : 'text-gray-600'}`}>
                              {age >= 0 ? age : '-'}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </>
                )}

                {/* Life events row */}
                <tr className="border-b border-purple-100 bg-purple-50/30">
                  <td className="px-3 py-2 sticky left-0 bg-purple-50/30 z-10">
                    <p className="font-bold text-purple-600">ライフイベント</p>
                  </td>
                  {PLAN_YEARS.map(y => {
                    const events = eventsByYear[y] || [];
                    return (
                      <td key={y} className="px-1 py-2 text-center align-top">
                        {events.map(e => (
                          <div key={e.id} className="bg-purple-100 text-purple-700 rounded px-1 py-0.5 mb-0.5 text-[10px] leading-tight">
                            {e.title}
                          </div>
                        ))}
                      </td>
                    );
                  })}
                </tr>

                {/* Cash flow section */}
                <tr className="bg-gray-100 border-t-2 border-gray-300">
                  <td colSpan={PLAN_YEARS.length + 1} className="px-3 py-1.5 sticky left-0 bg-gray-100 z-10">
                    <span className="text-xs font-bold text-gray-600">キャッシュフロー</span>
                  </td>
                </tr>

                {/* Income */}
                <tr className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="px-3 py-2 sticky left-0 bg-white z-10 hover:bg-gray-50">
                    <p className="font-medium text-emerald-700">収入合計</p>
                    <p className="text-gray-400 text-[10px]">予算/実績</p>
                  </td>
                  {cashFlowWithCumulative.map(row => (
                    <td key={row.year} className="px-2 py-2 text-center text-emerald-600 font-medium">
                      {formatAmount(row.income)}
                    </td>
                  ))}
                </tr>

                {/* Expense */}
                <tr className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="px-3 py-2 sticky left-0 bg-white z-10 hover:bg-gray-50">
                    <p className="font-medium text-red-600">支出合計</p>
                  </td>
                  {cashFlowWithCumulative.map(row => (
                    <td key={row.year} className="px-2 py-2 text-center text-red-500 font-medium">
                      {formatAmount(row.expense)}
                    </td>
                  ))}
                </tr>

                {/* Investment */}
                <tr className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="px-3 py-2 sticky left-0 bg-white z-10 hover:bg-gray-50">
                    <p className="font-medium text-blue-600">投資・貯蓄</p>
                  </td>
                  {cashFlowWithCumulative.map(row => (
                    <td key={row.year} className="px-2 py-2 text-center text-blue-500 font-medium">
                      {formatAmount(row.investment)}
                    </td>
                  ))}
                </tr>

                {/* Balance */}
                <tr className="border-b border-gray-100 bg-gray-50">
                  <td className="px-3 py-2 sticky left-0 bg-gray-50 z-10">
                    <p className="font-bold text-gray-700">収支バランス</p>
                  </td>
                  {cashFlowWithCumulative.map(row => (
                    <td key={row.year} className={`px-2 py-2 text-center font-bold ${row.balance >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                      {row.balance !== 0 ? (row.balance >= 0 ? '+' : '') + formatAmount(row.balance) : '-'}
                    </td>
                  ))}
                </tr>

                {/* Cumulative */}
                <tr className="bg-indigo-50">
                  <td className="px-3 py-2.5 sticky left-0 bg-indigo-50 z-10">
                    <p className="font-bold text-indigo-700">累積残高</p>
                    <p className="text-indigo-400 text-[10px]">（繰越）</p>
                  </td>
                  {cashFlowWithCumulative.map(row => (
                    <td key={row.year} className={`px-2 py-2.5 text-center font-bold text-sm ${row.cumulative >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                      {row.cumulative !== 0 ? (row.cumulative >= 0 ? '+' : '') + formatAmount(row.cumulative) : '-'}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>

          {members.length === 0 && (
            <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-3 flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 text-indigo-500 shrink-0">
                <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
              </svg>
              <p className="text-sm text-indigo-700">「家族設定」タブからメンバーを追加すると年齢推移が表示されます</p>
            </div>
          )}
        </div>
      )}

      {/* Member modal */}
      {showMemberModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end md:items-center justify-center p-0 md:p-4">
          <div className="bg-white w-full md:max-w-md rounded-t-2xl md:rounded-2xl">
            <div className="flex items-center justify-between p-4 border-b border-gray-100">
              <h2 className="text-base font-semibold text-gray-800">
                {editingMemberId ? 'メンバーを編集' : 'メンバーを追加'}
              </h2>
              <button onClick={() => { setShowMemberModal(false); setEditingMemberId(null); }} className="text-gray-400 hover:text-gray-600">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">名前</label>
                <input
                  type="text"
                  value={memberForm.name}
                  onChange={e => setMemberForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="例：太郎、花子"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">続柄</label>
                <div className="flex gap-2 flex-wrap">
                  {RELATIONS.map(r => (
                    <button
                      key={r}
                      onClick={() => setMemberForm(f => ({ ...f, relation: r }))}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                        memberForm.relation === r
                          ? 'bg-indigo-600 text-white border-indigo-600'
                          : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      {r}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">生まれ年</label>
                <select
                  value={memberForm.birthYear}
                  onChange={e => setMemberForm(f => ({ ...f, birthYear: Number(e.target.value) }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  {BIRTH_YEARS.map(y => (
                    <option key={y} value={y}>{y}年（{new Date().getFullYear() - y}歳）</option>
                  ))}
                </select>
              </div>
              <button
                onClick={handleAddMember}
                disabled={!memberForm.name.trim()}
                className="w-full bg-indigo-600 text-white py-3 rounded-xl font-medium hover:bg-indigo-700 transition-colors disabled:opacity-50"
              >
                {editingMemberId ? '更新する' : '追加する'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Event modal */}
      {showEventModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end md:items-center justify-center p-0 md:p-4">
          <div className="bg-white w-full md:max-w-md rounded-t-2xl md:rounded-2xl">
            <div className="flex items-center justify-between p-4 border-b border-gray-100">
              <h2 className="text-base font-semibold text-gray-800">ライフイベントを追加</h2>
              <button onClick={() => setShowEventModal(false)} className="text-gray-400 hover:text-gray-600">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">年</label>
                <select
                  value={eventForm.year}
                  onChange={e => setEventForm(f => ({ ...f, year: Number(e.target.value) }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  {PLAN_YEARS.map(y => <option key={y} value={y}>{y}年</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">イベント名</label>
                <input
                  type="text"
                  value={eventForm.title}
                  onChange={e => setEventForm(f => ({ ...f, title: e.target.value }))}
                  placeholder="例：マイホーム購入、子供誕生など"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">説明（任意）</label>
                <input
                  type="text"
                  value={eventForm.description}
                  onChange={e => setEventForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="詳細メモ"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">概算費用（任意・円）</label>
                <input
                  type="number"
                  value={eventForm.amount}
                  onChange={e => setEventForm(f => ({ ...f, amount: e.target.value }))}
                  placeholder="例：3000000"
                  min="0"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <button
                onClick={handleAddEvent}
                disabled={!eventForm.title.trim()}
                className="w-full bg-purple-600 text-white py-3 rounded-xl font-medium hover:bg-purple-700 transition-colors disabled:opacity-50"
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
