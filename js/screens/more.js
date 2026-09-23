/* ==========================================================================
   «Ещё»: отчёты, карточка безопасности, подготовка к госпитализации,
   прививки, напоминания, мои пороги, расписание контроля, настройки.
   ========================================================================== */

import {
  h, icon, sheet, toast, tap, today, addDays, fmtDate, fmtRelative, plural, pluralWord,
  confirmSheet, download, frag,
} from '../ui.js';
import * as store from '../store.js';
import { petNode, petById, openPetPicker } from '../pets.js';
import * as db from '../db.js';
import { loadDemo } from '../demo.js';
import { applyTheme } from '../app.js';
import { renderReports } from './reports.js';
import { renderSafety } from './safety.js';
import { DEFAULT_THRESHOLDS, analyte, refText, SCHEDULE, HOSP_CHECKLIST } from '../catalog.js';
import { openA2HS, isStandalone } from './a2hs.js';
import { openTour } from './tour.js';

const SUBS = {
  reports:    { title: 'Отчёты',                    render: renderReports },
  safety:     { title: 'Карточка безопасности',     render: renderSafety },
  hospital:   { title: 'Подготовка к госпитализации', render: renderHospital },
  vaccines:   { title: 'Прививки',                  render: renderVaccines },
  reminders:  { title: 'Напоминания',               render: renderReminders },
  thresholds: { title: 'Мои пороги от врача',       render: renderThresholds },
  schedule:   { title: 'Расписание контроля',       render: renderSchedule },
  questions:  { title: 'Вопросы к врачу',           render: renderQuestions },
  notes:      { title: 'Заметки и документы',       render: renderNotes },
  settings:   { title: 'Настройки',                 render: renderSettings },
};

export default function renderMore(ctx) {
  const sub = SUBS[ctx.route.sub];
  if (sub) {
    const meta = sub.render(ctx) || {};
    return { title: meta.title || sub.title, sub: meta.sub, keepFab: false };
  }

  const S = ctx.screen;
  S.classList.add('screen--list');
  const p = store.state.profile;
  const tab = ctx.route.tab;

  /* «Ещё» больше не вкладка: старый адрес ведёт в первый раздел. */
  if (tab === 'more') { ctx.go('doctor', { replace: true }); return { title: 'Для врача' }; }

  if (tab === 'plans') {
    S.appendChild(h('.section', { style: { marginTop: 'var(--sp-4)' } },
      h('.card.card--pad0', null,
        item('hospital', 'Подготовка к госпитализации', hospitalHint(), () => ctx.go('more/hospital')),
        item('vaccine',  'Прививки', vaccinesHint(), () => ctx.go('more/vaccines')),
        item('bell',     'Напоминания', remindersHint(), () => ctx.go('more/reminders')),
        item('calendar', 'Расписание контроля', 'Как часто сдавать анализы', () => ctx.go('more/schedule')),
      ),
    ));
    S.appendChild(disclaimer());
    return { title: 'Планы и сроки' };
  }

  if (tab === 'settings') {
    S.appendChild(h('.section', { style: { marginTop: 'var(--sp-4)' } },
      h('button.card.row', {
        type: 'button', style: { width: '100%', textAlign: 'left' },
        onclick: () => ctx.go('more/settings'),
      },
        h('.list__ico', { style: { width: '46px', height: '46px', borderRadius: '15px' } }, icon('user')),
        h('.list__body', null,
          h('.card__title', null, p.name || 'Профиль'),
          h('.card__sub', null, p.diseaseName),
        ),
        icon('chevron'),
      ),
    ));
    S.appendChild(h('.section', null,
      h('.card.card--pad0', null,
        item('pulse',    'Мои пороги от врача', 'Hb, тромбоциты, АЧН, циклоспорин, АД', () => ctx.go('more/thresholds')),
        item('image',    'Заметки и документы', store.state.files.length
          ? plural(store.state.files.length, 'запись', 'записи', 'записей') : 'Пока пусто',
          () => ctx.go('more/notes')),
        item('settings', 'Настройки', 'Тема, экспорт, удаление данных', () => ctx.go('more/settings')),
        item('sparkle',  'Как всё устроено', 'Короткая экскурсия по приложению', () => openTour(ctx)),
      ),
    ));
    if (!isStandalone()) {
      S.appendChild(h('.section', null,
        h('button.card.card--accent.row', {
          type: 'button', style: { width: '100%', textAlign: 'left' },
          onclick: () => openA2HS(),
        },
          h('.list__ico', { style: { background: 'var(--surface)' } }, icon('download')),
          h('.list__body', null,
            h('.list__t', null, 'Установить на телефон'),
            h('.list__s', null, 'Откроется во весь экран и будет работать офлайн'),
          ),
          icon('chevron'),
        ),
      ));
    }
    S.appendChild(disclaimer());
    return { title: 'Мои настройки' };
  }

  /* — Для врача — */
  S.appendChild(h('.section', { style: { marginTop: 'var(--sp-4)' } },
    h('.card.card--pad0', null,
      item('doc',    'Отчёты', 'Гематологический лист, трансфузии, сводка', () => ctx.go('more/reports')),
      item('shield', 'Карточка безопасности', 'Показать врачу скорой, есть QR', () => ctx.go('more/safety')),
      item('note',   'Вопросы к врачу', questionsHint(), () => ctx.go('more/questions')),
    ),
  ));
  S.appendChild(disclaimer());
  return { title: 'Для врача' };

  function disclaimer() {
    return h('p.disclaimer', null,
      'Сервис — вспомогательный инструмент для ведения дневника и не заменяет консультацию врача.');
  }

  function questionsHint() {
    const n = store.state.questions.filter((q) => !q.asked).length;
    return n ? `${plural(n, 'вопрос', 'вопроса', 'вопросов')} к следующему приёму` : 'Записать заранее';
  }
  function hospitalHint() {
    const bad = store.state.checklist.filter((c) => {
      const st = store.checklistStatus(c).status;
      return st === 'expired' || st === 'soon';
    }).length;
    if (!bad) return 'Все сроки в порядке';
    const word = pluralWord(bad, 'пункт требует', 'пункта требуют', 'пунктов требуют');
    return `${bad} ${word} внимания`;
  }
  function vaccinesHint() {
    const due = store.state.vaccines.filter((v) => store.vaccineDue(v).due).length;
    return due ? 'Пора ревакцинироваться' : 'История и сроки';
  }
  function remindersHint() {
    const on = store.state.reminders.filter((r) => r.enabled).length;
    return `${on} из ${store.state.reminders.length} включено`;
  }
}

