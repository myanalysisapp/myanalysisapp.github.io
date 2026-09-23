/* ==========================================================================
   «Анализы»: список сдач, ручной ввод по наборам, демо-распознавание бланка,
   прочие исследования.
   ========================================================================== */

import {
  h, icon, sheet, toast, tap, today, fmtDate, fmtMonthYear, fmtRelative,
  confirmSheet, readFileAsDataURL, frag, daysBetween, plural, pluralWord } from '../ui.js';
import * as store from '../store.js';
import {
  PANELS, ANALYTES, panelById, analyte, refText, refLabel, parseRef, fmtNum, evaluate,
  unitsFor, unitById, toBase, fromBase,
} from '../catalog.js';
import { parseLabText } from '../parse.js';
import { labsNav } from './labsnav.js';

/* Ширина, с которой панель подробностей помещается рядом со списком. */
const WIDE = matchMedia('(min-width: 1560px)');

/* Какая сдача раскрыта в правой панели. */
let selectedLabId = null;

export default function renderLabs(ctx) {
  const S = ctx.screen;
  const sub = ctx.route.sub;

  if (sub === 'studies') { renderStudies(ctx); return { title: 'Прочие исследования' }; }
  if (sub === 'item')    { return renderLabItem(ctx); }

  /* Одна колонка сверху вниз: сначала чем пользуются — переключатель
     представления и ввод результата, затем прочие исследования, и уже
     потом сам перечень сдач. Делить экран надвое тут нечем: список и
     так читается подряд. */
  /* Перечень и подробности рядом. Ширина панели появляется только на
     большом мониторе, поэтому ниже 1560px всё остаётся как было:
     щелчок по строке уводит на отдельный экран. */
  const split = h('.labs-split');
  const col = h('.labs-split__main');
  const side = h('aside.labs-side', { 'aria-label': 'Подробности сдачи' });
  split.append(col, side);
  S.appendChild(split);

  col.appendChild(labsNav(ctx, 'list'));

  /* — Кнопки добавления — */
  /* Синим выделено распознавание: переписывать бланк руками долго и
     легко ошибиться, а вставить текст письма — дело пары секунд. */
  col.appendChild(h('.actions', { style: { marginTop: 'var(--sp-4)' } },
    h('button.btn.btn--primary', {
      type: 'button', onclick: () => openScanDemo(ctx),
    }, icon('doc'), 'Распознать автоматически'),
    h('button.btn.btn--ghost', {
      type: 'button', onclick: () => openPanelPicker(ctx),
    }, icon('edit'), 'Ввести вручную'),
  ));

  /* — Прочие исследования — */
  col.appendChild(h('.card.card--pad0', { style: { marginTop: 'var(--sp-4)' } },
    h('button.list__item', { type: 'button', onclick: () => ctx.go('labs/studies') },
      h('.list__ico.list__ico--neutral', null, icon('eye')),
      h('.list__body', null,
        h('.list__t', null, 'Прочие исследования'),
        h('.list__s', null, store.state.studies.length
          ? plural(store.state.studies.length, 'запись', 'записи', 'записей') + ' · УЗИ, костный мозг, ПНГ-клон'
          : 'УЗИ, костный мозг, ПНГ-клон'),
      ),
      icon('chevron'),
    ),
  ));

  /* — Список сдач — */
  const labs = store.state.labs.slice().reverse();
  if (!labs.length) {
    col.appendChild(emptyLabs(ctx));
    return { title: 'Анализы' };
  }

  /* перечень сдач держит ту же ширину, что и списки на других вкладках */
  S.classList.add('screen--list');

  /* Сама собой сдача не выбирается: пока человек не щёлкнул, в панели
     стоит подсказка. Иначе непонятно, откуда там взялся именно этот
     день и почему он раскрыт.
     Но уже сделанный выбор переживает перерисовку: после правки или
     новой записи панель не прыгает к другому дню. */
  if (selectedLabId && !labs.some((l) => l.id === selectedLabId)) selectedLabId = null;

  const rows = new Map();
  let month = null;
  let deck = null;
  for (const l of labs) {
    const m = fmtMonthYear(l.date);
    if (m !== month) {
      month = m;
      col.appendChild(h('.month-head', null, m));
      deck = h('.deck.deck--list');
      col.appendChild(deck);
    }
    const row = labRow(l, ctx, select);
    rows.set(l.id, row);
    deck.appendChild(row);
  }

  col.appendChild(h('p.disclaimer', null,
    'Приложение показывает только то, что вы записали. Толкует результаты врач.'));

  drawSide();

  /** Выбор строки. На узком экране панели нет — уходим на свой экран. */
  function select(id) {
    if (!WIDE.matches) { ctx.go('labs/item/' + id); return; }
    selectedLabId = id;
    drawSide();
  }

  function drawSide() {
    for (const [id, row] of rows) row.classList.toggle('is-on', id === selectedLabId);
    const l = selectedLabId ? store.labById(selectedLabId) : null;
    side.replaceChildren();
    if (!l) {
      side.appendChild(h('.labs-side__hint', null,
        'Нажмите на сдачу слева, и здесь откроются все её результаты.'));
      return;
    }
    side.appendChild(h('.labs-side__head', null,
      h('.labs-side__date', null, fmtDate(l.date, { year: true })),
      h('.labs-side__ago', null, fmtRelative(l.date)),
    ));
    for (const n of labDetailNodes(l, ctx)) side.appendChild(n);
  }

  return { title: 'Анализы', sub: plural(labs.length, 'сдача', 'сдачи', 'сдач') };
}

