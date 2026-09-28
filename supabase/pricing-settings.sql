-- Cenu iestatījumi (site_settings) — droši palaist atsevišķi
-- Supabase → SQL Editor → Run

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

grant select on table public.site_settings to anon, authenticated;
grant insert, update on table public.site_settings to authenticated;

notify pgrst, 'reload schema';
