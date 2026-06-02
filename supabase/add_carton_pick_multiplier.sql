-- Keep box and carton conversion rules separate:
-- default_pick_multiplier handles boxes, carton_pick_multiplier handles cartons.

alter table public.products
add column if not exists carton_pick_multiplier integer not null default 1;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'products_carton_pick_multiplier_positive'
      and conrelid = 'public.products'::regclass
  ) then
    alter table public.products
    add constraint products_carton_pick_multiplier_positive
    check (carton_pick_multiplier > 0);
  end if;
end;
$$;

update public.products
set
  carton_pick_multiplier = 10,
  updated_at = now()
where trim(brand) = '真烟';

drop function if exists public.add_order_item_safe(uuid, uuid, integer, text);

create function public.add_order_item_safe(
  p_order_id uuid,
  p_product_id uuid,
  p_qty integer,
  p_unit text
)
returns uuid
language plpgsql
as $$
declare
  v_item_id uuid;
  v_order_status text;
  v_sku text;
  v_brand text;
  v_product_name_cn text;
  v_product_name_en text;
  v_display_name text;
  v_box_multiplier integer;
  v_carton_multiplier integer;
  v_shelf_location text;
  v_inventory_before integer;
  v_inventory_after integer;
  v_applied_qty integer := 0;
  v_pick_qty integer;
  v_unit text;
begin
  if p_order_id is null then
    raise exception 'Order id is required';
  end if;

  if p_product_id is null then
    raise exception 'Product id is required';
  end if;

  if p_qty is null or p_qty <= 0 then
    raise exception 'Quantity must be greater than 0';
  end if;

  select status
  into v_order_status
  from public.orders
  where id = p_order_id
  for update;

  if v_order_status is null then
    raise exception 'Order not found';
  end if;

  if v_order_status in ('completed', 'cancelled') then
    raise exception 'Order status % does not allow adding items', v_order_status;
  end if;

  select
    p.sku,
    p.brand,
    p.product_name_cn,
    p.product_name_en,
    p.display_name,
    greatest(coalesce(p.default_pick_multiplier, 1), 1),
    greatest(coalesce(p.carton_pick_multiplier, 1), 1),
    i.shelf_location,
    i.quantity_on_hand
  into
    v_sku,
    v_brand,
    v_product_name_cn,
    v_product_name_en,
    v_display_name,
    v_box_multiplier,
    v_carton_multiplier,
    v_shelf_location,
    v_inventory_before
  from public.products p
  join public.inventory i on i.product_id = p.id
  where p.id = p_product_id
  for update of i;

  if v_sku is null then
    raise exception 'Product not found';
  end if;

  v_unit := coalesce(nullif(trim(p_unit), ''), '支');

  if lower(v_unit) in ('盒', 'box') then
    v_pick_qty := p_qty * v_box_multiplier;
  elsif lower(v_unit) in ('条', 'carton') then
    v_pick_qty := p_qty * v_carton_multiplier;
  else
    v_pick_qty := p_qty;
  end if;

  v_inventory_after := v_inventory_before;

  if v_order_status in ('picking', 'picking_editing') then
    if v_inventory_before < v_pick_qty then
      raise exception 'Insufficient inventory for SKU %', v_sku;
    end if;

    v_applied_qty := v_pick_qty;
    v_inventory_after := v_inventory_before - v_applied_qty;

    update public.inventory
    set
      quantity_on_hand = v_inventory_after,
      updated_at = now()
    where product_id = p_product_id;

    insert into public.inventory_logs (
      product_id,
      sku_snapshot,
      product_name_snapshot,
      change_qty,
      before_qty,
      after_qty,
      log_type,
      order_id,
      reason,
      operator
    )
    values (
      p_product_id,
      v_sku,
      coalesce(v_display_name, v_product_name_cn),
      -v_applied_qty,
      v_inventory_before,
      v_inventory_after,
      'OrderAdjustment',
      p_order_id,
      'Picking item added and inventory reserved',
      'system'
    );
  end if;

  insert into public.order_items (
    order_id,
    product_id,
    quantity,
    sku_snapshot,
    brand_snapshot,
    product_name_cn_snapshot,
    product_name_en_snapshot,
    display_name_snapshot,
    recognized_qty,
    recognized_unit,
    pick_qty,
    inventory_applied_qty,
    shelf_location_snapshot,
    before_qty,
    after_qty,
    match_status,
    created_at
  )
  values (
    p_order_id,
    p_product_id,
    p_qty,
    v_sku,
    v_brand,
    v_product_name_cn,
    v_product_name_en,
    v_display_name,
    p_qty,
    v_unit,
    v_pick_qty,
    v_applied_qty,
    v_shelf_location,
    v_inventory_before,
    case
      when v_applied_qty > 0 then v_inventory_after
      else v_inventory_before - v_pick_qty
    end,
    'matched',
    now()
  )
  returning id into v_item_id;

  update public.orders
  set
    total_items = (
      select coalesce(sum(pick_qty), 0)
      from public.order_items
      where order_id = p_order_id
    ),
    updated_at = now()
  where id = p_order_id;

  return v_item_id;
