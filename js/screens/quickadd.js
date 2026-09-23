/* ==========================================================================
   Быстрая запись — лист по кнопке «+». Доступен с любого экрана.
   Цель: любая запись за 10 секунд, минимум обязательных полей.
   ========================================================================== */

import {
  h, icon, sheet, toast, tap, today, addDays, nowTime, readFileAsDataURL,
} from '../ui.js';
import * as store from '../store.js';
import { EVENT_TYPES, URINE, fmtNum, therapyName } from '../catalog.js';
import { openPanelPicker, openScanDemo } from './labs.js';
import { openCheckIn } from './checkin.js';
import { openSos } from './sos.js';

/* Девять равнозначных иконок заставляли выбирать вслепую. Теперь два
   частых действия стоят крупно, остальные — списком с пояснениями:
   меньше вариантов в поле зрения, каждый подписан. */

const MAIN = [
  { id: 'day',  icon: 'heart', label: 'Отметить день',
    sub: 'Самочувствие и температура' },
  { id: 'scan', icon: 'doc',   label: 'Загрузить результат',
    sub: 'Разберём бланк и заполним сами' },
  { id: 'labs', icon: 'flask', label: 'Ввести анализ',
    sub: 'Вручную, показатель за показателем' },
];

const MORE = [
  { id: 'temp',  icon: 'thermo',   label: 'Температура',  sub: 'Отдельное измерение сейчас' },
  { id: 'urine', icon: 'droplet',  label: 'Цвет мочи',    sub: 'Отметить отдельно, за любой день' },
  { id: 'inf',   icon: 'droplet',  label: 'Инфузия',      sub: 'Отметить, что прокапали' },
  { id: 'med',   icon: 'meds',     label: 'Лекарство',    sub: 'Приём, пропуск или перенос' },
  { id: 'event', icon: 'calendar', label: 'Событие',      sub: 'Простуда, стресс, госпитализация' },
  { id: 'bp',    icon: 'bp',       label: 'Давление',     sub: 'Верхнее, нижнее, пульс' },
  { id: 'note',  icon: 'note',     label: 'Заметка',      sub: 'Текст или фото документа' },
];

export function openQuickAdd() {
  const ctx = { rerender: () => {}, go: (p) => { location.hash = '#/' + p; } };

  sheet({
    title: 'Что записать?',
    body: (api) => {
      const wrap = h('.stack');

      const tiles = h('.qa-main');
      MAIN.forEach((a, i) => {
        tiles.appendChild(h('button.qa-tile', {
          type: 'button',
          style: { animationDelay: (i * 40) + 'ms' },
          onclick: () => { tap(); api.close(); run(a.id, ctx); },
        },
          h('.qa-tile__ico', null, icon(a.icon)),
          h('.qa-tile__t', null, a.label),
          h('.qa-tile__s', null, a.sub),
        ));
      });
      wrap.appendChild(tiles);

      /* «Мне плохо» раньше жило только внизу «Сегодня». В момент, когда
         оно нужно, человек не листает экран: кнопка «+» есть на всех
         вкладках, поэтому вход в упрощённый экран стоит здесь. */
      wrap.appendChild(h('button.quiet.quiet--sos', {
        type: 'button',
        style: { marginTop: 'var(--sp-2)' },
        onclick: () => { tap(); api.close(); openSos(ctx); },
      },
        icon('sos'),
        h('.quiet__t', null, 'Мне плохо'),
        h('.quiet__s', null, 'Температура и симптомы крупно'),
        icon('chevron'),
      ));

      const list = h('.card.card--pad0', { style: { marginTop: 'var(--sp-2)' } });
      MORE.forEach((a) => {
        list.appendChild(h('button.list__item', {
          type: 'button',
          onclick: () => { tap(); api.close(); run(a.id, ctx); },
        },
          h('.list__ico.list__ico--neutral', null, icon(a.icon)),
          h('.list__body', null,
            h('.list__t', null, a.label),
            h('.list__s', null, a.sub),
          ),
          icon('chevron'),
        ));
      });
      wrap.appendChild(list);

      wrap.appendChild(h('.field__hint', { style: { textAlign: 'center', marginTop: 'var(--sp-3)' } },
        'Дата и время подставляются сами — их можно поменять задним числом.'));
      return wrap;
    },
  });
}

function run(id, ctx) {
  switch (id) {
    case 'day':   return openCheckIn(ctx);
    case 'temp':  return openTemp();
    case 'urine': return openUrine();
    case 'labs':  return openPanelPicker(ctx);
    case 'scan':  return openScanDemo(ctx);
    case 'inf':   return openInfusionQuick();
    case 'med':   return openMedQuick();
    case 'event': return openEvent();
    case 'bp':    return openBP();
    case 'note':  return openNote();
  }
}