/* — Строка сдачи ————————————————————————————————— */

function labRow(l, ctx, onSelect) {
  const panels = (l.panels || []).map((id) => (panelById(id) || {}).short || id);
  const keys = Object.keys(l.values || {}).slice(0, 4);

  const cycleDay = cycleDayOf(l.date);

  /* Окно дня: дата и метки в шапке, ниже — что именно сдавали.
     Раньше всё лежало одним куском, и список сдач читался сплошняком. */
  return h('button.card.win', {
    type: 'button', style: { textAlign: 'left', width: '100%' },
    onclick: () => (onSelect ? onSelect(l.id) : ctx.go('labs/item/' + l.id)),
  },
    h('.win__head', null,
      h('.win__date', null, fmtDate(l.date)),
      l.beforeInfusion ? h('.badge.badge--accent', null, 'до инфузии') : null,
      cycleDay ? h('.badge', null, `день ${cycleDay} из ${store.state.profile.interval || 14}`) : null,
      icon('chevron'),
    ),
    h('.win__body', null,
      h('.lab-item__vals', null, ...keys.map((k) => {
        const a = analyte(k);
        const own = (l.refs && l.refs[k]) || null;
        const ev = evaluate(k, l.values[k], store.state.thresholds, own);
        const cls = ev.level === 'alert' ? '.is-alert' : ev.level === 'warn' ? '.is-warn' : '';
        return h('span.lab-val' + cls, null,
          a.short + ' ', h('b', null, fmtNum(l.values[k], a.dec)),
          own ? h('span.lab-val__ref', null, ' (р. ' + refLabel(own, k) + ')') : null);
      })),
      h('.list__s', { style: { marginTop: '7px' } },
        [panels.join(' · '), l.lab].filter(Boolean).join(' — ')),
    ),
  );
}

function cycleDayOf(dateISO) {
  const infs = store.state.infusions.filter((i) => i.done && i.date <= dateISO);
  if (!infs.length) return null;
  const last = infs[infs.length - 1];
  const d = daysBetween(last.date, dateISO) + 1;
  return d > 0 && d <= (store.state.profile.interval || 14) + 7 ? d : null;
}

function emptyLabs(ctx) {
  return h('.empty', null,
    h('div.empty__art', { html: EMPTY_ART }),
    h('.empty__t', null, 'Пока ни одной сдачи'),
    h('.empty__s', null,
      'Добавьте первый результат — нормы и единицы подставятся сами, ' +
      'а дальше появятся графики.'),
    h('.actions', { style: { marginTop: 'var(--sp-4)', maxWidth: '520px' } },
      h('button.btn.btn--primary', { type: 'button', onclick: () => openScanDemo(ctx) },
        icon('doc'), 'Распознать автоматически'),
      h('button.btn.btn--ghost', { type: 'button', onclick: () => openPanelPicker(ctx) },
        icon('edit'), 'Ввести вручную'),
    ),
  );
}

const EMPTY_ART = `
<svg viewBox="0 0 96 96" fill="none" aria-hidden="true">
  <rect x="18" y="10" width="60" height="76" rx="12" fill="var(--surface)" stroke="var(--line)" stroke-width="2"/>
  <rect x="30" y="26" width="34" height="6" rx="3" fill="var(--line)"/>
  <rect x="30" y="40" width="26" height="5" rx="2.5" fill="var(--line-soft)"/>
  <rect x="30" y="52" width="32" height="5" rx="2.5" fill="var(--line-soft)"/>
  <circle cx="68" cy="66" r="18" fill="var(--accent-soft)"/>
  <path d="M60 66h16M68 58v16" stroke="var(--accent)" stroke-width="3.4" stroke-linecap="round"/>
</svg>`;

/* ==========================================================================
   Выбор набора
   ========================================================================== */

export function openPanelPicker(ctx) {
  sheet({
    title: 'Что добавляем',
    body: (api) => {
      const list = h('.stack.stack--sm');
      for (const p of PANELS) {
        list.appendChild(h('button.card.card--tight.row', {
          type: 'button', style: { textAlign: 'left', width: '100%' },
          onclick: () => { api.close(); openLabForm(ctx, { panelId: p.id }); },
        },
          h('.list__ico', null, icon('flask')),
          h('.list__body', null,
            h('.list__t', null, p.name),
            h('.list__s', null, p.hint),
          ),
          icon('chevron'),
        ));
      }
      list.appendChild(h('button.card.card--tight.row', {
        type: 'button', style: { textAlign: 'left', width: '100%' },
        onclick: () => { api.close(); openLabForm(ctx, { panelId: null }); },
      },
        h('.list__ico.list__ico--neutral', null, icon('plus')),
        h('.list__body', null,
          h('.list__t', null, 'Свой показатель'),
          h('.list__s', null, 'Выбрать из списка или добавить свой'),
        ),
        icon('chevron'),
      ));
      return list;
    },
  });
}

/* ==========================================================================
   Форма ввода анализа
   ========================================================================== */

/**
 * openLabForm(ctx, { panelId, date, existing, prefill, unsure, source })
 * prefill — значения, unsure — ключи, которые подсвечиваются как «проверьте».
 */
