/* ==========================================================================
   «Динамика»: графики с полосой референса лаборатории,
   вертикальные метки инфузий, общая временная ось событий под графиками.
   ========================================================================== */

import {
  h, icon, sheet, today, addDays, fmtDate, fmtRelative, daysBetween, tap,
} from '../ui.js';
import * as store from '../store.js';
import { lineChart, eventRail } from '../charts.js';
import { CHART_KEYS, EVENT_TYPES, analyte, fmtNum, evaluate, refText } from '../catalog.js';
import { renderCalendar } from './calendar.js';
import { labsNav } from './labsnav.js';

const PERIODS = [
  { id: '1m',  label: '1 мес', days: 31 },
  { id: '3m',  label: '3 мес', days: 92 },
  { id: '6m',  label: '6 мес', days: 183 },
  { id: '1y',  label: 'год',   days: 366 },
  { id: 'all', label: 'всё',   days: null },
];

let periodId = '3m';

export default function renderTrends(ctx) {
  if (ctx.route.sub === 'calendar') return renderCalendar(ctx);

  const S = ctx.screen;
  const focusKey = ctx.route.sub || null;

  /* На общем экране показываем переключатель представлений; когда
     открыт один показатель, это уже уровень ниже. */
  if (!focusKey) S.appendChild(labsNav(ctx, 'charts'));

  const keys = focusKey ? [focusKey] : CHART_KEYS.filter((k) => store.series(k).length > 0);

  /* — Переключатель периода — */
  const period = PERIODS.find((p) => p.id === periodId) || PERIODS[1];
  const from = period.days ? addDays(today(), -period.days) : firstDataDate();
  const to = today();

  const chips = h('.chips.chips--scroll');
  for (const p of PERIODS) {
    chips.appendChild(h('button.chip', {
      type: 'button',
      'aria-pressed': p.id === periodId ? 'true' : 'false',
      onclick: () => { tap(); periodId = p.id; ctx.rerender(); },
    }, p.label));
  }
  S.appendChild(h('.row', {
    style: { gap: 'var(--sp-2)', alignItems: 'center', marginTop: 'var(--sp-4)' },
  }, chips));

  if (!keys.length) {
    S.appendChild(h('.empty', null,
      h('.empty__t', null, 'Графики появятся после анализов'),
      h('.empty__s', null, 'Добавьте пару сдач — и здесь будет видно, как менялись показатели.'),
      h('button.btn.btn--primary', { type: 'button', onclick: () => ctx.go('labs') },
        icon('plus'), 'Добавить анализ'),
    ));
    return { title: 'Динамика' };
  }

  const infusionDates = store.state.infusions
    .filter((i) => i.done && i.date >= from && i.date <= to)
    .map((i) => i.date);

  /* — Графики: на широком экране встают в два столбца — */
  const wrap = h('.deck');
  for (const key of keys) {
    const data = store.series(key, from)
      .filter((s) => s.date <= to)
      .map((s) => ({ ...s, cycleDay: cycleDayOf(s.date) }));
    wrap.appendChild(chartCard(key, data, infusionDates, from, to, ctx, !!focusKey));
  }
  S.appendChild(h('.section', null, wrap));

  /* — Общая ось событий — */
  S.appendChild(h('.section', null,
    h('.section__head', null,
      h('.section__title', null, 'События'),
      h('.badge.badge--quiet', null, `${fmtDate(from)} — ${fmtDate(to)}`),
    ),
    h('.card.card--tight', null,
      eventRail({
        events: collectEvents(from, to),
        from, to,
        onPick: (items) => openEvents(items),
      }),
      h('.row', { style: { justifyContent: 'space-between', fontSize: 'var(--t-xs)', color: 'var(--ink-3)', marginTop: '2px' } },
        h('span', null, fmtDate(from)),
        h('span', null, 'касание значка — подробности'),
        h('span', null, fmtDate(to)),
      ),
    ),
  ));

  /* — Легенда — */
  S.appendChild(h('.section', null,
    h('.card.card--flat.card--tight.stack.stack--sm', null,
      legendRow('var(--accent-soft)', 'Полоса — норма лаборатории'),
      legendRow('var(--accent-bright)', 'Вертикальные линии — инфузии', true),
    ),
  ));

  S.appendChild(h('p.disclaimer', null,
    'Графики показывают только то, что вы записали. Выводы делает врач.'));

  return {
    title: focusKey ? analyte(focusKey).name : 'Динамика',
    sub: focusKey ? refText(focusKey) + ' ' + analyte(focusKey).unit : null,
  };
}

function legendRow(color, text, dashed = false) {
  return h('.row', { style: { gap: '10px' } },
    h('span', {
      style: {
        width: '20px', height: dashed ? '0' : '12px', flex: 'none', borderRadius: '3px',
        background: dashed ? 'none' : color,
        borderTop: dashed ? `2px dashed ${color}` : 'none',
      },
    }),
    h('span', { style: { fontSize: 'var(--t-sm)', color: 'var(--ink-2)' } }, text),
  );
}

