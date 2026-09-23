/* ==========================================================================
   «Лекарства»: текущая схема, история изменений «было → стало»,
   отметки приёма, календарь инфузий, напоминание о рецепте.
   ========================================================================== */

import {
  h, icon, sheet, toast, tap, today, addDays, fmtDate, fmtRelative,
  confirmSheet, frag, plural, parseISO,
} from '../ui.js';
import * as store from '../store.js';
import { therapyName } from '../catalog.js';

export default function renderMeds(ctx) {
  ctx.screen.classList.add('screen--list');
  if (ctx.route.sub === 'infusions') { renderInfusions(ctx); return { title: 'Календарь инфузий' }; }
  if (ctx.route.sub === 'history')   { renderHistory(ctx);   return { title: 'История изменений' }; }

  const S = ctx.screen;
  /* Одна колонка сверху вниз: инфузия, текущая схема, завершённые
     курсы, история и рецепты. */
  const t = today();
  const meds = store.activeMeds(t);

  /* — Инфузия — */
  const c = store.cycle();
  if (c.nextDate) {
    S.appendChild(h('.section', { style: { marginTop: 'var(--sp-4)' } },
      h('button.card.card--tight.row', {
        type: 'button', style: { width: '100%', textAlign: 'left' },
        onclick: () => ctx.go('meds/infusions'),
      },
        h('.list__ico', null, icon('droplet')),
        h('.list__body', null,
          h('.list__t', null, therapyName(store.state.profile, 'Инфузия')),
          h('.list__s', null,
            `каждые ${plural(c.interval, 'день', 'дня', 'дней')} · следующая ${fmtDate(c.nextDate)}`),
        ),
        icon('chevron'),
      ),
    ));
  }

  /* — Текущая схема — */
  S.appendChild(h('.section', null,
    h('.section__head', null,
      h('.section__title', null, 'Текущая схема'),
      h('button.section__action', { type: 'button', onclick: () => openMedForm(ctx) }, 'Добавить'),
    ),
    meds.length
      ? h('.deck.deck--list', null, ...meds.map((m) => medCard(m, ctx)))
      : h('.empty', null,
          h('.empty__t', null, 'Схема пока пуста'),
          h('.empty__s', null, 'Добавьте препараты — и отметки приёма появятся на «Сегодня».'),
          h('button.btn.btn--primary', { type: 'button', onclick: () => openMedForm(ctx) },
            icon('plus'), 'Добавить препарат'),
        ),
  ));

  /* — Завершённые курсы — */
  const past = store.state.meds.filter((m) => !meds.includes(m) && !m.archived);
  if (past.length) {
    S.appendChild(h('.section', null,
      h('.section__head', null, h('.section__title', null, 'Завершённые и будущие')),
      h('.card.card--pad0', null, ...past.map((m) => h('button.list__item', {
        type: 'button', onclick: () => openMedForm(ctx, m),
      },
        h('.list__ico.list__ico--neutral', null, icon('meds')),
        h('.list__body', null,
          h('.list__t', null, m.name + ' ' + (m.dose || '')),
          h('.list__s', null, m.endDate && m.endDate < today()
            ? 'курс закончился ' + fmtDate(m.endDate)
            : 'начнётся ' + fmtDate(m.startDate)),
        ),
        icon('chevron'),
      ))),
    ));
  }

  /* — История изменений — */
  S.appendChild(h('.section', null,
    h('.card.card--pad0', null,
      h('button.list__item', { type: 'button', onclick: () => ctx.go('meds/history') },
        h('.list__ico.list__ico--neutral', null, icon('clock')),
        h('.list__body', null,
          h('.list__t', null, 'История изменений'),
          h('.list__s', null, store.state.medHistory.length
            ? plural(store.state.medHistory.length, 'запись', 'записи', 'записей') + ' «было → стало»'
            : 'Пока пусто'),
        ),
        icon('chevron'),
      ),
    ),
  ));

  /* — Рецепты — */
  const rx = store.state.meds.filter((m) => m.needsRx && !m.archived);
  if (rx.length) {
    S.appendChild(h('.section', null,
      h('.section__head', null, h('.section__title', null, 'Рецепты')),
      h('.card.card--tight.stack.stack--sm', null,
        h('.card__sub', { style: { marginTop: 0 } },
          'Напоминание выписать рецепт у гематолога:'),
        h('.chips', null, ...rx.map((m) => h('span.chip.is-on', null, icon('note'), m.name))),
        h('button.btn.btn--ghost.btn--sm', {
          type: 'button', onclick: () => ctx.go('more/reminders'),
        }, icon('bell'), 'Настроить напоминания'),
      ),
    ));
  }

  S.appendChild(h('p.disclaimer', null,
    'Схему назначает врач. Приложение только помогает её не забыть.'));

  return { title: 'Лекарства' };
}

