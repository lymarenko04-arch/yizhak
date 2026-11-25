// Серверний адаптер: ті самі методи, що й у local.js, але дані в Supabase і спільні для всіх телефонів.
// Правила (ліміти броней, коди, хто що бачить) перевіряє сама база: supabase/schema.sql.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4';
import { CONFIG, CITIES } from './config.js';
import { geocode } from './local.js';

const sb = createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, storageKey: 'yizhak.auth' },
});
const fail = m => { throw new Error(m); };
// Помилки бази (raise exception) вже українською; технічні замінюємо на зрозумілі.
function ok({ data, error }) {
  if (error) {
    const m = error.message || '';
    if (/fetch|network/i.test(m)) fail('Немає зв’язку з сервером. Перевірте інтернет.');
    if (/anonymous/i.test(m)) fail('Вхід вимкнено на сервері. Власнику: увімкніть Anonymous sign-ins у Supabase.');
    if (/row-level security|permission denied/i.test(m)) fail('Немає доступу до цієї дії.');
    if (/rate limit/i.test(m)) fail('Забагато спроб. Спробуйте за кілька хвилин.');
    fail(m);
  }
  return data;
}
const uidNow = async () => (await sb.auth.getSession()).data.session?.user?.id || null;
const needUid = async () => (await uidNow()) || fail('Увійдіть, щоб продовжити.');
const nowIso = () => new Date().toISOString();
const offerOut = o => o && ({ ...o, photo: o.photo_url || null });
const setOut = s => ({ goalType: s.goal_type, goalValue: s.goal_value, rate: s.rate, commissionOn: s.commission_on });

let shopCache = null; // магазин поточного користувача
async function myShop() {
  const id = await uidNow(); if (!id) return null;
  if (shopCache && shopCache.owner_id === id) return shopCache;
  shopCache = ok(await sb.from('shops').select('*').eq('owner_id', id).maybeSingle());
  return shopCache;
}
const needShop = async () => (await myShop()) || fail('Спочатку зареєструйте магазин.');

async function uploadPhoto(dataUrl, shopId) {
  if (!dataUrl || !dataUrl.startsWith('data:')) return dataUrl || null;
  const blob = await (await fetch(dataUrl)).blob();
  const path = `${shopId}/${crypto.randomUUID()}.jpg`;
  ok(await sb.storage.from('offer-photos').upload(path, blob, { contentType: 'image/jpeg', upsert: false }));
  return sb.storage.from('offer-photos').getPublicUrl(path).data.publicUrl;
}

