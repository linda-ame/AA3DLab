-- AA3DLab — pilna shēma (orders + messages + RLS)
-- Palaid SQL Editorī vai: node scripts/apply-schema.mjs

create extension if not exists pgcrypto;

-- ── Orders ──────────────────────────────────────────────
create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  name text not null,
  email text,
  phone text not null,
  school_class text,
  payment_method text not null default 'cash',
  note text,
  items jsonb not null default '[]'::jsonb,
  status text not null default 'new',
  is_viewed boolean not null default false,
  is_made boolean not null default false,
  is_notified boolean not null default false,
  is_delivered boolean not null default false,
  admin_note text
);

alter table public.orders add column if not exists school_class text;
alter table public.orders add column if not exists payment_method text;
alter table public.orders add column if not exists phone text;
alter table public.orders alter column email drop not null;
alter table public.orders add column if not exists is_viewed boolean not null default false;
alter table public.orders add column if not exists is_made boolean not null default false;
alter table public.orders add column if not exists is_notified boolean not null default false;
alter table public.orders add column if not exists is_delivered boolean not null default false;
alter table public.orders add column if not exists admin_note text;

update public.orders set payment_method = 'cash' where payment_method is null;
alter table public.orders alter column payment_method set default 'cash';
alter table public.orders alter column payment_method set not null;

-- vecie statusi → jaunie flagi (vienreizīgi, droši atkārtot)
update public.orders
  set is_viewed = true
  where status in ('in_progress', 'done', 'archived') and is_viewed = false;
update public.orders
  set is_made = true
  where status in ('done', 'archived') and is_made = false;

alter table public.orders enable row level security;

drop policy if exists "Anyone can insert orders" on public.orders;
create policy "Anyone can insert orders"
  on public.orders for insert to anon, authenticated
  with check (true);

drop policy if exists "Authenticated can read orders" on public.orders;
create policy "Authenticated can read orders"
  on public.orders for select to authenticated
  using (true);

drop policy if exists "Authenticated can update orders" on public.orders;
create policy "Authenticated can update orders"
  on public.orders for update to authenticated
  using (true)
  with check (true);

-- ── Messages (saziņas forma) ────────────────────────────
create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  name text not null,
  email text not null,
  message text not null,
  status text not null default 'new',
  is_read boolean not null default false,
  is_replied boolean not null default false
);

alter table public.messages add column if not exists is_read boolean not null default false;
alter table public.messages add column if not exists is_replied boolean not null default false;

update public.messages
  set is_read = true
  where status in ('read', 'in_progress', 'done', 'replied', 'archived')
    and is_read = false;
update public.messages
  set is_replied = true
  where status in ('done', 'replied', 'archived') and is_replied = false;

alter table public.messages enable row level security;

drop policy if exists "Anyone can insert messages" on public.messages;
create policy "Anyone can insert messages"
  on public.messages for insert to anon, authenticated
  with check (true);

drop policy if exists "Authenticated can read messages" on public.messages;
create policy "Authenticated can read messages"
  on public.messages for select to authenticated
  using (true);

drop policy if exists "Authenticated can update messages" on public.messages;
create policy "Authenticated can update messages"
  on public.messages for update to authenticated
  using (true)
  with check (true);

-- ── Per-user lasīšana / apskate (katram adminam atsevišķi) ──
create table if not exists public.message_reads (
  message_id uuid not null references public.messages(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  read_at timestamptz not null default now(),
  primary key (message_id, user_id)
);

create table if not exists public.order_views (
  order_id uuid not null references public.orders(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  viewed_at timestamptz not null default now(),
  primary key (order_id, user_id)
);

alter table public.message_reads enable row level security;
alter table public.order_views enable row level security;

drop policy if exists "Users manage own message reads" on public.message_reads;
create policy "Users manage own message reads"
  on public.message_reads for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "Users manage own order views" on public.order_views;
create policy "Users manage own order views"
  on public.order_views for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Esošie globālie flagi → katram pašreizējam adminam (vienreizīgi)
insert into public.message_reads (message_id, user_id)
select m.id, u.id
from public.messages m
cross join auth.users u
where m.is_read = true
on conflict do nothing;

insert into public.order_views (order_id, user_id)
select o.id, u.id
from public.orders o
cross join auth.users u
where o.is_viewed = true
on conflict do nothing;

-- ── Site settings (cenas u.c.) ───────────────────────────
create table if not exists public.site_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

insert into public.site_settings (key, value)
values (
  'pricing',
  '{
    "readyBaseEur": {"S": 1.5, "M": 2.0, "L": 2.5},
    "customBaseEur": {"S": 2.0, "M": 2.5, "L": 3.5},
    "freeChars": 10,
    "longTextSurchargeEur": 0.5,
    "carabinerSurchargeEur": 0.5
  }'::jsonb
)
on conflict (key) do nothing;

alter table public.site_settings enable row level security;

drop policy if exists "Anyone can read site settings" on public.site_settings;
create policy "Anyone can read site settings"
  on public.site_settings for select to anon, authenticated
  using (true);

drop policy if exists "Authenticated can upsert site settings" on public.site_settings;
create policy "Authenticated can upsert site settings"
  on public.site_settings for insert to authenticated
  with check (true);

drop policy if exists "Authenticated can update site settings" on public.site_settings;
create policy "Authenticated can update site settings"
  on public.site_settings for update to authenticated
  using (true)
  with check (true);

grant usage on schema public to anon, authenticated;
grant insert on table public.orders to anon, authenticated;
grant select, update on table public.orders to authenticated;
grant insert on table public.messages to anon, authenticated;
grant select, update on table public.messages to authenticated;
grant select, insert, update, delete on table public.message_reads to authenticated;
grant select, insert, update, delete on table public.order_views to authenticated;
grant select on table public.site_settings to anon, authenticated;
grant insert, update on table public.site_settings to authenticated;

-- Realtime (admin live updates)
do $$
begin
  alter publication supabase_realtime add table public.orders;
exception when duplicate_object then null;
end $$;
do $$
begin
  alter publication supabase_realtime add table public.messages;
exception when duplicate_object then null;
end $$;

-- PostgREST schema cache
notify pgrst, 'reload schema';