export function openLabForm(ctx, {
  panelId = null, date = today(), existing = null, prefill = null,
  prefillUnits = null, unsure = [], source = null, lab = null,
} = {}) {
  const panel = panelId ? panelById(panelId) : null;
  const rec = existing || {
    date, time: '', panels: panel ? [panel.id] : [], lab: lab || '',
    beforeInfusion: false, note: '', values: {}, files: [],
  };

  let keys = panel ? [...panel.keys] : [];
  if (existing) keys = [...new Set([...Object.keys(rec.values || {}), ...keys])];
  if (prefill) keys = [...new Set([...keys, ...Object.keys(prefill)])];

  /* В памяти храним каноничные значения, а в полях — то, что видит человек.
     Единицу берём из вставленного бланка, иначе — привычную пользователю. */
  const remembered = store.state.settings.units || {};
  const unitOf = {};
  const values = {};

  for (const key of new Set([...keys, ...Object.keys(rec.values || {}), ...Object.keys(prefill || {})])) {
    const fromPaste = prefillUnits && prefillUnits[key];
    unitOf[key] = unitById(key, fromPaste || remembered[key]).id;

    if (prefill && prefill[key] != null) {
      values[key] = String(prefill[key]).replace('.', ',');
    } else if (rec.values && rec.values[key] != null && rec.values[key] !== '') {
      const shown = analyte(key).kind === 'text'
        ? rec.values[key]
        : fmtNum(fromBase(key, rec.values[key], unitOf[key]), unitById(key, unitOf[key]).dec);
      values[key] = String(shown);
    }
  }
  if (!keys.length) keys = Object.keys(values);

  /* Нормы этой лаборатории, в каноничных единицах: {ключ: [min, max]} */
  const labRefs = { ...(rec.refs || {}) };

  const unsureSet = new Set(unsure);
  const rowsWrap = h('.stack', { style: { gap: 0 } });
  const metaWrap = h('.stack');

  const api = sheet({
    title: existing ? 'Изменить анализ' : (panel ? panel.name : 'Свой показатель'),
    body: () => {
      const body = h('.stack');

      if (source === 'paste') {
        body.appendChild(h('.row', { style: { marginBottom: '2px' } },
          h('.demo-ribbon.demo-ribbon--ok', null, icon('check'), 'Разобрано из текста'),
        ));
        body.appendChild(h('.card__sub', { style: { marginTop: 0 } },
          unsure.length
            ? `Пробегитесь глазами по значениям. Подсвечены ${unsure.length} — там мы не уверены, ` +
              'что взяли нужное число: рядом в строке часто стоит норма лаборатории.'
            : 'Значения подставлены из текста, единицы пересчитаны. Проверьте и сохраните.'));
      } else if (source) {
        body.appendChild(h('.row', { style: { marginBottom: '2px' } },
          h('.demo-ribbon', null, icon('scan'), 'Демо-режим распознавания'),
        ));
        body.appendChild(h('.card__sub', { style: { marginTop: 0 } },
          'Значения подставлены для примера. Проверьте каждое и исправьте, ' +
          'подсвеченные — те, в которых распознавание «не уверено».'));
      }

      body.appendChild(metaWrap);
      body.appendChild(h('.hr'));
      body.appendChild(rowsWrap);

      body.appendChild(h('button.btn.btn--quiet.btn--block', {
        type: 'button', style: { marginTop: 'var(--sp-3)' },
        onclick: () => openAnalytePicker((key) => {
          if (!keys.includes(key)) { keys.push(key); drawRows(); }
        }),
      }, icon('plus'), 'Добавить показатель'));

      body.appendChild(h('.field', { style: { marginTop: 'var(--sp-4)' } },
        h('label.field__label', null, 'Заметка'),
        h('textarea.textarea', {
          placeholder: 'Например: сдавал натощак, до утренней дозы',
          oninput: (e) => { rec.note = e.target.value; },
        }, rec.note || ''),
      ));

      body.appendChild(filesField());

      body.appendChild(h('.field__hint', { style: { marginTop: 'var(--sp-4)' } },
        'Референсы взяты из шаблона. Уточните их по бланку вашей лаборатории — ' +
        'в разных лабораториях они отличаются.'));

      drawMeta();
      drawRows();
      return body;
    },
    foot: (a) => frag(
      existing
        ? h('button.btn.btn--danger', {
            type: 'button',
            onclick: async () => {
              const ok = await confirmSheet({
                title: 'Удалить анализ?', text: 'Запись от ' + fmtDate(rec.date) + ' будет удалена.',
                ok: 'Удалить', danger: true,
              });
              if (!ok) return;
              await store.remove('labs', rec.id);
              a.close();
              toast('Удалено');
              ctx.go('labs');
            },
          }, icon('trash'))
        : h('button.btn.btn--ghost', { type: 'button', onclick: () => a.close() }, 'Отмена'),
      h('button.btn.btn--primary', {
        type: 'button',
        onclick: async () => {
          /* На диск уходят каноничные единицы — графики и отчёты
             строятся по ним, независимо от того, как ввёл пациент. */
          const clean = {};
          const usedUnits = {};
          for (const [k, v] of Object.entries(values)) {
            if (v === '' || v == null) continue;
            const raw = String(v).replace(',', '.');
            if (analyte(k).kind === 'text' || Number.isNaN(Number(raw))) { clean[k] = v; continue; }
            clean[k] = toBase(k, raw, unitOf[k]);
            usedUnits[k] = unitOf[k];
          }
          if (!Object.keys(clean).length) { toast('Заполните хотя бы одно значение', { icon: 'info' }); return; }

          /* запоминаем выбранные единицы: в следующий раз подставим их */
          if (Object.keys(usedUnits).length) {
            await store.saveSettings({ units: { ...(store.state.settings.units || {}), ...usedUnits } });
          }
          rec.values = clean;
          /* нормы храним только там, где значение действительно есть */
          const refs = {};
          for (const [k, r] of Object.entries(labRefs)) {
            if (clean[k] != null && r && (r[0] != null || r[1] != null)) refs[k] = r;
          }
          if (Object.keys(refs).length) rec.refs = refs; else delete rec.refs;
          rec.panels = panel ? [panel.id] : (rec.panels || []);
          await store.upsert('labs', rec);
          a.close();
          toast(existing ? 'Изменения сохранены' : 'Анализ добавлен', { icon: 'check' });
          ctx.rerender();
        },
      }, 'Сохранить'),
    ),
  });

  /* — Шапка формы: дата, лаборатория, «до инфузии» — */
  function drawMeta() {
    metaWrap.replaceChildren(
      h('.grid-2', null,
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
            type: 'time', value: rec.time || '',
            oninput: (e) => { rec.time = e.target.value; },
          }),
        ),
      ),
      h('.field', null,
        h('label.field__label', null, 'Лаборатория'),
        h('input.input', {
          type: 'text', value: rec.lab || '', placeholder: 'Например, Инвитро',
          oninput: (e) => { rec.lab = e.target.value; },
        }),
      ),
      h('.card.card--flat.card--tight.row', null,
        h('.list__body', null,
          h('.list__t', null, 'Сдано до инфузии'),
          h('.list__s', null, 'Пометка попадёт в отчёт для врача'),
        ),
        h('button.switch', {
          type: 'button', role: 'switch',
          'aria-checked': rec.beforeInfusion ? 'true' : 'false',
          'aria-label': 'Сдано до инфузии',
          onclick: (e) => {
            tap();
            rec.beforeInfusion = !rec.beforeInfusion;
            e.currentTarget.setAttribute('aria-checked', rec.beforeInfusion ? 'true' : 'false');
          },
        }),
      ),
    );
  }

  /* — Строки показателей — */
  function drawRows() {
    rowsWrap.replaceChildren();
    if (!keys.length) {
      rowsWrap.appendChild(h('.field__hint', { style: { padding: '10px 0' } },
        'Добавьте показатель кнопкой ниже.'));
      return;
    }
    keys.forEach((key, i) => {
      const a = analyte(key);
      const row = h('.an-row');
      const refEl = h('.an-row__ref');

      /* type=text, а не number: русская клавиатура даёт запятую, а поле
         type=number молча выбрасывает «3,62». Разделитель нормализуем сами. */
      const input = h('input.input.input--num', {
        type: 'text',
        inputmode: a.kind === 'text' ? 'text' : 'decimal',
        autocomplete: 'off', autocorrect: 'off', spellcheck: 'false',
        value: values[key] != null ? String(values[key]).replace('.', ',') : '',
        enterkeyhint: i === keys.length - 1 ? 'done' : 'next',
        'aria-label': a.name,
        oninput: (e) => {
          if (a.kind !== 'text') {
            const cleaned = e.target.value.replace(/[^\d,.\-]/g, '').replace('.', ',');
            if (cleaned !== e.target.value) e.target.value = cleaned;
          }
          values[key] = e.target.value;
          paint(row, key, e.target.value);
        },
        onkeydown: (e) => {
          if (e.key !== 'Enter') return;
          e.preventDefault();
          const all = [...rowsWrap.querySelectorAll('input')];
          const idx = all.indexOf(e.target);
          if (idx >= 0 && idx < all.length - 1) all[idx + 1].focus();
          else e.target.blur();
        },
        onfocus: (e) => { row.classList.remove('is-unsure'); e.target.select(); },
      });

      /* Переключатель единиц. Значение при смене пересчитывается —
         иначе график молча соврёт, а по нему смотрит врач. */
      const list = unitsFor(key);
      const unitEl = list.length > 1
        ? h('button.unit-pick', {
            type: 'button',
            'aria-label': `Единица: ${unitOf[key]}. Нажмите, чтобы сменить`,
            onclick: () => {
              tap();
              const cur = list.findIndex((u) => u.id === unitOf[key]);
              const next = list[(cur + 1) % list.length];
              const prevId = unitOf[key];
              unitOf[key] = next.id;

              /* уже введённое переводим в новую единицу */
              const raw = String(values[key] ?? '').replace(',', '.');
              if (raw !== '' && !Number.isNaN(Number(raw))) {
                const base = toBase(key, raw, prevId);
                const shown = fromBase(key, base, next.id);
                values[key] = fmtNum(shown, next.dec).replace(/\s/g, '');
                input.value = values[key];
              }
              unitEl.replaceChildren(document.createTextNode(next.id));
              unitEl.classList.remove('is-flash');
              void unitEl.offsetWidth;                 // перезапуск анимации
              unitEl.classList.add('is-flash');
              drawRef();
              paint(row, key, values[key]);
            },
          }, unitOf[key])
        : h('span.unit-static', null, unitOf[key] || '');

      /* Поле для нормы этой лаборатории. Свёрнуто, пока не понадобится:
         у большинства показателей справочной нормы достаточно, а вот у
         ЛДГ она пляшет от реактива к реактиву. */
      const refBox = h('.an-row__own.hidden');
      const refInput = h('input.input.input--num', {
        type: 'text', inputmode: 'decimal', autocomplete: 'off',
        placeholder: 'норма бланка, например 125-220',
        'aria-label': `Норма лаборатории для «${a.name}»`,
        oninput: (e) => {
          const parsed = parseRef(e.target.value);
          if (!parsed) { delete labRefs[key]; }
          else {
            labRefs[key] = [
              parsed[0] == null ? null : Number(toBase(key, parsed[0], unitOf[key])),
              parsed[1] == null ? null : Number(toBase(key, parsed[1], unitOf[key])),
            ];
          }
          paint(row, key, values[key]);
        },
      });
      refBox.appendChild(refInput);

      const ownBtn = h('button.an-row__ownbtn', {
        type: 'button',
        onclick: () => {
          tap();
          const hidden = refBox.classList.toggle('hidden');
          if (!hidden) refInput.focus();
        },
      });

      const drawRef = () => {
        const own = labRefs[key];
        const shownOwn = own
          ? [own[0] == null ? null : Number(fromBase(key, own[0], unitOf[key])),
             own[1] == null ? null : Number(fromBase(key, own[1], unitOf[key]))]
          : null;
        const t = refText(key, unitOf[key]);
        refEl.replaceChildren(
          own
            ? h('span', null, 'норма бланка ' + refLabel(shownOwn, key, unitOf[key]))
            : (t ? h('span', null, t) : h('span', null, 'единицы уточните по бланку')),
          list.length > 1 ? h('span.an-row__swap', null, 'сменить единицу') : null,
        );
        ownBtn.textContent = own ? 'изменить норму' : 'своя норма';
        if (shownOwn && refInput.value === '') {
          refInput.value = refLabel(shownOwn, key, unitOf[key]).replace('–', '-');
        }
      };
      drawRef();

      row.append(
        h('div', null, h('.an-row__name', null, a.name), refEl, ownBtn),
        h('.an-row__in', null, input, unitEl),
        refBox,
      );
      if (unsureSet.has(key)) row.classList.add('is-unsure');
      paint(row, key, values[key]);
      rowsWrap.appendChild(row);
    });
  }

  /** Подсветка строки. Оценка всегда в каноничных единицах. */
  function paint(row, key, value) {

    row.classList.remove('is-warn', 'is-alert');
    const v = String(value ?? '').replace(',', '.');
    if (v === '') return;
    const base = analyte(key).kind === 'text' ? v : toBase(key, v, unitOf[key]);
    const ev = evaluate(key, base, store.state.thresholds, labRefs[key]);
    if (ev.level === 'warn') row.classList.add('is-warn');
    if (ev.level === 'alert') row.classList.add('is-alert');

    let note = row.querySelector('.an-row__flag');
    if (!note) {
      note = h('.an-row__flag.flag', { style: { gridColumn: '1 / -1', marginTop: '-6px' } });
      row.appendChild(note);
    }
    note.className = 'an-row__flag flag' + (ev.level === 'alert' ? ' flag--alert' : ev.level === 'warn' ? ' flag--warn' : '');
    note.textContent = ev.text;
  }

  /* — Файлы и фото бланка — */
  function filesField() {
    const wrap = h('.field', { style: { marginTop: 'var(--sp-3)' } },
      h('label.field__label', null, 'Файлы и фото бланка'),
    );
    const list = h('.chips', { style: { marginBottom: '8px' } });
    const redrawFiles = () => {
      list.replaceChildren();
      for (const f of rec.files || []) {
        list.appendChild(h('span.chip', null, icon('doc'), f.name,
          h('button', {
            type: 'button', 'aria-label': 'Убрать',
            style: { border: 0, background: 'none', padding: 0, marginLeft: '4px', color: 'var(--ink-3)' },
            onclick: () => {
              rec.files = rec.files.filter((x) => x !== f);
              redrawFiles();
            },
          }, icon('close')),
        ));
      }
    };
    const input = h('input', {
      type: 'file', accept: 'image/*,application/pdf', multiple: true,
      style: { display: 'none' },
      onchange: async (e) => {
        for (const file of e.target.files) {
          if (file.size > 4 * 1024 * 1024) { toast('Файл больше 4 МБ пропущен', { icon: 'info' }); continue; }
          const data = await readFileAsDataURL(file);
          (rec.files = rec.files || []).push({ name: file.name, type: file.type, data });
        }
        redrawFiles();
        e.target.value = '';
      },
    });
    wrap.append(list, input,
      h('button.btn.btn--ghost.btn--sm', { type: 'button', onclick: () => input.click() },
        icon('camera'), 'Прикрепить'),
    );
    redrawFiles();
    return wrap;
  }

  return api;
}

