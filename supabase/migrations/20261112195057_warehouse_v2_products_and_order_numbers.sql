create function public.warehouse_create_product(p_payload jsonb) returns uuid
language plpgsql security invoker set search_path=public,pg_temp as $$
declare v_id uuid; v_sku text; v_prefix text; v_number integer; v_brand text=trim(p_payload->>'brand');
begin
  perform pg_advisory_xact_lock(7241132001);
  if coalesce(v_brand,'')='' or coalesce(trim(p_payload->>'productNameCN'),'')='' then raise exception '品牌和中文品名不能为空'; end if;
  if coalesce((p_payload->>'boxMultiplier')::integer,0)<1 or coalesce((p_payload->>'cartonMultiplier')::integer,0)<1 then raise exception '换算数量必须为正整数'; end if;
  v_sku=nullif(upper(trim(p_payload->>'sku')),'');
  if v_sku is null then
    select sku_prefix into v_prefix from public.product_brands where brand_name=v_brand and is_active;
    if v_prefix is null then raise exception '新品牌请先手动填写 SKU'; end if;
    select coalesce(max(substring(sku from length(v_prefix)+2)::integer),0)+1 into v_number
      from public.products where sku ~ ('^'||v_prefix||'-[0-9]+$');
    v_sku=v_prefix||'-'||lpad(v_number::text,greatest(2,length(v_number::text)),'0');
  end if;
  insert into public.products(sku,brand,product_name_cn,product_name_en,display_name,default_pick_multiplier,carton_pick_multiplier)
    values(v_sku,v_brand,trim(p_payload->>'productNameCN'),nullif(trim(p_payload->>'productNameEN'),''),nullif(trim(p_payload->>'displayName'),''),(p_payload->>'boxMultiplier')::integer,(p_payload->>'cartonMultiplier')::integer) returning id into v_id;
  insert into public.inventory(product_id,quantity_on_hand) values(v_id,0);
  return v_id;
end $$;
revoke all on function public.warehouse_create_product(jsonb) from public,anon,authenticated;
grant execute on function public.warehouse_create_product(jsonb) to service_role;
create or replace function public.next_order_no() returns text
language plpgsql security invoker set search_path=public,pg_temp as $$
declare d date=(now() at time zone 'America/New_York')::date; n integer;
begin
  insert into public.order_counters(order_date,last_number) values(d,1)
  on conflict(order_date) do update set last_number=order_counters.last_number+1 returning last_number into n;
  return to_char(d,'YYYYMMDD')||lpad(n::text,greatest(2,length(n::text)),'0');
end $$;
revoke all on function public.next_order_no() from public,anon,authenticated;
grant execute on function public.next_order_no() to service_role;
