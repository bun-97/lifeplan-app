import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Profile, Transaction, Budget, LifeEvent, Screen } from '../types';
import * as storage from '../lib/storage';
import { resetCategoryConfig as doResetCategoryConfig } from '../lib/categoryConfig';
import { v4 as uuidv4 } from 'uuid';

interface AppContextType {
  profiles: Profile[];
  currentProfile: Profile | null;
  setCurrentProfile: (profile: Profile) => void;
  currentScreen: Screen;
  setCurrentScreen: (screen: Screen) => void;
  transactions: Transaction[];
  budgets: Budget[];
  lifeEvents: LifeEvent[];
  createProfile: (name: string) => Profile;
  updateProfile: (profile: Profile) => void;
  deleteProfile: (id: string) => void;
  addTransaction: (tx: Omit<Transaction, 'id' | 'createdAt'>) => void;
  updateTransaction: (tx: Transaction) => void;
  deleteTransaction: (id: string) => void;
  deleteTransactionsByMonth: (year: number, month: number) => void;
  deleteAllTransactions: () => void;
  resetCategoryConfig: () => void;
  addBudget: (budget: Omit<Budget, 'id'>) => void;
  updateBudget: (budget: Budget) => void;
  deleteBudget: (id: string) => void;
  addLifeEvent: (event: Omit<LifeEvent, 'id'>) => void;
  updateLifeEvent: (event: LifeEvent) => void;
  deleteLifeEvent: (id: string) => void;
}

const AppContext = createContext<AppContextType | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [currentProfile, setCurrentProfileState] = useState<Profile | null>(null);
  const [currentScreen, setCurrentScreen] = useState<Screen>('home');
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [lifeEvents, setLifeEvents] = useState<LifeEvent[]>([]);

  useEffect(() => {
    const ps = storage.getProfiles();
    setProfiles(ps);
    if (ps.length > 0) {
      const savedId = localStorage.getItem('currentProfileId');
      const found = ps.find(p => p.id === savedId) || ps[0];
      setCurrentProfileState(found);
    }
  }, []);

  useEffect(() => {
    if (currentProfile) {
      setTransactions(storage.getTransactions(currentProfile.id));
      setBudgets(storage.getBudgets(currentProfile.id));
      setLifeEvents(storage.getLifeEvents(currentProfile.id));
      localStorage.setItem('currentProfileId', currentProfile.id);
    }
  }, [currentProfile]);

  function setCurrentProfile(profile: Profile) {
    setCurrentProfileState(profile);
  }

  function createProfile(name: string): Profile {
    const profile: Profile = {
      id: uuidv4(),
      name,
      members: [],
      createdAt: new Date().toISOString()
    };
    storage.saveProfile(profile);
    const updated = storage.getProfiles();
    setProfiles(updated);
    setCurrentProfileState(profile);
    return profile;
  }

  function updateProfile(profile: Profile) {
    storage.saveProfile(profile);
    const updated = storage.getProfiles();
    setProfiles(updated);
    if (currentProfile?.id === profile.id) {
      setCurrentProfileState(profile);
    }
  }

  function handleDeleteProfile(id: string) {
    storage.deleteProfile(id);
    const updated = storage.getProfiles();
    setProfiles(updated);
    if (currentProfile?.id === id) {
      setCurrentProfileState(updated[0] || null);
    }
  }

  function addTransaction(tx: Omit<Transaction, 'id' | 'createdAt'>) {
    const newTx: Transaction = { ...tx, id: uuidv4(), createdAt: new Date().toISOString() };
    storage.saveTransaction(newTx);
    setTransactions(prev => [...prev, newTx]);
  }

  function updateTransaction(tx: Transaction) {
    storage.saveTransaction(tx);
    setTransactions(prev => prev.map(t => t.id === tx.id ? tx : t));
  }

  function handleDeleteTransaction(id: string) {
    storage.deleteTransaction(id);
    setTransactions(prev => prev.filter(t => t.id !== id));
  }

  function handleDeleteTransactionsByMonth(year: number, month: number) {
    if (!currentProfile) return;
    storage.deleteTransactionsByMonth(currentProfile.id, year, month);
    setTransactions(prev => prev.filter(t => !(t.year === year && t.month === month)));
  }

  function handleDeleteAllTransactions() {
    if (!currentProfile) return;
    storage.deleteAllTransactions(currentProfile.id);
    setTransactions([]);
  }

  function handleResetCategoryConfig() {
    doResetCategoryConfig();
    localStorage.removeItem('lifeplan_category_rules');
  }

  function addBudget(budget: Omit<Budget, 'id'>) {
    const newBudget: Budget = { ...budget, id: uuidv4() };
    storage.saveBudget(newBudget);
    setBudgets(prev => [...prev, newBudget]);
  }

  function updateBudget(budget: Budget) {
    storage.saveBudget(budget);
    setBudgets(prev => prev.map(b => b.id === budget.id ? budget : b));
  }

  function handleDeleteBudget(id: string) {
    storage.deleteBudget(id);
    setBudgets(prev => prev.filter(b => b.id !== id));
  }

  function addLifeEvent(event: Omit<LifeEvent, 'id'>) {
    const newEvent: LifeEvent = { ...event, id: uuidv4() };
    storage.saveLifeEvent(newEvent);
    setLifeEvents(prev => [...prev, newEvent]);
  }

  function updateLifeEvent(event: LifeEvent) {
    storage.saveLifeEvent(event);
    setLifeEvents(prev => prev.map(e => e.id === event.id ? event : e));
  }

  function handleDeleteLifeEvent(id: string) {
    storage.deleteLifeEvent(id);
    setLifeEvents(prev => prev.filter(e => e.id !== id));
  }

  return (
    <AppContext.Provider value={{
      profiles,
      currentProfile,
      setCurrentProfile,
      currentScreen,
      setCurrentScreen,
      transactions,
      budgets,
      lifeEvents,
      createProfile,
      updateProfile,
      deleteProfile: handleDeleteProfile,
      addTransaction,
      updateTransaction,
      deleteTransaction: handleDeleteTransaction,
      deleteTransactionsByMonth: handleDeleteTransactionsByMonth,
      deleteAllTransactions: handleDeleteAllTransactions,
      resetCategoryConfig: handleResetCategoryConfig,
      addBudget,
      updateBudget,
      deleteBudget: handleDeleteBudget,
      addLifeEvent,
      updateLifeEvent,
      deleteLifeEvent: handleDeleteLifeEvent
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
