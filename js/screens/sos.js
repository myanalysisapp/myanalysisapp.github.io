/* ==========================================================================
   Режим «Мне плохо» — упрощённый экран на один плохой день.
   Крупная температура, симптомы, отметка начала эпизода, лог измерений.
   Никаких советов и оценок: только запись.
   ========================================================================== */

import { h, icon, sheet, toast, tap, today, nowTime } from '../ui.js';
import * as store from '../store.js';
import { SYMPTOMS, fmtNum } from '../catalog.js';

const QUICK_TEMPS = [37.0, 37.5, 38.0, 38.5, 39.0];

export function openSos(ctx) {
  const api = sheet({ title: 'Мне плохо', body: (a) => build(a, ctx) });
  return api;
}

function build(api, ctx) {
  const wrap = h('.stack.sos');
  redraw();
  return wrap;

  function redraw() {
    wrap.replaceChildren();
    const day = store.dayRecord(today()) || {};
    const log = day.tempLog || [];

    /* — Температура — */
    wrap.appendChild(h('.field__label', null, 'Температура сейчас'));
    const grid = h('.sos__temp-grid');
    for (const t of QUICK_TEMPS) {
      grid.appendChild(h('button.sos__temp', {
        type: 'button',
        'aria-pressed': Number(day.temp) === t ? 'true' : 'false',
        onclick: () => addTemp(t),
      }, fmtNum(t, 1)));
    }
    grid.appendChild(h('button.sos__temp', {
      type: 'button',
      style: { fontSize: 'var(--t-base)', fontWeight: 600 },
      onclick: () => askTemp(),
    }, 'Другая'));
    wrap.appendChild(grid);

    /* — Журнал измерений — */
    if (log.length) {
      wrap.appendChild(h('.card.card--flat.card--tight', { style: { marginTop: 'var(--sp-2)' } },
        h('.field__label', { style: { marginBottom: '4px' } }, 'Сегодня измеряли'),
        ...log.map((e) => h('.log-line', null,
          h('time', null, e.time),
          h('b.num', null, fmtNum(e.value, 1) + ' °C'),
        )),
      ));
    }

    /* — Напоминание измерять — */
    const remOn = !!day.tempReminder;
    wrap.appendChild(h('.card.card--tight.row', { style: { marginTop: 'var(--sp-3)' } },
      h('.list__ico.list__ico--warm', null, icon('clock')),
      h('.list__body', null,
        h('.list__t', null, 'Напоминать каждые 3 часа'),
        h('.list__s', null, 'Пока приложение открыто'),
      ),
      h('button.switch', {
        type: 'button', role: 'switch', 'aria-checked': remOn ? 'true' : 'false',
        'aria-label': 'Напоминать измерять температуру',
        onclick: async () => {
          tap();
          await store.saveDay(today(), { tempReminder: !remOn });
          if (!remOn) scheduleTempReminder();
          redraw();
        },
      }),
    ));

    /* — Симптомы — */
    wrap.appendChild(h('.field__label', { style: { marginTop: 'var(--sp-5)' } }, 'Что беспокоит'));
    const sym = h('.sos__sym');
    const cur = new Set(day.symptoms || []);
    for (const s of SYMPTOMS) {
      sym.appendChild(h('button.chip', {
        type: 'button',
        'aria-pressed': cur.has(s.id) ? 'true' : 'false',
        onclick: async () => {
          tap();
          const rec = store.dayRecord(today()) || {};
          const list = new Set(rec.symptoms || []);
          if (list.has(s.id)) list.delete(s.id); else list.add(s.id);
          await store.saveDay(today(), { symptoms: [...list] });
          redraw();
        },
      }, s.icon, s.name));
    }
    wrap.appendChild(sym);

    /* — Начало эпизода — */
    const started = store.state.events.some((e) => e.date === today() && e.type === 'episode');
    wrap.appendChild(h('.stack', { style: { marginTop: 'var(--sp-5)' } },
      started
        ? h('.card.card--accent.row', null,
            h('.list__ico', { style: { background: 'var(--surface)' } }, icon('check')),
            h('.list__body', null,
              h('.list__t', null, 'Начало эпизода отмечено'),
              h('.list__s', null, 'Появится на временной оси в «Динамике»'),
            ),
          )
        : h('button.btn.btn--ghost.btn--block', {
            type: 'button',
            onclick: async () => {
              tap(14);
              await store.upsert('events', { date: today(), type: 'episode', note: 'Отмечено в режиме «Мне плохо»' });
              toast('Отмечено', { icon: 'check' });
              redraw();
            },
          }, icon('bell'), 'Отметить начало эпизода'),

      h('button.btn.btn--quiet.btn--block', {
        type: 'button',
        onclick: () => { api.close(); ctx.go('more/safety'); },
      }, icon('shield'), 'Открыть карточку безопасности'),
    ));

    wrap.appendChild(h('p.disclaimer', null,
      'Приложение только записывает. Оценивает состояние и принимает решения врач.'));
  }

  async function addTemp(value) {
    tap();
    const rec = store.dayRecord(today()) || {};
    const log = [...(rec.tempLog || []), { time: nowTime(), value }];
    await store.saveDay(today(), { temp: value, tempLog: log });
    if (value >= 38) {
      const has = store.state.events.some((e) => e.date === today() && e.type === 'fever');
      if (!has) await store.upsert('events', { date: today(), type: 'fever', note: `Температура ${fmtNum(value, 1)}` });
    }
    toast('Записано в ' + nowTime());
    redraw();
  }

  function askTemp() {
    let v = '';
    sheet({
      title: 'Температура',
      body: h('.field', null,
        h('label.field__label', null, 'Значение, °C'),
        h('input.input.input--num', {
          type: 'number', step: '0.1', min: '34', max: '43', inputmode: 'decimal',
          placeholder: '37,8', oninput: (e) => { v = e.target.value; },
        }),
      ),
      foot: (a) => h('button.btn.btn--primary.btn--block', {
        type: 'button',
        onclick: async () => {
          const n = Number(String(v).replace(',', '.'));
          if (!n || n < 30 || n > 45) { toast('Проверьте значение', { icon: 'info' }); return; }
          a.close();
          await addTemp(n);
        },
      }, 'Записать'),
    });
  }
}

/* — Напоминание, пока вкладка открыта ————————————— */

let reminderTimer = null;

function scheduleTempReminder() {
  clearTimeout(reminderTimer);
  reminderTimer = setTimeout(() => {
    const day = store.dayRecord(today());
    if (!day || !day.tempReminder) return;
    toast('Пора измерить температуру', { icon: 'thermo', ms: 6000 });
    scheduleTempReminder();
  }, 3 * 60 * 60 * 1000);
}
