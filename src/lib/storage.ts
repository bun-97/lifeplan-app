import { AppData, Profile, Transaction, Budget, LifeEvent } from '../types';

const STORAGE_KEY = 'lifeplan_data';

const defaultData: AppData = {
  profiles: [],
  transactions: [],
  budgets: [],
  lifeEvents: []
};

export function loadData(): AppData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultData;
    return JSON.parse(raw) as AppData;
  } catch {
    return defaultData;
  }
}

export function saveData(data: AppData): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

// Profile operations
export function getProfiles(): Profile[] {
  return loadData().profiles;
}

export function saveProfile(profile: Profile): void {
  const data = loadData();
  const idx = data.profiles.findIndex(p => p.id === profile.id);
  if (idx >= 0) {
    data.profiles[idx] = profile;
  } else {
    data.profiles.push(profile);
  }
  saveData(data);
}

export function deleteProfile(id: string): void {
  const data = loadData();
  data.profiles = data.profiles.filter(p => p.id !== id);
  data.transactions = data.transactions.filter(t => t.profileId !== id);
  data.budgets = data.budgets.filter(b => b.profileId !== id);
  data.lifeEvents = data.lifeEvents.filter(e => e.profileId !== id);
  saveData(data);
}

// Transaction operations
export function getTransactions(profileId: string): Transaction[] {
  return loadData().transactions.filter(t => t.profileId === profileId);
}

export function saveTransaction(tx: Transaction): void {
  const data = loadData();
  const idx = data.transactions.findIndex(t => t.id === tx.id);
  if (idx >= 0) {
    data.transactions[idx] = tx;
  } else {
    data.transactions.push(tx);
  }
  saveData(data);
}

export function deleteTransaction(id: string): void {
  const data = loadData();
  data.transactions = data.transactions.filter(t => t.id !== id);
  saveData(data);
}

export function deleteTransactionsByMonth(profileId: string, year: number, month: number): void {
  const data = loadData();
  data.transactions = data.transactions.filter(
    t => !(t.profileId === profileId && t.year === year && t.month === month)
  );
  saveData(data);
}

export function deleteAllTransactions(profileId: string): void {
  const data = loadData();
  data.transactions = data.transactions.filter(t => t.profileId !== profileId);
  saveData(data);
}

// Budget operations
export function getBudgets(profileId: string): Budget[] {
  return loadData().budgets.filter(b => b.profileId === profileId);
}

export function saveBudget(budget: Budget): void {
  const data = loadData();
  const idx = data.budgets.findIndex(b => b.id === budget.id);
  if (idx >= 0) {
    data.budgets[idx] = budget;
  } else {
    data.budgets.push(budget);
  }
  saveData(data);
}

export function deleteBudget(id: string): void {
  const data = loadData();
  data.budgets = data.budgets.filter(b => b.id !== id);
  saveData(data);
}

// LifeEvent operations
export function getLifeEvents(profileId: string): LifeEvent[] {
  return loadData().lifeEvents.filter(e => e.profileId === profileId);
}

export function saveLifeEvent(event: LifeEvent): void {
  const data = loadData();
  const idx = data.lifeEvents.findIndex(e => e.id === event.id);
  if (idx >= 0) {
    data.lifeEvents[idx] = event;
  } else {
    data.lifeEvents.push(event);
  }
  saveData(data);
}

export function deleteLifeEvent(id: string): void {
  const data = loadData();
  data.lifeEvents = data.lifeEvents.filter(e => e.id !== id);
  saveData(data);
}
