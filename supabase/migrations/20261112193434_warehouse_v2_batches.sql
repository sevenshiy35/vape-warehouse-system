-- Warehouse v2: isolated bins, batch reservation, pooled picking, per-order packing.
-- Does not reset legacy inventory. Run the separately reviewed cutover after verification.
create table public.warehouse_settings (
  id boolean primary key default true check(id),
  activated_at timestamptz
);
insert into public.warehouse_settings(id) values(true);

create table public.inventory_bins (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id),
  location text not null check(length(trim(location)) > 0),
  kind text not null check(kind in ('loose','box')),
  units_per_pack integer not null default 1 check(units_per_pack > 0),
  quantity integer not null default 0 check(quantity >= 0),
  reserved integer not null default 0 check(reserved >= 0 and reserved <= quantity),
  updated_at timestamptz not null default now(),
  unique(product_id, location, kind),
  check(kind = 'loose' or quantity % units_per_pack = 0)
);
create table public.pick_batches (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  business_date date not null default (now() at time zone 'America/New_York')::date,
  status text not null default 'picking' check(status in ('picking','packing','completed','closed')),
  request_id uuid not null unique,
  created_at timestamptz not null default now()
);
alter table public.orders add column archived_at timestamptz;
alter table public.orders add column batch_id uuid references public.pick_batches(id);
alter table public.orders add column business_date date not null default (now() at time zone 'America/New_York')::date;
alter table public.orders add column screenshot_hash text;
create unique index orders_screenshot_hash_active on public.orders(screenshot_hash) where screenshot_hash is not null and archived_at is null;
alter table public.orders drop constraint orders_status_check;
alter table public.orders add constraint orders_status_check check(status in ('uploaded','recognized','need_review','confirmed','picking','picking_editing','packing','completed','cancelled'));
alter table public.order_items add column packed_qty integer not null default 0 check(packed_qty >= 0 and packed_qty <= pick_qty);
create table public.batch_orders (
  batch_id uuid not null references public.pick_batches(id),
  order_id uuid not null references public.orders(id),
  primary key(batch_id,order_id)
);
create table public.batch_lines (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.pick_batches(id),
  bin_id uuid not null references public.inventory_bins(id),
  product_id uuid not null references public.products(id),
  location text not null,
  kind text not null,
  units_per_pack integer not null,
  requested integer not null check(requested > 0),
  picked integer not null default 0 check(picked >= 0 and picked <= requested),
  confirmed boolean not null default false,
  returned integer not null default 0 check(returned >= 0 and returned <= picked),
  unique(batch_id,bin_id)
);
create table public.warehouse_events (
  id uuid primary key default gen_random_uuid(),
  action text not null,
  product_id uuid references public.products(id),
  bin_id uuid references public.inventory_bins(id),
  batch_id uuid references public.pick_batches(id),
  quantity integer not null default 0,
  note text,
  created_at timestamptz not null default now()
);
create index inventory_bins_product on public.inventory_bins(product_id);
create index batch_lines_batch_product on public.batch_lines(batch_id, product_id);
create index batch_lines_bin on public.batch_lines(bin_id);
create index batch_orders_order on public.batch_orders(order_id);
create index warehouse_events_created on public.warehouse_events(created_at desc);
create index orders_current_queue on public.orders(business_date, status) where archived_at is null;
create index orders_batch on public.orders(batch_id) where batch_id is not null;
create index warehouse_events_bin on public.warehouse_events(bin_id);
create index warehouse_events_batch on public.warehouse_events(batch_id);
create index warehouse_events_product on public.warehouse_events(product_id);
do $$
declare t text;
begin
  foreach t in array array['warehouse_settings','inventory_bins','pick_batches','batch_orders','batch_lines','warehouse_events'] loop
    execute format('alter table public.%I enable row level security',t);
    execute format('revoke all on public.%I from anon, authenticated',t);
    execute format('grant all on public.%I to service_role',t);
  end loop;
end $$;

create function public.warehouse_sync_inventory() returns trigger
language plpgsql security invoker set search_path = public, pg_temp as $$
declare p uuid := coalesce(new.product_id,old.product_id);
begin
  insert into public.inventory(product_id,quantity_on_hand,shelf_location)
  select p, coalesce(sum(quantity-reserved),0),string_agg(distinct location, ' / ' order by location)
  from public.inventory_bins where product_id=p and quantity>0
  on conflict(product_id) do update set quantity_on_hand=excluded.quantity_on_hand,
    shelf_location=excluded.shelf_location,updated_at=now();
  return coalesce(new,old);
