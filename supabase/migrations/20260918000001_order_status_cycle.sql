do $$
declare
  existing_constraint text;
begin
  select constraint_name
    into existing_constraint
    from information_schema.constraint_column_usage
   where table_schema = 'public'
     and table_name = 'orders'
     and column_name = 'status'
   limit 1;

  if existing_constraint is not null then
    execute format('alter table public.orders drop constraint %I', existing_constraint);
  end if;
end $$;

alter table public.orders
  add constraint orders_status_check
  check (status in (
    'en attente',
    'confirmée',
    'façonnage',
    'préparation couleurs',
    'réalisation motifs',
    'finitions',
    'prête/livraison',
    'livrée',
    'annulée'
  ));
