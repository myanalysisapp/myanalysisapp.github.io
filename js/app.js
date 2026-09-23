/* ==========================================================================
   Точка входа: загрузка данных, тема, роутер, каркас экранов.
   ========================================================================== */

import { h, clear, icon, toast, closeAllSheets, withTransition } from './ui.js';
import * as store from './store.js';

import renderOnboarding from './screens/onboarding.js';
import renderToday from './screens/today.js';
import renderLabs from './screens/labs.js';
import renderTrends from './screens/trends.js';
import renderMeds from './screens/meds.js';
import renderMore from './screens/more.js';
import { openQuickAdd } from './screens/quickadd.js';
import { loadDemo } from './demo.js';
import { maybeOpenTour } from './screens/tour.js';

/* — Экраны и вкладки ——————————————————————————
   Список сдач и графики раньше были двумя вкладками — «Анализы» и
   «Динамика». Пациент думает «мои анализы» и ждёт там и числа, и
   кривую: деление было удобно разработчику. Экран `trends` остался
   отдельным маршрутом, но в нижней панели живёт под «Анализами»,
   а переключаются представления сверху (labsnav.js).             */

const ROUTES = {
  today:    { label: 'Сегодня',       render: renderToday },
  labs:     { label: 'Анализы',       render: renderLabs },
  trends:   { label: 'Динамика',      render: renderTrends },
  meds:     { label: 'Лекарства',     render: renderMeds },
  doctor:   { label: 'Для врача',     render: renderMore },
  plans:    { label: 'Планы и сроки', render: renderMore },
  settings: { label: 'Мои настройки', render: renderMore },
  more:     { label: 'Ещё',           render: renderMore },
};

/* Раньше три группы прятались за одной вкладкой «Ещё». Название ни о
   чём не говорило, и до отчётов или порогов приходилось идти в два
   касания. Теперь у каждой группы свой раздел. */
const TABS = [
  { id: 'today',    label: 'Сегодня',   short: 'Сегодня',    icon: 'today' },
  { id: 'labs',     label: 'Анализы',   short: 'Анализы',    icon: 'labs', owns: ['trends'] },
  { id: 'meds',     label: 'Лекарства', short: 'Лекарства',  icon: 'meds' },
  { id: 'doctor',   label: 'Для врача', short: 'Врачу',      icon: 'doc' },
  { id: 'plans',    label: 'Планы и сроки', short: 'Планы',  icon: 'calendar' },
  { id: 'settings', label: 'Мои настройки', short: 'Настройки', icon: 'settings' },
];

/* Вложенные страницы «Ещё» раскиданы по трём разделам: подсветка
   вкладки берётся отсюда, а сами ссылки вида more/reports не менялись. */
const MORE_TAB = {
  reports: 'doctor', safety: 'doctor', questions: 'doctor',
  hospital: 'plans', vaccines: 'plans', reminders: 'plans', schedule: 'plans',
  thresholds: 'settings', notes: 'settings', settings: 'settings',
};

/** Какая вкладка подсвечена для текущего маршрута. */
function tabOf(routeId, sub) {
  if (routeId === 'more') return MORE_TAB[sub] || 'doctor';
  const t = TABS.find((x) => x.id === routeId || (x.owns || []).includes(routeId));
  return t ? t.id : 'today';
}

const root = document.getElementById('app');

let current = { tab: 'today', sub: null, param: null };
let scrollMemory = {};

/* ==========================================================================
   Маршрутизация
   ========================================================================== */

