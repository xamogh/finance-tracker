import { defineSchema, defineTable } from 'convex/server';
import { v } from 'convex/values';

export default defineSchema({
  households: defineTable({
    name: v.string(),
    slug: v.string(),
    createdAt: v.number()
  }).index('by_slug', ['slug']),

  users: defineTable({
    tokenIdentifier: v.string(),
    email: v.string(),
    name: v.optional(v.string()),
    imageUrl: v.optional(v.string()),
    createdAt: v.number()
  })
    .index('by_token', ['tokenIdentifier'])
    .index('by_email', ['email']),

  memberships: defineTable({
    householdId: v.id('households'),
    userId: v.id('users'),
    email: v.string(),
    memberKey: v.union(v.literal('me'), v.literal('wife')),
    createdAt: v.number()
  })
    .index('by_user', ['userId'])
    .index('by_household', ['householdId'])
    .index('by_household_member', ['householdId', 'memberKey']),

  categories: defineTable({
    householdId: v.id('households'),
    name: v.string(),
    slug: v.string(),
    icon: v.string(),
    color: v.string(),
    sortOrder: v.number(),
    createdAt: v.number()
  })
    .index('by_household', ['householdId'])
    .index('by_household_slug', ['householdId', 'slug']),

  budgets: defineTable({
    householdId: v.id('households'),
    categoryId: v.id('categories'),
    month: v.string(),
    amountCents: v.number(),
    createdAt: v.number()
  })
    .index('by_household_month', ['householdId', 'month'])
    .index('by_category_month', ['categoryId', 'month']),

  expenses: defineTable({
    householdId: v.id('households'),
    categoryId: v.id('categories'),
    paidByUserId: v.id('users'),
    date: v.string(),
    note: v.string(),
    amountCents: v.number(),
    createdByUserId: v.id('users'),
    createdAt: v.number()
  })
    .index('by_household_date', ['householdId', 'date'])
    .index('by_household_month', ['householdId'])
    .index('by_category', ['categoryId'])
});

