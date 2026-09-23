/* ==========================================================================
   «Сегодня» — главный экран.

   Экран разделён надвое.

     Колонка дня — приветствие, кольцо интервала, отметка дня и полоса
     самочувствия за две недели. Это то, ради чего дневник открывают
     каждый день; на широком экране колонка закреплена и не уезжает.

     Сводка — показатели с графиком, схема препаратов, дела и тихие
     строки внизу. Это то, куда заглядывают по необходимости.

   Отметить день можно одним касанием: кнопка «Как обычно» подставляет
   не выдуманную четвёрку, а медиану последних тридцати дней самого
   человека — и прямо в подписи говорит, что именно запишет. Дневник
   показывают врачу, поэтому приложение не имеет права додумывать за
   пациента. Кому нужно подробнее — рядом полный опрос с температурой
   и симптомами.

   Заголовки живут внутри карточек: серые подписи, висевшие над
   плитками, добавляли лишние строки ряби на фоне.

   Формы ввода отсюда убраны: самочувствие, температура, симптомы и цвет
   мочи спрашиваются по одному в пошаговом опросе (checkin.js).
   ========================================================================== */

import {
  h, icon, toast, tap, today, addDays, fmtDate, fmtRelative, plural,
  frag, stagger, countUp,
} from '../ui.js';
import * as store from '../store.js';
import { cycleRing, sparkline, lineChart } from '../charts.js';
import { URINE, MOODS, TODAY_KEYS, analyte, fmtNum, evaluate, refText, refLabel } from '../catalog.js';
import { petNode, petState, openPetPicker } from '../pets.js';
import { openSos } from './sos.js';
import { openA2HS, shouldOfferA2HS } from './a2hs.js';
import { openLabForm } from './labs.js';
import { openCheckIn, summaryBits, isCheckedIn } from './checkin.js';

export default function renderToday(ctx) {
  const S = ctx.screen;
  const p = store.state.profile;
  const c = store.cycle();
  const day = store.dayRecord(today());

  const grid = h('.today');
  S.appendChild(grid);

  /* — Колонка дня — */
  const col = h('.daycol');
  col.appendChild(dayHeader(p));
  if (c.last || c.next) col.appendChild(cycleBlock(c, ctx));
  col.appendChild(dayBlock(day, ctx));
  col.appendChild(weeksBlock(ctx));
  grid.appendChild(col);

  /* — Сводка — */
  const sum = h('.summary');
  const add = (node) => { if (node) sum.appendChild(node); };
  add(labsCard(ctx));
  add(agendaCard(c, ctx));
  add(medsCard(ctx));
  add(urineRow(ctx));
  add(sosBand(ctx));
  if (shouldOfferA2HS()) add(a2hsCard());
  add(h('p.disclaimer', null,
    'Сервис — вспомогательный инструмент для ведения дневника и не заменяет консультацию врача.'));
  grid.appendChild(sum);

  return { title: 'Сегодня', actions: [] };
}

/* ==========================================================================
   Заготовка карточки

   Заголовок внутри, отбит волоском. Так подпись принадлежит содержимому,
   а не висит над ним отдельной строкой на фоне.
   ========================================================================== */

function tile(mod, title, action) {
  const card = h('.tile' + (mod ? '.tile--' + mod : ''));
  if (title) {
    card.appendChild(h('.tile__head', null,
      h('h2.tile__title', null, title),
      action || null,
    ));
  }
  return card;
}

function tileAction(label, onclick) {
  return h('button.tile__action', { type: 'button', onclick }, label);
}

/* ==========================================================================
   Шапка дня
   ========================================================================== */

/**
 * Приветствие и дата.
 *
 * Раньше справа стояли три факта — «Инфузия · 6 дней», «Приёмы · 3 из 7»,
 * «Анализы · 7 дней назад». Все три есть ниже и крупнее: первый — в
 * кольце, второй — счётчиком в препаратах, третий — в показателях.
 */
function dayHeader(p) {
  return h('.daycol__head', null,
    h('.daycol__date', null, capitalize(weekdayFull(today())) + ', ' + fmtDate(today())),
    h('h1.daycol__greet', null, greeting(p.name)),
  );
}