/* ==========================================================================
   Карточка препарата
   ========================================================================== */

function medCard(m, ctx) {
  const t = today();
  const times = store.dosesOn(m, t);
  /* Окно препарата: название в шапке, расписание и отметки ниже. */
  const card = h('.card.win.med');

  card.appendChild(h('.win__head', null,
    h('.list__ico', null, icon('meds')),
    h('div', { style: { flex: 1, minWidth: 0 } },
      h('.med__name', null, m.name),
      h('.med__dose.num', null, [
        m.perDose || m.dose,
        times.length ? times.join(' и ') : null,
        m.endDate ? 'курс до ' + fmtDate(m.endDate) : null,
      ].filter(Boolean).join(' · ')),
    ),
    h('button.appbar__btn', {
      type: 'button', 'aria-label': 'Изменить', onclick: () => openMedForm(ctx, m),
    }, icon('edit')),
  ));

  const body = h('.win__body');
  card.appendChild(body);
  if (m.note) body.appendChild(h('.med__note', { style: { marginTop: 0 } }, m.note));

  if (times.length) {
    const acts = h('.med__acts');
    for (const time of times) {
      const log = store.medTaken(m.id, t, time);
      const status = log && log.status;
      acts.appendChild(h('button.chip' + (status === 'taken' ? '.chip--taken' : ''), {
        type: 'button',
        onclick: async () => {
          tap();
          await store.toggleMed(m.id, t, time, 'taken');
        },
      },
        status === 'taken' ? icon('check') : icon('clock'),
        time,
        status === 'skipped' ? ' · пропуск' : '',
      ));
    }
    acts.appendChild(h('button.chip', {
      type: 'button',
      onclick: () => openDoseActions(m, times[0]),
    }, icon('more')));
    body.appendChild(acts);
  }

  return card;
}

function openDoseActions(m, time) {
  sheet({
    title: m.name,
    body: (api) => h('.card.card--pad0', null,
      h('button.list__item', {
        type: 'button',
        onclick: async () => {
          await store.toggleMed(m.id, today(), time, 'skipped');
          api.close(); toast('Отмечен пропуск');
        },
      },
        h('.list__ico.list__ico--warm', null, icon('close')),
        h('.list__body', null, h('.list__t', null, 'Отметить пропуск')),
      ),
      h('button.list__item', {
        type: 'button',
        onclick: async () => {
          api.close();
          openMoveDose(m, time);
        },
      },
        h('.list__ico.list__ico--neutral', null, icon('clock')),
        h('.list__body', null, h('.list__t', null, 'Перенести приём')),
      ),
    ),
  });
}

