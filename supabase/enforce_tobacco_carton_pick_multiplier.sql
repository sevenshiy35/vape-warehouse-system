-- All tobacco cartons contain 10 packs. Keep the rule correct for existing
-- products and for products created through any current or future code path.

update public.products
set
  carton_pick_multiplier = 10,
  updated_at = now()
where trim(brand) = '真烟'
  and carton_pick_multiplier <> 10;

create or replace function public.enforce_tobacco_carton_pick_multiplier()
returns trigger
language plpgsql
as $$
begin
  if trim(new.brand) = '真烟' then
    new.carton_pick_multiplier := 10;
  end if;

  return new;
end;
$$;

drop trigger if exists products_enforce_tobacco_carton_pick_multiplier
on public.products;

create trigger products_enforce_tobacco_carton_pick_multiplier
before insert or update of brand, carton_pick_multiplier
on public.products
for each row
execute function public.enforce_tobacco_carton_pick_multiplier();

notify pgrst, 'reload schema';