/* ==========================================================================
   Кольцо интервала
   ========================================================================== */

function cycleBlock(c, ctx) {
  const block = h('.cycle');
  const wrap = h('.ring-wrap');
  wrap.appendChild(cycleRing({ progress: c.progress, interval: c.interval }));

  const left = c.left;
  const leftEl = left == null ? null
    : left > 0 ? h('.ring-left', null, 'До инфузии ' + plural(left, 'день', 'дня', 'дней'))
    : left === 0 ? h('.ring-left.ring-left--due', null, 'Инфузия сегодня')
    : h('.ring-left.ring-left--over', null, 'Просрочено на ' + plural(-left, 'день', 'дня', 'дней'));

  wrap.appendChild(h('.ring-center', null,
    c.day != null ? frag(
      countUp(h('.ring-day.num'), c.day, { from: Math.max(0, c.day - 4), ms: 700 }),
      h('.ring-of', null, `день из ${c.interval}`),
    ) : h('.ring-of', null, 'Первая инфузия\nещё не отмечена'),
  ));
  block.appendChild(wrap);
  /* Плашка стоит под кольцом, а не в нём: в круг она помещалась только
     пока круг был крупным, а на телефоне ложилась поверх дуги. */
  if (leftEl) block.appendChild(leftEl);

  const foot = h('.cycle__foot');
  if (c.nextDate) {
    foot.appendChild(h('.ring-next', null,
      'Следующая — ', h('b', null, fmtDate(c.nextDate)),
    ));
  }
  if (c.left != null && c.left <= 0) {
    foot.appendChild(h('button.btn.btn--primary.btn--sm', {
      type: 'button',
      onclick: async () => {
        tap(14);
        const undo = await markInfusionDone(c);
        toast('Инфузия отмечена', {
          icon: 'check',
          action: { label: 'Отменить', onClick: undo },
        });
      },
    }, icon('check'), 'Прокапал'));
  } else {
    foot.appendChild(h('button.btn.btn--sm.btn--ghost', {
      type: 'button', onclick: () => ctx.go('meds/infusions'),
    }, icon('calendar'), 'Календарь инфузий'));
  }
  block.appendChild(foot);
  return block;
}

/* ==========================================================================
   Отметка дня
   ========================================================================== */

/**
 * Типичное самочувствие человека — медиана отмеченных дней за месяц.
 *
 * Нужна, чтобы кнопка «как обычно» записывала его собственное обычное,
 * а не то, что кажется приложению нормой. Пока истории мало, кнопки нет
 * вовсе: угадывать за пациента в дневнике, который показывают врачу,
 * нельзя.
 */
function usualMood() {
  const vals = [];
  for (let i = 1; i <= 30; i++) {
    const r = store.dayRecord(addDays(today(), -i));
    if (r && r.mood) vals.push(r.mood);
  }
  if (vals.length < 5) return null;
  vals.sort((a, b) => a - b);
  return vals[Math.floor(vals.length / 2)];
}

/**
 * Пока день не отмечен — единственная яркая кнопка на экране; после
 * отметки становится спокойной сводкой. Заполненность видна сразу, но
 * без упрёка: пропущенный день ничем не наказывается.
 */
