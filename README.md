# Shared Spending

A SvelteKit + Convex household finance tracker for two partners to log and review shared expenses.

## Stack

- SvelteKit for the UI
- Convex for reactive data, mutations, schema, and household records
- Clerk for authentication

## Local Setup

```sh
npm install
npm run dev
```

Create `.env.local` from `.env.example`, then run Convex in another terminal:

```sh
npx convex dev
```

Clerk should have a JWT template named `convex`, and the Convex deployment should receive `CLERK_JWT_ISSUER_DOMAIN`.

On first sign-in, the app creates the household and starter categories only. Expenses and budget amounts are created from real user actions.
