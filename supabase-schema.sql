-- Math Quest — accounts & progress. Paste into Supabase: SQL Editor → New query → Run (safe to re-run).
-- Parents sign in with email. Kids sign in with a username + password (stored as <username>@kids.mathquest.app).
-- Also in the dashboard: Authentication → Providers → Email → turn OFF "Confirm email"
--                        Authentication → Settings → Minimum password length → 4 (so kids can use a PIN)

create extension if not exists pgcrypto;

create table if not exists public.families (
  id uuid primary key default gen_random_uuid(),
  name text not null default 'My family',
  invite_code text unique not null default encode(gen_random_bytes(4), 'hex'),
  created_at timestamptz not null default now()
);

create table if not exists public.members (
  user_id uuid primary key references auth.users(id) on delete cascade,
  family_id uuid not null references public.families(id) on delete cascade,
  role text not null check (role in ('parent', 'kid')),
  username text unique,              -- kids only, lowercase
  name text not null,
  avatar text not null default '🦊',
  created_at timestamptz not null default now()
);
create index if not exists members_family_idx on public.members(family_id);

create table if not exists public.progress (
  user_id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.families enable row level security;
alter table public.members  enable row level security;
alter table public.progress enable row level security;

-- helpers -------------------------------------------------------------------
create or replace function public.my_family_id() returns uuid
language sql stable security definer set search_path = public as $$
  select family_id from public.members where user_id = auth.uid();
$$;
create or replace function public.i_am_parent() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.members where user_id = auth.uid() and role = 'parent');
$$;

-- policies ------------------------------------------------------------------
drop policy if exists fam_select on public.families;
create policy fam_select on public.families for select using (id = public.my_family_id());
drop policy if exists fam_update on public.families;
create policy fam_update on public.families for update using (id = public.my_family_id() and public.i_am_parent()) with check (id = public.my_family_id());

drop policy if exists mem_select on public.members;
create policy mem_select on public.members for select using (family_id = public.my_family_id());
drop policy if exists mem_update_self on public.members;   -- self-edits go through update_my_profile() below
drop policy if exists mem_parent_update on public.members;
create policy mem_parent_update on public.members for update
  using (family_id = public.my_family_id() and public.i_am_parent())
  with check (family_id = public.my_family_id() and role in ('parent', 'kid'));
-- parents may only change name/avatar/username via PATCH; role and family_id are pinned by a trigger
create or replace function public.members_guard() returns trigger language plpgsql as $$
begin
  if new.role <> old.role or new.family_id <> old.family_id or new.user_id <> old.user_id then raise exception 'role/family cannot be changed'; end if;
  return new;
end $$;
drop trigger if exists members_guard on public.members;
create trigger members_guard before update on public.members for each row execute function public.members_guard();

-- progress.updated_at is always server time
create or replace function public.touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;
drop trigger if exists progress_touch on public.progress;
create trigger progress_touch before insert or update on public.progress for each row execute function public.touch_updated_at();
drop policy if exists mem_parent_delete on public.members;
create policy mem_parent_delete on public.members for delete using (family_id = public.my_family_id() and public.i_am_parent() and user_id <> auth.uid());

drop policy if exists prog_self on public.progress;
create policy prog_self on public.progress for all using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists prog_parent on public.progress;
create policy prog_parent on public.progress for all
  using (public.i_am_parent() and user_id in (select user_id from public.members where family_id = public.my_family_id()))
  with check (public.i_am_parent() and user_id in (select user_id from public.members where family_id = public.my_family_id()));

-- RPCs ----------------------------------------------------------------------
-- A freshly signed-up parent creates their family.
create or replace function public.create_family(p_name text, p_parent_name text)
returns uuid language plpgsql security definer set search_path = public as $$
declare fid uuid;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  if exists (select 1 from public.members where user_id = auth.uid()) then raise exception 'already in a family'; end if;
  insert into public.families(name) values (coalesce(nullif(p_name, ''), 'My family')) returning id into fid;
  insert into public.members(user_id, family_id, role, name) values (auth.uid(), fid, 'parent', coalesce(nullif(p_parent_name, ''), 'Parent'));
  return fid;
end $$;

-- A second parent joins with the family's invite code.
create or replace function public.join_family(p_code text, p_parent_name text)
returns uuid language plpgsql security definer set search_path = public as $$
declare fid uuid;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  select id into fid from public.families where invite_code = lower(trim(p_code));
  if fid is null then raise exception 'invalid invite code'; end if;
  if exists (select 1 from public.members where user_id = auth.uid()) then raise exception 'already in a family'; end if;
  insert into public.members(user_id, family_id, role, name) values (auth.uid(), fid, 'parent', coalesce(nullif(p_parent_name, ''), 'Parent'));
  return fid;
end $$;

-- A member updates their own name/avatar (kids can do this from the avatar editor).
create or replace function public.update_my_profile(p_name text, p_avatar text)
returns void language sql security definer set search_path = public as $$
  update public.members set name = coalesce(nullif(p_name, ''), name), avatar = coalesce(nullif(p_avatar, ''), avatar) where user_id = auth.uid();
$$;

-- Parent registers a kid (the kid's auth user is created client-side via sign-up first).
create or replace function public.add_kid(p_user_id uuid, p_username text, p_name text, p_avatar text)
returns void language plpgsql security definer set search_path = public as $$
declare fid uuid := public.my_family_id();
begin
  if fid is null or not public.i_am_parent() then raise exception 'parents only'; end if;
  if not exists (select 1 from auth.users where id = p_user_id and email = lower(p_username) || '@kids.mathquest.app') then raise exception 'kid account mismatch'; end if;
  insert into public.members(user_id, family_id, role, username, name, avatar) values (p_user_id, fid, 'kid', lower(p_username), p_name, coalesce(p_avatar, '🦊'));
  insert into public.progress(user_id, data) values (p_user_id, '{}'::jsonb) on conflict do nothing;
end $$;

-- Parent resets a kid's password.
create or replace function public.set_kid_password(p_user_id uuid, p_password text)
returns void language plpgsql security definer set search_path = public, auth, extensions as $$
begin
  if not public.i_am_parent() then raise exception 'parents only'; end if;
  if not exists (select 1 from public.members where user_id = p_user_id and role = 'kid' and family_id = public.my_family_id()) then raise exception 'not your kid'; end if;
  if length(p_password) < 6 then raise exception 'password too short'; end if;
  update auth.users set encrypted_password = extensions.crypt(p_password, extensions.gen_salt('bf')), updated_at = now() where id = p_user_id;
  delete from auth.refresh_tokens where user_id = p_user_id::text;  -- log the kid out everywhere
end $$;

-- Parent deletes a kid account entirely.
create or replace function public.delete_kid(p_user_id uuid)
returns void language plpgsql security definer set search_path = public, auth as $$
begin
  if not public.i_am_parent() then raise exception 'parents only'; end if;
  if not exists (select 1 from public.members where user_id = p_user_id and role = 'kid' and family_id = public.my_family_id()) then raise exception 'not your kid'; end if;
  delete from auth.users where id = p_user_id;   -- cascades to members & progress
end $$;

-- Signed-in parents can check if a kid username is free.
create or replace function public.username_taken(p_username text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.members where username = lower(trim(p_username)));
$$;

grant execute on function public.create_family(text, text), public.join_family(text, text), public.add_kid(uuid, text, text, text),
  public.set_kid_password(uuid, text), public.delete_kid(uuid), public.username_taken(text), public.update_my_profile(text, text),
  public.my_family_id(), public.i_am_parent() to authenticated;
revoke all on function public.username_taken(text) from public, anon;
