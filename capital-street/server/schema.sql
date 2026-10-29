-- Capital Street multiplayer (Goal 11): players, who owns which building, and chat.
-- Run once in a Supabase project (SQL editor, or as a migration). Everything is prefixed cs_ so it can share a project.
-- Everyone can read everything; every write is checked here, on the server:
--   a player row is yours alone, a building can only be claimed if nobody else owns it, chat is posted as yourself.
-- Not yet checked here: what you paid. Cash still lives in each player's own save until the economy moves to the
-- server (Goals 13 and 14), so a player who edits their save could afford more than they should.

-- ---------- players ----------
create table if not exists public.cs_players (
  id uuid primary key references auth.users (id) on delete cascade,
  name text not null check (name ~ '^[A-Za-z0-9][A-Za-z0-9 _.-]{1,18}[A-Za-z0-9]$'),
  color text not null default '#4c8dff' check (color ~ '^#[0-9a-fA-F]{6}$'),
  city text not null default 'nyc' check (city in ('nyc', 'london', 'tokyo', 'hongkong', 'dubai')),
  net_worth numeric not null default 0 check (net_worth between -1e12 and 1e15), -- reported by the player's game
  created_at timestamptz not null default now(),
  last_seen timestamptz not null default now()
);
create unique index if not exists cs_players_name on public.cs_players (lower(name));
alter table public.cs_players enable row level security;
drop policy if exists "players are public" on public.cs_players;
create policy "players are public" on public.cs_players for select using (true);
drop policy if exists "you create your own player" on public.cs_players;
create policy "you create your own player" on public.cs_players for insert to authenticated with check ((select auth.uid()) = id);
drop policy if exists "you edit your own player" on public.cs_players;
create policy "you edit your own player" on public.cs_players for update to authenticated using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

-- ---------- buildings: one owner per building, in every city ----------
create table if not exists public.cs_buildings (
  city text not null check (city in ('nyc', 'london', 'tokyo', 'hongkong', 'dubai')),
  building text not null check (char_length(building) between 1 and 40), -- the game's property key, e.g. '1234' or 'london:18'
  owner uuid not null references public.cs_players (id) on delete cascade,
  floors int not null check (floors between 1 and 300),
  name text check (char_length(name) <= 80),
  bought_at timestamptz not null default now(),
  primary key (city, building)
);
create index if not exists cs_buildings_owner on public.cs_buildings (owner);
alter table public.cs_buildings enable row level security;
alter table public.cs_buildings replica identity full; -- so live updates say whose building was sold
drop policy if exists "ownership is public" on public.cs_buildings;
create policy "ownership is public" on public.cs_buildings for select using (true);
-- no insert, update or delete policies: changes only through the two functions below

create or replace function public.cs_claim_building(p_city text, p_building text, p_floors int, p_name text)
returns public.cs_buildings language plpgsql security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
  r public.cs_buildings;
begin
  if me is null then raise exception 'Sign in first'; end if;
  if not exists (select 1 from public.cs_players where id = me) then raise exception 'Pick a player name first'; end if;
  insert into public.cs_buildings as b (city, building, owner, floors, name)
    values (p_city, p_building, me, p_floors, left(p_name, 80))
  on conflict (city, building) do update set floors = excluded.floors, name = excluded.name where b.owner = me
  returning * into r;
  if r.owner is null then raise exception 'Another player owns this building'; end if;
  return r;
end $$;

create or replace function public.cs_release_building(p_city text, p_building text)
returns void language sql security definer set search_path = '' as $$
  delete from public.cs_buildings where city = p_city and building = p_building and owner = auth.uid();
$$;

-- ---------- chat: a world room and one per city ----------
create table if not exists public.cs_chat (
  id bigint generated always as identity primary key,
  room text not null check (room in ('global', 'nyc', 'london', 'tokyo', 'hongkong', 'dubai')),
  player uuid not null default auth.uid() references public.cs_players (id) on delete cascade,
  name text not null default '',
  body text not null check (char_length(body) between 1 and 280),
  created_at timestamptz not null default now()
);
create index if not exists cs_chat_room on public.cs_chat (room, created_at desc);
alter table public.cs_chat enable row level security;
drop policy if exists "chat is public" on public.cs_chat;
create policy "chat is public" on public.cs_chat for select using (true);
drop policy if exists "you post as yourself" on public.cs_chat;
create policy "you post as yourself" on public.cs_chat for insert to authenticated with check ((select auth.uid()) = player);

-- the sender's current name is filled in by the server, and one message every 1.5 seconds is the most anyone can send
create or replace function public.cs_chat_before_insert()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  select name into new.name from public.cs_players where id = new.player;
  if new.name is null then raise exception 'Pick a player name first'; end if;
  if exists (select 1 from public.cs_chat where player = new.player and created_at > now() - interval '1.5 seconds') then
    raise exception 'Slow down: one message every couple of seconds';
  end if;
  new.body := btrim(regexp_replace(new.body, '[[:cntrl:]]', ' ', 'g'));
  new.created_at := now();
  return new;
end $$;
drop trigger if exists cs_chat_before_insert on public.cs_chat;
create trigger cs_chat_before_insert before insert on public.cs_chat for each row execute function public.cs_chat_before_insert();

-- ---------- your account ----------
-- deletes your login, player, buildings and messages
create or replace function public.cs_delete_me()
returns void language sql security definer set search_path = '' as $$
  delete from auth.users where id = auth.uid();
$$;

-- only signed-in players may call the functions
revoke all on function public.cs_claim_building(text, text, int, text) from public, anon;
revoke all on function public.cs_release_building(text, text) from public, anon;
revoke all on function public.cs_delete_me() from public, anon;
revoke all on function public.cs_chat_before_insert() from public, anon, authenticated;
grant execute on function public.cs_claim_building(text, text, int, text) to authenticated;
grant execute on function public.cs_release_building(text, text) to authenticated;
grant execute on function public.cs_delete_me() to authenticated;

-- ---------- live updates ----------
do $$ begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'cs_buildings') then
    alter publication supabase_realtime add table public.cs_buildings;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'cs_chat') then
    alter publication supabase_realtime add table public.cs_chat;
  end if;
end $$;
