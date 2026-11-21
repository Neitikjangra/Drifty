-- Drifty Round 2: deliverables, versions, approvals (PRD section 6) + private asset storage.

create table public.deliverables (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  project_id uuid not null references public.projects (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 120),
  due_date date,
  status text not null default 'in_review'
    check (status in ('draft', 'in_review', 'changes_requested', 'approved')),
  current_version int not null default 1
);
create index deliverables_project_idx on public.deliverables (project_id);

create table public.versions (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  deliverable_id uuid not null references public.deliverables (id) on delete cascade,
  number int not null check (number >= 1),
  asset_path text not null,
  asset_sha256 text not null check (asset_sha256 ~ '^[0-9a-f]{64}$'),
  asset_mime text not null,
  copy_text text not null default '' check (char_length(copy_text) <= 5000),
  card_message_id text,
  created_by uuid not null references auth.users (id) on delete restrict,
  unique (deliverable_id, number)
);

-- Ledger (FR-13, NFR-4): insert-only. No update/delete for anyone, enforced twice:
-- privileges are revoked AND a trigger rejects any update/delete.
create table public.approvals (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  version_id uuid not null references public.versions (id) on delete restrict,
  approver_id uuid not null references public.profiles (user_id) on delete restrict,
  approved_at timestamptz not null default now(),
  copy_snapshot text not null,
  asset_sha256 text not null check (asset_sha256 ~ '^[0-9a-f]{64}$'),
  unique (version_id)
);

create or replace function public.approvals_are_immutable()
returns trigger language plpgsql as $$
begin
  raise exception 'approvals are insert-only (ledger integrity)';
end;
$$;
create trigger approvals_no_update before update on public.approvals
  for each row execute function public.approvals_are_immutable();
create trigger approvals_no_delete before delete on public.approvals
  for each row execute function public.approvals_are_immutable();
create trigger approvals_no_truncate before truncate on public.approvals
  for each statement execute function public.approvals_are_immutable();

revoke update, delete, truncate on public.approvals from anon, authenticated, service_role;

-- RLS: members of the owning workspace may read; only the server writes.
alter table public.deliverables enable row level security;
alter table public.versions enable row level security;
alter table public.approvals enable row level security;

create policy "members read deliverables" on public.deliverables
  for select to authenticated using (
    exists (select 1 from public.projects p where p.id = project_id and public.is_workspace_member(p.workspace_id))
  );
create policy "members read versions" on public.versions
  for select to authenticated using (
    exists (select 1 from public.deliverables d join public.projects p on p.id = d.project_id
            where d.id = deliverable_id and public.is_workspace_member(p.workspace_id))
  );
create policy "members read approvals" on public.approvals
  for select to authenticated using (
    exists (select 1 from public.versions v join public.deliverables d on d.id = v.deliverable_id
            join public.projects p on p.id = d.project_id
            where v.id = version_id and public.is_workspace_member(p.workspace_id))
  );
revoke all on public.deliverables, public.versions, public.approvals from anon;

-- Private bucket for drafts: max 20 MB, images and PDF only (PRD section 7).
-- No storage policies: only the server (service role) reads/writes; uploads use
-- short-lived signed upload URLs issued after a permission check.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('deliverables', 'deliverables', false, 20971520,
        array['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'application/pdf'])
on conflict (id) do update
  set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;
