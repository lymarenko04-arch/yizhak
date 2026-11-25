// Спільні дрібниці інтерфейсу: екранування, формати, іконки, довідники.

export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const num = n => Math.round(Number(n) || 0).toLocaleString('uk-UA');
export const money = n => `${num(n)} ₴`;
export const kg = n => `${(Math.round((Number(n) || 0) * 10) / 10).toLocaleString('uk-UA')} кг`;

export function toast(msg, ms = 2800) {
  document.querySelector('.toast')?.remove();
  const d = document.createElement('div');
  d.className = 'toast'; d.setAttribute('role', 'status'); d.textContent = msg;
  document.body.appendChild(d);
  setTimeout(() => d.remove(), ms);
}

export const CATS = {
  bake: 'Випічка і хліб', dairy: 'Молочне', veg: 'Овочі й фрукти', ready: 'Готова їжа',
  meat: 'М’ясо й ковбаси', grocery: 'Бакалія', mix: 'Мікс-набір',
};
export const GROUPS = {
  pens: 'Пенсіонер', dis: 'Особа з інвалідністю', orph: 'Дитина-сирота (через опікуна)', big: 'Багатодітна сім’я',
};
export const GROUP_DOCS = {
  pens: 'пенсійне посвідчення', dis: 'посвідчення або довідка про інвалідність',
  orph: 'документ опікуна', big: 'посвідчення багатодітної сім’ї',
};
export const SHOP_TYPES = ['Пекарня', 'Супермаркет', 'Мінімаркет', 'Кафе / ресторан', 'Їдальня', 'Ринок', 'Ферма', 'М’ясна лавка', 'Кондитерська'];

const CAT_LOOK = {
  bake: ['bread', '#C98A3D'], dairy: ['milk', '#3D7F86'], veg: ['veg', '#4F9A45'], ready: ['bowl', '#C4613A'],
  meat: ['meat', '#7A4A24'], grocery: ['cart', '#8A6E3B'], mix: ['bag', '#2F6B3F'],
};
const PIC = {
  bread: '<path d="M5 12a7 5 0 0 1 14 0v6H5z"/><path d="M9 12v6M15 12v6"/>',
  milk: '<path d="M9 3h6v3l2 3v12H7V9l2-3z"/><path d="M7 13h10"/>',
  cart: '<path d="M3 5h2l2 10h11l2-7H6"/><circle cx="9" cy="19" r="1.4"/><circle cx="17" cy="19" r="1.4"/>',
  veg: '<path d="M6 18l8-8 2 2-8 8-3 1z"/><path d="M14 10l3-5M14 10l5-2"/>',
  bowl: '<path d="M3 12h18a9 6 0 0 1-18 0z"/><path d="M9 4c0 2 1.5 2 1.5 4M14 4c0 2 1.5 2 1.5 4"/>',
  meat: '<path d="M15 4a5 5 0 0 1 5 5c0 4-4 6-7 6l-4 4"/><path d="M9 19l-2 2-2-2 1-1-1-1 2-2 2 2"/><path d="M15 4c-4 0-6 4-6 7"/>',
  bag: '<path d="M4 7h16l-1.5 11a2 2 0 0 1-2 1.7h-9a2 2 0 0 1-2-1.7z"/><path d="M9 7a3 3 0 0 1 6 0"/>',
};
export const pic = (k, s = 24) => `<svg viewBox="0 0 24 24" width="${s}" height="${s}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${PIC[k] || PIC.bag}</svg>`;
export const catLook = c => CAT_LOOK[c] || CAT_LOOK.mix;

