<script lang="ts">
  import {
    AlertCircle,
    ArrowDownRight,
    ArrowUpRight,
    Calendar,
    Car,
    CheckCircle2,
    ChevronDown,
    ChevronLeft,
    ChevronRight,
    CircleEllipsis,
    Coins,
    LayoutDashboard,
    LogIn,
    LogOut,
    PiggyBank,
    Plus,
    ReceiptText,
    Search,
    ShoppingBag,
    ShoppingCart,
    SlidersHorizontal,
    Tag,
    Target,
    Ticket,
    User,
    UserPlus,
    Utensils,
    Wallet,
    X,
    Zap
  } from '@lucide/svelte';
  import { getContext } from 'svelte';
  import { useConvexClient, useQuery } from 'convex-svelte';
  import { api } from '$convex/_generated/api.js';
  import { AUTH_CONTEXT, type AuthState } from '$lib/auth.svelte';
  import {
    categoryFor,
    categoryPercent,
    dayLabel,
    money,
    totalSpent,
    totalsByCategory,
    type BudgetRow,
    type Category,
    type CategoryTrend,
    type Expense,
    type MemberKey,
    type TrendPoint
  } from '$lib/finance';

  type Tab = 'overview' | 'expenses' | 'categories' | 'budgets';
  type TrendMode = 'daily' | 'monthly';

  const today = new Date();
  const todayIso = localIsoDate(today);
  const currentMonth = todayIso.slice(0, 7);
  const currentMonthLabel = today.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  const auth = getContext<AuthState>(AUTH_CONTEXT);
  const convex = useConvexClient();
  const dashboard = useQuery(
    api.finance.dashboard,
    () => (auth.signedIn && auth.userSynced ? { month: currentMonth } : 'skip'),
    { keepPreviousData: true }
  );

  let activeTab = $state<Tab>('overview');
  let trendMode = $state<TrendMode>('daily');
  let addPanelOpen = $state(false);
  let budgetPanelOpen = $state(false);
  let categoryPanelOpen = $state(false);
  let queryText = $state('');
  let categoryFilter = $state('all');
  let paidByFilter = $state<'all' | MemberKey>('all');
  let page = $state(1);
  const pageSize = 10;
  let formError = $state('');
  let budgetError = $state('');
  let categoryError = $state('');
  let saving = $state(false);
  let savingBudget = $state(false);
  let savingCategory = $state(false);
  let draft = $state({
    date: todayIso,
    note: '',
    category: '',
    paidBy: 'me' as MemberKey,
    amount: ''
  });
  let budgetDraft = $state({
    category: '',
    amount: ''
  });
  let categoryDraft = $state({
    name: '',
    icon: 'circle-ellipsis',
    color: '#51bf7f'
  });

  const authInitializing = $derived(!auth.initialized);
  const backendUnavailable = $derived(auth.initialized && !auth.backendReady);
  const clerkUnavailable = $derived(auth.initialized && auth.backendReady && !auth.clerkReady);
  const signedOut = $derived(auth.initialized && auth.backendReady && auth.clerkReady && !auth.signedIn);
  const isPreparingAccount = $derived(auth.signedIn && !auth.userSynced && !auth.syncError);
  const isLoadingDashboard = $derived(auth.signedIn && auth.userSynced && dashboard.isLoading);
  const dashboardError = $derived(dashboard.error?.message ?? '');
  const blockingError = $derived(auth.syncError || dashboardError);
  const hasNotice = $derived(!!blockingError);

  const liveCategories = $derived.by<Category[]>(() => {
    if (!dashboard.data?.categories) return [];
    return dashboard.data.categories
      .map((category: any) => ({
        slug: category.slug,
        name: category.name,
        icon: category.icon,
        color: category.color,
        soft: softColor(category.color),
        order: category.sortOrder
      }))
      .sort((a: Category, b: Category) => a.order - b.order);
  });

  const liveExpenses = $derived.by<Expense[]>(() => {
    if (!dashboard.data?.expenses || !dashboard.data?.categories) return [];
    const categoryById = new Map(
      dashboard.data.categories.map((category: any) => [category._id, category.slug])
    );
    return dashboard.data.expenses.map((expense: any) => ({
      id: expense._id,
      date: expense.date,
      note: expense.note,
      category: categoryById.get(expense.categoryId) ?? 'misc',
      paidBy: expense.paidBy,
      amount: expense.amountCents / 100
    }));
  });

  const budgetRows = $derived.by<BudgetRow[]>(() => {
    if (!dashboard.data?.budgets || !dashboard.data?.categories) return [];
    const categoryById = new Map<string, string>(
      dashboard.data.categories.map((category: any) => [category._id, category.slug])
    );
    const budgetsBySlug = new Map<string, number>(
      dashboard.data.budgets.map((budget: any) => [
        categoryById.get(budget.categoryId) ?? 'misc',
        budget.amountCents / 100
      ])
    );
    const spentBySlug = new Map(
      totalsByCategory(liveExpenses, liveCategories).map((item) => [item.category.slug, item.amount])
    );

    return liveCategories.map((category) => {
      const budget = budgetsBySlug.get(category.slug);
      return {
        category: category.slug,
        budget: budget ?? 0,
        spent: spentBySlug.get(category.slug) ?? 0,
        isSet: budget !== undefined
      };
    });
  });
  const liveBudgets = $derived(budgetRows.filter((row) => row.isSet));

  const trendData = $derived.by<TrendPoint[]>(() => dashboard.data?.trend ?? []);
  const dailyTrendData = $derived.by<TrendPoint[]>(() => {
    const currentDay = Math.max(1, Number(todayIso.slice(8, 10)));
    const dailyTotals = new Map<string, number>();

    for (const expense of liveExpenses) {
      dailyTotals.set(
        expense.date,
        Number(((dailyTotals.get(expense.date) ?? 0) + expense.amount).toFixed(2))
      );
    }

    return Array.from({ length: currentDay }, (_, index) => {
      const day = index + 1;
      const date = `${currentMonth}-${String(day).padStart(2, '0')}`;
      return {
        month: date,
        label: String(day),
        amount: dailyTotals.get(date) ?? 0
      };
    });
  });
  const visibleTrendData = $derived(trendMode === 'daily' ? dailyTrendData : trendData);
  const trendTitle = $derived(trendMode === 'daily' ? 'Daily trend' : 'Monthly trend');
  const trendSubtitle = $derived(
    trendMode === 'daily'
      ? `Daily spend in ${currentMonthLabel}`
      : `Total spent over the last ${trendData.length || 6} months`
  );
  const categoryTrendData = $derived.by<CategoryTrend>(() => dashboard.data?.categoryTrend ?? {});
  const spent = $derived(totalSpent(liveExpenses));
  const categoryTotals = $derived(totalsByCategory(liveExpenses, liveCategories));
  const hasExpenses = $derived(liveExpenses.length > 0);
  const hasCategories = $derived(liveCategories.length > 0);
  const hasBudgets = $derived(liveBudgets.length > 0);
  const filteredExpenses = $derived(
    liveExpenses.filter((expense) => {
      const matchesCategory = categoryFilter === 'all' || expense.category === categoryFilter;
      const matchesPaidBy = paidByFilter === 'all' || expense.paidBy === paidByFilter;
      const matchesSearch = !queryText || expense.note.toLowerCase().includes(queryText.toLowerCase());
      return matchesCategory && matchesPaidBy && matchesSearch;
    })
  );
  const filtersActive = $derived(
    categoryFilter !== 'all' || paidByFilter !== 'all' || queryText.trim().length > 0
  );
  const pagedExpenses = $derived(filteredExpenses.slice((page - 1) * pageSize, page * pageSize));
  const pages = $derived(Math.max(1, Math.ceil(filteredExpenses.length / pageSize)));
  const overBudget = $derived(liveBudgets.filter((row) => row.spent > row.budget));
  const onBudgetCount = $derived(liveBudgets.length - overBudget.length);
  const onBudgetPercent = $derived(hasBudgets ? Math.round((onBudgetCount / liveBudgets.length) * 100) : 0);
  const overBudgetPercent = $derived(hasBudgets ? Math.round((overBudget.length / liveBudgets.length) * 100) : 0);
  const currentMonthTrend = $derived(trendData.at(-1)?.amount ?? spent);
  const previousMonthTrend = $derived(trendData.at(-2)?.amount ?? 0);
  const monthDelta = $derived(Number((currentMonthTrend - previousMonthTrend).toFixed(2)));
  const monthDeltaPercent = $derived(
    previousMonthTrend > 0 ? Math.round((monthDelta / previousMonthTrend) * 100) : 0
  );
  const recentExpenses = $derived(liveExpenses.slice(0, 6));
  const topPressure = $derived(
    liveBudgets
      .map((row) => ({ ...row, ratio: row.budget > 0 ? row.spent / row.budget : 0 }))
      .sort((a, b) => b.ratio - a.ratio)
      .slice(0, 5)
  );

  const canSaveExpense = $derived(
    auth.signedIn &&
      hasCategories &&
      draft.note.trim().length > 0 &&
      draft.category !== '' &&
      Number(draft.amount) > 0 &&
      !saving
  );
  const canSaveBudget = $derived(
    auth.signedIn &&
      hasCategories &&
      budgetDraft.category !== '' &&
      budgetDraft.amount.trim() !== '' &&
      Number(budgetDraft.amount) >= 0 &&
      !savingBudget
  );
  const canSaveCategory = $derived(
    auth.signedIn &&
      auth.userSynced &&
      categoryDraft.name.trim().length >= 2 &&
      categoryDraft.color.trim().length > 0 &&
      !savingCategory
  );

  const tabMeta: Record<Tab, { label: string; subtitle: string }> = {
    overview: { label: 'Overview', subtitle: 'A snapshot of this month' },
    expenses: { label: 'Expenses', subtitle: 'Every entry, searchable and filterable' },
    categories: { label: 'Categories', subtitle: 'Where your money is going' },
    budgets: { label: 'Budgets', subtitle: 'Limits, remaining, and pressure' }
  };

  const categoryIconOptions = [
    { value: 'shopping-cart', label: 'Groceries', icon: ShoppingCart },
    { value: 'utensils', label: 'Dining', icon: Utensils },
    { value: 'car', label: 'Transport', icon: Car },
    { value: 'zap', label: 'Utilities', icon: Zap },
    { value: 'shopping-bag', label: 'Shopping', icon: ShoppingBag },
    { value: 'ticket', label: 'Events', icon: Ticket },
    { value: 'user', label: 'Personal', icon: User },
    { value: 'circle-ellipsis', label: 'Misc', icon: CircleEllipsis }
  ];

  const categoryColorOptions = ['#51bf7f', '#ff7a3d', '#4b8ce8', '#f5bd2f', '#a776e8', '#ef6f91', '#20a7b8', '#b7bbc4'];

  function setTab(tab: Tab) {
    activeTab = tab;
    if (tab !== 'expenses') addPanelOpen = false;
    if (tab !== 'budgets') budgetPanelOpen = false;
    if (tab !== 'categories') categoryPanelOpen = false;
  }

  function openExpensePanel() {
    if (!auth.backendReady || !auth.clerkReady) {
      activeTab = 'expenses';
      addPanelOpen = false;
      return;
    }
    if (!auth.signedIn) {
      auth.signIn();
      return;
    }
    if (!auth.userSynced) {
      activeTab = 'expenses';
      addPanelOpen = false;
      return;
    }
    activeTab = 'expenses';
    budgetPanelOpen = false;
    categoryPanelOpen = false;
    formError = '';
    addPanelOpen = true;
  }

  function openCategoryPanel() {
    if (!auth.backendReady || !auth.clerkReady) {
      activeTab = 'categories';
      categoryPanelOpen = false;
      return;
    }
    if (!auth.signedIn) {
      auth.signIn();
      return;
    }
    if (!auth.userSynced) {
      activeTab = 'categories';
      categoryPanelOpen = false;
      return;
    }
    activeTab = 'categories';
    addPanelOpen = false;
    budgetPanelOpen = false;
    categoryError = '';
    categoryPanelOpen = true;
  }

  function openBudgetPanel(categorySlug = '') {
    if (!auth.backendReady || !auth.clerkReady) {
      activeTab = 'budgets';
      budgetPanelOpen = false;
      return;
    }
    if (!auth.signedIn) {
      auth.signIn();
      return;
    }
    if (!auth.userSynced) {
      activeTab = 'budgets';
      budgetPanelOpen = false;
      return;
    }
    const firstCategory = liveCategories[0]?.slug ?? '';
    const selectedCategory = categorySlug || budgetDraft.category || firstCategory;
    const existing = budgetRows.find((row) => row.category === selectedCategory);

    activeTab = 'budgets';
    addPanelOpen = false;
    categoryPanelOpen = false;
    budgetError = '';
    budgetDraft = {
      category: selectedCategory,
      amount: existing?.isSet ? existing.budget.toFixed(2) : ''
    };
    budgetPanelOpen = true;
  }

  function syncBudgetDraftAmount() {
    const existing = budgetRows.find((row) => row.category === budgetDraft.category);
    budgetDraft.amount = existing?.isSet ? existing.budget.toFixed(2) : '';
  }

  async function saveExpense(addAnother = false) {
    formError = '';

    if (!auth.signedIn) {
      auth.signIn();
      return;
    }
    if (!auth.userSynced) {
      formError = 'Finish connecting Clerk to Convex before adding expenses.';
      return;
    }
    if (!draft.note.trim()) {
      formError = 'Add a note for this expense.';
      return;
    }
    if (!draft.category) {
      formError = 'Choose a category.';
      return;
    }
    if (!Number(draft.amount) || Number(draft.amount) <= 0) {
      formError = 'Enter an amount greater than $0.00.';
      return;
    }

    try {
      saving = true;
      await convex.mutation(api.finance.addExpense, {
        date: draft.date,
        note: draft.note,
        categorySlug: draft.category,
        paidBy: draft.paidBy,
        amountCents: Math.round(Number(draft.amount) * 100)
      });
      draft.note = '';
      draft.amount = '';
      draft.category = '';
      if (!addAnother) addPanelOpen = false;
    } catch (error) {
      formError = error instanceof Error ? error.message : 'Could not save this expense.';
    } finally {
      saving = false;
    }
  }

  async function saveCategory() {
    categoryError = '';

    if (!auth.signedIn) {
      auth.signIn();
      return;
    }
    if (!auth.userSynced) {
      categoryError = 'Finish connecting Clerk to Convex before adding categories.';
      return;
    }
    if (categoryDraft.name.trim().length < 2) {
      categoryError = 'Category name must be at least 2 characters.';
      return;
    }

    try {
      savingCategory = true;
      await convex.mutation(api.finance.addCategory, {
        name: categoryDraft.name,
        icon: categoryDraft.icon,
        color: categoryDraft.color
      });
      categoryDraft = {
        name: '',
        icon: 'circle-ellipsis',
        color: '#51bf7f'
      };
      categoryPanelOpen = false;
    } catch (error) {
      categoryError = error instanceof Error ? error.message : 'Could not save this category.';
    } finally {
      savingCategory = false;
    }
  }

  async function saveBudget() {
    budgetError = '';

    if (!auth.signedIn) {
      auth.signIn();
      return;
    }
    if (!auth.userSynced) {
      budgetError = 'Finish connecting Clerk to Convex before setting budgets.';
      return;
    }
    if (!budgetDraft.category) {
      budgetError = 'Choose a category.';
      return;
    }
    if (budgetDraft.amount.trim() === '' || Number.isNaN(Number(budgetDraft.amount))) {
      budgetError = 'Enter a monthly budget amount.';
      return;
    }
    if (Number(budgetDraft.amount) < 0) {
      budgetError = 'Budget amount cannot be negative.';
      return;
    }

    try {
      savingBudget = true;
      await convex.mutation(api.finance.upsertBudget, {
        month: currentMonth,
        categorySlug: budgetDraft.category,
        amountCents: Math.round(Number(budgetDraft.amount) * 100)
      });
      budgetPanelOpen = false;
    } catch (error) {
      budgetError = error instanceof Error ? error.message : 'Could not save this budget.';
    } finally {
      savingBudget = false;
    }
  }

  function resetFilters() {
    categoryFilter = 'all';
    paidByFilter = 'all';
    queryText = '';
    page = 1;
  }

  function category(slug: string) {
    return categoryFor(slug, liveCategories);
  }

  function paidLabel(member: MemberKey) {
    return member === 'me' ? 'Me' : 'Wife';
  }

  function localIsoDate(date: Date) {
    const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
    return local.toISOString().slice(0, 10);
  }

  function softColor(hex: string) {
    const cleaned = hex.replace('#', '');
    const r = parseInt(cleaned.slice(0, 2), 16);
    const g = parseInt(cleaned.slice(2, 4), 16);
    const b = parseInt(cleaned.slice(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, 0.13)`;
  }

  function handleKey(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      if (addPanelOpen) addPanelOpen = false;
      else if (budgetPanelOpen) budgetPanelOpen = false;
      else if (categoryPanelOpen) categoryPanelOpen = false;
    }
  }

  const iconMap = {
    'shopping-cart': ShoppingCart,
    utensils: Utensils,
    car: Car,
    zap: Zap,
    'shopping-bag': ShoppingBag,
    ticket: Ticket,
    'circle-ellipsis': CircleEllipsis,
    user: User
  };
</script>

<svelte:window onkeydown={handleKey} />

{#if authInitializing}
  <main class="auth-screen">
    <section class="auth-panel">
      <span class="auth-mark"><Wallet size={26} /></span>
      <p class="auth-eyebrow">Household finance</p>
      <h1>Preparing Ledger</h1>
      <p>Checking your Clerk session and Convex connection.</p>
    </section>
  </main>
{:else if backendUnavailable}
  <main class="auth-screen">
    <section class="auth-panel">
      <span class="auth-mark warn"><AlertCircle size={26} /></span>
      <p class="auth-eyebrow">Setup required</p>
      <h1>Connect Convex</h1>
      <p>Set <code>PUBLIC_CONVEX_URL</code> and start Convex to enable live household finance data.</p>
    </section>
  </main>
{:else if clerkUnavailable}
  <main class="auth-screen">
    <section class="auth-panel">
      <span class="auth-mark warn"><AlertCircle size={26} /></span>
      <p class="auth-eyebrow">Setup required</p>
      <h1>Connect Clerk</h1>
      <p>Set <code>PUBLIC_CLERK_PUBLISHABLE_KEY</code> to enable sign-in before the tracker loads.</p>
    </section>
  </main>
{:else if signedOut}
  <main class="auth-screen">
    <section class="auth-panel">
      <span class="auth-mark"><Wallet size={26} /></span>
      <p class="auth-eyebrow">Household finance</p>
      <h1>Sign in to open Ledger</h1>
      <p>Create your account first, then sign in any time after that. Only approved household emails can open the tracker.</p>
      <div class="auth-actions">
        <button class="primary-button auth-cta" type="button" onclick={auth.signUp}>
          <UserPlus size={16} /> Create account
        </button>
        <button class="ghost-button auth-cta" type="button" onclick={auth.signIn}>
          <LogIn size={16} /> Sign in
        </button>
      </div>
    </section>
  </main>
{:else}
<div class="shell">
  <aside class="sidebar">
    <div class="brand">
      <span class="brand-mark"><Wallet size={22} strokeWidth={2.2} /></span>
      <div class="brand-text">
        <strong>Ledger</strong>
        <span>household finance</span>
      </div>
    </div>

    <nav class="sidenav" aria-label="Main">
      <button class:active={activeTab === 'overview'} type="button" onclick={() => setTab('overview')}>
        <LayoutDashboard size={17} /> <span>Overview</span>
      </button>
      <button class:active={activeTab === 'expenses'} type="button" onclick={() => setTab('expenses')}>
        <ReceiptText size={17} /> <span>Expenses</span>
        {#if hasExpenses}<em>{liveExpenses.length}</em>{/if}
      </button>
      <button class:active={activeTab === 'categories'} type="button" onclick={() => setTab('categories')}>
        <Tag size={17} /> <span>Categories</span>
        {#if hasCategories}<em>{liveCategories.length}</em>{/if}
      </button>
      <button class:active={activeTab === 'budgets'} type="button" onclick={() => setTab('budgets')}>
        <Target size={17} /> <span>Budgets</span>
        {#if hasBudgets}<em>{liveBudgets.length}</em>{/if}
      </button>
    </nav>

    <div class="sidebar-foot">
      {#if auth.signedIn}
        <div class="user-card">
          <span class="avatar">{(auth.userName || auth.userEmail || '?').slice(0, 1).toUpperCase()}</span>
          <div class="user-meta">
            <strong>{auth.userName || 'Signed in'}</strong>
            <span title={auth.userEmail}>{auth.userEmail}</span>
          </div>
          <button class="icon-button" type="button" onclick={auth.signOut} aria-label="Sign out">
            <LogOut size={16} />
          </button>
        </div>
      {:else if auth.clerkReady}
        <button class="signin-button" type="button" onclick={auth.signIn}>
          <LogIn size={16} /> Sign in
        </button>
      {:else}
        <p class="foot-muted">Authentication unavailable</p>
      {/if}
    </div>
  </aside>

  <div class="main">
    <header class="page-bar">
      <div>
        <h1>{tabMeta[activeTab].label}</h1>
        <p>{tabMeta[activeTab].subtitle}</p>
      </div>
      <div class="bar-actions">
        <div class="month-pill" title="Current period">
          <Calendar size={15} />
          <span>{currentMonthLabel}</span>
        </div>
        {#if activeTab === 'budgets'}
          <button class="primary-button" type="button" disabled={!auth.userSynced} onclick={() => openBudgetPanel()}>
            <Target size={15} /> Set budget
          </button>
        {:else if activeTab === 'categories'}
          <button class="primary-button" type="button" disabled={!auth.userSynced} onclick={openCategoryPanel}>
            <Plus size={15} /> Add category
          </button>
        {:else}
          <button class="primary-button" type="button" disabled={!auth.userSynced} onclick={openExpensePanel}>
            <Plus size={15} /> Add expense
          </button>
        {/if}
      </div>
    </header>

    {#if hasNotice}
      <section class="notice" aria-live="polite">
        <span class="notice-icon"><AlertCircle size={18} /></span>
        <div class="notice-body">
          {#if backendUnavailable}
            <strong>Convex is not configured.</strong>
            <span>Set <code>PUBLIC_CONVEX_URL</code> and start <code>npx convex dev</code> to enable real-time sync.</span>
          {:else if clerkUnavailable}
            <strong>Clerk is not configured.</strong>
            <span>Set <code>PUBLIC_CLERK_PUBLISHABLE_KEY</code> to enable sign-in.</span>
          {:else if auth.syncError}
            <strong>Could not prepare your account.</strong>
            <span>{auth.syncError}</span>
          {:else if dashboardError}
            <strong>Could not load dashboard.</strong>
            <span>{dashboardError}</span>
          {/if}
        </div>
      </section>
    {/if}

    <div class="page-body">
      {#if blockingError && !dashboard.data}
        <section class="card state-card">
          {@render EmptyState({ title: 'Account setup needs attention', body: blockingError, action: 'Retry connection', onAction: auth.retrySync })}
        </section>
      {:else if isPreparingAccount && !dashboard.data}
        {@render LoadingState({ title: 'Preparing your household', body: 'Connecting Clerk to Convex and creating your starter categories.' })}
      {:else if isLoadingDashboard && !dashboard.data}
        {@render LoadingState({ title: 'Loading your dashboard', body: 'Fetching your latest data from Convex.' })}
      {:else if activeTab === 'overview'}
        {@render OverviewBlock()}
      {:else if activeTab === 'expenses'}
        {@render ExpensesBlock()}
      {:else if activeTab === 'categories'}
        {@render CategoriesBlock()}
      {:else}
        {@render BudgetsBlock()}
      {/if}
    </div>
  </div>

  {#if addPanelOpen}
    <button class="drawer-scrim" type="button" aria-label="Close add expense" onclick={() => (addPanelOpen = false)}></button>
    <div class="drawer" role="dialog" aria-modal="true" aria-labelledby="add-expense-title">
      <header class="drawer-head">
        <div>
          <h2 id="add-expense-title">Add expense</h2>
          <p>Logged to {currentMonthLabel}</p>
        </div>
        <button class="icon-button" type="button" onclick={() => (addPanelOpen = false)} aria-label="Close">
          <X size={18} />
        </button>
      </header>

      <form class="drawer-body" onsubmit={(event) => { event.preventDefault(); saveExpense(false); }}>
        <label class="field">
          <span>Date</span>
          <input type="date" bind:value={draft.date} />
        </label>

        <label class="field">
          <span>Note</span>
          <input type="text" bind:value={draft.note} placeholder="e.g. Groceries at Whole Foods" />
        </label>

        <label class="field">
          <span>Category</span>
          <div class="select-wrap">
            <select bind:value={draft.category} disabled={!hasCategories}>
              <option value="">{hasCategories ? 'Select category' : 'Add a category first'}</option>
              {#each liveCategories as option}
                <option value={option.slug}>{option.name}</option>
              {/each}
            </select>
            <ChevronDown size={14} />
          </div>
        </label>

        {#if !hasCategories}
          <div class="form-callout">
            <p>No categories yet. Add one before recording expenses.</p>
            <button class="ghost-button" type="button" onclick={() => { addPanelOpen = false; openCategoryPanel(); }}>
              <Plus size={14} /> Add category
            </button>
          </div>
        {/if}

        <div class="field">
          <span>Paid by</span>
          <div class="segmented">
            <button type="button" class:active={draft.paidBy === 'me'} onclick={() => (draft.paidBy = 'me')}>Me</button>
            <button type="button" class:active={draft.paidBy === 'wife'} onclick={() => (draft.paidBy = 'wife')}>Wife</button>
          </div>
        </div>

        <label class="field">
          <span>Amount</span>
          <div class="amount-input">
            <span class="prefix">$</span>
            <input type="text" inputmode="decimal" bind:value={draft.amount} placeholder="0.00" />
          </div>
        </label>

        {#if formError}<p class="form-error">{formError}</p>{/if}

        <button class="primary-button block" type="submit" disabled={!canSaveExpense}>
          {saving ? 'Saving...' : 'Save expense'}
        </button>
        <button class="ghost-button block" type="button" disabled={!canSaveExpense} onclick={() => saveExpense(true)}>
          Save and add another
        </button>
      </form>
    </div>
  {/if}

  {#if categoryPanelOpen}
    <button class="drawer-scrim" type="button" aria-label="Close add category" onclick={() => (categoryPanelOpen = false)}></button>
    <div class="drawer" role="dialog" aria-modal="true" aria-labelledby="add-category-title">
      <header class="drawer-head">
        <div>
          <h2 id="add-category-title">Add category</h2>
          <p>Available to both household members</p>
        </div>
        <button class="icon-button" type="button" onclick={() => (categoryPanelOpen = false)} aria-label="Close">
          <X size={18} />
        </button>
      </header>

      <form class="drawer-body" onsubmit={(event) => { event.preventDefault(); saveCategory(); }}>
        <label class="field">
          <span>Name</span>
          <input type="text" bind:value={categoryDraft.name} placeholder="e.g. Health, Travel, Home" />
        </label>

        <div class="field">
          <span>Icon</span>
          <div class="icon-picker">
            {#each categoryIconOptions as option}
              {@const Icon = option.icon}
              <button
                type="button"
                class:active={categoryDraft.icon === option.value}
                onclick={() => (categoryDraft.icon = option.value)}
                aria-label={option.label}
                title={option.label}
              >
                <Icon size={17} />
              </button>
            {/each}
          </div>
        </div>

        <div class="field">
          <span>Color</span>
          <div class="color-picker">
            {#each categoryColorOptions as color}
              <button
                type="button"
                class:active={categoryDraft.color === color}
                style={`--swatch:${color};`}
                onclick={() => (categoryDraft.color = color)}
                aria-label={`Use color ${color}`}
                title={color}
              ></button>
            {/each}
          </div>
        </div>

        {#if categoryError}<p class="form-error">{categoryError}</p>{/if}

        <button class="primary-button block" type="submit" disabled={!canSaveCategory}>
          {savingCategory ? 'Saving...' : 'Save category'}
        </button>
      </form>
    </div>
  {/if}

  {#if budgetPanelOpen}
    <button class="drawer-scrim" type="button" aria-label="Close set budget" onclick={() => (budgetPanelOpen = false)}></button>
    <div class="drawer" role="dialog" aria-modal="true" aria-labelledby="set-budget-title">
      <header class="drawer-head">
        <div>
          <h2 id="set-budget-title">Set budget</h2>
          <p>Applies to {currentMonthLabel}</p>
        </div>
        <button class="icon-button" type="button" onclick={() => (budgetPanelOpen = false)} aria-label="Close">
          <X size={18} />
        </button>
      </header>

      <form class="drawer-body" onsubmit={(event) => { event.preventDefault(); saveBudget(); }}>
        <label class="field">
          <span>Category</span>
          <div class="select-wrap">
            <select bind:value={budgetDraft.category} onchange={syncBudgetDraftAmount} disabled={!hasCategories}>
              {#if !hasCategories}<option value="">Add a category first</option>{/if}
              {#each liveCategories as option}
                <option value={option.slug}>{option.name}</option>
              {/each}
            </select>
            <ChevronDown size={14} />
          </div>
        </label>

        <label class="field">
          <span>Monthly limit</span>
          <div class="amount-input">
            <span class="prefix">$</span>
            <input type="text" inputmode="decimal" bind:value={budgetDraft.amount} placeholder="0.00" />
          </div>
        </label>

        {#if hasCategories}
          <p class="form-helper">Enter <code>0</code> to clear this category's budget for the month.</p>
        {:else}
          <div class="form-callout">
            <p>Add a category before setting a budget.</p>
            <button class="ghost-button" type="button" onclick={() => { budgetPanelOpen = false; openCategoryPanel(); }}>
              <Plus size={14} /> Add category
            </button>
          </div>
        {/if}
        {#if budgetError}<p class="form-error">{budgetError}</p>{/if}

        <button class="primary-button block" type="submit" disabled={!canSaveBudget}>
          {savingBudget ? 'Saving...' : 'Save budget'}
        </button>
      </form>
    </div>
  {/if}
</div>
{/if}

<!-- ----- Page blocks ----- -->

{#snippet OverviewBlock()}
  <section class="kpi-grid">
    {@render KpiCard({
      icon: Coins,
      label: 'Spent this month',
      value: money(spent),
      foot: previousMonthTrend > 0 ? null : 'No prior month yet',
      delta: previousMonthTrend > 0 ? { value: monthDelta, percent: monthDeltaPercent, baseline: 'vs last month' } : null
    })}
    {@render KpiCard({
      icon: ReceiptText,
      label: 'Entries',
      value: String(liveExpenses.length),
      foot: `${categoryTotals.length} categor${categoryTotals.length === 1 ? 'y' : 'ies'} active`
    })}
    {@render KpiCard({
      icon: CheckCircle2,
      tone: 'ok',
      label: 'On budget',
      value: `${onBudgetCount}${hasBudgets ? ` / ${liveBudgets.length}` : ''}`,
      foot: hasBudgets ? `${onBudgetPercent}% within limits` : 'No budgets set'
    })}
    {@render KpiCard({
      icon: AlertCircle,
      tone: overBudget.length > 0 ? 'danger' : 'muted',
      label: 'Over budget',
      value: String(overBudget.length),
      foot: hasBudgets ? `${overBudgetPercent}% of budgets` : 'Set a budget to track'
    })}
  </section>

  <section class="grid-2">
    <article class="card span-2">
      <header class="card-head trend-head">
        <div>
          <h2>{trendTitle}</h2>
          <p class="muted">{trendSubtitle}</p>
        </div>
        <div class="trend-toggle" role="group" aria-label="Trend granularity">
          <button
            class:active={trendMode === 'daily'}
            type="button"
            aria-pressed={trendMode === 'daily'}
            onclick={() => (trendMode = 'daily')}
          >
            Daily
          </button>
          <button
            class:active={trendMode === 'monthly'}
            type="button"
            aria-pressed={trendMode === 'monthly'}
            onclick={() => (trendMode = 'monthly')}
          >
            Monthly
          </button>
        </div>
      </header>
      {@render BarTrend({ points: visibleTrendData })}
    </article>

    <article class="card">
      <header class="card-head">
        <div>
          <h2>By category</h2>
          <p class="muted">Share of {currentMonthLabel} spend</p>
        </div>
        <button class="link-button" type="button" onclick={() => setTab('categories')}>
          See all <ChevronRight size={13} />
        </button>
      </header>
      {#if categoryTotals.length > 0}
        <div class="donut-row">
          {@render Donut({ totals: categoryTotals, total: spent })}
          {@render Legend({ totals: categoryTotals.slice(0, 5), total: spent, compact: true })}
        </div>
      {:else}
        {@render EmptyState({ title: 'No spending yet', body: 'Once expenses arrive they will break out by category here.' })}
      {/if}
    </article>
  </section>

  <section class="grid-2">
    <article class="card span-2">
      <header class="card-head">
        <div>
          <h2>Recent expenses</h2>
          <p class="muted">{recentExpenses.length} of {liveExpenses.length} entries</p>
        </div>
        <button class="link-button" type="button" onclick={() => setTab('expenses')}>
          View all <ChevronRight size={13} />
        </button>
      </header>
      {#if recentExpenses.length > 0}
        <div class="table-wrap">
          <table class="data-table">
            <thead>
              <tr><th>Date</th><th>Note</th><th>Category</th><th>Paid by</th><th class="num">Amount</th></tr>
            </thead>
            <tbody>
              {#each recentExpenses as expense}
                <tr>
                  <td class="muted-cell">{dayLabel(expense.date)}</td>
                  <td class="note-cell">{expense.note}</td>
                  <td>{@render CategoryPill({ category: category(expense.category) })}</td>
                  <td>{@render PaidPill({ paidBy: expense.paidBy })}</td>
                  <td class="num">{money(expense.amount)}</td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      {:else}
        {@render EmptyState({
          title: 'No expenses recorded',
          body: hasCategories ? 'Add your first expense to start the ledger for this month.' : 'Add a category before recording expenses.',
          action: hasCategories ? 'Add expense' : 'Add category',
          onAction: hasCategories ? openExpensePanel : openCategoryPanel
        })}
      {/if}
    </article>

    <article class="card">
      <header class="card-head">
        <div>
          <h2>Budget pressure</h2>
          <p class="muted">Highest utilization first</p>
        </div>
        <button class="link-button" type="button" onclick={() => setTab('budgets')}>
          Manage <ChevronRight size={13} />
        </button>
      </header>
      {#if topPressure.length > 0}
        <ul class="pressure-list">
          {#each topPressure as row}
            {@const cat = category(row.category)}
            {@const pct = row.budget > 0 ? Math.round((row.spent / row.budget) * 100) : 0}
            {@const over = row.spent > row.budget}
            <li>
              <header>
                {@render CategoryPill({ category: cat })}
                <strong class:over>{pct}%</strong>
              </header>
              <div class="rail">
                <span style={`width:${Math.min(100, pct)}%; background:${over ? 'var(--danger)' : cat.color};`}></span>
              </div>
              <footer>
                <span>{money(row.spent)} of {money(row.budget)}</span>
                <span class:over>{over ? `${money(row.spent - row.budget)} over` : `${money(row.budget - row.spent)} left`}</span>
              </footer>
            </li>
          {/each}
        </ul>
      {:else}
        {@render EmptyState({
          title: 'No budgets set',
          body: hasCategories ? 'Set a limit on any category to see pressure indicators here.' : 'Add a category before setting budgets.',
          action: hasCategories ? 'Set budget' : 'Add category',
          onAction: hasCategories ? () => openBudgetPanel() : openCategoryPanel
        })}
      {/if}
    </article>
  </section>
{/snippet}

{#snippet ExpensesBlock()}
  <section class="kpi-grid two-up">
    {@render KpiCard({ icon: Coins, label: `Spent in ${currentMonthLabel}`, value: money(spent), foot: `${liveExpenses.length} entries` })}
    {@render KpiCard({ icon: SlidersHorizontal, label: 'After filters', value: money(totalSpent(filteredExpenses)), foot: `${filteredExpenses.length} matching` })}
  </section>

  <section class="card filters-card">
    <div class="filters">
      <label class="search">
        <Search size={15} />
        <input type="text" bind:value={queryText} placeholder="Search notes" oninput={() => (page = 1)} />
        {#if queryText}<button class="clear-x" type="button" onclick={() => { queryText = ''; page = 1; }} aria-label="Clear search"><X size={13} /></button>{/if}
      </label>

      <div class="select-wrap">
        <select bind:value={categoryFilter} onchange={() => (page = 1)}>
          <option value="all">All categories</option>
          {#each liveCategories as option}
            <option value={option.slug}>{option.name}</option>
          {/each}
        </select>
        <ChevronDown size={14} />
      </div>

      <div class="paid-toggle">
        <button class:active={paidByFilter === 'all'} type="button" onclick={() => { paidByFilter = 'all'; page = 1; }}>All</button>
        <button class:active={paidByFilter === 'me'} type="button" onclick={() => { paidByFilter = 'me'; page = 1; }}>Me</button>
        <button class:active={paidByFilter === 'wife'} type="button" onclick={() => { paidByFilter = 'wife'; page = 1; }}>Wife</button>
      </div>

      <button class="ghost-button" type="button" onclick={resetFilters} disabled={!filtersActive}>
        <X size={14} /> Clear
      </button>
    </div>
  </section>

  <section class="card">
    {#if pagedExpenses.length > 0}
      <div class="table-wrap">
        <table class="data-table expenses-table">
          <thead>
            <tr><th>Date</th><th>Note</th><th>Category</th><th>Paid by</th><th class="num">Amount</th></tr>
          </thead>
          <tbody>
            {#each pagedExpenses as expense}
              <tr>
                <td class="muted-cell">{dayLabel(expense.date, true)}</td>
                <td class="note-cell">{expense.note}</td>
                <td>{@render CategoryPill({ category: category(expense.category) })}</td>
                <td>{@render PaidPill({ paidBy: expense.paidBy })}</td>
                <td class="num">{money(expense.amount)}</td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
      <footer class="table-foot">
        <span class="muted">
          Showing {(page - 1) * pageSize + 1}-{Math.min(page * pageSize, filteredExpenses.length)} of {filteredExpenses.length}
        </span>
        <div class="pager">
          <button type="button" disabled={page === 1} onclick={() => (page -= 1)} aria-label="Previous page">
            <ChevronLeft size={14} />
          </button>
          {#each Array(pages) as _, index}
            <button type="button" class:active={page === index + 1} onclick={() => (page = index + 1)}>
              {index + 1}
            </button>
          {/each}
          <button type="button" disabled={page === pages} onclick={() => (page += 1)} aria-label="Next page">
            <ChevronRight size={14} />
          </button>
        </div>
      </footer>
    {:else if liveExpenses.length === 0}
      {@render EmptyState({
        title: 'No expenses yet',
        body: hasCategories ? 'Add your first expense to populate the ledger.' : 'Add a category before recording expenses.',
        action: hasCategories ? 'Add expense' : 'Add category',
        onAction: hasCategories ? openExpensePanel : openCategoryPanel
      })}
    {:else}
      {@render EmptyState({
        title: 'No matching expenses',
        body: 'Try a different search term, clear filters, or pick another category.',
        action: 'Clear filters',
        onAction: resetFilters
      })}
    {/if}
  </section>
{/snippet}

{#snippet CategoriesBlock()}
  <section class="kpi-grid">
    {@render KpiCard({
      icon: Coins,
      label: 'Total spent',
      value: money(spent),
      delta: previousMonthTrend > 0 ? { value: monthDelta, percent: monthDeltaPercent, baseline: 'vs last month' } : null,
      foot: previousMonthTrend > 0 ? null : 'No prior month yet'
    })}
    {@render KpiCard({ icon: Tag, label: 'Categories', value: String(liveCategories.length), foot: `${categoryTotals.length} with spending` })}
    {@render KpiCard({ icon: CheckCircle2, tone: 'ok', label: 'On budget', value: String(onBudgetCount), foot: hasBudgets ? `${onBudgetPercent}% within limits` : 'No budgets set' })}
    {@render KpiCard({ icon: AlertCircle, tone: overBudget.length > 0 ? 'danger' : 'muted', label: 'Over budget', value: String(overBudget.length), foot: hasBudgets ? `${overBudgetPercent}% of budgets` : 'Set a budget to track' })}
  </section>

  <section class="card">
    <header class="card-head">
      <div>
        <h2>Category library</h2>
        <p class="muted">Categories are shared by both household members</p>
      </div>
      <button class="primary-button small" type="button" onclick={openCategoryPanel}>
        <Plus size={14} /> Add category
      </button>
    </header>

    {#if liveCategories.length > 0}
      <ul class="category-library">
        {#each liveCategories as item}
          {@const spentForCategory = categoryTotals.find((row) => row.category.slug === item.slug)?.amount ?? 0}
          {@const budgetForCategory = budgetRows.find((row) => row.category === item.slug)}
          <li>
            <div>
              {@render CategoryPill({ category: item })}
              <span class="muted">Spent {money(spentForCategory)} this month</span>
            </div>
            <div class="category-library-actions">
              <span class="muted">{budgetForCategory?.isSet ? `${money(budgetForCategory.budget)} budget` : 'No budget'}</span>
              <button class="row-action" type="button" onclick={() => openBudgetPanel(item.slug)}>
                {budgetForCategory?.isSet ? 'Edit budget' : 'Set budget'}
              </button>
            </div>
          </li>
        {/each}
      </ul>
    {:else}
      {@render EmptyState({
        title: 'No categories yet',
        body: 'Add your first category before recording expenses or budgets.',
        action: 'Add category',
        onAction: openCategoryPanel
      })}
    {/if}
  </section>

  <section class="grid-2">
    <article class="card span-2">
      <header class="card-head">
        <div>
          <h2>Spending by category</h2>
          <p class="muted">{currentMonthLabel}</p>
        </div>
      </header>
      {#if categoryTotals.length > 0}
        <ul class="category-rows">
          {#each categoryTotals as item}
            {@const pct = categoryPercent(item.amount, spent)}
            <li>
              <div class="cat-head">
                {@render CategoryPill({ category: item.category })}
                <strong>{money(item.amount)}</strong>
                <span class="pct" style={`color:${item.category.color}; background:${item.category.soft};`}>{pct}%</span>
              </div>
              <div class="rail">
                <span style={`width:${pct}%; background:${item.category.color};`}></span>
              </div>
            </li>
          {/each}
        </ul>
      {:else}
        {@render EmptyState({ title: 'No spending yet', body: 'Category totals will update as expenses are added.' })}
      {/if}
    </article>

    <article class="card">
      <header class="card-head">
        <div>
          <h2>Distribution</h2>
          <p class="muted">Share of total</p>
        </div>
      </header>
      {#if categoryTotals.length > 0}
        <div class="donut-row">
          {@render Donut({ totals: categoryTotals, total: spent })}
          {@render Legend({ totals: categoryTotals, total: spent, compact: true })}
        </div>
      {:else}
        {@render EmptyState({ title: 'No distribution', body: 'Once spending arrives the donut will fill in.' })}
      {/if}
    </article>
  </section>

  <section class="card">
    <header class="card-head">
      <div>
        <h2>Trend by category</h2>
        <p class="muted">Last 6 months</p>
      </div>
    </header>
    {@render LineTrend({ points: categoryTrendData })}
  </section>
{/snippet}

{#snippet BudgetsBlock()}
  <section class="kpi-grid two-up">
    {@render KpiCard({ icon: CheckCircle2, tone: 'ok', label: 'On budget', value: String(onBudgetCount), foot: hasBudgets ? `${onBudgetPercent}% of ${liveBudgets.length}` : 'No budgets set' })}
    {@render KpiCard({ icon: AlertCircle, tone: overBudget.length > 0 ? 'danger' : 'muted', label: 'Over budget', value: String(overBudget.length), foot: hasBudgets ? `${overBudgetPercent}% of ${liveBudgets.length}` : 'Set a budget to track' })}
  </section>

  <section class="card">
    <header class="card-head">
      <div>
        <h2>Monthly budgets</h2>
        <p class="muted">Limits and remaining balances for {currentMonthLabel}</p>
      </div>
      <button class="primary-button small" type="button" onclick={() => openBudgetPanel()}>
        <Plus size={14} /> Set budget
      </button>
    </header>

    {#if budgetRows.length > 0}
      <div class="table-wrap">
        <table class="data-table budget-table">
          <thead>
            <tr>
              <th>Category</th>
              <th>Limit</th>
              <th>Spent</th>
              <th>Remaining</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {#each budgetRows as row}
              {@const item = category(row.category)}
              {@const remaining = row.budget - row.spent}
              {@const over = row.isSet && remaining < 0}
              <tr>
                <td>{@render CategoryPill({ category: item })}</td>
                <td>{row.isSet ? money(row.budget) : 'Not set'}</td>
                <td>
                  {#if row.isSet}
                    <div class="cell-bar">
                      <div class="rail mini">
                        <span style={`width:${Math.min(100, row.budget > 0 ? (row.spent / row.budget) * 100 : 0)}%; background:${over ? 'var(--danger)' : item.color};`}></span>
                      </div>
                      <span>{money(row.spent)}</span>
                    </div>
                  {:else}
                    <span class="muted-cell">{money(row.spent)}</span>
                  {/if}
                </td>
                <td class:negative={over}>{row.isSet ? money(remaining) : 'Set a limit'}</td>
                <td>
                  {#if !row.isSet}
                    <span class="status status-unset">Unset</span>
                  {:else if over}
                    <span class="status status-over">Over</span>
                  {:else}
                    <span class="status status-ok">On track</span>
                  {/if}
                </td>
                <td class="num">
                  <button class="row-action" type="button" onclick={() => openBudgetPanel(row.category)}>
                    {row.isSet ? 'Edit' : 'Set'}
                  </button>
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    {:else}
      {@render EmptyState({
        title: 'No categories yet',
        body: 'Add your first category before setting monthly limits.',
        action: 'Add category',
        onAction: openCategoryPanel
      })}
    {/if}
  </section>

  <section class="grid-2">
    <article class="card span-2">
      <header class="card-head">
        <div>
          <h2>Budget pressure</h2>
          <p class="muted">Categories closest to their limit</p>
        </div>
      </header>
      {#if topPressure.length > 0}
        <ul class="pressure-list horizontal">
          {#each topPressure as row}
            {@const cat = category(row.category)}
            {@const pct = row.budget > 0 ? Math.round((row.spent / row.budget) * 100) : 0}
            {@const over = row.spent > row.budget}
            <li>
              <header>
                {@render CategoryPill({ category: cat })}
                <strong class:over>{pct}%</strong>
              </header>
              <div class="rail">
                <span style={`width:${Math.min(100, pct)}%; background:${over ? 'var(--danger)' : cat.color};`}></span>
              </div>
              <footer>
                <span>{money(row.spent)} of {money(row.budget)}</span>
                <span class:over>{over ? `${money(row.spent - row.budget)} over` : `${money(row.budget - row.spent)} left`}</span>
              </footer>
            </li>
          {/each}
        </ul>
      {:else}
        {@render EmptyState({
          title: 'No budgets to track',
          body: hasCategories ? 'Set a budget to see how close each category is to its monthly limit.' : 'Add a category before setting budgets.',
          action: hasCategories ? 'Set budget' : 'Add category',
          onAction: hasCategories ? () => openBudgetPanel() : openCategoryPanel
        })}
      {/if}
    </article>

    <article class="card">
      <header class="card-head">
        <div>
          <h2>Suggested next budget</h2>
          <p class="muted">Largest categories without a limit</p>
        </div>
      </header>
      {@render SuggestedBudgets()}
    </article>
  </section>
{/snippet}

<!-- ----- Shared snippets ----- -->

{#snippet LoadingState({ title = 'Loading...', body = 'Fetching your latest data from Convex.' }: { title?: string; body?: string })}
  <section class="kpi-grid">
    {#each Array(4) as _}
      <div class="skeleton kpi-skeleton"></div>
    {/each}
  </section>
  <section class="grid-2">
    <div class="skeleton card-skeleton span-2"></div>
    <div class="skeleton card-skeleton"></div>
  </section>
  <section class="card">
    <header class="card-head">
      <div><h2>{title}</h2><p class="muted">{body}</p></div>
    </header>
    <div class="row-skeletons" aria-label="Loading entries">
      {#each Array(6) as _}
        <span class="row-skeleton"></span>
      {/each}
    </div>
  </section>
{/snippet}

{#snippet EmptyState({ title, body, action, onAction }: { title: string; body: string; action?: string; onAction?: () => void })}
  <div class="empty-state">
    <span class="empty-mark"><PiggyBank size={22} /></span>
    <strong>{title}</strong>
    <p>{body}</p>
    {#if action && onAction}
      <button class="ghost-button" type="button" onclick={onAction}>{action}</button>
    {/if}
  </div>
{/snippet}

{#snippet KpiCard({ icon, label, value, foot = null, delta = null, tone = 'default' }: { icon: any; label: string; value: string; foot?: string | null; delta?: { value: number; percent: number; baseline: string } | null; tone?: 'default' | 'ok' | 'danger' | 'muted' })}
  {@const Icon = icon}
  <article class={`kpi tone-${tone}`}>
    <div class="kpi-head">
      <span class="kpi-icon"><Icon size={16} /></span>
      <span class="kpi-label">{label}</span>
    </div>
    <strong class="kpi-value">{value}</strong>
    {#if delta}
      <span class={`kpi-delta ${delta.value <= 0 ? 'down' : 'up'}`}>
        {#if delta.value <= 0}
          <ArrowDownRight size={13} />
        {:else}
          <ArrowUpRight size={13} />
        {/if}
        {money(Math.abs(delta.value))}
        <em>({Math.abs(delta.percent)}% {delta.baseline})</em>
      </span>
    {:else if foot}
      <span class="kpi-foot">{foot}</span>
    {/if}
  </article>
{/snippet}

{#snippet CategoryPill({ category }: { category: Category })}
  {@const Icon = iconMap[category.icon as keyof typeof iconMap] ?? CircleEllipsis}
  <span class="cat-pill" style={`--pill-color:${category.color}; --pill-bg:${category.soft};`}>
    <Icon size={14} />
    {category.name}
  </span>
{/snippet}

{#snippet PaidPill({ paidBy }: { paidBy: MemberKey })}
  <span class={`paid-pill paid-${paidBy}`}>
    <span class="dot"></span>
    {paidLabel(paidBy)}
  </span>
{/snippet}

{#snippet Donut({ totals, total }: { totals: ReturnType<typeof totalsByCategory>; total: number })}
  {@const stops = total > 0 ? totals.reduce((segments, item, index) => {
    const start = index === 0 ? 0 : segments[index - 1].end;
    const end = start + (item.amount / total) * 100;
    segments.push({ color: item.category.color, start, end });
    return segments;
  }, [] as { color: string; start: number; end: number }[]) : []}
  <div
    class:empty={total <= 0}
    class="donut"
    style={total > 0 ? `background: conic-gradient(${stops.map((segment) => `${segment.color} ${segment.start}% ${segment.end}%`).join(', ')});` : ''}
  >
    <div class="donut-inner">
      <span class="donut-label">Total</span>
      <strong>{money(total)}</strong>
    </div>
  </div>
{/snippet}

{#snippet Legend({ totals, total, compact = false }: { totals: ReturnType<typeof totalsByCategory>; total: number; compact?: boolean })}
  <ul class:compact class="legend">
    {#if totals.length > 0}
      {#each totals as item}
        <li>
          <span class="swatch" style={`background:${item.category.color};`}></span>
          <span class="legend-name">{item.category.name}</span>
          <strong>{compact ? `${categoryPercent(item.amount, total)}%` : money(item.amount)}</strong>
        </li>
      {/each}
    {:else}
      <li class="muted">No spending yet</li>
    {/if}
  </ul>
{/snippet}

{#snippet BarTrend({ points }: { points: TrendPoint[] })}
  {#if points.length > 0}
    {@const max = Math.max(1, ...points.map((p) => p.amount))}
    <div class="bar-trend">
      <div
        class="bars"
        class:compact={points.length > 12}
        style={points.length > 12 ? `min-width:${points.length * 30}px;` : ''}
      >
        {#each points as point, index}
          {@const height = max > 0 ? Math.round((point.amount / max) * 100) : 0}
          <div class="bar-col">
            <div class="bar-track">
              <span class:current={index === points.length - 1} style={`height:${height}%`}>
                {#if index === points.length - 1 && point.amount > 0}
                  <em class="bar-tooltip">{money(point.amount)}</em>
                {/if}
              </span>
            </div>
            <span class="bar-label">{point.label}</span>
          </div>
        {/each}
      </div>
    </div>
  {:else}
    {@render EmptyState({ title: 'No trend data yet', body: 'Monthly totals will appear here as you add expenses.' })}
  {/if}
{/snippet}

{#snippet LineTrend({ points }: { points: CategoryTrend })}
  {@const entries = Object.entries(points).filter(([, values]) => values.some((value) => value > 0))}
  {@const longest = Math.max(0, ...entries.map(([, values]) => values.length))}
  {@const maxPoint = Math.max(1, ...entries.flatMap(([, values]) => values))}
  {@const stride = longest > 1 ? (560 - 40) / (longest - 1) : 0}
  <div class="line-trend">
    {#if entries.length > 0 && longest > 0}
      <svg viewBox="0 0 600 220" role="img" aria-label="Spending trend by category" preserveAspectRatio="none">
        <g class="grid-lines">
          {#each [20, 60, 100, 140, 180] as y}
            <line x1="40" x2="560" y1={y} y2={y} />
          {/each}
        </g>
        {#each entries as [slug, values]}
          {@const item = category(slug)}
          {@const path = values
            .map((value, index) => `${40 + index * stride},${190 - (value / maxPoint) * 160}`)
            .join(' ')}
          <polyline points={path} fill="none" stroke={item.color} stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" />
          {#each values as v, i}
            <circle cx={40 + i * stride} cy={190 - (v / maxPoint) * 160} r="3" fill={item.color} />
          {/each}
        {/each}
      </svg>
      <ul class="legend compact">
        {#each entries as [slug]}
          {@const item = category(slug)}
          <li>
            <span class="swatch" style={`background:${item.color};`}></span>
            <span class="legend-name">{item.name}</span>
          </li>
        {/each}
      </ul>
    {:else}
      {@render EmptyState({ title: 'No trend yet', body: 'Add expenses across months to compare category movement.' })}
    {/if}
  </div>
{/snippet}

{#snippet SuggestedBudgets()}
  {@const candidates = budgetRows
    .filter((row) => !row.isSet && row.spent > 0)
    .sort((a, b) => b.spent - a.spent)
    .slice(0, 4)}
  {#if candidates.length > 0}
    <ul class="suggest-list">
      {#each candidates as row}
        {@const cat = category(row.category)}
        <li>
          {@render CategoryPill({ category: cat })}
          <span class="muted">Spent {money(row.spent)}</span>
          <button class="ghost-button" type="button" onclick={() => openBudgetPanel(row.category)}>Set</button>
        </li>
      {/each}
    </ul>
  {:else if liveBudgets.length === liveCategories.length && hasCategories}
    {@render EmptyState({ title: 'Every category has a budget', body: 'Nice, there is nothing left to suggest.' })}
  {:else if !hasCategories}
    {@render EmptyState({
      title: 'Add categories first',
      body: 'Budget suggestions appear after categories and expenses exist.',
      action: 'Add category',
      onAction: openCategoryPanel
    })}
  {:else}
    {@render EmptyState({ title: 'Nothing to suggest', body: 'Categories without spending or budgets will appear here as suggestions.' })}
  {/if}
{/snippet}
