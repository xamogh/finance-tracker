type ConvexEnvName = 'ALLOWED_USER_EMAILS' | 'CLERK_JWT_ISSUER_DOMAIN';

type RuntimeEnv = {
  process?: {
    env?: Partial<Record<ConvexEnvName, string>>;
  };
};

export function convexEnv(name: ConvexEnvName) {
  return (globalThis as RuntimeEnv).process?.env?.[name];
}