/* — Общая шапка с датой ————————————————————————— */

function dateField(rec) {
  return h('.grid-2', null,
    h('.field', null,
      h('label.field__label', null, 'Дата'),
      h('input.input', {
        type: 'date', value: rec.date, max: today(),
        oninput: (e) => { rec.date = e.target.value || today(); },
      }),
    ),
    h('.field', null,
      h('label.field__label', null, 'Время'),
      h('input.input', {
        type: 'time', value: rec.time || nowTime(),
        oninput: (e) => { rec.time = e.target.value; },
      }),
    ),
  );
}

function saveBtn(api, onSave, label = 'Сохранить') {
  return h('button.btn.btn--primary.btn--block', {
    type: 'button',
    onclick: async () => {
      try {
        const ok = await onSave();
        if (ok === false) return;
        api.close();
      } catch (e) {
        console.error(e);
        toast('Не удалось сохранить', { icon: 'info' });
      }
    },
  }, label);
}


/* ==========================================================================
   Температура
   ========================================================================== */

function openTemp() {
  const rec = { date: today(), time: nowTime() };
  let value = null;
  const out = h('.temp-val.num', null, '—', h('small', null, '°C'));

  const setVal = (v) => {
    value = v;
    out.replaceChildren(document.createTextNode(fmtNum(v, 1)), h('small', null, '°C'));
  };

  sheet({
    title: 'Температура',
    body: h('.stack', null,
      dateField(rec),
      h('.row', { style: { justifyContent: 'center', padding: 'var(--sp-3) 0' } }, out),
      h('.sos__temp-grid', null, ...[36.6, 37.2, 37.5, 38.0, 38.5, 39.0].map((t) =>
        h('button.sos__temp', {
          type: 'button',
          onclick: (e) => {
            tap();
            for (const sib of e.currentTarget.parentNode.children) sib.setAttribute('aria-pressed', 'false');
            e.currentTarget.setAttribute('aria-pressed', 'true');
            setVal(t);
          },
        }, fmtNum(t, 1)))),
      h('.field', { style: { marginTop: 'var(--sp-3)' } },
        h('label.field__label', null, 'Другое значение'),
        h('input.input.input--num', {
          type: 'number', step: '0.1', min: '34', max: '43', inputmode: 'decimal',
          placeholder: '37,8',
          oninput: (e) => {
            const n = Number(String(e.target.value).replace(',', '.'));
            if (n >= 30 && n <= 45) setVal(n);
          },
        }),
      ),
    ),
    foot: (api) => saveBtn(api, async () => {
      if (value == null) { toast('Выберите значение', { icon: 'info' }); return false; }
      const prev = store.dayRecord(rec.date);
      const log = [...((prev && prev.tempLog) || []), { time: rec.time, value }];
      await store.saveDay(rec.date, { temp: value, tempLog: log });
      if (value >= 38 && !store.state.events.some((e) => e.date === rec.date && e.type === 'fever')) {
        await store.upsert('events', { date: rec.date, type: 'fever', note: `Температура ${fmtNum(value, 1)}` });
      }
      toast('Записано', { icon: 'check' });
    }),
  });
}


/* ==========================================================================
   Инфузия
   ========================================================================== */

function openInfusionQuick() {
  const p = store.state.profile;
  const rec = { date: today(), done: true, drug: p.drug, dose: p.dose, place: '', note: '' };

  sheet({
    title: 'Инфузия',
    body: h('.stack', null,
      h('.card.card--accent', null,
        h('.card__title', null, therapyName(p)),
        h('.card__sub', null, `Интервал ${p.interval} дней`),
      ),
      h('.field', null,
        h('label.field__label', null, 'Дата'),
        h('input.input', { type: 'date', value: rec.date, oninput: (e) => { rec.date = e.target.value; } }),
      ),
      h('.field', null,
        h('label.field__label', null, 'Где проходила'),
        h('input.input', {
          type: 'text', placeholder: 'Дневной стационар',
          oninput: (e) => { rec.place = e.target.value; },
        }),
      ),
    ),
    foot: (api) => saveBtn(api, async () => {
      await store.upsert('infusions', rec);
      if (!store.state.events.some((e) => e.date === rec.date && e.type === 'infusion')) {
        await store.upsert('events', { date: rec.date, type: 'infusion', note: '' });
      }
      const nextDate = addDays(rec.date, p.interval);
      if (!store.state.infusions.some((i) => !i.done && i.date === nextDate)) {
        await store.upsert('infusions', { date: nextDate, done: false, drug: p.drug, dose: p.dose, place: rec.place });
      }
      await store.saveProfile({ lastInfusion: rec.date });
      toast('Инфузия отмечена', { icon: 'check' });
    }, 'Отметить'),
  });
}