/* — Выбор произвольного показателя ————————————— */

function openAnalytePicker(onPick) {
  sheet({
    title: 'Показатель',
    body: (api) => {
      const wrap = h('.stack.stack--sm');
      const search = h('input.input', { type: 'search', placeholder: 'Поиск по названию' });
      const list = h('.card.card--pad0');
      const draw = (q = '') => {
        list.replaceChildren();
        const ql = q.trim().toLowerCase();
        for (const [key, a] of Object.entries(ANALYTES)) {
          if (ql && !(a.name.toLowerCase().includes(ql) || (a.short || '').toLowerCase().includes(ql))) continue;
          list.appendChild(h('button.list__item', {
            type: 'button',
            onclick: () => { api.close(); onPick(key); },
          },
            h('.list__body', null,
              h('.list__t', null, a.name),
              h('.list__s', null, [refText(key), a.unit].filter(Boolean).join(' ')),
            ),
            icon('plus'),
          ));
        }
        if (!list.children.length) {
          list.appendChild(h('.empty', null, h('.empty__s', null, 'Ничего не нашлось')));
        }
      };
      search.addEventListener('input', (e) => draw(e.target.value));
      draw();
      wrap.append(search, list);
      return wrap;
    },
  });
}

/* ==========================================================================
   Демо-распознавание бланка
   ========================================================================== */

