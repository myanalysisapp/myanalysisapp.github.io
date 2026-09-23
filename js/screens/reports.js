/* ==========================================================================
   Отчёты. Формируются прямо в браузере, без интернета.
   Печать — через штатную печать браузера с отдельной вёрсткой (print.css).
   ========================================================================== */

import {
  h, icon, sheet, toast, today, addDays, fmtDate, fmtDateShort, daysBetween, frag, plural,
  printNode,
} from '../ui.js';
import * as store from '../store.js';
import { analyte, fmtNum, refText, evaluate, EVENT_TYPES, therapyName } from '../catalog.js';
import { lineChart } from '../charts.js';

const HEM_KEYS = ['hb', 'plt', 'wbc', 'anc', 'retic', 'ldh', 'bil_t', 'bil_i', 'creat'];

const PERIODS = [
  { id: '3m', label: '3 месяца', days: 92 },
  { id: '6m', label: '6 месяцев', days: 183 },
  { id: '1y', label: 'год', days: 366 },
  { id: 'all', label: 'всё время', days: null },
];
let periodId = '6m';

export function renderReports(ctx) {
  const S = ctx.screen;

  S.appendChild(h('.section', { style: { marginTop: 'var(--sp-4)' } },
    h('.card__sub', { style: { marginTop: 0 } },
      'Отчёт собирается на вашем устройстве. Можно распечатать, сохранить в PDF ' +
      'или отправить — ничего не уходит в интернет без вашей команды.'),
  ));

  const chips = h('.chips.chips--scroll');
  for (const p of PERIODS) {
    chips.appendChild(h('button.chip', {
      type: 'button', 'aria-pressed': p.id === periodId ? 'true' : 'false',
      onclick: () => { periodId = p.id; ctx.rerender(); },
    }, p.label));
  }
  S.appendChild(h('.section', null,
    h('.section__head', null, h('.section__title', null, 'Период')),
    chips,
  ));

  S.appendChild(h('.section', null,
    h('.card.card--pad0', null,
      reportRow('doc', 'Гематологический лист',
        'Хронологическая таблица на А4 — её просят при госпитализации',
        () => openReport(ctx, 'hematology')),
      reportRow('droplet', 'Лист трансфузий',
        'Дата, компонент, показатели до и после',
        () => openReport(ctx, 'transfusions')),
      reportRow('pulse', 'Сводка для врача',
        'Одна страница: графики, инфузии, эпизоды, вопросы',
        () => openReport(ctx, 'summary')),
    ),
  ));

  S.appendChild(h('p.disclaimer', null,
    'Сервис — вспомогательный инструмент для ведения дневника и не заменяет консультацию врача.'));

  return {};
}

function reportRow(ico, title, sub, onClick) {
  return h('button.list__item', { type: 'button', onclick: onClick },
    h('.list__ico', null, icon(ico)),
    h('.list__body', null,
      h('.list__t', null, title),
      h('.list__s', null, sub),
    ),
    icon('chevron'),
  );
}

/* ==========================================================================
   Предпросмотр и печать
   ========================================================================== */

function periodRange() {
  const p = PERIODS.find((x) => x.id === periodId) || PERIODS[1];
  const to = today();
  const from = p.days ? addDays(to, -p.days) : '1900-01-01';
  return { from, to, label: p.label };
}

function openReport(ctx, kind) {
  const { from, to, label } = periodRange();
  const builders = { hematology: buildHematology, transfusions: buildTransfusions, summary: buildSummary };
  const titles = {
    hematology: 'Гематологический лист',
    transfusions: 'Лист трансфузий',
    summary: 'Сводка для врача',
  };

  const paper = builders[kind]({ from, to, label });

  sheet({
    title: titles[kind],
    wide: true,
    body: h('.stack', null,
      h('.field__hint.no-print', null,
        'Предпросмотр. При печати шапка таблицы повторяется на каждой странице.'),
      paper,
    ),
    foot: (api) => frag(
      h('button.btn.btn--ghost', {
        type: 'button',
        onclick: () => sharePaper(titles[kind], paper),
      }, icon('share'), 'Поделиться'),
      h('button.btn.btn--primary', {
        type: 'button',
        onclick: () => printNode(paper),
      }, icon('print'), 'Печать / PDF'),
    ),
  });
}

/** Web Share API, если есть; иначе — копия в буфер. */
async function sharePaper(title, paper) {
  const text = paperToText(paper);
  try {
    if (navigator.share) {
      await navigator.share({ title: `${title} — Мой Анализ`, text });
      return;
    }
  } catch (e) {
    if (e && e.name === 'AbortError') return;
  }
  try {
    await navigator.clipboard.writeText(text);
    toast('Скопировано в буфер обмена', { icon: 'check' });
  } catch (_) {
    toast('Поделиться не получилось — используйте печать в PDF', { icon: 'info' });
  }
}

