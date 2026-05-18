import type { AuthConfig } from 'convex/server';

import { convexEnv } from './env';

const clerkJwtIssuerDomain = convexEnv('CLERK_JWT_ISSUER_DOMAIN');

if (!clerkJwtIssuerDomain) {
  throw new Error('Set CLERK_JWT_ISSUER_DOMAIN in Convex environment variables.');
}

export default {
  providers: [
    {
      domain: clerkJwtIssuerDomain,
      applicationID: 'convex'
    }
  ]
} satisfies AuthConfig;
