/* ==========================================================================
   Календарь-тепловая карта.

   Цвет мочи, самочувствие и температуру приложение собирает каждый день,
   но до сих пор показывало только сегодняшний выбор. Здесь видно месяц
   целиком: две тёмные недели подряд или провал настроения читаются сразу.

   Приложение по-прежнему ничего не интерпретирует — просто раскрашивает
   то, что пациент записал.
   ========================================================================== */

import {
  h, icon, sheet, tap, today, iso, parseISO, daysBetween,
  fmtDate, fmtMonthYear, fmtRelative, plural,
} from '../ui.js';
import * as store from '../store.js';
import { URINE, URINE_ON, MOODS, SYMPTOMS, fmtNum } from '../catalog.js';
import { labsNav } from './labsnav.js';
import { openCheckIn } from './checkin.js';

/* — Что раскрашиваем ————————————————————————————— */

const METRICS = [
  {
    id: 'mood', label: 'Самочувствие', icon: 'heart',
    get: (d) => d && d.mood,
    color: (v) => MOODS[v - 1].css,
    legend: () => MOODS.map((m) => ({ css: m.css, label: m.face })),
    hint: 'От «плохо» до «отлично»',
    describe: (v) => MOODS[v - 1].label,
  },
  {
    id: 'temp', label: 'Температура', icon: 'thermo',
    get: (d) => (d && d.temp != null ? d.temp : null),
    color: (v) => (v >= 38 ? 'var(--alert)' : v >= 37.5 ? 'var(--warn)'
      : v >= 37 ? 'var(--urine-2)' : 'var(--accent-soft)'),
    legend: () => [
      { css: 'var(--accent-soft)', label: 'до 37' },
      { css: 'var(--urine-2)', label: '37,0' },
      { css: 'var(--warn)', label: '37,5' },
      { css: 'var(--alert)', label: '38+' },
    ],
    hint: 'Отмечена не каждый день — это нормально',
    describe: (v) => fmtNum(v, 1) + ' °C',
  },
];

const WD = ['пн', 'вт', 'ср', 'чт', 'пт', 'сб', 'вс'];

let metricId = 'mood';
let monthsBack = 0;          // 0 — текущий месяц

/* ==========================================================================
   Экран
   ========================================================================== */

export function renderCalendar(ctx) {
  const S = ctx.screen;

  /* Ссылка вида #/trends/calendar/urine открывает нужный показатель:
     полоса цвета мочи на главной ведёт сюда напрямую. */
  const asked = ctx.route && ctx.route.param;
  if (asked && METRICS.some((m) => m.id === asked)) metricId = asked;

  const metric = METRICS.find((m) => m.id === metricId) || METRICS[0];

  S.appendChild(labsNav(ctx, 'cal'));

  /* — Переключатель показателя — */
  const chips = h('.chips.chips--scroll', { style: { marginTop: 'var(--sp-4)' } });
  for (const m of METRICS) {
    chips.appendChild(h('button.chip', {
      type: 'button',
      'aria-pressed': m.id === metricId ? 'true' : 'false',
      onclick: () => { tap(); metricId = m.id; ctx.rerender(); },
    }, icon(m.icon), m.label));
  }
  S.appendChild(chips);

  /* — Навигация по месяцам — */
  const base = monthStart(today(), -monthsBack);
  const shownMonths = window.innerWidth >= 1024 ? 3 : 1;
  const oldest = monthStart(today(), -(monthsBack + shownMonths - 1));
  const navTitle = shownMonths > 1
    ? capitalize(fmtMonthYear(oldest)) + ' — ' + fmtMonthYear(base)
    : capitalize(fmtMonthYear(base));

  S.appendChild(h('.section', null,
    h('.cal-nav', null,
      h('button.cal-nav__btn', {
        type: 'button', 'aria-label': 'Предыдущий месяц',
        onclick: () => { tap(); monthsBack++; ctx.rerender(); },
      }, icon('back')),
      h('.cal-nav__title', null, navTitle),
      h('button.cal-nav__btn', {
        type: 'button', 'aria-label': 'Следующий месяц',
        disabled: monthsBack === 0,
        onclick: () => { tap(); monthsBack = Math.max(0, monthsBack - 1); ctx.rerender(); },
      }, icon('chevron')),
    ),
  ));

  /* — Сетки месяцев: на широком экране рядом, слева направо по времени — */
  const deck = h('.deck');
  const count = window.innerWidth >= 1024 ? 3 : 1;
  for (let i = count - 1; i >= 0; i--) {
    deck.appendChild(monthCard(monthStart(today(), -(monthsBack + i)), metric, ctx, count > 1));
  }
  S.appendChild(h('.section', null, deck));

  /* — Легенда и сводка — */
  S.appendChild(h('.section', null,
    h('.card.card--tight.stack.stack--sm', null,
      h('div', null,
        h('.field__label', { style: { margin: 0 } }, metric.label),
        h('.list__s', null, metric.hint),
      ),
      h('.cal-legend', null, ...metric.legend().map((l) => h('.cal-legend__item', null,
        h('span.cal-legend__sw', { style: { background: l.css } }),
        h('span', null, l.label),
      ))),
      h('.hr', { style: { margin: '6px 0' } }),
      h('.cal-legend', null,
        h('.cal-legend__item', null, h('span.cal-day__inf', { style: { position: 'static' } }), 'день инфузии'),
        h('.cal-legend__item', null, h('span.cal-day__lab', { style: { position: 'static' } }), 'сдавали анализы'),
      ),
    ),
  ));

  S.appendChild(statsCard(base, metric));

  S.appendChild(h('p.disclaimer', null,
    'Календарь показывает только то, что вы отметили. Выводы делает врач.'));

  return { title: 'Календарь', sub: metric.label };
}