function paperToText(paper) {
  const lines = [];
  for (const node of paper.querySelectorAll('.rep-h1, .rep-h2, .rep-meta, .rep-line, table')) {
    if (node.tagName === 'TABLE') {
      for (const tr of node.querySelectorAll('tr')) {
        lines.push([...tr.children].map((td) => td.textContent.trim()).join('\t'));
      }
    } else {
      lines.push(node.textContent.trim());
    }
  }
  return lines.filter(Boolean).join('\n');
}

/* — Общая шапка листа ————————————————————————————— */

function paperHead(title, { from, to, label }) {
  const p = store.state.profile;
  const s = store.state.safety;
  return frag(
    h('.rep-h1', null, title),
    h('.rep-meta', null, [
      s.fullName || p.name || 'Пациент',
      p.birthYear ? `${new Date().getFullYear() - p.birthYear} лет` : null,
      p.diseaseName,
    ].filter(Boolean).join(' · ')),
    h('.rep-meta', null,
      `Период: ${from === '1900-01-01' ? 'всё время' : fmtDateShort(from) + ' — ' + fmtDateShort(to)}` +
      ` (${label}). Терапия: ${therapyName(p)}, каждые ${plural(p.interval, 'день', 'дня', 'дней')}.`),
    h('.rep-meta', null, `Сформировано ${fmtDate(today(), { year: true })} в приложении «Мой Анализ».`),
  );
}

/* ==========================================================================
   Гематологический лист
   ========================================================================== */

function buildHematology(range) {
  const paper = h('.report-paper');
  paper.appendChild(paperHead('Гематологический лист', range));

  /* Несколько сдач за один день сводим в одну строку: врачу нужна
     строка на дату, а не по записи в дневнике. */
  const byDate = new Map();
  for (const l of store.state.labs) {
    if (l.date < range.from || l.date > range.to) continue;
    if (!HEM_KEYS.some((k) => l.values && l.values[k] != null)) continue;
    const row = byDate.get(l.date) || { date: l.date, values: {}, beforeInfusion: false, labs: new Set() };
    for (const k of HEM_KEYS) {
      if (l.values[k] != null && l.values[k] !== '') row.values[k] = l.values[k];
    }
    row.beforeInfusion = row.beforeInfusion || !!l.beforeInfusion;
    if (l.lab) row.labs.add(l.lab);
    byDate.set(l.date, row);
  }
  const labs = [...byDate.values()].sort((a, b) => (a.date < b.date ? -1 : 1));

  if (!labs.length) {
    paper.appendChild(h('.rep-line', { style: { marginTop: '14px' } },
      'За выбранный период нет анализов с этими показателями.'));
    return paper;
  }

  /* Даты идут столбцами, показатели строками. Так лист читается как
     привычная врачу выписка: взгляд ведёт по строке одного показателя
     и видит его ход во времени, а не прыгает по колонкам. */
  const table = h('table.rep-table.rep-table--wide');

  const thead = h('thead');
  const hr = h('tr');
  hr.appendChild(h('th', null, 'Показатель'));
  for (const l of labs) {
    hr.appendChild(h('th', null,
      fmtDateShort(l.date),
      l.beforeInfusion ? h('small', null, 'до инфузии') : null,
      cycleDayOf(l.date) ? h('small', null, 'д. ' + cycleDayOf(l.date)) : null,
    ));
  }
  thead.appendChild(hr);
  table.appendChild(thead);

  const tbody = h('tbody');
  for (const k of HEM_KEYS) {
    /* показатель, которого нет ни в одной сдаче, строкой не занимаем */
    if (!labs.some((l) => l.values[k] != null && l.values[k] !== '')) continue;
    const a = analyte(k);
    const tr = h('tr');
    tr.appendChild(h('th.rep-table__k', { scope: 'row' }, a.short,
      h('small', null, refText(k)),
      h('small', null, a.unit)));
    for (const l of labs) {
      const v = l.values[k];
      if (v == null || v === '') { tr.appendChild(h('td', null, '—')); continue; }
      const ev = evaluate(k, v, store.state.thresholds);
      const cls = ev.dir === 'low' ? 'lo' : ev.dir === 'high' ? 'hi' : '';
      tr.appendChild(h('td' + (cls ? '.' + cls : ''), null, fmtNum(v, a.dec)));
    }
    tbody.appendChild(tr);
  }
  table.appendChild(tbody);

  /* Столбцов бывает больше, чем влезает в лист: на экране таблица
     прокручивается вбок, на печати колонки ужимаются сами. */
  paper.appendChild(h('.rep-scroll', null, table));

  paper.appendChild(h('.rep-foot', null,
    'Референсные значения указаны по шаблону и могут отличаться от значений вашей лаборатории — ' +
    'уточняйте по бланку. Отклонения выделены жирным (↓ ниже, ↑ выше). ' +
    'Документ сформирован пациентом и не является медицинским заключением.'));
  return paper;
}