function openMoveDose(m, time) {
  let newTime = time;
  sheet({
    title: 'Перенести приём',
    body: h('.field', null,
      h('label.field__label', null, 'Новое время на сегодня'),
      h('input.input', { type: 'time', value: time, oninput: (e) => { newTime = e.target.value; } }),
    ),
    foot: (api) => h('button.btn.btn--primary.btn--block', {
      type: 'button',
      onclick: async () => {
        await store.upsert('medLog', {
          medId: m.id, date: today(), time, status: 'moved', movedTo: newTime,
        });
        api.close();
        toast('Перенесено на ' + newTime);
      },
    }, 'Сохранить'),
  });
}

/* ==========================================================================
   Форма препарата
   ========================================================================== */

function openMedForm(ctx, existing = null) {
  const rec = existing ? { ...existing, times: [...(existing.times || [])] } : {
    name: '', dose: '', perDose: '', form: '', note: '',
    freq: 'daily', everyN: 1, times: ['09:00'],
    startDate: today(), endDate: null, needsRx: false, archived: false,
  };
  const prev = existing ? `${existing.perDose || existing.dose} × ${(existing.times || []).length} раз(а) в день` : null;

  const timesWrap = h('.chips');
  const drawTimes = () => {
    timesWrap.replaceChildren();
    rec.times.forEach((t, i) => {
      timesWrap.appendChild(h('span.chip.is-on', null,
        h('input', {
          type: 'time', value: t,
          style: { border: 0, background: 'transparent', font: 'inherit', color: 'inherit', width: '72px' },
          oninput: (e) => { rec.times[i] = e.target.value; },
        }),
        h('button', {
          type: 'button', 'aria-label': 'Убрать время',
          style: { border: 0, background: 'none', padding: 0, color: 'inherit' },
          onclick: () => { rec.times.splice(i, 1); drawTimes(); },
        }, icon('close')),
      ));
    });
    timesWrap.appendChild(h('button.chip', {
      type: 'button',
      onclick: () => { rec.times.push('21:00'); drawTimes(); },
    }, icon('plus'), 'Время'));
  };
  drawTimes();

  const everyWrap = h('.field' + (rec.freq === 'everyN' ? '' : '.hidden'), null,
    h('label.field__label', null, 'Каждые N дней'),
    h('input.input.input--num', {
      type: 'number', min: 1, max: 90, value: rec.everyN || 1,
      oninput: (e) => { rec.everyN = Number(e.target.value) || 1; },
    }),
  );

  sheet({
    title: existing ? existing.name : 'Новый препарат',
    body: h('.stack', null,
      h('.field', null,
        h('label.field__label', null, 'Название'),
        h('input.input', {
          type: 'text', value: rec.name, placeholder: 'Например, Циклоспорин',
          oninput: (e) => { rec.name = e.target.value; },
        }),
      ),
      h('.grid-2', null,
        h('.field', null,
          h('label.field__label', null, 'Доза на приём'),
          h('input.input', {
            type: 'text', value: rec.perDose || rec.dose || '', placeholder: '50 мг',
            oninput: (e) => { rec.perDose = e.target.value; rec.dose = e.target.value; },
          }),
        ),
        h('.field', null,
          h('label.field__label', null, 'Форма'),
          h('input.input', {
            type: 'text', value: rec.form || '', placeholder: 'капсулы',
            oninput: (e) => { rec.form = e.target.value; },
          }),
        ),
      ),

      h('.field', null,
        h('label.field__label', null, 'Схема приёма'),
        h('.chips', null,
          freqChip('Каждый день', 'daily'),
          freqChip('Каждые N дней', 'everyN'),
        ),
      ),
      everyWrap,

      h('.field', null,
        h('label.field__label', null, 'Время приёма'),
        timesWrap,
        h('.field__hint', null, 'Например, два приёма с интервалом 12 часов'),
      ),

      h('.grid-2', null,
        h('.field', null,
          h('label.field__label', null, 'Начало'),
          h('input.input', { type: 'date', value: rec.startDate, oninput: (e) => { rec.startDate = e.target.value; } }),
        ),
        h('.field', null,
          h('label.field__label', null, 'Конец курса'),
          h('input.input', {
            type: 'date', value: rec.endDate || '',
            oninput: (e) => { rec.endDate = e.target.value || null; },
          }),
        ),
      ),
      h('.field__hint', null, 'Пустой конец курса — препарат принимается постоянно.'),

      h('.field', null,
        h('label.field__label', null, 'Примечание'),
        h('textarea.textarea', {
          placeholder: 'Например: интервал 12 часов, много жидкости',
          oninput: (e) => { rec.note = e.target.value; },
        }, rec.note || ''),
      ),

      h('.card.card--flat.card--tight.row', null,
        h('.list__body', null,
          h('.list__t', null, 'Нужен рецепт'),
          h('.list__s', null, 'Появится напоминание выписать у гематолога'),
        ),
        h('button.switch', {
          type: 'button', role: 'switch', 'aria-checked': rec.needsRx ? 'true' : 'false',
          'aria-label': 'Нужен рецепт',
          onclick: (e) => {
            tap();
            rec.needsRx = !rec.needsRx;
            e.currentTarget.setAttribute('aria-checked', rec.needsRx ? 'true' : 'false');
          },
        }),
      ),
    ),
    foot: (api) => frag(
      existing
        ? h('button.btn.btn--danger', {
            type: 'button',
            onclick: async () => {
              const ok = await confirmSheet({
                title: 'Убрать препарат?',
                text: `${existing.name} исчезнет из текущей схемы. История изменений сохранится.`,
                ok: 'Убрать', danger: true,
              });
              if (!ok) return;
              await store.upsert('meds', { ...existing, archived: true });
              api.close(); toast('Убрано из схемы'); ctx.rerender();
            },
          }, icon('trash'))
        : h('button.btn.btn--ghost', { type: 'button', onclick: () => api.close() }, 'Отмена'),
      h('button.btn.btn--primary', {
        type: 'button',
        onclick: async () => {
          if (!rec.name.trim()) { toast('Укажите название', { icon: 'info' }); return; }
          const next = `${rec.perDose || rec.dose} × ${rec.times.length} раз(а) в день`;
          await store.upsert('meds', rec);
          if (existing && prev && prev !== next) {
            await openReasonSheet(rec, prev, next);
          }
          api.close();
          toast('Сохранено', { icon: 'check' });
          ctx.rerender();
        },
      }, 'Сохранить'),
    ),
  });

  function freqChip(label, value) {
    const el = h('button.chip', {
      type: 'button', 'aria-pressed': rec.freq === value ? 'true' : 'false',
      onclick: () => {
        rec.freq = value;
        for (const sib of el.parentNode.children) sib.setAttribute('aria-pressed', 'false');
        el.setAttribute('aria-pressed', 'true');
        everyWrap.classList.toggle('hidden', value !== 'everyN');
      },
    }, label);
    return el;
  }
}

