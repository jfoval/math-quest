-- Math Quest "Family Sync" — run this once in your Supabase project (SQL Editor → New query → Run).
-- It creates one table and two functions. The table is NOT readable directly with the public key;
-- the app can only fetch/store the row for a family code it knows.

create table if not exists public.mq_families (
  code text primary key,
  data jsonb not null,
  updated_at timestamptz not null default now()
);
alter table public.mq_families enable row level security;   -- no policies = no direct access
revoke all on public.mq_families from anon, authenticated;

create or replace function public.mq_get(p_code text)
returns jsonb language sql security definer set search_path = public as $$
  select data from public.mq_families where code = p_code;
$$;

create or replace function public.mq_put(p_code text, p_data jsonb)
returns void language sql security definer set search_path = public as $$
  insert into public.mq_families (code, data, updated_at) values (p_code, p_data, now())
  on conflict (code) do update set data = excluded.data, updated_at = now();
$$;

grant execute on function public.mq_get(text) to anon, authenticated;
grant execute on function public.mq_put(text, jsonb) to anon, authenticated;
