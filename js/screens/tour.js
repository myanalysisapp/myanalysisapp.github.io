/* ==========================================================================
   Экскурсия по приложению.

   Устроена как принято в хороших онбордингах: экран притемняется, а тот
   элемент, о котором идёт речь, остаётся освещённым и обведённым. Рядом
   встаёт карточка с пояснением и уголком в сторону подсветки. Само
   приложение при этом переключается на нужный раздел, так что человек
   видит настоящий экран, а не картинку.

   Вырез в затемнении сделан маской SVG, подробности ниже.

   Ведёт всё медоед. Зверь выбран за спокойное упрямство: дневник ведут
   годами, и спутник тут нужен невозмутимый.
   ========================================================================== */

import { h, icon, tap } from '../ui.js';
import * as store from '../store.js';

/* ==========================================================================
   Медоед

   Ведёт экскурсию и больше нигде не появляется: пациенту в питомцы он
   не предлагается. Шесть кадров лежат картинками в assets/pets.
   ========================================================================== */

const MOODS = new Set(['hi', 'talk', 'wink', 'bye', 'happy', 'sleep']);

export function badgerNode(mood = 'talk', size) {
  const box = h('span.badger');
  if (size) box.style.setProperty('--badger-size', size + 'px');
  box.appendChild(h('img.badger__art', {
    src: `assets/pets/badger-${MOODS.has(mood) ? mood : 'talk'}.png`,
    alt: '', draggable: 'false', decoding: 'async',
  }));
  return box;
}

/* ==========================================================================
   Шаги

   sel — что подсветить. Если элемента на экране нет, шаг показывается
   без подсветки: лучше рассказать, чем оборвать экскурсию.
   fix — цель закреплена на экране и прокрутке не поддаётся.
   ========================================================================== */

const STEPS = [
  {
    go: 'today', mood: 'hi',
    title: 'Здравствуйте',
    text: 'Я медоед, побуду рядом первые пару минут и покажу, где что находится. '
          + 'Это недолго, и выйти можно в любой момент.',
  },
  {
    go: 'today', sel: '.cycle', pad: 10,
    title: 'Сколько до инфузии',
    text: 'Кольцо показывает, какой сегодня день промежутка между инфузиями '
          + 'и сколько осталось до следующей. Её дата стоит прямо под ним.',
  },
  {
    go: 'today', sel: '.mark', pad: 8,
    title: 'Отметка дня',
    text: 'Одно касание по «Как обычно», и день записан. '
          + 'Если захочется подробнее, рядом откроется самочувствие, температура и симптомы.',
  },
  {
    go: 'today', sel: '.weeks', pad: 8,
    title: 'Две недели рядом',
    text: 'Каждый столбик - это день. Чем выше и зеленее, тем спокойнее он прошёл. '
          + 'Бледный столбик значит, что запись пропущена. Её можно дополнить позже, '
          + 'нажав по этому дню.',
  },
  {
    go: 'today', sel: '.tile--labs', pad: 8,
    title: 'Последние показатели',
    text: 'Свежие значения из последнего анализа и график под ними. '
          + 'Нажатие по плитке меняет показатель на графике.',
  },
  {
    go: 'labs', sel: '.actions', pad: 8,
    title: 'Как добавить анализ',
    text: 'Проще всего вставить текст из письма лаборатории: приложение разберёт '
          + 'цифры само и даст всё проверить. Вручную тоже можно, кнопка рядом.',
  },
  {
    go: 'labs', sel: '.segmented', pad: 6,
    title: 'Три взгляда на одно',
    text: 'Список, графики и календарь показывают одни и те же записи. '
          + 'Переключаться можно когда угодно.',
  },
  {
    go: 'meds', sel: '.win.med', pad: 8,
    title: 'Схема приёма',
    text: 'Время приёма - это кнопка. Приняли, нажали, отметка стала зелёной. '
          + 'Пропуски приложение не подсчитывает и ни о чём не напоминает укоризненно.',
  },
  {
    go: 'doctor', sel: '[data-tab="doctor"]', pad: 6, fix: true,
    title: 'Когда идёте к врачу',
    text: 'Здесь собирается отчёт для врача и карточка безопасности с QR-кодом. '
          + 'Карточку показывают бригаде скорой, если говорить самому тяжело.',
  },
  {
    go: 'plans', sel: '[data-tab="plans"]', pad: 6, fix: true,
    title: 'Сроки',
    text: 'Прививки, подготовка к госпитализации, напоминания. Всё, у чего есть дата.',
  },
  {
    go: 'settings', sel: '[data-tab="settings"]', pad: 6, fix: true,
    title: 'Записи остаются у вас',
    text: 'Данные хранятся на этом устройстве и никуда не отправляются, интернет для них не нужен. '
          + 'Копию можно выгрузить одним файлом и перенести на другой телефон.',
  },
  {
    go: 'settings', mood: 'bye', last: true,
    title: 'И важное напоследок',
    text: 'Приложение не ставит диагнозов и не назначает лечения. Оно бережно хранит то, '
          + 'что вы записали, и показывает это врачу в удобном виде. Решения остаются за ним.\n\n'
          + 'Спасибо, что дошли до конца. Если понадоблюсь, я живу в настройках.',
  },
];

