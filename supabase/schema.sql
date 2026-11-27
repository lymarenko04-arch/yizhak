-- Їжак: схема бази даних для Supabase (PostgreSQL).
-- Запускається один раз: Supabase → SQL Editor → New query → вставити все → Run.
-- Увесь скрипт іде однією транзакцією: якщо щось не так, база залишиться порожньою.
--
-- Головні правила безпеки:
--  * кожен бачить і змінює лише свої дані (Row Level Security);
--  * бронювання і видача йдуть лише через функції, тож кількість не піде в мінус,
--    а код видачі магазин не бачить, доки покупець його не назве;
--  * документи пільговиків не зберігаються, лише категорія і дата згоди;
--  * роль (покупець / магазин / власник) і позначку «перевірений» користувач сам змінити не може.

begin;

create extension if not exists pgcrypto;

-- ---------- таблиці ----------
create table public.profiles (
  id uuid primary key references auth.users on delete cascade,
  name text not null check (length(name) between 1 and 80),
  phone text check (phone ~ '^\+380[0-9]{9}$'),
  role text not null default 'buyer' check (role in ('buyer','shop','registrar','owner')),
  city text not null default '',
  category text check (category in ('pens','dis','idp','orph','big')),
  client_no bigint generated always as identity (start with 1001) unique,
  consent_at timestamptz,
  created_at timestamptz not null default now(),
  constraint category_needs_consent check (category is null or consent_at is not null)
);

create table public.shops (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null unique references public.profiles on delete cascade,
  shop_no bigint generated always as identity (start with 101) unique,
  name text not null check (length(name) between 1 and 80),
  type text not null, city text not null, address text not null check (length(address) <= 160), phone text not null,
  halal boolean not null default false,
  lat double precision, lng double precision, geo_exact boolean not null default false,
  verified boolean not null default false,
  created_at timestamptz not null default now()
);
create index shops_city_idx on public.shops (city);

create table public.offers (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops on delete cascade,
  title text not null check (length(title) between 1 and 80),
  description text not null default '' check (length(description) <= 600),
  category text not null,
  photo_url text check (photo_url like 'https://dntxkrcnthwtwemqbnui.supabase.co/storage/v1/object/public/offer-photos/%'),
  old_price int not null check (old_price > 0),
  price int not null check (price >= 0),
  free boolean not null default false,
  halal boolean not null default false,
  weight_kg numeric(6,2) not null default 1 check (weight_kg > 0),
  qty_total int not null check (qty_total between 1 and 500),
  qty_left int not null check (qty_left >= 0),
  constraint qty_left_max check (qty_left <= qty_total),
  pickup_from timestamptz not null,
  pickup_to timestamptz not null check (pickup_to > pickup_from),
  status text not null default 'active' check (status in ('active','closed')),
  created_at timestamptz not null default now(),
  constraint price_rule check ((free and price = 0) or (not free and price > 0 and price < old_price))
);
create index offers_live_idx on public.offers (status, pickup_to);
create index offers_shop_idx on public.offers (shop_id);

create table public.reservations (
  id uuid primary key default gen_random_uuid(),
  offer_id uuid not null references public.offers on delete cascade,
  shop_id uuid not null references public.shops on delete cascade,
  buyer_id uuid not null references public.profiles on delete cascade,
  code text not null check (code ~ '^[0-9]{4}$'),
  status text not null default 'reserved' check (status in ('reserved','picked','cancelled','expired')),
  title text not null,
  price int not null, old_price int not null, weight_kg numeric(6,2) not null, free boolean not null,
  expires_at timestamptz not null,
  rating int check (rating between 1 and 5), review text not null default '' check (length(review) <= 500),
  created_at timestamptz not null default now(), picked_at timestamptz
);
create index res_buyer_idx on public.reservations (buyer_id);
create index res_shop_idx on public.reservations (shop_id, status);
create unique index res_one_active_code_per_shop on public.reservations (shop_id, code) where status = 'reserved';

