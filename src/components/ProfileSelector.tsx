import { useState } from 'react';
import { useApp } from '../contexts/AppContext';

export default function ProfileSelector() {
  const { profiles, currentProfile, setCurrentProfile, createProfile, deleteProfile } = useApp();
  const [open, setOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);

  function handleCreate() {
    if (!newName.trim()) return;
    createProfile(newName.trim());
    setNewName('');
    setCreating(false);
    setOpen(false);
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-3 py-1.5 bg-indigo-50 rounded-lg text-sm font-medium text-indigo-700 hover:bg-indigo-100 transition-colors"
      >
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
        </svg>
        <span className="max-w-[100px] truncate">{currentProfile?.name || 'プロファイル未選択'}</span>
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-3 h-3">
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
        </svg>
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 mt-1 w-64 bg-white rounded-xl shadow-lg border border-gray-200 z-50 overflow-hidden">
            <div className="p-3 border-b border-gray-100">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">プロファイル</p>
            </div>
            <div className="max-h-60 overflow-y-auto">
              {profiles.map(p => (
                <div key={p.id} className="flex items-center px-3 py-2 hover:bg-gray-50">
                  <button
                    className={`flex-1 text-left text-sm ${p.id === currentProfile?.id ? 'font-semibold text-indigo-600' : 'text-gray-700'}`}
                    onClick={() => { setCurrentProfile(p); setOpen(false); }}
                  >
                    {p.id === currentProfile?.id && <span className="mr-1">✓</span>}
                    {p.name}
                  </button>
                  {profiles.length > 1 && (
                    <button
                      onClick={() => deleteProfile(p.id)}
                      className="text-gray-400 hover:text-red-500 p-1"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                      </svg>
                    </button>
                  )}
                </div>
              ))}
            </div>
            <div className="p-3 border-t border-gray-100">
              {creating ? (
                <div className="flex gap-2">
                  <input
                    autoFocus
                    type="text"
                    value={newName}
                    onChange={e => setNewName(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleCreate()}
                    placeholder="プロファイル名"
                    className="flex-1 text-sm border border-gray-300 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <button onClick={handleCreate} className="text-sm bg-indigo-600 text-white px-2 py-1 rounded-lg hover:bg-indigo-700">追加</button>
                  <button onClick={() => setCreating(false)} className="text-sm text-gray-500 px-1">✕</button>
                </div>
              ) : (
                <button
                  onClick={() => setCreating(true)}
                  className="w-full text-sm text-indigo-600 hover:text-indigo-700 font-medium flex items-center gap-1"
                >
                  <span>+</span> 新しいプロファイルを作成
                </button>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