/** «12,5» → 12.5; пустая строка → null. */
function numOrNull(v) {
  const s = String(v).replace(',', '.').trim();
  if (s === '') return null;
  const n = Number(s);
  return Number.isNaN(n) ? null : n;
}

function group(title, items) {
  return h('.section', null,
    h('.section__head', null, h('.section__title', null, title)),
    h('.card.card--pad0', null, ...items),
  );
}

function item(ico, title, sub, onClick, tone = '') {
  return h('button.list__item', { type: 'button', onclick: onClick },
    h('.list__ico' + (tone ? '.list__ico--' + tone : '.list__ico--neutral'), null, icon(ico)),
    h('.list__body', null,
      h('.list__t', null, title),
      sub ? h('.list__s', null, sub) : null,
    ),
    icon('chevron'),
  );
}

/* ==========================================================================
   Подготовка к госпитализации
   ========================================================================== */

function renderHospital(ctx) {
  const S = ctx.screen;

  S.appendChild(h('.section', { style: { marginTop: 'var(--sp-4)' } },
    h('.card__sub', { style: { marginTop: 0 } },
      'Сроки годности стандартные. Если в вашем стационаре требования другие — поменяйте дату, и статус пересчитается.'),
  ));

  /* порядок — как в шаблоне: так его привычнее пробегать глазами */
  const order = new Map(HOSP_CHECKLIST.map((c, i) => [c.id, i]));
  const rows = store.state.checklist.slice()
    .sort((a, b) => (order.get(a.id) ?? 99) - (order.get(b.id) ?? 99));

  const list = h('.card.card--pad0');
  for (const c of rows) {
    const st = store.checklistStatus(c);
    const tone = { ok: 'ok', soon: 'soon', expired: 'bad', none: 'none' }[st.status];
    const text = {
      ok: st.left == null ? 'есть' : `годен ещё ${plural(st.left, 'день', 'дня', 'дней')}`,
      soon: `истекает через ${plural(st.left, 'день', 'дня', 'дней')}`,
      expired: `просрочен ${plural(-st.left, 'день', 'дня', 'дней')} назад`,
      none: 'нет данных',
    }[st.status];

    list.appendChild(h('button.chk', {
      type: 'button', style: { width: '100%', textAlign: 'left', border: 0, borderBottom: '1px solid var(--line-soft)', background: 'none' },
      onclick: () => openChecklistItem(ctx, c),
    },
      h('.chk__st.chk__st--' + tone),
      h('.list__body', null,
        h('.list__t', null, c.name),
        h('.list__s', null, [
          c.date ? fmtDate(c.date, { year: true }) : null,
          text,
          c.months ? `срок ${c.months} мес.` : null,
        ].filter(Boolean).join(' · ')),
      ),
      icon('chevron'),
    ));
  }
  S.appendChild(h('.section', null, list));

  S.appendChild(h('.section', null,
    h('.card.card--flat.card--tight.stack.stack--sm', null,
      legend('ok', 'готово'), legend('soon', 'истекает в ближайшую неделю'),
      legend('bad', 'просрочено'), legend('none', 'нет данных'),
    ),
  ));

  S.appendChild(h('.section', null,
    h('button.btn.btn--primary.btn--block', {
      type: 'button', onclick: () => ctx.go('more/reports'),
    }, icon('print'), 'Распечатать гематологический лист'),
  ));

  return {};
}

