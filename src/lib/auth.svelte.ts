export type AuthState = {
  backendReady: boolean;
  clerkReady: boolean;
  signedIn: boolean;
  userName: string;
  userEmail: string;
  signIn: () => void;
  signOut: () => void;
};

export const AUTH_CONTEXT = Symbol('shared-spending-auth');

export function createAuthState(): AuthState {
  return {
    backendReady: false,
    clerkReady: false,
    signedIn: false,
    userName: '',
    userEmail: '',
    signIn: () => undefined,
    signOut: () => undefined
  };
}

