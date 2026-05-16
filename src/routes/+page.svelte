<script lang="ts">
  import {
    BadgeDollarSign,
    CalendarDays,
    Car,
    ChevronDown,
    ChevronLeft,
    ChevronRight,
    CircleEllipsis,
    Home,
    ListFilter,
    Plus,
    ReceiptText,
    Search,
    ShoppingBag,
    ShoppingCart,
    Tag,
    Target,
    Ticket,
    User,
    Utensils,
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

  const currentMonth = '2025-05';
  const currentMonthLabel = 'May 2025';
  const auth = getContext<AuthState>(AUTH_CONTEXT);
  const convex = useConvexClient();
  const dashboard = useQuery(
    api.finance.dashboard,
    () => (auth.signedIn ? { month: currentMonth } : 'skip'),
    { keepPreviousData: true }
  );

  let activeTab = $state<Tab>('overview');
  let addPanelOpen = $state(false);
  let budgetPanelOpen = $state(false);
  let queryText = $state('');
  let categoryFilter = $state('all');
  let paidByFilter = $state<'all' | MemberKey>('all');
  let page = $state(1);
  let formError = $state('');
  let budgetError = $state('');
  let saving = $state(false);
  let savingBudget = $state(false);
  let draft = $state({
    date: '2025-05-18',
    note: '',
    category: '',
    paidBy: 'me' as MemberKey,
    amount: ''
  });
  let budgetDraft = $state({
    category: '',
    amount: ''
  });

  const appUnavailable = $derived(!auth.backendReady || !auth.clerkReady || !auth.signedIn);
  const isLoadingDashboard = $derived(auth.signedIn && dashboard.isLoading);
  const dashboardError = $derived(dashboard.error?.message ?? '');

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
    const categoryById = new Map(dashboard.data.categories.map((category: any) => [category._id, category.slug]));
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
    const categoryById = new Map<string, string>(dashboard.data.categories.map((category: any) => [category._id, category.slug]));
    const budgetsBySlug = new Map<string, number>(
      dashboard.data.budgets.map((budget: any) => [categoryById.get(budget.categoryId) ?? 'misc', budget.amountCents / 100])
    );
    const spentBySlug = new Map(totalsByCategory(liveExpenses, liveCategories).map((item) => [item.category.slug, item.amount]));

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
  const categoryTrendData = $derived.by<CategoryTrend>(() => dashboard.data?.categoryTrend ?? {});
  const spent = $derived(totalSpent(liveExpenses));
  const categoryTotals = $derived(totalsByCategory(liveExpenses, liveCategories));
  const topExpenses = $derived(liveExpenses.slice(0, 8));
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
  const pagedExpenses = $derived(filteredExpenses.slice((page - 1) * 8, page * 8));
  const pages = $derived(Math.max(1, Math.ceil(filteredExpenses.length / 8)));
  const overBudget = $derived(liveBudgets.filter((row) => row.spent > row.budget));
  const onBudgetCount = $derived(liveBudgets.length - overBudget.length);
  const onBudgetPercent = $derived(hasBudgets ? Math.round((onBudgetCount / liveBudgets.length) * 100) : 0);
  const overBudgetPercent = $derived(hasBudgets ? Math.round((overBudget.length / liveBudgets.length) * 100) : 0);
  const currentMonthTrend = $derived(trendData.at(-1)?.amount ?? spent);
  const previousMonthTrend = $derived(trendData.at(-2)?.amount ?? 0);
  const monthDelta = $derived(Number((currentMonthTrend - previousMonthTrend).toFixed(2)));
  const canSaveExpense = $derived(
    auth.signedIn && hasCategories && draft.note.trim().length > 0 && draft.category !== '' && Number(draft.amount) > 0 && !saving
  );
  const canSaveBudget = $derived(
    auth.signedIn &&
      hasCategories &&
      budgetDraft.category !== '' &&
      budgetDraft.amount.trim() !== '' &&
      Number(budgetDraft.amount) >= 0 &&
      !savingBudget
  );

  function setTab(tab: Tab) {
    activeTab = tab;
    if (tab !== 'expenses') addPanelOpen = false;
    if (tab !== 'budgets') budgetPanelOpen = false;
  }

  function openExpensePanel() {
    if (!auth.backendReady || !auth.clerkReady) {
      activeTab = 'expenses';
      addPanelOpen = false;
      return;
    }

    if (!auth.signedIn && auth.clerkReady) {
      auth.signIn();
      return;
    }

    activeTab = 'expenses';
    budgetPanelOpen = false;
    addPanelOpen = true;
  }

  function openBudgetPanel(categorySlug = '') {
    if (!auth.backendReady || !auth.clerkReady) {
      activeTab = 'budgets';
      budgetPanelOpen = false;
      return;
    }

    if (!auth.signedIn && auth.clerkReady) {
      auth.signIn();
      return;
    }

    const firstCategory = liveCategories[0]?.slug ?? '';
    const selectedCategory = categorySlug || budgetDraft.category || firstCategory;
    const existing = budgetRows.find((row) => row.category === selectedCategory);

    activeTab = 'budgets';
    addPanelOpen = false;
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

  async function saveBudget() {
    budgetError = '';

    if (!auth.signedIn) {
      auth.signIn();
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

  function softColor(hex: string) {
    const cleaned = hex.replace('#', '');
    const r = parseInt(cleaned.slice(0, 2), 16);
    const g = parseInt(cleaned.slice(2, 4), 16);
    const b = parseInt(cleaned.slice(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, 0.13)`;
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

<div class:drawer-mode={addPanelOpen && activeTab === 'expenses'} class="app-shell">
  <header class="topbar">
    <button class="brand" type="button" onclick={() => setTab('overview')} aria-label="Shared Spending overview">
      <span class="heart-mark">
        <svg viewBox="0 0 54 54" aria-hidden="true">
          <path d="M27 43C19 33 8 28 8 17c0-7 9-10 19 2 10-12 19-9 19-2 0 11-11 16-19 26Z" />
        </svg>
      </span>
      <span>Shared Spending</span>
    </button>

    <nav class="main-nav" aria-label="Main navigation">
      <button class:active={activeTab === 'overview'} type="button" onclick={() => setTab('overview')}>
        <Home size={21} /> Overview
      </button>
      <button class:active={activeTab === 'expenses'} type="button" onclick={() => setTab('expenses')}>
        <ReceiptText size={21} /> Expenses
      </button>
      <button class:active={activeTab === 'categories'} type="button" onclick={() => setTab('categories')}>
        <Tag size={21} /> Categories
      </button>
      <button class:active={activeTab === 'budgets'} type="button" onclick={() => setTab('budgets')}>
        <Target size={21} /> Budgets
      </button>
    </nav>

    <div class="top-actions">
      <button class="month-button" type="button">
        <CalendarDays size={20} />
        {currentMonthLabel}
        <ChevronDown size={18} />
      </button>
      <button class="add-button" type="button" onclick={openExpensePanel}>
        <Plus size={21} /> Add Expense
      </button>
    </div>
  </header>

  {#if appUnavailable || dashboardError}
    <section class="notice-strip" aria-live="polite">
      {#if !auth.backendReady}
        <strong>Convex is not configured.</strong>
        <span>Add `PUBLIC_CONVEX_URL` and run Convex before tracking expenses.</span>
      {:else if !auth.clerkReady}
        <strong>Clerk is not configured.</strong>
        <span>Add `PUBLIC_CLERK_PUBLISHABLE_KEY` to enable sign-in.</span>
      {:else if !auth.signedIn}
        <strong>Sign in to view the shared ledger.</strong>
        <button class="inline-action" type="button" onclick={auth.signIn}>Sign in</button>
      {:else if dashboardError}
        <strong>Could not load household data.</strong>
        <span>{dashboardError}</span>
      {/if}
    </section>
  {/if}

  {#if activeTab === 'overview'}
    <main class="page-grid overview-grid">
      <section class="hero-panel">
        <div>
          <p class="kicker">{hasExpenses ? 'Good job, team! ❤' : 'Ready when you are'}</p>
          <p class="muted-heading">Total spent in May</p>
          <h1>{money(spent)}</h1>
          {#if previousMonthTrend > 0}
            <p class:positive={monthDelta <= 0} class="delta">
              {monthDelta <= 0 ? '↓' : '↑'} <strong>{money(Math.abs(monthDelta))}</strong>
              {monthDelta <= 0 ? ' less' : ' more'} than April
            </p>
          {:else}
            <p class="delta">No prior month comparison yet</p>
          {/if}
        </div>
        <img src="/illustrations/home-couple.svg" alt="" />
      </section>

      <section class="panel recent-panel">
        <div class="panel-head">
          <h2>Recent Expenses</h2>
          <button class="small-button" type="button" onclick={() => setTab('expenses')}>View all</button>
        </div>
        {#if isLoadingDashboard}
          {@render LoadingRows({ count: 5 })}
        {:else if topExpenses.length > 0}
          <table class="data-table compact">
            <thead>
              <tr><th>Date</th><th>Note</th><th>Category</th><th>Paid By</th><th class="amount-cell">Amount</th></tr>
            </thead>
            <tbody>
              {#each topExpenses.slice(0, 5) as expense}
                <tr>
                  <td>{dayLabel(expense.date)}</td>
                  <td>{expense.note}</td>
                  <td>{@render CategoryPill({ category: category(expense.category) })}</td>
                  <td>{@render PaidPill({ paidBy: expense.paidBy })}</td>
                  <td class="amount-cell">{money(expense.amount)}</td>
                </tr>
              {/each}
            </tbody>
          </table>
          <button class="more-link" type="button">and {Math.max(0, liveExpenses.length - 5)} more <ChevronDown size={15} /></button>
        {:else}
          {@render EmptyState({ title: 'No expenses yet', body: 'Add the first expense for May to start the shared ledger.', action: 'Add Expense', onAction: openExpensePanel })}
        {/if}
      </section>

      <section class="panel category-card">
        <h2>Spending by Category</h2>
        {#if categoryTotals.length > 0}
          <div class="donut-layout">
            {@render DonutChart({ totals: categoryTotals, total: spent })}
            {@render CategoryLegend({ totals: categoryTotals, total: spent })}
          </div>
          <button class="small-button center" type="button" onclick={() => setTab('categories')}>View all categories</button>
        {:else}
          {@render EmptyState({ title: 'No category spend', body: 'Expenses will appear here as soon as they are added.' })}
        {/if}
      </section>

      <section class="panel trend-card">
        <div class="panel-head">
          <h2>Spending Trend</h2>
          <button class="small-button" type="button">Last 6 months <ChevronDown size={14} /></button>
        </div>
        {@render BarTrend({ points: trendData })}
        {#if previousMonthTrend > 0}
          <div class="trend-callout">
            ⌁ You spent <strong>{money(Math.abs(monthDelta))} {monthDelta <= 0 ? 'less' : 'more'}</strong> than last month.
          </div>
        {:else}
          <div class="trend-callout">Add expenses across months to build a trend.</div>
        {/if}
      </section>

      <section class="panel budget-card">
        <div class="panel-head">
          <h2>Budgets vs Spent</h2>
          <button class="small-button" type="button" onclick={() => setTab('budgets')}>View all budgets</button>
        </div>
        {@render BudgetTable({ rows: liveBudgets.slice(0, 4) })}
        <p class="tip">Tip: Use Budgets to set or adjust monthly limits</p>
      </section>

      <section class="team-strip">
        <div class="pulse-heart">♡</div>
        <div>
          <strong>{hasExpenses ? 'You and your wife are on track.' : 'Your household is ready.'}</strong>
          <p>{hasExpenses ? 'Keep it up! Tracking together makes a big difference.' : 'Add expenses as they happen and both of you will see the same ledger.'}</p>
        </div>
        <div class="cups" aria-hidden="true"><span></span><span></span></div>
      </section>
    </main>
  {:else if activeTab === 'expenses'}
    <main class="expenses-layout">
      <section class="expenses-workspace">
        <h1 class="page-title">Expenses</h1>
        <p class="page-subtitle">Track and record your expenses together</p>

        <div class="expense-stats">
          {@render StatBlock({ icon: BadgeDollarSign, label: 'Total expenses this month', value: money(spent) })}
          {@render StatBlock({ icon: ListFilter, label: 'Entries this month', value: String(liveExpenses.length) })}
        </div>

        <div class="filters">
          <label class="select-control">
            <select bind:value={categoryFilter} onchange={() => (page = 1)}>
              <option value="all">All Categories</option>
              {#each liveCategories as option}
                <option value={option.slug}>{option.name}</option>
              {/each}
            </select>
            <ChevronDown size={16} />
          </label>
          <label class="select-control">
            <select bind:value={paidByFilter} onchange={() => (page = 1)}>
              <option value="all">All Paid By</option>
              <option value="me">Me</option>
              <option value="wife">Wife</option>
            </select>
            <ChevronDown size={16} />
          </label>
          <button class:active={paidByFilter === 'me'} class="filter-chip me" type="button" onclick={() => (paidByFilter = paidByFilter === 'me' ? 'all' : 'me')}>Me</button>
          <button class:active={paidByFilter === 'wife'} class="filter-chip wife" type="button" onclick={() => (paidByFilter = paidByFilter === 'wife' ? 'all' : 'wife')}>Wife</button>
          <button class="clear-button" type="button" onclick={resetFilters}><X size={18} /> Clear filters</button>
          <label class="search-box">
            <input bind:value={queryText} placeholder="Search notes..." />
            <Search size={20} />
          </label>
        </div>

        <div class="panel table-panel">
          {#if isLoadingDashboard}
            {@render LoadingRows({ count: 8 })}
          {:else if pagedExpenses.length > 0}
            <table class="data-table expenses-table">
              <thead>
                <tr><th>Date</th><th>Note</th><th>Category</th><th>Paid By</th><th class="amount-cell">Amount</th></tr>
              </thead>
              <tbody>
                {#each pagedExpenses as expense}
                  <tr>
                    <td>{dayLabel(expense.date, true)}</td>
                    <td>{expense.note}</td>
                    <td>{@render CategoryPill({ category: category(expense.category) })}</td>
                    <td>{@render PaidPill({ paidBy: expense.paidBy })}</td>
                    <td class="amount-cell">{money(expense.amount)}</td>
                  </tr>
                {/each}
              </tbody>
            </table>
            <div class="table-footer">
              <span>Showing {(page - 1) * 8 + 1} to {Math.min(page * 8, filteredExpenses.length)} of {filteredExpenses.length} entries</span>
              <div class="pager">
                <button type="button" disabled={page === 1} onclick={() => (page -= 1)}><ChevronLeft size={18} /></button>
                {#each Array(pages) as _, index}
                  <button class:active={page === index + 1} type="button" onclick={() => (page = index + 1)}>{index + 1}</button>
                {/each}
                <button type="button" disabled={page === pages} onclick={() => (page += 1)}><ChevronRight size={18} /></button>
              </div>
            </div>
          {:else}
            {@render EmptyState({
              title: liveExpenses.length === 0 ? 'No expenses yet' : 'No matching expenses',
              body: liveExpenses.length === 0 ? 'Add the first expense to start tracking this month.' : 'Clear filters or search for another note.',
              action: liveExpenses.length === 0 ? 'Add Expense' : 'Clear filters',
              onAction: liveExpenses.length === 0 ? openExpensePanel : resetFilters
            })}
          {/if}
        </div>
      </section>

      {#if addPanelOpen}
        <aside class="expense-drawer">
          <div class="drawer-head">
            <h2>Add Expense</h2>
            <button class="icon-button" type="button" onclick={() => (addPanelOpen = false)} aria-label="Close add expense">
              <X size={24} />
            </button>
          </div>

          <label class="field">
            <span>Date</span>
            <div class="input-like date-button">
              <CalendarDays size={20} />
              <input aria-label="Expense date" bind:value={draft.date} type="date" />
              <ChevronDown size={18} />
            </div>
          </label>

          <label class="field">
            <span>Note</span>
            <input bind:value={draft.note} placeholder="e.g., Lunch with Sarah" />
          </label>

          <label class="field">
            <span>Category</span>
            <select bind:value={draft.category}>
              <option value="">Select category</option>
              {#each liveCategories as option}
                <option value={option.slug}>{option.name}</option>
              {/each}
            </select>
          </label>

          <div class="field">
            <span>Paid By</span>
            <div class="segmented">
              <button class:active={draft.paidBy === 'me'} type="button" onclick={() => (draft.paidBy = 'me')}>Me</button>
              <button class:active={draft.paidBy === 'wife'} type="button" onclick={() => (draft.paidBy = 'wife')}>Wife</button>
            </div>
          </div>

          <label class="field">
            <span>Amount</span>
            <div class="input-like"><span>$</span><input bind:value={draft.amount} inputmode="decimal" placeholder="0.00" /></div>
          </label>

          {#if formError}<p class="form-error">{formError}</p>{/if}
          <button class="save-button" type="button" disabled={!canSaveExpense} onclick={() => saveExpense(false)}>
            {saving ? 'Saving...' : 'Save Expense'}
          </button>
          <button class="secondary-save" type="button" disabled={!canSaveExpense} onclick={() => saveExpense(true)}>
            Save and Add Another
          </button>
        </aside>
      {/if}
    </main>
  {:else if activeTab === 'categories'}
    <main class="page-grid categories-grid">
      <section class="hero-panel category-hero">
        <div>
          <h1>Categories & Budgets</h1>
          <p>See where your money goes and stay on track together.</p>
        </div>
        <img src="/illustrations/home-couple.svg" alt="" />
      </section>

      <section class="panel metric-strip">
        {@render Metric({
          label: 'Total Spent',
          value: money(spent),
          note: previousMonthTrend > 0 ? `${money(Math.abs(monthDelta))} ${monthDelta <= 0 ? 'less than' : 'more than'} April` : 'No prior month yet',
          good: monthDelta <= 0
        })}
        {@render Metric({ label: 'Categories Used', value: String(liveCategories.length), note: `${categoryTotals.length} with spending` })}
        {@render Metric({ label: 'On Budget', value: String(onBudgetCount), note: `${onBudgetPercent}% of budgets`, good: true })}
        {@render Metric({ label: 'Over Budget', value: String(overBudget.length), note: `${overBudgetPercent}% of budgets`, warn: true })}
      </section>

      <section class="panel category-list-panel">
        <div class="panel-head">
          <div><h2>Spending by Category</h2><p>How much you spent in May</p></div>
          <button class="small-button" type="button">This Month <ChevronDown size={14} /></button>
        </div>
        {@render CategorySpendList({ totals: categoryTotals, total: spent })}
      </section>

      <section class="panel tracking-panel">
        <div class="panel-head">
          <div><h2>Budget Tracking</h2><p>Budget vs. actual for May</p></div>
          <button class="small-button" type="button">This Month <ChevronDown size={14} /></button>
        </div>
        {@render BudgetTable({ rows: budgetRows, showStatus: true })}
      </section>

      <section class="panel share-card">
        <h2>Category Share</h2>
        <p>Percentage of total spending</p>
        <div class="donut-layout small">
          {@render DonutChart({ totals: categoryTotals, total: spent })}
          {@render CategoryLegend({ totals: categoryTotals, total: spent, compact: true })}
        </div>
      </section>

      <section class="panel line-card">
        <h2>Spending Trend by Category</h2>
        <p>Compare category spending over time</p>
        {@render LineTrend({ points: categoryTrendData })}
      </section>

      <section class="panel stronger-card">
        <div class="pulse-heart">♡</div>
        <h2>Stronger together</h2>
        <p>You're building great habits and achieving your goals as a team. ❤</p>
      </section>
    </main>
  {:else}
    <main class="page-grid categories-grid">
      <section class="hero-panel category-hero">
        <div>
          <h1>Budgets</h1>
          <p>Review limits, remaining balances, and categories that need attention.</p>
        </div>
        <img src="/illustrations/home-couple.svg" alt="" />
      </section>
      <section class="panel tracking-panel wide">
        <div class="panel-head">
          <h2>Budget Tracking</h2>
          <button class="small-button" type="button" onclick={() => openBudgetPanel()}>Set budget</button>
        </div>
        {@render BudgetTable({ rows: budgetRows, showStatus: true, editable: true })}
      </section>
      <section class="panel line-card">
        <h2>Budget Pressure</h2>
        <p>Categories closest to their monthly limit</p>
        {@render CategorySpendList({ totals: categoryTotals, total: spent })}
      </section>
    </main>
  {/if}

  {#if budgetPanelOpen}
    <aside class="budget-drawer">
      <div class="drawer-head">
        <h2>Set Budget</h2>
        <button class="icon-button" type="button" onclick={() => (budgetPanelOpen = false)} aria-label="Close budget editor">
          <X size={24} />
        </button>
      </div>

      <label class="field">
        <span>Month</span>
        <div class="input-like">
          <CalendarDays size={20} />
          <strong>{currentMonthLabel}</strong>
        </div>
      </label>

      <label class="field">
        <span>Category</span>
        <select bind:value={budgetDraft.category} onchange={syncBudgetDraftAmount}>
          {#each liveCategories as option}
            <option value={option.slug}>{option.name}</option>
          {/each}
        </select>
      </label>

      <label class="field">
        <span>Monthly budget</span>
        <div class="input-like"><span>$</span><input bind:value={budgetDraft.amount} inputmode="decimal" placeholder="0.00" /></div>
      </label>

      <p class="form-helper">Enter 0 to clear this category's budget for the month.</p>
      {#if budgetError}<p class="form-error">{budgetError}</p>{/if}
      <button class="save-button" type="button" disabled={!canSaveBudget} onclick={saveBudget}>
        {savingBudget ? 'Saving...' : 'Save Budget'}
      </button>
    </aside>
  {/if}
</div>

{#snippet EmptyState({ title, body, action, onAction }: { title: string; body: string; action?: string; onAction?: () => void })}
  <div class="empty-state">
    <strong>{title}</strong>
    <p>{body}</p>
    {#if action && onAction}
      <button class="small-button" type="button" onclick={onAction}>{action}</button>
    {/if}
  </div>
{/snippet}

{#snippet LoadingRows({ count }: { count: number })}
  <div class="loading-rows" aria-label="Loading">
    {#each Array(count) as _}
      <span></span>
    {/each}
  </div>
{/snippet}

{#snippet CategoryPill({ category }: { category: Category })}
  {@const Icon = iconMap[category.icon as keyof typeof iconMap] ?? CircleEllipsis}
  <span class="category-pill" style={`--pill-color:${category.color}; --pill-bg:${category.soft};`}>
    <Icon size={17} />
    {category.name}
  </span>
{/snippet}

{#snippet PaidPill({ paidBy }: { paidBy: MemberKey })}
  <span class={`paid-pill ${paidBy}`}>{paidLabel(paidBy)}</span>
{/snippet}

{#snippet StatBlock({ icon, label, value }: { icon: any; label: string; value: string })}
  {@const Icon = icon}
  <div class="stat-block">
    <span><Icon size={34} /></span>
    <div>
      <p>{label}</p>
      <strong>{value}</strong>
    </div>
  </div>
{/snippet}

{#snippet Metric({ label, value, note, good = false, warn = false }: { label: string; value: string; note: string; good?: boolean; warn?: boolean })}
  <div class="metric">
    <p>{label}</p>
    <strong>{value}</strong>
    <span class:good class:warn>{note}</span>
  </div>
{/snippet}

{#snippet DonutChart({ totals, total }: { totals: ReturnType<typeof totalsByCategory>; total: number })}
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
    <div><strong>{money(total)}</strong><span>Total</span></div>
  </div>
{/snippet}

{#snippet CategoryLegend({ totals, total, compact = false }: { totals: ReturnType<typeof totalsByCategory>; total: number; compact?: boolean })}
  <div class:compact class="legend">
    {#if totals.length > 0}
      {#each totals.slice(0, compact ? 6 : totals.length) as item}
        <div>
          <span style={`background:${item.category.color}`}></span>
          <p>{item.category.name}</p>
          <strong>{compact ? `${categoryPercent(item.amount, total)}%` : money(item.amount)}</strong>
        </div>
      {/each}
    {:else}
      <p class="empty-copy">No spending yet</p>
    {/if}
  </div>
{/snippet}

{#snippet BarTrend({ points }: { points: TrendPoint[] })}
  {@const chartMax = Math.max(3500, ...points.map((point) => point.amount))}
  <div class="bar-chart">
    {#if points.length > 0}
      <div class="axis">
        <span>{money(chartMax)}</span><span>{money(chartMax * 0.85)}</span><span>{money(chartMax * 0.7)}</span><span>{money(chartMax * 0.55)}</span><span>{money(chartMax * 0.4)}</span><span>{money(chartMax * 0.25)}</span><span>{money(chartMax * 0.1)}</span><span>$0</span>
      </div>
      <div class="bars">
        {#each points as point, index}
          <div class="bar-wrap">
            <span class:current={index === points.length - 1} style={`height:${chartMax > 0 ? (point.amount / chartMax) * 100 : 0}%`}></span>
            <b>{point.label}</b>
            {#if index === points.length - 1 && point.amount > 0}<em>{money(point.amount)}</em>{/if}
          </div>
        {/each}
      </div>
    {:else}
      <div class="trend-empty">{@render EmptyState({ title: 'No trend yet', body: 'Monthly totals will appear after sign-in and expense entry.' })}</div>
    {/if}
    </div>
{/snippet}

{#snippet BudgetTable({ rows, showStatus = false, editable = false }: { rows: BudgetRow[]; showStatus?: boolean; editable?: boolean })}
  {#if rows.length > 0}
    <table class="data-table budget-table">
      <thead>
        <tr>
          <th>Category</th><th>Budget</th><th>Spent</th><th>Remaining</th>{#if showStatus}<th>Status</th>{/if}{#if editable}<th>Action</th>{/if}
        </tr>
      </thead>
      <tbody>
        {#each rows as row}
          {@const item = category(row.category)}
          {@const remaining = row.budget - row.spent}
          <tr>
            <td>{@render CategoryPill({ category: item })}</td>
            <td>{row.isSet ? money(row.budget) : 'Not set'}</td>
            <td>
              {#if row.isSet}
                <div class="budget-progress">
                  <span style={`width:${Math.min(100, row.budget > 0 ? (row.spent / row.budget) * 100 : 0)}%; background:${item.color}`}></span>
                </div>
              {/if}
              {money(row.spent)}
            </td>
            <td class:negative={row.isSet && remaining < 0}>{row.isSet ? money(remaining) : 'Set a limit'}</td>
            {#if showStatus}
              <td>
                {#if row.isSet}
                  <span class:over={remaining < 0} class="status-pill">{remaining < 0 ? 'Over' : 'On Track'}</span>
                {:else}
                  <span class="status-pill unset">Unset</span>
                {/if}
              </td>
            {/if}
            {#if editable}<td><button class="table-link" type="button" onclick={() => openBudgetPanel(row.category)}>{row.isSet ? 'Edit' : 'Set'}</button></td>{/if}
          </tr>
        {/each}
      </tbody>
    </table>
  {:else}
    {@render EmptyState({ title: 'No budgets yet', body: 'Sign in to create categories, then set the monthly limits you actually want to track.' })}
  {/if}
{/snippet}

{#snippet CategorySpendList({ totals, total }: { totals: ReturnType<typeof totalsByCategory>; total: number })}
  {#if totals.length > 0}
    <div class="category-spend-list">
      <div class="list-head"><span>Category</span><span>Spent</span></div>
      {#each totals as item}
        <div class="category-row">
          {@render CategoryPill({ category: item.category })}
          <div class="row-track"><span style={`width:${categoryPercent(item.amount, total)}%; background:${item.category.color}`}></span></div>
          <strong>{money(item.amount)}</strong>
          <em style={`color:${item.category.color}`}>{categoryPercent(item.amount, total)}%</em>
          <span class="muted-cell">-</span>
        </div>
      {/each}
    </div>
  {:else}
    {@render EmptyState({ title: 'No spending yet', body: 'Category totals will update after expenses are added.' })}
  {/if}
{/snippet}

{#snippet LineTrend({ points }: { points: CategoryTrend })}
  {@const entries = Object.entries(points).filter(([, values]) => values.some((value) => value > 0))}
  {@const maxPoint = Math.max(1000, ...entries.flatMap(([, values]) => values))}
  <div class="line-trend">
    {#if entries.length > 0}
      <svg viewBox="0 0 620 210" role="img" aria-label="Spending trend by category">
        <g class="grid-lines">
          {#each [20, 62, 104, 146, 188] as y}
            <line x1="40" x2="580" y1={y} y2={y} />
          {/each}
        </g>
        {#each entries as [slug, values]}
          {@const item = category(slug)}
          {@const d = values.map((point, index) => `${40 + index * 108},${190 - (point / maxPoint) * 160}`).join(' ')}
          <polyline points={d} fill="none" stroke={item.color} stroke-width="3" stroke-linecap="round" stroke-linejoin="round" />
        {/each}
      </svg>
      {@render CategoryLegend({ totals: categoryTotals, total: spent, compact: true })}
    {:else}
      {@render EmptyState({ title: 'No trend yet', body: 'Add expenses over time to compare category movement.' })}
    {/if}
  </div>
{/snippet}