export function openScanDemo(ctx) {
  sheet({
    title: 'Загрузить результат',
    body: (api) => h('.stack.stack--sm', null,
      h('.card__sub', { style: { marginTop: 0 } },
        'Лаборатории присылают результат письмом или PDF — оттуда его можно скопировать. ' +
        'Разбор текста работает без интернета и точнее фотографии.'),

      h('button.card.card--tight.row.card--hover', {
        type: 'button', style: { width: '100%', textAlign: 'left', marginTop: 'var(--sp-3)' },
        onclick: () => { api.close(); openPasteSheet(ctx); },
      },
        h('.list__ico', null, icon('doc')),
        h('.list__body', null,
          h('.list__t', null, 'Вставить текст результата'),
          h('.list__s', null, 'Скопируйте из письма или PDF — разберём сами'),
        ),
        h('.badge.badge--accent', null, 'точно'),
      ),

      h('button.card.card--tight.row.card--hover', {
        type: 'button', style: { width: '100%', textAlign: 'left' },
        onclick: () => { api.close(); openPhotoDemo(ctx); },
      },
        h('.list__ico.list__ico--neutral', null, icon('camera')),
        h('.list__body', null,
          h('.list__t', null, 'Фото или PDF бланка'),
          h('.list__s', null, 'Распознавание изображения в демо не настоящее'),
        ),
        h('.badge.badge--info', null, 'демо'),
      ),
    ),
  });
}