function legend(tone, text) {
  return h('.row', { style: { gap: '10px' } },
    h('.chk__st.chk__st--' + tone),
    h('span', { style: { fontSize: 'var(--t-sm)', color: 'var(--ink-2)' } }, text),
  );
}

function openChecklistItem(ctx, c) {
  const rec = { ...c };
  sheet({
    title: c.name,
    body: h('.stack', null,
      h('.field', null,
        h('label.field__label', null, 'Дата сдачи или получения'),
        h('input.input', {
          type: 'date', value: rec.date || '', max: today(),
          oninput: (e) => { rec.date = e.target.value || null; },
        }),
      ),
      rec.months ? h('.field__hint', null, `Действует ${rec.months} мес. с даты`) : null,
    ),
    foot: (api) => frag(
      h('button.btn.btn--ghost', {
        type: 'button',
        onclick: async () => {
          await store.upsert('checklist', { ...rec, date: null });
          api.close(); ctx.rerender();
        },
      }, 'Сбросить'),
      h('button.btn.btn--primary', {
        type: 'button',
        onclick: async () => {
          await store.upsert('checklist', rec);
          api.close(); toast('Сохранено', { icon: 'check' }); ctx.rerender();
        },
      }, 'Сохранить'),
    ),
  });
}

/* ==========================================================================
   Прививки
   ========================================================================== */

function renderVaccines(ctx) {
  const S = ctx.screen;
  const c = store.cycle();

  S.appendChild(h('.section', { style: { marginTop: 'var(--sp-4)' } },
    h('.card.card--flat.card--tight', null,
      h('.card__sub', { style: { marginTop: 0 } },
        'Окно для прививки считается от календаря инфузий по правилу, которое вы вносите из выписки. ' +
        'По умолчанию — день 1–3 после введения.'),
      c.last ? h('.row', { style: { marginTop: '10px', flexWrap: 'wrap', gap: '6px' } },
        h('.badge.badge--accent', null, 'ближайшее окно'),
        h('.badge', null, `${fmtDate(addDays(c.nextDate, 0))} — ${fmtDate(addDays(c.nextDate, 2))}`),
      ) : null,
    ),
  ));

  const list = h('.card.card--pad0');
  for (const v of store.state.vaccines) {
    const d = store.vaccineDue(v);
    list.appendChild(h('button.list__item', {
      type: 'button', onclick: () => openVaccineForm(ctx, v),
    },
      h('.list__ico' + (d.due ? '.list__ico--warm' : ''), null, icon('vaccine')),
      h('.list__body', null,
        h('.list__t', null, v.name),
        h('.list__s', null, [
          fmtDate(v.date, { year: true }),
          v.everyYears ? (d.due ? 'пора ревакцинироваться' : `следующая ${fmtDate(d.next, { year: true })}`) : null,
          v.note || null,
        ].filter(Boolean).join(' · ')),
      ),
      d.due ? h('.badge.badge--warn', null, 'срок') : null,
      icon('chevron'),
    ));
  }
  if (!store.state.vaccines.length) {
    list.appendChild(h('.empty', null, h('.empty__s', null, 'Прививок пока не записано')));
  }
  S.appendChild(h('.section', null, list));

  S.appendChild(h('.section', null,
    h('button.btn.btn--ghost.btn--block', {
      type: 'button', onclick: () => openVaccineForm(ctx),
    }, icon('plus'), 'Добавить прививку'),
  ));

  return {};
}

function openVaccineForm(ctx, existing = null) {
  const rec = existing ? { ...existing } : {
    date: today(), name: 'Менингококковая вакцина', everyYears: 3, note: '',
  };
  sheet({
    title: existing ? 'Прививка' : 'Новая прививка',
    body: h('.stack', null,
      h('.field', null,
        h('label.field__label', null, 'Название'),
        h('input.input', { type: 'text', value: rec.name, oninput: (e) => { rec.name = e.target.value; } }),
      ),
      h('.grid-2', null,
        h('.field', null,
          h('label.field__label', null, 'Дата'),
          h('input.input', { type: 'date', value: rec.date, oninput: (e) => { rec.date = e.target.value; } }),
        ),
        h('.field', null,
          h('label.field__label', null, 'Раз в N лет'),
          h('input.input.input--num', {
            type: 'number', min: 0, max: 20, value: rec.everyYears || 0,
            oninput: (e) => { rec.everyYears = Number(e.target.value) || null; },
          }),
        ),
      ),
      h('.field', null,
        h('label.field__label', null, 'Заметка'),
        h('input.input', {
          type: 'text', value: rec.note || '', placeholder: 'Например: на 2-й день после инфузии',
          oninput: (e) => { rec.note = e.target.value; },
        }),
      ),
    ),
    foot: (api) => frag(
      existing
        ? h('button.btn.btn--danger', {
            type: 'button',
            onclick: async () => {
              await store.remove('vaccines', rec.id);
              api.close(); toast('Удалено'); ctx.rerender();
            },
          }, icon('trash'))
        : h('button.btn.btn--ghost', { type: 'button', onclick: () => api.close() }, 'Отмена'),
      h('button.btn.btn--primary', {
        type: 'button',
        onclick: async () => {
          await store.upsert('vaccines', rec);
          if (!store.state.events.some((e) => e.date === rec.date && e.type === 'vaccine')) {
            await store.upsert('events', { date: rec.date, type: 'vaccine', note: rec.name });
          }
          api.close(); toast('Сохранено', { icon: 'check' }); ctx.rerender();
        },
      }, 'Сохранить'),
    ),
  });
}