/* ==========================================================================
   Лекарство: отметка приёма или смена дозы
   ========================================================================== */

function openMedQuick() {
  const meds = store.activeMeds(today());
  sheet({
    title: 'Лекарство',
    body: (api) => {
      const wrap = h('.stack.stack--sm');
      if (!meds.length) {
        wrap.appendChild(h('.card__sub', { style: { marginTop: 0 } },
          'В схеме пока нет препаратов. Добавьте их на вкладке «Лекарства».'));
      }
      for (const m of meds) {
        const times = store.dosesOn(m, today());
        wrap.appendChild(h('.card.card--tight', null,
          h('.row', null,
            h('.list__ico', null, icon('meds')),
            h('.list__body', null,
              h('.list__t', null, m.name),
              h('.list__s', null, m.perDose || m.dose),
            ),
          ),
          h('.chips', { style: { marginTop: '10px' } }, ...times.map((t) => {
            const log = store.medTaken(m.id, today(), t);
            return h('button.chip' + (log && log.status === 'taken' ? '.is-on' : ''), {
              type: 'button',
              onclick: async (e) => {
                tap();
                await store.toggleMed(m.id, today(), t, 'taken');
                const on = e.currentTarget.classList.toggle('is-on');
                toast(on ? 'Отмечено' : 'Отметка снята');
              },
            }, icon('check'), t);
          })),
        ));
      }
      wrap.appendChild(h('button.btn.btn--ghost.btn--block', {
        type: 'button', style: { marginTop: 'var(--sp-3)' },
        onclick: () => { api.close(); location.hash = '#/meds'; },
      }, icon('edit'), 'Изменить схему или дозу'));
      return wrap;
    },
  });
}

/* ==========================================================================
   Событие
   ========================================================================== */

function openEvent() {
  const rec = { date: today(), type: null, note: '' };
  const types = ['infection', 'stress', 'nosleep', 'overwork', 'vaccine', 'hospital', 'transfusion', 'urticaria'];

  sheet({
    title: 'Событие',
    body: h('.stack', null,
      dateField(rec),
      h('.field__label', null, 'Что случилось'),
      h('.chips', null, ...types.map((t) => {
        const info = EVENT_TYPES[t];
        const b = h('button.chip', {
          type: 'button', 'aria-pressed': 'false',
          onclick: () => {
            tap();
            for (const sib of b.parentNode.children) sib.setAttribute('aria-pressed', 'false');
            b.setAttribute('aria-pressed', 'true');
            rec.type = t;
          },
        }, info.icon, info.name);
        return b;
      })),
      h('.field', { style: { marginTop: 'var(--sp-4)' } },
        h('label.field__label', null, 'Подробности'),
        h('textarea.textarea', {
          placeholder: 'Необязательно',
          oninput: (e) => { rec.note = e.target.value; },
        }),
      ),
    ),
    foot: (api) => saveBtn(api, async () => {
      if (!rec.type) { toast('Выберите событие', { icon: 'info' }); return false; }
      await store.upsert('events', { date: rec.date, type: rec.type, note: rec.note });
      if (rec.type === 'transfusion') {
        await store.upsert('transfusions', {
          date: rec.date, component: 'Эритроцитная взвесь (ЭВ)',
          hbBefore: null, hbAfter: null, note: rec.note,
        });
      }
      toast('Записано', { icon: 'check' });
    }),
  });
}

/* ==========================================================================
   Давление
   ========================================================================== */

function openBP() {
  const rec = { date: today(), time: nowTime() };
  let sys = '', dia = '', pulse = '';

  sheet({
    title: 'Давление',
    body: h('.stack', null,
      dateField(rec),
      h('.row', { style: { gap: 'var(--sp-3)' } },
        h('.field', { style: { flex: 1 } },
          h('label.field__label', null, 'Верхнее'),
          h('input.input.input--num', {
            type: 'number', inputmode: 'numeric', placeholder: '120',
            oninput: (e) => { sys = e.target.value; },
          }),
        ),
        h('.field', { style: { flex: 1 } },
          h('label.field__label', null, 'Нижнее'),
          h('input.input.input--num', {
            type: 'number', inputmode: 'numeric', placeholder: '80',
            oninput: (e) => { dia = e.target.value; },
          }),
        ),
        h('.field', { style: { flex: 1 } },
          h('label.field__label', null, 'Пульс'),
          h('input.input.input--num', {
            type: 'number', inputmode: 'numeric', placeholder: '70',
            oninput: (e) => { pulse = e.target.value; },
          }),
        ),
      ),
    ),
    foot: (api) => saveBtn(api, async () => {
      if (!sys || !dia) { toast('Заполните верхнее и нижнее', { icon: 'info' }); return false; }
      const prev = store.dayRecord(rec.date);
      const list = [...((prev && prev.bp) || []),
        { time: rec.time, sys: Number(sys), dia: Number(dia), pulse: pulse ? Number(pulse) : null }];
      await store.saveDay(rec.date, { bp: list });
      toast('Записано', { icon: 'check' });
    }),
  });
}

