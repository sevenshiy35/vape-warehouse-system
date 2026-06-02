-- Track the quantity from each order item that has already affected available
-- inventory. This prevents deleting an unreserved picking edit from inflating
-- stock.

alter table public.order_items
add column if not exists inventory_applied_qty integer not null default 0;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'order_items_inventory_applied_qty_nonnegative'
      and conrelid = 'public.order_items'::regclass
  ) then
    alter table public.order_items
    add constraint order_items_inventory_applied_qty_nonnegative
    check (inventory_applied_qty >= 0);
  end if;
end;
$$;

-- Backfill from the inventory ledger. For an order and product, a negative
-- ledger balance is the quantity that is still applied to inventory.
with ledger as (
  select
    order_id,
    product_id,
    greatest(0, -coalesce(sum(change_qty), 0))::integer as open_qty
  from public.inventory_logs
  where order_id is not null
    and product_id is not null
  group by order_id, product_id
),
ranked_items as (
  select
    oi.id,
    coalesce(oi.pick_qty, 0) as pick_qty,
    coalesce(l.open_qty, 0) as open_qty,
    coalesce(
      sum(coalesce(oi.pick_qty, 0)) over (
        partition by oi.order_id, oi.product_id
        order by oi.created_at, oi.id
        rows between unbounded preceding and 1 preceding
      ),
      0
    )::integer as prior_qty
  from public.order_items oi
  left join ledger l
    on l.order_id = oi.order_id
   and l.product_id = oi.product_id
)
update public.order_items oi
set inventory_applied_qty = greatest(
  0,
  least(ri.pick_qty, ri.open_qty - ri.prior_qty)
)
from ranked_items ri
where oi.id = ri.id;

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
  v_multiplier integer;
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
    i.shelf_location,
    i.quantity_on_hand
  into
    v_sku,
    v_brand,
    v_product_name_cn,
    v_product_name_en,
    v_display_name,
    v_multiplier,
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

  if lower(v_unit) in ('盒', '条', 'box', 'carton') then
    v_pick_qty := p_qty * v_multiplier;
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
  v_multiplier integer;
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
    i.shelf_location,
    i.quantity_on_hand
  into
    v_sku,
    v_brand,
    v_product_name_cn,
    v_product_name_en,
    v_display_name,
    v_multiplier,
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

  if lower(v_unit) in ('盒', '条', 'box', 'carton') then
    v_new_pick_qty := p_qty * v_multiplier;
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

drop function if exists public.delete_order_item_safe(uuid);

create function public.delete_order_item_safe(
  p_item_id uuid
)
returns void
language plpgsql
as $$
declare
  v_item public.order_items%rowtype;
  v_order_status text;
  v_inventory_before integer;
  v_inventory_after integer;
begin
  if p_item_id is null then
    raise exception 'Order item id is required';
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
    raise exception 'Order status % does not allow deleting items', v_order_status;
  end if;

  if coalesce(v_item.inventory_applied_qty, 0) > 0 then
    select quantity_on_hand
    into v_inventory_before
    from public.inventory
    where product_id = v_item.product_id
    for update;

    v_inventory_after :=
      v_inventory_before + v_item.inventory_applied_qty;

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
      v_item.sku_snapshot,
      coalesce(v_item.display_name_snapshot, v_item.product_name_cn_snapshot),
      v_item.inventory_applied_qty,
      v_inventory_before,
      v_inventory_after,
      'OrderReversal',
      v_item.order_id,
      'Picking item deleted and applied inventory restored',
      'system'
    );
  end if;

  delete from public.order_items
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

drop function if exists public.confirm_order_and_deduct(uuid);

create function public.confirm_order_and_deduct(
  p_order_id uuid
)
returns void
language plpgsql
as $$
declare
  v_order_status text;
  v_item public.order_items%rowtype;
  v_inventory_before integer;
  v_inventory_after integer;
  v_delta integer;
begin
  select status
  into v_order_status
  from public.orders
  where id = p_order_id
  for update;

  if v_order_status is null then
    raise exception 'Order not found';
  end if;

  if v_order_status not in ('uploaded', 'need_review') then
    raise exception 'Order status % cannot be confirmed', v_order_status;
  end if;

  for v_item in
    select *
    from public.order_items
    where order_id = p_order_id
    order by created_at, id
    for update
  loop
    select quantity_on_hand
    into v_inventory_before
    from public.inventory
    where product_id = v_item.product_id
    for update;

    v_delta := coalesce(v_item.pick_qty, 0)
      - coalesce(v_item.inventory_applied_qty, 0);
    v_inventory_after := v_inventory_before - v_delta;

    if v_inventory_after < 0 then
      raise exception 'Insufficient inventory for SKU %', v_item.sku_snapshot;
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
        v_item.sku_snapshot,
        coalesce(v_item.display_name_snapshot, v_item.product_name_cn_snapshot),
        -v_delta,
        v_inventory_before,
        v_inventory_after,
        'Order',
        p_order_id,
        'Order confirmed and moved to picking',
        'system'
      );
    end if;

    update public.order_items
    set
      inventory_applied_qty = coalesce(pick_qty, 0),
      before_qty = v_inventory_before,
      after_qty = v_inventory_after
    where id = v_item.id;
  end loop;

  update public.orders
  set
    status = 'picking',
    total_items = (
      select coalesce(sum(pick_qty), 0)
      from public.order_items
      where order_id = p_order_id
    ),
    updated_at = now()
  where id = p_order_id;
end;
$$;

drop function if exists public.cancel_order_and_restore(uuid);

create function public.cancel_order_and_restore(
  p_order_id uuid
)
returns void
language plpgsql
as $$
declare
  v_order_status text;
  v_item public.order_items%rowtype;
  v_inventory_before integer;
  v_inventory_after integer;
begin
  select status
  into v_order_status
  from public.orders
  where id = p_order_id
  for update;

  if v_order_status is null then
    raise exception 'Order not found';
  end if;

  if v_order_status = 'cancelled' then
    return;
  end if;

  for v_item in
    select *
    from public.order_items
    where order_id = p_order_id
      and inventory_applied_qty > 0
    order by created_at, id
    for update
  loop
    select quantity_on_hand
    into v_inventory_before
    from public.inventory
    where product_id = v_item.product_id
    for update;

    v_inventory_after := v_inventory_before + v_item.inventory_applied_qty;

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
      v_item.sku_snapshot,
      coalesce(v_item.display_name_snapshot, v_item.product_name_cn_snapshot),
      v_item.inventory_applied_qty,
      v_inventory_before,
      v_inventory_after,
      'OrderReversal',
      p_order_id,
      'Order cancelled and applied inventory restored',
      'system'
    );

    update public.order_items
    set
      inventory_applied_qty = 0,
      before_qty = v_inventory_before,
      after_qty = v_inventory_after
    where id = v_item.id;
  end loop;

  update public.orders
  set
    status = 'cancelled',
    updated_at = now()
  where id = p_order_id;
end;
$$;

notify pgrst, 'reload schema';

-- Audit query: run after the migration. Positive ledger balances indicate
-- historical over-restores that require an inventory correction after a
-- physical count.
select
  l.order_id,
  o.order_no,
  l.product_id,
  l.sku_snapshot,
  sum(l.change_qty) as ledger_balance
from public.inventory_logs l
left join public.orders o on o.id = l.order_id
where l.order_id is not null
group by l.order_id, o.order_no, l.product_id, l.sku_snapshot
having sum(l.change_qty) > 0
order by o.order_no, l.sku_snapshot;
