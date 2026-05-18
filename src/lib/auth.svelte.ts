export type AuthState = {
  initialized: boolean;
  backendReady: boolean;
  clerkReady: boolean;
  signedIn: boolean;
  convexAuthenticated: boolean;
  userSynced: boolean;
  syncing: boolean;
  syncError: string;
  userName: string;
  userEmail: string;
  signIn: () => void;
  signUp: () => void;
  signOut: () => void;
  retrySync: () => void;
};

export const AUTH_CONTEXT = Symbol('shared-spending-auth');

export function createAuthState(): AuthState {
  return {
    initialized: false,
    backendReady: false,
    clerkReady: false,
    signedIn: false,
    convexAuthenticated: false,
    userSynced: false,
    syncing: false,
    syncError: '',
    userName: '',
    userEmail: '',
    signIn: () => undefined,
    signUp: () => undefined,
    signOut: () => undefined,
    retrySync: () => undefined
  };
}
