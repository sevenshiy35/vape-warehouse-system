-- Keep the final unit's location visible while an order is still being picked.
-- Order reservation RPCs opt out of the eager zero-stock cleanup. The location
-- is cleared only when picking is completed and the stock is still zero.

begin;

create or replace function public.clear_zero_inventory_shelf_location()
returns trigger
language plpgsql
as $$
begin
  if coalesce(new.quantity_on_hand, 0) = 0
    and coalesce(
      current_setting('app.defer_zero_inventory_location', true),
      'off'
    ) <> 'on' then
    new.shelf_location := null;
  end if;

  return new;
end;
$$;

create or replace function public.add_order_item_deferred_location(
  p_order_id uuid,
  p_product_id uuid,
  p_qty integer,
  p_unit text
)
returns uuid
language plpgsql
as $$
begin
  perform set_config('app.defer_zero_inventory_location', 'on', true);

  return public.add_order_item_safe(
    p_order_id,
    p_product_id,
    p_qty,
    p_unit
  );
end;
$$;

create or replace function public.update_order_item_deferred_location(
  p_item_id uuid,
  p_qty integer,
  p_unit text
)
returns void
language plpgsql
as $$
begin
  perform set_config('app.defer_zero_inventory_location', 'on', true);
  perform public.update_order_item_safe(p_item_id, p_qty, p_unit);
end;
$$;

create or replace function public.confirm_order_and_defer_location(
  p_order_id uuid
)
returns void
language plpgsql
as $$
begin
  perform set_config('app.defer_zero_inventory_location', 'on', true);
  perform public.confirm_order_and_deduct(p_order_id);
end;
$$;

create or replace function public.delete_order_item_and_restore_location(
  p_item_id uuid
)
returns void
language plpgsql
as $$
declare
  v_item public.order_items%rowtype;
  v_location_restored boolean := false;
begin
  select *
  into v_item
  from public.order_items
  where id = p_item_id;

  if v_item.id is null then
    raise exception 'Order item not found';
  end if;

  perform public.delete_order_item_safe(p_item_id);

  if nullif(trim(v_item.shelf_location_snapshot), '') is not null then
    update public.inventory
    set
      shelf_location = v_item.shelf_location_snapshot,
      updated_at = now()
    where product_id = v_item.product_id
      and quantity_on_hand > 0
      and nullif(trim(shelf_location), '') is null;

    v_location_restored := found;
  end if;

  if v_location_restored then
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
      operator,
      old_shelf_location,
      new_shelf_location
    )
    select
      v_item.product_id,
      v_item.sku_snapshot,
      coalesce(v_item.display_name_snapshot, v_item.product_name_cn_snapshot),
      0,
      i.quantity_on_hand,
      i.quantity_on_hand,
      'LocationMove',
      v_item.order_id,
      'Restore location after picking item reversal',
      'system',
      null,
      v_item.shelf_location_snapshot
    from public.inventory i
    where i.product_id = v_item.product_id;
  end if;
end;
$$;

create or replace function public.cancel_order_and_restore_location(
  p_order_id uuid
)
returns void
language plpgsql
as $$
declare
  v_item record;
  v_location_restored boolean;
begin
  perform public.cancel_order_and_restore(p_order_id);

  for v_item in
    select distinct on (oi.product_id)
      oi.product_id,
      oi.sku_snapshot,
      coalesce(oi.display_name_snapshot, oi.product_name_cn_snapshot)
        as product_name,
      oi.shelf_location_snapshot
    from public.order_items oi
    where oi.order_id = p_order_id
      and nullif(trim(oi.shelf_location_snapshot), '') is not null
    order by oi.product_id, oi.created_at desc, oi.id desc
  loop
    update public.inventory
    set
      shelf_location = v_item.shelf_location_snapshot,
      updated_at = now()
    where product_id = v_item.product_id
      and quantity_on_hand > 0
      and nullif(trim(shelf_location), '') is null;

    v_location_restored := found;

    if v_location_restored then
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
        operator,
        old_shelf_location,
        new_shelf_location
      )
      select
        v_item.product_id,
        v_item.sku_snapshot,
        v_item.product_name,
        0,
        i.quantity_on_hand,
        i.quantity_on_hand,
        'LocationMove',
        p_order_id,
        'Restore location after order cancellation',
        'system',
        null,
        v_item.shelf_location_snapshot
      from public.inventory i
      where i.product_id = v_item.product_id;
    end if;
  end loop;
end;
$$;

create or replace function public.complete_picking_order(
  p_order_id uuid
)
returns void
language plpgsql
as $$
declare
  v_order_status text;
  v_item record;
begin
  select status
  into v_order_status
  from public.orders
  where id = p_order_id
  for update;

  if v_order_status is null then
    raise exception 'Order not found';
  end if;

  if v_order_status <> 'picking' then
    raise exception 'Order status % cannot complete picking', v_order_status;
  end if;

  update public.orders
  set
    status = 'completed',
    updated_at = now()
  where id = p_order_id;

  for v_item in
    select
      i.product_id,
      i.quantity_on_hand,
      i.shelf_location,
      p.sku,
      coalesce(p.display_name, p.product_name_cn) as product_name
    from public.inventory i
    join public.products p on p.id = i.product_id
    where i.quantity_on_hand = 0
      and nullif(trim(i.shelf_location), '') is not null
      and exists (
        select 1
        from public.order_items oi
        where oi.order_id = p_order_id
          and oi.product_id = i.product_id
      )
    for update of i
  loop
    update public.inventory
    set
      shelf_location = null,
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
      operator,
      old_shelf_location,
      new_shelf_location
    )
    values (
      v_item.product_id,
      v_item.sku,
      v_item.product_name,
      0,
      v_item.quantity_on_hand,
      v_item.quantity_on_hand,
      'LocationMove',
      p_order_id,
      'Clear zero-stock location after picking completed',
      'system',
      v_item.shelf_location,
      null
    );
  end loop;
end;
$$;

notify pgrst, 'reload schema';

commit;
