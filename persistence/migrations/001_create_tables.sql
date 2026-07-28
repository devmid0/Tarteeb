-- ============================================================
-- Tarteeb: Core Tables + RLS
-- Run in Supabase SQL Editor
-- ============================================================

-- 1. TASKS ----------------------------------------------------

create table if not exists public.tasks (
    id            bigint generated always as identity primary key,
    user_id       uuid not null references auth.users(id) on delete cascade,
    title         text not null,
    description   text not null default '',
    priority      text not null default 'medium'
                  check (priority in ('critical','high','medium','low')),
    status        text not null default 'pending'
                  check (status in ('pending','in_progress','completed','archived')),
    due_date      date,
    project_id    bigint,
    tags          jsonb not null default '[]'::jsonb,
    time_estimate int,
    time_spent    int,
    completed_at  timestamptz,
    created_at    timestamptz not null default now(),
    updated_at    timestamptz not null default now()
);

create table if not exists public.projects (
    id         bigint generated always as identity primary key,
    user_id    uuid not null references auth.users(id) on delete cascade,
    name       text not null,
    color      text not null default '#34d399',
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

-- tasks.project_id FK
alter table public.tasks
    add constraint fk_tasks_project
    foreign key (project_id) references public.projects(id)
    on delete set null;

create index if not exists idx_tasks_user    on public.tasks(user_id);
create index if not exists idx_tasks_status  on public.tasks(status);
create index if not exists idx_tasks_priority on public.tasks(priority);
create index if not exists idx_tasks_due     on public.tasks(due_date);
create index if not exists idx_projects_user on public.projects(user_id);

-- 2. FINANCE --------------------------------------------------

create table if not exists public.transactions (
    id          bigint generated always as identity primary key,
    user_id     uuid not null references auth.users(id) on delete cascade,
    amount      numeric(12,2) not null check (amount > 0),
    type        text not null check (type in ('income','expense','transfer')),
    category    text not null,
    description text not null default '',
    date        date not null,
    tags        jsonb not null default '[]'::jsonb,
    created_at  timestamptz not null default now(),
    updated_at  timestamptz not null default now()
);

create table if not exists public.budgets (
    id         bigint generated always as identity primary key,
    user_id    uuid not null references auth.users(id) on delete cascade,
    category   text not null,
    limit      numeric(12,2) not null check (limit > 0),
    period     text not null default 'monthly'
               check (period in ('weekly','monthly','yearly')),
    start_date date not null default current_date,
    color      text not null default '#60a5fa',
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index if not exists idx_transactions_user     on public.transactions(user_id);
create index if not exists idx_transactions_type      on public.transactions(type);
create index if not exists idx_transactions_category  on public.transactions(category);
create index if not exists idx_transactions_date      on public.transactions(date);
create index if not exists idx_budgets_user           on public.budgets(user_id);

-- 3. HABITS ---------------------------------------------------

create table if not exists public.habits (
    id             bigint generated always as identity primary key,
    user_id        uuid not null references auth.users(id) on delete cascade,
    name           text not null,
    icon           text not null default '✅',
    category       text not null default 'other',
    color          text not null default '#fb923c',
    frequency      text not null default 'daily'
                   check (frequency in ('daily','weekly','monthly')),
    frequency_days int[] not null default '{}',
    frequency_day  int check (frequency_day is null or (frequency_day >= 1 and frequency_day <= 31)),
    target_count   int not null default 1 check (target_count >= 1),
    current_count  int not null default 0 check (current_count >= 0),
    archived       boolean not null default false,
    sort_order     int not null default 0,
    created_at     timestamptz not null default now(),
    updated_at     timestamptz not null default now()
);

create table if not exists public.habit_records (
    id         bigint generated always as identity primary key,
    user_id    uuid not null references auth.users(id) on delete cascade,
    habit_id   bigint not null references public.habits(id) on delete cascade,
    date       date not null,
    completed  boolean not null default true,
    note       text not null default '',
    created_at timestamptz not null default now(),
    unique(habit_id, date)
);

create index if not exists idx_habits_user      on public.habits(user_id);
create index if not exists idx_habits_archived  on public.habits(archived);
create index if not exists idx_habit_records_user   on public.habit_records(user_id);
create index if not exists idx_habit_records_habit  on public.habit_records(habit_id);
create index if not exists idx_habit_records_date   on public.habit_records(date);

-- 4. GOALS ----------------------------------------------------

create table if not exists public.goals (
    id           bigint generated always as identity primary key,
    user_id      uuid not null references auth.users(id) on delete cascade,
    title        text not null,
    description  text not null default '',
    emoji        text not null default '🎯',
    category     text not null default 'other',
    priority     text not null default 'medium'
                 check (priority in ('high','medium','low')),
    status       text not null default 'active'
                 check (status in ('active','completed','abandoned')),
    deadline     date,
    created_at   timestamptz not null default now(),
    completed_at timestamptz,
    updated_at   timestamptz not null default now()
);

create table if not exists public.milestones (
    id            bigint generated always as identity primary key,
    user_id       uuid not null references auth.users(id) on delete cascade,
    goal_id       bigint not null references public.goals(id) on delete cascade,
    title         text not null,
    is_completed  boolean not null default false,
    completed_at  timestamptz,
    sort_order    int not null default 0,
    created_at    timestamptz not null default now()
);

create index if not exists idx_goals_user       on public.goals(user_id);
create index if not exists idx_goals_status     on public.goals(status);
create index if not exists idx_milestones_user  on public.milestones(user_id);
create index if not exists idx_milestones_goal  on public.milestones(goal_id);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

-- Enable RLS on each table (individual statements for clarity)
alter table public.tasks        enable row level security;
alter table public.projects     enable row level security;
alter table public.transactions enable row level security;
alter table public.budgets      enable row level security;
alter table public.habits       enable row level security;
alter table public.habit_records enable row level security;
alter table public.goals        enable row level security;
alter table public.milestones   enable row level security;

-- ── Tasks ────────────────────────────────────────────────────

create policy "Users can read own tasks"
    on public.tasks for select
    using (auth.uid() = user_id);

create policy "Users can insert own tasks"
    on public.tasks for insert
    with check (auth.uid() = user_id);

create policy "Users can update own tasks"
    on public.tasks for update
    using (auth.uid() = user_id);

create policy "Users can delete own tasks"
    on public.tasks for delete
    using (auth.uid() = user_id);

-- ── Projects ─────────────────────────────────────────────────

create policy "Users can read own projects"
    on public.projects for select
    using (auth.uid() = user_id);

create policy "Users can insert own projects"
    on public.projects for insert
    with check (auth.uid() = user_id);

create policy "Users can update own projects"
    on public.projects for update
    using (auth.uid() = user_id);

create policy "Users can delete own projects"
    on public.projects for delete
    using (auth.uid() = user_id);

-- ── Transactions ─────────────────────────────────────────────

create policy "Users can read own transactions"
    on public.transactions for select
    using (auth.uid() = user_id);

create policy "Users can insert own transactions"
    on public.transactions for insert
    with check (auth.uid() = user_id);

create policy "Users can update own transactions"
    on public.transactions for update
    using (auth.uid() = user_id);

create policy "Users can delete own transactions"
    on public.transactions for delete
    using (auth.uid() = user_id);

-- ── Budgets ──────────────────────────────────────────────────

create policy "Users can read own budgets"
    on public.budgets for select
    using (auth.uid() = user_id);

create policy "Users can insert own budgets"
    on public.budgets for insert
    with check (auth.uid() = user_id);

create policy "Users can update own budgets"
    on public.budgets for update
    using (auth.uid() = user_id);

create policy "Users can delete own budgets"
    on public.budgets for delete
    using (auth.uid() = user_id);

-- ── Habits ───────────────────────────────────────────────────

create policy "Users can read own habits"
    on public.habits for select
    using (auth.uid() = user_id);

create policy "Users can insert own habits"
    on public.habits for insert
    with check (auth.uid() = user_id);

create policy "Users can update own habits"
    on public.habits for update
    using (auth.uid() = user_id);

create policy "Users can delete own habits"
    on public.habits for delete
    using (auth.uid() = user_id);

-- ── Habit Records ────────────────────────────────────────────

create policy "Users can read own habit records"
    on public.habit_records for select
    using (auth.uid() = user_id);

create policy "Users can insert own habit records"
    on public.habit_records for insert
    with check (auth.uid() = user_id);

create policy "Users can update own habit records"
    on public.habit_records for update
    using (auth.uid() = user_id);

create policy "Users can delete own habit records"
    on public.habit_records for delete
    using (auth.uid() = user_id);

-- ── Goals ────────────────────────────────────────────────────

create policy "Users can read own goals"
    on public.goals for select
    using (auth.uid() = user_id);

create policy "Users can insert own goals"
    on public.goals for insert
    with check (auth.uid() = user_id);

create policy "Users can update own goals"
    on public.goals for update
    using (auth.uid() = user_id);

create policy "Users can delete own goals"
    on public.goals for delete
    using (auth.uid() = user_id);

-- ── Milestones ───────────────────────────────────────────────

create policy "Users can read own milestones"
    on public.milestones for select
    using (auth.uid() = user_id);

create policy "Users can insert own milestones"
    on public.milestones for insert
    with check (auth.uid() = user_id);

create policy "Users can update own milestones"
    on public.milestones for update
    using (auth.uid() = user_id);

create policy "Users can delete own milestones"
    on public.milestones for delete
    using (auth.uid() = user_id);