/** Причина изменения — она и попадает в ленту «было → стало». */
function openReasonSheet(med, from, to) {
  return new Promise((resolve) => {
    let reason = '';
    sheet({
      title: 'Что изменилось',
      body: h('.stack', null,
        h('.card.card--flat.card--tight', null,
          h('.hist__c', null, h('s', null, from), ' → ', h('b', null, to)),
        ),
        h('.field', null,
          h('label.field__label', null, 'Причина'),
          h('input.input', {
            type: 'text', placeholder: 'Например: выписка из стационара',
            oninput: (e) => { reason = e.target.value; },
          }),
        ),
      ),
      foot: (api) => h('button.btn.btn--primary.btn--block', {
        type: 'button',
        onclick: async () => {
          await store.upsert('medHistory', {
            medId: med.id, date: today(), from, to, reason: reason.trim() || 'Не указана',
          });
          await store.upsert('events', {
            date: today(), type: 'dosechange', note: `${med.name}: ${from} → ${to}`,
          });
          api.close();
          resolve();
        },
      }, 'Сохранить'),
      onClose: () => resolve(),
    });
  });
}

/* ==========================================================================
   История изменений
   ========================================================================== */

function renderHistory(ctx) {
  const S = ctx.screen;
  const rows = store.state.medHistory.slice().reverse();

  if (!rows.length) {
    S.appendChild(h('.empty', null,
      h('.empty__t', null, 'Изменений пока не было'),
      h('.empty__s', null, 'Когда врач поменяет дозу, запишите это — и здесь появится лента.'),
    ));
    return;
  }

  const hist = h('.hist');
  for (const r of rows) {
    const med = store.state.meds.find((m) => m.id === r.medId);
    hist.appendChild(h('.hist__item', null,
      h('.hist__d', null, fmtDate(r.date, { year: true }) + ' · ' + fmtRelative(r.date)),
      h('.hist__c', null,
        med ? h('b', null, med.name + ': ') : null,
        h('s', null, r.from), ' → ', h('b', null, r.to),
      ),
      r.reason ? h('.hist__r', null, r.reason) : null,
    ));
  }
  S.appendChild(h('.section', { style: { marginTop: 'var(--sp-4)' } }, h('.card', null, hist)));
}

