create index batch_lines_product on public.batch_lines(product_id);
create index order_items_order on public.order_items(order_id);
create index order_items_product on public.order_items(product_id);
create index orders_queue on public.orders(business_date,status);
alter table public.orders drop constraint orders_status_check;
alter table public.orders add constraint orders_status_check check(status in ('uploaded','need_review','confirmed','picking','packing','completed','cancelled'));
