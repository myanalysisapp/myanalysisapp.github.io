/* ==========================================================================
   Мелкие утилиты интерфейса: разметка, иконки, даты, листы, тосты.
   Никаких зависимостей — только DOM.
   ========================================================================== */

/* — Разметка ———————————————————————————————————— */

/**
 * h('div.card', { onclick }, 'текст', h('b', null, '!'))
 * Селектор поддерживает tag, .class и #id.
 */
export function h(sel, props, ...kids) {
  const m = /^([a-z0-9]+)?(#[\w-]+)?((?:\.[\w-]+)*)$/i.exec(sel) || [];
  const tag = m[1] || 'div';
  const node = document.createElement(tag);
  if (m[2]) node.id = m[2].slice(1);
  if (m[3]) node.className = m[3].slice(1).split('.').join(' ');

  if (props) {
    for (const [k, v] of Object.entries(props)) {
      if (v == null || v === false) continue;
      if (k === 'class') node.className += (node.className ? ' ' : '') + v;
      else if (k === 'style' && typeof v === 'object') Object.assign(node.style, v);
      else if (k === 'html') node.innerHTML = v;
      else if (k === 'dataset') Object.assign(node.dataset, v);
      else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2), v);
      else if (k === 'value') node.value = v;
      else if (k === 'checked' || k === 'disabled' || k === 'selected') node[k] = !!v;
      else node.setAttribute(k, v === true ? '' : v);
    }
  }
  append(node, kids);
  return node;
}

function append(node, kids) {
  for (const kid of kids.flat(4)) {
    if (kid == null || kid === false) continue;
    node.appendChild(kid instanceof Node ? kid : document.createTextNode(String(kid)));
  }
}

export function frag(...kids) {
  const f = document.createDocumentFragment();
  append(f, kids);
  return f;
}

export function clear(node) {
  while (node.firstChild) node.removeChild(node.firstChild);
  return node;
}

/** Проставляет --i для каскадной анимации появления. */
export function stagger(node) {
  [...node.children].forEach((c, i) => c.style.setProperty('--i', Math.min(i, 12)));
  return node;
}

/* — Иконки —————————————————————————————————————— */

const SVG_NS = 'http://www.w3.org/2000/svg';

