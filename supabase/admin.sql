-- Корисні команди для власника. Запускати в Supabase → SQL Editor, по одній.

-- 1. Видалити тестові дані (акаунти, магазини, набори й броні з іменами, що починаються на «Тест»).
--    Фото тестових наборів можна прибрати вручну: Storage → offer-photos.
delete from auth.users where id in (select id from public.profiles where name like 'Тест %');

-- 2. Зробити себе власником сервісу. Спершу увійдіть у застосунок зі свого телефона як покупець,
--    потім підставте номер так, як ви його ввели (лише цифри і +):
-- update public.profiles set role = 'owner' where phone = '+380XXXXXXXXX';

-- 3. Позначити магазин перевіреним (з'явиться позначка довіри):
-- update public.shops set verified = true where name = 'Назва магазину';

-- 4. Подивитись усіх користувачів і магазини:
-- select name, phone, role, city, created_at from public.profiles order by created_at desc;
-- select name, city, address, verified, created_at from public.shops order by created_at desc;
