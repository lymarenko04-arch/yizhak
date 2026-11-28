-- Умови для закладів, посилання на Google Maps, терміни придатності, приховування закладу, автоматична позначка «перевірений».
alter table public.shops add column if not exists terms_at timestamptz;
alter table public.shops add column if not exists gmaps_url text;
alter table public.shops add column if not exists hidden boolean not null default false;
alter table public.shops add constraint gmaps_url_ok check (gmaps_url is null or gmaps_url ~* '^https://([a-z]+\.)?(google\.[a-z.]+/maps|maps\.google\.[a-z.]+|maps\.app\.goo\.gl|goo\.gl/maps|share\.google)');

-- Найближчий термін придатності в наборі. Для наборів, створених до цього оновлення, не перевіряється.
alter table public.offers add column if not exists expires_on date;
alter table public.offers add constraint expiry_rule check (
  created_at < '2026-11-28 08:35:00+00'
  or (expires_on is not null and expires_on >= (pickup_to at time zone 'Europe/Kyiv')::date
      + case category when 'dairy' then 2 when 'meat' then 2 when 'mix' then 1 else 0 end));

-- Позначку «перевірений» і «прихований» змінює лише власник або сама база (yizhak.sys).
create or replace function public.guard_shop() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and not is_owner() and coalesce(current_setting('yizhak.sys', true), '') <> '1' then
    if tg_op = 'INSERT' then new.verified := false; new.hidden := false;
    elsif new.verified is distinct from old.verified or new.owner_id is distinct from old.owner_id or new.hidden is distinct from old.hidden then
      raise exception 'Це поле змінює лише адміністратор.';
    end if;
  end if;
  return new;
end $$;

-- «Перевірений»: 100 кг виданої їжі + посилання на заклад у Google Maps.
create or replace function public.refresh_verified(p_shop uuid) returns boolean language plpgsql security definer set search_path = public as $$
declare good boolean;
begin
  select (s.gmaps_url is not null and not s.hidden
          and coalesce((select sum(weight_kg) from reservations r where r.shop_id = s.id and r.status = 'picked'), 0) >= 100)
    into good from shops s where s.id = p_shop;
  if good then
    perform set_config('yizhak.sys', '1', true);
    update shops set verified = true where id = p_shop and not verified;
    perform set_config('yizhak.sys', '', true);
  end if;
  return coalesce(good, false);
end $$;
grant execute on function public.refresh_verified(uuid) to authenticated;

create or replace function public.issue_reservation(p_res uuid) returns void
language plpgsql security definer set search_path = public as $$
declare sid uuid;
begin
  update reservations set status = 'picked', picked_at = now()
  where id = p_res and status = 'reserved' and shop_id in (select id from shops where owner_id = auth.uid())
  returning shop_id into sid;
  if not found then raise exception 'Цей набір уже видано або бронь неактивна.'; end if;
  perform refresh_verified(sid);
end $$;

-- Набори прихованого закладу не видно й не можна забронювати. Новий набір лише після згоди з умовами.
drop policy if exists offers_read on public.offers;
create policy offers_read_anon on public.offers for select to anon using (shop_id in (select id from public.shops where not hidden));
create policy offers_read on public.offers for select to authenticated
  using (shop_id in (select id from public.shops where not hidden) or shop_id in (select id from public.shops where owner_id = auth.uid()) or is_owner());
drop policy if exists offers_insert on public.offers;
create policy offers_insert on public.offers for insert to authenticated
  with check (qty_left = qty_total and status = 'active'
    and shop_id in (select id from public.shops where owner_id = auth.uid() and terms_at is not null and not hidden));

create or replace function public.reserve_offer(p_offer uuid) returns public.reservations
language plpgsql security definer set search_path = public as $$
declare o offers; me profiles; r reservations; c text; n int;
begin
  perform expire_old();
  select * into me from profiles where id = auth.uid();
  if not found then raise exception 'Увійдіть, щоб продовжити.'; end if;
  select * into o from offers where id = p_offer for update;
  if not found or o.status <> 'active' or o.qty_left < 1 then raise exception 'На жаль, цей набір уже розібрали.'; end if;
  if exists (select 1 from shops where id = o.shop_id and hidden) then raise exception 'Цей заклад зараз недоступний.'; end if;
  select count(*) into n from reservations where buyer_id = me.id and status = 'reserved';
  if exists (select 1 from reservations where buyer_id = me.id and offer_id = o.id and status = 'reserved') then
    raise exception 'Ви вже забронювали цей набір. Код у вкладці «Мої».'; end if;
  if n >= 3 then raise exception 'Можна мати до 3 активних броней. Заберіть або скасуйте одну з них.'; end if;
  if o.free then
    if me.category is null then raise exception 'Безкоштовні набори для пільгових категорій. Вкажіть категорію в профілі.'; end if;
    if exists (select 1 from reservations where buyer_id = me.id and free and status = 'reserved') then
      raise exception 'Спочатку заберіть попередній безкоштовний набір.'; end if;
  end if;
  loop
    c := (floor(random() * 9000) + 1000)::int::text;
    exit when not exists (select 1 from reservations where shop_id = o.shop_id and code = c and status = 'reserved');
  end loop;
  update offers set qty_left = qty_left - 1 where id = o.id;
  insert into reservations (offer_id, shop_id, buyer_id, code, title, price, old_price, weight_kg, free, expires_at)
  values (o.id, o.shop_id, me.id, c, o.title, o.price, o.old_price, o.weight_kg, o.free, o.pickup_to) returning * into r;
  return r;
end $$;

select 'ok' as result;

-- Сюрприз-бокс
alter table public.offers add column if not exists surprise boolean not null default false;
alter table public.offers add constraint surprise_cheap check (not surprise or free or price * 2 <= old_price);