/* ==========================================================================
   Вставка текста — настоящий разбор
   ========================================================================== */

const SAMPLE = `Гемоглобин (HGB)   107   г/л      130 - 160
Эритроциты (RBC)   3,56   ×10¹²/л   4,0 - 5,1
Тромбоциты (PLT)   198   ×10⁹/л     180 - 320
Лейкоциты (WBC)    5,1   ×10⁹/л     4,0 - 9,0
Нейтрофилы абс.    2,84   ×10⁹/л    1,8 - 6,5
Ретикулоциты абс.  96,4   ×10⁹/л    25 - 85
ЛДГ                288   Ед/л       125 - 220
Билирубин общий    24,6   мкмоль/л  3,4 - 20,5
Креатинин          0,98   мг/дл     0,7 - 1,2`;

export function openPasteSheet(ctx) {
  let text = '';
  const preview = h('.paste-preview');

  const render = () => {
    const res = parseLabText(text);
    const found = res.order.length;
    preview.replaceChildren();

    if (!text.trim()) {
      preview.appendChild(h('.paste-hint', null,
        'Вставьте текст — показатели появятся здесь по мере разбора.'));
      return res;
    }

    preview.appendChild(h('.paste-stat', null,
      h('.paste-stat__n.num', null, String(found)),
      h('div', null,
        /* число уже стоит крупно рядом, второй раз его писать незачем */
        h('.paste-stat__t', null, found ? pluralWord(found, 'показатель', 'показателя', 'показателей') + ' найдено' : 'Пока ничего не нашли'),
        h('.paste-stat__s', null, [
          res.date ? 'дата ' + fmtDate(res.date, { year: true }) : null,
          res.lab ? 'лаборатория распознана' : null,
          res.skipped.length ? plural(res.skipped.length, 'строка', 'строки', 'строк') + ' не разобрано' : null,
        ].filter(Boolean).join(' · ') ||
          (found ? 'единицы распознаны, всё можно поправить дальше'
                 : 'нужен формат: название, затем значение')),
      ),
    ));

    const chips = h('.chips', { style: { marginTop: 'var(--sp-3)' } });
    res.order.forEach((key, i) => {
      const a = analyte(key);
      const cls = res.values[key].sure ? '.is-on' : '.chip--check';
      chips.appendChild(h('span.chip' + cls, {
        style: { animationDelay: (i * 28) + 'ms' },
      }, `${a.short} ${String(res.values[key].value).replace('.', ',')}`));
    });
    if (found) preview.appendChild(chips);

    if (res.skipped.length) {
      preview.appendChild(h('.field__hint', { style: { marginTop: 'var(--sp-3)' } },
        'Не разобрали: ' + res.skipped.slice(0, 3).map((l) => l.slice(0, 40)).join(' · ') +
        (res.skipped.length > 3 ? ' и ещё…' : '')));
    }
    return res;
  };

  const area = h('textarea.textarea.paste-area', {
    placeholder: 'Вставьте сюда текст результата из письма или PDF',
    rows: 7,
    oninput: (e) => { text = e.target.value; render(); },
  });

  sheet({
    title: 'Вставить текст результата',
    body: h('.stack', null,
      area,
      h('.row', { style: { gap: 'var(--sp-2)', flexWrap: 'wrap' } },
        h('button.btn.btn--ghost.btn--sm', {
          type: 'button',
          onclick: async () => {
            try {
              const t = await navigator.clipboard.readText();
              if (!t) { toast('В буфере пусто', { icon: 'info' }); return; }
              area.value = t; text = t; render(); tap();
            } catch (_) {
              toast('Браузер не дал доступ к буферу — вставьте вручную', { icon: 'info' });
              area.focus();
            }
          },
        }, icon('doc'), 'Вставить из буфера'),
        h('button.btn.btn--quiet.btn--sm', {
          type: 'button',
          onclick: () => { area.value = SAMPLE; text = SAMPLE; render(); },
        }, 'Показать на примере'),
      ),
      preview,
      h('.field__hint', null,
        'Значения в чужих единицах пересчитываются автоматически. ' +
        'Всё, что разобрали, можно поправить на следующем шаге.'),
    ),
    foot: (api) => frag(
      h('button.btn.btn--ghost', { type: 'button', onclick: () => api.close() }, 'Отмена'),
      h('button.btn.btn--primary', {
        type: 'button',
        onclick: () => {
          const res = parseLabText(text);
          if (!res.order.length) { toast('Ничего не нашли в тексте', { icon: 'info' }); return; }

          const prefill = {}, units = {}, unsure = [];
          for (const key of res.order) {
            const v = res.values[key];
            prefill[key] = v.value;
            units[key] = v.unit;
            if (!v.sure) unsure.push(key);
          }
          api.close();
          openLabForm(ctx, {
            panelId: guessPanel(res.order),
            date: res.date || today(),
            prefill, prefillUnits: units, unsure,
            source: 'paste',
            lab: res.lab,
          });
        },
      }, icon('check'), 'Заполнить форму'),
    ),
  });

  render();
}