/* ==========================================================================
   Лист трансфузий
   ========================================================================== */

function buildTransfusions(range) {
  const paper = h('.report-paper');
  paper.appendChild(paperHead('Лист трансфузий', range));

  const rows = store.state.transfusions.filter((t) => t.date >= range.from && t.date <= range.to);
  if (!rows.length) {
    paper.appendChild(h('.rep-line', { style: { marginTop: '14px' } },
      'За выбранный период переливаний не записано.'));
    return paper;
  }

  const table = h('table.rep-table');
  table.appendChild(h('thead', null, h('tr', null,
    h('th', null, 'Дата'),
    h('th', null, 'Компонент'),
    h('th', null, 'Объём'),
    h('th', null, 'Hb до', h('small', null, 'г/л')),
    h('th', null, 'Hb после', h('small', null, 'г/л')),
    h('th', null, 'Тром. до', h('small', null, '×10⁹/л')),
    h('th', null, 'Тром. после', h('small', null, '×10⁹/л')),
    h('th', null, 'Где'),
    h('th', null, 'Прим.'),
  )));

  const tbody = h('tbody');
  for (const t of rows) {
    tbody.appendChild(h('tr', null,
      h('td', null, fmtDateShort(t.date)),
      h('td', null, t.component || '—'),
      h('td', null, t.volume || '—'),
      h('td', null, t.hbBefore != null ? fmtNum(t.hbBefore, 0) : '—'),
      h('td', null, t.hbAfter != null ? fmtNum(t.hbAfter, 0) : '—'),
      h('td', null, t.pltBefore != null ? fmtNum(t.pltBefore, 0) : '—'),
      h('td', null, t.pltAfter != null ? fmtNum(t.pltAfter, 0) : '—'),
      h('td', null, t.place || '—'),
      h('td', null, t.note || '—'),
    ));
  }
  table.appendChild(tbody);
  paper.appendChild(table);

  paper.appendChild(h('.rep-foot', null,
    'Документ сформирован пациентом в приложении «Мой Анализ» и не является медицинским заключением.'));
  return paper;
}

/* ==========================================================================
   Сводка для врача
   ========================================================================== */

