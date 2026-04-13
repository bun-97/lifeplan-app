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
  const [editingMinor, setEditingMinor] = useState<{ nodeId: string; subName: string; value: string } | null>(null);
  const [pendingChange, setPendingChange] = useState<{
    nodeId: string;
    subName?: string;
    field: 'expenseType' | 'budgetType';
    value: string;
    newConfig: CategoryConfig;
  } | null>(null);

  const majorComposingRef = useRef(false);
  const minorComposingRef = useRef(false);
  const renameComposingRef = useRef(false);

  const nodes: CategoryNode[] = config[tab];

  // ④ When expanding a node with no subcategories, auto-create one with the same name
  function handleExpand(nodeId: string) {
    if (expandedId === nodeId) {
      setExpandedId(null);
      return;
    }
    setExpandedId(nodeId);
    const node = config[tab].find(n => n.id === nodeId);
    if (node && node.subcategories.length === 0) {
      const newSub: SubcategoryNode = {
        name: node.name,
        expenseType: tab === 'expense' ? node.expenseType : undefined,
        budgetType: tab === 'income' ? node.budgetType : undefined,
      };
      const newConfig = {
        ...config,
        [tab]: config[tab].map(n => n.id === nodeId ? { ...n, subcategories: [newSub] } : n),
      };
      setConfig(newConfig);
      saveCategoryConfig(newConfig);
    }
  }

  function applyTypeChange(
    nodeId: string,
    subName: string | undefined,
    field: 'expenseType' | 'budgetType',
    value: string,
    newConfig: CategoryConfig
  ) {
    setConfig(newConfig);
    saveCategoryConfig(newConfig);
    setPendingChange({ nodeId, subName, field, value, newConfig });
  }

  function confirmRetroactive() {
    if (!pendingChange) return;
    const { subName, field, value, newConfig } = pendingChange;
    const node = newConfig[tab].find(n => n.id === pendingChange.nodeId);
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

  function saveRenameMinor() {
    if (!editingMinor) return;
    const { nodeId, subName, value } = editingMinor;
    const newName = value.trim();
    if (!newName || newName === subName) { setEditingMinor(null); return; }
    const newConfig = {
      ...config,
      [tab]: nodes.map(n => n.id === nodeId ? {
        ...n,
        subcategories: n.subcategories.map(s => s.name === subName ? { ...s, name: newName } : s)
      } : n),
    };
    setConfig(newConfig);
    saveCategoryConfig(newConfig);
    setEditingMinor(null);
  }

  // ① 一括設定: applied from expanded section, sets all subcategories
  function applyBulkSet(nodeId: string, value: string) {
    if (!value) return;
    const field = tab === 'income' ? 'budgetType' : 'expenseType';
    const newConfig = {
      ...config,
      [tab]: config[tab].map(n => n.id === nodeId ? {
        ...n,
        subcategories: n.subcategories.map(s => ({ ...s, [field]: value }))
      } : n)
    };
    applyTypeChange(nodeId, undefined, field as 'expenseType' | 'budgetType', value, newConfig);
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

  const TYPE_OPTIONS_EXPENSE = ['毎月固定', '毎月変動', '不定期固定', '不定期変動'];
  const TYPE_OPTIONS_INCOME = ['予算内', '予算外'];

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
            {/* Major category header — ② income badge removed, ① 一括設定 button removed */}
            <div className="flex items-center px-3 py-2.5 bg-gray-50">
              <button
                className="flex-1 text-left text-sm font-medium text-gray-800"
                onClick={() => handleExpand(node.id)}
              >
                {node.name}
                <span className="ml-2 text-xs text-gray-400">
                  {node.subcategories.length > 0 ? `(${node.subcategories.length})` : ''}
                </span>
              </button>
              {/* ② expense badge kept as reference-only, income badge removed */}
              {tab === 'expense' && node.expenseType && (
                <span className="text-xs px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-600 mr-1">
                  {node.expenseType}
                </span>
              )}
              <button
                onClick={() => {
                  const newName = window.prompt('大分類名を変更', node.name);
                  if (newName && newName.trim()) renameMajor(node.id, newName.trim());
                }}
                className="text-gray-400 text-xs px-2"
              >編集</button>
              <button onClick={() => deleteMajor(node.id)} className="text-red-400 text-xs px-2">削除</button>
              <span
                className="text-gray-400 text-xs cursor-pointer"
                onClick={() => handleExpand(node.id)}
              >{expandedId === node.id ? '▲' : '▼'}</span>
            </div>

            {expandedId === node.id && (
              <div className="px-3 py-2 space-y-1.5 bg-white">
                {/* ① 一括設定 row (replaces the old major expenseType/budgetType row) */}
                {(tab === 'expense' || tab === 'income') && (
                  <div className="flex items-center gap-2 pb-2 border-b border-gray-100">
                    <span className="text-xs text-gray-500 shrink-0">一括設定:</span>
                    <select
                      defaultValue=""
                      onChange={e => { if (e.target.value) { applyBulkSet(node.id, e.target.value); e.target.value = ''; } }}
                      className="text-xs border border-indigo-200 rounded-lg px-2 py-1 bg-white flex-1 text-indigo-700"
                    >
                      <option value="">分類を選んで全中分類に適用</option>
                      {(tab === 'expense' ? TYPE_OPTIONS_EXPENSE : TYPE_OPTIONS_INCOME).map(opt => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                    </select>
                  </div>
                )}

                {/* ③ Subcategory rows with edit button */}
                {node.subcategories.map((sub, si) => (
                  <div key={sub.name} className="border-b border-gray-100">
                    {editingMinor?.nodeId === node.id && editingMinor.subName === sub.name ? (
                      /* Inline rename input */
                      <div className="flex items-center gap-2 py-1.5">
                        <input
                          type="text"
                          value={editingMinor.value}
                          autoFocus
                          onChange={e => setEditingMinor(prev => prev ? { ...prev, value: e.target.value } : null)}
                          onCompositionStart={() => { renameComposingRef.current = true; }}
                          onCompositionEnd={() => { renameComposingRef.current = false; }}
                          onKeyDown={e => {
                            if (e.key === 'Enter' && !renameComposingRef.current) saveRenameMinor();
                            if (e.key === 'Escape') setEditingMinor(null);
                          }}
                          className="flex-1 text-sm border border-indigo-300 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                        />
                        <button onClick={saveRenameMinor} className="text-indigo-600 text-xs font-medium">保存</button>
                        <button onClick={() => setEditingMinor(null)} className="text-gray-400 text-xs">✕</button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 py-1.5">
                        <span className="text-sm text-gray-700 flex-1">{sub.name}</span>
                        {tab === 'expense' && (
                          <select
                            value={sub.expenseType ?? ''}
                            onChange={e => handleSubExpenseTypeChange(node.id, si, e.target.value)}
                            className="text-xs border border-gray-200 rounded-lg px-1.5 py-1 bg-white"
                          >
                            <option value="">－</option>
                            {TYPE_OPTIONS_EXPENSE.map(opt => (
                              <option key={opt} value={opt}>{opt}</option>
                            ))}
                          </select>
                        )}
                        {tab === 'income' && (
                          <select
                            value={sub.budgetType ?? ''}
                            onChange={e => handleSubBudgetTypeChange(node.id, si, e.target.value)}
                            className="text-xs border border-gray-200 rounded-lg px-1.5 py-1 bg-white"
                          >
                            <option value="">－</option>
                            {TYPE_OPTIONS_INCOME.map(opt => (
                              <option key={opt} value={opt}>{opt}</option>
                            ))}
                          </select>
                        )}
                        {/* ③ Edit button */}
                        <button
                          onClick={() => setEditingMinor({ nodeId: node.id, subName: sub.name, value: sub.name })}
                          className="text-gray-400 text-xs hover:text-indigo-500"
                        >編集</button>
                        <button onClick={() => deleteMinor(node.id, sub.name)} className="text-red-400 text-xs">削除</button>
                      </div>
                    )}
                  </div>
                ))}

                {/* Add minor */}
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

      {/* ③ Retroactive apply confirmation */}
      {pendingChange && (
        <div className="fixed inset-0 bg-black/50 z-[60] flex items-end justify-center">
          <div className="bg-white rounded-t-2xl w-full p-4 space-y-3">
            <h3 className="font-semibold text-gray-800 text-sm">既存の明細にも反映しますか？</h3>
            <p className="text-xs text-gray-500">
              「{pendingChange.newConfig[tab].find(n => n.id === pendingChange.nodeId)?.name}
              {pendingChange.subName ? ` ＞ ${pendingChange.subName}` : ' の全中分類'}」の
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