const PATHS = {
  today:    'M3 10.5 12 3l9 7.5M5.5 9.5V20a1 1 0 0 0 1 1h11a1 1 0 0 0 1-1V9.5',
  labs:     'M9.5 3v5.2L4.6 17a2.4 2.4 0 0 0 2.1 3.6h10.6a2.4 2.4 0 0 0 2.1-3.6L14.5 8.2V3M8 3h8M7 14h10',
  trends:   'M3 20h18M6.5 16V9M11 16V5.5M15.5 16v-4M20 16v-8',
  meds:     'M10.5 3.5a4.6 4.6 0 0 1 6.5 6.5l-7 7a4.6 4.6 0 1 1-6.5-6.5zM7 7l10 10',
  more:     'M4 6h16M4 12h16M4 18h11',
  plus:     'M12 5v14M5 12h14',
  check:    'M4.5 12.5 9.5 17.5 19.5 6.5',
  close:    'M6 6l12 12M18 6L6 18',
  chevron:  'M9 5l7 7-7 7',
  back:     'M15 5l-7 7 7 7',
  share:    'M12 16V3m0 0L8 7m4-4 4 4M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6',
  print:    'M7 9V4h10v5M7 19H5a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2M7 15h10v6H7z',
  download: 'M12 4v11m0 0-4-4m4 4 4-4M4 19h16',
  upload:   'M12 20V9m0 0-4 4m4-4 4 4M4 5h16',
  trash:    'M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2m-9 0 1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13',
  bell:     'M18 9a6 6 0 1 0-12 0c0 5-2 6-2 6h16s-2-1-2-6M10.5 20a2 2 0 0 0 3 0',
  calendar: 'M7 3v3m10-3v3M4 9h16M5 5h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z',
  camera:   'M4 8h3l1.6-2.4a1 1 0 0 1 .8-.6h5.2a1 1 0 0 1 .8.6L17 8h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z',
  thermo:   'M14 13.5V5a2 2 0 1 0-4 0v8.5a4 4 0 1 0 4 0zM12 17.2h.01',
  droplet:  'M12 3s6 6.4 6 10.4A6 6 0 0 1 6 13.4C6 9.4 12 3 12 3z',
  heart:    'M12 20s-7.5-4.6-7.5-9.6A4.2 4.2 0 0 1 12 7.6a4.2 4.2 0 0 1 7.5 2.8C19.5 15.4 12 20 12 20z',
  shield:   'M12 3l7 3v5.5c0 4.6-3 7.9-7 9.5-4-1.6-7-4.9-7-9.5V6z',
  syringe:  'M17 3l4 4M19 5l-8.5 8.5M14 8l-8.5 8.5a2 2 0 0 0 0 2.8 2 2 0 0 0 2.8 0L16.8 11M5 16l3 3',
  edit:     'M4 20h4l10-10-4-4L4 16zM14 6l4 4',
  info:     'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 11v5M12 7.5h.01',
  settings: 'M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-2.7 1.1V21a2 2 0 1 1-4 0v-.1A1.6 1.6 0 0 0 7.5 19.4l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1A1.6 1.6 0 0 0 3 14a2 2 0 1 1 0-4 1.6 1.6 0 0 0 1.6-2.4l-.1-.1A2 2 0 1 1 7.3 4.7l.1.1A1.6 1.6 0 0 0 10 3.6V3a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 2.7 1.1l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1A1.6 1.6 0 0 0 20.4 10H21a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1z',
  doc:      'M14 3H7a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V7zM14 3v4h4M9 12h6M9 16h4',
  image:    'M4 5h16a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1zM3 16l5-5 4 4 3-3 6 6M8.5 9.5h.01',
  scan:     'M4 8V5.5A1.5 1.5 0 0 1 5.5 4H8M16 4h2.5A1.5 1.5 0 0 1 20 5.5V8M20 16v2.5a1.5 1.5 0 0 1-1.5 1.5H16M8 20H5.5A1.5 1.5 0 0 1 4 18.5V16M3.5 12h17',
  pulse:    'M3 12h3.5l2-6 3.5 12 2.5-8 1.6 2h4.9',
  sos:      'M12 3.2 2.6 19.3a1 1 0 0 0 .9 1.5h17a1 1 0 0 0 .9-1.5zM12 9.5v4.2M12 17h.01',
  clock:    'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v5l3.2 2',
  hospital: 'M4 21V8l8-5 8 5v13M9 21v-5h6v5M12 8.5v4M10 10.5h4',
  vaccine:  'M9 3h6M12 3v4M7.5 7h9l-.8 12a2 2 0 0 1-2 1.9h-3.4a2 2 0 0 1-2-1.9zM8 13h8',
  user:     'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4.5 20.5a7.5 7.5 0 0 1 15 0',
  moon:     'M20 14.2A8.4 8.4 0 0 1 9.8 4 8.4 8.4 0 1 0 20 14.2z',
  sun:      'M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10zM12 2v2M12 20v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M2 12h2M20 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4',
  qr:       'M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h2v2h-2zM18 14h2v2h-2zM14 18h2v2h-2zM18 18h2v2h-2z',
  filter:   'M4 6h16M7 12h10M10 18h4',
  arrowUp:  'M12 19V5M6 11l6-6 6 6',
  arrowDown:'M12 5v14M6 13l6 6 6-6',
  arrowRight:'M5 12h14M13 6l6 6-6 6',
  minus:    'M5 12h14',
  list:     'M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01',
  flask:    'M9.5 3v5.2L4.6 17a2.4 2.4 0 0 0 2.1 3.6h10.6a2.4 2.4 0 0 0 2.1-3.6L14.5 8.2V3M8 3h8',
  bp:       'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 12l4-3M12 12h.01',
  note:     'M5 4h10l4 4v12a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1zM8 12h8M8 16h5',
  sparkle:  'M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9zM18.5 15l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8z',
  eye:      'M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z M12 14.8a2.8 2.8 0 1 0 0-5.6 2.8 2.8 0 0 0 0 5.6z',
};

