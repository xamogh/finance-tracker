import { v } from 'convex/values';
import type { Id } from './_generated/dataModel';
import { mutation, query } from './_generated/server';
import {
  assertAllowedEmail,
  categoryBySlug,
  ensureHousehold,
  memberKeyForEmail,
  requireIdentity,
  requireMembership
} from './lib';

const DEFAULT_CATEGORIES = [
  { name: 'Groceries', slug: 'groceries', icon: 'shopping-cart', color: '#51bf7f', sortOrder: 1 },
  { name: 'Dining Out', slug: 'dining-out', icon: 'utensils', color: '#ff7a3d', sortOrder: 2 },
  { name: 'Transport', slug: 'transport', icon: 'car', color: '#4b8ce8', sortOrder: 3 },
  { name: 'Utilities', slug: 'utilities', icon: 'zap', color: '#f5bd2f', sortOrder: 4 },
  { name: 'Shopping', slug: 'shopping', icon: 'shopping-bag', color: '#a776e8', sortOrder: 5 },
  { name: 'Entertainment', slug: 'entertainment', icon: 'ticket', color: '#ef6f91', sortOrder: 6 },
  { name: 'Misc', slug: 'misc', icon: 'circle-ellipsis', color: '#b7bbc4', sortOrder: 7 },
  { name: 'Personal', slug: 'personal', icon: 'user', color: '#20a7b8', sortOrder: 8 }
];

const CATEGORY_ICONS = new Set([
  'shopping-cart',
  'utensils',
  'car',
  'zap',
  'shopping-bag',
  'ticket',
  'circle-ellipsis',
  'user'
]);

const TREND_MONTHS = 6;
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function monthWindow(month: string) {
  const [year, monthIndex] = month.split('-').map(Number);
  const target = new Date(Date.UTC(year, monthIndex - 1, 1));
  const months: { month: string; label: string }[] = [];

  for (let offset = TREND_MONTHS - 1; offset >= 0; offset -= 1) {
    const date = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() - offset, 1));
    const monthValue = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
    months.push({
      month: monthValue,
      label: `${MONTH_NAMES[date.getUTCMonth()]} '${String(date.getUTCFullYear()).slice(2)}`
    });
  }

  return months;
}

function slugifyCategory(name: string) {
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return slug || 'category';
}

async function uniqueCategorySlug(ctx: Parameters<typeof categoryBySlug>[0], householdId: Id<'households'>, name: string) {
  const baseSlug = slugifyCategory(name);
  let slug = baseSlug;
  let suffix = 2;

  while (await categoryBySlug(ctx, householdId, slug)) {
    slug = `${baseSlug}-${suffix}`;
    suffix += 1;
  }

  return slug;
}

function assertHexColor(color: string) {
  if (!/^#[0-9a-f]{6}$/i.test(color)) {
    throw new Error('Choose a valid category color.');
  }
}

export const ensureCurrentUser = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await requireIdentity(ctx);
    assertAllowedEmail(identity.email);

    let user = await ctx.db
      .query('users')
      .withIndex('by_token', (q) => q.eq('tokenIdentifier', identity.tokenIdentifier))
      .unique();

    if (!user) {
      const existingByEmail = await ctx.db
        .query('users')
        .withIndex('by_email', (q) => q.eq('email', identity.email))
        .unique();

      if (existingByEmail) {
        user = existingByEmail;
      } else {
        const userId = await ctx.db.insert('users', {
          tokenIdentifier: identity.tokenIdentifier,
          email: identity.email,
          name: identity.name,
          imageUrl: identity.imageUrl,
          createdAt: Date.now()
        });
        user = await ctx.db.get(userId);
      }
    }

    if (!user) {
      throw new Error('Unable to create user.');
    }

    const householdId = await ensureHousehold(ctx);
    const membership = await ctx.db
      .query('memberships')
      .withIndex('by_user', (q) => q.eq('userId', user._id))
      .unique();

    if (!membership) {
      const existingMembers = await ctx.db
        .query('memberships')
        .withIndex('by_household', (q) => q.eq('householdId', householdId))
        .collect();

      await ctx.db.insert('memberships', {
        householdId,
        userId: user._id,
        email: identity.email,
        memberKey: memberKeyForEmail(identity.email, existingMembers.length),
        createdAt: Date.now()
      });
    }

    return user._id;
  }
});

export const setupHouseholdCategories = mutation({
  args: {},
  handler: async (ctx) => {
    const { membership } = await requireMembership(ctx);
    const now = Date.now();

    const categories = new Map<string, Id<'categories'>>();
    for (const category of DEFAULT_CATEGORIES) {
      const existing = await categoryBySlug(ctx, membership.householdId, category.slug);
      if (existing) {
        categories.set(category.slug, existing._id);
        continue;
      }

      const categoryId = await ctx.db.insert('categories', {
        householdId: membership.householdId,
        ...category,
        createdAt: now
      });
      categories.set(category.slug, categoryId);
    }

    return { ok: true };
  }
});