export const remoteApi = {
  mode: 'server',

  async me() {
    const id = await uidNow(); if (!id) return null;
    return ok(await sb.from('profiles').select('*').eq('id', id).maybeSingle());
  },

  // Пілот: вхід без пошти й SMS. Сесія живе в цьому браузері, ім'я і телефон зберігаються в профілі.
  async signIn({ name, phone, role }) {
    const p = String(phone || '').replace(/[^\d+]/g, '');
    if (!String(name || '').trim()) fail('Вкажіть ім’я.');
    if (p.replace(/\D/g, '').length < 10) fail('Вкажіть номер телефону повністю.');
    let id = await uidNow();
    if (!id) id = ok(await sb.auth.signInAnonymously()).user.id;
    const existing = ok(await sb.from('profiles').select('*').eq('id', id).maybeSingle());
    if (existing) return existing;
    return ok(await sb.from('profiles').insert({ id, name: name.trim(), phone: p, role: role === 'shop' ? 'shop' : 'buyer' }).select().single());
  },

  async signOut() { shopCache = null; await sb.auth.signOut(); },

  async updateProfile(patch) {
    const id = await needUid(), row = {};
    for (const k of ['name', 'city', 'category', 'consent_at']) if (k in patch) row[k] = patch[k];
    if (row.category && !row.consent_at) fail('Потрібна згода на обробку даних про пільгову категорію.');
    return ok(await sb.from('profiles').update(row).eq('id', id).select().single());
  },

  // ---------- покупець ----------
  async listOffers({ city }) {
    let q = sb.from('offers').select('*, shop:shops!inner(*)').eq('status', 'active').gt('qty_left', 0).gt('pickup_to', nowIso())
      .order('pickup_to', { ascending: true }).limit(200);
    if (city) q = q.eq('shop.city', city);
    return ok(await q).map(offerOut);
  },

  async getOffer(id) {
    if (!/^[0-9a-f-]{36}$/i.test(id || '')) return null;
    const o = ok(await sb.from('offers').select('*, shop:shops(*)').eq('id', id).maybeSingle());
    if (o && o.status === 'active' && new Date(o.pickup_to) < new Date()) o.status = 'closed';
    return offerOut(o);
  },

  async reserve(offerId) { return ok(await sb.rpc('reserve_offer', { p_offer: offerId })); },

  async myReservations() {
    const id = await needUid();
    await sb.rpc('expire_old');
    return ok(await sb.from('reservations').select('*, shop:shops(*), offer:offers(pickup_from, pickup_to)')
      .eq('buyer_id', id).order('created_at', { ascending: false }).limit(50));
  },

  async cancel(resId) { ok(await sb.rpc('cancel_reservation', { p_res: resId })); },

  async review(resId, rating, text) {
    if (!(rating >= 1 && rating <= 5)) fail('Поставте оцінку від 1 до 5.');
    ok(await sb.from('reservations').update({ rating, review: String(text || '').slice(0, 500) }).eq('id', resId).select('id').single());
  },

  // ---------- магазин ----------
  myShop,

  async saveShop(data) {
    const id = await needUid();
    for (const k of ['name', 'type', 'city', 'address', 'phone']) if (!String(data[k] || '').trim()) fail('Заповніть усі поля магазину.');
    const cur = await myShop();
    const row = { name: data.name.trim(), type: data.type, city: data.city, address: data.address.trim(), phone: data.phone.trim(), halal: !!data.halal };
    if (!cur || cur.address !== row.address || cur.city !== row.city) {
      const [lat, lng, exact] = await geocode(row.address, row.city);
      Object.assign(row, { lat, lng, geo_exact: exact });
    }
    shopCache = cur
      ? ok(await sb.from('shops').update(row).eq('id', cur.id).select().single())
      : ok(await sb.from('shops').insert({ ...row, owner_id: id }).select().single());
    return shopCache;
  },

  async createOffer(o) {
    const s = await needShop();
    if (!String(o.title || '').trim()) fail('Вкажіть назву набору.');
    if (!(o.old_price > 0)) fail('Вкажіть звичайну вартість продуктів.');
    if (!o.free && !(o.price > 0)) fail('Вкажіть ціну зі знижкою або оберіть «Безкоштовно».');
    if (!o.free && o.price >= o.old_price) fail('Ціна зі знижкою має бути меншою за звичайну.');
    if (!(o.qty >= 1)) fail('Вкажіть кількість наборів.');
    if (!(new Date(o.pickup_to) > new Date())) fail('Час видачі вже минув. Перевірте день і години.');
    if (new Date(o.pickup_to) <= new Date(o.pickup_from)) fail('Кінець видачі має бути пізніше за початок.');
    const photo_url = await uploadPhoto(o.photo, s.id);
    const qty = Math.round(o.qty);
    return offerOut(ok(await sb.from('offers').insert({
      shop_id: s.id, title: o.title.trim().slice(0, 80), description: String(o.description || '').trim().slice(0, 600), category: o.category,
      photo_url, old_price: Math.round(o.old_price), price: o.free ? 0 : Math.round(o.price), free: !!o.free, halal: !!(o.halal && s.halal),
      weight_kg: Math.max(0.1, Number(o.weight_kg) || 1), qty_total: qty, qty_left: qty, pickup_from: o.pickup_from, pickup_to: o.pickup_to,
    }).select().single()));
  },

  async shopOffers() {
    const s = await needShop(); await sb.rpc('expire_old');
    return ok(await sb.from('offers').select('*').eq('shop_id', s.id).order('created_at', { ascending: false }).limit(100)).map(offerOut);
  },

  async closeOffer(id) { const s = await needShop(); ok(await sb.from('offers').update({ status: 'closed' }).eq('id', id).eq('shop_id', s.id).select('id').single()); },

  async shopReservations() {
    await needShop();
    return ok(await sb.from('shop_reservations').select('*').order('created_at', { ascending: false }).limit(200));
  },

  async findByCode(code) {
    await needShop();
    const c = String(code).trim(); if (!/^\d{4}$/.test(c)) return null;
    return ok(await sb.rpc('find_by_code', { p_code: c }))[0] || null;
  },

  async issue(resId) { ok(await sb.rpc('issue_reservation', { p_res: resId })); },

  // ---------- власник ----------
  async stats() {
    const s = ok(await sb.rpc('owner_stats'));
    for (const k of ['kg', 'saved', 'turnover']) s[k] = Number(s[k]) || 0;
    for (const c of Object.values(s.byCity || {})) c.kg = Number(c.kg) || 0;
    return s;
  },
  async getSettings() { return setOut(ok(await sb.from('settings').select('*').eq('id', 1).single())); },
  async saveSettings(p) {
    return setOut(ok(await sb.from('settings').update({ goal_type: p.goalType, goal_value: p.goalValue, rate: p.rate, commission_on: p.commissionOn })
      .eq('id', 1).select().single()));
  },
};
