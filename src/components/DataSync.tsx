import { useState, useRef } from 'react';
import { loadData, saveData } from '../lib/storage';

interface Props {
  onClose: () => void;
  onImported: () => void;
}

export default function DataSync({ onClose, onImported }: Props) {
  const [tab, setTab] = useState<'export' | 'import'>('export');
  const [imported, setImported] = useState(false);
  const [error, setError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  function handleExport() {
    const data = loadData();
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `lifeplan_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError('');

    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const json = ev.target?.result as string;
        const data = JSON.parse(json);
        // 簡易バリデーション
        if (!data.profiles || !data.transactions) {
          throw new Error('ファイルの形式が正しくありません');
        }
        saveData(data);
        setImported(true);
        setTimeout(() => {
          onImported();
          onClose();
        }, 1500);
      } catch {
        setError('読み込みに失敗しました。正しいバックアップファイルか確認してください。');
      }
    };
    reader.readAsText(file);
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end md:items-center justify-center p-0 md:p-4">
      <div className="bg-white rounded-t-2xl md:rounded-2xl w-full md:max-w-md">
        {/* ヘッダー */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
          <h2 className="font-bold text-gray-800">データの移行・バックアップ</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* タブ */}
        <div className="flex border-b border-gray-100">
          <button
            onClick={() => setTab('export')}
            className={`flex-1 py-2.5 text-sm font-medium transition-colors ${tab === 'export' ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-gray-500'}`}
          >
            📤 エクスポート（保存）
          </button>
          <button
            onClick={() => setTab('import')}
            className={`flex-1 py-2.5 text-sm font-medium transition-colors ${tab === 'import' ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-gray-500'}`}
          >
            📥 インポート（読込）
          </button>
        </div>

        <div className="p-5">
          {tab === 'export' ? (
            <div className="space-y-4">
              <div className="bg-blue-50 rounded-xl p-4 text-sm text-blue-800 space-y-1">
                <p className="font-semibold">PCのデータをスマホに移す手順</p>
                <p>① 下のボタンでデータをダウンロード（.jsonファイル）</p>
                <p>② そのファイルをスマホに送る（AirDrop・メール・LINEなど）</p>
                <p>③ スマホのアプリで「インポート」タブから読み込む</p>
              </div>
              <button
                onClick={handleExport}
                className="w-full py-3 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 flex items-center justify-center gap-2"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                </svg>
                データをダウンロード
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {imported ? (
                <div className="text-center py-8">
                  <div className="text-5xl mb-3">✅</div>
                  <p className="font-bold text-gray-800">読み込み完了！</p>
                  <p className="text-sm text-gray-500 mt-1">データを反映しています…</p>
                </div>
              ) : (
                <>
                  <div className="bg-amber-50 rounded-xl p-4 text-sm text-amber-800 space-y-1">
                    <p className="font-semibold">⚠️ 注意</p>
                    <p>インポートすると、この端末の現在のデータは上書きされます。</p>
                  </div>
                  {error && (
                    <p className="text-sm text-red-600 bg-red-50 rounded-lg p-3">{error}</p>
                  )}
                  <input
                    ref={fileRef}
                    type="file"
                    accept=".json"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                  <button
                    onClick={() => fileRef.current?.click()}
                    className="w-full py-3 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 flex items-center justify-center gap-2"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                    </svg>
                    JSONファイルを選択して読込
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
