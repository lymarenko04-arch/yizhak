import { CONFIG, CITIES } from './config.js';
import { api } from './store.js';
import { startTour, BUYER_TOUR, SHOP_TOUR } from './tour.js';
import { esc, num, money, kg, toast, ic, pic, catLook, CATS, GROUPS, GROUP_DOCS, SHOP_TYPES, LOGO, FACE, when, mapsUrl, thumb, resizeImage } from './ui.js';

const $ = s => document.querySelector(s);
const st = { user: null, shop: null, cat: 'all', view: 'list', ownerOk: false, introDone: false, role: 'buyer', nf: null, found: null, stars: {} };
const go = path => { const h = '#/' + path; if (location.hash === h) render(); else location.hash = h; };
const cityOpts = sel => Object.keys(CITIES).map(c => `<option ${c === sel ? 'selected' : ''}>${esc(c)}</option>`).join('');
const back = (to, label = 'Назад') => `<a class="back" href="#/${to}">${ic.back.replace('<svg', '<svg width="18" height="18"')}${label}</a>`;
const testNote = () => api.mode === 'local' ? `<div class="notice"><b>Тестовий режим.</b> Дані зберігаються лише на цьому пристрої. Оплата відбувається в магазині: готівкою або карткою.</div>`
  : `<div class="notice"><b>Пілот.</b> Їжак не приймає гроші: оплата відбувається в магазині, готівкою або карткою.</div>`;

// ---------- екрани ----------
const V = {};

V[''] = () => `<div class="welcome ${st.introDone ? '' : 'intro'}">
  <div class="w-hero"><div class="big-brand">${FACE}</div>
  <div class="acro" aria-label="ЇЖАК: Їжа Живить Абсолютно Кожного"><span><b>Ї</b>жа</span><span><b>Ж</b>ивить</span><span><b>А</b>бсолютно</span><span><b>К</b>ожного</span></div>
  <h1 style="text-align:center">Їжа, яка ще може дати енергію</h1></div>
  <div class="w-rest"><p class="sub" style="text-align:center">Їжак ходить усією Україною і збирає смачну, свіжу їжу, яку магазини не встигли продати. Він приносить її людям: комусь за ціною, яку легко потягнути, комусь безкоштовно. Бо поїсти досхочу має кожен.</p>
  <div class="label" style="margin:8px 0">Хто ви?</div>
  <button class="pick" data-act="pick" data-role="buyer"><span class="ic">${ic.me}</span><span><b>Я покупець</b><span class="meta">Купувати набори дешево або отримувати безкоштовну їжу</span></span></button>
  <button class="pick" data-act="pick" data-role="shop"><span class="ic biz">${ic.box}</span><span><b>Я підприємство</b><span class="meta">Магазин, пекарня, кафе, ферма. Продавати залишки замість списання</span></span></button></div></div>`;

const addrHint = `<span class="hint">Вулиця й номер будинку. Або вставте посилання на ваш заклад із Google Maps. Точку на мапі покажемо й дамо поправити.</span>`;
const shopFields = (s = {}, withContact = false) => `
  <div class="field"><label for="s-name">Назва закладу</label><input id="s-name" name="name" type="text" value="${esc(s.name || '')}" placeholder="Пекарня «Колосок»" autocomplete="organization" required></div>
  <div class="field"><label for="s-phone">Телефон</label><input id="s-phone" name="phone" type="tel" value="${esc(s.phone || '')}" placeholder="067 123 45 67" autocomplete="tel" inputmode="tel" required>
  ${withContact ? `<span class="hint">${api.mode === 'local' ? 'Якщо ви вже входили з цим номером, відкриємо ваш акаунт.' : 'Акаунт прив’язується до цього телефона. Пошта й SMS не потрібні.'}</span>` : ''}</div>
  <div class="field"><label for="s-city">Місто</label><select id="s-city" name="city">${cityOpts(s.city || st.user?.city || 'Київ')}</select></div>
  <div class="field"><label for="s-addr">Адреса</label><input id="s-addr" name="address" type="text" value="${esc(s.address || '')}" placeholder="вул. Соборна, 12" required>${addrHint}</div>
  <div class="field"><label for="s-type">Тип</label><select id="s-type" name="type">${SHOP_TYPES.map(t => `<option ${t === s.type ? 'selected' : ''}>${t}</option>`).join('')}</select></div>
  ${withContact ? `<div class="field"><label for="s-contact">Як до вас звертатися (необов’язково)</label><input id="s-contact" name="contact" type="text" autocomplete="name" placeholder="Олена"></div>` : ''}
  <label class="check"><input type="checkbox" name="halal" ${s.halal ? 'checked' : ''}><span><b>Продаємо халяль</b><br><span class="meta">Лише з чинним сертифікатом. Покупці побачать позначку «халяль».</span></span></label>`;

V.login = () => st.role === 'shop' ? `${back('', 'На початок')}
  <h2>Реєстрація підприємства</h2>
  <p class="sub">Одна форма, і ваш заклад з’явиться на мапі Їжака.</p>
  ${testNote()}
  <form data-form="shopjoin" novalidate>${shopFields({}, true)}
  <button class="btn wide">Зареєструвати заклад</button></form>` : `${back('', 'На початок')}
  <h2>${st.role === 'shop' ? 'Вхід для підприємства' : 'Вхід для покупця'}</h2>
  <p class="sub">${st.role === 'shop' ? 'Спершу ваші контакти, потім дані магазину.' : 'Ім’я і телефон потрібні, щоб магазин знав, кому видати набір.'}</p>
  ${testNote()}
  <form data-form="login" novalidate>
  <div class="field"><label for="l-name">Ім’я</label><input id="l-name" name="name" type="text" autocomplete="name" required></div>
  <div class="field"><label for="l-phone">Телефон</label><input id="l-phone" name="phone" type="tel" autocomplete="tel" placeholder="067 123 45 67" inputmode="tel" required>
  <span class="hint">${api.mode === 'local' ? 'Якщо ви вже входили з цим номером, відкриємо ваш акаунт.' : 'Акаунт прив’язується до цього телефона і браузера. Пошта й SMS не потрібні.'}</span></div>
  <button class="btn wide">Продовжити</button></form>`;

V.onboard = () => `<h2>Вітаємо, ${esc(st.user.name)}!</h2><p class="sub">Ще два кроки, і покажемо набори поруч.</p>${profileForm(true)}`;

