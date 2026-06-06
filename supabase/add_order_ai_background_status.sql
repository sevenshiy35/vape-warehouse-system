alter table public.orders
add column if not exists ai_status text default 'not_started';

alter table public.orders
add column if not exists ai_error text;

alter table public.orders
add column if not exists ai_processed_at timestamp with time zone;

update public.orders
set ai_status = case
  when ai_raw_result is not null then 'completed'
  else 'not_started'
end
where ai_status is null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'orders_ai_status_check'
      and conrelid = 'public.orders'::regclass
  ) then
    alter table public.orders
    add constraint orders_ai_status_check
    check (
      ai_status in (
        'not_started',
        'processing',
        'completed',
        'failed'
      )
    );
  end if;
end;
$$;

notify pgrst, 'reload schema';
