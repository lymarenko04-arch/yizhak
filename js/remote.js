// Серверний адаптер: ті самі методи, що й у local.js, але дані в Supabase і спільні для всіх телефонів.
// Правила (ліміти броней, коди, хто що бачить) перевіряє сама база: supabase/schema.sql.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4';
import { CONFIG, CITIES } from './config.js';
import { resolvePlace, okPoint, normPhone } from './local.js';

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
    if (/violates check constraint|violates .* constraint/i.test(m)) fail('Дані не пройшли перевірку. Перевірте поля й спробуйте ще раз. Якщо не допоможе, напишіть у підтримку Їжака.');
    fail(m);
  }
  return data;
}
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
// Помилки входу з поштою: перекладаємо найчастіші.
function authOk(res) {
  const m = res.error?.message || '';
  if (/already registered|already been registered|already exists/i.test(m)) fail('Ця пошта вже зареєстрована. Натисніть «Я вже маю акаунт».');
  if (/invalid login credentials/i.test(m)) fail('Неправильна пошта або пароль.');
  if (/email not confirmed/i.test(m)) fail('Пошту ще не підтверджено. Відкрийте лист від Їжака й натисніть посилання.');
  if (/signups? (are )?(not allowed|disabled)/i.test(m)) fail('Реєстрацію з поштою вимкнено на сервері.');
  if (/password/i.test(m) && /least|short|weak/i.test(m)) fail('Пароль закороткий або надто простий. Додайте цифри.');
  if (/invalid/i.test(m) && /email/i.test(m)) fail('Перевірте пошту. Наприклад: olena@gmail.com');
  return ok(res);
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
    const p = ok(await sb.from('profiles').select('*').eq('id', id).maybeSingle());
    if (p) return p;
    // Реєстрація з поштою: ім'я й телефон чекають у метаданих, доки людина підтвердить пошту.
    const m = (await sb.auth.getUser()).data.user?.user_metadata || {};
    if (!m.name) return null;
    return ok(await sb.from('profiles').insert({ id, name: m.name, phone: m.phone || null, role: m.role === 'shop' ? 'shop' : 'buyer' }).select().single());
  },

  // Пошта й пароль: щоб увійти в той самий акаунт з іншого телефона. Паролі зберігає Supabase (лише хеш).
  async signUpEmail({ name, email, password, phone, role }) {
    name = String(name || '').trim(); email = String(email || '').trim().toLowerCase();
    if (!name) fail('Вкажіть ім’я.');
    if (!EMAIL.test(email)) fail('Перевірте пошту. Наприклад: olena@gmail.com');
    if (String(password || '').length < 6) fail('Пароль має бути щонайменше з 6 символів.');
    let p = null;
    if (String(phone || '').trim()) { p = normPhone(phone); if (!p) fail('Перевірте номер телефону. Наприклад: 067 123 45 67'); }
    if (await uidNow()) await sb.auth.signOut();
    const r = authOk(await sb.auth.signUp({ email, password, options: { data: { name, phone: p, role: role === 'shop' ? 'shop' : 'buyer' }, emailRedirectTo: location.origin + location.pathname } }));
    if (!r.session) return { needConfirm: true, email };
    return this.me();
  },

  async signInEmail({ email, password }) {
    email = String(email || '').trim().toLowerCase();
    if (!EMAIL.test(email)) fail('Перевірте пошту. Наприклад: olena@gmail.com');
    if (!password) fail('Введіть пароль.');
    // Поточну сесію не чіпаємо, доки пароль не підійде: невдала спроба нічого не ламає.
    authOk(await sb.auth.signInWithPassword({ email, password }));
    shopCache = null;
    return (await this.me()) || fail('Акаунт знайдено, але профіль не заповнено. Зареєструйтеся ще раз.');
  },

  // Додати пошту й пароль до акаунта, створеного за телефоном.
  async addEmail({ email, password }) {
    email = String(email || '').trim().toLowerCase();
    if (!EMAIL.test(email)) fail('Перевірте пошту. Наприклад: olena@gmail.com');
    if (String(password || '').length < 6) fail('Пароль має бути щонайменше з 6 символів.');
    const r = authOk(await sb.auth.updateUser({ email, password }, { emailRedirectTo: location.origin + location.pathname }));
    return { needConfirm: r.user?.email !== email, email };
  },

  // ----- власник: пошта + довгий пароль + код з застосунку-автентифікатора -----
  async ownerSignIn({ email, password }) {
    await this.signInEmail({ email, password });
    return this.ownerState();
  },
  // role: чи є роль власника; enrolled: чи увімкнено код; ok: чи можна відкривати облік зараз.
  async ownerState() {
    const p = await this.me();
    const { data: f } = await sb.auth.mfa.listFactors();
    const totp = (f?.totp || []).find(x => x.status === 'verified');
    const { data: a } = await sb.auth.mfa.getAuthenticatorAssuranceLevel();
    const enrolled = !!totp, aal2 = a?.currentLevel === 'aal2';
    return { role: p?.role === 'owner', enrolled, needCode: enrolled && !aal2, ok: p?.role === 'owner' && (!enrolled || aal2), factorId: totp?.id };
  },
  async ownerCode(code) {
    const s = await this.ownerState();
    if (!s.factorId) fail('Двофакторний захист не увімкнено.');
    const r = await sb.auth.mfa.challengeAndVerify({ factorId: s.factorId, code: String(code || '').replace(/\D/g, '') });
    if (r.error) fail('Невірний код. Відкрийте застосунок-автентифікатор і введіть свіжі 6 цифр.');
    return this.ownerState();
  },
  async mfaStart() {
    const { data: f } = await sb.auth.mfa.listFactors();
    for (const x of f?.all || []) if (x.status !== 'verified') await sb.auth.mfa.unenroll({ factorId: x.id });
    const r = await sb.auth.mfa.enroll({ factorType: 'totp', friendlyName: 'Їжак власник' });
    if (r.error) fail('Не вдалося увімкнути захист: ' + r.error.message);
    return { factorId: r.data.id, qr: r.data.totp.qr_code, secret: r.data.totp.secret };
  },
  async mfaFinish(factorId, code) {
    const r = await sb.auth.mfa.challengeAndVerify({ factorId, code: String(code || '').replace(/\D/g, '') });
    if (r.error) fail('Невірний код. Перевірте, що час на телефоні правильний, і введіть свіжі 6 цифр.');
  },

  async changePassword(pw) {
    if (String(pw || '').length < 8) fail('Новий пароль має бути щонайменше з 8 символів.');
    if (String(pw).length > 72) fail('Пароль задовгий: максимум 72 символи.');
    authOk(await sb.auth.updateUser({ password: pw }));
  },

  async myEmail() { const u = (await sb.auth.getUser()).data.user; return u?.email || u?.new_email || null; },

  // Пілот: вхід без пошти й SMS. Сесія живе в цьому браузері, ім'я і телефон зберігаються в профілі.
  async signIn({ name, phone, role }) {
    const p = normPhone(phone);
    if (!String(name || '').trim()) fail('Вкажіть ім’я.');
    if (!p) fail('Перевірте номер телефону. Наприклад: 067 123 45 67');
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
    if (!cur || cur.address !== row.address || cur.city !== row.city) Object.assign(row, await resolvePlace(row.address, row.city));
    shopCache = cur
      ? ok(await sb.from('shops').update(row).eq('id', cur.id).select().single())
      : ok(await sb.from('shops').insert({ ...row, owner_id: id }).select().single());
    return shopCache;
  },

  async setShopPoint(lat, lng) {
    okPoint(lat, lng);
    const s = await needShop();
    shopCache = ok(await sb.from('shops').update({ lat, lng, geo_exact: true }).eq('id', s.id).select().single());
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
  // Усе для аналізу магазинів: магазини, набори, броні з покупцем. Доступно лише власнику (правила бази).
  async ownerData() {
    const [shops, offers, res] = await Promise.all([
      sb.from('shops').select('*').order('created_at'),
      sb.from('offers').select('id,shop_id,title,category,old_price,price,free,weight_kg,qty_total,qty_left,status,pickup_from,pickup_to,created_at').order('created_at', { ascending: false }).limit(3000),
      sb.from('reservations').select('id,offer_id,shop_id,status,title,price,old_price,free,weight_kg,created_at,picked_at,rating,buyer:profiles(name,client_no,category)').order('created_at', { ascending: false }).limit(5000),
    ]);
    return { shops: ok(shops), offers: ok(offers), res: ok(res).map(r => ({ ...r, weight_kg: Number(r.weight_kg) || 0, buyer_name: r.buyer?.name, buyer_no: r.buyer?.client_no, buyer_category: r.buyer?.category })) };
  },

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