create table public.settings (
  id int primary key default 1 check (id = 1),
  goal_type text not null default 'kg' check (goal_type in ('kg','orders','shops','buyers')),
  goal_value int not null default 10000 check (goal_value > 0),
  rate int not null default 15 check (rate between 0 and 30),
  commission_on boolean not null default false
);
insert into public.settings default values;

-- ---------- допоміжні функції ----------
create function public.is_owner() returns boolean language sql stable security definer set search_path = public as
$$ select exists (select 1 from profiles where id = auth.uid() and role = 'owner') $$;

-- Захист ролі: змінити роль може лише власник сервісу (або SQL Editor).
create function public.guard_profile() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.role is distinct from old.role and auth.uid() is not null and not is_owner() then
    raise exception 'Роль змінити не можна.';
  end if;
  return new;
end $$;
create trigger profiles_guard before update on public.profiles for each row execute function public.guard_profile();

-- Позначку «перевірений» ставить лише власник сервісу.
create function public.guard_shop() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and not is_owner() then
    if tg_op = 'INSERT' then new.verified := false;
    elsif new.verified is distinct from old.verified or new.owner_id is distinct from old.owner_id then
      raise exception 'Це поле змінює лише адміністратор.';
    end if;
  end if;
  return new;
end $$;
create trigger shops_guard before insert or update on public.shops for each row execute function public.guard_shop();

-- ---------- доступ (Row Level Security) ----------
alter table public.profiles enable row level security;
alter table public.shops enable row level security;
alter table public.offers enable row level security;
alter table public.reservations enable row level security;
alter table public.settings enable row level security;

create policy profiles_read   on public.profiles for select to authenticated using (id = auth.uid() or is_owner());
create policy profiles_insert on public.profiles for insert to authenticated with check (id = auth.uid() and role in ('buyer','shop'));
create policy profiles_update on public.profiles for update to authenticated using (id = auth.uid() or is_owner());

create policy shops_read   on public.shops for select using (true);
create policy shops_insert on public.shops for insert to authenticated with check (owner_id = auth.uid());
create policy shops_update on public.shops for update to authenticated using (owner_id = auth.uid() or is_owner());

create policy offers_read   on public.offers for select using (true);
create policy offers_insert on public.offers for insert to authenticated
  with check (qty_left = qty_total and status = 'active' and shop_id in (select id from public.shops where owner_id = auth.uid()));
create policy offers_update on public.offers for update to authenticated
  using (shop_id in (select id from public.shops where owner_id = auth.uid()));

-- Покупець бачить свої броні (з кодом). Магазин бачить броні через view без коду.
-- Нових броней напряму створити не можна, лише функцією reserve_offer.
create policy res_read   on public.reservations for select to authenticated using (buyer_id = auth.uid() or is_owner());
create policy res_review on public.reservations for update to authenticated using (buyer_id = auth.uid() and status = 'picked')
  with check (buyer_id = auth.uid() and status = 'picked');

create policy settings_read   on public.settings for select using (true);
create policy settings_update on public.settings for update to authenticated using (is_owner());

create view public.shop_reservations as
  select r.id, r.offer_id, r.shop_id, r.status, r.title, r.price, r.old_price, r.free, r.weight_kg, r.created_at, r.picked_at, r.expires_at,
         p.name as buyer_name, p.category as buyer_category, p.client_no as buyer_no
  from public.reservations r join public.profiles p on p.id = r.buyer_id
  where r.shop_id in (select id from public.shops where owner_id = auth.uid());

-- ---------- бізнес-функції ----------
create function public.expire_old() returns void language sql security definer set search_path = public as $$
  update reservations set status = 'expired' where status = 'reserved' and expires_at < now();
  update offers set status = 'closed' where status = 'active' and pickup_to < now();
$$;

create function public.reserve_offer(p_offer uuid) returns public.reservations
language plpgsql security definer set search_path = public as $$
declare o offers; me profiles; r reservations; c text; n int;
begin
  perform expire_old();
  select * into me from profiles where id = auth.uid();
  if not found then raise exception 'Увійдіть, щоб продовжити.'; end if;
  select * into o from offers where id = p_offer for update;
  if not found or o.status <> 'active' or o.qty_left < 1 then raise exception 'На жаль, цей набір уже розібрали.'; end if;
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

