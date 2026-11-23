-- Dedicated team roles (Designer, Copywriter, Project manager...). The job role sits on top of
-- the access level in `role` (owner / am / creative), which is what permissions check.
alter table public.members add column if not exists title text not null default ''
  check (title ~ '^[a-z_]{0,40}$');
alter table public.team_invites add column if not exists title text not null default ''
  check (title ~ '^[a-z_]{0,40}$');