/* ==========================================================================
   Затемнение с вырезом

   Маска SVG вместо модного трюка с box-shadow на пол-экрана: такую тень
   Chrome рисует заметно бледнее заданного цвета, а от перехода на
   размерах и вовсе перестаёт рисовать. Здесь же ровно та плотность,
   которую задали, и вырез со скруглением по форме элемента.
   ========================================================================== */

const VEIL = '<svg xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">'
  + '<defs><mask id="tour-cut">'
  +   '<rect x="0" y="0" width="100%" height="100%" fill="#fff"/>'
  +   '<rect class="tour__cut" x="0" y="0" width="0" height="0" rx="14" fill="#000"/>'
  + '</mask></defs>'
  + '<rect class="tour__dim" x="0" y="0" width="100%" height="100%" mask="url(#tour-cut)"/>'
  + '<rect class="tour__ring" x="0" y="0" width="0" height="0" rx="14" fill="none"/>'
  + '</svg>';

/* ==========================================================================
   Панель
   ========================================================================== */

let openPanel = null;

export function openTour(ctx) {
  if (openPanel) return openPanel;

  let step = 0;
  let raf = 0;
  let settle = 0;
  let tween = 0;
  let snap = 0;
  let placed = false;
  let radius = 14;
  const at = { x: 0, y: 0, w: 0, h: 0 };

  const root = h('.tour', {
    role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Экскурсия по приложению',
    tabindex: '-1',
  });
  const cameFrom = document.activeElement;
  const veil = h('.tour__veil');
  veil.innerHTML = VEIL;
  const cut = veil.querySelector('.tour__cut');
  const ring = veil.querySelector('.tour__ring');
  const card = h('.tour__card', { role: 'document' });
  const live = h('.sr-only', { 'aria-live': 'polite' });
  root.append(veil, card, live);
  document.body.appendChild(root);
  openPanel = root;

  document.addEventListener('keydown', onKey);
  window.addEventListener('resize', reposition);
  window.addEventListener('scroll', reposition, true);

  draw();
  root.focus({ preventScroll: true });
  return root;

  /* — Управление ————————————————————————————————— */

  function onKey(e) {
    if (e.key === 'Escape') { e.preventDefault(); close(true); }
    else if (e.key === 'ArrowRight') { e.preventDefault(); next(); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); goStep(step - 1); }
    else if (e.key === 'Enter' && !card.contains(document.activeElement)) { e.preventDefault(); next(); }
    else if (e.key === 'Tab') trap(e);
  }

  /** Пока идёт экскурсия, табуляция ходит по её же кнопкам. */
  function trap(e) {
    const stops = [...card.querySelectorAll('button')];
    if (!stops.length) return;
    const first = stops[0];
    const last = stops[stops.length - 1];
    const on = document.activeElement;
    if (!card.contains(on)) { e.preventDefault(); (e.shiftKey ? last : first).focus(); return; }
    if (e.shiftKey && on === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && on === last) { e.preventDefault(); first.focus(); }
  }

  function next() {
    if (STEPS[step].last) close(true); else goStep(step + 1);
  }

  function close(done) {
    if (root.classList.contains('is-out')) return;
    document.removeEventListener('keydown', onKey);
    window.removeEventListener('resize', reposition);
    window.removeEventListener('scroll', reposition, true);
    cancelAnimationFrame(raf);
    cancelAnimationFrame(tween);
    clearTimeout(settle);
    clearTimeout(snap);
    root.classList.add('is-out');
    setTimeout(() => { root.remove(); openPanel = null; }, 260);
    if (cameFrom && cameFrom.isConnected && cameFrom.focus) cameFrom.focus({ preventScroll: true });
    if (done) store.saveSettings({ tourSeen: true });
  }

  function goStep(n) {
    step = Math.max(0, Math.min(STEPS.length - 1, n));
    const s = STEPS[step];
    if (s.go && ctx && ctx.go) ctx.go(s.go);
    draw();
  }

  /* — Отрисовка ————————————————————————————————— */

  function draw() {
    const s = STEPS[step];
    card.replaceChildren();

    card.appendChild(h('.tour__head', null,
      h('.tour__pet', null, badgerNode(s.mood || 'talk')),
      h('div', { style: { flex: 1, minWidth: 0 } },
        h('.tour__count', null, `Шаг ${step + 1} из ${STEPS.length}`),
        h('h2.tour__title', null, s.title),
      ),
    ));

    for (const para of s.text.split('\n\n')) {
      card.appendChild(h('p.tour__text', null, para));
    }

    const dots = h('.tour__dots', { 'aria-hidden': 'true' });
    for (let i = 0; i < STEPS.length; i++) {
      dots.appendChild(h('span.tour__dot' + (i === step ? '.is-on' : i < step ? '.is-done' : '')));
    }
    card.appendChild(dots);

    const foot = h('.tour__foot');
    if (!s.last) {
      foot.appendChild(h('button.btn.btn--quiet.btn--sm.tour__skip', {
        type: 'button', onclick: () => { tap(); close(true); },
      }, 'Пропустить'));
    }
    if (step > 0) {
      foot.appendChild(h('button.btn.btn--ghost.btn--sm', {
        type: 'button', onclick: () => { tap(); goStep(step - 1); },
      }, 'Назад'));
    }
    foot.appendChild(h('button.btn.btn--primary.btn--sm', {
      type: 'button', onclick: () => { tap(); next(); },
    }, s.last ? 'Всё понятно' : 'Дальше'));
    card.appendChild(foot);

    card.appendChild(h('button.tour__close', {
      type: 'button', 'aria-label': 'Закрыть экскурсию',
      onclick: () => { tap(); close(true); },
    }, icon('close')));

    live.textContent = `Шаг ${step + 1} из ${STEPS.length}. ${s.title}`;

    /* экран мог только что перерисоваться: ищем цель с запасом */
    findTarget(s, 0);
  }

  /* Экран перерисовывается не мгновенно, поэтому цель ищем с запасом. */
  function findTarget(s, tries) {
    const el = s.sel ? document.querySelector(s.sel) : null;
    if (s.sel && !el && tries < 14) {
      setTimeout(() => findTarget(s, tries + 1), 70);
      return;
    }
    if (el && !s.fix) ensureVisible(el);
    /* Сразу, без ожидания кадра: иначе карточка мигает посреди экрана,
       а в фоновой вкладке кадры не приходят вовсе. */
    place(true);

    /* Разметка успокаивается не мгновенно: переход между экранами,
       шрифты, графики. Через миг примеряемся ещё раз. */
    clearTimeout(settle);
    settle = setTimeout(() => {
      if (STEPS[step] !== s) return;
      const now = s.sel ? document.querySelector(s.sel) : null;
      if (now && !s.fix) ensureVisible(now);
      place(true);
    }, 420);
  }

  /**
   * Подводит элемент в ту часть окна, которую не закроет карточка.
   * Прокрутка мгновенная: под затемнением её всё равно почти не видно,
   * зато подсветка не отстаёт от цели ни на кадр.
   */
  function ensureVisible(el) {
    const bottom = innerWidth < 760
      ? innerHeight - (card.offsetHeight || 240) - 96
      : innerHeight;
    /* Колонка дня липнет к экрану и на прокрутку отвечает не один к одному,
       поэтому подводим цель за несколько подходов, пока она не встанет. */
    for (let i = 0; i < 4; i++) {
      const r = el.getBoundingClientRect();
      if (r.top >= 12 && r.bottom <= bottom - 12) return;
      const want = Math.max(12, (bottom - r.height) / 2);
      const was = scrollY;
      scrollBy({ top: r.top - want, behavior: 'instant' });
      if (Math.abs(scrollY - was) < 1) return;
    }
  }

  function reposition() {
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(() => place(false));
  }

  /** Переезд подсветки. Кадры считаем сами: так вырез и обводка идут вместе. */
  function moveHole(x, y, w, h, animate) {
    cancelAnimationFrame(tween);
    const from = { ...at };
    const to = { x, y, w, h };
    Object.assign(at, to);

    const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!animate || !placed || still || document.hidden) {
      placed = true;
      paintHole(to);
      return;
    }

    /* Кадры приходят не всегда: фоновая вкладка, режим экономии,
       встроенный просмотрщик. Подсветка не должна из-за этого застрять
       на полпути, поэтому к сроку её в любом случае ставят на место. */
    clearTimeout(snap);
    snap = setTimeout(() => paintHole(to), 340);

    const t0 = performance.now();
    const frame = (now) => {
      const k = Math.min(1, (now - t0) / 300);
      const e = 1 - Math.pow(1 - k, 3);
      paintHole({
        x: from.x + (to.x - from.x) * e,
        y: from.y + (to.y - from.y) * e,
        w: from.w + (to.w - from.w) * e,
        h: from.h + (to.h - from.h) * e,
      });
      if (k < 1) tween = requestAnimationFrame(frame);
    };
    tween = requestAnimationFrame(frame);
  }

  function paintHole(r) {
    for (const n of [cut, ring]) {
      n.setAttribute('x', r.x);
      n.setAttribute('y', r.y);
      n.setAttribute('width', Math.max(0, r.w));
      n.setAttribute('height', Math.max(0, r.h));
      n.setAttribute('rx', radius);
    }
  }

  function place(animate) {
    const s = STEPS[step];
    const el = s.sel ? document.querySelector(s.sel) : null;

    if (!el) {
      root.classList.add('is-plain');
      card.style.left = ''; card.style.top = '';
      card.removeAttribute('data-arrow');
      placed = false;
      return;
    }
    root.classList.remove('is-plain');

    const pad = s.pad == null ? 8 : s.pad;
    const r = el.getBoundingClientRect();
    const x = Math.max(0, r.left - pad);
    const y = Math.max(0, r.top - pad);
    const w = Math.min(innerWidth - x, r.width + pad * 2);
    let hgt = Math.min(innerHeight - y, r.height + pad * 2);

    /* На узком экране карточка пришвартована внизу. Если высокая цель
       уходит под неё, обрезаем подсветку по краю карточки: рамка тогда
       выглядит намеренной, а не срезанной пополам. */
    if (innerWidth < 760) {
      const lid = card.getBoundingClientRect().top - 10;
      if (y < lid && y + hgt > lid) hgt = Math.max(72, lid - y);
    }

    /* Скругление берём у самого элемента, чтобы вырез повторял его форму.
       У прямоугольных блоков ставим своё: острые углы выглядят дырой. */
    const rad = parseFloat(getComputedStyle(el).borderTopLeftRadius) || 0;
    radius = Math.min(rad ? rad + pad : 14, w / 2, hgt / 2);
    moveHole(x, y, w, hgt, animate);

    /* Узкий экран: карточка пришвартована внизу, так она не пляшет. */
    if (innerWidth < 760) {
      card.style.left = ''; card.style.top = '';
      card.setAttribute('data-arrow', 'none');
      return;
    }

    const cw = card.offsetWidth || 420;
    const ch = card.offsetHeight || 240;
    const gap = 14;
    const m = 12;
    const under = y + hgt + gap;
    const over = y - ch - gap;

    if (under + ch <= innerHeight - m) { withArrow(under, 'up'); return; }
    if (over >= m) { withArrow(over, 'down'); return; }

    /* Высокая цель: ни сверху, ни снизу карточка не помещается. Ставим
       сбоку, иначе она ляжет поверх того, на что показывает. */
    const roomRight = innerWidth - (x + w) - gap - m;
    const roomLeft = x - gap - m;
    const side = roomRight >= cw ? x + w + gap
      : roomLeft >= cw ? x - cw - gap
        : (roomRight >= roomLeft ? innerWidth - cw - m : m);
    card.style.left = side + 'px';
    card.style.top = Math.max(m, Math.min(innerHeight - ch - m, y + hgt / 2 - ch / 2)) + 'px';
    card.setAttribute('data-arrow', 'none');

    function withArrow(top, arrow) {
      const left = Math.max(m, Math.min(innerWidth - cw - m, x + w / 2 - cw / 2));
      card.style.left = left + 'px';
      card.style.top = top + 'px';
      card.setAttribute('data-arrow', arrow);
      card.style.setProperty('--arrow-x',
        Math.max(22, Math.min(cw - 22, x + w / 2 - left)) + 'px');
    }
  }
}

/** Показать один раз новичку: после знакомства и до первой записи. */
export function maybeOpenTour(ctx) {
  const st = store.state.settings;
  if (!st || st.tourSeen) return;
  if (!store.state.profile || !store.state.profile.onboarded) return;
  setTimeout(() => openTour(ctx), 700);
}
