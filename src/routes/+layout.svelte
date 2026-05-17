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

  setupConvex(convexUrl, { disabled: !browser || !env.PUBLIC_CONVEX_URL });
  const convex = useConvexClient();
  setContext(AUTH_CONTEXT, auth);

  async function syncUser() {
    try {
      await convex.mutation(api.finance.ensureCurrentUser, {});
      await convex.mutation(api.finance.setupHouseholdCategories, {});
    } catch (error) {
      console.warn('Convex user sync failed', error);
    }
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
      auth.clerkReady = true;
      auth.signedIn = Boolean(clerk.session);
      auth.userName = clerk.user?.fullName || clerk.user?.firstName || 'Household';
      auth.userEmail = clerk.user?.primaryEmailAddress?.emailAddress || '';
    };

    auth.signIn = () => {
      void clerk.redirectToSignIn({
        redirectUrl: window.location.href,
        signInFallbackRedirectUrl: window.location.href,
        signUpFallbackRedirectUrl: window.location.href
      });
    };
    auth.signOut = () => {
      void clerk.signOut({ redirectUrl: window.location.origin });
    };

    convex.setAuth(async () => {
      return (await clerk.session?.getToken({ template: 'convex' })) ?? null;
    }, (isAuthenticated) => {
      auth.signedIn = isAuthenticated;
      if (isAuthenticated) void syncUser();
    });

    clerk.addListener(updateAuthState);
    updateAuthState();
    auth.initialized = true;

    if (auth.signedIn) {
      await syncUser();
    }
  });
</script>

{@render children()}
