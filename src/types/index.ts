export type TransactionType = 'income' | 'expense' | 'investment';
export type ExpenseCategory = '毎月固定費' | '毎月変動費' | '不定期固定費' | '不定期変動費';
export type IncomeCategory = '予算内' | '予算外';

export interface Transaction {
  id: string;
  profileId: string;
  year: number;
  month: number;
  day?: number;
  type: TransactionType;
  category: string;
  subcategory: string;
  minorCategory?: string;
  itemName: string;
  amount: number;
  note?: string;
  createdAt: string;
}

export interface Budget {
  id: string;
  profileId: string;
  type: TransactionType;
  category: string;
  subcategory: string;
  amount: number;
  startYear: number;
  endYear: number;
}

export interface FamilyMember {
  id: string;
  name: string;
  birthYear: number;
  relation: string;
}

export interface LifeEvent {
  id: string;
  profileId: string;
  year: number;
  title: string;
  description?: string;
  amount?: number;
  memberId?: string;
}

export interface Profile {
  id: string;
  name: string;
  members: FamilyMember[];
  createdAt: string;
}

export interface AppData {
  profiles: Profile[];
  transactions: Transaction[];
  budgets: Budget[];
  lifeEvents: LifeEvent[];
}

export type Screen = 'home' | 'actual' | 'budget-plan' | 'annual-budget' | 'life-plan';
