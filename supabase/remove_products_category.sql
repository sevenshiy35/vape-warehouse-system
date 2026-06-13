-- Remove the unused products.category column.
-- Run this in Supabase SQL Editor after deploying the matching frontend code.

drop function if exists public.create_product_with_inventory(
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  integer,
  text,
  integer,
  integer,
  integer,
  text
);

drop function if exists public.create_product_with_inventory(
  text,
  text,
  text,
  text,
  text,
  text,
  integer,
  text,
  integer,
  text
);

drop function if exists public.create_product_with_inventory(
  text,
  text,
  text,
  text,
  text,
  text,
  integer,
  text,
  integer,
  integer,
  integer,
  text
);

drop function if exists public.create_product_with_inventory(
  text,
  text,
  text,
  text,
  text,
  integer,
  text,
  integer,
  integer,
  integer,
  text
);

create function public.create_product_with_inventory(
  p_sku text,
  p_brand text,
  p_product_name_cn text,
  p_display_name text default null,
  p_product_name_en text default null,
  p_initial_qty integer default 0,
  p_shelf_location text default null,
  p_loose_quantity integer default null,
  p_box_quantity integer default null,
  p_low_stock_threshold integer default 3,
  p_operator text default 'admin'
)
returns uuid
language plpgsql
as $$
declare
  v_product_id uuid;
  v_sku text;
  v_input_sku text;
  v_brand text;
  v_product_name_cn text;
  v_shelf text;
  v_prefix text;
  v_next_number integer;
  v_width integer;
begin
  v_input_sku := nullif(upper(trim(coalesce(p_sku, ''))), '');
  v_brand := trim(p_brand);
  v_product_name_cn := trim(p_product_name_cn);

  if v_brand is null or v_brand = '' then
    raise exception 'Brand is required';
  end if;

  if v_product_name_cn is null or v_product_name_cn = '' then
    raise exception 'Chinese product name is required';
  end if;

  if p_initial_qty is null or p_initial_qty < 0 then
    raise exception 'Initial quantity must be 0 or greater';
  end if;

  if v_input_sku is null then
    select nullif(trim(sku_prefix), '')
    into v_prefix
    from public.product_brands
    where brand_name = v_brand
      and coalesce(is_active, true) = true
    limit 1;

    if v_prefix is not null then
      v_prefix := upper(v_prefix);

      select
        coalesce(max((m)[1]::integer), 0) + 1,
        coalesce(max(length((m)[1])), 2)
      into v_next_number, v_width
      from (
        select regexp_match(upper(sku), '^' || v_prefix || '-([0-9]+)$') as m
        from public.products
        where brand = v_brand
      ) x
      where m is not null;
    else
      with parsed as (
        select
          (m)[1] as prefix,
          ((m)[2])::integer as num,
          length((m)[2]) as width
        from (
          select regexp_match(upper(sku), '^([A-Z]+(?:-[A-Z]+)*)-([0-9]+)$') as m
          from public.products
          where brand = v_brand
        ) x
        where m is not null
      )
      select prefix, num + 1, width
      into v_prefix, v_next_number, v_width
      from parsed
      order by num desc
      limit 1;
    end if;

    if v_prefix is null then
      raise exception 'No SKU prefix found for brand %. Please add product_brands.sku_prefix or enter SKU manually.', v_brand;
    end if;

    v_sku := v_prefix || '-' || lpad(
      coalesce(v_next_number, 1)::text,
      greatest(coalesce(v_width, 2), length(coalesce(v_next_number, 1)::text)),
      '0'
    );
  else
    v_sku := v_input_sku;
  end if;

  if exists (
    select 1 from public.products where sku = v_sku
  ) then
    raise exception 'SKU already exists: %', v_sku;
  end if;

  if p_initial_qty > 0 then
    v_shelf := nullif(trim(p_shelf_location), '');

    if v_shelf is null then
      raise exception 'Shelf location is required when initial quantity is greater than 0';
    end if;
  else
    v_shelf := null;
  end if;

  insert into public.products (
    sku,
    brand,
    product_name_cn,
    display_name,
    product_name_en,
    is_active,
    default_pick_multiplier,
    updated_at
  )
  values (
    v_sku,
    v_brand,
    v_product_name_cn,
    nullif(trim(p_display_name), ''),
    nullif(trim(p_product_name_en), ''),
    true,
    1,
    now()
  )
  returning id into v_product_id;

  insert into public.inventory (
    product_id,
    shelf_location,
    quantity_on_hand,
    low_stock_threshold,
    updated_at
  )
  values (
    v_product_id,
    v_shelf,
    p_initial_qty,
    coalesce(p_low_stock_threshold, 3),
    now()
  );

  if p_initial_qty > 0 then
    insert into public.inventory_logs (
      product_id,
      sku_snapshot,
      product_name_snapshot,
      change_qty,
      before_qty,
      after_qty,
      log_type,
      reason,
      operator
    )
    values (
      v_product_id,
      v_sku,
      v_product_name_cn,
      p_initial_qty,
      0,
      p_initial_qty,
      'Inbound',
      'New product initial inventory',
      coalesce(nullif(trim(p_operator), ''), 'admin')
    );
  end if;

  return v_product_id;
end;
$$;

alter table public.products
drop column if exists category;

notify pgrst, 'reload schema';
