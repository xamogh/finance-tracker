<script lang="ts">
  import '../app.css';
  import { browser } from '$app/environment';
  import { env } from '$env/dynamic/public';
  import { api } from '$convex/_generated/api.js';
  import { setupConvex, useConvexClient } from 'convex-svelte';
  import { setContext } from 'svelte';
  import { onMount } from 'svelte';
  import { Clerk } from '@clerk/clerk-js';
  import { AUTH_CONTEXT, createAuthState } from '$lib/auth.svelte';

  let { children } = $props();

  const convexUrl = env.PUBLIC_CONVEX_URL || 'https://placeholder.convex.cloud';
  const auth = $state(createAuthState());
  let syncInFlight = false;

  setupConvex(convexUrl, { disabled: !browser || !env.PUBLIC_CONVEX_URL });
  const convex = useConvexClient();
  setContext(AUTH_CONTEXT, auth);

  async function syncUser() {
    if (syncInFlight) return;

    try {
      syncInFlight = true;
      auth.syncing = true;
      auth.syncError = '';
      await convex.mutation(api.finance.ensureCurrentUser, {});
      await convex.mutation(api.finance.setupHouseholdCategories, {});
      auth.userSynced = true;
    } catch (error) {
      auth.userSynced = false;
      auth.syncError = friendlySyncError(error);
      console.warn('Convex user sync failed', error);
    } finally {
      auth.syncing = false;
      syncInFlight = false;
    }
  }

  function friendlySyncError(error: unknown) {
    const message = error instanceof Error ? error.message : String(error);

    if (/No JWT template exists with name: convex/i.test(message)) {
      return 'Clerk is missing the Convex JWT template named "convex". Add that template in Clerk, then retry.';
    }
    if (/No auth provider found|not authenticated|must be signed in/i.test(message)) {
      return 'Convex could not verify your Clerk session. Check the Clerk JWT template and Convex auth environment, then retry.';
    }
    if (/not allowed/i.test(message)) {
      return 'This Clerk email is not on the household allowlist.';
    }

    return message || 'Could not prepare your household account.';
  }

  onMount(async () => {
    auth.backendReady = Boolean(env.PUBLIC_CONVEX_URL);
    const publishableKey = env.PUBLIC_CLERK_PUBLISHABLE_KEY;

    if (!publishableKey) {
      auth.initialized = true;
      return;
    }

    const clerk = new Clerk(publishableKey);
    await clerk.load();

    const updateAuthState = () => {
      const wasSignedIn = auth.signedIn;
      const previousEmail = auth.userEmail;
      auth.clerkReady = true;
      auth.signedIn = Boolean(clerk.session);
      auth.userName = clerk.user?.fullName || clerk.user?.firstName || 'Household';
      auth.userEmail = clerk.user?.primaryEmailAddress?.emailAddress || '';

      if (!auth.signedIn || (wasSignedIn && previousEmail !== auth.userEmail)) {
        auth.convexAuthenticated = false;
        auth.userSynced = false;
        auth.syncing = false;
        auth.syncError = '';
      }
    };

    auth.signIn = () => {
      void clerk.redirectToSignIn({
        redirectUrl: window.location.href,
        signInFallbackRedirectUrl: window.location.href,
        signUpFallbackRedirectUrl: window.location.href
      });
    };
    auth.signUp = () => {
      void clerk.redirectToSignUp({
        redirectUrl: window.location.href,
        signInFallbackRedirectUrl: window.location.href,
        signUpFallbackRedirectUrl: window.location.href
      });
    };
    auth.signOut = () => {
      auth.convexAuthenticated = false;
      auth.userSynced = false;
      auth.syncing = false;
      auth.syncError = '';
      void clerk.signOut({ redirectUrl: window.location.origin });
    };
    auth.retrySync = () => {
      if (clerk.session) void syncUser();
    };

    convex.setAuth(async () => {
      try {
        const token = (await clerk.session?.getToken({ template: 'convex' })) ?? null;
        auth.convexAuthenticated = Boolean(token);
        if (token && /JWT template/i.test(auth.syncError)) auth.syncError = '';
        return token;
      } catch (error) {
        auth.convexAuthenticated = false;
        auth.userSynced = false;
        auth.syncing = false;
        auth.syncError = friendlySyncError(error);
        return null;
      }
    }, (isAuthenticated) => {
      auth.convexAuthenticated = isAuthenticated && auth.convexAuthenticated;
      if (auth.convexAuthenticated && clerk.session) void syncUser();
    });

    clerk.addListener(updateAuthState);
    updateAuthState();
    auth.initialized = true;

    if (auth.signedIn) auth.syncing = true;
  });
</script>

{@render children()}
