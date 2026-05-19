
-- Profiles
create table public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  created_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
create policy "own profile read" on public.profiles for select using (auth.uid() = user_id);
create policy "own profile upsert" on public.profiles for insert with check (auth.uid() = user_id);
create policy "own profile update" on public.profiles for update using (auth.uid() = user_id);

-- Financial profile (single row per user)
create table public.financial_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  monthly_income numeric not null default 0,
  monthly_expenses numeric not null default 0,
  monthly_debt_payment numeric not null default 0,
  total_assets numeric not null default 0,
  emergency_fund numeric not null default 0,
  cash_liquid numeric not null default 0,
  investment_horizon_years integer not null default 5,
  updated_at timestamptz not null default now()
);
alter table public.financial_profiles enable row level security;
create policy "own fin read" on public.financial_profiles for select using (auth.uid() = user_id);
create policy "own fin insert" on public.financial_profiles for insert with check (auth.uid() = user_id);
create policy "own fin update" on public.financial_profiles for update using (auth.uid() = user_id);

-- Questionnaire (Q1..Q7 each 1..5)
create table public.questionnaire_responses (
  user_id uuid primary key references auth.users(id) on delete cascade,
  q1 smallint not null check (q1 between 1 and 5),
  q2 smallint not null check (q2 between 1 and 5),
  q3 smallint not null check (q3 between 1 and 5),
  q4 smallint not null check (q4 between 1 and 5),
  q5 smallint not null check (q5 between 1 and 5),
  q6 smallint not null check (q6 between 1 and 5),
  q7 smallint not null check (q7 between 1 and 5),
  updated_at timestamptz not null default now()
);
alter table public.questionnaire_responses enable row level security;
create policy "own q read" on public.questionnaire_responses for select using (auth.uid() = user_id);
create policy "own q insert" on public.questionnaire_responses for insert with check (auth.uid() = user_id);
create policy "own q update" on public.questionnaire_responses for update using (auth.uid() = user_id);

-- Holdings — only 4 categories allowed
create type public.asset_category as enum ('cash','gold','stock','bond_fund');

create table public.holdings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  category public.asset_category not null,
  name text not null,
  amount numeric not null check (amount >= 0),
  created_at timestamptz not null default now()
);
alter table public.holdings enable row level security;
create policy "own holdings read" on public.holdings for select using (auth.uid() = user_id);
create policy "own holdings insert" on public.holdings for insert with check (auth.uid() = user_id);
create policy "own holdings update" on public.holdings for update using (auth.uid() = user_id);
create policy "own holdings delete" on public.holdings for delete using (auth.uid() = user_id);
create index on public.holdings(user_id, created_at desc);