end $$;
create trigger warehouse_sync_inventory after insert or update or delete on public.inventory_bins
for each row execute function public.warehouse_sync_inventory();

-- Legacy item functions can only edit the new draft queue. Batch snapshots are immutable.
create function public.warehouse_guard_item() returns trigger
language plpgsql security invoker set search_path = public, pg_temp as $$
declare o public.orders;
begin
  if current_setting('warehouse.internal',true)='on' then return coalesce(new,old); end if;
  select * into o from public.orders where id=coalesce(new.order_id,old.order_id) for update;
  if o.archived_at is not null or o.batch_id is not null or o.status not in ('uploaded','need_review') then
    raise exception '订单已锁定；仅待审核订单允许修改商品';
  end if;
  return coalesce(new,old);
end $$;
create trigger warehouse_guard_item before insert or update or delete on public.order_items
for each row execute function public.warehouse_guard_item();

create function public.warehouse_guard_order() returns trigger
language plpgsql security invoker set search_path = public, pg_temp as $$
begin
  if current_setting('warehouse.internal',true)='on' then return coalesce(new,old); end if;
  if old.archived_at is not null or old.batch_id is not null then
    raise exception '历史订单或批次订单已锁定';
  end if;
  return coalesce(new,old);
end $$;
create trigger warehouse_guard_order before update or delete on public.orders
for each row execute function public.warehouse_guard_order();

-- A single, short transaction lock serializes warehouse commands and prevents
-- cross-bin reservations, packing, and returns from racing each other.
create function public.warehouse_command(p_action text, p_payload jsonb)
returns jsonb language plpgsql security invoker set search_path = public, pg_temp as $$
declare
  v_id uuid; v_order uuid; v_product uuid; v_batch uuid; v_bin uuid;
  v_qty integer; v_size integer; v_remaining integer; v_take integer;
  v_available integer; v_packed integer; v_return integer;
  v_location text; v_kind text; v_note text;
  r record; b record; o public.orders; line public.batch_lines; batch public.pick_batches;
