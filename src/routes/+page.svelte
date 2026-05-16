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
    budgets as demoBudgets,
    categories as demoCategories,
    categoryFor,
    categoryPercent,
    categoryTrend,
    dayLabel,
    expenses as demoExpenses,
    money,
    totalSpent,
    totalsByCategory,
    trend,
    type BudgetRow,
    type Category,
    type Expense,
    type MemberKey
  } from '$lib/finance';

  type Tab = 'overview' | 'expenses' | 'categories' | 'budgets';

  const auth = getContext<AuthState>(AUTH_CONTEXT);
  const convex = useConvexClient();
  const dashboard = useQuery(
    api.finance.dashboard,
    () => (auth.signedIn ? { month: '2025-05' } : 'skip'),
    { keepPreviousData: true }
  );

  let activeTab = $state<Tab>('overview');
  let addPanelOpen = $state(false);
  let queryText = $state('');
  let categoryFilter = $state('all');
  let paidByFilter = $state<'all' | MemberKey>('all');
  let page = $state(1);
  let draft = $state({
    date: '2025-05-18',
    note: '',
    category: '',
    paidBy: 'me' as MemberKey,
    amount: ''
  });

  const liveCategories = $derived.by<Category[]>(() => {
    if (!dashboard.data?.categories) return demoCategories;
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
    if (!dashboard.data?.expenses || !dashboard.data?.categories) return demoExpenses;
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

  const liveBudgets = $derived.by<BudgetRow[]>(() => {
    if (!dashboard.data?.budgets || !dashboard.data?.categories) return demoBudgets;
    const categoryById = new Map(dashboard.data.categories.map((category: any) => [category._id, category.slug]));
    const spent = totalsByCategory(liveExpenses);
    return dashboard.data.budgets.map((budget: any) => {
      const slug = categoryById.get(budget.categoryId) ?? 'misc';
      return {
        category: slug,
        budget: budget.amountCents / 100,
        spent: spent.find((item) => item.category.slug === slug)?.amount ?? 0
      };
    });
  });

  const spent = $derived(totalSpent(liveExpenses));
  const categoryTotals = $derived(totalsByCategory(liveExpenses));
  const topExpenses = $derived(liveExpenses.slice(0, 8));
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

  function setTab(tab: Tab) {
    activeTab = tab;
    if (tab === 'expenses') addPanelOpen = true;
  }

  function openExpensePanel() {
    if (!auth.signedIn && auth.clerkReady) {
      auth.signIn();
      return;
    }

    activeTab = 'expenses';
    addPanelOpen = true;
  }

  async function saveExpense(addAnother = false) {
    if (!draft.note || !draft.category || !draft.amount) return;
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
  }

  function resetFilters() {
    categoryFilter = 'all';
    paidByFilter = 'all';
    queryText = '';
    page = 1;
  }

  function category(slug: string) {
    return liveCategories.find((item) => item.slug === slug) ?? categoryFor(slug);
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
    <button class="brand" type="button" onclick={() => (activeTab = 'overview')} aria-label="Shared Spending overview">
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
        May 2025
        <ChevronDown size={18} />
      </button>
      <button class="add-button" type="button" onclick={openExpensePanel}>
        <Plus size={21} /> Add Expense
      </button>
    </div>
  </header>

  {#if activeTab === 'overview'}
    <main class="page-grid overview-grid">
      <section class="hero-panel">
        <div>
          <p class="kicker">Good job, team! ❤</p>
          <p class="muted-heading">Total spent in May</p>
          <h1>{money(spent)}</h1>
          <p class="delta">↓ <strong>$341.25</strong> less than April</p>
        </div>
        <img src="/illustrations/home-couple.svg" alt="" />
      </section>

      <section class="panel recent-panel">
        <div class="panel-head">
          <h2>Recent Expenses</h2>
          <button class="small-button" type="button" onclick={() => (activeTab = 'expenses')}>View all</button>
        </div>
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
      </section>

      <section class="panel category-card">
        <h2>Spending by Category</h2>
        <div class="donut-layout">
          {@render DonutChart({ totals: categoryTotals, total: spent })}
          {@render CategoryLegend({ totals: categoryTotals, total: spent })}
        </div>
        <button class="small-button center" type="button" onclick={() => (activeTab = 'categories')}>View all categories</button>
      </section>

      <section class="panel trend-card">
        <div class="panel-head">
          <h2>Spending Trend</h2>
          <button class="small-button" type="button">Last 6 months <ChevronDown size={14} /></button>
        </div>
        {@render BarTrend()}
        <div class="trend-callout">⌁ You spent <strong>$341.25 less</strong> than last month.</div>
      </section>

      <section class="panel budget-card">
        <div class="panel-head">
          <h2>Budgets vs Spent</h2>
          <button class="small-button" type="button" onclick={() => (activeTab = 'budgets')}>View all budgets</button>
        </div>
        {@render BudgetTable({ rows: liveBudgets.slice(0, 4) })}
        <p class="tip">Tip: Tap a budget to adjust</p>
      </section>

      <section class="team-strip">
        <div class="pulse-heart">♡</div>
        <div>
          <strong>You and your wife are on track.</strong>
          <p>Keep it up! Tracking together makes a big difference.</p>
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
          <button class="select-button" type="button">All Categories <ChevronDown size={16} /></button>
          <button class="select-button" type="button">All Paid By <ChevronDown size={16} /></button>
          <button class:active={paidByFilter === 'me'} class="filter-chip me" type="button" onclick={() => (paidByFilter = paidByFilter === 'me' ? 'all' : 'me')}>Me</button>
          <button class:active={paidByFilter === 'wife'} class="filter-chip wife" type="button" onclick={() => (paidByFilter = paidByFilter === 'wife' ? 'all' : 'wife')}>Wife</button>
          <button class="clear-button" type="button" onclick={resetFilters}><X size={18} /> Clear filters</button>
          <label class="search-box">
            <input bind:value={queryText} placeholder="Search notes..." />
            <Search size={20} />
          </label>
        </div>

        <div class="panel table-panel">
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
            <button class="input-like date-button" type="button">
              <CalendarDays size={20} />
              <span>{dayLabel(draft.date, true)}</span>
              <ChevronDown size={18} />
            </button>
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

          <button class="save-button" type="button" onclick={() => saveExpense(false)}>Save Expense</button>
          <button class="secondary-save" type="button" onclick={() => saveExpense(true)}>Save and Add Another</button>
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
        {@render Metric({ label: 'Total Spent', value: money(spent), note: '$341.25 less than April', good: true })}
        {@render Metric({ label: 'Categories Used', value: String(liveCategories.length), note: '2 new this month' })}
        {@render Metric({ label: 'On Budget', value: String(liveBudgets.length - overBudget.length), note: '62% of categories', good: true })}
        {@render Metric({ label: 'Over Budget', value: String(overBudget.length), note: '38% of categories', warn: true })}
      </section>

      <section class="panel category-list-panel">
        <div class="panel-head">
          <div><h2>Spending by Category</h2><p>How much you spent in May</p></div>
          <button class="small-button" type="button">This Month <ChevronDown size={14} /></button>
        </div>
        {@render CategorySpendList({ totals: categoryTotals, total: spent })}
        <button class="small-button center" type="button">View all categories</button>
      </section>

      <section class="panel tracking-panel">
        <div class="panel-head">
          <div><h2>Budget Tracking</h2><p>Budget vs. actual for May</p></div>
          <button class="small-button" type="button">This Month <ChevronDown size={14} /></button>
        </div>
        {@render BudgetTable({ rows: liveBudgets, showStatus: true })}
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
        {@render LineTrend()}
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
          <button class="small-button" type="button">This Month <ChevronDown size={14} /></button>
        </div>
        {@render BudgetTable({ rows: liveBudgets, showStatus: true })}
      </section>
      <section class="panel line-card">
        <h2>Budget Pressure</h2>
        <p>Categories closest to their monthly limit</p>
        {@render CategorySpendList({ totals: categoryTotals, total: spent })}
      </section>
    </main>
  {/if}
</div>

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
  {@const stops = totals.reduce((segments, item, index) => {
    const start = index === 0 ? 0 : segments[index - 1].end;
    const end = start + (item.amount / total) * 100;
    segments.push({ color: item.category.color, start, end });
    return segments;
  }, [] as { color: string; start: number; end: number }[])}
  <div
    class="donut"
    style={`background: conic-gradient(${stops.map((segment) => `${segment.color} ${segment.start}% ${segment.end}%`).join(', ')});`}
  >
    <div><strong>{money(total)}</strong><span>Total</span></div>
  </div>
{/snippet}

{#snippet CategoryLegend({ totals, total, compact = false }: { totals: ReturnType<typeof totalsByCategory>; total: number; compact?: boolean })}
  <div class:compact class="legend">
    {#each totals.slice(0, compact ? 6 : totals.length) as item}
      <div>
        <span style={`background:${item.category.color}`}></span>
        <p>{item.category.name}</p>
        <strong>{compact ? `${categoryPercent(item.amount, total)}%` : money(item.amount)}</strong>
      </div>
    {/each}
  </div>
{/snippet}

{#snippet BarTrend()}
  <div class="bar-chart">
    <div class="axis">
      <span>$3.5k</span><span>$3k</span><span>$2.5k</span><span>$2k</span><span>$1.5k</span><span>$1k</span><span>$0.5k</span><span>$0</span>
    </div>
    <div class="bars">
      {#each trend as point, index}
        <div class="bar-wrap">
          <span class:current={index === trend.length - 1} style={`height:${(point.amount / 3500) * 100}%`}></span>
          <b>{point.label}</b>
          {#if index === trend.length - 1}<em>{money(point.amount)}</em>{/if}
        </div>
      {/each}
    </div>
  </div>
{/snippet}

{#snippet BudgetTable({ rows, showStatus = false }: { rows: BudgetRow[]; showStatus?: boolean })}
  <table class="data-table budget-table">
    <thead>
      <tr>
        <th>Category</th><th>Budget</th><th>Spent</th><th>Remaining</th>{#if showStatus}<th>Status</th>{/if}
      </tr>
    </thead>
    <tbody>
      {#each rows as row}
        {@const item = category(row.category)}
        {@const remaining = row.budget - row.spent}
        <tr>
          <td>{@render CategoryPill({ category: item })}</td>
          <td>{money(row.budget)}</td>
          <td>
            <div class="budget-progress">
              <span style={`width:${Math.min(100, (row.spent / row.budget) * 100)}%; background:${item.color}`}></span>
            </div>
            {money(row.spent)}
          </td>
          <td class:negative={remaining < 0}>{money(remaining)}</td>
          {#if showStatus}<td><span class:over={remaining < 0} class="status-pill">{remaining < 0 ? 'Over' : 'On Track'}</span></td>{/if}
        </tr>
      {/each}
    </tbody>
  </table>
{/snippet}

{#snippet CategorySpendList({ totals, total }: { totals: ReturnType<typeof totalsByCategory>; total: number })}
  <div class="category-spend-list">
    <div class="list-head"><span>Category</span><span>Spent</span></div>
    {#each totals as item}
      <div class="category-row">
        {@render CategoryPill({ category: item.category })}
        <div class="row-track"><span style={`width:${categoryPercent(item.amount, total)}%; background:${item.category.color}`}></span></div>
        <strong>{money(item.amount)}</strong>
        <em style={`color:${item.category.color}`}>{categoryPercent(item.amount, total)}%</em>
        {@render PaidPill({ paidBy: item.category.slug === 'groceries' || item.category.slug === 'shopping' ? 'wife' : 'me' })}
      </div>
    {/each}
  </div>
{/snippet}

{#snippet LineTrend()}
  <div class="line-trend">
    <svg viewBox="0 0 620 210" role="img" aria-label="Spending trend by category">
      <g class="grid-lines">
        {#each [20, 62, 104, 146, 188] as y}
          <line x1="40" x2="580" y1={y} y2={y} />
        {/each}
      </g>
      {#each Object.entries(categoryTrend) as [slug, points]}
        {@const item = category(slug)}
        {@const d = points.map((point, index) => `${40 + index * 108},${190 - (point / 1000) * 160}`).join(' ')}
        <polyline points={d} fill="none" stroke={item.color} stroke-width="3" stroke-linecap="round" stroke-linejoin="round" />
      {/each}
    </svg>
    {@render CategoryLegend({ totals: categoryTotals, total: spent, compact: true })}
  </div>
{/snippet}