/* ==========================================================================
   Календарь инфузий
   ========================================================================== */

function renderInfusions(ctx) {
  const S = ctx.screen;
  const p = store.state.profile;
  const c = store.cycle();

  S.appendChild(h('.section', { style: { marginTop: 'var(--sp-4)' } },
    h('.card.stack.stack--sm', null,
      h('.card__title', null, therapyName(p)),
      h('.card__sub', null, `Строго каждые ${plural(p.interval, 'день', 'дня', 'дней')}`),
      c.nextDate ? h('.row', { style: { marginTop: '6px' } },
        h('.badge.badge--accent', null, 'следующая ' + fmtDate(c.nextDate)),
        h('.badge', null, fmtRelative(c.nextDate)),
      ) : null,
      h('button.btn.btn--ghost.btn--sm', {
        type: 'button', style: { marginTop: 'var(--sp-3)', alignSelf: 'flex-start' },
        onclick: () => openIntervalSheet(ctx),
      }, icon('edit'), 'Изменить интервал'),
    ),
  ));

  const all = store.state.infusions.slice().sort((a, b) => (a.date < b.date ? 1 : -1));
  const future = all.filter((i) => !i.done).reverse();
  const past = all.filter((i) => i.done);

  if (future.length) {
    S.appendChild(h('.section', null,
      h('.section__head', null,
        h('.section__title', null, 'Запланированы'),
        h('button.section__action', { type: 'button', onclick: () => openInfusionForm(ctx) }, 'Добавить'),
      ),
      h('.card.card--pad0.inf-cal', null, ...future.map((i, idx) => infRow(i, ctx, idx === 0))),
    ));
  }

  S.appendChild(h('.section', null,
    h('.section__head', null, h('.section__title', null, 'Прошедшие')),
    past.length
      ? h('.card.card--pad0.inf-cal', null, ...past.map((i) => infRow(i, ctx)))
      : h('.card.card--tight', null, h('.card__sub', { style: { marginTop: 0 } }, 'Пока ни одной отметки')),
  ));
}

function infRow(i, ctx, isNext = false) {
  const done = i.done;
  return h('button.inf-item' + (done ? '' : '.inf-item--future'), {
    type: 'button', style: { width: '100%', textAlign: 'left', border: 0, background: 'none' },
    onclick: () => openInfusionForm(ctx, i),
  },
    h('.inf-mark' + (done ? '.inf-mark--done' : isNext ? '.inf-mark--next' : ''), null,
      done ? icon('check') : String(parseISO(i.date).getDate())),
    h('div', { style: { flex: 1 } },
      h('.inf-d', null, fmtDate(i.date, { year: true })),
      h('.inf-s', null, [done ? i.place || 'проведена' : fmtRelative(i.date), i.note].filter(Boolean).join(' · ')),
    ),
    icon('chevron'),
  );
}