function dayBlock(day, ctx) {
  const done = isCheckedIn(day);
  const block = h('.mark' + (done ? '.is-done' : ''));

  /* Заголовок и питомец в одной строке, действия — во всю ширину под
     ними. Когда кнопки делили строку с питомцем, на телефоне подписи
     ломались на два слова. */
  const top = h('.mark__top');
  const main = h('.mark__main');

  if (!done) {
    top.appendChild(h('.mark__t', null, 'Как прошёл день?'));

    const usual = usualMood();
    if (usual) {
      const m = MOODS[usual - 1];
      main.appendChild(h('button.btn.btn--primary.btn--lg.btn--block', {
        type: 'button',
        onclick: async () => {
          tap(14);
          await store.saveDay(today(), { mood: usual });
          toast('День отмечен', { icon: 'check' });
        },
      }, `Как обычно — ${m.label.toLowerCase()}`));
    }

    main.appendChild(h('.mark__row', null,
      h('button.btn' + (usual ? '.btn--ghost' : '.btn--primary.btn--lg'), {
        type: 'button',
        style: { flex: '1' },
        onclick: () => openCheckIn(ctx),
      }, usual ? 'Отметить подробно' : 'Отметить день'),
      h('button.btn.btn--ghost.mark__sos', {
        type: 'button', 'aria-label': 'Мне плохо',
        onclick: () => openSos(ctx),
      }, icon('sos')),
    ));
  } else {
    const bits = summaryBits(day);
    top.appendChild(h('.mark__t', null,
      h('span.mark__check', null, icon('check')), 'День отмечен'));
    main.append(
      bits.length
        ? h('.mark__bits', null, ...bits.map((b) => h('span.mark__bit', null, b)))
        : h('.mark__s', null, 'Без подробностей — и так бывает'),
      h('button.btn.btn--ghost.btn--block', {
        type: 'button',
        onclick: () => openCheckIn(ctx),
      }, 'Изменить'),
    );
  }

  const pet = petSlot(day);
  if (pet) top.appendChild(pet);
  block.append(top, main);
  return block;
}

/**
 * Питомец в углу карточки. Спит, пока день не отмечен; радуется, когда
 * отмечен; на трудный день приносит сердечко — и ничего не говорит.
 * Нажатие открывает выбор: кот, пёс, лиса, птица, черепаха, ёжик или
 * никого. Ничего не требует и не считает пропуски.
 */
function petSlot(day) {
  const id = store.state.settings.pet;
  if (!id || id === 'none') return null;
  const pet = petNode(id, petState(day), { onclick: () => openPetPicker() });
  return pet ? h('.mark__pet', null, pet) : null;
}

/**
 * Отмечает инфузию проведённой и возвращает функцию отмены.
 *
 * Одно касание делает четыре записи: закрывает запланированную инфузию,
 * ставит событие на временную ось, планирует следующую дату и двигает
 * профиль. Разобрать это вручную человек не сможет, а промахнуться по
 * кнопке — запросто, поэтому рядом с подтверждением живёт «Отменить».
 */
async function markInfusionDone(c) {
  const p = store.state.profile;
  const t = today();
  const planned = store.state.infusions.find((i) => !i.done && i.date <= addDays(t, 3));
  const before = planned ? { ...planned } : null;

  const saved = await store.upsert('infusions', before
    ? { ...planned, done: true, date: t }
    : { date: t, done: true, drug: p.drug, dose: p.dose, place: '' });

  const event = await store.upsert('events', { date: t, type: 'infusion', note: '' });

  /* сразу планируем следующую, чтобы кольцо не осталось пустым */
  let created = null;
  const nextDate = addDays(t, p.interval);
  if (!store.state.infusions.some((i) => !i.done && i.date === nextDate)) {
    created = await store.upsert('infusions', {
      date: nextDate, done: false, drug: p.drug, dose: p.dose, place: '',
    });
  }

  const prevLast = p.lastInfusion || null;
  await store.saveProfile({ lastInfusion: t });

  return async function undo() {
    if (created) await store.remove('infusions', created.id);
    await store.remove('events', event.id);
    if (before) await store.upsert('infusions', before);
    else await store.remove('infusions', saved.id);
    await store.saveProfile({ lastInfusion: prevLast });
  };
}

/* ==========================================================================
   Дела и что дальше — один список

   Только события: сдача конкретных анализов, инфузия, контрольные
   исследования. Ежедневные приёмы таблеток отсюда убраны — их пять-шесть
   в день, и они вытесняли из поля зрения то, что случается раз в неделю
   и что действительно можно пропустить.

   Раньше здесь было две карточки, и ближайшая сдача крови показывалась
   в обеих одновременно. Повторяющаяся строка и создавала ощущение,
   что экран забит: работы столько же, а места вдвое больше.
   ========================================================================== */