function profileForm(first) {
  const u = st.user;
  return `<form data-form="profile" novalidate>
  ${first ? '' : `<div class="field"><label for="p-name">Ім’я</label><input id="p-name" name="name" type="text" value="${esc(u.name)}"></div>`}
  <div class="field"><label for="p-city">Ваше місто</label><select id="p-city" name="city">${cityOpts(u.city || 'Київ')}</select></div>
  ${u.role === 'buyer' ? `<div class="label" style="margin:6px 0 8px">Пільгова категорія (необов’язково)</div>
  <p class="meta" style="margin:0 0 10px">Дає доступ до безкоштовних наборів. Документ ви лише показуєте продавцю при отриманні, ми його не зберігаємо.</p>
  <div class="radios"><label><input type="radio" name="category" value="" ${!u.category ? 'checked' : ''}>Не належу до пільгових категорій</label>
  ${Object.entries(GROUPS).map(([k, n]) => `<label><input type="radio" name="category" value="${k}" ${u.category === k ? 'checked' : ''}>${n}</label>`).join('')}</div>
  <label class="check"><input type="checkbox" name="consent" ${u.consent_at ? 'checked' : ''}><span>Погоджуюсь, що Їжак зберігає моє ім’я, телефон і пільгову категорію, щоб продавець міг видати мені набір. Копії документів не зберігаються.</span></label>` : ''}
  <button class="btn wide">${first ? 'Готово' : 'Зберегти'}</button></form>`;
}

const FS = [['', 'Звичайний'], ['1', 'Великий'], ['2', 'Найбільший']];
const fsNow = () => localStorage.getItem('yizhak.fs') || '';
// Коротко: хто що може і як забрати набір. Кнопка запускає живий показ.
function howTo(role) {
  if (role !== 'shop' && role !== 'buyer') return '';
  const steps = role === 'shop'
    ? ['<b>Новий набір</b>: увечері сфотографуйте залишки, оберіть ціну й час.', '<b>Покупець бронює</b> і отримує код із 4 цифр.', '<b>Видача</b>: введіть код, візьміть оплату на касі, натисніть «Видати».']
    : ['У вкладці <b>«Набори»</b> оберіть набір їжі поруч.', 'Натисніть <b>«Забронювати»</b>, і отримаєте код із 4 цифр.', 'Прийдіть у магазин у вказаний час, <b>покажіть код</b>, оплатіть на касі й заберіть.'];
  return `<div class="card howto"><h3 style="margin:0 0 8px">Як це працює</h3>
  <ol>${steps.map(t => `<li>${t}</li>`).join('')}</ol>
  ${role === 'shop' ? '' : '<p class="meta" style="margin:0 0 12px"><b>Безкоштовні набори</b> для пенсіонерів, людей з інвалідністю, переселенців (ВПО), сиріт і багатодітних. Оберіть свою категорію нижче й візьміть посвідчення в магазин.</p>'}
  <button class="btn wide" data-act="tour">Показати, куди натискати</button></div>`;
}
const tourOffer = () => localStorage.getItem('yizhak.tourSeen') ? '' : `<div class="card tour-offer"><b>Вперше тут?</b><p class="meta" style="margin:2px 0 10px">Покажемо на екрані, куди натискати. Це хвилина.</p>
  <div class="two"><button class="btn" data-act="tour">Показати</button><button class="btn ghost" data-act="tourno">Не треба</button></div></div>`;
V.profile = async () => {
  const u = st.user, s = u.role === 'shop' ? await api.myShop() : null;
  return `<h2>Профіль</h2><p class="sub">${esc(u.phone)} · ${u.role === 'shop' ? 'підприємство' : 'покупець'}</p>
  ${s ? `<div class="card"><div class="row"><b>${esc(s.name)}</b><a class="btn small ghost" href="#/shop-setup">Змінити</a></div><div class="meta">${esc(s.type)} · ${esc(s.city)}, ${esc(s.address)}</div></div>` : ''}
  <div class="label" style="margin:4px 0 8px">Розмір тексту</div>
  <div class="seg fs-seg" id="fs-seg" role="group" aria-label="Розмір тексту">${FS.map(([v, l], k) => `<button class="${fsNow() === v ? 'on' : ''}" data-act="fontsize" data-v="${v}" aria-pressed="${fsNow() === v}"><span style="font-size:${15 + k * 4}px">Аа</span>${l}</button>`).join('')}</div>
  ${howTo(u.role)}
  ${profileForm(false)}
  <div class="stack" style="margin-top:16px"><button class="btn ghost wide" data-act="logout">Вийти</button>
  ${api.mode === 'local' ? `<button class="btn alt wide" data-act="seed">Додати демо-магазини і набори (${esc(u.city || 'Київ')})</button>
  <button class="btn danger wide" data-act="reset">Очистити всі тестові дані</button>` : ''}</div>`;
};

// ----- покупець -----
V.feed = async () => {
  const all = await api.listOffers({ city: st.user.city });
  const list = all.filter(o => st.cat === 'all' || (st.cat === 'free' ? o.free : st.cat === 'halal' ? o.halal : o.category === st.cat));
  const chips = [['all', 'Усе'], ['free', 'Безкоштовно'], ...Object.entries(CATS), ['halal', 'Халяль']];
  st.mapOffers = list;
  return `${tourOffer()}<h2>Поруч із вами</h2><p class="sub">${esc(st.user.city)} · ціна остаточна, оплата в магазині</p>
  <div class="seg"><button class="${st.view === 'list' ? 'on' : ''}" data-act="view" data-v="list">Список</button><button class="${st.view === 'map' ? 'on' : ''}" data-act="view" data-v="map">Мапа</button></div>
  <div class="chips">${chips.map(([k, n]) => `<button class="chip ${st.cat === k ? 'on' : ''}" data-act="cat" data-c="${k}">${n}</button>`).join('')}</div>
  ${st.view === 'map' ? '<div id="map" role="region" aria-label="Мапа магазинів"></div>' : ''}
  ${list.length ? `<div class="list">${list.map(offerCard).join('')}</div>` : `<div class="card empty">${ic.box}<p><b>Поки що тут порожньо</b></p>
    <p class="meta">У місті ${esc(st.user.city)} ще немає активних наборів${st.cat !== 'all' ? ' у цій категорії' : ''}. Магазини викладають їх ближче до вечора.</p>
    ${api.mode === 'local' ? `<button class="btn alt" style="margin-top:12px" data-act="seed">Додати демо-набори для тесту</button>` : ''}</div>`}`;
};

const priceHtml = o => o.free ? `<b>Безкоштовно</b>` : `<b>${money(o.price)}</b><s>${money(o.old_price)}</s>`;
function offerCard(o) {
  return `<a class="card offer" href="#/offer/${o.id}" style="margin:0">${thumb(o)}
  <div class="body"><div class="t">${esc(o.title)}</div><div class="s">${esc(o.shop.name)}</div>
  <div class="wh">${ic.clock}<span>${when(o.pickup_from, o.pickup_to)}</span></div>
  <div class="price">${priceHtml(o)}${o.free ? '<span class="pill brown">для пільговиків</span>' : ''}${o.halal ? '<span class="pill brown">халяль</span>' : ''}</div>
  <div class="left">${o.qty_left === 1 ? 'Залишився 1 набір' : `Залишилось наборів: ${o.qty_left}`}</div></div></a>`;
}