/* ==========================================================================
   Напоминания — все в одном месте, каждое можно выключить и изменить
   ========================================================================== */

function renderReminders(ctx) {
  const S = ctx.screen;

  S.appendChild(h('.section', { style: { marginTop: 'var(--sp-4)' } },
    h('.card__sub', { style: { marginTop: 0 } },
      'Все напоминания собраны здесь: видно каждое, любое можно выключить или изменить.'),
  ));

  const list = h('.card.card--pad0');
  for (const r of store.state.reminders) {
    list.appendChild(h('.list__item', null,
      h('.list__ico' + (r.enabled ? '' : '.list__ico--neutral'), null, icon('bell')),
      h('button.list__body', {
        type: 'button', style: { border: 0, background: 'none', textAlign: 'left', padding: 0 },
        onclick: () => openReminderForm(ctx, r),
      },
        h('.list__t', null, r.title),
        h('.list__s', null, describeReminder(r)),
      ),
      h('button.switch', {
        type: 'button', role: 'switch', 'aria-checked': r.enabled ? 'true' : 'false',
        'aria-label': 'Включить напоминание',
        onclick: async () => {
          tap();
          await store.upsert('reminders', { ...r, enabled: !r.enabled });
        },
      }),
    ));
  }
  if (!store.state.reminders.length) {
    list.appendChild(h('.empty', null, h('.empty__s', null, 'Напоминаний пока нет')));
  }
  S.appendChild(h('.section', null, list));

  S.appendChild(h('.section', null,
    h('button.btn.btn--ghost.btn--block', {
      type: 'button', onclick: () => openReminderForm(ctx),
    }, icon('plus'), 'Добавить напоминание'),
    h('.field__hint', { style: { marginTop: 'var(--sp-3)', textAlign: 'center' } },
      'В демо напоминания показываются в приложении. Системные уведомления — тема для обсуждения.'),
  ));

  return {};
}

function describeReminder(r) {
  const time = r.time ? ', ' + r.time : '';
  if (r.kind === 'daily') return 'Каждый день' + time;
  if (r.kind === 'everyN') return `Каждые ${plural(r.everyN || 1, 'день', 'дня', 'дней')}` + time;
  if (r.kind === 'once') return 'Один раз ' + fmtDate(r.date || today()) + time;
  if (r.kind === 'beforeInfusion') {
    return (r.daysBefore ? `За ${plural(r.daysBefore, 'день', 'дня', 'дней')} до инфузии` : 'В день инфузии') + time;
  }
  return '';
}

function openReminderForm(ctx, existing = null) {
  const rec = existing ? { ...existing } : {
    title: '', kind: 'daily', time: '09:00', everyN: 7, daysBefore: 1,
    date: today(), enabled: true,
  };
  const nWrap = h('.field' + (rec.kind === 'everyN' ? '' : '.hidden'), null,
    h('label.field__label', null, 'Каждые N дней'),
    h('input.input.input--num', {
      type: 'number', min: 1, max: 365, value: rec.everyN,
      oninput: (e) => { rec.everyN = Number(e.target.value) || 1; },
    }),
  );
  const bWrap = h('.field' + (rec.kind === 'beforeInfusion' ? '' : '.hidden'), null,
    h('label.field__label', null, 'За сколько дней до инфузии'),
    h('input.input.input--num', {
      type: 'number', min: 0, max: 14, value: rec.daysBefore,
      oninput: (e) => { rec.daysBefore = Number(e.target.value); },
    }),
  );

  sheet({
    title: existing ? 'Напоминание' : 'Новое напоминание',
    body: h('.stack', null,
      h('.field', null,
        h('label.field__label', null, 'О чём напомнить'),
        h('input.input', {
          type: 'text', value: rec.title, placeholder: 'Например: выписать рецепт',
          oninput: (e) => { rec.title = e.target.value; },
        }),
      ),
      h('.field', null,
        h('label.field__label', null, 'Когда'),
        h('.chips', null,
          kindChip('Каждый день', 'daily'),
          kindChip('Каждые N дней', 'everyN'),
          kindChip('К инфузии', 'beforeInfusion'),
          kindChip('Один раз', 'once'),
        ),
      ),
      nWrap, bWrap,
      h('.field', null,
        h('label.field__label', null, 'Время'),
        h('input.input', { type: 'time', value: rec.time, oninput: (e) => { rec.time = e.target.value; } }),
      ),
    ),
    foot: (api) => frag(
      existing
        ? h('button.btn.btn--danger', {
            type: 'button',
            onclick: async () => {
              await store.remove('reminders', rec.id);
              api.close(); toast('Удалено'); ctx.rerender();
            },
          }, icon('trash'))
        : h('button.btn.btn--ghost', { type: 'button', onclick: () => api.close() }, 'Отмена'),
      h('button.btn.btn--primary', {
        type: 'button',
        onclick: async () => {
          if (!rec.title.trim()) { toast('Укажите текст', { icon: 'info' }); return; }
          await store.upsert('reminders', rec);
          api.close(); toast('Сохранено', { icon: 'check' }); ctx.rerender();
        },
      }, 'Сохранить'),
    ),
  });

  function kindChip(label, value) {
    const el = h('button.chip', {
      type: 'button', 'aria-pressed': rec.kind === value ? 'true' : 'false',
      onclick: () => {
        rec.kind = value;
        for (const sib of el.parentNode.children) sib.setAttribute('aria-pressed', 'false');
        el.setAttribute('aria-pressed', 'true');
        nWrap.classList.toggle('hidden', value !== 'everyN');
        bWrap.classList.toggle('hidden', value !== 'beforeInfusion');
      },
    }, label);
    return el;
  }
}

