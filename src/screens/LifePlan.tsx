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
  memberId: string;
}

const defaultEventForm: EventForm = {
  year: new Date().getFullYear(),
  title: '',
  description: '',
  amount: '',
  memberId: ''
};

export default function LifePlan() {
  const { currentProfile, updateProfile, lifeEvents, addLifeEvent, updateLifeEvent, transactions, budgets } = useApp();
  const [showMemberModal, setShowMemberModal] = useState(false);
  const [showEventModal, setShowEventModal] = useState(false);
  const [memberForm, setMemberForm] = useState<MemberForm>(defaultMemberForm);
  const [editingMemberId, setEditingMemberId] = useState<string | null>(null);
  const [eventForm, setEventForm] = useState<EventForm>(defaultEventForm);
  const [editingEventId, setEditingEventId] = useState<string | null>(null);

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

  function handleAddEvent() {
    if (!eventForm.title.trim() || !currentProfile) return;
    const eventData = {
      profileId: currentProfile.id,
      year: eventForm.year,
      title: eventForm.title.trim(),
      description: eventForm.description.trim() || undefined,
      amount: eventForm.amount ? Number(eventForm.amount) : undefined,
      memberId: eventForm.memberId || undefined
    };
    if (editingEventId) {
      updateLifeEvent({ ...eventData, id: editingEventId });
    } else {
      addLifeEvent(eventData);
    }
    setShowEventModal(false);
    setEventForm(defaultEventForm);
    setEditingEventId(null);
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
    <div className="p-4 w-full space-y-4">

      {/* ===== FAMILY MEMBERS & EVENTS: buttons only ===== */}
      <div className="flex gap-2">
        <button
          onClick={() => { setMemberForm(defaultMemberForm); setEditingMemberId(null); setShowMemberModal(true); }}
          className="flex-1 bg-indigo-600 text-white px-3 py-2.5 rounded-xl text-sm font-medium hover:bg-indigo-700 transition-colors flex items-center justify-center gap-1.5"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          メンバーを追加
        </button>
        <button
          onClick={() => { setEventForm(defaultEventForm); setEditingEventId(null); setShowEventModal(true); }}
          className="flex-1 bg-purple-600 text-white px-3 py-2.5 rounded-xl text-sm font-medium hover:bg-purple-700 transition-colors flex items-center justify-center gap-1.5"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          イベントを追加
        </button>
      </div>
      {/* ===== CASHFLOW TABLE ===== */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-gray-700">キャッシュフロー表 (2025〜2060)</h2>
        <div className="overflow-x-auto rounded-xl shadow-sm border border-gray-100 bg-white">
          <table className="text-xs min-w-max">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="text-left px-3 py-2.5 font-semibold text-gray-600 sticky left-0 bg-gray-50 min-w-[120px] z-10">項目</th>
                {PLAN_YEARS.map(y => (
                  <th key={y} className="px-2 py-2.5 font-semibold text-gray-500 text-center min-w-[52px] whitespace-nowrap">{y}年</th>
                ))}
              </tr>
            </thead>
            <tbody>
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
              <tr className="border-b border-purple-100 bg-purple-50/30">
                <td className="px-3 py-2 sticky left-0 bg-purple-50/30 z-10">
                  <p className="font-bold text-purple-600">ライフイベント</p>
                </td>
                {PLAN_YEARS.map(y => {
                  const events = eventsByYear[y] || [];
                  return (
                    <td key={y} className="px-1 py-2 text-center align-top">
                      {events.map(e => (
                        <div key={e.id} className="bg-purple-100 text-purple-700 rounded px-1 py-0.5 mb-0.5 text-[10px] leading-tight">{e.title}</div>
                      ))}
                    </td>
                  );
                })}
              </tr>
              <tr className="bg-gray-100 border-t-2 border-gray-300">
                <td colSpan={PLAN_YEARS.length + 1} className="px-3 py-1.5 sticky left-0 bg-gray-100 z-10">
                  <span className="text-xs font-bold text-gray-600">キャッシュフロー</span>
                </td>
              </tr>
              <tr className="border-b border-gray-50 hover:bg-gray-50">
                <td className="px-3 py-2 sticky left-0 bg-white z-10 hover:bg-gray-50">
                  <p className="font-medium text-blue-700">収入合計</p>
                  <p className="text-gray-400 text-[10px]">予算/実績</p>
                </td>
                {cashFlowWithCumulative.map(row => (
                  <td key={row.year} className="px-2 py-2 text-center text-blue-600 font-medium">{formatAmount(row.income)}</td>
                ))}
              </tr>
              <tr className="border-b border-gray-50 hover:bg-gray-50">
                <td className="px-3 py-2 sticky left-0 bg-white z-10 hover:bg-gray-50">
                  <p className="font-medium text-red-600">支出合計</p>
                </td>
                {cashFlowWithCumulative.map(row => (
                  <td key={row.year} className="px-2 py-2 text-center text-red-500 font-medium">{formatAmount(row.expense)}</td>
                ))}
              </tr>
              <tr className="border-b border-gray-50 hover:bg-gray-50">
                <td className="px-3 py-2 sticky left-0 bg-white z-10 hover:bg-gray-50">
                  <p className="font-medium text-gray-600">投資・貯蓄</p>
                </td>
                {cashFlowWithCumulative.map(row => (
                  <td key={row.year} className="px-2 py-2 text-center text-gray-500 font-medium">{formatAmount(row.investment)}</td>
                ))}
              </tr>
              <tr className="border-b border-gray-100 bg-gray-50">
                <td className="px-3 py-2 sticky left-0 bg-gray-50 z-10">
                  <p className="font-bold text-gray-700">収支バランス</p>
                </td>
                {cashFlowWithCumulative.map(row => (
                  <td key={row.year} className={`px-2 py-2 text-center font-bold ${row.balance >= 0 ? 'text-gray-800' : 'text-red-500'}`}>
                    {row.balance !== 0 ? (row.balance >= 0 ? '+' : '') + formatAmount(row.balance) : '-'}
                  </td>
                ))}
              </tr>
              <tr className="bg-indigo-50">
                <td className="px-3 py-2.5 sticky left-0 bg-indigo-50 z-10">
                  <p className="font-bold text-indigo-700">累積残高</p>
                  <p className="text-indigo-400 text-[10px]">（繰越）</p>
                </td>
                {cashFlowWithCumulative.map(row => (
                  <td key={row.year} className={`px-2 py-2.5 text-center font-bold text-sm ${row.cumulative >= 0 ? 'text-gray-800' : 'text-red-600'}`}>
                    {row.cumulative !== 0 ? (row.cumulative >= 0 ? '+' : '') + formatAmount(row.cumulative) : '-'}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </div>

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
              <h2 className="text-base font-semibold text-gray-800">
                {editingEventId ? 'ライフイベントを編集' : 'ライフイベントを追加'}
              </h2>
              <button onClick={() => { setShowEventModal(false); setEditingEventId(null); }} className="text-gray-400 hover:text-gray-600">
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
                <label className="block text-xs font-medium text-gray-600 mb-1.5">対象メンバー</label>
                <select
                  value={eventForm.memberId}
                  onChange={e => setEventForm(f => ({ ...f, memberId: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">全員</option>
                  {members.map(m => (
                    <option key={m.id} value={m.id}>{m.name}</option>
                  ))}
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
                {editingEventId ? '更新する' : '追加する'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
