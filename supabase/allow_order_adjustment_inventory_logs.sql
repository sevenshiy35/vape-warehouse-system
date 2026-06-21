-- Allow inventory reservations to be adjusted while an order is being picked.
-- The picking edit RPCs already write this log type when an item is added or
-- its quantity changes.

begin;

alter table public.inventory_logs
  drop constraint if exists inventory_logs_log_type_check;

alter table public.inventory_logs
  add constraint inventory_logs_log_type_check
  check (
    log_type in (
      'Order',
      'OrderAdjustment',
      'Inbound',
      'Correction',
      'OrderReversal',
      'LocationMove'
    )
  );

commit;