export const addCategory = mutation({
  args: {
    name: v.string(),
    icon: v.string(),
    color: v.string()
  },
  handler: async (ctx, args) => {
    const { membership } = await requireMembership(ctx);
    const name = args.name.trim();

    if (name.length < 2) {
      throw new Error('Category name must be at least 2 characters.');
    }
    if (name.length > 40) {
      throw new Error('Category name must be 40 characters or fewer.');
    }
    if (!CATEGORY_ICONS.has(args.icon)) {
      throw new Error('Choose a valid category icon.');
    }
    assertHexColor(args.color);

    const existingCategories = await ctx.db
      .query('categories')
      .withIndex('by_household', (q) => q.eq('householdId', membership.householdId))
      .collect();

    const slug = await uniqueCategorySlug(ctx, membership.householdId, name);
    const nextSortOrder =
      existingCategories.reduce((max, category) => Math.max(max, category.sortOrder), 0) + 1;

    return await ctx.db.insert('categories', {
      householdId: membership.householdId,
      name,
      slug,
      icon: args.icon,
      color: args.color,
      sortOrder: nextSortOrder,
      createdAt: Date.now()
    });
  }
});

export const dashboard = query({
  args: { month: v.string() },
  handler: async (ctx, args) => {
    const { membership } = await requireMembership(ctx);
    const [categories, budgets, expenses, members] = await Promise.all([
      ctx.db
        .query('categories')
        .withIndex('by_household', (q) => q.eq('householdId', membership.householdId))
        .collect(),
      ctx.db
        .query('budgets')
        .withIndex('by_household_month', (q) => q.eq('householdId', membership.householdId).eq('month', args.month))
        .collect(),
      ctx.db
        .query('expenses')
        .withIndex('by_household_date', (q) => q.eq('householdId', membership.householdId))
        .collect(),
      ctx.db
        .query('memberships')
        .withIndex('by_household', (q) => q.eq('householdId', membership.householdId))
        .collect()
    ]);

    const monthExpenses = expenses.filter((expense) => expense.date.startsWith(args.month));
    const memberLookup = new Map(members.map((member) => [member.userId, member.memberKey]));
    const months = monthWindow(args.month);
    const monthlyTotals = new Map(months.map(({ month }) => [month, 0]));
    const categoryTrend = new Map(categories.map((category) => [category.slug, months.map(() => 0)]));

    for (const expense of expenses) {
      const expenseMonth = expense.date.slice(0, 7);
      if (!monthlyTotals.has(expenseMonth)) continue;

      const amount = expense.amountCents / 100;
      monthlyTotals.set(expenseMonth, Number(((monthlyTotals.get(expenseMonth) ?? 0) + amount).toFixed(2)));

      const category = categories.find((item) => item._id === expense.categoryId);
      if (!category) continue;

      const monthIndex = months.findIndex((item) => item.month === expenseMonth);
      const categoryPoints = categoryTrend.get(category.slug);
      if (!categoryPoints || monthIndex < 0) continue;

      categoryPoints[monthIndex] = Number((categoryPoints[monthIndex] + amount).toFixed(2));
    }

    return {
      categories,
      budgets,
      trend: months.map(({ month, label }) => ({
        month,
        label,
        amount: monthlyTotals.get(month) ?? 0
      })),
      categoryTrend: Object.fromEntries(categoryTrend),
      expenses: monthExpenses
        .sort((a, b) => b.date.localeCompare(a.date))
        .map((expense) => ({
          ...expense,
          paidBy: memberLookup.get(expense.paidByUserId) ?? 'me'
        }))
    };
  }
});

export const addExpense = mutation({
  args: {
    date: v.string(),
    note: v.string(),
    categorySlug: v.string(),
    paidBy: v.union(v.literal('me'), v.literal('wife')),
    amountCents: v.number()
  },
  handler: async (ctx, args) => {
    const { user, membership } = await requireMembership(ctx);
    const category = await categoryBySlug(ctx, membership.householdId, args.categorySlug);

    if (!category) {
      throw new Error('Unknown expense category.');
    }

    const paidBy = await ctx.db
      .query('memberships')
      .withIndex('by_household_member', (q) =>
        q.eq('householdId', membership.householdId).eq('memberKey', args.paidBy)
      )
      .unique();

    await ctx.db.insert('expenses', {
      householdId: membership.householdId,
      categoryId: category._id,
      paidByUserId: paidBy?.userId ?? user._id,
      date: args.date,
      note: args.note.trim(),
      amountCents: Math.round(args.amountCents),
      createdByUserId: user._id,
      createdAt: Date.now()
    });
  }
});

export const upsertBudget = mutation({
  args: {
    month: v.string(),
    categorySlug: v.string(),
    amountCents: v.number()
  },
  handler: async (ctx, args) => {
    const { membership } = await requireMembership(ctx);
    const amountCents = Math.round(args.amountCents);

    if (!/^\d{4}-\d{2}$/.test(args.month)) {
      throw new Error('Budget month must use YYYY-MM format.');
    }

    if (amountCents < 0) {
      throw new Error('Budget amount cannot be negative.');
    }

    const category = await categoryBySlug(ctx, membership.householdId, args.categorySlug);

    if (!category) {
      throw new Error('Unknown budget category.');
    }

    const existing = await ctx.db
      .query('budgets')
      .withIndex('by_category_month', (q) => q.eq('categoryId', category._id).eq('month', args.month))
      .unique();

    if (amountCents === 0) {
      if (existing) {
        await ctx.db.delete(existing._id);
      }
      return { ok: true };
    }

    if (existing) {
      await ctx.db.patch(existing._id, { amountCents });
      return { ok: true };
    }

    await ctx.db.insert('budgets', {
      householdId: membership.householdId,
      categoryId: category._id,
      month: args.month,
      amountCents,
      createdAt: Date.now()
    });

    return { ok: true };
  }
});
