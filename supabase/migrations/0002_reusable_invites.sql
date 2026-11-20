-- Round 1 fix: client invite links are personal and reusable (30 days, any device,
-- revocable). An invite now maps to ONE invited person (used_by = their guest id).
alter table public.invites rename column used_at to first_used_at;
alter table public.invites add column last_used_at timestamptz;
update public.invites set last_used_at = first_used_at where first_used_at is not null;
create index if not exists invites_used_by_idx on public.invites (used_by);
