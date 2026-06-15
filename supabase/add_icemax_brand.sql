-- Add IceMax as an active product brand/category option.
-- Run this in Supabase SQL Editor so it appears in the new-product form.

do $$
begin
  if exists (
    select 1
    from public.product_brands
    where brand_name in ('IceMax', 'Icemax')
  ) then
    update public.product_brands
    set
      brand_name = 'IceMax',
      sku_prefix = 'IM',
      is_active = true
    where brand_name in ('IceMax', 'Icemax');
  else
    insert into public.product_brands (
      brand_name,
      sku_prefix,
      is_active
    )
    values (
      'IceMax',
      'IM',
      true
    );
  end if;
end;
$$;

notify pgrst, 'reload schema';
