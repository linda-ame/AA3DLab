-- Palaid pēc schema.sql — dod viesiem tiesības iesniegt
grant usage on schema public to anon, authenticated;

grant insert on table public.orders to anon, authenticated;
grant select, update on table public.orders to authenticated;

grant insert on table public.messages to anon, authenticated;
grant select, update on table public.messages to authenticated;

notify pgrst, 'reload schema';
