// Шар даних. Зараз працює тестовий адаптер: усе зберігається в localStorage цього пристрою.
// Структура таблиць така сама, як у supabase/schema.sql, тож серверний адаптер підключиться
// без зміни екранів: він має реалізувати ті самі методи об'єкта api.
import { CONFIG, CITIES } from './config.js';

const KEY = 'yizhak.local.v1';
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2));
const now = () => new Date().toISOString();
const fail = m => { throw new Error(m); };

function fresh() {
  return { users: [], shops: [], offers: [], res: [], settings: { ...CONFIG.DEFAULT_SETTINGS }, session: null };
}
function load() {
  try { const d = JSON.parse(localStorage.getItem(KEY)); return d && d.users ? d : fresh(); } catch { return fresh(); }
}
function save(db) {
  try { localStorage.setItem(KEY, JSON.stringify(db)); }
  catch { fail('Пам’ять браузера заповнена. Видаліть старі набори з фото або очистіть тестові дані в профілі.'); }
}
function me(db) { return db.users.find(u => u.id === db.session) || null; }
function needMe(db) { return me(db) || fail('Увійдіть, щоб продовжити.'); }
function needShop(db) { const u = needMe(db); return db.shops.find(s => s.owner_id === u.id) || fail('Спочатку зареєструйте магазин.'); }

// Броні, час видачі яких минув, стають простроченими.
function expire(db) {
  const t = Date.now(); let ch = false;
  for (const r of db.res) if (r.status === 'reserved' && new Date(r.expires_at).getTime() < t) { r.status = 'expired'; ch = true; }
  for (const o of db.offers) if (o.status === 'active' && new Date(o.pickup_to).getTime() < t) { o.status = 'closed'; ch = true; }
  if (ch) save(db);
}
const withShop = (db, o) => ({ ...o, shop: db.shops.find(s => s.id === o.shop_id) || null });

