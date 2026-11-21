-- Drifty Round 3: room messages, change items, feedback-drift (conflict) alerts, jobs, voice notes.

-- Every message in a project's rooms (from the Nexconn webhook, or sent by our server).
create table public.messages (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  project_id uuid not null references public.projects (id) on delete cascade,
  channel_id text not null,
  nexconn_msg_id text not null unique,
  author_id text not null,                 -- Nexconn user id of the sender
  kind text not null,                      -- text | voice | image | file | card | other
  text text,
  reply_to_msg_id text,
  voice_url text,                          -- storage path for voice notes
  transcript text,
  sent_at timestamptz not null
);
create index messages_project_time_idx on public.messages (project_id, sent_at desc);
create index messages_channel_time_idx on public.messages (channel_id, sent_at desc);

create table public.change_items (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  version_id uuid not null references public.versions (id) on delete cascade,
  text text not null check (char_length(text) between 1 and 1000),
  type text not null check (type in ('copy', 'visual', 'layout', 'other', 'question')),
  author_ids text[] not null default '{}',
  source_msg_ids text[] not null default '{}',
  status text not null default 'suggested'
    check (status in ('suggested', 'confirmed', 'rejected', 'done', 'missing', 'reversed', 'needs_check')),
  confidence real check (confidence between 0 and 1),
  confirmed_by uuid references auth.users (id) on delete set null,
  origin text not null default 'ai' check (origin in ('ai', 'conflict', 'manual')),
  conflict_id uuid
);
create index change_items_version_idx on public.change_items (version_id);

-- Drift alerts: kind 'feedback' = conflicting client requests (FR-12); 'version' arrives in Round 4.
create table public.drift_alerts (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  deliverable_id uuid not null references public.deliverables (id) on delete cascade,
  version_id uuid references public.versions (id) on delete cascade,
  kind text not null check (kind in ('feedback', 'version', 'scope', 'approval')),
  detail jsonb not null default '{}',
  card_message_id text,
  resolved_by uuid,
  resolved_at timestamptz
);
create index drift_alerts_deliverable_idx on public.drift_alerts (deliverable_id);

-- One change list card per summarise run (so it can be updated in place).
create table public.change_lists (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  version_id uuid not null references public.versions (id) on delete cascade,
  card_message_id text,
  created_by uuid not null references auth.users (id) on delete restrict,
  brief_sent_at timestamptz,
  message_count int not null default 0
);
create index change_lists_version_idx on public.change_lists (version_id);
alter table public.change_items add column change_list_id uuid references public.change_lists (id) on delete cascade;

-- Background jobs with retry (voice transcription; AI later).
create table public.jobs (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  kind text not null,
  payload jsonb not null default '{}',
  status text not null default 'queued' check (status in ('queued', 'running', 'done', 'failed')),
  attempts int not null default 0,
  last_error text,
  updated_at timestamptz not null default now()
);
create index jobs_status_idx on public.jobs (status, created_at);

-- RLS: workspace members read; only the server writes. Clients never read these directly.
alter table public.messages enable row level security;
alter table public.change_items enable row level security;
alter table public.drift_alerts enable row level security;
alter table public.change_lists enable row level security;
alter table public.jobs enable row level security;

create policy "members read messages" on public.messages for select to authenticated using (
  exists (select 1 from public.projects p where p.id = project_id and public.is_workspace_member(p.workspace_id)));
create policy "members read change items" on public.change_items for select to authenticated using (
  exists (select 1 from public.versions v join public.deliverables d on d.id = v.deliverable_id
          join public.projects p on p.id = d.project_id
          where v.id = version_id and public.is_workspace_member(p.workspace_id)));
create policy "members read drift alerts" on public.drift_alerts for select to authenticated using (
  exists (select 1 from public.deliverables d join public.projects p on p.id = d.project_id
          where d.id = deliverable_id and public.is_workspace_member(p.workspace_id)));
create policy "members read change lists" on public.change_lists for select to authenticated using (
  exists (select 1 from public.versions v join public.deliverables d on d.id = v.deliverable_id
          join public.projects p on p.id = d.project_id
          where v.id = version_id and public.is_workspace_member(p.workspace_id)));
-- jobs: no policies (server only)
revoke all on public.messages, public.change_items, public.drift_alerts, public.change_lists, public.jobs from anon;

-- Private bucket for voice notes (audio only, 10 MB).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('voice', 'voice', false, 10485760,
        array['audio/webm', 'audio/ogg', 'audio/mp4', 'audio/mpeg', 'audio/wav', 'audio/aac', 'audio/x-m4a'])
on conflict (id) do update
  set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;
