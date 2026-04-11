import React from 'react';
import { AppProvider, useApp } from './contexts/AppContext';
import Navigation from './components/Navigation';
import ProfileSelector from './components/ProfileSelector';
import ActualResults from './screens/ActualResults';
import BudgetPlan from './screens/BudgetPlan';
import AnnualBudget from './screens/AnnualBudget';
import LifePlan from './screens/LifePlan';

function AppContent() {
  const { currentProfile, currentScreen, createProfile } = useApp();
  const [setupName, setSetupName] = React.useState('');

  if (!currentProfile) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-blue-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-lg p-8 w-full max-w-sm">
          <div className="text-center mb-6">
            <div className="w-16 h-16 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8 text-indigo-600">
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-gray-800">ライフプラン家計管理</h1>
            <p className="text-gray-500 text-sm mt-2">プロファイルを作成して始めましょう</p>
          </div>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">プロファイル名</label>
              <input
                type="text"
                value={setupName}
                onChange={e => setSetupName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && setupName.trim() && createProfile(setupName.trim())}
                placeholder="例：田中家、個人など"
                className="w-full border border-gray-300 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
              />
            </div>
            <button
              onClick={() => setupName.trim() && createProfile(setupName.trim())}
              className="w-full bg-indigo-600 text-white py-3 rounded-xl font-medium hover:bg-indigo-700 transition-colors"
            >
              始める
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 fixed top-0 left-0 right-0 z-30 md:left-56">
        <div className="flex items-center justify-between px-4 h-14">
          <h1 className="text-base font-bold text-gray-800 md:hidden">ライフプラン家計管理</h1>
          <h1 className="text-base font-bold text-gray-800 hidden md:block">
            {currentScreen === 'actual' && '実績管理'}
            {currentScreen === 'budget-plan' && '予算計画'}
            {currentScreen === 'annual-budget' && '年間予算'}
            {currentScreen === 'life-plan' && 'ライフプランシート'}
          </h1>
          <ProfileSelector />
        </div>
      </header>

      <Navigation />

      {/* Main content */}
      <main className="pt-14 pb-20 md:pb-0 md:ml-56 min-h-screen">
        {currentScreen === 'actual' && <ActualResults />}
        {currentScreen === 'budget-plan' && <BudgetPlan />}
        {currentScreen === 'annual-budget' && <AnnualBudget />}
        {currentScreen === 'life-plan' && <LifePlan />}
      </main>
    </div>
  );
}

export default function App() {
  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  );
}
