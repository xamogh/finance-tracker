/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 */

import type { ApiFromModules, FilterApi, FunctionReference } from 'convex/server';
import type * as finance from '../finance.js';

declare const fullApi: ApiFromModules<{
  finance: typeof finance;
}>;
export declare const api: FilterApi<typeof fullApi, FunctionReference<any, 'public'>>;
export declare const internal: FilterApi<typeof fullApi, FunctionReference<any, 'internal'>>;

