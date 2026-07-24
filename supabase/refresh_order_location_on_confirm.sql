-- Refresh the picking location snapshot when an order is successfully
-- confirmed. An order item can be created while inventory is zero, in which
-- case the zero-inventory trigger clears the location. If stock is received
-- before confirmation is retried, the order must use the new location.

begin;

create or replace function public.confirm_order_and_deduct(
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
  v_shelf_location text;
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
    select
      quantity_on_hand,
      nullif(trim(shelf_location), '')
    into
      v_inventory_before,
      v_shelf_location
    from public.inventory
    where product_id = v_item.product_id
    for update;

    if not found then
      raise exception 'Inventory record not found for SKU %', v_item.sku_snapshot;
    end if;

    if coalesce(v_item.pick_qty, 0) > 0
      and v_shelf_location is null then
      raise exception 'Missing shelf location for SKU %', v_item.sku_snapshot;
    end if;

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
      shelf_location_snapshot = v_shelf_location,
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

-- Repair only the two confirmed items whose inbound location changes were
-- recorded immediately before confirmation. This changes snapshots only;
-- inventory quantities and inventory logs are intentionally untouched.
update public.order_items
set shelf_location_snapshot = 'Z3-03'
where id = '00c9cbec-f4ee-4ccd-b3ca-fa3bad8201c8'
  and order_id = '75fdac56-3b25-45ce-8511-95bffabe33cb'
  and sku_snapshot = 'YH-D-05'
  and shelf_location_snapshot is null
  and inventory_applied_qty = 3;

update public.order_items
set shelf_location_snapshot = 'GG1'
where id = '2117c042-2c28-4105-b9a6-a2bf926c00b5'
  and order_id = '4d313178-e27d-4d17-aaa0-f3fde05450c0'
  and sku_snapshot = 'TB-01'
  and shelf_location_snapshot is null
  and inventory_applied_qty = 1;

commit;

notify pgrst, 'reload schema';
