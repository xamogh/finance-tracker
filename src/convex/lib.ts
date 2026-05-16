import type { Id } from './_generated/dataModel';
import type { MutationCtx, QueryCtx } from './_generated/server';

const HOUSEHOLD_SLUG = 'shared-spending';

export async function requireIdentity(ctx: QueryCtx | MutationCtx) {
  const identity = await ctx.auth.getUserIdentity();

  if (!identity) {
    throw new Error('You must be signed in to use Shared Spending.');
  }

  const email = identity.email?.toLowerCase();

  if (!email) {
    throw new Error('Your Clerk account needs a verified email address.');
  }

  return {
    tokenIdentifier: identity.tokenIdentifier,
    email,
    name: identity.name,
    imageUrl: identity.pictureUrl
  };
}

export function assertAllowedEmail(email: string) {
  const allowed = (process.env.ALLOWED_USER_EMAILS ?? '')
    .split(',')
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);

  if (allowed.length > 0 && !allowed.includes(email)) {
    throw new Error('This email is not allowed for this household.');
  }
}

export function memberKeyForEmail(email: string, existingMemberCount: number) {
  const allowed = (process.env.ALLOWED_USER_EMAILS ?? '')
    .split(',')
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
  const configuredIndex = allowed.indexOf(email);

  if (configuredIndex === 0) return 'me';
  if (configuredIndex === 1) return 'wife';

  return existingMemberCount === 0 ? 'me' : 'wife';
}

export async function getCurrentMembership(ctx: QueryCtx | MutationCtx) {
  const identity = await requireIdentity(ctx);
  const user = await ctx.db
    .query('users')
    .withIndex('by_token', (q) => q.eq('tokenIdentifier', identity.tokenIdentifier))
    .unique();

  if (!user) {
    return null;
  }

  const membership = await ctx.db
    .query('memberships')
    .withIndex('by_user', (q) => q.eq('userId', user._id))
    .unique();

  if (!membership) {
    return null;
  }

  return { identity, user, membership };
}

export async function requireMembership(ctx: QueryCtx | MutationCtx) {
  const current = await getCurrentMembership(ctx);

  if (!current) {
    throw new Error('No household membership found for this user.');
  }

  return current;
}

export async function ensureHousehold(ctx: MutationCtx) {
  const existing = await ctx.db
    .query('households')
    .withIndex('by_slug', (q) => q.eq('slug', HOUSEHOLD_SLUG))
    .unique();

  if (existing) {
    return existing._id;
  }

  return await ctx.db.insert('households', {
    name: 'Shared Spending',
    slug: HOUSEHOLD_SLUG,
    createdAt: Date.now()
  });
}

export async function categoryBySlug(
  ctx: QueryCtx | MutationCtx,
  householdId: Id<'households'>,
  slug: string
) {
  return await ctx.db
    .query('categories')
    .withIndex('by_household_slug', (q) => q.eq('householdId', householdId).eq('slug', slug))
    .unique();
}
