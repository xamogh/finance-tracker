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
  isSet: boolean;
};

export type TrendPoint = {
  month: string;
  label: string;
  amount: number;
};

export type CategoryTrend = Record<string, number[]>;

export function categoryFor(slug: string, categories: Category[]) {
  return (
    categories.find((category) => category.slug === slug) ?? {
      slug,
      name: 'Uncategorized',
      icon: 'circle-ellipsis',
      color: '#b6bbc5',
      soft: '#f1f2f4',
      order: 999
    }
  );
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

export function totalsByCategory(items: Expense[], categories: Category[]) {
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

export function totalSpent(items: Expense[]) {
  return Number(items.reduce((sum, expense) => sum + expense.amount, 0).toFixed(2));
}

export function categoryPercent(amount: number, total: number) {
  if (total <= 0) return 0;
  return Math.round((amount / total) * 100);
}
