-- Drifty Round 1: workspaces, members, profiles, projects, guests, invites (PRD section 6).
-- Writes happen only on the server (service role) after explicit permission checks.
-- RLS is on for every table; signed-in agency users may READ their own workspace data.
-- Client guests have no Supabase session and never read tables directly.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------- tables

create table public.workspaces (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  name text not null check (char_length(name) between 1 and 80),
  owner_id uuid not null references auth.users (id) on delete restrict,
  plan text not null default 'free'
);

create table public.members (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null check (role in ('owner', 'am', 'creative')),
  unique (workspace_id, user_id)
);
create index members_user_idx on public.members (user_id);

-- One row per person: agency users (user_id = auth.users.id) and client guests
-- (user_id = random uuid, no auth.users row).
create table public.profiles (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  user_id uuid not null unique,
  display_name text not null check (char_length(display_name) between 1 and 64),
  email text,
  nexconn_user_id text not null unique
);

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  client_name text not null check (char_length(client_name) between 1 and 64),
  approver_id uuid references public.profiles (user_id) on delete set null,
  rounds_included int not null default 2 check (rounds_included between 1 and 20),
  client_channel_id text unique,
  internal_channel_id text unique,
  archived boolean not null default false
);
create index projects_workspace_idx on public.projects (workspace_id);

create table public.project_guests (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  project_id uuid not null references public.projects (id) on delete cascade,
  user_id uuid not null references public.profiles (user_id) on delete cascade,
  role text not null check (role in ('approver', 'reviewer')),
  unique (project_id, user_id)
);
-- At most one approver per project.
create unique index project_guests_one_approver
  on public.project_guests (project_id) where role = 'approver';

create table public.invites (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  project_id uuid not null references public.projects (id) on delete cascade,
  email_or_phone text not null check (char_length(email_or_phone) between 3 and 120),
  display_name text check (char_length(display_name) <= 64),
  role text not null check (role in ('approver', 'reviewer')),
  token_hash text not null unique,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  used_at timestamptz,
  used_by uuid references public.profiles (user_id) on delete set null,
  created_by uuid not null references auth.users (id) on delete restrict
);
create index invites_project_idx on public.invites (project_id);

-- ---------------------------------------------------------------- RLS

alter table public.workspaces enable row level security;
alter table public.members enable row level security;
alter table public.profiles enable row level security;
alter table public.projects enable row level security;
alter table public.project_guests enable row level security;
alter table public.invites enable row level security;

-- Membership check that doesn't recurse through members' own policy.
create or replace function public.is_workspace_member(ws uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.members m
    where m.workspace_id = ws and m.user_id = auth.uid()
  );
$$;
revoke all on function public.is_workspace_member(uuid) from public;
grant execute on function public.is_workspace_member(uuid) to authenticated;

create policy "members read their workspaces" on public.workspaces
  for select to authenticated using (public.is_workspace_member(id));

create policy "members read co-members" on public.members
  for select to authenticated using (public.is_workspace_member(workspace_id));

create policy "members read workspace projects" on public.projects
  for select to authenticated using (public.is_workspace_member(workspace_id));

create policy "members read project guests" on public.project_guests
  for select to authenticated using (
    exists (select 1 from public.projects p
            where p.id = project_id and public.is_workspace_member(p.workspace_id))
  );

create policy "members read project invites" on public.invites
  for select to authenticated using (
    exists (select 1 from public.projects p
            where p.id = project_id and public.is_workspace_member(p.workspace_id))
  );

create policy "read own profile" on public.profiles
  for select to authenticated using (user_id = auth.uid());

create policy "members read profiles in their workspaces" on public.profiles
  for select to authenticated using (
    exists (
      select 1 from public.members m
      where m.user_id = profiles.user_id and public.is_workspace_member(m.workspace_id)
    )
    or exists (
      select 1 from public.project_guests g
      join public.projects p on p.id = g.project_id
      where g.user_id = profiles.user_id and public.is_workspace_member(p.workspace_id)
    )
  );

-- No insert/update/delete policies: only the server (service role) writes.
-- Belt and braces: anon gets nothing at all.
revoke all on public.workspaces, public.members, public.profiles, public.projects,
  public.project_guests, public.invites from anon;