/* — Карточка графика ————————————————————————————— */

function chartCard(key, data, infusions, from, to, ctx, focused) {
  const a = analyte(key);
  const last = data.length ? data[data.length - 1] : null;
  const ev = last ? evaluate(key, last.value, store.state.thresholds) : { level: 'ok' };
  const th = store.state.thresholds[key] || null;

  const card = h('.card.chart-card');
  card.appendChild(h('.chart-head', null,
    h('.chart-name', null, a.name),
    h('.chart-unit', null, a.unit),
    last ? h('.chart-last', {
      style: {
        color: ev.level === 'alert' ? 'var(--alert)' : ev.level === 'warn' ? 'var(--warn)' : 'var(--ink)',
      },
    }, fmtNum(last.value, a.dec)) : null,
  ));

  card.appendChild(lineChart({
    key, data, infusions, from, to,
    threshold: th && (th.min != null || th.max != null) ? th : null,
    height: focused ? 230 : 168,
  }));

  if (!focused) {
    card.addEventListener('dblclick', () => ctx.go('trends/' + key));
  }
  if (last) {
    card.appendChild(h('.chart-foot', null,
      h('span', null, `Референс ${refText(key)} ${a.unit}`),
      h('span', null, 'последнее ' + fmtRelative(last.date)),
    ));
  }
  return card;
}

/* — События ————————————————————————————————————— */

function collectEvents(from, to) {
  const out = [];
  for (const e of store.state.events) {
    if (e.date < from || e.date > to) continue;
    if (e.type === 'infusion') continue;      // инфузии уже показаны линиями
    const t = EVENT_TYPES[e.type] || { name: e.type, icon: '•', tone: '' };
    out.push({ ...e, name: t.name, icon: t.icon, tone: t.tone });
  }
  /* температура из дневника — тоже событие на оси */
  for (const d of store.state.daily) {
    if (d.date < from || d.date > to) continue;
    if (d.temp != null && d.temp >= 37.5) {
      out.push({
        id: 'temp_' + d.date, date: d.date, type: 'fever',
        name: 'Температура ' + fmtNum(d.temp, 1), icon: '🌡️', tone: 'warn',
        note: (d.symptoms || []).length ? 'Симптомы отмечены' : '',
      });
    }
  }
  /* убираем дубли одного типа в один день */
  const seen = new Set();
  return out.filter((e) => {
    const k = e.date + '|' + e.type;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  }).sort((a, b) => (a.date < b.date ? -1 : 1));
}

function openEvents(items) {
  const list = Array.isArray(items) ? items : [items];
  const single = list.length === 1;

  sheet({
    title: single ? list[0].name : `События · ${list.length}`,
    body: h('.stack', null,
      ...list.map((e) => {
        const day = store.dayRecord(e.date);
        return h('.card.card--tight.stack.stack--sm', null,
          h('.row', null,
            h('.list__ico' + (e.tone === 'alert' ? '.list__ico--alert'
              : e.tone === 'warn' ? '.list__ico--warm' : '.list__ico--neutral'),
              { style: { fontSize: '19px' } }, e.icon),
            h('.list__body', null,
              h('.list__t', null, e.name),
              h('.list__s', null, fmtDate(e.date, { year: true }) + ' · ' + fmtRelative(e.date)),
            ),
          ),
          e.note ? h('div', { style: { fontSize: 'var(--t-sm)', lineHeight: 1.45 } }, e.note) : null,
          single && day ? dayCard(day) : null,
        );
      }),
    ),
  });
}

function dayCard(day) {
  const bits = [];
  if (day.temp != null) bits.push(['Температура', fmtNum(day.temp, 1) + ' °C']);
  if (day.mood) bits.push(['Самочувствие', ['плохо', 'так себе', 'нормально', 'хорошо', 'отлично'][day.mood - 1]]);
  if (day.urine) bits.push(['Цвет мочи', 'ступень ' + day.urine + ' из 6']);
  if (day.sleep) bits.push(['Сон', day.sleep + ' из 5']);
  if (day.load) bits.push(['Нагрузка', day.load + ' из 5']);
  if (day.stress) bits.push(['Стресс', day.stress + ' из 5']);
  if (!bits.length) return null;

  return h('.card.card--pad0', null, ...bits.map(([k, v]) => h('.list__item', null,
    h('.list__body', null, h('.list__t', null, k)),
    h('b.num', null, v),
  )));
}

/* — Мелочи ——————————————————————————————————————— */

function firstDataDate() {
  const dates = [
    ...store.state.labs.map((l) => l.date),
    ...store.state.infusions.filter((i) => i.done).map((i) => i.date),
  ].sort();
  return dates[0] || addDays(today(), -30);
}

function cycleDayOf(dateISO) {
  const infs = store.state.infusions.filter((i) => i.done && i.date <= dateISO);
  if (!infs.length) return null;
  const d = daysBetween(infs[infs.length - 1].date, dateISO) + 1;
  return d > 0 && d <= (store.state.profile.interval || 14) + 7 ? d : null;
}
