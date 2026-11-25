// Живий показ: по черзі підсвічує справжні кнопки на екрані й коротко пояснює, що вони роблять.
// Нічого не натискає за людину, лише показує.

// Кроки для покупця. route може бути функцією (наприклад, відкрити перший набір зі стрічки).
export const BUYER_TOUR = [
  { route: 'feed', sel: '#nav a[href="#/feed"]', title: 'Набори', text: 'Тут усі набори їжі у вашому місті: зі знижкою або безкоштовно.' },
  { route: 'feed', sel: '.offer', alt: '.empty', title: 'Набір', text: 'Кожна картка — це набір: що всередині, у якому магазині, коли забрати і скільки коштує. Натисніть на картку, щоб побачити деталі.', altText: 'Коли магазини викладуть набори, вони з’являться тут. Зазвичай це ближче до вечора.' },
  { route: 'feed', sel: '.chip[data-c="free"]', title: 'Безкоштовно', text: 'Для пенсіонерів, людей з інвалідністю, сиріт і багатодітних. Натисніть, і залишаться лише безкоштовні набори.' },
  { route: 'feed', sel: '.seg [data-v="map"]', title: 'Мапа', text: 'Покаже магазини з наборами на мапі міста, щоб обрати найближчий.' },
  { route: ctx => ctx.firstOffer ? `offer/${ctx.firstOffer}` : null, sel: '[data-act="reserve"]', title: 'Забронювати', text: 'Натисніть, і набір відкладуть для вас. Ви одразу отримаєте код із 4 цифр.' },
  { route: ctx => ctx.firstOffer ? `offer/${ctx.firstOffer}` : null, sel: 'a[href*="google.com/maps"]', title: 'Як дійти', text: 'Відкриє маршрут до магазину в Google Maps.' },
  { route: 'my', sel: '#nav a[href="#/my"]', title: 'Мої броні', text: 'Тут ваш код. Прийдіть у магазин у вказаний час, покажіть код продавцю, оплатіть на касі й заберіть набір.' },
  { route: 'my', sel: '.code', alt: '.empty', title: 'Код', text: 'Ці 4 цифри покажіть продавцю. Для безкоштовного набору візьміть із собою посвідчення.', altText: 'Після бронювання тут з’явиться великий код із 4 цифр. Його ви покажете продавцю.' },
  { route: 'profile', sel: '#fs-seg', title: 'Розмір тексту', text: 'Якщо погано видно, оберіть «Великий» або «Найбільший».' },
  { route: 'profile', sel: '#p-city', title: 'Ваше місто', text: 'Тут можна змінити місто і пільгову категорію.' },
];

export const SHOP_TOUR = [
  { route: 'shop', sel: '.hero', title: 'Зведення', text: 'Скільки ви отримали замість списання і скільки наборів видали.' },
  { route: 'shop', sel: '#nav a[href="#/shop-new"]', title: 'Новий набір', text: 'Щовечора викладайте те, що не встигли продати. Це займає 2 хвилини.' },
  { route: 'shop-new', sel: 'label[for="o-photo"]', title: 'Фото', text: 'Сфотографуйте продукти. Покупцям так легше обрати.' },
  { route: 'shop-new', sel: '.modes', title: 'Ціна', text: 'Оберіть знижку або «Безкоштовно пільговикам». Ціну програма порахує сама.' },
  { route: 'shop-new', sel: '.when', title: 'Коли забрати', text: 'День, початок і скільки часу чекаєте покупців.' },
  { route: 'shop-check', sel: '#nav a[href="#/shop-check"]', title: 'Видача', text: 'Коли прийде покупець, відкрийте цю вкладку.' },
  { route: 'shop-check', sel: '#c-code', title: 'Код покупця', text: 'Покупець називає 4 цифри. Введіть їх і натисніть «Перевірити». Потім візьміть оплату на касі й натисніть «Видати».' },
  { route: 'profile', sel: '#fs-seg', title: 'Розмір тексту', text: 'Якщо погано видно, збільште текст.' },
];