const svg = p => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${p}</svg>`;
export const ic = {
  home: svg(PIC.bag), me: svg('<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>'),
  add: svg('<path d="M12 5v14M5 12h14"/>'), chart: svg('<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>'),
  box: svg('<path d="M3 7l9-4 9 4-9 4z"/><path d="M3 7v10l9 4 9-4V7"/>'),
  ticket: svg('<path d="M4 7h16v3a2 2 0 0 0 0 4v3H4v-3a2 2 0 0 0 0-4z"/><path d="M10 7v10"/>'),
  flag: svg('<path d="M5 21V4M5 4h11l-2 4 2 4H5"/>'), back: svg('<path d="M15 18l-6-6 6-6"/>'),
  heart: svg('<path d="M12 21s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 11c0 5.6-7 10-7 10z"/>'),
  route: svg('<circle cx="6" cy="19" r="2"/><circle cx="18" cy="5" r="2"/><path d="M8 19h8a3 3 0 0 0 0-6H8a3 3 0 0 1 0-6h8"/>'),
  camera: svg('<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>'),
  lock: svg('<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>'),
};

export const LOGO = '<svg viewBox="60 28 120 120" width="30" height="30" aria-hidden="true"><rect x="60" y="28" width="120" height="120" rx="32" fill="#2F6B3F"/><path d="M78 112 Q70 100 80 95 Q72 82 87 79 Q84 64 100 67 Q102 52 116 59 Q124 48 133 60 Q145 55 146 70 Q157 72 154 84 Q168 88 175 102 Q178 110 168 112 Z" fill="#F3E3C8"/><ellipse cx="96" cy="114" rx="8" ry="4.5" fill="#F3E3C8"/><ellipse cx="148" cy="114" rx="8" ry="4.5" fill="#F3E3C8"/><path d="M90 96 q3 -7 9 -11 M103 88 q3 -7 9 -11 M117 82 q3 -7 9 -11 M98 106 q3 -7 9 -11 M112 100 q3 -7 9 -11 M126 94 q3 -7 9 -11 M131 78 q3 -6 8 -9" stroke="#B98A5E" stroke-width="2.6" fill="none" stroke-linecap="round"/><circle cx="155" cy="93" r="3.4" fill="#2F6B3F"/><circle cx="174" cy="104" r="4" fill="#4A3222"/><path d="M110 55 c2 -7 9 -9 13 -6 c-2 7 -9 9 -13 6z" fill="#8CCB76"/><path d="M68 128 c7 -10 20 -10 25 -2 c-7 9 -18 9 -25 2z" fill="#8CCB76"/><path d="M104 134 c6 -9 18 -9 23 -2 c-6 8 -17 8 -23 2z" fill="#C98A55"/><path d="M142 128 c7 -10 20 -10 25 -2 c-7 9 -18 9 -25 2z" fill="#E0A45A"/></svg>';

export const FACE = '<svg viewBox="40 30 160 160" width="120" height="120" aria-hidden="true"><path d="M70 150 Q50 120 62 92 L52 80 L70 76 L66 58 L84 62 L88 44 L104 54 L116 38 L126 54 L142 42 L146 62 L164 58 L160 78 L178 80 L168 94 Q182 122 168 150 Z" fill="#6B4A2E"/><path d="M84 150 Q70 122 82 98 L76 88 L90 86 L88 72 L102 76 L108 62 L120 72 L132 62 L138 76 L152 74 L150 88 L162 92 Q170 122 156 150 Z" fill="#8A6040"/><ellipse cx="120" cy="128" rx="42" ry="40" fill="#E9CBA7"/><circle cx="104" cy="116" r="5.5" fill="#2A1E15"/><circle cx="106" cy="114" r="1.8" fill="#fff"/><circle cx="136" cy="116" r="5.5" fill="#2A1E15"/><circle cx="138" cy="114" r="1.8" fill="#fff"/><ellipse cx="120" cy="128" rx="7" ry="5" fill="#2A1E15"/><ellipse cx="96" cy="132" rx="7" ry="4" fill="#E8907A" opacity=".7"/><ellipse cx="144" cy="132" rx="7" ry="4" fill="#E8907A" opacity=".7"/><path d="M112 138 q8 6 16 0" stroke="#2A1E15" stroke-width="2" fill="none" stroke-linecap="round"/><rect x="88" y="146" width="64" height="34" rx="8" fill="#9A6233"/><path d="M88 158 h64" stroke="#7A4A24" stroke-width="3"/><path d="M120 176 c-14 -8 -14 -18 -6 -18 c4 0 6 3 6 5 c0 -2 2 -5 6 -5 c8 0 8 10 -6 18z" fill="#6FAF5B"/><ellipse cx="86" cy="162" rx="8" ry="10" fill="#E9CBA7"/><ellipse cx="154" cy="162" rx="8" ry="10" fill="#E9CBA7"/></svg>';

// "сьогодні 19:00–21:00", "завтра 10:00–12:00", "12.12 10:00–12:00"
export function when(fromIso, toIso) {
  const f = new Date(fromIso), t = new Date(toIso), now = new Date();
  const day = d => { const a = new Date(d); a.setHours(0, 0, 0, 0); return a.getTime(); };
  const today = day(now), dd = day(f);
  const hm = d => d.toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' });
  const label = dd === today ? 'сьогодні' : dd === today + 864e5 ? 'завтра' : f.toLocaleDateString('uk-UA', { day: '2-digit', month: '2-digit' });
  return `${label} ${hm(f)}–${hm(t)}`;
}

export function mapsUrl(shop) {
  const dest = shop.lat && shop.lng ? `${shop.lat},${shop.lng}` : `${shop.name}, ${shop.address}, ${shop.city}`;
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(dest)}&travelmode=walking`;
}

export function thumb(o, cls = 'thumb') {
  if (o.photo) return `<img class="${cls}" src="${esc(o.photo)}" alt="" loading="lazy">`;
  const [k, c] = catLook(o.category);
  return `<div class="${cls}${cls === 'photo' ? ' tile' : ''}" style="background:${c}">${pic(k, cls === 'photo' ? 64 : 34)}</div>`;
}

// Зменшує фото перед збереженням, щоб не з'їдати пам'ять і трафік.
export function resizeImage(file, max = 960, q = 0.74) {
  return new Promise((res, rej) => {
    const img = new Image(), url = URL.createObjectURL(file);
    img.onload = () => {
      const k = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      res(c.toDataURL('image/jpeg', q));
    };
    img.onerror = () => { URL.revokeObjectURL(url); rej(new Error('Не вдалося відкрити фото.')); };
    img.src = url;
  });
}
