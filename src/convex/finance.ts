import { v } from 'convex/values';
import type { Id } from './_generated/dataModel';
import { mutation, query } from './_generated/server';
import { assertAllowedEmail, categoryBySlug, ensureHousehold, requireIdentity, requireMembership } from './lib';

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

const DEFAULT_BUDGETS: Record<string, number> = {
  groceries: 90000,
  'dining-out': 60000,
  transport: 40000,
  utilities: 30000,
  shopping: 20000,
  entertainment: 15000,
  misc: 10000,
  personal: 10000
};

const DEMO_EXPENSES = [
  ['2025-05-18', 'Whole Foods run', 'groceries', 'wife', 8764],
  ['2025-05-17', 'Dinner at Basta', 'dining-out', 'me', 6350],
  ['2025-05-16', 'Uber to Airport', 'transport', 'me', 4218],
  ['2025-05-15', 'Electricity Bill', 'utilities', 'wife', 12000],
  ['2025-05-14', 'Amazon order', 'shopping', 'wife', 5899],
  ['2025-05-13', 'Coffee', 'groceries', 'me', 475],
  ['2025-05-12', 'Movie night', 'dining-out', 'wife', 3200],
  ['2025-05-11', 'Gas', 'transport', 'me', 3820],
  ['2025-05-10', 'Concert tickets', 'entertainment', 'wife', 8545],
  ['2025-05-09', 'Home supplies', 'misc', 'me', 14822],
  ['2025-05-08', 'Lunch', 'dining-out', 'me', 2875],
  ['2025-05-07', 'Books', 'personal', 'wife', 6320],
  ['2025-05-06', 'Groceries', 'groceries', 'wife', 18530],
  ['2025-05-05', 'Parking', 'transport', 'me', 1240],
  ['2025-05-04', 'Takeout', 'dining-out', 'wife', 7650],
  ['2025-05-03', 'Farmers market', 'groceries', 'me', 2311],
  ['2025-05-02', 'Rideshare', 'transport', 'wife', 8450],
  ['2025-05-01', 'Brunch', 'dining-out', 'me', 11147]
] as const;

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
        memberKey: existingMembers.some((member) => member.memberKey === 'me') ? 'wife' : 'me',
        createdAt: Date.now()
      });
    }

    return user._id;
  }
});

export const seedDemoData = mutation({
  args: {},
  handler: async (ctx) => {
    const { user, membership } = await requireMembership(ctx);
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

    const existingBudgets = await ctx.db
      .query('budgets')
      .withIndex('by_household_month', (q) => q.eq('householdId', membership.householdId).eq('month', '2025-05'))
      .collect();

    if (existingBudgets.length === 0) {
      for (const [slug, amountCents] of Object.entries(DEFAULT_BUDGETS)) {
        const categoryId = categories.get(slug);
        if (!categoryId) continue;

        await ctx.db.insert('budgets', {
          householdId: membership.householdId,
          categoryId,
          month: '2025-05',
          amountCents,
          createdAt: now
        });
      }
    }

    const existingExpenses = await ctx.db
      .query('expenses')
      .withIndex('by_household_date', (q) => q.eq('householdId', membership.householdId))
      .take(1);

    if (existingExpenses.length === 0) {
      const members = await ctx.db
        .query('memberships')
        .withIndex('by_household', (q) => q.eq('householdId', membership.householdId))
        .collect();
      const me = members.find((member) => member.memberKey === 'me')?.userId ?? user._id;
      const wife = members.find((member) => member.memberKey === 'wife')?.userId ?? user._id;

      for (const [date, note, slug, memberKey, amountCents] of DEMO_EXPENSES) {
        const categoryId = categories.get(slug);
        if (!categoryId) continue;

        await ctx.db.insert('expenses', {
          householdId: membership.householdId,
          categoryId,
          paidByUserId: memberKey === 'me' ? me : wife,
          date,
          note,
          amountCents,
          createdByUserId: user._id,
          createdAt: now
        });
      }
    }

    return { ok: true };
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

    return {
      categories,
      budgets,
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