function agendaCard(c, ctx) {
  const tasks = buildTasks(c, ctx);
  const shown = new Set([...tasks].map((t) => t.dataset.k).filter(Boolean));
  const later = buildLater(c).filter((r) => !shown.has(r.key));

  if (!tasks.length && !later.length) return null;

  const pending = tasks.filter((t) => !t.dataset.done);
  const done = tasks.filter((t) => t.dataset.done);

  const card = tile('agenda', 'Дела на сегодня',
    done.length ? h('.badge.badge--quiet', null, `${done.length} из ${tasks.length}`) : null);

  const body = h('.tile__body');
  card.appendChild(body);

  if (pending.length) {
    body.appendChild(stagger(h('.stack.stack--sm', null, ...pending)));
  } else if (tasks.length) {
    body.appendChild(h('.agenda__clear', null,
      h('.list__ico.list__ico--calm', null, icon('check')),
      h('.list__body', null,
        h('.list__t', null, 'На сегодня всё'),
        h('.list__s', null, 'Ничего не осталось — можно выдохнуть'),
      ),
    ));
  }

  if (done.length) {
    const doneWrap = h('.stack.stack--sm.hidden', { style: { marginTop: 'var(--sp-2)' } }, ...done);
    const toggle = h('button.btn.btn--quiet.btn--block', {
      type: 'button', style: { marginTop: 'var(--sp-2)' },
      onclick: () => {
        const hidden = doneWrap.classList.toggle('hidden');
        toggle.replaceChildren(
          icon(hidden ? 'chevron' : 'minus'),
          document.createTextNode(hidden ? `Показать сделанное · ${done.length}` : 'Свернуть сделанное'),
        );
      },
    }, icon('chevron'), `Показать сделанное · ${done.length}`);
    body.append(toggle, doneWrap);
  }

  if (later.length) {
    const wrap = h('.agenda__later');
    wrap.appendChild(h('.tile__sub', null, 'Что дальше'));
    for (const r of later.slice(0, 3)) {
      wrap.appendChild(h('button.agenda__row', {
        type: 'button', onclick: () => ctx.go(r.go),
      },
        h('.agenda__ico', null, icon(r.ico)),
        h('.list__body', null,
          h('.list__t', null, r.title),
          h('.list__s', null, r.sub),
        ),
        icon('chevron'),
      ));
    }
    card.appendChild(wrap);
  }
  return card;
}

/** Что ждёт впереди: инфузия, ближайшая сдача, контроль исследования. */
function buildLater(c) {
  const rows = [];

  if (c.nextDate) {
    rows.push({
      key: 'infusion',
      ico: 'droplet', title: 'Инфузия ' + store.state.profile.drug.toLowerCase(),
      sub: fmtDate(c.nextDate) + ' · ' + fmtRelative(c.nextDate),
      go: 'meds/infusions',
    });
  }

  const due = store.state.schedule
    .map((item) => ({ item, d: store.scheduleDue(item) }))
    .filter((x) => x.d.nextDate)
    .sort((a, b) => (a.d.nextDate < b.d.nextDate ? -1 : 1))[0];
  if (due) {
    rows.push({
      key: 'panel:' + due.item.panel,
      ico: 'flask', title: due.item.title,
      sub: due.d.due ? 'пора' : fmtDate(due.d.nextDate) + ' · ' + fmtRelative(due.d.nextDate),
      go: 'labs',
    });
  }

  const study = store.state.studies
    .filter((x) => x.next).sort((a, b) => (a.next < b.next ? -1 : 1))[0];
  if (study) {
    rows.push({
      key: 'study:' + study.name,
      ico: 'eye', title: 'Контроль: ' + study.name,
      sub: fmtDate(study.next) + ' · ' + fmtRelative(study.next),
      go: 'labs/studies',
    });
  }
  return rows;
}

/* ==========================================================================
   Задачи дня
   ========================================================================== */