/* — Карточка месяца ————————————————————————————— */

function monthCard(first, metric, ctx, withTitle) {
  const card = h('.card.cal-card');
  /* при одном месяце название уже стоит в строке навигации */
  if (withTitle) card.appendChild(h('.cal-card__title', null, capitalize(fmtMonthYear(first))));

  const head = h('.cal-grid.cal-grid--head');
  for (const w of WD) head.appendChild(h('.cal-wd', null, w));
  card.appendChild(head);

  const grid = h('.cal-grid');
  const d0 = parseISO(first);
  /* понедельник — первый столбец */
  const lead = (d0.getDay() + 6) % 7;
  for (let i = 0; i < lead; i++) grid.appendChild(h('.cal-day.cal-day--empty'));

  const daysInMonth = new Date(d0.getFullYear(), d0.getMonth() + 1, 0).getDate();
  const t = today();
  let shown = 0;

  for (let day = 1; day <= daysInMonth; day++) {
    const date = iso(new Date(d0.getFullYear(), d0.getMonth(), day));
    const future = date > t;
    const rec = store.dayRecord(date);
    const value = future ? null : metric.get(rec);

    const cell = h('button.cal-day', {
      type: 'button',
      disabled: future,
      style: {
        animationDelay: Math.min(shown * 9, 280) + 'ms',
        background: value != null ? metric.color(value) : '',
      },
      'aria-label': value != null
        ? `${fmtDate(date)}: ${metric.describe(value)}`
        : `${fmtDate(date)}: нет отметки`,
      onclick: () => { tap(); openDay(date, ctx); },
    });

    if (value != null) cell.classList.add('is-filled');
    if (metricId === 'urine' && value >= 5) cell.classList.add('is-dark');
    if (metricId === 'mood' && value != null) cell.classList.add('is-dark');
    if (metricId === 'temp' && value >= 37.5) cell.classList.add('is-dark');
    if (date === t) cell.classList.add('is-today');
    if (future) cell.classList.add('cal-day--future');

    cell.appendChild(h('span.cal-day__n', null, String(day)));
    if (store.state.infusions.some((i) => i.done && i.date === date)) {
      cell.appendChild(h('span.cal-day__inf'));
    }
    if (store.state.labs.some((l) => l.date === date)) {
      cell.appendChild(h('span.cal-day__lab'));
    }

    grid.appendChild(cell);
    shown++;
  }

  card.appendChild(grid);
  return card;
}

/* — Сводка за месяц ————————————————————————————— */