export function icon(name, size) {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '1.8');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  svg.setAttribute('aria-hidden', 'true');
  /* .ico — размер по умолчанию; правила вида «.btn svg» специфичнее и перебьют его */
  svg.setAttribute('class', 'ico');
  if (size) { svg.style.width = size + 'px'; svg.style.height = size + 'px'; }
  const p = document.createElementNS(SVG_NS, 'path');
  p.setAttribute('d', PATHS[name] || PATHS.info);
  svg.appendChild(p);
  return svg;
}

export function svgEl(tag, attrs) {
  const n = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null) continue;
    n.setAttribute(k, v);
  }
  return n;
}

/* — Даты ———————————————————————————————————————— */

const MONTHS   = ['января','февраля','марта','апреля','мая','июня','июля','августа','сентября','октября','ноября','декабря'];
const MONTHS_N = ['январь','февраль','март','апрель','май','июнь','июль','август','сентябрь','октябрь','ноябрь','декабрь'];
const MON_SH   = ['янв','фев','мар','апр','мая','июн','июл','авг','сен','окт','ноя','дек'];
const WD_SH    = ['вс','пн','вт','ср','чт','пт','сб'];

/** Локальная дата в ISO «ГГГГ-ММ-ДД» (без сдвига на UTC). */
export function iso(d = new Date()) {
  const x = d instanceof Date ? d : new Date(d);
  const p = (n) => String(n).padStart(2, '0');
  return `${x.getFullYear()}-${p(x.getMonth() + 1)}-${p(x.getDate())}`;
}