function buildTasks(c, ctx) {
  const out = [];
  const t = today();

  /* инфузия сегодня */
  if (c.left === 0) {
    out.push(task({
      key: 'infusion',
      ico: 'droplet', tone: '',
      title: `Инфузия ${store.state.profile.drug.toLowerCase()} ${store.state.profile.dose}`,
      sub: 'Отметьте, когда прокапаете',
      done: false,
      onToggle: async () => {
        const undo = await markInfusionDone(c);
        toast('Инфузия отмечена', {
          icon: 'check',
          action: { label: 'Отменить', onClick: undo },
        });
      },
    }));
  }

  /* анализы по расписанию, привязанные к инфузии */
  for (const item of store.state.schedule) {
    const d = store.scheduleDue(item, t);
    const beforeInfusionSoon = item.beforeInfusion && c.left != null && c.left <= 2 && c.left >= 0;
    if (!d.due && !beforeInfusionSoon) continue;
    if (store.panelDoneInCycle(item.panel) && item.beforeInfusion) continue;

    const alreadyToday = store.state.labs.some(
      (l) => l.date === t && (l.panels || []).includes(item.panel));

    out.push(task({
      key: 'panel:' + item.panel,
      ico: 'flask', tone: 'warm',
      title: item.title,
      sub: item.note || (d.last ? 'Последний раз ' + fmtRelative(d.last.date) : 'Ещё не сдавали'),
      done: alreadyToday,
      onToggle: () => openLabForm(ctx, { panelId: item.panel, date: t }),
      asButton: true,
    }));
  }

  /* Приёмы лекарств сюда не попадают: их десяток в день, и они
     вытесняли из списка то, ради чего в него заглядывают, — сдачу
     анализов и процедуры. Схема препаратов живёт отдельной карточкой. */

  /* контрольные даты исследований */
  for (const s of store.state.studies) {
    if (s.next && s.next <= t) {
      out.push(task({
        key: 'study:' + s.name,
        ico: 'eye', tone: 'info',
        title: 'Контроль: ' + s.name,
        sub: 'Срок — ' + fmtDate(s.next),
        done: false,
        asButton: true,
        onToggle: () => ctx.go('labs/studies'),
      }));
    }
  }

  return out;
}

/** key — чтобы то же дело не повторилось ниже, в «Что дальше». */
function task({ key, ico, tone, title, sub, done, onToggle, asButton }) {
  const data = {};
  if (done) data.done = '1';
  if (key) data.k = key;

  const el = h('.task' + (done ? '.is-done' : ''), { dataset: data },
    h('.task__ico' + (tone ? '.task__ico--' + tone : ''), null, icon(ico)),
    h('.task__body', null,
      h('.task__t', null, title),
      sub ? h('.task__s', null, sub) : null,
    ),
    h('button.task__btn', {
      type: 'button',
      'aria-label': asButton ? 'Открыть' : (done ? 'Снять отметку' : 'Отметить'),
      onclick: (e) => { e.stopPropagation(); onToggle(); },
    }, icon(asButton ? 'chevron' : 'check')),
  );
  if (asButton) el.addEventListener('click', () => onToggle());
  return el;
}

/* ==========================================================================
   Препараты сейчас

   Не список дел, а схема: что человек принимает в эти недели, в какой
   дозе и когда. Такую карточку открывают и просто чтобы вспомнить —
   например, когда врач спрашивает, что вы пьёте.

   Отметки приёма стоят прямо на времени: нажал — отметилось. Пропущенный
   приём ничем не выделяется и ни на что не жалуется; дневник считает
   сделанное, а не недоделанное.
   ========================================================================== */