/** Набор, в который попало больше всего найденных показателей. */
function guessPanel(keys) {
  let best = null, bestHits = 0;
  for (const p of PANELS) {
    const hits = keys.filter((k) => p.keys.includes(k)).length;
    if (hits > bestHits) { bestHits = hits; best = p.id; }
  }
  return bestHits >= 2 ? best : null;
}

/* — Демо-распознавание фотографии осталось как было ——————— */

function openPhotoDemo(ctx) {
  sheet({
    title: 'Фото бланка',
    body: (api) => {
      const wrap = h('.stack');
      wrap.appendChild(h('.row', null, h('.demo-ribbon', null, icon('info'), 'Демо-режим распознавания')));
      wrap.appendChild(h('.card__sub', { style: { marginTop: 0 } },
        'В демо распознавание изображения не настоящее: после «сканирования» откроется форма ' +
        'с примерными значениями, каждое можно исправить.'));

      const input = h('input', {
        type: 'file', accept: 'image/*,application/pdf', style: { display: 'none' },
        onchange: () => runScan(api, ctx),
      });

      wrap.append(input,
        h('.grid-2', { style: { marginTop: 'var(--sp-4)' } },
          h('button.btn.btn--primary', { type: 'button', onclick: () => input.click() },
            icon('camera'), 'Выбрать файл'),
          h('button.btn.btn--ghost', { type: 'button', onclick: () => runScan(api, ctx) },
            icon('sparkle'), 'Без файла'),
        ),
      );
      return wrap;
    },
  });
}

function runScan(api, ctx) {
  const body = api.body;
  body.replaceChildren();

  const scan = h('.scan', null,
    h('.scan__doc', null,
      ...Array.from({ length: 9 }, (_, i) => h('.scan__line-fake', {
        style: { width: (45 + ((i * 37) % 50)) + '%' },
      })),
    ),
    h('.scan__beam'), h('.scan__edge'),
    h('.scan__corner.scan__corner--tl'), h('.scan__corner.scan__corner--tr'),
    h('.scan__corner.scan__corner--bl'), h('.scan__corner.scan__corner--br'),
  );

  const status = h('.card__sub', {
    style: { textAlign: 'center', marginTop: 'var(--sp-4)', minHeight: '22px' },
  }, 'Ищем таблицу с показателями…');

  body.append(scan, status);
  api.setFoot(null);

  const steps = ['Ищем таблицу с показателями…', 'Читаем названия и единицы…', 'Сверяем с референсами…'];
  let i = 0;
  const tick = setInterval(() => {
    i++;
    if (i < steps.length) status.textContent = steps[i];
  }, 750);

  setTimeout(() => {
    clearInterval(tick);
    api.close();
    /* правдоподобные значения одного бланка ОАК + биохимии */
    const prefill = {
      hb: 108, rbc: 3.62, plt: 187, wbc: 5.4, anc: 2.71, retic: 96.4,
      ldh: 288, bil_t: 24.6, bil_d: 4.1, bil_i: 20.5, creat: 89, alt: 31, ast: 34,
    };
    openLabForm(ctx, {
      panelId: 'oak',
      prefill,
      unsure: ['retic', 'bil_d', 'anc'],
      source: 'scan',
    });
  }, 2400);
}

/* ==========================================================================
   Карточка одной сдачи
   ========================================================================== */

function renderLabItem(ctx) {
  const S = ctx.screen;
  const l = store.labById(ctx.route.param);
  if (!l) {
    S.appendChild(h('.empty', null, h('.empty__t', null, 'Запись не найдена')));
    return { title: 'Анализ' };
  }
  for (const n of labDetailNodes(l, ctx)) S.appendChild(n);
  return { title: fmtDate(l.date), sub: fmtRelative(l.date) };
}

/**
 * Подробности одной сдачи: шапка, значения, файлы, кнопка правки.
 * Один и тот же набор идёт и на отдельный экран, и в панель справа —
 * чтобы они не разъезжались при правках.
 */