export function go(path, { replace = false } = {}) {
  const hash = '#/' + String(path).replace(/^#?\/?/, '');
  if (location.hash === hash) { renderApp(); return; }
  if (replace) history.replaceState(null, '', hash);
  else location.hash = hash;
}

export function back() {
  if (history.length > 1) history.back();
  else go('today');
}

function parseHash() {
  const raw = location.hash.replace(/^#\/?/, '');
  const [tab, sub, param] = raw.split('/');
  return {
    tab: ROUTES[tab] ? tab : 'today',
    sub: sub || null,
    param: param ? decodeURIComponent(param) : null,
  };
}

/* ==========================================================================
   Тема
   ========================================================================== */

export function applyTheme(theme) {
  const t = theme || (store.state.settings && store.state.settings.theme) || 'light';
  const resolved = t === 'auto'
    ? (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
    : t;
  document.documentElement.setAttribute('data-theme', resolved);
  const meta = document.querySelector('meta[name="theme-color"]');
  /* цвета берём из палитры: --bg светлой и тёмной темы */
  if (meta) meta.setAttribute('content', resolved === 'dark' ? '#12100C' : '#F1ECE3');
  /* дублируем выбор в localStorage: скрипт в <head> применяет тему
     до первой отрисовки, а IndexedDB оттуда недоступна */
  try { localStorage.setItem('ma-theme', t); } catch (_) { /* приватный режим */ }
}

matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
  if (store.state.settings && store.state.settings.theme === 'auto') applyTheme('auto');
});

/* ==========================================================================
   Каркас
   ========================================================================== */

function appBar({ title, sub, showBack, actions }) {
  const bar = h('header.appbar');
  const inner = h('.appbar__in');

  if (showBack) {
    inner.appendChild(h('button.appbar__back', {
      type: 'button', onclick: () => back(),
    }, icon('back'), 'Назад'));
  } else {
    inner.appendChild(brandMark(34));
  }

  inner.appendChild(h('div', null,
    h('.appbar__title', null, title),
    sub ? h('.appbar__sub', null, sub) : null,
  ));
  inner.appendChild(h('.appbar__spacer'));

  for (const a of actions || []) {
    inner.appendChild(h('button.appbar__btn', {
      type: 'button', 'aria-label': a.label, title: a.label, onclick: a.onClick,
    }, icon(a.icon)));
  }

  bar.appendChild(inner);
  return bar;
}

/**
 * Знак в шапке. Если в проект положили assets/logo.png — берём его,
 * иначе рисуем свой. Наличие файла проверяется один раз за сессию,
 * чтобы не сыпать 404 на каждую перерисовку.
 */
export function brandMark(size = 34) {
  return h('img.appbar__logo', {
    src: 'assets/logo.png', alt: '',
    style: { width: size + 'px', height: size + 'px', borderRadius: (size * 0.27) + 'px' },
    /* если файл вдруг убрали — рисуем свой знак, интерфейс не ломается */
    onerror: (e) => {
      const fb = logoFallback(size);
      fb.style.borderRadius = (size * 0.27) + 'px';
      e.target.replaceWith(fb);
    },
  });
}

/** Запасной знак, если assets/logo.png отсутствует. */
export function logoFallback(size = 34) {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', '0 0 64 64');
  svg.setAttribute('width', size);
  svg.setAttribute('height', size);
  svg.setAttribute('class', 'appbar__logo');
  svg.setAttribute('aria-hidden', 'true');
  /* Повторяет знак из assets/logo.png: красная капля с линией пульса.
     Рисуется, только если файла почему-то нет — интерфейс не должен
     остаться без знака. */
  svg.innerHTML =
    '<rect width="64" height="64" rx="16" fill="#FFFFFF"/>' +
    '<path d="M32 8c0 0 15.5 17.2 15.5 26.2A15.5 15.5 0 1 1 16.5 34.2C16.5 25.2 32 8 32 8z" ' +
    'fill="#E74A4C"/>' +
    '<path d="M14 36.5h8.6l2.4-3.4 2.8 5.6 3.4-14.2 3.6 18.4 2.8-9 2.1 2.6H50" fill="none" ' +
    'stroke="#FFFFFF" stroke-width="3.6" stroke-linecap="round" stroke-linejoin="round"/>';
  return svg;
}

/**
 * Одна и та же навигация в разметке: на телефоне CSS превращает её
 * в нижнюю панель, на компьютере — в боковую колонку с названием,
 * кнопкой записи и подписью.
 */
function navPanel() {
  const nav = h('nav.nav', { 'aria-label': 'Основная навигация' });

  nav.appendChild(h('.nav__brand', null,
    brandMark(36),
    h('div', null,
      h('.nav__name', null, 'Мой Анализ'),
      h('.nav__sub', null, 'дневник здоровья'),
    ),
  ));

  const items = h('.nav__items');
  const activeTab = tabOf(current.tab, current.sub);
  for (const t of TABS) {
    items.appendChild(h('button.tab', {
      type: 'button',
      /* экскурсия наводится на вкладки по этому признаку */
      'data-tab': t.id,
      'aria-current': activeTab === t.id ? 'page' : null,
      'aria-label': t.label,
      onclick: () => go(t.id),
    },
      icon(t.icon),
      h('span.tab__full', null, t.label),
      h('span.tab__short', null, t.short),
    ));
  }
  nav.appendChild(items);

  nav.appendChild(h('button.nav__add', {
    type: 'button', onclick: () => openQuickAdd(),
  }, icon('plus'), 'Запись'));

  nav.appendChild(h('.nav__foot', null,
    'Данные хранятся только на этом устройстве'));

  return nav;
}

function fab() {
  return h('button.fab', {
    type: 'button', 'aria-label': 'Быстрая запись',
    onclick: () => openQuickAdd(),
  }, icon('plus'));
}

/* ==========================================================================
   Отрисовка
   ========================================================================== */

let rendering = false;

export function renderApp() {
  if (rendering) return;
  rendering = true;
  try { withTransition(draw); } finally { rendering = false; }
}

function draw() {
  const prev = current;
  current = parseHash();

  /* запоминаем позицию прокрутки по вкладкам */
  if (prev && prev.tab !== current.tab) {
    scrollMemory[prev.tab + '/' + (prev.sub || '')] = window.scrollY;
  }

  clear(root);

  /* — Онбординг перекрывает всё, пока не пройден.
       Помечаем корень: на компьютере он разложен в две колонки под
       боковую панель, а приветствию нужна вся ширина. — */
  if (!store.state.profile || !store.state.profile.onboarded) {
    root.classList.add('is-onboarding');
    root.appendChild(renderOnboarding({ go, renderApp }));
    return;
  }
  root.classList.remove('is-onboarding');

  const route = ROUTES[current.tab] || ROUTES.today;
  const ctx = {
    route: current,
    go,
    back,
    rerender: renderApp,
    screen: h('main.screen', { id: 'screen' }),
  };

  const meta = route.render(ctx) || {};

  /* Новичку один раз показываем короткую экскурсию. */
  maybeOpenTour(ctx);
  const bar = appBar({
    title: meta.title || route.label,
    sub: meta.sub,
    showBack: !!current.sub,
    actions: meta.actions,
  });

  /* .main — колонка контента: на ПК она стоит справа от боковой панели */
  const main = h('.main', null, bar, demoBar(), ctx.screen);
  root.appendChild(navPanel());
  root.appendChild(main);
  if (!current.sub || meta.keepFab) root.appendChild(fab());

  /* тень под шапкой появляется при прокрутке */
  const onScroll = () => bar.classList.toggle('appbar--scrolled', window.scrollY > 4);
  window.removeEventListener('scroll', window.__maScroll || (() => {}));
  window.__maScroll = onScroll;
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  const key = current.tab + '/' + (current.sub || '');
  const y = scrollMemory[key];
  window.scrollTo(0, prev && prev.tab === current.tab && prev.sub !== current.sub ? 0 : (y || 0));
}

/**
 * Полоса «вы смотрите демо». Висит на каждом экране, пока в дневнике
 * данные вымышленного пациента: иначе человек решит, что это его записи,
 * и не поймёт, откуда взялись чужие анализы.
 *
 * Только объясняет и ничего не предлагает. Начать свой дневник можно
 * в настройках, «Очистить демо», — там это осознанный шаг с вопросом,
 * а не кнопка, на которую жмут мимоходом и теряют показ.
 */
function demoBar() {
  if (!store.state.profile || !store.state.profile.demo) return null;
  return h('.demobar', null,
    icon('info'),
    h('.demobar__t', null,
      h('b', null, 'Это демо. '),
      'Записи вымышленного пациента, чтобы было что посмотреть.'),
  );
}

/* ==========================================================================
   Запуск
   ========================================================================== */

async function boot() {
  window.__maBooted = true;   // заставка в index.html поймёт, что запуск удался
  try {
    await store.load();
  } catch (e) {
    console.error(e);
    root.appendChild(h('.screen', null,
      h('.card', { style: { marginTop: '40px' } },
        h('.card__title', null, 'Не удалось открыть хранилище'),
        h('.card__sub', null,
          'Похоже, браузер запретил локальную базу данных. ' +
          'Проверьте, что вы не в приватном режиме, и обновите страницу.'),
      ),
    ));
    return;
  }

  /* Первый запуск показываем не пустой формой, а живым дневником:
     человек пришёл по ссылке посмотреть, что это такое, и анкета на
     входе отвечает не на его вопрос. Данные вымышленные, о чём прямо
     сказано полосой наверху, а рядом кнопка завести свой дневник. */
  if (!store.state.profile.onboarded && !store.state.labs.length) {
    try { await loadDemo(); } catch (e) { console.error(e); }
  }

  applyTheme();
  store.subscribe(() => renderApp());
  window.addEventListener('hashchange', () => { closeAllSheets(); renderApp(); });

  if (!location.hash) history.replaceState(null, '', '#/today');
  renderApp();

  keepDevServerAlive();

  /* офлайн-режим: сервис-воркер кэширует всё приложение целиком */
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    navigator.serviceWorker.register('sw.js').catch(() => { /* офлайн не включится, но приложение работает */ });
  }
}