/* ==========================================================================
   Заметка и фото документа
   ========================================================================== */

function openNote() {
  const rec = { date: today(), time: nowTime(), note: '', files: [] };
  const list = h('.chips');

  const redraw = () => {
    list.replaceChildren();
    for (const f of rec.files) {
      list.appendChild(h('span.chip.is-on', null, icon('doc'), f.name));
    }
  };

  const input = h('input', {
    type: 'file', accept: 'image/*,application/pdf', multiple: true, style: { display: 'none' },
    onchange: async (e) => {
      for (const file of e.target.files) {
        if (file.size > 4 * 1024 * 1024) { toast('Файл больше 4 МБ пропущен', { icon: 'info' }); continue; }
        rec.files.push({ name: file.name, type: file.type, data: await readFileAsDataURL(file) });
      }
      redraw();
      e.target.value = '';
    },
  });

  sheet({
    title: 'Заметка',
    body: h('.stack', null,
      dateField(rec),
      h('.field', null,
        h('label.field__label', null, 'Текст'),
        h('textarea.textarea', {
          placeholder: 'Например: выписка из стационара, рекомендации',
          oninput: (e) => { rec.note = e.target.value; },
        }),
      ),
      h('.field', null,
        h('label.field__label', null, 'Фото или PDF'),
        list, input,
        h('button.btn.btn--ghost.btn--sm', {
          type: 'button', style: { alignSelf: 'flex-start' },
          onclick: () => input.click(),
        }, icon('camera'), 'Прикрепить'),
      ),
    ),
    foot: (api) => saveBtn(api, async () => {
      if (!rec.note.trim() && !rec.files.length) { toast('Пусто', { icon: 'info' }); return false; }
      await store.upsert('files', rec);
      toast('Сохранено', { icon: 'check' });
    }),
  });
}

/* ==========================================================================
   Цвет мочи отдельно

   В ежедневном опросе этот вопрос стоит последним и отключается — но
   отметить цвет можно в любой момент и задним числом. При ПНГ признак
   важный, просто не тот, с которого стоит начинать каждый день.
   ========================================================================== */

export function openUrine() {
  const rec = { date: today(), urine: (store.dayRecord(today()) || {}).urine || null };

  sheet({
    title: 'Цвет мочи',
    body: (api) => {
      const wrap = h('.stack');

      wrap.appendChild(h('.field', null,
        h('label.field__label', null, 'Дата'),
        h('input.input', {
          type: 'date', value: rec.date, max: today(),
          oninput: (e) => {
            rec.date = e.target.value || today();
            rec.urine = (store.dayRecord(rec.date) || {}).urine || null;
            paint();
          },
        }),
      ));

      const row = h('.ci__urine');
      const scale = h('.ci__scale', null,
        h('span', null, 'светлее'), h('span', null, 'темнее'));
      const caption = h('.field__hint', { style: { textAlign: 'center' } });

      function paint() {
        row.replaceChildren();
        for (const u of URINE) {
          row.appendChild(h('button.ci__swatch' + (rec.urine === u.n ? '.is-picked' : ''), {
            type: 'button',
            style: { background: u.css },
            'aria-label': u.label,
            title: u.label,
            onclick: () => { tap(); rec.urine = u.n; paint(); },
          }, h('span.ci__swatch-n', null, String(u.n))));
        }
        caption.textContent = rec.urine
          ? URINE[rec.urine - 1].label
          : 'Выберите оттенок, ближайший к тому, что видели';
      }
      paint();

      wrap.append(row, scale, caption);
      api.setFoot(saveBtn(api, async () => {
        if (rec.urine == null) return false;
        await store.saveDay(rec.date, { urine: rec.urine });
        toast('Цвет отмечен', { icon: 'droplet' });
      }));
      return wrap;
    },
  });
}