let box = null;
const wait = ms => new Promise(r => setTimeout(r, ms));
async function waitFor(sel, ms = 2500) {
  const t = Date.now();
  while (Date.now() - t < ms) { const el = document.querySelector(sel); if (el) return el; await wait(80); }
  return null;
}

export async function startTour(steps, { go, ctx = {}, onEnd }) {
  stopTour();
  // кроки, яких на цьому пристрої показати не можна (немає наборів), пропускаємо
  const list = steps.filter(s => typeof s.route !== 'function' || s.route(ctx));
  let i = 0;
  box = document.createElement('div');
  box.className = 'tour'; box.setAttribute('role', 'dialog'); box.setAttribute('aria-modal', 'true'); box.setAttribute('aria-label', 'Як користуватися Їжаком');
  box.innerHTML = `<div class="tour-hole"></div><div class="tour-tip" aria-live="polite"></div>`;
  document.body.appendChild(box);
  const hole = box.querySelector('.tour-hole'), tip = box.querySelector('.tour-tip');
  let target = null;
  const place = () => {
    if (!target?.isConnected) { hole.style.cssText = 'left:50%;top:40%;width:0;height:0'; tip.style.top = '30%'; return; }
    const r = target.getBoundingClientRect(), pad = 6;
    hole.style.cssText = `left:${r.left - pad}px;top:${r.top - pad}px;width:${r.width + pad * 2}px;height:${r.height + pad * 2}px`;
    const below = r.bottom + 14, th = tip.offsetHeight;
    tip.style.top = (below + th < innerHeight - 8 ? below : Math.max(8, r.top - th - 14)) + 'px';
  };
  const show = async () => {
    const s = list[i], route = typeof s.route === 'function' ? s.route(ctx) : s.route;
    if (location.hash !== '#/' + route) {
      const done = new Promise(r => { document.addEventListener('yz:rendered', r, { once: true }); setTimeout(r, 4000); });
      go(route); await done;
    }
    let el = await waitFor(s.sel, 1500), text = s.text;
    if (!el && s.alt) { el = document.querySelector(s.alt); text = s.altText || text; }
    target = el;
    if (el) { el.scrollIntoView({ block: 'center', behavior: 'instant' }); await wait(60); }
    tip.innerHTML = `<div class="tour-n">Крок ${i + 1} з ${list.length}</div><b>${s.title}</b><p>${text}</p>
      <div class="tour-btns">${i ? '<button type="button" class="btn ghost" data-t="back">Назад</button>' : '<button type="button" class="btn ghost" data-t="stop">Закрити</button>'}
      <button type="button" class="btn" data-t="next">${i === list.length - 1 ? 'Зрозуміло' : 'Далі'}</button></div>`;
    place(); tip.querySelector('[data-t="next"]').focus({ preventScroll: true });
  };
  box.addEventListener('click', e => {
    const b = e.target.closest('[data-t]'); if (!b) return;
    e.stopPropagation();
    if (b.dataset.t === 'stop' || (b.dataset.t === 'next' && i === list.length - 1)) return stopTour(true);
    i += b.dataset.t === 'next' ? 1 : -1; show();
  });
  box._onEnd = onEnd;
  box._onResize = () => place();
  addEventListener('resize', box._onResize); addEventListener('scroll', box._onResize, true);
  box._onKey = e => { if (e.key === 'Escape') stopTour(true); };
  addEventListener('keydown', box._onKey);
  await show();
}

export function stopTour(done) {
  if (!box) return;
  removeEventListener('resize', box._onResize); removeEventListener('scroll', box._onResize, true); removeEventListener('keydown', box._onKey);
  const end = box._onEnd; box.remove(); box = null;
  if (done) localStorage.setItem('yizhak.tourSeen', '1');
  end?.();
}