function medsCard(ctx) {
  const t = today();
  const meds = store.activeMeds(t);

  const card = tile('meds', 'Препараты сейчас',
    tileAction('Все лекарства', () => ctx.go('meds')));
  const body = h('.tile__body');
  card.appendChild(body);

  if (!meds.length) {
    body.appendChild(h('.tile__empty', null,
      h('p', null, 'Постоянных препаратов пока нет'),
      h('button.btn.btn--primary', {
        type: 'button', style: { marginTop: 'var(--sp-4)' },
        onclick: () => ctx.go('meds'),
      }, icon('plus'), 'Добавить препарат'),
    ));
    return card;
  }

  const list = h('.meds__list');
  let total = 0;
  let taken = 0;

  for (const m of meds) {
    const times = store.dosesOn(m, t);
    const row = h('.meds__row', null,
      h('.meds__ico', null, icon('meds')),
    );
    const bodyEl = h('.meds__body', null,
      h('.meds__name', null, `${m.name} ${m.perDose || m.dose}`),
      m.note || m.form
        ? h('.meds__note', null, [m.form, m.note ? firstSentence(m.note) : null]
            .filter(Boolean).join(' · '))
        : null,
    );

    if (times.length) {
      const chips = h('.meds__times');
      for (const time of times) {
        total++;
        const log = store.medTaken(m.id, t, time);
        const isTaken = !!log && log.status === 'taken';
        if (isTaken) taken++;
        chips.appendChild(h('button.meds__time' + (isTaken ? '.is-taken' : ''), {
          type: 'button',
          'aria-pressed': isTaken ? 'true' : 'false',
          'aria-label': `${m.name}, ${time}, ${isTaken ? 'принято' : 'отметить приём'}`,
          onclick: async () => { tap(); await store.toggleMed(m.id, t, time, 'taken'); },
        }, icon('check'), time));
      }
      bodyEl.appendChild(chips);
    } else {
      bodyEl.appendChild(h('.meds__skip', null, 'Сегодня не по схеме'));
    }

    row.appendChild(bodyEl);
    list.appendChild(row);
  }
  body.appendChild(list);

  body.appendChild(h('.meds__foot', null,
    h('span', null, plural(meds.length, 'препарат', 'препарата', 'препаратов')),
    h('span', null, !total ? 'сегодня приёмов нет'
      : taken === total ? 'принято всё' : `принято ${taken} из ${total}`),
  ));
  return card;
}

/* ==========================================================================
   Показатели и один график

   Раньше тут стояли три блока подряд: плитки с последними числами и два
   отдельных графика за три месяца — по сути три взгляда на одни и те же
   данные. Теперь плитки сами переключают график под собой: связь видна,
   а карточка одна.
   ========================================================================== */

function labsCard(ctx) {
  const withData = TODAY_KEYS.filter((k) => store.latest(k));

  const card = tile('labs', 'Показатели', tileAction('Вся динамика', () => ctx.go('trends')));
  const body = h('.tile__body');
  card.appendChild(body);

  if (!withData.length) {
    body.appendChild(h('.tile__empty', null,
      h('p', null, 'Пока нет ни одного анализа'),
      h('button.btn.btn--primary', {
        type: 'button', style: { marginTop: 'var(--sp-4)' },
        onclick: () => ctx.go('labs/new'),
      }, icon('plus'), 'Добавить анализ'),
    ));
    return card;
  }

  const row = h('.metric-row');
  for (const key of TODAY_KEYS) {
    row.appendChild(store.latest(key) ? metricTile(key, () => select(key)) : emptyMetric(key, ctx));
  }
  body.appendChild(row);

  const chartHead = h('.tile__sub.tile__sub--split');
  const chartBox = h('.tile__chart');
  body.append(chartHead, chartBox);

  const warned = [];
  for (const key of withData) {
    const last = store.latest(key);
    const own = store.labRef(last.labId, key);
    const ev = evaluate(key, last.value, store.state.thresholds, own);
    if (ev.level !== 'ok') {
      const r = own ? refLabel(own, key) : refText(key);
      warned.push(`${analyte(key).short} ${ev.text} (${r} ${analyte(key).unit})`);
    }
  }
  if (warned.length) body.appendChild(h('.tile__notes', null, warned.join(' · ')));

  select(withData[0]);
  return card;

  /** Выбор плитки меняет график под ней — без перехода на другой экран. */
  function select(key) {
    for (const el of row.children) el.classList.toggle('is-sel', el.dataset.k === key);

    chartHead.replaceChildren(
      h('span', null, analyte(key).name + ' за 3 месяца'),
      tileAction('Подробнее', () => ctx.go('trends/' + key)),
    );
    chartBox.replaceChildren(chartFor(key)
      || h('.tile__empty.tile__empty--sm', null,
           'Одна точка — график появится со второго анализа'));
  }
}

function chartFor(key) {
  const from = addDays(today(), -92);
  const data = store.series(key, from);
  if (data.length < 2) return null;

  const th = store.state.thresholds[key] || null;
  const infusions = store.state.infusions
    .filter((i) => i.done && i.date >= from).map((i) => i.date);

  return lineChart({
    key, data, infusions, from, to: today(),
    threshold: th && (th.min != null || th.max != null) ? th : null,
    height: 168,
  });
}

