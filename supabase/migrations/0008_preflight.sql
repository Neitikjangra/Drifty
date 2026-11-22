-- Pre-flight check: what the AI compares a draft against before it reaches the client.
-- Brand rules live on the project (one client), the brief on each deliverable.
alter table public.projects add column if not exists brand_rules text not null default ''
  check (char_length(brand_rules) <= 4000);
alter table public.deliverables add column if not exists brief text not null default ''
  check (char_length(brief) <= 2000);

-- Each pre-flight run (team only; clients never see these). Lets a later run of the same
-- deliverable see what was predicted, and gives the report a "predicted before sending" count.
create table if not exists public.preflight_checks (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  project_id uuid not null references public.projects (id) on delete cascade,
  deliverable_id uuid references public.deliverables (id) on delete cascade,
  run_by uuid not null,
  asset_sha256 text not null,
  predictions jsonb not null default '[]'::jsonb,
  ai_checked boolean not null default true
);
create index if not exists preflight_checks_project_idx on public.preflight_checks (project_id, created_at desc);
alter table public.preflight_checks enable row level security;
revoke all on public.preflight_checks from anon, authenticated;
