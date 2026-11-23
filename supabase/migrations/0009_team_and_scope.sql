-- Project details from the new-project form, the project's team, and team invite links.

-- What the agency agreed to deliver (e.g. "8 posts + 2 reels a month"). Team only.
alter table public.projects add column if not exists scope_text text not null default ''
  check (char_length(scope_text) <= 1000);

-- Which creatives work on a project. Owners and account managers see every project;
-- creatives see (and get the internal room of) only the projects they're on.
create table if not exists public.project_members (
  project_id uuid not null references public.projects (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (project_id, user_id)
);
create index if not exists project_members_user_idx on public.project_members (user_id);
alter table public.project_members enable row level security;
revoke all on public.project_members from anon, authenticated;

-- Link-based invites for agency teammates (account manager or creative). Only the token's
-- hash is stored; links last 7 days and work once.
create table if not exists public.team_invites (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  role text not null check (role in ('am', 'creative')),
  token_hash text not null unique,
  created_by uuid not null references auth.users (id) on delete cascade,
  expires_at timestamptz not null default now() + interval '7 days',
  used_by uuid references auth.users (id) on delete set null,
  used_at timestamptz,
  revoked_at timestamptz
);
create index if not exists team_invites_workspace_idx on public.team_invites (workspace_id);
alter table public.team_invites enable row level security;
revoke all on public.team_invites from anon, authenticated;