function metricTile(key, onSelect) {
  const last = store.latest(key);
  const a = analyte(key);
  const own = store.labRef(last.labId, key);
  const ev = evaluate(key, last.value, store.state.thresholds, own);
  const hist = store.series(key).slice(-12).map((s) => s.value);
  const cls = ev.level === 'alert' ? '.metric--alert' : ev.level === 'warn' ? '.metric--warn' : '';

  const trend = last.prev ? (last.value > last.prev.value ? 'arrowUp'
    : last.value < last.prev.value ? 'arrowDown' : 'minus') : null;
  const tone = ev.level === 'alert' ? 'var(--alert)' : ev.level === 'warn' ? 'var(--warn)' : 'var(--accent)';

  return h('button.metric' + cls, {
    type: 'button',
    dataset: { k: key },
    onclick: () => { tap(); onSelect(); },
    'aria-label': `${a.name}: ${fmtNum(last.value, a.dec)} ${a.unit}. Показать график`,
  },
    /* Полное название без сокращения: «Hb» понятно не каждому, а места
       в плитке хватает. */
    h('.metric__k', null, a.name),
    trend ? h('span.metric__trend', { style: { color: tone } }, icon(trend)) : null,
    h('.metric__v', null,
      countUp(h('span'), last.value, {
        from: last.prev ? last.prev.value : last.value * 0.85,
        dec: a.dec, ms: 700,
      }),
      h('span.metric__u', null, a.unit)),
    sparkline(hist, { tone }),
    h('.metric__d', null,
      own ? h('span', null, `р. ${refLabel(own, key)}`) : null,
      h('span', null, fmtRelative(last.date))),
  );
}

function emptyMetric(key, ctx) {
  const a = analyte(key);
  return h('button.metric.metric--blank', {
    type: 'button', dataset: { k: key }, onclick: () => ctx.go('labs/new'),
  },
    h('.metric__k', null, a.name),
    h('.metric__v', null, '—'),
    h('.metric__d', null, h('span', null, 'нет данных')),
  );
}

/* ==========================================================================
   Самочувствие за две недели
   ========================================================================== */

/** Две недели одним взглядом: за каждый день — столбик. */
function days14() {
  const t = today();
  const out = [];
  for (let i = 13; i >= 0; i--) {
    const date = addDays(t, -i);
    const rec = store.dayRecord(date);
    out.push({
      date,
      mood: (rec && rec.mood) || null,
      urine: (rec && rec.urine) || null,
      fever: !!(rec && rec.temp != null && rec.temp >= 37.5),
    });
  }
  return out;
}

/**
 * Не форма, а картина. Высота столбика и цвет говорят одно и то же —
 * так полоса читается и тем, кто цвета различает хуже.
 *
 * Пустой день — тоже полноразмерная кнопка: нажатие открывает опрос за
 * ту дату. Раньше пропущенные дни были самой мелкой мишенью на экране,
 * хотя именно по ним и нужно попадать, чтобы заполнить пропуск.
 *
 * Приложение ничего не оценивает: цвет берётся из того, что человек
 * выбрал сам. Точка сверху означает, что в этот день была записана
 * температура 37,5 и выше.
 */