export async function geocode(address, city) {
  try {
    const q = encodeURIComponent(`${address}, ${city}, Україна`);
    const r = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=ua&q=${q}`, { headers: { 'Accept-Language': 'uk' } });
    const j = await r.json();
    if (j[0]) return [Number(j[0].lat), Number(j[0].lon), true];
  } catch { /* без мережі: беремо центр міста */ }
  const c = CITIES[city] || CITIES['Київ'];
  return [c[0] + (Math.random() - 0.5) * 0.02, c[1] + (Math.random() - 0.5) * 0.03, false];
}

export const localApi = {
  mode: 'local',

  async me() { const db = load(); expire(db); return me(db); },

  async signIn({ name, phone, role }) {
    const db = load();
    const p = String(phone || '').replace(/[^\d+]/g, '');
    if (!String(name || '').trim()) fail('Вкажіть ім’я.');
    if (p.replace(/\D/g, '').length < 10) fail('Вкажіть номер телефону повністю.');
    let u = db.users.find(x => x.phone === p);
    if (!u) {
      u = { id: uid(), name: name.trim(), phone: p, role: role === 'shop' ? 'shop' : 'buyer', city: '', category: null, consent_at: null, created_at: now() };
      db.users.push(u);
    }
    db.session = u.id; save(db); return u;
  },

  async signOut() { const db = load(); db.session = null; save(db); },

  async updateProfile(patch) {
    const db = load(); const u = needMe(db);
    const allowed = ['name', 'city', 'category', 'consent_at'];
    for (const k of allowed) if (k in patch) u[k] = patch[k];
    if (u.category && !u.consent_at) fail('Потрібна згода на обробку даних про пільгову категорію.');
    save(db); return u;
  },

  // ---------- покупець ----------
  async listOffers({ city }) {
    const db = load(); expire(db);
    return db.offers
      .filter(o => o.status === 'active' && o.qty_left > 0)
      .map(o => withShop(db, o))
      .filter(o => o.shop && (!city || o.shop.city === city))
      .sort((a, b) => new Date(a.pickup_to) - new Date(b.pickup_to));
  },

  async getOffer(id) { const db = load(); expire(db); const o = db.offers.find(x => x.id === id); return o ? withShop(db, o) : null; },

  async reserve(offerId) {
    const db = load(); expire(db); const u = needMe(db);
    const o = db.offers.find(x => x.id === offerId) || fail('Набір не знайдено.');
    if (o.status !== 'active' || o.qty_left < 1) fail('На жаль, цей набір уже розібрали.');
    const mine = db.res.filter(r => r.buyer_id === u.id && r.status === 'reserved');
    if (mine.some(r => r.offer_id === o.id)) fail('Ви вже забронювали цей набір. Код у вкладці «Мої».');
    if (mine.length >= 3) fail('Можна мати до 3 активних броней. Заберіть або скасуйте одну з них.');
    if (o.free) {
      if (!u.category) fail('Безкоштовні набори для пільгових категорій. Вкажіть категорію в профілі.');
      if (mine.some(r => r.free)) fail('Спочатку заберіть попередній безкоштовний набір.');
    }
    const used = new Set(db.res.filter(r => r.shop_id === o.shop_id && r.status === 'reserved').map(r => r.code));
    let code; do { code = String(Math.floor(1000 + Math.random() * 9000)); } while (used.has(code));
    o.qty_left -= 1;
    const r = {
      id: uid(), offer_id: o.id, shop_id: o.shop_id, buyer_id: u.id, buyer_name: u.name, buyer_category: u.category,
      title: o.title, price: o.price, old_price: o.old_price, weight_kg: o.weight_kg, free: o.free,
      code, status: 'reserved', expires_at: o.pickup_to, created_at: now(), picked_at: null, rating: null, review: '',
    };
    db.res.push(r); save(db); return r;
  },

  async myReservations() {
    const db = load(); expire(db); const u = needMe(db);
    return db.res.filter(r => r.buyer_id === u.id)
      .map(r => ({ ...r, shop: db.shops.find(s => s.id === r.shop_id) || null, offer: db.offers.find(o => o.id === r.offer_id) || null }))
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  },

  async cancel(resId) {
    const db = load(); const u = needMe(db);
    const r = db.res.find(x => x.id === resId && x.buyer_id === u.id) || fail('Бронь не знайдено.');
    if (r.status !== 'reserved') fail('Цю бронь уже не можна скасувати.');
    r.status = 'cancelled';
    const o = db.offers.find(x => x.id === r.offer_id); if (o && o.status === 'active') o.qty_left += 1;
    save(db);
  },

  async review(resId, rating, text) {
    const db = load(); const u = needMe(db);
    const r = db.res.find(x => x.id === resId && x.buyer_id === u.id) || fail('Бронь не знайдено.');
    if (r.status !== 'picked') fail('Відгук можна залишити після отримання набору.');
    if (!(rating >= 1 && rating <= 5)) fail('Поставте оцінку від 1 до 5.');
    r.rating = rating; r.review = String(text || '').slice(0, 500); save(db);
  },

  // ---------- магазин ----------
  async myShop() { const db = load(); const u = me(db); return u ? db.shops.find(s => s.owner_id === u.id) || null : null; },

  async saveShop(data) {
    const db = load(); const u = needMe(db);
    for (const k of ['name', 'type', 'city', 'address', 'phone']) if (!String(data[k] || '').trim()) fail('Заповніть усі поля магазину.');
    let s = db.shops.find(x => x.owner_id === u.id);
    const moved = !s || s.address !== data.address || s.city !== data.city;
    if (!s) { s = { id: uid(), owner_id: u.id, verified: false, created_at: now() }; db.shops.push(s); }
    Object.assign(s, { name: data.name.trim(), type: data.type, city: data.city, address: data.address.trim(), phone: data.phone.trim(), halal: !!data.halal });
    save(db);
    if (moved) {
      const [lat, lng, exact] = await geocode(s.address, s.city);
      const d2 = load(); const s2 = d2.shops.find(x => x.id === s.id); Object.assign(s2, { lat, lng, geo_exact: exact }); save(d2); return s2;
    }
    return s;
  },

  async createOffer(o) {
    const db = load(); const s = needShop(db);
    if (!String(o.title || '').trim()) fail('Вкажіть назву набору.');
    if (!(o.old_price > 0)) fail('Вкажіть звичайну вартість продуктів.');
    if (!o.free && !(o.price > 0)) fail('Вкажіть ціну зі знижкою або оберіть «Безкоштовно».');
    if (!o.free && o.price >= o.old_price) fail('Ціна зі знижкою має бути меншою за звичайну.');
    if (!(o.qty >= 1)) fail('Вкажіть кількість наборів.');
    if (!(new Date(o.pickup_to) > new Date())) fail('Час видачі вже минув. Перевірте день і години.');
    if (new Date(o.pickup_to) <= new Date(o.pickup_from)) fail('Кінець видачі має бути пізніше за початок.');
    const off = {
      id: uid(), shop_id: s.id, title: o.title.trim().slice(0, 80), description: String(o.description || '').trim().slice(0, 600),
      category: o.category, photo: o.photo || null, old_price: Math.round(o.old_price), price: o.free ? 0 : Math.round(o.price), free: !!o.free,
      halal: !!(o.halal && s.halal), weight_kg: Math.max(0.1, Number(o.weight_kg) || 1), qty_total: Math.round(o.qty), qty_left: Math.round(o.qty),
      pickup_from: o.pickup_from, pickup_to: o.pickup_to, status: 'active', created_at: now(),
    };
    db.offers.push(off); save(db); return off;
  },

  async shopOffers() {
    const db = load(); expire(db); const s = needShop(db);
    return db.offers.filter(o => o.shop_id === s.id).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  },

  async closeOffer(id) {
    const db = load(); const s = needShop(db);
    const o = db.offers.find(x => x.id === id && x.shop_id === s.id) || fail('Набір не знайдено.');
    o.status = 'closed'; save(db);
  },

  async shopReservations() {
    const db = load(); expire(db); const s = needShop(db);
    // Магазин не бачить коди: покупець показує код сам, це захист від обману.
    return db.res.filter(r => r.shop_id === s.id).map(({ code, ...r }) => r)
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  },

  async findByCode(code) {
    const db = load(); expire(db); const s = needShop(db);
    const r = db.res.find(x => x.shop_id === s.id && x.code === String(code).trim() && x.status === 'reserved');
    return r || null;
  },

  async issue(resId) {
    const db = load(); const s = needShop(db);
    const r = db.res.find(x => x.id === resId && x.shop_id === s.id) || fail('Бронь не знайдено.');
    if (r.status !== 'reserved') fail('Цей набір уже видано або бронь неактивна.');
    r.status = 'picked'; r.picked_at = now(); save(db); return r;
  },

  // ---------- власник ----------
  async stats() {
    const db = load(); expire(db);
    const picked = db.res.filter(r => r.status === 'picked');
    const paid = picked.filter(r => !r.free);
    const shopCity = id => (db.shops.find(s => s.id === id) || {}).city || '—';
    const byCity = {};
    for (const s of db.shops) (byCity[s.city] ||= { shops: 0, orders: 0, kg: 0 }).shops++;
    for (const r of picked) { const c = byCity[shopCity(r.shop_id)] ||= { shops: 0, orders: 0, kg: 0 }; c.orders++; c.kg += r.weight_kg; }
    return {
      kg: picked.reduce((a, r) => a + r.weight_kg, 0),
      saved: picked.reduce((a, r) => a + (r.old_price - r.price), 0),
      turnover: paid.reduce((a, r) => a + r.price, 0),
      orders: picked.length, paidOrders: paid.length, freeOrders: picked.length - paid.length,
      active: db.res.filter(r => r.status === 'reserved').length,
      shops: db.shops.length, buyers: db.users.filter(u => u.role === 'buyer').length,
      vulnerable: db.users.filter(u => u.category).length,
      offersLive: db.offers.filter(o => o.status === 'active').length,
      byCity,
    };
  },
  async getSettings() { return { ...CONFIG.DEFAULT_SETTINGS, ...load().settings }; },
  async saveSettings(patch) { const db = load(); db.settings = { ...CONFIG.DEFAULT_SETTINGS, ...db.settings, ...patch }; save(db); return db.settings; },

  // ---------- тестовий режим ----------
  async seedDemo(city) {
    const db = load(); const c = CITIES[city] || CITIES['Київ'];
    // Вікно видачі: сьогодні, а якщо кінець уже минув, то завтра.
    const win = ([fh, fm = 0], [th, tm = 0]) => {
      const f = new Date(), t = new Date(); f.setHours(fh, fm, 0, 0); t.setHours(th, tm, 0, 0);
      if (t < new Date()) { f.setDate(f.getDate() + 1); t.setDate(t.getDate() + 1); }
      return [f.toISOString(), t.toISOString()];
    };
    const shops = [
      ['Пекарня «Колосок»', 'Пекарня', 'вул. Соборна, 12', 0.004, -0.006, false],
      ['Супермаркет «Сонях»', 'Супермаркет', 'вул. Шевченка, 40', -0.006, 0.008, false],
      ['Кафе «Борщ і Ко»', 'Кафе / ресторан', 'вул. Центральна, 3', 0.002, 0.012, false],
      ['М’ясна лавка «Барака»', 'М’ясна лавка', 'вул. Садова, 7', -0.009, -0.01, true],
    ].map(([name, type, address, dy, dx, halal]) => {
      const owner = { id: uid(), name: 'Демо-власник', phone: '+380000' + Math.floor(Math.random() * 1e6), role: 'shop', city, category: null, consent_at: null, created_at: now(), demo: true };
      db.users.push(owner);
      const s = { id: uid(), owner_id: owner.id, name, type, city, address, phone: '+380 00 000 00 00', halal, lat: c[0] + dy, lng: c[1] + dx, verified: true, created_at: now(), demo: true };
      db.shops.push(s); return s;
    });
    const mk = (s, title, category, old, price, qty, kgw, from, to, extra = {}) => { const [pf, pt] = win(from, to); db.offers.push({
      id: uid(), shop_id: s.id, title, description: '', category, photo: null, old_price: old, price, free: price === 0, halal: false,
      weight_kg: kgw, qty_total: qty, qty_left: qty, pickup_from: pf, pickup_to: pt, status: 'active', created_at: now(), demo: true, ...extra }); };
    mk(shops[0], 'Набір «Хлібний вечір»', 'bake', 240, 99, 4, 1.5, [19], [21], { description: 'Хліб, батон і 4–5 булочок, спечені сьогодні.' });
    mk(shops[0], 'Пиріжки та булочки', 'bake', 180, 0, 3, 1, [20], [21, 30], { description: 'Для пенсіонерів, людей з інвалідністю та багатодітних сімей.' });
    mk(shops[1], 'Молочний набір 5 позицій', 'dairy', 310, 139, 6, 3, [10], [22], { description: 'Молоко, кефір, сир, йогурти. Термін до 2 днів.' });
    mk(shops[1], 'Овочевий кошик 3 кг', 'veg', 220, 89, 5, 3, [10], [22]);
    mk(shops[2], 'Готові страви ×3', 'ready', 420, 149, 2, 1.2, [21], [22, 30], { description: 'Три порції сьогоднішніх страв: перше, друге, салат.' });
    mk(shops[3], 'Ковбаса яловича халяль, 2 палки', 'meat', 520, 240, 5, 1, [12], [20], { halal: true, description: 'Сертифікат халяль у магазині.' });
    save(db);
  },

  async resetAll() { localStorage.removeItem(KEY); },
};