export function parseISO(s) {
  if (s instanceof Date) return s;
  const [y, m, d] = String(s).split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

export function today() { return iso(new Date()); }

export function addDays(isoStr, n) {
  const d = parseISO(isoStr);
  d.setDate(d.getDate() + n);
  return iso(d);
}

export function daysBetween(a, b) {
  const MS = 86400000;
  const da = parseISO(a), db = parseISO(b);
  return Math.round((db.setHours(12, 0, 0, 0) - da.setHours(12, 0, 0, 0)) / MS);
}

/** «18 сентября», «18 сентября 2025» если другой год */
export function fmtDate(isoStr, { year = 'auto', short = false } = {}) {
  const d = parseISO(isoStr);
  const mm = short ? MON_SH[d.getMonth()] : MONTHS[d.getMonth()];
  const showYear = year === true || (year === 'auto' && d.getFullYear() !== new Date().getFullYear());
  return `${d.getDate()} ${mm}${showYear ? ' ' + d.getFullYear() : ''}`;
}

export function fmtDateShort(isoStr) {
  const d = parseISO(isoStr);
  const p = (n) => String(n).padStart(2, '0');
  return `${p(d.getDate())}.${p(d.getMonth() + 1)}.${String(d.getFullYear()).slice(2)}`;
}

export function fmtWeekday(isoStr) { return WD_SH[parseISO(isoStr).getDay()]; }

export function fmtMonthYear(isoStr) {
  const d = parseISO(isoStr);
  const cur = new Date().getFullYear();
  return MONTHS_N[d.getMonth()] + (d.getFullYear() !== cur ? ' ' + d.getFullYear() : '');
}

/** «сегодня», «вчера», «через 3 дня», «5 дней назад» */
export function fmtRelative(isoStr) {
  const n = daysBetween(today(), isoStr);
  if (n === 0) return 'сегодня';
  if (n === 1) return 'завтра';
  if (n === -1) return 'вчера';
  if (n === 2) return 'послезавтра';
  if (n > 0) return `через ${plural(n, 'день', 'дня', 'дней')}`;
  return `${plural(-n, 'день', 'дня', 'дней')} назад`;
}

export function plural(n, one, few, many) {
  const a = Math.abs(n) % 100, b = a % 10;
  const word = a > 10 && a < 20 ? many : b === 1 ? one : b >= 2 && b <= 4 ? few : many;
  return `${n} ${word}`;
}

export function pluralWord(n, one, few, many) {
  const a = Math.abs(n) % 100, b = a % 10;
  return a > 10 && a < 20 ? many : b === 1 ? one : b >= 2 && b <= 4 ? few : many;
}

export function nowTime() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/* — Тактильный отклик ————————————————————————————— */

export function tap(ms = 8) {
  try { if (navigator.vibrate) navigator.vibrate(ms); } catch (_) { /* не поддерживается */ }
}

/* — Тосты ———————————————————————————————————————— */

let toastHost = null;

/**
 * toast('Готово', { action: { label: 'Отменить', onClick } })
 *
 * Действие в тосте — единственная отмена у мгновенных записей: они
 * попадают на диск сразу, без диалога «вы уверены». Тост с кнопкой
 * висит дольше обычного: на реакцию нужно время.
 */
export function toast(text, { icon: ico = 'check', ms, action = null } = {}) {
  if (!toastHost) {
    toastHost = h('.toast-host', { role: 'status', 'aria-live': 'polite' });
    document.body.appendChild(toastHost);
  }
  const life = ms != null ? ms : (action ? 6500 : 2200);
  const node = h('.toast' + (action ? '.toast--action' : ''), null,
    ico ? icon(ico) : null, h('span.toast__text', null, text));

  let timer = null;
  const hide = () => {
    clearTimeout(timer);
    node.classList.add('is-out');
    setTimeout(() => node.remove(), 300);
  };

  if (action) {
    node.appendChild(h('button.toast__btn', {
      type: 'button',
      onclick: async () => {
        hide();
        try { await action.onClick(); } catch (_) { /* отмена — не повод падать */ }
      },
    }, action.label));
  }

  toastHost.appendChild(node);
  timer = setTimeout(hide, life);
  return node;
}

/* — Нижний лист ————————————————————————————————— */

let openSheets = [];

/**
 * sheet({ title, body, foot, onClose }) → { close, body, root }
 * body/foot — Node или функция, получающая api листа.
 */
export function sheet({ title, body, foot, wide = false, onClose } = {}) {
  const api = {};
  const bodyEl = h('.sheet__body');
  const root = h('.sheet-backdrop', {
    onclick: (e) => { if (e.target === root) api.close(); },
  });
  const sheetEl = h('.sheet', { role: 'dialog', 'aria-modal': 'true', 'aria-label': title || '' },
    h('.sheet__grab'),
    title ? h('.sheet__head', null,
      h('.sheet__title', null, title),
      h('button.sheet__close', { type: 'button', 'aria-label': 'Закрыть', onclick: () => api.close() }, icon('close')),
    ) : null,
    bodyEl,
  );
  if (wide) sheetEl.classList.add('sheet--wide');
  root.appendChild(sheetEl);

  api.root = root;
  api.body = bodyEl;
  api.setFoot = (node) => {
    const old = sheetEl.querySelector('.sheet__foot');
    if (old) old.remove();
    if (node) sheetEl.appendChild(h('.sheet__foot', null, node));
  };
  api.close = () => {
    if (root.classList.contains('is-closing')) return;
    root.classList.add('is-closing');
    setTimeout(() => {
      root.remove();
      openSheets = openSheets.filter((s) => s !== api);
      if (!openSheets.length) document.body.style.overflow = '';
      if (onClose) onClose();
    }, 280);
  };

  const content = typeof body === 'function' ? body(api) : body;
  if (content) bodyEl.appendChild(content);
  const footContent = typeof foot === 'function' ? foot(api) : foot;
  if (footContent) api.setFoot(footContent);

  document.body.appendChild(root);
  document.body.style.overflow = 'hidden';
  openSheets.push(api);

  /* фокус уходит в лист, Esc закрывает верхний — привычно на десктопе
     и нужно для клавиатурной навигации */
  const focusable = sheetEl.querySelector(
    'input, textarea, select, button:not(.sheet__close)');
  if (focusable && focusable.type !== 'file') {
    requestAnimationFrame(() => { try { focusable.focus({ preventScroll: true }); } catch (_) {} });
  }
  return api;
}

document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape' || !openSheets.length) return;
  e.preventDefault();
  openSheets[openSheets.length - 1].close();
});

export function closeAllSheets() {
  [...openSheets].forEach((s) => s.close());
}

