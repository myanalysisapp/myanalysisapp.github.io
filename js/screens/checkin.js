/* ==========================================================================
   Отметка за день — пошаговый опрос.

   Раньше самочувствие, температура, симптомы, цвет мочи и вечерние ползунки
   лежали на «Сегодня» пятью независимыми формами сразу. Человек, зашедший
   впервые, не понимал, с чего начать, и не заполнял ничего.

   Здесь один вопрос за шаг, крупные цели и ответ одним касанием.
   Что заложено:
     • выбор сразу переводит на следующий шаг — не нужно искать «Дальше»;
     • любой шаг можно пропустить, обязательных полей нет;
     • шагов ровно столько, сколько нужно: симптомы спрашиваем,
       только если день так себе, вечерние ползунки — только вечером;
     • прогресс виден и конечен, чтобы опрос не казался бесконечным;
     • в конце — подтверждение, а не молчаливое закрытие.
   ========================================================================== */

import { h, icon, sheet, toast, tap, today, fmtDate } from '../ui.js';
import * as store from '../store.js';
import { MOODS, URINE, SYMPTOMS, fmtNum } from '../catalog.js';

const QUICK_TEMPS = [36.6, 37.0, 37.5, 38.0, 38.5];

/**
 * openCheckIn(ctx, { date }) — открывает опрос за указанный день.
 * По умолчанию за сегодня; дата передаётся при заполнении задним числом.
 */
let openApi = null;          // опрос всегда один: двойное нажатие не плодит листы