create function public.cancel_reservation(p_res uuid) returns void
language plpgsql security definer set search_path = public as $$
declare r reservations;
begin
  update reservations set status = 'cancelled' where id = p_res and buyer_id = auth.uid() and status = 'reserved' returning * into r;
  if not found then raise exception 'Цю бронь уже не можна скасувати.'; end if;
  update offers set qty_left = qty_left + 1 where id = r.offer_id and status = 'active';
end $$;

-- Магазин вводить код, який назвав покупець. Повертає бронь без коду.
create function public.find_by_code(p_code text) returns setof public.shop_reservations
language sql security definer set search_path = public as $$
  select v.* from shop_reservations v join reservations r on r.id = v.id
  where r.code = p_code and r.status = 'reserved' and r.expires_at > now()
$$;

create function public.issue_reservation(p_res uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  update reservations set status = 'picked', picked_at = now()
  where id = p_res and status = 'reserved' and shop_id in (select id from shops where owner_id = auth.uid());
  if not found then raise exception 'Цей набір уже видано або бронь неактивна.'; end if;
end $$;

-- Зведення для власника сервісу.
create function public.owner_stats() returns json language plpgsql security definer set search_path = public as $$
declare res json;
begin
  if not is_owner() then raise exception 'Немає доступу.'; end if;
  perform expire_old();
  select json_build_object(
    'kg', coalesce(sum(weight_kg) filter (where status = 'picked'), 0),
    'saved', coalesce(sum(old_price - price) filter (where status = 'picked'), 0),
    'turnover', coalesce(sum(price) filter (where status = 'picked' and not free), 0),
    'orders', count(*) filter (where status = 'picked'),
    'freeOrders', count(*) filter (where status = 'picked' and free),
    'active', count(*) filter (where status = 'reserved'),
    'shops', (select count(*) from shops),
    'buyers', (select count(*) from profiles where role = 'buyer'),
    'vulnerable', (select count(*) from profiles where category is not null),
    'offersLive', (select count(*) from offers where status = 'active'),
    'byCity', (select coalesce(json_object_agg(city, json_build_object('shops', s_n, 'orders', o_n, 'kg', kg)), '{}'::json) from (
        select s.city, count(distinct s.id) as s_n, count(r.id) filter (where r.status = 'picked') as o_n,
               coalesce(sum(r.weight_kg) filter (where r.status = 'picked'), 0) as kg
        from shops s left join reservations r on r.shop_id = s.id group by s.city) t)
  ) into res from reservations;
  return res;
end $$;

-- ---------- права ----------
-- Спершу забираємо автоматичні права, потім даємо лише потрібні.
-- Так покупець, наприклад, у своїй броні може змінити тільки оцінку й відгук, а не ціну чи вагу.
revoke all on all tables in schema public from anon, authenticated;
grant usage on schema public to anon, authenticated;
grant select on public.shops, public.offers, public.settings to anon, authenticated;
grant select, insert, update on public.profiles, public.shops, public.offers to authenticated;
grant select, update (rating, review) on public.reservations to authenticated;
grant update on public.settings to authenticated;
grant select on public.shop_reservations to authenticated;

revoke execute on all functions in schema public from public, anon;
grant execute on function public.reserve_offer(uuid), public.cancel_reservation(uuid), public.find_by_code(text),
  public.issue_reservation(uuid), public.owner_stats(), public.expire_old(), public.is_owner() to authenticated;

-- ---------- фото наборів ----------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('offer-photos', 'offer-photos', true, 2097152, array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;

-- Завантажувати фото може лише власник магазину, і лише у свою папку (shop_id/файл.jpg).
create policy photos_upload on storage.objects for insert to authenticated
  with check (bucket_id = 'offer-photos' and (storage.foldername(name))[1] in (select id::text from public.shops where owner_id = auth.uid()));

commit;

-- Після першого входу в застосунок зробіть себе власником (підставте свій телефон, як ви його ввели):
-- update public.profiles set role = 'owner' where phone = '+380XXXXXXXXX';