/** Подтверждение действия. Возвращает Promise<boolean>. */
export function confirmSheet({ title, text, ok = 'Продолжить', cancel = 'Отмена', danger = false }) {
  return new Promise((resolve) => {
    let decided = false;
    const s = sheet({
      title,
      body: h('p', { style: { fontSize: 'var(--t-base)', color: 'var(--ink-2)', lineHeight: '1.5', margin: '0 0 8px' } }, text),
      foot: (api) => frag(
        h('button.btn.btn--ghost', { type: 'button', onclick: () => { decided = true; api.close(); resolve(false); } }, cancel),
        h(`button.btn.${danger ? 'btn--danger' : 'btn--primary'}`, {
          type: 'button',
          onclick: () => { decided = true; api.close(); resolve(true); },
        }, ok),
      ),
      onClose: () => { if (!decided) resolve(false); },
    });
    return s;
  });
}

/* — Прочее ————————————————————————————————————— */

export function debounce(fn, ms = 160) {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}

export function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

/** Читает File как dataURL — файлы остаются на устройстве. */
export function readFileAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });
}

export function download(filename, text, type = 'application/json') {
  const blob = new Blob([text], { type: type + ';charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = h('a', { href: url, download: filename });
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { a.remove(); URL.revokeObjectURL(url); }, 500);
}

/* — Печать —————————————————————————————————————— */

/**
 * Печатает один узел: клонирует его в отдельный контейнер, чтобы интерфейс
 * приложения не попал на лист и не оставил пустых страниц.
 */
export function printNode(node, { title } = {}) {
  const host = h('#print-root');
  if (title) host.appendChild(h('.rep-print-title.hidden'));
  host.appendChild(node.cloneNode(true));
  document.body.appendChild(host);
  document.body.classList.add('is-printing');

  const cleanup = () => {
    document.body.classList.remove('is-printing');
    host.remove();
    window.removeEventListener('afterprint', cleanup);
  };
  window.addEventListener('afterprint', cleanup);

  /* даём браузеру кадр на раскладку клона */
  requestAnimationFrame(() => {
    setTimeout(() => {
      window.print();
      /* Safari не всегда шлёт afterprint — подстраховываемся */
      setTimeout(cleanup, 1200);
    }, 40);
  });
}

/* — Оживление чисел ————————————————————————————————
   Крупные значения подкручиваются от прошлого к новому. Приём из
   Apple Health и Oura: взгляд цепляется за цифру и сразу видит,
   что она изменилась. Быстро — 600 мс — и молча при reduced-motion. */

const REDUCED = matchMedia('(prefers-reduced-motion: reduce)');

export function countUp(node, to, { from = 0, dec = 0, ms = 600, suffix = '' } = {}) {
  const fmt = (v) => {
    const s = dec === 0 ? String(Math.round(v)) : v.toFixed(dec);
    return s.replace('.', ',') + suffix;
  };
  if (REDUCED.matches || !Number.isFinite(to)) { node.textContent = fmt(to); return node; }

  const start = performance.now();
  const span = to - from;
  const step = (now) => {
    const p = Math.min(1, (now - start) / ms);
    /* easeOutExpo: быстрый разгон, мягкая остановка */
    const e = p === 1 ? 1 : 1 - Math.pow(2, -10 * p);
    node.textContent = fmt(from + span * e);
    if (p < 1) requestAnimationFrame(step);
  };
  node.textContent = fmt(from);
  requestAnimationFrame(step);
  /* Кадры не идут, пока вкладка скрыта, и цифра осталась бы на старте.
     Подстраховываемся таймером: к сроку значение в любом случае верное. */
  setTimeout(() => { node.textContent = fmt(to); }, ms + 60);
  return node;
}

/* — Переход между экранами ————————————————————————
   View Transitions делает смену вкладки плавной вместо рывка.
   Где API нет — просто вызываем перерисовку. */

export function withTransition(fn) {
  if (REDUCED.matches || !document.startViewTransition) { fn(); return; }
  try {
    const t = document.startViewTransition(fn);
    /* Быстрое переключение вкладок прерывает предыдущий переход, и его
       промисы отклоняются. Это ожидаемо — гасим, чтобы не сыпалось в консоль. */
    const hush = () => {};
    t.finished.catch(hush);
    t.ready.catch(hush);
    t.updateCallbackDone.catch(hush);
  } catch (_) {
    fn();
  }
}
