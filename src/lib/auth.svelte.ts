export type AuthState = {
  initialized: boolean;
  backendReady: boolean;
  clerkReady: boolean;
  signedIn: boolean;
  userName: string;
  userEmail: string;
  signIn: () => void;
  signUp: () => void;
  signOut: () => void;
};

export const AUTH_CONTEXT = Symbol('shared-spending-auth');

export function createAuthState(): AuthState {
  return {
    initialized: false,
    backendReady: false,
    clerkReady: false,
    signedIn: false,
    userName: '',
    userEmail: '',
    signIn: () => undefined,
    signUp: () => undefined,
    signOut: () => undefined
  };
}
