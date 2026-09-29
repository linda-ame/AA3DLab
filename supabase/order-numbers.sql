-- Pasūtījuma numuri + place_order RPC
-- Palaid Supabase SQL Editorī (vai caur apply-schema.mjs / schema.sql)

create sequence if not exists public.orders_order_number_seq;

alter table public.orders add column if not exists order_number bigint;

update public.orders
  set order_number = nextval('public.orders_order_number_seq')
  where order_number is null;

select setval(
  'public.orders_order_number_seq',
  greatest(
    1000,
    coalesce((select max(order_number) from public.orders), 1000)
  )
);

alter table public.orders
  alter column order_number set default nextval('public.orders_order_number_seq');

update public.orders
  set order_number = nextval('public.orders_order_number_seq')
  where order_number is null;

alter table public.orders alter column order_number set not null;

alter sequence public.orders_order_number_seq owned by public.orders.order_number;

create unique index if not exists orders_order_number_uidx
  on public.orders (order_number);

create or replace function public.place_order(
  p_name text,
  p_email text,
  p_phone text,
  p_school_class text,
  p_payment_method text,
  p_note text,
  p_items jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.orders%rowtype;
begin
  if p_name is null or length(trim(p_name)) = 0 then
    raise exception 'name required';
  end if;
  if p_phone is null or length(trim(p_phone)) = 0 then
    raise exception 'phone required';
  end if;

  insert into public.orders (
    name, email, phone, school_class, payment_method, note, items, status
  ) values (
    trim(p_name),
    nullif(trim(coalesce(p_email, '')), ''),
    trim(p_phone),
    nullif(trim(coalesce(p_school_class, '')), ''),
    case
      when coalesce(p_payment_method, '') = 'transfer' then 'transfer'
      else 'cash'
    end,
    nullif(trim(coalesce(p_note, '')), ''),
    coalesce(p_items, '[]'::jsonb),
    'new'
  )
  returning * into r;

  return jsonb_build_object(
    'id', r.id,
    'order_number', r.order_number
  );
end;
$$;

revoke all on function public.place_order(text, text, text, text, text, text, jsonb) from public;
grant execute on function public.place_order(text, text, text, text, text, text, jsonb)
  to anon, authenticated;

notify pgrst, 'reload schema';
