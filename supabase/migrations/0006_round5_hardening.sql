-- Round 5: demo projects, plan limits, rate limits.

-- Demo projects (seeded on onboarding) don't count towards the Free plan's 2 active clients.
alter table public.projects add column if not exists is_demo boolean not null default false;

-- Fixed-window rate limiter shared by every serverless instance (PRD section 7: auth, join,
-- upload and AI routes limited per user and IP). Server-only: no grants to anon/authenticated.
create table if not exists public.rate_limits (
  key text not null,
  window_start timestamptz not null,
  hits int not null default 0,
  primary key (key, window_start)
);
alter table public.rate_limits enable row level security;
revoke all on public.rate_limits from anon, authenticated;

-- Counts one hit for `p_key` in the current window; true while within `p_limit`.
create or replace function public.rate_limit_hit(p_key text, p_limit int, p_window_seconds int)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  w timestamptz := to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds);
  n int;
begin
  insert into public.rate_limits (key, window_start, hits) values (p_key, w, 1)
  on conflict (key, window_start) do update set hits = public.rate_limits.hits + 1
  returning hits into n;
  -- Housekeeping: drop this key's old windows.
  delete from public.rate_limits where key = p_key and window_start < w;
  return n <= p_limit;
end;
$$;
revoke all on function public.rate_limit_hit(text, int, int) from public, anon, authenticated;
grant execute on function public.rate_limit_hit(text, int, int) to service_role;