function weeksBlock(ctx) {
  const t = today();
  const days = days14();
  const marked = days.filter((d) => d.mood).length;

  const strip = h('.strip');
  days.forEach((d, i) => {
    const m = d.mood ? MOODS[d.mood - 1] : null;
    const what = m ? m.label.toLowerCase() : 'не отмечено';
    const gap = !m && d.date <= t;

    const cell = h('button.strip__c' + (d.date === t ? '.is-today' : ''), {
      type: 'button',
      'aria-label': `${fmtDate(d.date)}: ${what}`
        + (d.fever ? ', температура 37,5 и выше' : '')
        + (gap ? '. Отметить этот день' : ''),
      title: gap ? 'Не отмечено — заполнить' : what,
      onclick: () => (gap
        ? openCheckIn(ctx, { date: d.date })
        : ctx.go('trends/calendar/mood')),
    });
    const bar = h('span.strip__bar' + (m ? '' : '.is-empty'));
    if (m) {
      bar.style.setProperty('--c', m.css);
      bar.style.setProperty('--hgt', (22 + (d.mood - 1) * 6) + 'px');
    }
    bar.style.animationDelay = (i * 26) + 'ms';
    if (d.fever) bar.appendChild(h('i.strip__dot'));
    cell.appendChild(bar);
    strip.appendChild(cell);
  });

  return h('.weeks', null,
    h('.weeks__head', null,
      h('span.weeks__t', null, 'Самочувствие'),
      h('button.weeks__link', {
        type: 'button', onclick: () => ctx.go('trends/calendar/mood'),
      }, 'Календарь'),
    ),
    strip,
    h('.weeks__foot', null,
      h('.weeks__scale', null,
        ...MOODS.map((m) => h('i', { style: { background: m.css }, title: m.label })),
        h('span', null, 'плохо → отлично'),
      ),
      h('span', null, marked ? `отмечено ${marked} из 14` : 'пока не отмечали'),
    ),
  );
}

/* ==========================================================================
   Цвет мочи — вспомогательная строка

   При ПНГ признак важный, но узкий: он под рукой, однако не встречает
   человека первым и не занимает отдельную карточку.
   ========================================================================== */

function urineRow(ctx) {
  const days = days14();
  const has = days.filter((d) => d.urine).length;

  const mini = h('.ustrip');
  days.forEach((d) => {
    const cell = h('i' + (d.urine ? '' : '.is-empty'), {
      title: d.urine ? URINE[d.urine - 1].label : 'не отмечено',
    });
    if (d.urine) cell.style.background = URINE[d.urine - 1].css;
    mini.appendChild(cell);
  });

  return h('button.quiet', {
    type: 'button',
    'aria-label': 'Цвет мочи за две недели, открыть календарь',
    onclick: () => ctx.go('trends/calendar/urine'),
  },
    h('.quiet__t', null, has ? 'Цвет мочи' : 'Цвет мочи · нет отметок'),
    mini,
    icon('chevron'),
  );
}

/* ==========================================================================
   «Мне плохо»

   Полоса во всю ширину внизу: всегда на одном месте, ничего не заслоняет
   и не пугает заранее.
   ========================================================================== */

function sosBand(ctx) {
  return h('button.quiet.quiet--sos', { type: 'button', onclick: () => openSos(ctx) },
    icon('sos'),
    h('.quiet__t', null, 'Мне плохо'),
    h('.quiet__s', null, 'Упрощённый экран: температура и симптомы крупно'),
    icon('chevron'),
  );
}

/* ==========================================================================
   Подсказка «На экран Домой»
   ========================================================================== */

function a2hsCard() {
  return h('.card.card--accent.row.today__a2hs', { style: { gap: 'var(--sp-3)' } },
    h('.list__ico', { style: { background: 'var(--surface)' } }, icon('share')),
    h('.list__body', null,
      h('.list__t', null, 'Установите на экран «Домой»'),
      h('.list__s', null, 'Откроется как обычное приложение, во весь экран'),
    ),
    h('button.btn.btn--sm.btn--primary', { type: 'button', onclick: () => openA2HS() }, 'Как?'),
  );
}

/* ==========================================================================
   Мелочи
   ========================================================================== */

function greeting(name) {
  const hr = new Date().getHours();
  const part = hr < 5 ? 'Доброй ночи' : hr < 12 ? 'Доброе утро' : hr < 18 ? 'Добрый день' : 'Добрый вечер';
  return name ? `${part}, ${name}` : part;
}

const WD_FULL = ['воскресенье', 'понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота'];
function weekdayFull(isoStr) {
  const [y, m, d] = isoStr.split('-').map(Number);
  return WD_FULL[new Date(y, m - 1, d).getDay()];
}

function capitalize(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

function firstSentence(s) {
  const i = s.search(/[.!?]/);
  return i > 0 ? s.slice(0, i) : s;
}