/* ==========================================================================
   Мои пороги от врача
   ========================================================================== */

function renderThresholds(ctx) {
  const S = ctx.screen;
  const th = structuredClone(store.state.thresholds);

  S.appendChild(h('.section', { style: { marginTop: 'var(--sp-4)' } },
    h('.card__sub', { style: { marginTop: 0 } },
      'Это ваши личные границы, которые назвал врач. Значения за этими границами ' +
      'подсвечиваются заметнее, чем просто выход за норму лаборатории.'),
  ));

  const wrap = h('.stack');
  for (const key of ['hb', 'plt', 'anc', 'csa']) {
    const a = analyte(key);
    const t = th[key] || (th[key] = { min: null, max: null });
    wrap.appendChild(h('.card.card--tight.stack.stack--sm', null,
      h('.row', null,
        h('div', null,
          h('.list__t', null, a.name),
          h('.list__s', null, `норма лаборатории ${refText(key)} ${a.unit}`),
        ),
      ),
      h('.grid-2', null,
        h('.field', null,
          h('label.field__label', null, 'Не ниже'),
          h('input.input.input--num', {
            type: 'text', inputmode: 'decimal', value: t.min ?? '',
            oninput: (e) => { t.min = numOrNull(e.target.value); },
          }),
        ),
        h('.field', null,
          h('label.field__label', null, 'Не выше'),
          h('input.input.input--num', {
            type: 'text', inputmode: 'decimal', value: t.max ?? '',
            oninput: (e) => { t.max = numOrNull(e.target.value); },
          }),
        ),
      ),
    ));
  }

  const bp = th.bp || (th.bp = { ...DEFAULT_THRESHOLDS.bp });
  wrap.appendChild(h('.card.card--tight.stack.stack--sm', null,
    h('.list__t', null, 'Артериальное давление'),
    h('.grid-2', null,
      h('.field', null,
        h('label.field__label', null, 'Верхнее не выше'),
        h('input.input.input--num', {
          type: 'number', value: bp.sysMax ?? '',
          oninput: (e) => { bp.sysMax = e.target.value === '' ? null : Number(e.target.value); },
        }),
      ),
      h('.field', null,
        h('label.field__label', null, 'Нижнее не выше'),
        h('input.input.input--num', {
          type: 'number', value: bp.diaMax ?? '',
          oninput: (e) => { bp.diaMax = e.target.value === '' ? null : Number(e.target.value); },
        }),
      ),
    ),
  ));

  S.appendChild(h('.section', null, wrap));

  S.appendChild(h('.section', null,
    h('button.btn.btn--primary.btn--block', {
      type: 'button',
      onclick: async () => {
        await store.saveThresholds(th);
        toast('Пороги сохранены', { icon: 'check' });
      },
    }, 'Сохранить'),
    h('button.btn.btn--quiet.btn--block', {
      type: 'button', style: { marginTop: 'var(--sp-2)' },
      onclick: async () => {
        await store.saveThresholds(structuredClone(DEFAULT_THRESHOLDS));
        toast('Вернули значения шаблона');
        ctx.rerender();
      },
    }, 'Вернуть значения шаблона ПНГ'),
  ));

  return {};
}

/* ==========================================================================
   Расписание контроля
   ========================================================================== */

