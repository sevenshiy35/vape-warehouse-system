-- Keep inventory location consistent with available stock.
-- Rule: when quantity_on_hand is 0, shelf_location must be null.

create or replace function public.clear_zero_inventory_shelf_location()
returns trigger
language plpgsql
as $$
begin
  if coalesce(new.quantity_on_hand, 0) = 0 then
    new.shelf_location := null;
  end if;

  return new;
end;
$$;

drop trigger if exists clear_zero_inventory_shelf_location_trigger
on public.inventory;

create trigger clear_zero_inventory_shelf_location_trigger
before insert or update of quantity_on_hand, shelf_location
on public.inventory
for each row
execute function public.clear_zero_inventory_shelf_location();

with zero_location as (
  select
    i.product_id,
    i.shelf_location as old_shelf_location,
    i.quantity_on_hand,
    p.sku,
    coalesce(p.display_name, p.product_name_cn) as product_name
  from public.inventory i
  join public.products p on p.id = i.product_id
  where i.quantity_on_hand = 0
    and nullif(trim(i.shelf_location), '') is not null
),
updated as (
  update public.inventory i
  set
    shelf_location = null,
    updated_at = now()
  from zero_location z
  where i.product_id = z.product_id
  returning
    z.product_id,
    z.old_shelf_location,
    z.quantity_on_hand,
    z.sku,
    z.product_name
)
insert into public.inventory_logs (
  product_id,
  sku_snapshot,
  product_name_snapshot,
  change_qty,
  before_qty,
  after_qty,
  log_type,
  reason,
  operator,
  old_shelf_location,
  new_shelf_location
)
select
  product_id,
  sku,
  product_name,
  0,
  quantity_on_hand,
  quantity_on_hand,
  'LocationMove',
  'Auto clear location because inventory is zero',
  'system',
  old_shelf_location,
  null
from updated;

notify pgrst, 'reload schema';
