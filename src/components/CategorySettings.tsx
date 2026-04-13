import { useState, useRef } from 'react';
import { CategoryConfig, CategoryNode, SubcategoryNode, getCategoryConfig, saveCategoryConfig } from '../lib/categoryConfig';
import { useApp } from '../contexts/AppContext';

interface Props {
  onClose: () => void;
}

type CTab = 'income' | 'expense' | 'investment';

export default function CategorySettings({ onClose }: Props) {
  const { transactions, updateTransaction } = useApp();
  const [config, setConfig] = useState<CategoryConfig>(getCategoryConfig());
  const [tab, setTab] = useState<CTab>('expense');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [newMajorName, setNewMajorName] = useState('');
  const [newMinorName, setNewMinorName] = useState<Record<string, string>>({});
  const [bulkSetId, setBulkSetId] = useState<string | null>(null);
  const [bulkSetValue, setBulkSetValue] = useState('');
  const [pendingChange, setPendingChange] = useState<{
    nodeId: string;
    subName?: string;
    field: 'expenseType' | 'budgetType';
    value: string;
  } | null>(null);

  const majorComposingRef = useRef(false);
  const minorComposingRef = useRef(false);

  const nodes: CategoryNode[] = config[tab];

  function applyTypeChange(nodeId: string, subName: string | undefined, field: 'expenseType' | 'budgetType', value: string, newConfig: CategoryConfig) {
    setConfig(newConfig);
    saveCategoryConfig(newConfig);
    setPendingChange({ nodeId, subName, field, value });
  }

  function confirmRetroactive() {
    if (!pendingChange) return;
    const { subName, field, value } = pendingChange;
    const node = config[tab].find(n => n.id === pendingChange.nodeId);
    if (!node) { setPendingChange(null); return; }

    transactions.forEach(t => {
      const subcategoryMatches = t.subcategory === node.name;
      const minorMatches = subName ? t.minorCategory === subName : true;

      if (subcategoryMatches && minorMatches) {
        updateTransaction({ ...t, [field]: value || undefined });
      }
    });

    setPendingChange(null);
  }

  function addMajor() {
    const name = newMajorName.trim();
    if (!name) return;
    const id = `${tab}-${Date.now()}`;
    const newConfig = { ...config, [tab]: [...nodes, { id, name, subcategories: [] }] };
    setConfig(newConfig);
    saveCategoryConfig(newConfig);
    setNewMajorName('');
  }

  function deleteMajor(id: string) {
    const newConfig = { ...config, [tab]: nodes.filter(n => n.id !== id) };
    setConfig(newConfig);
    saveCategoryConfig(newConfig);
  }

  function renameMajor(id: string, name: string) {
    const newConfig = { ...config, [tab]: nodes.map(n => n.id === id ? { ...n, name } : n) };
    setConfig(newConfig);
    saveCategoryConfig(newConfig);
  }

  function addMinor(nodeId: string) {
    const name = (newMinorName[nodeId] ?? '').trim();
    if (!name) return;
    const parent = nodes.find(n => n.id === nodeId);
    const newSub: SubcategoryNode = {
      name,
      expenseType: tab === 'expense' ? parent?.expenseType : undefined,
      budgetType: tab === 'income' ? parent?.budgetType : undefined,
    };
    const newConfig = {
      ...config,
      [tab]: nodes.map(n => n.id === nodeId ? { ...n, subcategories: [...n.subcategories, newSub] } : n),
    };
    setConfig(newConfig);
    saveCategoryConfig(newConfig);
    setNewMinorName(prev => ({ ...prev, [nodeId]: '' }));
  }

  function deleteMinor(nodeId: string, subName: string) {
    const newConfig = {
      ...config,
      [tab]: nodes.map(n => n.id === nodeId ? { ...n, subcategories: n.subcategories.filter(s => s.name !== subName) } : n),
    };
    setConfig(newConfig);
    saveCategoryConfig(newConfig);
  }

  function handleMajorExpenseTypeChange(nodeId: string, value: string) {
    const newConfig = {
      ...config,
      [tab]: config[tab].map(n => n.id === nodeId ? { ...n, expenseType: (value as CategoryNode['expenseType']) || undefined } : n),
    };
    applyTypeChange(nodeId, undefined, 'expenseType', value, newConfig);
  }

  function handleMajorBudgetTypeChange(nodeId: string, value: string) {
    const newConfig = {
      ...config,
      [tab]: config[tab].map(n => n.id === nodeId ? { ...n, budgetType: (value as CategoryNode['budgetType']) || undefined } : n),
    };
    applyTypeChange(nodeId, undefined, 'budgetType', value, newConfig);
  }

  function handleSubExpenseTypeChange(nodeId: string, subIndex: number, value: string) {
    const newConfig = {
      ...config,
      [tab]: config[tab].map(n => n.id === nodeId ? {
        ...n,
        subcategories: n.subcategories.map((s, i) =>
          i === subIndex ? { ...s, expenseType: (value as SubcategoryNode['expenseType']) || undefined } : s
        )
      } : n)
    };
    const node = config[tab].find(n => n.id === nodeId);
    const subName = node?.subcategories[subIndex]?.name;
    applyTypeChange(nodeId, subName, 'expenseType', value, newConfig);
  }

  function handleSubBudgetTypeChange(nodeId: string, subIndex: number, value: string) {
    const newConfig = {
      ...config,
      [tab]: config[tab].map(n => n.id === nodeId ? {
        ...n,
        subcategories: n.subcategories.map((s, i) =>
          i === subIndex ? { ...s, budgetType: (value as SubcategoryNode['budgetType']) || undefined } : s
        )
      } : n)
    };
    const node = config[tab].find(n => n.id === nodeId);
    const subName = node?.subcategories[subIndex]?.name;
    applyTypeChange(nodeId, subName, 'budgetType', value, newConfig);
  }

  function applyBulkSet(nodeId: string) {
    if (!bulkSetValue) return;
    const field = tab === 'income' ? 'budgetType' : 'expenseType';
    const newConfig = {
      ...config,
      [tab]: config[tab].map(n => n.id === nodeId ? {
        ...n,
        subcategories: n.subcategories.map(s => ({
          ...s,
          [field]: bulkSetValue,
        }))
      } : n)
    };
    applyTypeChange(nodeId, undefined, field as 'expenseType' | 'budgetType', bulkSetValue, newConfig);
    setBulkSetId(null);
    setBulkSetValue('');
  }

  const TAB_LABELS: Record<CTab, string> = { income: '収入', expense: '支出', investment: '投資・貯金' };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-white">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
        <h2 className="text-base font-semibold text-gray-800">カテゴリ設定</h2>
        <button onClick={onClose} className="text-gray-500 text-xl font-bold">✕</button>
      </div>
      {/* Tabs */}
      <div className="flex border-b border-gray-200">
        {(Object.keys(TAB_LABELS) as CTab[]).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-2 text-sm font-medium ${tab === t ? 'border-b-2 border-indigo-600 text-indigo-600' : 'text-gray-500'}`}
          >
            {TAB_LABELS[t]}
          </button>
        ))}
      </div>
      {/* List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {nodes.map(node => (
          <div key={node.id} className="border border-gray-200 rounded-xl overflow-hidden">
            <div className="flex items-center px-3 py-2.5 bg-gray-50">
              <button
                className="flex-1 text-left text-sm font-medium text-gray-800"
                onClick={() => setExpandedId(expandedId === node.id ? null : node.id)}
              >
                {node.name}
                <span className="ml-2 text-xs text-gray-400">{node.subcategories.length > 0 ? `(${node.subcategories.length})` : ''}</span>
              </button>
              {tab === 'expense' && node.expenseType && (
                <span className="text-xs px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-600 mr-1">{node.expenseType}</span>
              )}
              {tab === 'income' && node.budgetType && (
                <span className={`text-xs px-1.5 py-0.5 rounded-full mr-1 ${node.budgetType === '予算内' ? 'bg-green-50 text-green-600' : 'bg-orange-50 text-orange-600'}`}>{node.budgetType}</span>
              )}
              <button
                onClick={e => { e.stopPropagation(); setBulkSetId(node.id); setBulkSetValue(''); }}
                className="text-xs text-indigo-500 px-2 hover:underline"
              >一括設定</button>
              <button
                onClick={() => {
                  const newName = window.prompt('大分類名を変更', node.name);
                  if (newName && newName.trim()) renameMajor(node.id, newName.trim());
                }}
                className="text-gray-400 text-xs px-2"
              >
                編集
              </button>
              <button onClick={() => deleteMajor(node.id)} className="text-red-400 text-xs px-2">削除</button>
              <span className="text-gray-400 text-xs">{expandedId === node.id ? '▲' : '▼'}</span>
            </div>
            {bulkSetId === node.id && (
              <div className="flex items-center gap-2 px-3 py-2 bg-indigo-50 border-t border-indigo-100">
                <span className="text-xs text-indigo-700 shrink-0">中分類を一括:</span>
                <select
                  value={bulkSetValue}
                  onChange={e => setBulkSetValue(e.target.value)}
                  className="flex-1 text-xs border border-indigo-200 rounded-lg px-2 py-1.5 bg-white"
                >
                  <option value="">選択してください</option>
                  {tab === 'expense' && <>
                    <option value="毎月固定">毎月固定</option>
                    <option value="毎月変動">毎月変動</option>
                    <option value="不定期固定">不定期固定</option>
                    <option value="不定期変動">不定期変動</option>
                  </>}
                  {tab === 'income' && <>
                    <option value="予算内">予算内</option>
                    <option value="予算外">予算外</option>
                  </>}
                </select>
                <button
                  onClick={() => applyBulkSet(node.id)}
                  disabled={!bulkSetValue}
                  className="text-xs bg-indigo-600 text-white px-3 py-1.5 rounded-lg disabled:opacity-40"
                >適用</button>
                <button onClick={() => setBulkSetId(null)} className="text-xs text-gray-500">✕</button>
              </div>
            )}
            {expandedId === node.id && (
              <div className="px-3 py-2 space-y-1.5 bg-white">
                {tab === 'expense' && (
                  <div className="flex items-center gap-2 pb-2 border-b border-gray-100">
                    <span className="text-xs text-gray-500 shrink-0">支出分類:</span>
                    <select
                      value={node.expenseType ?? ''}
                      onChange={e => handleMajorExpenseTypeChange(node.id, e.target.value)}
                      className="text-xs border border-gray-200 rounded-lg px-2 py-1 bg-white flex-1"
                    >
                      <option value="">未設定</option>
                      <option value="毎月固定">毎月固定</option>
                      <option value="毎月変動">毎月変動</option>
                      <option value="不定期固定">不定期固定</option>
                      <option value="不定期変動">不定期変動</option>
                    </select>
                  </div>
                )}
                {tab === 'income' && (
                  <div className="flex items-center gap-2 pb-2 border-b border-gray-100">
                    <span className="text-xs text-gray-500 shrink-0">予算区分:</span>
                    <select
                      value={node.budgetType ?? ''}
                      onChange={e => handleMajorBudgetTypeChange(node.id, e.target.value)}
                      className="text-xs border border-gray-200 rounded-lg px-2 py-1 bg-white flex-1"
                    >
                      <option value="">未設定</option>
                      <option value="予算内">予算内</option>
                      <option value="予算外">予算外</option>
                    </select>
                  </div>
                )}
                {node.subcategories.map((sub, si) => (
                  <div key={sub.name} className="flex items-center gap-2 py-1.5 border-b border-gray-100">
                    <span className="text-sm text-gray-700 flex-1">{sub.name}</span>
                    {tab === 'expense' && (
                      <select
                        value={sub.expenseType ?? ''}
                        onChange={e => handleSubExpenseTypeChange(node.id, si, e.target.value)}
                        className="text-xs border border-gray-200 rounded-lg px-1.5 py-1 bg-white"
                      >
                        <option value="">－</option>
                        <option value="毎月固定">毎月固定</option>
                        <option value="毎月変動">毎月変動</option>
                        <option value="不定期固定">不定期固定</option>
                        <option value="不定期変動">不定期変動</option>
                      </select>
                    )}
                    {tab === 'income' && (
                      <select
                        value={sub.budgetType ?? ''}
                        onChange={e => handleSubBudgetTypeChange(node.id, si, e.target.value)}
                        className="text-xs border border-gray-200 rounded-lg px-1.5 py-1 bg-white"
                      >
                        <option value="">－</option>
                        <option value="予算内">予算内</option>
                        <option value="予算外">予算外</option>
                      </select>
                    )}
                    <button onClick={() => deleteMinor(node.id, sub.name)} className="text-red-400 text-xs shrink-0">削除</button>
                  </div>
                ))}
                <div className="flex gap-2 pt-1">
                  <input
                    type="text"
                    placeholder="中分類を追加"
                    value={newMinorName[node.id] ?? ''}
                    onChange={e => setNewMinorName(prev => ({ ...prev, [node.id]: e.target.value }))}
                    className="flex-1 text-sm border border-gray-300 rounded-lg px-2 py-1.5"
                    onCompositionStart={() => { minorComposingRef.current = true; }}
                    onCompositionEnd={() => { minorComposingRef.current = false; }}
                    onKeyDown={e => { if (e.key === 'Enter' && !minorComposingRef.current) { addMinor(node.id); } }}
                  />
                  <button onClick={() => addMinor(node.id)} className="text-sm bg-indigo-100 text-indigo-700 px-3 py-1.5 rounded-lg">追加</button>
                </div>
              </div>
            )}
          </div>
        ))}
        {/* Add major */}
        <div className="flex gap-2 pt-2">
          <input
            type="text"
            placeholder="大分類を追加"
            value={newMajorName}
            onChange={e => setNewMajorName(e.target.value)}
            className="flex-1 text-sm border border-gray-300 rounded-xl px-3 py-2"
            onCompositionStart={() => { majorComposingRef.current = true; }}
            onCompositionEnd={() => { majorComposingRef.current = false; }}
            onKeyDown={e => { if (e.key === 'Enter' && !majorComposingRef.current) { addMajor(); } }}
          />
          <button onClick={addMajor} className="bg-indigo-600 text-white text-sm px-4 py-2 rounded-xl">追加</button>
        </div>
      </div>

      {/* Retroactive apply confirmation dialog */}
      {pendingChange && (
        <div className="fixed inset-0 bg-black/50 z-[60] flex items-end justify-center">
          <div className="bg-white rounded-t-2xl w-full p-4 space-y-3">
            <h3 className="font-semibold text-gray-800 text-sm">既存の明細にも反映しますか？</h3>
            <p className="text-xs text-gray-500">
              「{config[tab].find(n => n.id === pendingChange.nodeId)?.name}
              {pendingChange.subName ? ` ＞ ${pendingChange.subName}` : ''}」の
              分類を「{pendingChange.value}」に変更しました。
            </p>
            <p className="text-xs text-gray-500">過去の明細データにも一括で反映しますか？</p>
            <div className="flex gap-2">
              <button onClick={() => setPendingChange(null)} className="flex-1 py-2.5 border border-gray-300 rounded-xl text-sm text-gray-700">
                今後の明細のみ
              </button>
              <button onClick={confirmRetroactive} className="flex-1 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-medium">
                既存にも反映する
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
