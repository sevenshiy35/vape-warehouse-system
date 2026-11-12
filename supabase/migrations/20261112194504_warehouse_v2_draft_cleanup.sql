-- Draft item editing is independent of inventory deduction.
create function public.warehouse_edit_item(p_action text,p_payload jsonb)
returns uuid language plpgsql security invoker set search_path=public,pg_temp as $$
declare v_order uuid; v_id uuid; v_product uuid; v_qty integer; v_pick integer; v_unit text; o public.orders; p public.products;
begin
  perform pg_advisory_xact_lock(7241132001);
  v_id=(p_payload->>'itemId')::uuid;
  if p_action='add' then v_order=(p_payload->>'orderId')::uuid; v_product=(p_payload->>'productId')::uuid;
  else select order_id,product_id into v_order,v_product from public.order_items where id=v_id; end if;
  select * into o from public.orders where id=v_order for update;
  if not found or o.archived_at is not null or o.batch_id is not null or o.status not in ('uploaded','need_review') then raise exception '只有待审核订单允许修改商品'; end if;
  if p_action='delete' then delete from public.order_items where id=v_id;
  else
    v_qty=(p_payload->>'qty')::integer;
    v_unit=p_payload->>'unit';
    if v_qty is null or v_qty<=0 or v_qty>1000000 or v_unit not in ('支','个','盒','条') then raise exception '数量或单位无效'; end if;
    select * into p from public.products where id=v_product and is_active;
    if not found then raise exception '商品不存在或已停用'; end if;
    v_pick=v_qty*case when v_unit='盒' then greatest(1,p.default_pick_multiplier) when v_unit='条' then greatest(1,p.carton_pick_multiplier) else 1 end;
    if p_action='add' then
      insert into public.order_items(order_id,product_id,sku_snapshot,brand_snapshot,product_name_cn_snapshot,
        product_name_en_snapshot,display_name_snapshot,recognized_qty,recognized_unit,pick_qty,match_status)
      values(v_order,p.id,p.sku,p.brand,p.product_name_cn,p.product_name_en,p.display_name,v_qty,v_unit,v_pick,'matched') returning id into v_id;
    elsif p_action='update' then
      update public.order_items set recognized_qty=v_qty,recognized_unit=v_unit,pick_qty=v_pick,match_status='matched' where id=v_id;
    else raise exception '未知商品操作'; end if;
  end if;
  update public.orders set status='need_review',total_items=(select coalesce(sum(pick_qty),0) from public.order_items where order_id=v_order),updated_at=now() where id=v_order;
  return v_id;
end $$;
revoke all on function public.warehouse_edit_item(text,jsonb) from public,anon,authenticated;
grant execute on function public.warehouse_edit_item(text,jsonb) to service_role;
create or replace function public.warehouse_command(p_action text, p_payload jsonb)
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
  if p_action='import_stock' then
    if jsonb_array_length(p_payload->'rows') is null or jsonb_array_length(p_payload->'rows')=0 then raise exception '没有盘点数据'; end if;
    for r in select value as payload from jsonb_array_elements(p_payload->'rows') loop
      perform public.warehouse_command('stock',r.payload);
    end loop;
  elsif p_action='ready' then
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