function openInfusionForm(ctx, existing = null) {
  const p = store.state.profile;
  const rec = existing ? { ...existing } : {
    date: today(), done: false, drug: p.drug, dose: p.dose, place: '', note: '',
  };
  sheet({
    title: existing ? 'Инфузия' : 'Новая инфузия',
    body: h('.stack', null,
      h('.field', null,
        h('label.field__label', null, 'Дата'),
        h('input.input', { type: 'date', value: rec.date, oninput: (e) => { rec.date = e.target.value; } }),
      ),
      h('.field', null,
        h('label.field__label', null, 'Где проходила'),
        h('input.input', {
          type: 'text', value: rec.place || '', placeholder: 'Дневной стационар',
          oninput: (e) => { rec.place = e.target.value; },
        }),
      ),
      h('.card.card--flat.card--tight.row', null,
        h('.list__body', null, h('.list__t', null, 'Проведена')),
        h('button.switch', {
          type: 'button', role: 'switch', 'aria-checked': rec.done ? 'true' : 'false',
          'aria-label': 'Проведена',
          onclick: (e) => {
            tap();
            rec.done = !rec.done;
            e.currentTarget.setAttribute('aria-checked', rec.done ? 'true' : 'false');
          },
        }),
      ),
      h('.field', null,
        h('label.field__label', null, 'Заметка'),
        h('textarea.textarea', { oninput: (e) => { rec.note = e.target.value; } }, rec.note || ''),
      ),
    ),
    foot: (api) => frag(
      existing
        ? h('button.btn.btn--danger', {
            type: 'button',
            onclick: async () => {
              const ok = await confirmSheet({
                title: 'Удалить запись?', text: fmtDate(rec.date, { year: true }), ok: 'Удалить', danger: true,
              });
              if (!ok) return;
              await store.remove('infusions', rec.id);
              api.close(); toast('Удалено'); ctx.rerender();
            },
          }, icon('trash'))
        : h('button.btn.btn--ghost', { type: 'button', onclick: () => api.close() }, 'Отмена'),
      h('button.btn.btn--primary', {
        type: 'button',
        onclick: async () => {
          await store.upsert('infusions', rec);
          if (rec.done) {
            const has = store.state.events.some((e) => e.date === rec.date && e.type === 'infusion');
            if (!has) await store.upsert('events', { date: rec.date, type: 'infusion', note: '' });
            const nextDate = addDays(rec.date, store.state.profile.interval);
            if (nextDate > today() && !store.state.infusions.some((i) => !i.done && i.date === nextDate)) {
              await store.upsert('infusions', {
                date: nextDate, done: false, drug: p.drug, dose: p.dose, place: rec.place || '',
              });
            }
          }
          api.close(); toast('Сохранено', { icon: 'check' }); ctx.rerender();
        },
      }, 'Сохранить'),
    ),
  });
}

function openIntervalSheet(ctx) {
  let n = store.state.profile.interval;
  sheet({
    title: 'Интервал между инфузиями',
    body: h('.stack', null,
      h('.field', null,
        h('label.field__label', null, 'Дней'),
        h('input.input.input--num', {
          type: 'number', min: 1, max: 90, value: n,
          oninput: (e) => { n = Number(e.target.value) || n; },
        }),
      ),
      h('.field__hint', null,
        'Меняется только расчёт кольца и будущих дат. Уже отмеченные инфузии останутся как есть.'),
    ),
    foot: (api) => h('button.btn.btn--primary.btn--block', {
      type: 'button',
      onclick: async () => {
        await store.saveProfile({ interval: n });
        api.close(); toast('Готово', { icon: 'check' }); ctx.rerender();
      },
    }, 'Сохранить'),
  });
}