function labDetailNodes(l, ctx) {
  const out = [];
  const cd = cycleDayOf(l.date);
  out.push(h('.section', { style: { marginTop: 'var(--sp-4)' } },
    h('.card', null,
      h('.row', { style: { flexWrap: 'wrap', gap: '6px' } },
        l.beforeInfusion ? h('.badge.badge--accent', null, 'до инфузии') : null,
        cd ? h('.badge', null, `день ${cd} из ${store.state.profile.interval || 14}`) : null,
        l.time ? h('.badge', null, l.time) : null,
      ),
      h('.card__title', { style: { marginTop: '8px' } }, fmtDate(l.date, { year: true })),
      h('.card__sub', null, [(l.panels || []).map((p) => (panelById(p) || {}).name).join(', '), l.lab]
        .filter(Boolean).join(' · ')),
      l.note ? h('.med__note', null, l.note) : null,
    ),
  ));

  /* значения с референсами рядом */
  const list = h('.card.card--pad0');
  for (const [key, v] of Object.entries(l.values || {})) {
    const a = analyte(key);
    const own = (l.refs && l.refs[key]) || null;
    const ev = evaluate(key, v, store.state.thresholds, own);
    list.appendChild(h('.list__item', null,
      h('.list__body', null,
        h('.list__t', null, a.name),
        h('.list__s', null, [
          own ? 'норма бланка ' + refLabel(own, key) : refText(key),
          a.unit,
        ].filter(Boolean).join(' ')),
      ),
      h('div', { style: { textAlign: 'right' } },
        h('.metric__v', {
          style: {
            justifyContent: 'flex-end',
            color: ev.level === 'alert' ? 'var(--alert)' : ev.level === 'warn' ? 'var(--warn)' : 'var(--ink)',
          },
        }, fmtNum(v, a.dec)),
        ev.text ? h('.flag.flag--' + (ev.level === 'alert' ? 'alert' : 'warn'), null, ev.text) : null,
      ),
    ));
  }
  out.push(h('.section', null,
    h('.section__head', null, h('.section__title', null, 'Значения')),
    list,
  ));

  /* файлы */
  if (l.files && l.files.length) {
    out.push(h('.section', null,
      h('.section__head', null, h('.section__title', null, 'Файлы')),
      h('.chips', null, ...l.files.map((f) => h('a.chip', {
        href: f.data, download: f.name, target: '_blank', rel: 'noopener',
      }, icon(f.type && f.type.startsWith('image') ? 'image' : 'doc'), f.name))),
    ));
  }

  out.push(h('.section', null,
    h('button.btn.btn--ghost.btn--block', {
      type: 'button',
      onclick: () => openLabForm(ctx, { existing: { ...l }, panelId: (l.panels || [])[0] || null }),
    }, icon('edit'), 'Изменить'),
  ));

  return out;
}

/* ==========================================================================
   Прочие исследования
   ========================================================================== */

function renderStudies(ctx) {
  const S = ctx.screen;

  S.appendChild(h('.section', { style: { marginTop: 'var(--sp-4)' } },
    h('.card__sub', { style: { marginTop: 0 } },
      'Здесь без показателей: только название, дата, файл и дата следующего контроля.'),
    h('button.btn.btn--primary.btn--block', {
      type: 'button', style: { marginTop: 'var(--sp-4)' },
      onclick: () => openStudyForm(ctx),
    }, icon('plus'), 'Добавить исследование'),
  ));

  const rows = store.state.studies.slice().reverse();
  if (!rows.length) {
    S.appendChild(h('.empty', null,
      h('.empty__t', null, 'Пока пусто'),
      h('.empty__s', null, 'УЗИ, костный мозг, ПНГ-клон, ЭхоКГ — всё, что не измеряется числами.'),
    ));
    return;
  }

  const list = h('.card.card--pad0');
  for (const s of rows) {
    const overdue = s.next && s.next <= today();
    list.appendChild(h('button.list__item', {
      type: 'button', onclick: () => openStudyForm(ctx, s),
    },
      h('.list__ico' + (overdue ? '.list__ico--warm' : '.list__ico--neutral'), null, icon('eye')),
      h('.list__body', null,
        h('.list__t', null, s.name),
        h('.list__s', null, [
          fmtDate(s.date, { year: true }),
          s.next ? 'контроль ' + fmtDate(s.next, { year: true }) : null,
          s.note || null,
        ].filter(Boolean).join(' · ')),
      ),
      overdue ? h('.badge.badge--warn', null, 'срок') : null,
      icon('chevron'),
    ));
  }
  S.appendChild(h('.section', null, list));
}

function openStudyForm(ctx, existing = null) {
  const rec = existing ? { ...existing } : { date: today(), name: '', next: null, note: '', files: [] };
  sheet({
    title: existing ? 'Исследование' : 'Новое исследование',
    body: h('.stack', null,
      h('.field', null,
        h('label.field__label', null, 'Название'),
        h('input.input', {
          type: 'text', value: rec.name, placeholder: 'Например, УЗИ брюшной полости',
          oninput: (e) => { rec.name = e.target.value; },
        }),
      ),
      h('.grid-2', null,
        h('.field', null,
          h('label.field__label', null, 'Дата'),
          h('input.input', { type: 'date', value: rec.date, oninput: (e) => { rec.date = e.target.value; } }),
        ),
        h('.field', null,
          h('label.field__label', null, 'Следующий контроль'),
          h('input.input', { type: 'date', value: rec.next || '', oninput: (e) => { rec.next = e.target.value || null; } }),
        ),
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
              const ok = await confirmSheet({ title: 'Удалить?', text: rec.name, ok: 'Удалить', danger: true });
              if (!ok) return;
              await store.remove('studies', rec.id);
              api.close(); toast('Удалено'); ctx.rerender();
            },
          }, icon('trash'))
        : h('button.btn.btn--ghost', { type: 'button', onclick: () => api.close() }, 'Отмена'),
      h('button.btn.btn--primary', {
        type: 'button',
        onclick: async () => {
          if (!rec.name.trim()) { toast('Укажите название', { icon: 'info' }); return; }
          await store.upsert('studies', rec);
          api.close(); toast('Сохранено', { icon: 'check' }); ctx.rerender();
        },
      }, 'Сохранить'),
    ),
  });
}