function statsCard(first, metric) {
  const d0 = parseISO(first);
  const last = iso(new Date(d0.getFullYear(), d0.getMonth() + 1, 0));
  const t = today();
  const to = last > t ? t : last;

  const days = store.state.daily.filter((d) => d.date >= first && d.date <= to);
  const total = daysBetween(first, to) + 1;
  const filled = days.filter((d) => metric.get(d) != null).length;

  const rows = [];
  rows.push(['Отмечено дней', `${filled} из ${total}`]);

  if (metricId === 'urine') {
    const dark = days.filter((d) => d.urine >= 4).length;
    if (dark) rows.push(['Тёмных оттенков (4–6)', plural(dark, 'день', 'дня', 'дней')]);
  }
  if (metricId === 'temp') {
    const fever = days.filter((d) => d.temp >= 37.5).length;
    rows.push(['Дней с температурой 37,5+', fever ? plural(fever, 'день', 'дня', 'дней') : 'нет']);
  }
  if (metricId === 'mood') {
    const low = days.filter((d) => d.mood <= 2).length;
    if (low) rows.push(['Дней «плохо» и «так себе»', plural(low, 'день', 'дня', 'дней')]);
  }

  const syms = {};
  for (const d of days) for (const s of d.symptoms || []) syms[s] = (syms[s] || 0) + 1;
  const topSym = Object.entries(syms).sort((a, b) => b[1] - a[1]).slice(0, 3);

  return h('.section', null,
    h('.card.card--pad0', null,
      ...rows.map(([k, v]) => h('.list__item', null,
        h('.list__body', null, h('.list__t', null, k)),
        h('b.num', null, v),
      )),
      topSym.length ? h('.list__item', null,
        h('.list__body', null,
          h('.list__t', null, 'Чаще всего отмечали'),
          h('.list__s', null, topSym
            .map(([id, n]) => `${(SYMPTOMS.find((s) => s.id === id) || {}).name || id} — ${n}`)
            .join(' · ')),
        ),
      ) : null,
    ),
  );
}

/* — День ————————————————————————————————————————— */

function openDay(date, ctx) {
  const d = store.dayRecord(date);
  const labs = store.state.labs.filter((l) => l.date === date);
  const inf = store.state.infusions.find((i) => i.done && i.date === date);

  sheet({
    title: capitalize(fmtDate(date, { year: true })),

    /* Забыть отметиться — самый частый сбой любого дневника, и до сих
       пор исправить это было нечем: карточка дня только показывала.
       Опрос умеет открываться за любую дату, не хватало входа. */
    foot: date > today() ? null : (api) => h('button.btn.btn--primary.btn--block', {
      type: 'button',
      onclick: () => { api.close(); openCheckIn(ctx, { date }); },
    }, icon(d ? 'edit' : 'plus'), d ? 'Изменить отметки' : 'Отметить день'),

    body: h('.stack', null,
      h('.list__s', { style: { marginTop: '-6px' } }, fmtRelative(date)),

      !d && !labs.length && !inf
        ? h('.empty', null,
            h('.empty__t', null, 'В этот день ничего не записано'),
            h('.empty__s', null, date <= today()
              ? 'Это можно поправить — заполните день ниже.'
              : 'День ещё не наступил.'),
          )
        : null,

      d ? h('.card.card--pad0', null,
          row('Самочувствие', d.mood ? MOODS[d.mood - 1].face + ' ' + MOODS[d.mood - 1].label : null),
          URINE_ON ? row('Цвет мочи', d.urine ? URINE[d.urine - 1].label : null) : null,
          row('Температура', d.temp != null ? fmtNum(d.temp, 1) + ' °C' : null),
          row('Сон', d.sleep ? d.sleep + ' из 5' : null),
          row('Нагрузка', d.load ? d.load + ' из 5' : null),
          row('Стресс', d.stress ? d.stress + ' из 5' : null),
        ) : null,

      (d && (d.symptoms || []).length) ? h('div', null,
        h('.field__label', { style: { marginBottom: '6px' } }, 'Что беспокоило'),
        h('.chips', null, ...d.symptoms.map((id) => {
          const s = SYMPTOMS.find((x) => x.id === id);
          return h('span.chip.is-on', null, s ? s.icon : '•', s ? s.name : id);
        })),
      ) : null,

      inf ? h('.card.card--accent.row', null,
        h('.list__ico', { style: { background: 'var(--surface)' } }, icon('droplet')),
        h('.list__body', null,
          h('.list__t', null, 'Инфузия'),
          h('.list__s', null, inf.place || 'проведена'),
        ),
      ) : null,

      ...labs.map((l) => h('button.card.card--tight.row', {
        type: 'button', style: { width: '100%', textAlign: 'left' },
        onclick: () => { ctx.go('labs/item/' + l.id); },
      },
        h('.list__ico', null, icon('flask')),
        h('.list__body', null,
          h('.list__t', null, 'Анализы сданы'),
          h('.list__s', null, l.lab || 'открыть запись'),
        ),
        icon('chevron'),
      )),
    ),
  });

  function row(label, value) {
    if (!value) return null;
    return h('.list__item', null,
      h('.list__body', null, h('.list__t', null, label)),
      h('b', null, value),
    );
  }
}

/* — Мелочи ——————————————————————————————————————— */

function monthStart(fromISO, deltaMonths) {
  const d = parseISO(fromISO);
  return iso(new Date(d.getFullYear(), d.getMonth() + deltaMonths, 1));
}

function capitalize(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