end;
$$;

drop function if exists public.update_order_item_safe(uuid, integer, text);

create function public.update_order_item_safe(
  p_item_id uuid,
  p_qty integer,
  p_unit text
)
returns void
language plpgsql
as $$
declare
  v_item public.order_items%rowtype;
  v_order_status text;
  v_sku text;
  v_brand text;
  v_product_name_cn text;
  v_product_name_en text;
  v_display_name text;
  v_box_multiplier integer;
  v_carton_multiplier integer;
  v_shelf_location text;
  v_inventory_before integer;
  v_inventory_after integer;
  v_new_applied_qty integer;
  v_new_pick_qty integer;
  v_delta integer;
  v_unit text;
begin
  if p_item_id is null then
    raise exception 'Order item id is required';
  end if;

  if p_qty is null or p_qty <= 0 then
    raise exception 'Quantity must be greater than 0';
  end if;

  select *
  into v_item
  from public.order_items
  where id = p_item_id
  for update;

  if v_item.id is null then
    raise exception 'Order item not found';
  end if;

  select status
  into v_order_status
  from public.orders
  where id = v_item.order_id
  for update;

  if v_order_status in ('completed', 'cancelled') then
    raise exception 'Order status % does not allow updating items', v_order_status;
  end if;

  select
    p.sku,
    p.brand,
    p.product_name_cn,
    p.product_name_en,
    p.display_name,
    greatest(coalesce(p.default_pick_multiplier, 1), 1),
    greatest(coalesce(p.carton_pick_multiplier, 1), 1),
    i.shelf_location,
    i.quantity_on_hand
  into
    v_sku,
    v_brand,
    v_product_name_cn,
    v_product_name_en,
    v_display_name,
    v_box_multiplier,
    v_carton_multiplier,
    v_shelf_location,
    v_inventory_before
  from public.products p
  join public.inventory i on i.product_id = p.id
  where p.id = v_item.product_id
  for update of i;

  if v_sku is null then
    raise exception 'Product not found';
  end if;

  v_unit := coalesce(nullif(trim(p_unit), ''), '支');

  if lower(v_unit) in ('盒', 'box') then
    v_new_pick_qty := p_qty * v_box_multiplier;
  elsif lower(v_unit) in ('条', 'carton') then
    v_new_pick_qty := p_qty * v_carton_multiplier;
  else
    v_new_pick_qty := p_qty;
  end if;

  v_inventory_after := v_inventory_before;
  v_new_applied_qty := 0;

  if v_order_status in ('picking', 'picking_editing') then
    v_new_applied_qty := v_new_pick_qty;
    v_delta := v_new_applied_qty - coalesce(v_item.inventory_applied_qty, 0);
    v_inventory_after := v_inventory_before - v_delta;

    if v_inventory_after < 0 then
      raise exception 'Insufficient inventory for SKU %', v_sku;
    end if;

    if v_delta <> 0 then
      update public.inventory
      set
        quantity_on_hand = v_inventory_after,
        updated_at = now()
      where product_id = v_item.product_id;

      insert into public.inventory_logs (
        product_id,
        sku_snapshot,
        product_name_snapshot,
        change_qty,
        before_qty,
        after_qty,
        log_type,
        order_id,
        reason,
        operator
      )
      values (
        v_item.product_id,
        v_sku,
        coalesce(v_display_name, v_product_name_cn),
        -v_delta,
        v_inventory_before,
        v_inventory_after,
        'OrderAdjustment',
        v_item.order_id,
        'Picking item quantity updated',
        'system'
      );
    end if;
  end if;

  update public.order_items
  set
    quantity = p_qty,
    sku_snapshot = v_sku,
    brand_snapshot = v_brand,
    product_name_cn_snapshot = v_product_name_cn,
    product_name_en_snapshot = v_product_name_en,
    display_name_snapshot = v_display_name,
    recognized_qty = p_qty,
    recognized_unit = v_unit,
    pick_qty = v_new_pick_qty,
    inventory_applied_qty = v_new_applied_qty,
    shelf_location_snapshot = v_shelf_location,
    before_qty = v_inventory_before,
    after_qty = case
      when v_order_status in ('picking', 'picking_editing') then v_inventory_after
      else v_inventory_before - v_new_pick_qty
    end,
    match_status = 'matched'
  where id = p_item_id;

  update public.orders
  set
    total_items = (
      select coalesce(sum(pick_qty), 0)
      from public.order_items
      where order_id = v_item.order_id
    ),
    updated_at = now()
  where id = v_item.order_id;
end;
$$;

notify pgrst, 'reload schema';

select
  sku,
  brand,
  default_pick_multiplier as box_multiplier,
  carton_pick_multiplier
from public.products
where trim(brand) in ('真烟', 'Yohuu烟弹')
order by brand, sku;
