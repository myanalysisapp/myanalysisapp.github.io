/* ==========================================================================
   Переключатель внутри «Анализов».

   Раньше список сдач и графики были двумя отдельными вкладками нижней
   панели — «Анализы» и «Динамика». Это деление удобно разработчику, а не
   пациенту: человек думает «мои анализы» и хочет там и числа, и кривую,
   и календарь. Вкладки слились в одну, а выбор представления переехал
   сюда, наверх экрана.
   ========================================================================== */

import { h, tap } from '../ui.js';

const VIEWS = [
  { id: 'list',   label: 'Список',    go: 'labs' },
  { id: 'charts', label: 'Графики',   go: 'trends' },
  { id: 'cal',    label: 'Календарь', go: 'trends/calendar' },
];

/**
 * @param {object} ctx   контекст экрана
 * @param {string} active  list | charts | cal
 */
export function labsNav(ctx, active) {
  const wrap = h('.segmented', { role: 'tablist', 'aria-label': 'Представление' });
  for (const v of VIEWS) {
    const on = v.id === active;
    wrap.appendChild(h('button.segmented__item' + (on ? '.is-on' : ''), {
      type: 'button',
      role: 'tab',
      'aria-selected': on ? 'true' : 'false',
      onclick: () => { if (on) return; tap(); ctx.go(v.go); },
    }, v.label));
  }
  return wrap;
}