function renderSchedule(ctx) {
  const S = ctx.screen;

  S.appendChild(h('.section', { style: { marginTop: 'var(--sp-4)' } },
    h('.card__sub', { style: { marginTop: 0 } },
      'Переключатель «стабилизация» переводит пункт на более редкий режим. ' +
      'Это значения по умолчанию из шаблона ПНГ — врач может назначить другие.'),
  ));

  const list = h('.stack');
  for (const s of store.state.schedule) {
    const d = store.scheduleDue(s);
    list.appendChild(h('.card.card--tight.stack.stack--sm', null,
      h('.row.row--top', null,
        h('.list__ico' + (d.due ? '.list__ico--warm' : ''), null, icon('flask')),
        h('.list__body', null,
          h('.list__t', null, s.title),
          h('.list__s', null, [
            `каждые ${plural(s.stable ? s.everyStable : s.every, 'день', 'дня', 'дней')}`,
            d.last ? 'последний раз ' + fmtRelative(d.last.date) : 'ещё не сдавали',
            d.due ? 'пора' : (d.left != null ? `через ${plural(d.left, 'день', 'дня', 'дней')}` : null),
          ].filter(Boolean).join(' · ')),
        ),
      ),
      s.note ? h('.med__note', null, s.note) : null,
      h('.row', null,
        h('.list__body', null,
          h('.list__t', { style: { fontSize: 'var(--t-sm)' } }, 'Стабилизация'),
          h('.list__s', null, `реже: раз в ${plural(s.everyStable, 'день', 'дня', 'дней')}`),
        ),
        h('button.switch', {
          type: 'button', role: 'switch', 'aria-checked': s.stable ? 'true' : 'false',
          'aria-label': 'Режим стабилизации',
          onclick: async () => {
            tap();
            const next = store.state.schedule.map((x) => x.id === s.id ? { ...x, stable: !x.stable } : x);
            await store.saveSchedule(next);
          },
        }),
      ),
    ));
  }
  S.appendChild(h('.section', null, list));

  S.appendChild(h('.section', null,
    h('button.btn.btn--quiet.btn--block', {
      type: 'button',
      onclick: async () => {
        await store.saveSchedule(structuredClone(SCHEDULE));
        toast('Расписание сброшено');
        ctx.rerender();
      },
    }, 'Вернуть расписание шаблона'),
  ));

  return {};
}

/* ==========================================================================
   Вопросы к врачу
   ========================================================================== */

function renderQuestions(ctx) {
  const S = ctx.screen;

  S.appendChild(h('.section', { style: { marginTop: 'var(--sp-4)' } },
    h('.card__sub', { style: { marginTop: 0 } },
      'Записывайте вопросы заранее — они попадут в сводку для врача.'),
  ));

  const input = h('input.input', { type: 'text', placeholder: 'Новый вопрос' });
  const add = async () => {
    const text = input.value.trim();
    if (!text) return;
    await store.upsert('questions', { text, date: today(), asked: false });
    input.value = '';
    ctx.rerender();
  };
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') add(); });

  S.appendChild(h('.section', null,
    h('.row', null, input, h('button.btn.btn--primary', { type: 'button', onclick: add }, icon('plus'))),
  ));

  const list = h('.card.card--pad0');
  for (const q of store.state.questions) {
    list.appendChild(h('.list__item', null,
      h('button.task__btn' + (q.asked ? '' : ''), {
        type: 'button',
        style: q.asked ? { borderColor: 'var(--accent)', background: 'var(--accent)', color: '#fff' } : {},
        'aria-label': 'Отметить заданным',
        onclick: async () => { tap(); await store.upsert('questions', { ...q, asked: !q.asked }); },
      }, icon('check')),
      h('.list__body', null,
        h('.list__t', { style: q.asked ? { opacity: .5, textDecoration: 'line-through' } : {} }, q.text),
        h('.list__s', null, fmtRelative(q.date)),
      ),
      h('button.appbar__btn', {
        type: 'button', 'aria-label': 'Удалить',
        onclick: async () => { await store.remove('questions', q.id); ctx.rerender(); },
      }, icon('trash')),
    ));
  }
  if (!store.state.questions.length) {
    list.appendChild(h('.empty', null, h('.empty__s', null, 'Пока ни одного вопроса')));
  }
  S.appendChild(h('.section', null, list));

  return {};
}

/* ==========================================================================
   Заметки и документы
   ========================================================================== */

function renderNotes(ctx) {
  const S = ctx.screen;
  const rows = store.state.files.slice().reverse();

  if (!rows.length) {
    S.appendChild(h('.empty', null,
      h('.empty__t', null, 'Пока пусто'),
      h('.empty__s', null, 'Заметки и фото документов добавляются через кнопку «+» → «Заметка».'),
    ));
    return {};
  }

  const list = h('.stack');
  for (const n of rows) {
    list.appendChild(h('.card.card--tight.stack.stack--sm', null,
      h('.row', null,
        h('.list__s', null, fmtDate(n.date, { year: true }) + (n.time ? ' · ' + n.time : '')),
        h('.spacer'),
        h('button.appbar__btn', {
          type: 'button', 'aria-label': 'Удалить',
          onclick: async () => {
            const ok = await confirmSheet({ title: 'Удалить заметку?', text: 'Файлы тоже удалятся.', ok: 'Удалить', danger: true });
            if (!ok) return;
            await store.remove('files', n.id);
            ctx.rerender();
          },
        }, icon('trash')),
      ),
      n.note ? h('div', { style: { fontSize: 'var(--t-base)', lineHeight: 1.45 } }, n.note) : null,
      (n.files || []).length ? h('.chips', null, ...n.files.map((f) => h('a.chip', {
        href: f.data, download: f.name, target: '_blank', rel: 'noopener',
      }, icon(f.type && f.type.startsWith('image') ? 'image' : 'doc'), f.name))) : null,
    ));
  }
  S.appendChild(h('.section', { style: { marginTop: 'var(--sp-4)' } }, list));
  return {};
}