begin
  perform pg_advisory_xact_lock(7241132001);
  perform set_config('warehouse.internal','on',true);
  if p_action='ready' then
    v_order=(p_payload->>'orderId')::uuid;
    select * into o from public.orders where id=v_order for update;
    if not found or o.archived_at is not null or o.batch_id is not null then raise exception '订单不存在或已锁定'; end if;
    if o.status='confirmed' then return jsonb_build_object('ok',true); end if;
    if o.status not in ('uploaded','need_review') or o.ai_status='processing' then raise exception '请等待识别完成并核对商品'; end if;
    if not exists(select 1 from public.order_items where order_id=v_order) then raise exception '订单没有商品'; end if;
    if exists(select 1 from public.order_items where order_id=v_order and (product_id is null or pick_qty<=0 or match_status not in ('matched','out_of_stock'))) then
      raise exception '请先处理未匹配商品或错误数量';
    end if;
    update public.orders set status='confirmed',total_items=(select sum(pick_qty) from public.order_items where order_id=v_order),updated_at=now() where id=v_order;
  elsif p_action='review' then
    update public.orders set status='need_review',updated_at=now() where id=(p_payload->>'orderId')::uuid
      and status='confirmed' and batch_id is null and archived_at is null;
    if not found then raise exception '只有未加入批次的待拣货订单可以退回审核'; end if;
  elsif p_action='cancel_order' then
    select * into o from public.orders where id=(p_payload->>'orderId')::uuid for update;
    if not found or o.archived_at is not null or o.batch_id is not null or o.status='completed' then
      raise exception '历史订单和批次订单不能直接取消；请在批次内退回余货结束作业';
    end if;
    update public.orders set status='cancelled',updated_at=now() where id=o.id;
  elsif p_action='stock' then
    v_product=(p_payload->>'productId')::uuid;
    v_location=upper(trim(p_payload->>'location'));
    v_kind=p_payload->>'kind';
    v_size=(p_payload->>'unitsPerPack')::integer;
    v_qty=(p_payload->>'quantity')::integer;
    v_note=nullif(trim(p_payload->>'note'),'');
    if v_location is null or length(v_location)=0 or v_kind not in ('loose','box') or v_size is null or v_size<1 or v_qty is null or v_qty<0 then raise exception '请检查库位、包装规格和数量'; end if;
    if v_kind='loose' then v_size=1; end if;
    if v_kind='box' and v_qty%v_size<>0 then raise exception '整盒位数量必须是每盒数量的整数倍'; end if;
    select * into b from public.inventory_bins where product_id=v_product and location=v_location and kind=v_kind for update;
    if found then
      if b.reserved>0 or exists(select 1 from public.batch_lines l join public.pick_batches pb on pb.id=l.batch_id where l.bin_id=b.id and pb.status in ('picking','packing')) then
        raise exception '此库位有进行中的拣货批次，请先完成或结束批次';
      end if;
      v_bin=b.id;
      if p_payload->>'mode'='add' then
        if b.units_per_pack<>v_size then raise exception '补货包装规格必须与原库位一致'; end if;
        v_qty=b.quantity+v_qty;
      end if;
      update public.inventory_bins set quantity=v_qty,units_per_pack=v_size,updated_at=now() where id=v_bin;
      v_available=b.quantity;
    else
      insert into public.inventory_bins(product_id,location,kind,units_per_pack,quantity)
      values(v_product,v_location,v_kind,v_size,v_qty) returning id into v_bin;
      v_available=0;
    end if;
    insert into public.warehouse_events(action,product_id,bin_id,quantity,note)
    values(case when p_payload->>'mode'='add' then 'inbound' else 'count' end,v_product,v_bin,v_qty-v_available,coalesce(v_note,'盘点上架'));
  elsif p_action='create_batch' then
    select id into v_batch from public.pick_batches where request_id=(p_payload->>'requestId')::uuid;
    if found then return jsonb_build_object('id',v_batch); end if;
    if jsonb_array_length(p_payload->'orderIds') is null or jsonb_array_length(p_payload->'orderIds')=0 then raise exception '请选择待拣货订单'; end if;
    if jsonb_array_length(p_payload->'orderIds')<>(select count(distinct value) from jsonb_array_elements_text(p_payload->'orderIds')) then raise exception '订单重复'; end if;
    for r in select value::uuid id from jsonb_array_elements_text(p_payload->'orderIds') order by value loop
      select * into o from public.orders where id=r.id for update;
      if not found or o.status<>'confirmed' or o.archived_at is not null or o.batch_id is not null then raise exception '订单状态已变化，请刷新后重试'; end if;
      if not exists(select 1 from public.order_items where order_id=o.id) then raise exception '订单没有商品'; end if;
    end loop;
    insert into public.pick_batches(name,business_date,request_id)
    values(coalesce(nullif(trim(p_payload->>'name'),''),'集中拣货'),(p_payload->>'date')::date,(p_payload->>'requestId')::uuid) returning id into v_batch;
    for r in select value::uuid id from jsonb_array_elements_text(p_payload->'orderIds') loop
      insert into public.batch_orders values(v_batch,r.id);
      update public.orders set status='picking',batch_id=v_batch,updated_at=now() where id=r.id;
    end loop;
    for r in select oi.product_id,sum(oi.pick_qty)::integer qty from public.order_items oi join public.batch_orders bo on bo.order_id=oi.order_id
      where bo.batch_id=v_batch group by oi.product_id order by oi.product_id loop
      if r.product_id is null then raise exception '存在未匹配商品'; end if;
      v_remaining=r.qty;
      -- Full boxes first, then loose stock. Never silently break a sealed box.
      for b in select * from public.inventory_bins where product_id=r.product_id and quantity>reserved
        order by case when kind='box' then 0 else 1 end,location,id for update loop
        v_take=least(v_remaining,b.quantity-b.reserved);
        if b.kind='box' then v_take=(v_take/b.units_per_pack)*b.units_per_pack; end if;
        if v_take>0 then
          insert into public.batch_lines(batch_id,bin_id,product_id,location,kind,units_per_pack,requested)
          values(v_batch,b.id,r.product_id,b.location,b.kind,b.units_per_pack,v_take);
          update public.inventory_bins set reserved=reserved+v_take,updated_at=now() where id=b.id;
          v_remaining=v_remaining-v_take;
        end if;
        exit when v_remaining=0;
      end loop;
      if v_remaining>0 then
        raise exception '商品 % 可用库存不足或需要拆盒补充散货，还差 % 个。请先补货/拆盒，或将缺货订单留到下一批',
          (select sku from public.products where id=r.product_id),v_remaining;
      end if;
    end loop;
    return jsonb_build_object('id',v_batch);
  elsif p_action='pick' then
    select * into line from public.batch_lines where id=(p_payload->>'lineId')::uuid for update;
    if not found then raise exception '拣货行不存在'; end if;
    select * into batch from public.pick_batches where id=line.batch_id for update;
    if batch.status<>'picking' then raise exception '批次已经结束拣货'; end if;
    v_qty=(p_payload->>'quantity')::integer;
    if line.confirmed then
      if line.picked=v_qty then return jsonb_build_object('ok',true); end if;
      raise exception '此行已确认，请刷新；需要重做时请退回并结束批次';
    end if;
    if v_qty is null or v_qty<0 or v_qty>line.requested or (line.kind='box' and v_qty%line.units_per_pack<>0) then raise exception '实拣数量错误，整盒位须按完整盒数拣货'; end if;
    update public.inventory_bins set quantity=quantity-v_qty,reserved=reserved-line.requested,updated_at=now() where id=line.bin_id;
    update public.batch_lines set picked=v_qty,confirmed=true where id=line.id;
    insert into public.warehouse_events(action,product_id,bin_id,batch_id,quantity,note)
      values('pick',line.product_id,line.bin_id,line.batch_id,-v_qty,case when v_qty<line.requested then '缺货：应拣 '||line.requested||'，实拣 '||v_qty else '集中拣货' end);
  elsif p_action='start_packing' then
    v_batch=(p_payload->>'batchId')::uuid;
    select * into batch from public.pick_batches where id=v_batch for update;
    if not found then raise exception '批次不存在'; end if;
    if batch.status='packing' then return jsonb_build_object('ok',true); end if;
    if batch.status<>'picking' or exists(select 1 from public.batch_lines where batch_id=v_batch and not confirmed) then raise exception '请先逐项确认全部实拣数量'; end if;
    update public.pick_batches set status='packing' where id=v_batch;
    update public.orders set status='packing',updated_at=now() where batch_id=v_batch and status='picking';
  elsif p_action='pack' then
    select * into o from public.orders where id=(p_payload->>'orderId')::uuid for update;
    if not found or o.archived_at is not null or o.batch_id is null then raise exception '订单不在批次中'; end if;
    if o.status='completed' then return jsonb_build_object('ok',true); end if;
    select * into batch from public.pick_batches where id=o.batch_id for update;
    if batch.status<>'packing' or o.status<>'packing' then raise exception '批次未进入分货打包'; end if;
    if (select count(*) from public.order_items where order_id=o.id)<>(select count(distinct value) from jsonb_array_elements_text(p_payload->'checkedItemIds')) or
       exists(select 1 from public.order_items where order_id=o.id and not (p_payload->'checkedItemIds' ? id::text)) then raise exception '请逐项核对订单商品'; end if;
    for r in select product_id,sum(pick_qty-packed_qty)::integer qty from public.order_items where order_id=o.id group by product_id loop
      select coalesce(sum(picked-returned),0) into v_available from public.batch_lines where batch_id=o.batch_id and product_id=r.product_id;
      select coalesce(sum(oi.packed_qty),0) into v_packed from public.order_items oi join public.batch_orders bo on bo.order_id=oi.order_id where bo.batch_id=o.batch_id and oi.product_id=r.product_id;
      if v_available-v_packed<r.qty then raise exception '商品 % 待分货不足，还差 % 个；可以先处理其他完整订单',
        (select sku from public.products where id=r.product_id),r.qty-(v_available-v_packed); end if;
    end loop;
    update public.order_items set packed_qty=pick_qty where order_id=o.id;
    update public.orders set status='completed',updated_at=now() where id=o.id;
    insert into public.warehouse_events(action,batch_id,quantity,note) values('pack',o.batch_id,0,'完成订单 '||o.order_no);
    if not exists(select 1 from public.orders where batch_id=o.batch_id and status<>'completed') then
      update public.pick_batches set status='completed' where id=o.batch_id;
    end if;
  elsif p_action='close_batch' then
    v_batch=(p_payload->>'batchId')::uuid;
    select * into batch from public.pick_batches where id=v_batch for update;
    if not found then raise exception '批次不存在'; end if;
    if batch.status in ('closed','completed') then return jsonb_build_object('ok',true); end if;
    for r in select distinct product_id from public.batch_lines where batch_id=v_batch order by product_id loop
      select coalesce(sum(packed_qty),0) into v_packed from public.order_items where product_id=r.product_id and order_id in (select order_id from public.batch_orders where batch_id=v_batch);
      -- Allocate completed orders to original pick lines, return every unconsumed unit.
      for line in select * from public.batch_lines where batch_id=v_batch and product_id=r.product_id order by id for update loop
        if not line.confirmed then
          update public.inventory_bins set reserved=reserved-line.requested,updated_at=now() where id=line.bin_id;
        end if;
        v_take=least(v_packed,line.picked);
        v_packed=v_packed-v_take;
        v_return=line.picked-v_take;
        if v_return>0 then
          -- A partly consumed box returns to the same location as loose stock.
          select * into b from public.inventory_bins where id=line.bin_id;
          if b.kind='box' and v_return%b.units_per_pack<>0 then
            insert into public.inventory_bins(product_id,location,kind,units_per_pack,quantity)
              values(b.product_id,b.location,'loose',1,v_return)
              on conflict(product_id,location,kind) do update set quantity=inventory_bins.quantity+excluded.quantity
              returning id into v_bin;
          else
            update public.inventory_bins set quantity=quantity+v_return,updated_at=now() where id=line.bin_id;
            v_bin=line.bin_id;
          end if;
          update public.batch_lines set returned=v_return where id=line.id;
          insert into public.warehouse_events(action,product_id,bin_id,batch_id,quantity,note)
            values('return',line.product_id,v_bin,v_batch,v_return,'结束批次，未使用商品退回原库位');
        end if;
      end loop;
    end loop;
    update public.orders set status='confirmed',batch_id=null,updated_at=now() where batch_id=v_batch and status<>'completed';
    update public.pick_batches set status='closed' where id=v_batch;
  elsif p_action='split_box' then
    select * into b from public.inventory_bins where id=(p_payload->>'binId')::uuid for update;
    v_qty=(p_payload->>'packs')::integer;
    v_location=upper(trim(p_payload->>'location'));
    if not found or b.kind<>'box' or v_qty is null or v_qty<=0 or v_location is null or length(v_location)=0 then raise exception '请检查整盒库位、盒数和目标散货位'; end if;
    if b.quantity-b.reserved<v_qty*b.units_per_pack then raise exception '可拆整盒不足，已占用的盒不能拆'; end if;
    update public.inventory_bins set quantity=quantity-v_qty*b.units_per_pack,updated_at=now() where id=b.id;
    insert into public.inventory_bins(product_id,location,kind,units_per_pack,quantity)
      values(b.product_id,v_location,'loose',1,v_qty*b.units_per_pack)
      on conflict(product_id,location,kind) do update set quantity=inventory_bins.quantity+excluded.quantity,updated_at=now()
      returning id into v_bin;
    insert into public.warehouse_events(action,product_id,bin_id,quantity,note) values
      ('split',b.product_id,b.id,-v_qty*b.units_per_pack,'拆盒转至 '||v_location),
      ('split',b.product_id,v_bin,v_qty*b.units_per_pack,'从 '||b.location||' 拆盒转入');
  else raise exception '未知操作';
  end if;
  return jsonb_build_object('ok',true);
end $$;
revoke all on function public.warehouse_command(text,jsonb) from public,anon,authenticated;
grant execute on function public.warehouse_command(text,jsonb) to service_role;
revoke all on function public.warehouse_sync_inventory(),public.warehouse_guard_item(),public.warehouse_guard_order() from public,anon,authenticated;
grant execute on function public.warehouse_sync_inventory(),public.warehouse_guard_item(),public.warehouse_guard_order() to service_role;
notify pgrst,'reload schema';