export function openCheckIn(ctx, { date = today() } = {}) {
  if (openApi) return openApi;
  const existing = store.dayRecord(date) || {};
  /* черновик: пишем на диск один раз в конце, чтобы «Отмена» ничего не меняла */
  const draft = {
    mood: existing.mood ?? null,
    urine: existing.urine ?? null,
    temp: existing.temp ?? null,
    symptoms: [...(existing.symptoms || [])],
    sleep: existing.sleep ?? null,
    load: existing.load ?? null,
    stress: existing.stress ?? null,
  };

  /* Вечерние ползунки имеют смысл только вечером текущего дня:
     за прошлую среду «как прошёл вечер» спрашивать поздно. */
  const isToday = date === today();
  const evening = isToday && new Date().getHours() >= 18
    && store.state.settings.eveningSurvey;
  let step = 0;
  let api = null;

  const body = h('.ci');
  api = sheet({ body: body, onClose: () => { openApi = null; } });
  openApi = api;
  /* свой заголовок — у опроса он меняется от шага к шагу */
  api.root.querySelector('.sheet').classList.add('sheet--checkin');
  draw();
  return api;

  /* — Какие шаги показываем ————————————————————————
     Обязательных всего два: самочувствие и температура. Остальное
     появляется по обстоятельствам — лишний вопрос каждый день
     быстро надоедает.

     Цвет мочи стоит в конце и отключается в настройках. При ПНГ
     признак важный, но узкий: делать его вторым вопросом каждого
     дня — значит заслонять им всё остальное. */
  function steps() {
    const list = [stepMood, stepTemp];
    const badDay = (draft.mood != null && draft.mood <= 3) || (draft.temp != null && draft.temp >= 37.3);
    if (badDay) list.push(stepSymptoms);
    if (store.state.settings.urineDaily) list.push(stepUrine);
    if (evening) list.push(stepEvening);
    list.push(stepDone);
    return list;
  }

  function next() {
    step = Math.min(step + 1, steps().length - 1);
    draw();
  }
  function prev() {
    step = Math.max(0, step - 1);
    draw();
  }

  /** Выбор одного варианта: подсветить и через мгновение уйти дальше. */
  function pick(value, setter) {
    tap();
    setter(value);
    draw();                       // показываем выбор
    setTimeout(() => { if (step < steps().length - 1) next(); }, 260);
  }

  function draw() {
    const list = steps();
    const cur = list[Math.min(step, list.length - 1)];
    body.replaceChildren();
    body.appendChild(header(list));
    if (!isToday) {
      body.appendChild(h('.ci__forDay', null,
        icon('calendar'), 'Запись за ' + fmtDate(date)));
    }
    cur();
  }

  /* — Шапка: прогресс и выход ————————————————————— */

  function header(list) {
    const last = step === list.length - 1;
    const bar = h('.ci__head');

    bar.appendChild(h('button.ci__back', {
      type: 'button',
      'aria-label': step === 0 ? 'Закрыть' : 'Назад',
      onclick: () => (step === 0 ? api.close() : prev()),
    }, icon(step === 0 ? 'close' : 'back')));

    const dots = h('.ci__dots');
    for (let i = 0; i < list.length - 1; i++) {
      dots.appendChild(h('span.ci__dot' + (i === step ? '.is-on' : i < step ? '.is-done' : '')));
    }
    bar.appendChild(last ? h('.ci__dots') : dots);

    bar.appendChild(last
      ? h('span', { style: { width: '40px' } })
      : h('button.ci__skip', { type: 'button', onclick: () => next() }, 'Пропустить'));

    return bar;
  }

  function ask(question, hint) {
    return h('.ci__ask', null,
      h('h2.ci__q', null, question),
      hint ? h('p.ci__hint', null, hint) : null,
    );
  }

  /* — 1. Самочувствие ————————————————————————————— */

  function stepMood() {
    body.appendChild(ask('Как вы себя чувствуете?', 'Одно касание — и дальше'));
    const list = h('.ci__options');
    for (const m of [...MOODS].reverse()) {
      const opt = h('button.ci__opt.ci__opt--mood' + (draft.mood === m.n ? '.is-picked' : ''), {
        type: 'button',
        onclick: () => pick(m.n, (v) => { draft.mood = v; }),
      },
        h('span.ci__face', null, m.face),
        h('span.ci__label', null, m.label),
        h('span.ci__tick', null, icon('check')),
      );
      /* та же шкала, что на полосе самочувствия: зелёное сверху и ниже */
      opt.style.setProperty('--c', m.css);
      list.appendChild(opt);
    }
    body.appendChild(list);
  }

  /* — Цвет мочи: вспомогательный шаг, последний и необязательный — */

  function stepUrine() {
    body.appendChild(ask('Цвет мочи, если заметили',
      'Необязательно. Врач может спросить — тогда отметка пригодится'));

    const row = h('.ci__urine');
    for (const u of URINE) {
      row.appendChild(h('button.ci__swatch' + (draft.urine === u.n ? '.is-picked' : ''), {
        type: 'button',
        style: { background: u.css },
        'aria-label': u.label,
        title: u.label,
        onclick: () => pick(u.n, (v) => { draft.urine = v; }),
      }, h('span.ci__swatch-n', null, String(u.n))));
    }
    body.appendChild(row);
    body.appendChild(h('.ci__scale', null,
      h('span', null, 'светлее'), h('span', null, 'темнее')));

    body.appendChild(h('button.ci__plain', {
      type: 'button', onclick: () => pick(null, (v) => { draft.urine = v; }),
    }, 'Не обратил внимания'));
  }

  /* — 2. Температура ——————————————————————————————— */

  function stepTemp() {
    body.appendChild(ask('Мерили температуру?', 'Если нет — просто пропустите'));

    const grid = h('.ci__temps');
    for (const t of QUICK_TEMPS) {
      grid.appendChild(h('button.ci__temp' + (draft.temp === t ? '.is-picked' : ''), {
        type: 'button',
        onclick: () => pick(t, (v) => { draft.temp = v; }),
      }, fmtNum(t, 1)));
    }
    body.appendChild(grid);

    const input = h('input.input.input--num', {
      type: 'text', inputmode: 'decimal', placeholder: 'Другая, например 37,8',
      style: { textAlign: 'center', marginTop: 'var(--sp-4)' },
      oninput: (e) => {
        const n = Number(String(e.target.value).replace(',', '.'));
        draft.temp = n >= 34 && n <= 43 ? n : draft.temp;
      },
    });
    body.appendChild(input);

    body.appendChild(h('button.ci__plain', {
      type: 'button', onclick: () => pick(null, (v) => { draft.temp = v; }),
    }, 'Не мерил'));
  }

  /* — 3. Симптомы: только если день неважный ——————— */

  function stepSymptoms() {
    body.appendChild(ask('Что беспокоит?', 'Можно выбрать несколько или ничего'));

    const chosen = new Set(draft.symptoms);
    const grid = h('.ci__syms');
    for (const s of SYMPTOMS) {
      const btn = h('button.ci__sym' + (chosen.has(s.id) ? '.is-picked' : ''), {
        type: 'button',
        onclick: () => {
          tap();
          if (chosen.has(s.id)) chosen.delete(s.id); else chosen.add(s.id);
          draft.symptoms = [...chosen];
          btn.classList.toggle('is-picked');
        },
      }, h('span.ci__sym-ico', null, s.icon), h('span', null, s.name));
      grid.appendChild(btn);
    }
    body.appendChild(grid);

    body.appendChild(h('button.btn.btn--primary.btn--lg.btn--block', {
      type: 'button', style: { marginTop: 'var(--sp-5)' },
      onclick: () => { tap(); next(); },
    }, 'Дальше'));
  }

  /* — 5. Вечер: три ползунка на одном шаге ————————— */

  function stepEvening() {
    body.appendChild(ask('Как прошёл день?', 'Необязательно — можно пропустить'));

    const rows = [
      { key: 'sleep',  label: 'Сон',      lo: 'плохо',    hi: 'отлично' },
      { key: 'load',   label: 'Нагрузка', lo: 'лёгкая',   hi: 'тяжёлая' },
      { key: 'stress', label: 'Стресс',   lo: 'спокойно', hi: 'тяжело' },
    ];
    const wrap = h('.ci__sliders');
    for (const r of rows) {
      const val = draft[r.key] ?? 3;
      const out = h('b', null, String(val));
      wrap.appendChild(h('.ci__slider', null,
        h('.ci__slider-head', null, h('span', null, r.label), out),
        h('input.slider', {
          type: 'range', min: 1, max: 5, step: 1, value: val,
          'aria-label': r.label,
          oninput: (e) => { out.textContent = e.target.value; draft[r.key] = Number(e.target.value); },
        }),
        h('.ci__slider-scale', null, h('span', null, r.lo), h('span', null, r.hi)),
      ));
    }
    body.appendChild(wrap);

    body.appendChild(h('button.btn.btn--primary.btn--lg.btn--block', {
      type: 'button', style: { marginTop: 'var(--sp-5)' },
      onclick: () => { tap(); next(); },
    }, 'Дальше'));
  }

  /* — 6. Готово ————————————————————————————————————— */

  function stepDone() {
    const bits = summaryBits(draft);

    body.appendChild(h('.ci__done', null,
      h('.ci__seal', null, icon('check')),
      h('h2.ci__q', { style: { textAlign: 'center' } },
        bits.length ? 'Отмечено' : 'Ничего не отметили'),
      h('p.ci__hint', { style: { textAlign: 'center' } },
        bits.length
          ? 'День записан. Это займёт своё место на графиках и в календаре.'
          : 'Ничего страшного — отметиться можно в любой момент.'),
      bits.length ? h('.ci__summary', null, ...bits.map((b) => h('span.ci__pill', null, b))) : null,
    ));

    body.appendChild(h('button.btn.btn--primary.btn--lg.btn--block', {
      type: 'button', style: { marginTop: 'var(--sp-6)' },
      onclick: async () => {
        tap(14);
        await save();
        api.close();
        if (bits.length) toast('День отмечен', { icon: 'check' });
        if (ctx && ctx.rerender) ctx.rerender();
      },
    }, 'Готово'));

    body.appendChild(h('button.btn.btn--quiet.btn--block', {
      type: 'button', style: { marginTop: 'var(--sp-2)' },
      onclick: () => { step = 0; draw(); },
    }, 'Вернуться к началу'));
  }

  async function save() {
    const patch = {};
    for (const k of ['mood', 'urine', 'temp', 'sleep', 'load', 'stress']) {
      if (draft[k] != null) patch[k] = draft[k];
    }
    if (draft.symptoms.length) patch.symptoms = draft.symptoms;
    if (!Object.keys(patch).length) return;

    await store.saveDay(date, patch);

    /* температура 38 и выше попадает на временную ось как событие */
    if (draft.temp != null && draft.temp >= 38 &&
        !store.state.events.some((e) => e.date === date && e.type === 'fever')) {
      await store.upsert('events', {
        date, type: 'fever', note: `Температура ${fmtNum(draft.temp, 1)}`,
      });
    }
  }
}

/* ==========================================================================
   Краткая сводка дня — её же показывает «Сегодня» после заполнения
   ========================================================================== */

export function summaryBits(rec) {
  if (!rec) return [];
  const out = [];
  if (rec.mood) out.push(MOODS[rec.mood - 1].face + ' ' + MOODS[rec.mood - 1].label);
  if (rec.temp != null) out.push(fmtNum(rec.temp, 1) + ' °C');
  if ((rec.symptoms || []).length) {
    const names = rec.symptoms
      .map((id) => (SYMPTOMS.find((s) => s.id === id) || {}).name)
      .filter(Boolean);
    if (names.length) out.push(names.length > 2 ? `${names[0]} и ещё ${names.length - 1}` : names.join(', '));
  }
  /* цвет мочи — в конце: признак вспомогательный, и в узкой строке
     сводки он не должен вытеснять самочувствие и температуру */
  if (rec.urine) out.push('цвет ' + rec.urine);
  return out;
}

/** Считается ли день отмеченным: хоть что-то из основного. */
export function isCheckedIn(rec) {
  return !!rec && (rec.mood != null || rec.urine != null || rec.temp != null);
}