function buildSummary(range) {
  const paper = h('.report-paper');
  paper.appendChild(paperHead('Сводка для врача', range));

  /* — Ключевые показатели — */
  paper.appendChild(h('.rep-h2', null, 'Ключевые показатели'));
  const grid = h('div', { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' } });
  const infusions = store.state.infusions
    .filter((i) => i.done && i.date >= range.from && i.date <= range.to).map((i) => i.date);

  for (const key of ['hb', 'ldh', 'plt', 'bil_t']) {
    const data = store.series(key, range.from).filter((s) => s.date <= range.to);
    if (!data.length) continue;
    const a = analyte(key);
    const last = data[data.length - 1];
    const block = h('div.rep-block', { style: { border: '1px solid #D7D2CA', borderRadius: '6px', padding: '6px 8px' } });
    block.appendChild(h('div', { style: { fontSize: '10px', fontWeight: 700 } },
      `${a.name}, ${a.unit} — последнее ${fmtNum(last.value, a.dec)} (${fmtDateShort(last.date)})`));
    block.appendChild(h('div', { style: { fontSize: '9px', color: '#6A716D', marginBottom: '2px' } },
      `норма ${refText(key)}`));
    block.appendChild(lineChart({
      key, data, infusions, from: range.from, to: range.to,
      threshold: store.state.thresholds[key] || null,
      height: 96, showAxis: true,
    }));
    grid.appendChild(block);
  }
  paper.appendChild(grid);

  /* — Инфузии — */
  paper.appendChild(h('.rep-h2', null, 'Инфузии за период'));
  const infList = store.state.infusions
    .filter((i) => i.done && i.date >= range.from && i.date <= range.to);
  paper.appendChild(h('.rep-line', { style: { fontSize: '11px' } },
    infList.length
      ? `${infList.length} шт.: ` + infList.map((i) => fmtDateShort(i.date)).join(', ')
      : 'Отметок нет'));

  /* — Эпизоды и события — */
  paper.appendChild(h('.rep-h2', null, 'События и эпизоды'));
  const evs = store.state.events
    .filter((e) => e.date >= range.from && e.date <= range.to && e.type !== 'infusion');
  if (evs.length) {
    const table = h('table.rep-table');
    table.appendChild(h('thead', null, h('tr', null,
      h('th', null, 'Дата'), h('th', null, 'Событие'), h('th', null, 'Подробности'))));
    const tb = h('tbody');
    /* группируем подряд идущие однотипные дни, чтобы не раздувать лист */
    for (const row of groupEvents(evs)) {
      tb.appendChild(h('tr', null,
        h('td', null, row.dates),
        h('td', null, row.name),
        h('td', null, row.note || '—'),
      ));
    }
    table.appendChild(tb);
    paper.appendChild(table);
  } else {
    paper.appendChild(h('.rep-line', { style: { fontSize: '11px' } }, 'Событий не записано'));
  }

  /* — Изменения терапии — */
  paper.appendChild(h('.rep-h2', null, 'Изменения терапии'));
  const hist = store.state.medHistory.filter((r) => r.date >= range.from && r.date <= range.to);
  if (hist.length) {
    const table = h('table.rep-table');
    table.appendChild(h('thead', null, h('tr', null,
      h('th', null, 'Дата'), h('th', null, 'Препарат'), h('th', null, 'Было'),
      h('th', null, 'Стало'), h('th', null, 'Причина'))));
    const tb = h('tbody');
    for (const r of hist) {
      const med = store.state.meds.find((m) => m.id === r.medId);
      tb.appendChild(h('tr', null,
        h('td', null, fmtDateShort(r.date)),
        h('td', null, med ? med.name : '—'),
        h('td', null, r.from),
        h('td', null, r.to),
        h('td', null, r.reason || '—'),
      ));
    }
    table.appendChild(tb);
    paper.appendChild(table);
  } else {
    paper.appendChild(h('.rep-line', { style: { fontSize: '11px' } }, 'Изменений не записано'));
  }

  /* — Текущая схема — */
  paper.appendChild(h('.rep-h2', null, 'Текущая схема приёма'));
  const meds = store.activeMeds(today());
  paper.appendChild(h('ul', { style: { margin: '4px 0 0 16px', fontSize: '11px', lineHeight: 1.5 } },
    ...(meds.length
      ? meds.map((m) => h('li', null,
          `${m.name} ${m.perDose || m.dose}` +
          ((m.times || []).length ? `, ${m.times.join(' и ')}` : '') +
          (m.endDate ? `, курс до ${fmtDateShort(m.endDate)}` : '') +
          (m.note ? ` — ${m.note}` : '')))
      : [h('li', null, 'Не заполнено')]),
  ));

  /* — Вопросы пациента — */
  const qs = store.state.questions.filter((q) => !q.asked);
  paper.appendChild(h('.rep-h2', null, 'Вопросы к врачу'));
  paper.appendChild(h('ol', { style: { margin: '4px 0 0 16px', fontSize: '11px', lineHeight: 1.6 } },
    ...(qs.length ? qs.map((q) => h('li', null, q.text)) : [h('li', null, '—')]),
  ));

  paper.appendChild(h('.rep-foot', null,
    'Сводка сформирована пациентом в приложении «Мой Анализ». ' +
    'Это дневник наблюдений, а не медицинское заключение.'));
  return paper;
}

function groupEvents(evs) {
  const byType = {};
  for (const e of evs) {
    (byType[e.type] = byType[e.type] || []).push(e);
  }
  const out = [];
  for (const [type, list] of Object.entries(byType)) {
    const info = EVENT_TYPES[type] || { name: type };
    list.sort((a, b) => (a.date < b.date ? -1 : 1));
    /* склеиваем подряд идущие дни в диапазон */
    let run = [list[0]];
    const flush = () => {
      const first = run[0], last = run[run.length - 1];
      out.push({
        sort: first.date,
        dates: run.length > 1 ? `${fmtDateShort(first.date)}–${fmtDateShort(last.date)}` : fmtDateShort(first.date),
        name: info.name + (run.length > 1 ? ` (${run.length} дн.)` : ''),
        note: run.map((r) => r.note).filter(Boolean)[0] || '',
      });
    };
    for (let i = 1; i < list.length; i++) {
      if (daysBetween(list[i - 1].date, list[i].date) <= 1) run.push(list[i]);
      else { flush(); run = [list[i]]; }
    }
    flush();
  }
  return out.sort((a, b) => (a.sort < b.sort ? -1 : 1));
}

function cycleDayOf(dateISO) {
  const infs = store.state.infusions.filter((i) => i.done && i.date <= dateISO);
  if (!infs.length) return null;
  const d = daysBetween(infs[infs.length - 1].date, dateISO) + 1;
  return d > 0 && d <= (store.state.profile.interval || 14) + 7 ? d : null;
}