V.offer = async id => {
  const o = await api.getOffer(id);
  if (!o) return `${back('feed')}<div class="card empty"><p><b>Набір не знайдено</b></p><p class="meta">Можливо, його вже розібрали.</p></div>`;
  const ok = o.status === 'active' && o.qty_left > 0;
  return `${back('feed', 'До наборів')}${thumb(o, 'photo')}
  <div class="row"><h2 style="margin:0">${esc(o.title)}</h2></div>
  <div class="price" style="margin:6px 0 10px">${priceHtml(o)}${!o.free ? `<span class="pill">−${Math.round((1 - o.price / o.old_price) * 100)}%</span>` : ''}${o.halal ? '<span class="pill brown">халяль</span>' : ''}</div>
  ${o.description ? `<p style="margin:0 0 12px">${esc(o.description)}</p>` : ''}
  <div class="card"><div class="label">Де і коли забрати</div><p style="margin:6px 0 2px"><b>${esc(o.shop.name)}</b></p>
  <div class="meta" style="margin:0">${esc(o.shop.city)}, ${esc(o.shop.address)}</div>
  <p style="margin:8px 0 0">${when(o.pickup_from, o.pickup_to)} · залишилось ${o.qty_left} з ${o.qty_total}</p>
  <a class="btn ghost wide" style="margin-top:12px" href="${mapsUrl(o.shop)}" target="_blank" rel="noopener">${ic.route}Маршрут у Google Maps</a></div>
  <div class="notice">${o.free ? `<b>Безкоштовний набір</b> для пільгових категорій. При отриманні покажіть код і документ: ${Object.values(GROUP_DOCS).join(', ')}.`
    : `<b>Оплата в магазині</b> при отриманні, готівкою або карткою. Ціна остаточна, без доплат.`}</div>
  <button class="btn wide" data-act="reserve" data-id="${o.id}" ${ok ? '' : 'disabled'}>${ok ? 'Забронювати' : 'Набори закінчились'}</button>`;
};

V.my = async () => {
  const rs = await api.myReservations();
  const act = rs.filter(r => r.status === 'reserved'), done = rs.filter(r => r.status !== 'reserved');
  return `<h2>Мої броні</h2><p class="sub">Покажіть код продавцю, і він видасть набір.</p>
  ${act.length ? act.map(r => `<div class="card"><div class="row"><b>${esc(r.title)}</b>${r.free ? '<span class="pill brown">безкоштовно</span>' : `<span class="pill">${money(r.price)} в магазині</span>`}</div>
    <p class="code-cap">Покажіть цей код продавцю</p>
    <div class="code" aria-label="Код видачі ${r.code.split('').join(' ')}">${r.code}</div>
    <p class="meta" style="text-align:center;margin:0 0 10px">${r.shop ? `${esc(r.shop.name)}, ${esc(r.shop.address)}` : ''}<br>Забрати ${r.offer ? when(r.offer.pickup_from, r.offer.pickup_to) : ''}</p>
    ${r.free && st.user.category ? `<p class="meta" style="text-align:center;margin:0 0 10px">Візьміть із собою: ${GROUP_DOCS[st.user.category]}</p>` : ''}
    <div class="stack">${r.shop ? `<a class="btn ghost wide" href="${mapsUrl(r.shop)}" target="_blank" rel="noopener">${ic.route}Як дійти</a>` : ''}<button class="btn danger small wide" data-act="cancel" data-id="${r.id}">Скасувати бронь</button></div></div>`).join('')
    : `<div class="card empty">${ic.ticket}<p><b>Активних броней немає</b></p><p class="meta">Оберіть набір у вкладці «Набори».</p></div>`}
  ${done.length ? `<div class="label" style="margin:16px 0 8px">Історія</div><div class="list">${done.map(histCard).join('')}</div>` : ''}`;
};

function histCard(r) {
  const s = { picked: ['Отримано', ''], cancelled: ['Скасовано', 'gray'], expired: ['Не забрали вчасно', 'red'] }[r.status] || [r.status, 'gray'];
  const pick = st.stars[r.id] || 0;
  return `<div class="card" style="margin:0"><div class="row"><b>${esc(r.title)}</b><span class="pill ${s[1]}">${s[0]}</span></div>
  <div class="meta">${r.shop ? esc(r.shop.name) : ''} · ${r.free ? 'безкоштовно' : money(r.price)}</div>
  ${r.status === 'picked' && !r.rating ? `<div class="stars" role="group" aria-label="Оцінка">${[1, 2, 3, 4, 5].map(n => `<button class="${n <= pick ? 'on' : ''}" data-act="star" data-id="${r.id}" data-n="${n}" aria-label="${n} з 5">★</button>`).join('')}</div>
    <form data-form="review" data-id="${r.id}"><div class="field"><label for="rv-${r.id}">Відгук (необов’язково)</label><textarea id="rv-${r.id}" name="text" rows="2" placeholder="Чи все було свіже?"></textarea></div>
    <button class="btn alt small">Надіслати відгук</button></form>` : ''}
  ${r.rating ? `<p class="meta">Ваша оцінка: ${'★'.repeat(r.rating)}${'☆'.repeat(5 - r.rating)}${r.review ? ` · «${esc(r.review)}»` : ''}</p>` : ''}</div>`;
}

// ----- магазин -----
V['shop-setup'] = async () => {
  const s = await api.myShop() || {};
  return `${s.id ? back('shop') : ''}<h2>${s.id ? 'Дані закладу' : 'Реєстрація закладу'}</h2><p class="sub">Покупці побачать назву й адресу на мапі.</p>
  <form data-form="shop" novalidate>${shopFields({ ...s, phone: s.phone || st.user.phone })}
  <button class="btn wide">${s.id ? 'Зберегти' : 'Зареєструвати заклад'}</button></form>
  ${s.id ? `<a class="btn ghost wide" style="margin-top:10px" href="#/shop-place">Поправити точку на мапі</a>` : ''}`;
};