/* ==========================================================================
   Настройки
   ========================================================================== */

function renderSettings(ctx) {
  const S = ctx.screen;
  const p = store.state.profile;
  const st = store.state.settings;

  /* — Профиль — */
  S.appendChild(h('.section', { style: { marginTop: 'var(--sp-4)' } },
    h('.section__head', null, h('.section__title', null, 'Профиль')),
    h('.card.stack', null,
      h('.field', null,
        h('label.field__label', null, 'Имя'),
        h('input.input', {
          type: 'text', value: p.name || '',
          onchange: (e) => store.saveProfile({ name: e.target.value }),
        }),
      ),
      h('.field', null,
        h('label.field__label', null, 'Заболевание'),
        h('input.input', {
          type: 'text', value: p.diseaseName || '',
          onchange: (e) => store.saveProfile({ diseaseName: e.target.value }),
        }),
      ),
      h('.grid-2', null,
        h('.field', null,
          h('label.field__label', null, 'Препарат'),
          h('input.input', {
            type: 'text', value: p.drug || '',
            onchange: (e) => store.saveProfile({ drug: e.target.value }),
          }),
        ),
        h('.field', null,
          h('label.field__label', null, 'Доза'),
          h('input.input', {
            type: 'text', value: p.dose || '',
            onchange: (e) => store.saveProfile({ dose: e.target.value }),
          }),
        ),
      ),
    ),
  ));

  /* — Внешний вид — */
  S.appendChild(h('.section', null,
    h('.section__head', null, h('.section__title', null, 'Внешний вид')),
    h('.card.card--tight.stack.stack--sm', null,
      h('.list__t', null, 'Тема'),
      h('.chips', null, ...[
        ['light', 'Светлая'], ['dark', 'Тёмная'], ['auto', 'Как в системе'],
      ].map(([v, label]) => h('button.chip', {
        type: 'button', 'aria-pressed': st.theme === v ? 'true' : 'false',
        onclick: async () => {
          tap();
          await store.saveSettings({ theme: v });
          applyTheme(v);
        },
      }, icon(v === 'dark' ? 'moon' : v === 'light' ? 'sun' : 'settings'), label))),
    ),
    h('.card.card--tight.row', { style: { marginTop: 'var(--sp-3)' } },
      h('.list__body', null,
        h('.list__t', null, 'Вечерний мини-опрос'),
        h('.list__s', null, 'Три ползунка на главном экране'),
      ),
      h('button.switch', {
        type: 'button', role: 'switch', 'aria-checked': st.eveningSurvey ? 'true' : 'false',
        'aria-label': 'Вечерний опрос',
        onclick: async () => { tap(); await store.saveSettings({ eveningSurvey: !st.eveningSurvey }); },
      }),
    ),
    petRow(st),
  ));

  /* — Дневник: что спрашивать каждый день — */
  S.appendChild(h('.section', null,
    h('.section__head', null, h('.section__title', null, 'Ежедневный опрос')),
    h('.card.card--tight.row', null,
      h('.list__body', null,
        h('.list__t', null, 'Спрашивать цвет мочи'),
        h('.list__s', null, st.urineDaily
          ? 'Последним вопросом, можно пропустить'
          : 'Отметить можно в любой момент через «Добавить»'),
      ),
      h('button.switch', {
        type: 'button', role: 'switch', 'aria-checked': st.urineDaily ? 'true' : 'false',
        'aria-label': 'Спрашивать цвет мочи каждый день',
        onclick: async () => { tap(); await store.saveSettings({ urineDaily: !st.urineDaily }); },
      }),
    ),
    h('.card.card--flat.card--tight', { style: { marginTop: 'var(--sp-3)' } },
      h('.card__sub', { style: { marginTop: 0 } },
        'Самочувствие и температура спрашиваются всегда — это две отметки, ' +
        'на которые уходит меньше минуты.'),
    ),
  ));

  /* — Данные — */
  S.appendChild(h('.section', null,
    h('.section__head', null, h('.section__title', null, 'Ваши данные')),
    h('.card.card--flat.card--tight', null,
      h('.card__sub', { style: { marginTop: 0 } },
        'Всё хранится только на этом устройстве и никуда не отправляется. ' +
        'Выгрузите копию — и сможете перенести данные на другой телефон.'),
    ),
    h('.card.card--pad0', { style: { marginTop: 'var(--sp-3)' } },
      item('download', 'Выгрузить всё в файл', 'Один JSON со всеми записями', exportData),
      item('upload', 'Загрузить из файла', 'Заменит текущие данные', importData),
    ),
  ));

  /* — Демо — */
  S.appendChild(h('.section', null,
    h('.card.card--pad0', null,
      item('sparkle', 'Загрузить демо-данные', 'Полгода истории вымышленного пациента', async () => {
        const ok = await confirmSheet({
          title: 'Загрузить демо?',
          text: 'Текущие данные будут заменены демонстрационными.',
          ok: 'Загрузить',
        });
        if (!ok) return;
        await loadDemo();
        toast('Демо-данные загружены', { icon: 'sparkle' });
        ctx.go('today');
      }),
      item('trash', 'Очистить демо', 'Вернуться к чистому дневнику', async () => {
        const ok = await confirmSheet({
          title: 'Очистить?', text: 'Все записи будут удалены, приложение станет пустым.',
          ok: 'Очистить', danger: true,
        });
        if (!ok) return;
        await store.wipe();
        await store.load();
        await store.saveProfile({ onboarded: true, demo: false });
        toast('Готово');
        ctx.go('today');
      }),
    ),
  ));

  /* — Опасная зона — */
  S.appendChild(h('.section', null,
    h('button.btn.btn--danger.btn--block', {
      type: 'button',
      onclick: async () => {
        const ok = await confirmSheet({
          title: 'Удалить все данные?',
          text: 'Профиль, анализы, инфузии, лекарства, дневник — всё будет удалено безвозвратно. ' +
                'Если нужна копия, сначала выгрузите её в файл.',
          ok: 'Удалить всё', danger: true,
        });
        if (!ok) return;
        const sure = await confirmSheet({
          title: 'Точно?', text: 'Это действие нельзя отменить.', ok: 'Да, удалить', danger: true,
        });
        if (!sure) return;
        await store.wipe();
        await store.load();
        toast('Все данные удалены');
        location.hash = '#/today';
        ctx.rerender();
      },
    }, icon('trash'), 'Удалить все данные'),
  ));

  S.appendChild(h('p.disclaimer', null,
    'Сервис — вспомогательный инструмент для ведения дневника и не заменяет консультацию врача.'));

  S.appendChild(h('.field__hint', {
    style: { textAlign: 'center', marginTop: 'var(--sp-4)' },
  }, 'Мой Анализ · демо-версия · данные только на устройстве'));

  return {};

  async function exportData() {
    const dump = await db.exportAll();
    const name = `moy-analiz-${today()}.json`;
    download(name, JSON.stringify(dump, null, 2));
    toast('Файл сохранён', { icon: 'download' });
  }

  function importData() {
    const input = h('input', {
      type: 'file', accept: 'application/json,.json', style: { display: 'none' },
      onchange: async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        try {
          const dump = JSON.parse(await file.text());
          const ok = await confirmSheet({
            title: 'Заменить данные?',
            text: `Файл от ${dump.exportedAt ? fmtDate(dump.exportedAt.slice(0, 10), { year: true }) : 'неизвестной даты'}. ` +
                  'Текущие записи будут заменены.',
            ok: 'Заменить', danger: true,
          });
          if (!ok) return;
          await db.importAll(dump);
          await store.load();
          toast('Данные загружены', { icon: 'check' });
          ctx.go('today');
        } catch (err) {
          console.error(err);
          toast('Файл не подошёл', { icon: 'info' });
        }
      },
    });
    document.body.appendChild(input);
    input.click();
    setTimeout(() => input.remove(), 1000);
  }
}

/* ==========================================================================
   Питомец
   ========================================================================== */

/** Строка выбора: показывает текущего питомца и открывает лист выбора. */
function petRow(st) {
  const id = st.pet && st.pet !== 'none' ? st.pet : null;
  const pet = id ? petById(id) : null;

  const row = h('button.card.card--tight.row.card--hover', {
    type: 'button',
    style: { marginTop: 'var(--sp-3)', width: '100%', textAlign: 'left' },
    onclick: () => openPetPicker(),
  });

  if (pet) {
    const box = h('.list__ico', { style: { background: 'var(--surface-2)', overflow: 'hidden' } });
    const node = petNode(pet.id, 'happy');
    node.style.setProperty('--pet-size', '40px');
    box.appendChild(node);
    row.appendChild(box);
  } else {
    row.appendChild(h('.list__ico.list__ico--neutral', null, icon('heart')));
  }

  row.appendChild(h('.list__body', null,
    h('.list__t', null, 'Питомец на главном экране'),
    h('.list__s', null, pet
      ? pet.name + ' · спит, пока день не отмечен'
      : 'Сейчас выключен'),
  ));
  row.appendChild(icon('chevron'));
  return row;
}

