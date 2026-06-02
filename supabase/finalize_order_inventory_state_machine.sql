-- Finalize the order inventory state machine:
-- 1. Repair one confirmed historical Yohuu item without changing current stock.
-- 2. Make saving picking edits and completing picking status-only operations.

begin;

do $$
declare
  v_match_count integer;
  v_applied_qty integer;
  v_correction_count integer;
begin
  select
    count(*),
    max(coalesce(oi.inventory_applied_qty, 0))
  into
    v_match_count,
    v_applied_qty
  from public.order_items oi
  join public.orders o on o.id = oi.order_id
  where o.order_no = '2026060104'
    and oi.sku_snapshot = 'YH-D-02'
    and oi.pick_qty = 3;

  if v_match_count <> 1 then
    raise exception 'Expected exactly one 2026060104 / YH-D-02 item, found %',
      v_match_count;
  end if;

  if v_applied_qty not in (0, 3) then
    raise exception 'Unexpected inventory_applied_qty for 2026060104 / YH-D-02: %',
      v_applied_qty;
  end if;

  update public.order_items oi
  set inventory_applied_qty = 3
  from public.orders o
  where o.id = oi.order_id
    and o.order_no = '2026060104'
    and oi.sku_snapshot = 'YH-D-02'
    and oi.pick_qty = 3;

  update public.inventory_logs l
  set
    order_id = o.id,
    reason = 'Historical picking reservation correction'
  from public.orders o
  where o.order_no = '2026060104'
    and l.order_id is null
    and l.sku_snapshot = 'YH-D-02'
    and l.log_type = 'Correction'
    and l.change_qty = -8
    and l.before_qty = 15
    and l.after_qty = 7;

  select count(*)
  into v_correction_count
  from public.inventory_logs l
  join public.orders o on o.id = l.order_id
  where o.order_no = '2026060104'
    and l.sku_snapshot = 'YH-D-02'
    and l.log_type = 'Correction'
    and l.change_qty = -8
    and l.before_qty = 15
    and l.after_qty = 7;

  if v_correction_count <> 1 then
    raise exception 'Expected exactly one linked YH-D-02 historical correction, found %',
      v_correction_count;
  end if;
end;
$$;

drop function if exists public.save_picking_edit(uuid);

create function public.save_picking_edit(
  p_order_id uuid
)
returns void
language plpgsql
as $$
declare
  v_order_status text;
begin
  select status
  into v_order_status
  from public.orders
  where id = p_order_id
  for update;

  if v_order_status is null then
    raise exception 'Order not found';
  end if;

  if v_order_status <> 'picking_editing' then
    raise exception 'Order status % cannot save picking edits', v_order_status;
  end if;

  update public.orders
  set
    status = 'picking',
    updated_at = now()
  where id = p_order_id;
end;
$$;

drop function if exists public.complete_picking_order(uuid);

create function public.complete_picking_order(
  p_order_id uuid
)
returns void
language plpgsql
as $$
declare
  v_order_status text;
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
end;
$$;

notify pgrst, 'reload schema';

commit;

select
  o.order_no,
  o.status,
  oi.sku_snapshot,
  oi.pick_qty,
  oi.inventory_applied_qty
from public.order_items oi
join public.orders o on o.id = oi.order_id
where o.order_no = '2026060104'
  and oi.sku_snapshot = 'YH-D-02';