V['shop-place'] = async (first) => {
  const s = await api.myShop();
  return `${first ? '' : back('shop')}<h2>${first ? 'Заклад зареєстровано!' : 'Точка на мапі'}</h2>
  <p class="sub">${esc(s.address)}, ${esc(s.city)}</p>
  ${s.geo_exact ? '' : `<div class="notice"><b>Будинок на мапі не знайшли точно.</b> Точка стоїть приблизно. Натисніть на мапі, де саме ваш заклад.</div>`}
  <p class="meta" style="margin:0 0 8px">Перевірте, чи стоїть їжачок на вашому закладі. Якщо ні, натисніть на мапі в потрібному місці або перетягніть його.</p>
  <div id="map" data-place style="height:320px"></div>
  <a id="gm-check" class="btn ghost wide" target="_blank" rel="noopener" href="${gmPoint(s.lat, s.lng)}">Перевірити в Google Maps ↗</a>
  <button class="btn wide" style="margin-top:10px" data-act="placeok">Точка правильна</button>`;
};
const gmPoint = (lat, lng) => `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
V.shop = async () => {
  const s = await api.myShop(), offers = await api.shopOffers(), rs = await api.shopReservations(), set = await api.getSettings();
  const picked = rs.filter(r => r.status === 'picked'), paid = picked.filter(r => !r.free);
  const rev = paid.reduce((a, r) => a + r.price, 0), fee = set.commissionOn ? Math.round(rev * set.rate / 100) : 0;
  const live = offers.filter(o => o.status === 'active'), waiting = rs.filter(r => r.status === 'reserved');
  return `${tourOffer()}<h2>${esc(s.name)}</h2><p class="sub">${esc(s.city)}, ${esc(s.address)}</p>
  <div class="card hero"><div class="label">Отримано замість списання</div><div class="big">${money(rev - fee)}</div>
  <p class="meta" style="margin:4px 0 0">${set.commissionOn ? `Комісія сервісу ${set.rate}%: ${money(fee)}` : 'Комісія сервісу 0%: пілотний період'}</p></div>
  <div class="split"><div class="card"><div class="label">Врятовано</div><div class="big">${kg(picked.reduce((a, r) => a + r.weight_kg, 0))}</div></div>
  <div class="card"><div class="label">Видано</div><div class="big">${picked.length}</div><div class="meta">з них безкоштовно ${picked.length - paid.length}</div></div></div>
  <div class="row" style="margin:6px 0 8px"><div class="label">Чекають на видачу · ${waiting.length}</div><a class="btn small" href="#/shop-check">Видати за кодом</a></div>
  ${waiting.length ? `<div class="list">${waiting.map(r => `<div class="card" style="margin:0"><div class="row"><b>${esc(r.buyer_name)}</b>${r.free ? '<span class="pill brown">безкоштовно</span>' : `<span class="pill">${money(r.price)}</span>`}</div><div class="meta">${esc(r.title)}</div></div>`).join('')}</div>` : '<p class="meta" style="margin:0 0 14px">Поки ніхто не чекає.</p>'}
  <div class="row" style="margin:6px 0 8px"><div class="label">Активні набори · ${live.length}</div><a class="btn small alt" href="#/shop-new">${ic.add}Новий</a></div>
  ${live.length ? `<div class="list">${live.map(o => { const sold = o.qty_total - o.qty_left; return `<div class="card" style="margin:0"><div class="row"><b>${esc(o.title)}</b><span class="pill ${o.free ? 'brown' : ''}">${o.free ? 'безкоштовно' : money(o.price)}</span></div>
    <div class="bar"><span style="width:${sold / o.qty_total * 100}%"></span></div>
    <div class="row"><span class="meta" style="margin:0">Заброньовано ${sold} з ${o.qty_total} · ${when(o.pickup_from, o.pickup_to)}</span><button class="btn small danger" data-act="close" data-id="${o.id}">Зняти</button></div></div>`; }).join('')}</div>`
    : `<div class="card empty">${ic.box}<p><b>Немає активних наборів</b></p><p class="meta">Викладіть те, що не встигнете продати сьогодні.</p></div>`}`;
};

// ----- час видачі: день, початок (кожні 30 хв), тривалість -----
const SLOTS = Array.from({ length: 32 }, (_, i) => 7 * 60 + i * 30); // 07:00 … 22:30
const DURS = [60, 90, 120, 180];
const hhmm = m => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
const toMin = t => { const [h, m] = String(t).split(':'); return +h * 60 + (+m || 0); };
const nowMin = () => { const d = new Date(); return d.getHours() * 60 + d.getMinutes(); };
const slotOk = (day, m) => day === 'tomorrow' || m + 30 > nowMin(); // поточне півгодинне вікно ще можна
const durOk = (from, d) => from + d <= 24 * 60 - 1;
const durLabel = d => d % 60 ? `${Math.floor(d / 60)},5 год` : `${d / 60} год`;
const dayDate = day => { const d = new Date(); if (day === 'tomorrow') d.setDate(d.getDate() + 1); return d; };
const fmtDay = day => dayDate(day).toLocaleDateString('uk-UA', { weekday: 'short', day: 'numeric', month: 'long' });
function fixWhen(n) {
  if (!slotOk(n.day, toMin(n.from))) { const f = SLOTS.find(m => slotOk(n.day, m)); if (f == null) { n.day = 'tomorrow'; n.from = '18:00'; } else n.from = hhmm(f); }
  if (!durOk(toMin(n.from), n.dur)) n.dur = DURS.filter(d => durOk(toMin(n.from), d)).pop() || 30;
  n.to = hhmm(Math.min(toMin(n.from) + n.dur, 24 * 60 - 1));
}
function newOfferState() {
  const start = Math.min(Math.max(Math.ceil((nowMin() + 1) / 30) * 30, 7 * 60), 22 * 60 + 30);
  return { photo: null, title: '', description: '', category: 'bake', old_price: '', mode: '50', price: '', qty: 3, weight_kg: 1.5, day: 'today', from: hhmm(start), dur: 120, halal: false };
}
function whenPicker(n) {
  fixWhen(n); const from = toMin(n.from);
  return `<div class="label" style="margin:4px 0 8px">Коли забрати</div>
  <div class="when">
  <div class="seg" role="group" aria-label="День видачі">${['today', 'tomorrow'].map(d => `<button type="button" class="${n.day === d ? 'on' : ''}" data-act="wday" data-d="${d}" aria-pressed="${n.day === d}">${d === 'today' ? 'Сьогодні' : 'Завтра'}<span class="sd">${dayDate(d).getDate()} ${dayDate(d).toLocaleDateString('uk-UA', { month: 'short' })}</span></button>`).join('')}</div>
  <div class="wlab">Початок видачі</div>
  <div class="slots" role="group" aria-label="Початок видачі">${SLOTS.filter(m => slotOk(n.day, m)).map(m => `<button type="button" class="slot${m === from ? ' on' : ''}" data-act="wfrom" data-m="${m}" aria-pressed="${m === from}">${hhmm(m)}</button>`).join('')}</div>
  <div class="wlab">Скільки часу чекаєте</div>
  <div class="durs" role="group" aria-label="Тривалість">${DURS.map(d => `<button type="button" class="${d === n.dur ? 'on' : ''}" data-act="wdur" data-d="${d}" ${durOk(from, d) ? '' : 'disabled'} aria-pressed="${d === n.dur}"><b>${durLabel(d)}</b><span>до ${hhmm(Math.min(from + d, 1439))}</span></button>`).join('')}</div>
  <div class="wsum">${ic.clock}<span>${n.day === 'today' ? 'Сьогодні' : 'Завтра'}, ${fmtDay(n.day)}<br><b>${n.from} – ${n.to}</b></span></div>
  </div>`;
}
V['shop-new'] = async () => {
  const s = await api.myShop(); const n = st.nf ||= newOfferState();
  const old = Number(n.old_price) || 0, auto = m => Math.round(old * (1 - m / 100));
  const price = n.mode === 'free' ? 0 : n.mode === 'own' ? Number(n.price) || 0 : auto(+n.mode);
  return `${back('shop')}<h2>Новий набір</h2><p class="sub">Сфотографуйте продукти й коротко опишіть. Точність не обов’язкова.</p>
  <form data-form="offer" novalidate>
  <div class="field"><label for="o-photo">Фото</label>
  ${n.photo ? `<img class="photo" src="${n.photo}" alt="Фото набору">` : ''}
  <label class="btn ghost wide" for="o-photo" style="cursor:pointer">${ic.camera}${n.photo ? 'Змінити фото' : 'Зробити або вибрати фото'}</label>
  <input id="o-photo" type="file" accept="image/*" capture="environment" class="sr"></div>
  <div class="field"><label for="o-title">Назва</label><input id="o-title" name="title" type="text" maxlength="80" value="${esc(n.title)}" placeholder="Набір «Хлібний вечір»"></div>
  <div class="field"><label for="o-desc">Що всередині</label><textarea id="o-desc" name="description" rows="3" maxlength="600" placeholder="Хліб, батон, 5 булочок. Спечено сьогодні.">${esc(n.description)}</textarea></div>
  <div class="field"><label for="o-cat">Категорія</label><select id="o-cat" name="category">${Object.entries(CATS).map(([k, v]) => `<option value="${k}" ${k === n.category ? 'selected' : ''}>${v}</option>`).join('')}</select></div>
  <div class="field"><label for="o-old">Звичайна вартість продуктів, ₴</label><input id="o-old" name="old_price" type="number" inputmode="numeric" min="1" value="${esc(n.old_price)}" placeholder="1000"><span class="hint">Приблизна сума, якби покупець купував усе за звичайною ціною.</span></div>
  <div class="label" style="margin:0 0 8px">Ціна для покупця</div>
  <div class="modes">${['30', '50', '70'].map(m => `<button type="button" class="${n.mode === m ? 'on' : ''}" data-act="mode" data-m="${m}">−${m}%${old ? `<br><span class="meta">${money(auto(+m))}</span>` : ''}</button>`).join('')}
  <button type="button" class="${n.mode === 'own' ? 'on' : ''}" data-act="mode" data-m="own">Своя ціна</button>
  <button type="button" class="${n.mode === 'free' ? 'on' : ''}" data-act="mode" data-m="free" style="grid-column:span 2">Безкоштовно пільговикам</button></div>
  ${n.mode === 'own' ? `<div class="field"><label for="o-price">Ваша ціна, ₴</label><input id="o-price" name="price" type="number" inputmode="numeric" min="1" value="${esc(n.price)}"></div>` : ''}
  <p class="meta" style="margin:-4px 0 12px">Покупець заплатить у магазині: <b>${n.mode === 'free' ? 'безкоштовно' : money(price)}</b>. Комісія сервісу зараз 0%.</p>
  <div class="two"><div class="field"><label for="o-qty">Скільки наборів</label><input id="o-qty" name="qty" type="number" inputmode="numeric" min="1" max="200" value="${esc(n.qty)}"></div>
  <div class="field"><label for="o-kg">Вага одного, кг</label><input id="o-kg" name="weight_kg" type="number" inputmode="decimal" min="0.1" step="0.1" value="${esc(n.weight_kg)}"></div></div>
  ${whenPicker(n)}
  ${s.halal ? `<label class="check"><input type="checkbox" name="halal" ${n.halal ? 'checked' : ''}><span><b>Халяль</b>: товар має сертифікат</span></label>` : ''}
  <button class="btn wide">Опублікувати</button></form>`;
};

V['shop-check'] = () => {
  const r = st.found;
  return `${back('shop')}<h2>Видача за кодом</h2><p class="sub">Попросіть у покупця 4-значний код з його телефону.</p>
  <form data-form="code" novalidate><div class="field"><label for="c-code">Код видачі</label>
  <input id="c-code" name="code" type="text" inputmode="numeric" maxlength="4" autocomplete="off" style="font-size:28px;letter-spacing:.3em;text-align:center"></div>
  <button class="btn wide">Перевірити</button></form>
  ${r ? `<div class="card" style="margin-top:14px"><div class="row"><b>${esc(r.title)}</b>${r.free ? '<span class="pill brown">безкоштовно</span>' : `<span class="pill">до оплати ${money(r.price)}</span>`}</div>
    <p style="margin:8px 0 0">Покупець: <b>${esc(r.buyer_name)}</b></p>
    ${r.free ? `<div class="notice" style="margin-top:10px"><b>Перевірте документ:</b> ${GROUPS[r.buyer_category] || 'пільгова категорія'}, ${GROUP_DOCS[r.buyer_category] || 'посвідчення'}. Лише подивіться, не копіюйте.</div>`
      : `<p class="meta">Спершу прийміть оплату ${money(r.price)} готівкою або карткою, потім видайте набір.</p>`}
    <button class="btn wide" style="margin-top:10px" data-act="issue" data-id="${r.id}">${r.free ? 'Документ перевірено, видати' : 'Оплачено, видати набір'}</button></div>` : ''}`;
};

// ----- власник -----
V['owner-lock'] = () => api.mode === 'server' ? `${back('', 'На головну')}<div class="card empty" style="margin-top:8px">${ic.lock.replace('<svg', '<svg width="40" height="40"')}<h2>Доступ лише для власника</h2><p class="meta">Цей розділ відкривається тільки акаунту з роллю власника сервісу.</p></div>` : `${back('', 'Вийти')}<div class="card" style="margin-top:8px;text-align:center"><div style="color:var(--green);display:flex;justify-content:center">${ic.lock.replace('<svg', '<svg width="40" height="40"')}</div>
  <h2>Вхід власника</h2><p class="meta">Цей розділ бачить лише власник сервісу.</p>
  <form data-form="pin" novalidate style="text-align:left;margin-top:12px"><div class="field"><label for="f-pin">PIN-код</label><input id="f-pin" name="pin" type="password" inputmode="numeric" autocomplete="off" maxlength="8"></div>
  <button class="btn wide">Увійти</button></form></div>`;

const GOALS = { kg: ['кг врятованої їжі', s => s.kg], orders: ['виданих наборів', s => s.orders], shops: ['магазинів-партнерів', s => s.shops], buyers: ['покупців', s => s.buyers] };
async function goalBlock(s) {
  const set = await api.getSettings(), [label, fn] = GOALS[set.goalType] || GOALS.kg;
  const cur = fn(s), pct = Math.min(100, cur / set.goalValue * 100), reached = cur >= set.goalValue;
  return { set, reached, html: `<div class="card"><div class="row"><div class="label">Мета до запуску комісії</div><span class="pill ${reached ? '' : 'brown'}">${reached ? 'досягнуто' : 'у процесі'}</span></div>
  <div class="big" style="margin-top:6px">${set.goalType === 'kg' ? (Math.round(cur * 10) / 10).toLocaleString('uk-UA') : num(cur)} <span class="muted" style="font-size:16px">з ${num(set.goalValue)} ${label}</span></div>
  <div class="bar"><span style="width:${pct}%"></span></div>
  <p class="meta">${set.commissionOn ? `Комісія ${set.rate}% увімкнена.` : reached ? 'Мету досягнуто. Комісію можна вмикати у вкладці «Мета».' : 'Поки мету не досягнуто, сервіс працює без комісії.'}</p></div>` };
}

V.owner = async () => {
  const s = await api.stats(), g = await goalBlock(s);
  const cities = Object.entries(s.byCity).sort((a, b) => b[1].kg - a[1].kg);
  return `<h2>Облік власника</h2><p class="sub">${s.shops} магазинів · ${s.buyers} покупців · ${s.offersLive} активних наборів</p>
  <div class="card hero"><div class="label">Врятовано їжі</div><div class="big">${kg(s.kg)}</div><p class="meta" style="margin:4px 0 0">Їжа, яка інакше пішла б на смітник.</p></div>
  <div class="split"><div class="card"><div class="label">Заощаджено людям</div><div class="big">${money(s.saved)}</div></div>
  <div class="card"><div class="label">Видано наборів</div><div class="big">${num(s.orders)}</div><div class="meta">безкоштовно ${num(s.freeOrders)}</div></div></div>
  <div class="split"><div class="card"><div class="label">Оборот магазинів</div><div class="big">${money(s.turnover)}</div></div>
  <div class="card"><div class="label">Пільговиків</div><div class="big">${num(s.vulnerable)}</div><div class="meta">зареєстровано</div></div></div>
  ${g.html}
  ${cities.length ? `<div class="card"><div class="label" style="margin-bottom:4px">По містах</div><table class="tbl"><tr><th>Місто</th><th>Магазини</th><th>Видано</th><th>Кг</th></tr>
  ${cities.map(([c, v]) => `<tr><td>${esc(c)}</td><td>${v.shops}</td><td>${v.orders}</td><td>${num(v.kg)}</td></tr>`).join('')}</table></div>` : ''}
  ${api.mode === 'local' ? '<button class="btn ghost wide" data-act="ownerout">Вийти з кабінету власника</button>' : ''}`;
};

V['owner-goal'] = async () => {
  const s = await api.stats(), g = await goalBlock(s), set = g.set;
  return `<h2>Мета і комісія</h2><p class="sub">Спочатку ростемо без комісії. Коли досягнемо мети, вирішуєте ви, чи вмикати її.</p>${g.html}
  <form data-form="goal" novalidate><div class="field"><label for="g-type">Що рахуємо</label><select id="g-type" name="goalType">
  ${Object.entries(GOALS).map(([k, [l]]) => `<option value="${k}" ${k === set.goalType ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
  <div class="two"><div class="field"><label for="g-val">Мета</label><input id="g-val" name="goalValue" type="number" min="1" value="${set.goalValue}"></div>
  <div class="field"><label for="g-rate">Комісія після мети, %</label><input id="g-rate" name="rate" type="number" min="0" max="30" value="${set.rate}"></div></div>
  <label class="check"><input type="checkbox" name="commissionOn" ${set.commissionOn ? 'checked' : ''} ${g.reached || set.commissionOn ? '' : 'disabled'}>
  <span><b>Увімкнути комісію</b><br><span class="meta">${g.reached ? 'Комісія вже в ціні, магазин побачить її у своєму кабінеті.' : 'Стане доступно, коли мету буде досягнуто.'}</span></span></label>
  <button class="btn wide">Зберегти</button></form>`;
};

V.notfound = () => `<div class="card empty"><p><b>Сторінку не знайдено</b></p><a class="btn" href="#/">На головну</a></div>`;

// ---------- мапа (Leaflet + OpenStreetMap, без ключів) ----------
let leafletP = null;
function loadLeaflet() {
  if (window.L) return Promise.resolve();
  return leafletP ||= new Promise((res, rej) => {
    const css = document.createElement('link'); css.rel = 'stylesheet'; css.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'; document.head.appendChild(css);
    const js = document.createElement('script'); js.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'; js.onload = res; js.onerror = () => rej(new Error('map')); document.head.appendChild(js);
  });
}
let placePt = null;
async function drawPlace() {
  const el = $('#map[data-place]'); if (!el) return;
  try { await loadLeaflet(); } catch { el.innerHTML = '<p class="meta" style="padding:16px">Мапа не завантажилась. Перевірте інтернет.</p>'; return; }
  const s = await api.myShop(); placePt = [s.lat, s.lng];
  const m = L.map(el).setView(placePt, s.geo_exact ? 17 : 13);
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap' }).addTo(m);
  const icon = L.divIcon({ className: '', html: `<span class="mpin" style="background:var(--green)">${pic('bake', 18)}</span>`, iconSize: [34, 34], iconAnchor: [17, 17] });
  const mk = L.marker(placePt, { icon, draggable: true }).addTo(m);
  const set = ll => { placePt = [+ll.lat.toFixed(6), +ll.lng.toFixed(6)]; mk.setLatLng(ll); const a = $('#gm-check'); if (a) a.href = gmPoint(...placePt); };
  mk.on('dragend', () => set(mk.getLatLng()));
  m.on('click', e => set(e.latlng));
}
async function drawMap() {
  const el = $('#map'); if (!el) return;
  try { await loadLeaflet(); } catch { el.innerHTML = '<p class="meta" style="padding:16px">Мапа не завантажилась. Перевірте інтернет.</p>'; return; }
  const c = CITIES[st.user.city] || CITIES['Київ'];
  const m = L.map(el, { zoomControl: true }).setView(c, 13);
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap' }).addTo(m);
  const byShop = new Map();
  for (const o of st.mapOffers || []) if (o.shop?.lat) (byShop.get(o.shop.id) || byShop.set(o.shop.id, { s: o.shop, os: [] }).get(o.shop.id)).os.push(o);
  const pts = [];
  for (const { s, os } of byShop.values()) {
    const [k, col] = catLook(os[0].category);
    const icon = L.divIcon({ className: '', html: `<span class="mpin" style="background:${col}">${pic(k, 18)}</span>`, iconSize: [34, 34], iconAnchor: [17, 17] });
    L.marker([s.lat, s.lng], { icon, title: s.name }).addTo(m).bindPopup(`<b>${esc(s.name)}</b><br>${esc(s.address)}<br>${os.map(o => `<a href="#/offer/${o.id}">${esc(o.title)}</a> · ${o.free ? 'безкоштовно' : money(o.price)}`).join('<br>')}<br><a href="${mapsUrl(s)}" target="_blank" rel="noopener">Маршрут у Google Maps ↗</a>`);
    pts.push([s.lat, s.lng]);
  }
  if (pts.length > 1) m.fitBounds(pts, { padding: [30, 30], maxZoom: 15 });
}

// ---------- рамка: шапка, навігація, маршрутизація ----------
const NAV = {
  buyer: [['feed', 'Набори', ic.home], ['my', 'Мої', ic.ticket], ['profile', 'Профіль', ic.me]],
  shop: [['shop', 'Зведення', ic.chart], ['shop-new', 'Новий набір', ic.add], ['shop-check', 'Видача', ic.box], ['profile', 'Профіль', ic.me]],
  owner: [['owner', 'Облік', ic.chart], ['owner-goal', 'Мета', ic.flag], ['profile', 'Профіль', ic.me]],
};
const ROLE_ROUTES = { buyer: ['feed', 'offer', 'my', 'onboard', 'profile'], shop: ['shop', 'shop-new', 'shop-check', 'shop-setup', 'shop-place', 'profile'], owner: ['profile'], registrar: ['profile'] };

async function resolve(route) {
  const u = st.user = await api.me();
  if (api.mode === 'server') st.ownerOk = u?.role === 'owner';
  if (route.startsWith('owner')) return st.ownerOk ? (route === 'owner-lock' ? 'owner' : route) : 'owner-lock';
  if (!u) return route === 'login' ? 'login' : '';
  if (u.role === 'buyer' && !u.city) return 'onboard';
  if (u.role === 'shop' && !(await api.myShop())) return 'shop-setup';
  const home = u.role === 'shop' ? 'shop' : u.role === 'owner' ? 'owner' : 'feed';
  if (route === '' || route === 'login' || (route === 'onboard' && u.city)) return home;
  return ROLE_ROUTES[u.role].includes(route) ? route : V[route] ? home : 'notfound';
}

let lastRoute = null, lastHash = '';
async function render() {
  const [raw = '', arg] = location.hash.replace(/^#\/?/, '').split('/');
  const route = await resolve(raw);
  if (route !== raw) { history.replaceState(null, '', '#/' + route); }
  let html;
  try { html = await V[route](arg); } catch (e) { html = `<div class="card empty"><p><b>Щось пішло не так</b></p><p class="meta">${esc(e.message)}</p></div>`; }
  const same = route === lastRoute && location.hash === lastHash, y = scrollY, sx = $('.slots')?.scrollLeft;
  const scr = $('#screen'); scr.innerHTML = html; lastRoute = route; lastHash = location.hash;
  if (same) { scrollTo(0, y); if (sx != null && $('.slots')) $('.slots').scrollLeft = sx; } else { scrollTo(0, 0); $('.slot.on')?.scrollIntoView({ block: 'nearest', inline: 'center' }); }
  const u = st.user, owner = route.startsWith('owner') && route !== 'owner-lock';
  $('#top').innerHTML = `<button class="brand" id="logo" aria-label="Їжак">${LOGO}Їжак</button>
    <span style="display:flex;gap:6px;align-items:center">${api.mode === 'local' ? '<span class="testbadge">тест</span>' : ''}${u && u.role === 'buyer' && u.city && !owner ? `<a class="city" href="#/profile">${esc(u.city)}</a>` : ''}</span>`;
  const items = owner ? NAV.owner : u && !['', 'login', 'onboard', 'owner-lock'].includes(route) && !(route === 'shop-setup' && !(await api.myShop())) ? NAV[u.role] || null : null;
  const nav = $('#nav'); nav.hidden = !items;
  nav.innerHTML = items ? items.map(([k, l, i]) => `<a href="#/${k}" class="${route === k || (route === 'offer' && k === 'feed') ? 'on' : ''}" ${route === k ? 'aria-current="page"' : ''}>${i}${l}</a>`).join('') : '';
  if (route === '' && !st.introDone) {
    const w = $('.welcome.intro'), h = w?.querySelector('.w-hero');
    if (h) { const q = h.getBoundingClientRect(); w.style.setProperty('--drop', Math.max(0, (innerHeight - q.height) / 2 - q.top) + 'px'); }
    st.introDone = true;
  }
  if (route === 'feed' && st.view === 'map') drawMap();
  if (route === 'shop-place') drawPlace();
  document.dispatchEvent(new CustomEvent('yz:rendered', { detail: route }));
}

// ---------- дії ----------
const run = fn => async (...a) => { try { await fn(...a); } catch (e) { toast(e.message); } };
const A = {
  pick: el => { st.role = el.dataset.role; go('login'); },
  view: el => { st.view = el.dataset.v; render(); },
  cat: el => { st.cat = el.dataset.c; render(); },
  seed: async () => { await api.seedDemo(st.user.city || 'Київ'); toast('Додано демо-магазини й набори.'); if (st.user.role === 'buyer') go('feed'); else render(); },
  reserve: async el => { const r = await api.reserve(el.dataset.id); toast(`Заброньовано. Ваш код: ${r.code}`); go('my'); },
  cancel: async el => { if (!confirm('Скасувати бронь?')) return; await api.cancel(el.dataset.id); toast('Бронь скасовано.'); render(); },
  star: el => { st.stars[el.dataset.id] = +el.dataset.n; render(); },
  close: async el => { if (!confirm('Зняти набір з продажу?')) return; await api.closeOffer(el.dataset.id); toast('Набір знято.'); render(); },
  mode: el => { saveNf(); st.nf.mode = el.dataset.m; render(); },
  fontsize: el => { if (el.dataset.v) localStorage.setItem('yizhak.fs', el.dataset.v); else localStorage.removeItem('yizhak.fs'); applyFs(); render(); },
  tour: async () => { const role = st.user?.role; let ctx = {};
    if (role === 'buyer') { const o = await api.listOffers({ city: st.user.city }); ctx.firstOffer = o.find(x => x.status === 'active' && x.qty_left > 0)?.id; }
    startTour(role === 'shop' ? SHOP_TOUR : BUYER_TOUR, { go, ctx, onEnd: render }); },
  tourno: () => { localStorage.setItem('yizhak.tourSeen', '1'); render(); },
  wday: el => { saveNf(); st.nf.day = el.dataset.d; render(); },
  wfrom: el => { saveNf(); st.nf.from = hhmm(+el.dataset.m); render(); },
  wdur: el => { saveNf(); st.nf.dur = +el.dataset.d; render(); },
  placeok: async () => { if (placePt) await api.setShopPoint(...placePt); toast('Готово. Тепер додайте перший набір.'); go('shop'); },
  issue: async el => { await api.issue(el.dataset.id); st.found = null; toast('Набір видано. Дякуємо!'); render(); },
  logout: async () => {
    if (api.mode === 'server' && !confirm('Акаунт пілоту не прив’язаний до пошти. Після виходу повернутися в нього не вийде, доведеться зареєструватися знову. Вийти?')) return;
    await api.signOut(); st.ownerOk = false; go('');
  },
  reset: async () => { if (!confirm('Видалити всі тестові дані на цьому пристрої?')) return; await api.resetAll(); st.nf = null; go(''); },
  ownerout: () => { st.ownerOk = false; go(''); toast('Ви вийшли з кабінету власника.'); },
};
function saveNf() {
  const f = document.querySelector('form[data-form="offer"]'); if (!f || !st.nf) return;
  const d = Object.fromEntries(new FormData(f));
  Object.assign(st.nf, d, { halal: !!d.halal });
}
let pinTries = 0, pinLock = 0;
const F = {
  login: async d => { await api.signIn({ ...d, role: st.role }); go(''); },
  profile: async d => {
    const cat = d.category || null;
    if (cat && !d.consent) throw new Error('Щоб отримувати безкоштовні набори, потрібна ваша згода.');
    await api.updateProfile({ ...(d.name ? { name: d.name } : {}), city: d.city, category: cat, consent_at: cat ? (st.user.consent_at || new Date().toISOString()) : null });
    toast('Збережено.'); go(st.user.role === 'shop' ? 'shop' : 'feed');
  },
  shop: async d => {
    const before = await api.myShop(), s = await api.saveShop({ ...d, halal: !!d.halal });
    if (!before || before.lat !== s.lat || before.lng !== s.lng) return go('shop-place');
    toast('Дані закладу збережено.'); go('shop');
  },
  shopjoin: async d => {
    for (const k of ['name', 'phone', 'address']) if (!String(d[k] || '').trim()) throw new Error('Заповніть назву, телефон і адресу.');
    const u = await api.signIn({ name: (d.contact || '').trim() || d.name, phone: d.phone, role: 'shop' });
    if (u.role !== 'shop') throw new Error('На цьому пристрої вже є інший акаунт Їжака. Зареєструйте заклад з телефона закладу.');
    await api.saveShop({ ...d, halal: !!d.halal });
    go('shop-place/1');
  },
  offer: async () => {
    saveNf(); const n = st.nf, old = Number(n.old_price); fixWhen(n);
    const base = new Date(); if (n.day === 'tomorrow') base.setDate(base.getDate() + 1);
    const at = hm => { const d = new Date(base); const [h, m] = String(hm).split(':'); d.setHours(+h, +m || 0, 0, 0); return d.toISOString(); };
    const price = n.mode === 'free' ? 0 : n.mode === 'own' ? Number(n.price) : Math.round(old * (1 - n.mode / 100));
    await api.createOffer({ title: n.title, description: n.description, category: n.category, photo: n.photo, old_price: old, price, free: n.mode === 'free',
      qty: Number(n.qty), weight_kg: Number(n.weight_kg), pickup_from: at(n.from), pickup_to: at(n.to), halal: n.halal });
    st.nf = null; toast('Опубліковано. Покупці поруч уже бачать набір.'); go('shop');
  },
  code: async d => { st.found = await api.findByCode(d.code); if (!st.found) toast('Активної броні з таким кодом немає. Перевірте цифри.'); render(); },
  review: async (d, f) => { await api.review(f.dataset.id, st.stars[f.dataset.id] || 0, d.text); toast('Дякуємо за відгук!'); render(); },
  pin: async d => {
    if (Date.now() < pinLock) throw new Error(`Забагато спроб. Зачекайте ${Math.ceil((pinLock - Date.now()) / 1000)} с.`);
    if (d.pin === CONFIG.OWNER_PIN_LOCAL) { st.ownerOk = true; pinTries = 0; return go('owner'); }
    if (++pinTries >= 3) { pinTries = 0; pinLock = Date.now() + 30000; throw new Error('Невірний PIN. Вхід заблоковано на 30 секунд.'); }
    throw new Error(`Невірний PIN. Залишилось спроб: ${3 - pinTries}.`);
  },
  goal: async d => {
    const s = await api.stats(), cur = (GOALS[d.goalType] || GOALS.kg)[1](s), on = !!d.commissionOn && cur >= Number(d.goalValue);
    await api.saveSettings({ goalType: d.goalType, goalValue: Math.max(1, Number(d.goalValue) || 1), rate: Math.min(30, Math.max(0, Number(d.rate) || 0)), commissionOn: on });
    toast('Збережено.'); render();
  },
};

document.addEventListener('click', e => {
  const el = e.target.closest('[data-act]'); if (el && A[el.dataset.act]) { e.preventDefault(); run(A[el.dataset.act])(el); }
});
document.addEventListener('submit', e => {
  const f = e.target.closest('form[data-form]'); if (!f || !F[f.dataset.form]) return;
  e.preventDefault(); const btn = f.querySelector('button:not([type=button])'); if (btn) btn.disabled = true;
  run(F[f.dataset.form])(Object.fromEntries(new FormData(f)), f).finally(() => { if (btn?.isConnected) btn.disabled = false; });
});
document.addEventListener('change', run(async e => {
  if (e.target.id === 'o-photo' && e.target.files[0]) { saveNf(); st.nf.photo = await resizeImage(e.target.files[0]); render(); }
  else if (e.target.closest('form[data-form="offer"]') && ['o-old', 'o-price'].includes(e.target.id)) { saveNf(); render(); }
}));
// Прихований вхід власника: 5 швидких натискань на логотип.
let taps = 0, tapT = 0;
document.addEventListener('click', e => {
  if (!e.target.closest('#logo')) return;
  const t = Date.now(); taps = t - tapT < 700 ? taps + 1 : 1; tapT = t;
  if (taps >= 5) { taps = 0; go(st.ownerOk ? 'owner' : 'owner-lock'); }
});
function applyFs() {
  if (localStorage.getItem('yizhak.big')) { localStorage.setItem('yizhak.fs', '1'); localStorage.removeItem('yizhak.big'); }
  const v = fsNow(), c = document.documentElement.classList;
  c.toggle('fs1', v === '1' || v === '2'); c.toggle('fs2', v === '2');
}
applyFs();
addEventListener('hashchange', render);
render();

if ('serviceWorker' in navigator && location.protocol !== 'file:') navigator.serviceWorker.register('sw.js').catch(() => {});
