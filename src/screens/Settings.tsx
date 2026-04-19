import { useState, useMemo } from 'react';
import { useApp } from '../contexts/AppContext';

export default function Settings() {
  const { transactions, deleteTransactionsByMonth, deleteAllTransactions, resetCategoryConfig } = useApp();
  const [confirmAll, setConfirmAll] = useState(false);
  const [confirmCategory, setConfirmCategory] = useState(false);
  const [deletedMonth, setDeletedMonth] = useState<string | null>(null);

  // 取引のある月一覧（新しい順）
  const availableMonths = useMemo(() => {
    const set = new Set<string>();
    transactions.forEach(t => set.add(`${t.year}-${String(t.month).padStart(2, '0')}`));
    return Array.from(set).sort().reverse();
  }, [transactions]);

  function handleDeleteMonth(key: string) {
    const [year, month] = key.split('-').map(Number);
    deleteTransactionsByMonth(year, month);
    setDeletedMonth(key);
    setTimeout(() => setDeletedMonth(null), 2000);
  }

  function handleDeleteAll() {
    deleteAllTransactions();
    setConfirmAll(false);
  }

  function handleResetCategory() {
    resetCategoryConfig();
    setConfirmCategory(false);
    window.location.reload();
  }

  return (
    <div className="w-full bg-gray-50 min-h-screen">

      {/* 月ごとのデータ削除 */}
      <div className="mt-4">
        <p className="text-xs text-gray-400 px-4 pb-2">月ごとのデータ削除</p>
        <div className="bg-white divide-y divide-gray-100">
          {availableMonths.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-gray-400">取引データがありません</div>
          ) : (
            availableMonths.map(key => {
              const [year, month] = key.split('-').map(Number);
              const count = transactions.filter(t => t.year === year && t.month === month).length;
              return (
                <div key={key} className="flex items-center px-4 py-3.5 gap-3">
                  <span className="text-sm text-gray-700 flex-1">{year}年{month}月</span>
                  <span className="text-xs text-gray-400">{count}件</span>
                  {deletedMonth === key ? (
                    <span className="text-xs text-green-500 font-medium">削除しました</span>
                  ) : (
                    <button
                      onClick={() => handleDeleteMonth(key)}
                      className="text-xs text-red-500 border border-red-200 rounded-lg px-3 py-1.5 hover:bg-red-50 active:bg-red-100"
                    >
                      削除
                    </button>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* 全データ削除 */}
      <div className="mt-4">
        <p className="text-xs text-gray-400 px-4 pb-2">全データ削除</p>
        <div className="bg-white">
          {!confirmAll ? (
            <button
              onClick={() => setConfirmAll(true)}
              className="w-full flex items-center px-4 py-4 gap-3 text-left"
            >
              <div className="w-8 h-8 bg-red-50 rounded-full flex items-center justify-center shrink-0">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4 text-red-500">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-800">全取引データを削除</p>
                <p className="text-xs text-gray-400">全{transactions.length}件のデータが消えます</p>
              </div>
            </button>
          ) : (
            <div className="px-4 py-4 space-y-3">
              <p className="text-sm font-medium text-red-600">本当に全件削除しますか？</p>
              <p className="text-xs text-gray-500">この操作は元に戻せません。全{transactions.length}件が削除されます。</p>
              <div className="flex gap-2">
                <button onClick={() => setConfirmAll(false)} className="flex-1 border border-gray-300 text-gray-600 py-2.5 rounded-xl text-sm font-medium">
                  キャンセル
                </button>
                <button onClick={handleDeleteAll} className="flex-1 bg-red-500 text-white py-2.5 rounded-xl text-sm font-medium">
                  削除する
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* カテゴリ設定リセット */}
      <div className="mt-4">
        <p className="text-xs text-gray-400 px-4 pb-2">カテゴリ設定</p>
        <div className="bg-white">
          {!confirmCategory ? (
            <button
              onClick={() => setConfirmCategory(true)}
              className="w-full flex items-center px-4 py-4 gap-3 text-left"
            >
              <div className="w-8 h-8 bg-orange-50 rounded-full flex items-center justify-center shrink-0">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4 text-orange-500">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-800">カテゴリ・分類ルールをリセット</p>
                <p className="text-xs text-gray-400">MF用の6カテゴリ構成に初期化します</p>
              </div>
            </button>
          ) : (
            <div className="px-4 py-4 space-y-3">
              <p className="text-sm font-medium text-orange-600">カテゴリ設定をリセットしますか？</p>
              <p className="text-xs text-gray-500">食費・日用品・住宅・自動車・交際費・その他の6カテゴリ構成に戻ります。学習済みの分類ルールも削除されます。</p>
              <div className="flex gap-2">
                <button onClick={() => setConfirmCategory(false)} className="flex-1 border border-gray-300 text-gray-600 py-2.5 rounded-xl text-sm font-medium">
                  キャンセル
                </button>
                <button onClick={handleResetCategory} className="flex-1 bg-orange-500 text-white py-2.5 rounded-xl text-sm font-medium">
                  リセットする
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="h-8" />
    </div>
  );
}
