import { useState } from 'react';
import { CategoryConfig, CategoryNode, getCategoryConfig, saveCategoryConfig } from '../lib/categoryConfig';

interface Props {
  onClose: () => void;
}

type CTab = 'income' | 'expense' | 'investment';

export default function CategorySettings({ onClose }: Props) {
  const [config, setConfig] = useState<CategoryConfig>(getCategoryConfig());
  const [tab, setTab] = useState<CTab>('expense');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [newMajorName, setNewMajorName] = useState('');
  const [newMinorName, setNewMinorName] = useState<Record<string, string>>({});

  const nodes: CategoryNode[] = config[tab];

  function saveConfig(next: CategoryConfig) {
    setConfig(next);
    saveCategoryConfig(next);
  }

  function addMajor() {
    const name = newMajorName.trim();
    if (!name) return;
    const id = `${tab}-${Date.now()}`;
    saveConfig({ ...config, [tab]: [...nodes, { id, name, subcategories: [] }] });
    setNewMajorName('');
  }

  function deleteMajor(id: string) {
    saveConfig({ ...config, [tab]: nodes.filter(n => n.id !== id) });
  }

  function renameMajor(id: string, name: string) {
    saveConfig({ ...config, [tab]: nodes.map(n => n.id === id ? { ...n, name } : n) });
  }

  function addMinor(nodeId: string) {
    const name = (newMinorName[nodeId] ?? '').trim();
    if (!name) return;
    saveConfig({
      ...config,
      [tab]: nodes.map(n => n.id === nodeId ? { ...n, subcategories: [...n.subcategories, name] } : n),
    });
    setNewMinorName(prev => ({ ...prev, [nodeId]: '' }));
  }

  function deleteMinor(nodeId: string, sub: string) {
    saveConfig({
      ...config,
      [tab]: nodes.map(n => n.id === nodeId ? { ...n, subcategories: n.subcategories.filter(s => s !== sub) } : n),
    });
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
            {expandedId === node.id && (
              <div className="px-3 py-2 space-y-1.5 bg-white">
                {node.subcategories.map(sub => (
                  <div key={sub} className="flex items-center justify-between py-1 border-b border-gray-100">
                    <span className="text-sm text-gray-700">{sub}</span>
                    <button onClick={() => deleteMinor(node.id, sub)} className="text-red-400 text-xs">削除</button>
                  </div>
                ))}
                <div className="flex gap-2 pt-1">
                  <input
                    type="text"
                    placeholder="中分類を追加"
                    value={newMinorName[node.id] ?? ''}
                    onChange={e => setNewMinorName(prev => ({ ...prev, [node.id]: e.target.value }))}
                    className="flex-1 text-sm border border-gray-300 rounded-lg px-2 py-1.5"
                    onKeyDown={e => e.key === 'Enter' && addMinor(node.id)}
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
            onKeyDown={e => e.key === 'Enter' && addMajor()}
          />
          <button onClick={addMajor} className="bg-indigo-600 text-white text-sm px-4 py-2 rounded-xl">追加</button>
        </div>
      </div>
    </div>
  );
}
