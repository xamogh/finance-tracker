export type MemberKey = 'me' | 'wife';

export type Category = {
  slug: string;
  name: string;
  icon: string;
  color: string;
  soft: string;
  order: number;
};

export type Expense = {
  id: string;
  date: string;
  note: string;
  category: string;
  paidBy: MemberKey;
  amount: number;
};

export type BudgetRow = {
  category: string;
  budget: number;
  spent: number;
};

export const categories: Category[] = [
  { slug: 'groceries', name: 'Groceries', icon: 'shopping-cart', color: '#58c886', soft: '#e9f8ef', order: 1 },
  { slug: 'dining-out', name: 'Dining Out', icon: 'utensils', color: '#ff7948', soft: '#fff0e7', order: 2 },
  { slug: 'transport', name: 'Transport', icon: 'car', color: '#4f8be8', soft: '#edf4ff', order: 3 },
  { slug: 'utilities', name: 'Utilities', icon: 'zap', color: '#f6bf31', soft: '#fff7dd', order: 4 },
  { slug: 'shopping', name: 'Shopping', icon: 'shopping-bag', color: '#a377e8', soft: '#f3eaff', order: 5 },
  { slug: 'entertainment', name: 'Entertainment', icon: 'ticket', color: '#f0628a', soft: '#fff0f5', order: 6 },
  { slug: 'misc', name: 'Misc', icon: 'circle-ellipsis', color: '#b6bbc5', soft: '#f1f2f4', order: 7 },
  { slug: 'personal', name: 'Personal', icon: 'user', color: '#20a7b8', soft: '#e6f7fa', order: 8 }
];

export const expenses: Expense[] = [
  { id: 'may-18', date: '2025-05-18', note: 'Whole Foods run', category: 'groceries', paidBy: 'wife', amount: 87.64 },
  { id: 'may-17', date: '2025-05-17', note: 'Dinner at Basta', category: 'dining-out', paidBy: 'me', amount: 63.5 },
  { id: 'may-16', date: '2025-05-16', note: 'Uber to Airport', category: 'transport', paidBy: 'me', amount: 42.18 },
  { id: 'may-15', date: '2025-05-15', note: 'Electricity Bill', category: 'utilities', paidBy: 'wife', amount: 120 },
  { id: 'may-14', date: '2025-05-14', note: 'Amazon order', category: 'shopping', paidBy: 'wife', amount: 58.99 },
  { id: 'may-13', date: '2025-05-13', note: 'Coffee', category: 'groceries', paidBy: 'me', amount: 4.75 },
  { id: 'may-12', date: '2025-05-12', note: 'Movie night', category: 'dining-out', paidBy: 'wife', amount: 32 },
  { id: 'may-11', date: '2025-05-11', note: 'Gas', category: 'transport', paidBy: 'me', amount: 38.2 },
  { id: 'may-10', date: '2025-05-10', note: 'Costco haul', category: 'groceries', paidBy: 'wife', amount: 410 },
  { id: 'may-09', date: '2025-05-09', note: 'Farmers market', category: 'groceries', paidBy: 'me', amount: 333.31 },
  { id: 'may-08', date: '2025-05-08', note: 'Takeout', category: 'dining-out', paidBy: 'wife', amount: 76.5 },
  { id: 'may-07', date: '2025-05-07', note: 'Brunch', category: 'dining-out', paidBy: 'me', amount: 111.47 },
  { id: 'may-06', date: '2025-05-06', note: 'Date night', category: 'dining-out', paidBy: 'wife', amount: 256.75 },
  { id: 'may-05', date: '2025-05-05', note: 'Train passes', category: 'transport', paidBy: 'wife', amount: 103.6 },
  { id: 'may-04', date: '2025-05-04', note: 'Car service', category: 'transport', paidBy: 'me', amount: 208.2 },
  { id: 'may-03', date: '2025-05-03', note: 'Internet bill', category: 'utilities', paidBy: 'wife', amount: 174.8 },
  { id: 'may-02', date: '2025-05-02', note: 'Clothes', category: 'shopping', paidBy: 'wife', amount: 188.64 },
  { id: 'may-01', date: '2025-05-01', note: 'Home supplies', category: 'misc', paidBy: 'me', amount: 148.22 }
];

export const budgets: BudgetRow[] = [
  { category: 'groceries', budget: 900, spent: 835.7 },
  { category: 'dining-out', budget: 600, spent: 540.22 },
  { category: 'transport', budget: 400, spent: 392.18 },
  { category: 'utilities', budget: 300, spent: 294.8 },
  { category: 'shopping', budget: 200, spent: 247.63 },
  { category: 'entertainment', budget: 150, spent: 187.45 },
  { category: 'misc', budget: 100, spent: 148.22 },
  { category: 'personal', budget: 100, spent: 63.2 }
];

export const trend = [
  { label: "Dec '24", amount: 2200 },
  { label: "Jan '25", amount: 2600 },
  { label: "Feb '25", amount: 2900 },
  { label: "Mar '25", amount: 2400 },
  { label: "Apr '25", amount: 2800 },
  { label: "May '25", amount: 2458.75 }
];

export const categoryTrend = {
  groceries: [690, 680, 760, 750, 770, 835.7],
  'dining-out': [450, 470, 540, 500, 610, 540.22],
  transport: [350, 340, 390, 390, 375, 392.18],
  utilities: [180, 230, 300, 295, 290, 294.8],
  shopping: [260, 240, 270, 285, 260, 247.63],
  misc: [120, 150, 160, 165, 170, 148.22]
};

export function categoryFor(slug: string) {
  return categories.find((category) => category.slug === slug) ?? categories[categories.length - 1];
}

export function money(amount: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2
  }).format(amount);
}

export function dayLabel(date: string, long = false) {
  const value = new Date(`${date}T00:00:00`);
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: long ? 'numeric' : undefined
  }).format(value);
}

export function totalsByCategory(items: Expense[] = expenses) {
  const totals = new Map<string, number>();
  for (const expense of items) {
    totals.set(expense.category, Number(((totals.get(expense.category) ?? 0) + expense.amount).toFixed(2)));
  }
  return categories
    .filter((category) => totals.has(category.slug))
    .map((category) => ({
      category,
      amount: totals.get(category.slug) ?? 0
    }));
}

export function totalSpent(items: Expense[] = expenses) {
  return Number(items.reduce((sum, expense) => sum + expense.amount, 0).toFixed(2));
}

export function categoryPercent(amount: number, total = totalSpent()) {
  return Math.round((amount / total) * 100);
}