/* ==========================================================================
   Пульс для локального сервера разработки
   ========================================================================== */

/**
 * Сервер из serve.py / server.js выключается сам, когда закрыта последняя
 * вкладка. Для этого страница отмечается в /__ping, а при закрытии шлёт
 * /__bye. На обычном хостинге таких адресов нет — тогда после первой
 * неудачи мы просто перестаём стучаться.
 */
function keepDevServerAlive() {
  if (!location.protocol.startsWith('http')) return;

  const tab = Math.random().toString(36).slice(2, 10);
  const ping = (path) => fetch(`${path}?id=${tab}`, { cache: 'no-store', keepalive: true });

  let timer = null;
  ping('/__ping').then((r) => {
    if (!r.ok && r.status !== 204) return;         // не наш сервер — молчим
    /* 25 секунд: даже в фоновой вкладке, где браузер душит таймеры
       до одного срабатывания в минуту, сервер успевает узнать, что мы живы */
    timer = setInterval(() => ping('/__ping').catch(() => clearInterval(timer)), 25000);

    addEventListener('pagehide', () => {
      clearInterval(timer);
      try {
        if (navigator.sendBeacon) navigator.sendBeacon(`/__bye?id=${tab}`);
        else ping('/__bye');
      } catch (_) { /* уходим молча */ }
    });
  }).catch(() => { /* статический хостинг — пульс не нужен */ });
}

/* удобно для отладки с телефона */
window.addEventListener('error', (e) => {
  if (!e.message) return;
  console.error(e.error || e.message);
});

boot();

export { store, toast };
