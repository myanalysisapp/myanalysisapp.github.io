/* ==========================================================================
   Приветствие: три лёгких экрана, затем быстрый старт или демо-данные.
   ========================================================================== */

import { h, icon, toast, today, addDays, tap } from '../ui.js';
import * as store from '../store.js';
import { loadDemo } from '../demo.js';
import { brandMark } from '../app.js';

const SLIDES = [
  {
    art: artDiary,
    title: 'Дневник здоровья,\nкоторый всё помнит за вас',
    text: 'Анализы с нормами под рукой, инфузии, самочувствие и лекарства — в одном месте. ' +
          'Отчёт для врача собирается за пару касаний.',
  },
  {
    art: artDevice,
    title: 'Данные остаются\nна вашем устройстве',
    text: 'Приложение работает без интернета и ничего никуда не отправляет. ' +
          'Выгрузить или удалить всё можно в один клик.',
  },
  {
    art: artFree,
    title: 'Всё бесплатно.\nБез подписок и замков',
    text: 'Ни одной функции за деньги, ни одного платного экрана. ' +
          'Всё, что есть в приложении, доступно сразу.',
  },
];

export default function renderOnboarding(ctx) {
  const root = h('.ob');
  /* .ob__side — картинка, .ob__body — текст и кнопки.
     На телефоне идут друг за другом, на компьютере встают рядом. */
  let side = null;
  let body = null;
  let step = 0;                 // 0..2 — слайды, 3 — форма старта
  draw();
  return root;

  function draw() {
    side = h('.ob__side');
    body = h('.ob__body');
    root.replaceChildren(h('.ob__inner', null, side, body));
    if (step < SLIDES.length) drawSlide();
    else drawStart();
  }

  /* — Слайды —————————————————————————————————— */

  function drawSlide() {
    const s = SLIDES[step];

    body.appendChild(brandRow(44));
    side.appendChild(h('.ob__art', null, s.art()));
    body.appendChild(h('h1.ob__t', { style: { whiteSpace: 'pre-line' } }, s.title));
    body.appendChild(h('p.ob__s', null, s.text));

    const dots = h('.ob__dots');
    SLIDES.forEach((_, i) => dots.appendChild(h('span.ob__dot' + (i === step ? '.is-on' : ''))));
    body.appendChild(dots);

    body.appendChild(h('.ob__acts', null,
      h('button.btn.btn--primary.btn--lg.btn--block', {
        type: 'button',
        onclick: () => { tap(); step++; draw(); },
      }, step === SLIDES.length - 1 ? 'Дальше' : 'Продолжить'),
      h('button.btn.btn--quiet.btn--block', {
        type: 'button',
        onclick: () => { step = SLIDES.length; draw(); },
      }, 'Пропустить'),
    ));
  }

  /* — Быстрый старт ————————————————————————————— */

  function drawStart() {
    const form = {
      name: '',
      disease: 'png',
      diseaseOther: '',
      lastInfusion: addDays(today(), -8),
      interval: 14,
      /* Препарат спрашиваем, а не подставляем: при ПНГ назначают и
         экулизумаб, и равулизумаб, и другие. Подсказка в поле — это
         подсказка, а не выбор за человека. */
      drug: '',
      dose: '',
    };

    side.appendChild(h('.ob__art', null, artStart()));
    body.appendChild(brandRow(44));
    body.appendChild(h('h1.ob__t', null, 'Давайте начнём'));
    body.appendChild(h('p.ob__s', null,
      'Это займёт полминуты. Всё, что вы введёте, можно будет поменять в любой момент.'));

    const nameIn = h('input.input', {
      type: 'text', placeholder: 'Например, Иван', autocomplete: 'given-name',
      oninput: (e) => { form.name = e.target.value; },
    });

    const otherWrap = h('.field.hidden', null,
      h('label.field__label', null, 'Название заболевания'),
      h('input.input', {
        type: 'text', placeholder: 'Как записано в выписке',
        oninput: (e) => { form.diseaseOther = e.target.value; },
      }),
    );

    const infusionWrap = h('.stack');
    const dateIn = h('input.input', {
      type: 'date', value: form.lastInfusion, max: today(),
      oninput: (e) => { form.lastInfusion = e.target.value; },
    });
    const intervalIn = h('input.input.input--num', {
      type: 'number', value: 14, min: 1, max: 90, inputmode: 'numeric',
      oninput: (e) => { form.interval = Number(e.target.value) || 14; },
    });
    const drugIn = h('input.input', {
      type: 'text', placeholder: 'Например, Экулизумаб', autocomplete: 'off',
      oninput: (e) => { form.drug = e.target.value; },
    });
    const doseIn = h('input.input', {
      type: 'text', placeholder: 'Например, 900 мг', autocomplete: 'off',
      oninput: (e) => { form.dose = e.target.value; },
    });

    infusionWrap.append(
      h('.grid-2', null,
        h('.field', null,
          h('label.field__label', null, 'Препарат'),
          drugIn,
        ),
        h('.field', null,
          h('label.field__label', null, 'Доза'),
          doseIn,
        ),
      ),
      h('.field', null,
        h('label.field__label', null, 'Дата последней инфузии'),
        dateIn,
        h('.field__hint', null, 'Если инфузий ещё не было — оставьте поле и поменяйте позже'),
      ),
      h('.field', null,
        h('label.field__label', null, 'Интервал между инфузиями, дней'),
        intervalIn,
      ),
    );

    const diseaseChips = h('.chips', null,
      chip('ПНГ', true, (on) => {
        form.disease = 'png';
        otherWrap.classList.add('hidden');
        infusionWrap.classList.remove('hidden');
      }),
      chip('Другое', false, () => {
        form.disease = 'other';
        otherWrap.classList.remove('hidden');
      }),
    );

    body.appendChild(h('.stack.ob__form', null,
      h('.field', null, h('label.field__label', null, 'Как к вам обращаться'), nameIn),
      h('.field', null, h('label.field__label', null, 'Заболевание'), diseaseChips),
      otherWrap,
      infusionWrap,
    ));

    body.appendChild(h('.ob__acts', { style: { marginTop: 'var(--sp-6)' } },
      h('button.btn.btn--primary.btn--lg.btn--block', {
        type: 'button',
        onclick: async () => {
          tap();
          await startFresh(form);
        },
      }, 'Начать'),
      h('button.btn.btn--ghost.btn--block', {
        type: 'button',
        onclick: async () => {
          tap();
          const btn = root.querySelector('.btn--ghost');
          btn.disabled = true;
          btn.textContent = 'Готовим демо…';
          await loadDemo();
          toast('Демо-данные загружены', { icon: 'sparkle' });
          location.hash = '#/today';
          ctx.renderApp();
        },
      }, 'Посмотреть на демо-данных'),
    ));

    /* сноска стоит отдельной строкой: внутри ряда кнопок она бы сжалась в столбик */
    body.appendChild(h('p.disclaimer.ob__note', null,
      'Сервис — вспомогательный инструмент для ведения дневника и не заменяет консультацию врача.'));
  }

  /** Логотип с названием — одинаково на слайдах и в форме. */
  function brandRow(size) {
    return h('.ob__brand', null,
      logoMark(size),
      h('div', null,
        h('.ob__brand-name', null, 'Мой Анализ'),
        h('.ob__brand-sub', null, 'дневник здоровья'),
      ),
    );
  }

  function chip(label, on, onPick) {
    const el = h('button.chip', { type: 'button', 'aria-pressed': on ? 'true' : 'false' }, label);
    el.addEventListener('click', () => {
      for (const sib of el.parentNode.children) sib.setAttribute('aria-pressed', 'false');
      el.setAttribute('aria-pressed', 'true');
      onPick(true);
      tap();
    });
    return el;
  }

  async function startFresh(form) {
    const name = form.name.trim();
    await store.saveProfile({
      name,
      disease: form.disease,
      diseaseName: form.disease === 'png'
        ? 'Пароксизмальная ночная гемоглобинурия (ПНГ)'
        : (form.diseaseOther.trim() || 'Не указано'),
      interval: form.interval,
      drug: form.drug.trim() || 'Препарат не указан',
      dose: form.dose.trim(),
      lastInfusion: form.disease === 'png' ? form.lastInfusion : null,
      onboarded: true,
      demo: false,
    });

    /* первая инфузия в истории — чтобы кольцо интервала заработало сразу */
    if (form.disease === 'png' && form.lastInfusion) {
      await store.upsert('infusions', {
        date: form.lastInfusion, done: true,
        drug: form.drug.trim() || 'Препарат не указан',
        dose: form.dose.trim(), place: '',
      });
      await store.upsert('infusions', {
        date: addDays(form.lastInfusion, form.interval), done: false,
        drug: form.drug.trim() || 'Препарат не указан',
        dose: form.dose.trim(), place: '',
      });
    }

    /* базовые напоминания — видимые и редактируемые в одном месте */
    await store.replaceAll('reminders', [
      { id: 'rem_labs', title: 'Сдать анализы до инфузии', kind: 'beforeInfusion', daysBefore: 1, time: '18:00', enabled: true },
      { id: 'rem_inf',  title: 'Инфузия', kind: 'beforeInfusion', daysBefore: 0, time: '08:00', enabled: true },
    ]);

    toast(name ? `Рады знакомству, ${name}` : 'Готово', { icon: 'check' });
    location.hash = '#/today';
    ctx.renderApp();
  }
}

/* — Логотип: файл, если он есть, иначе аккуратный знак —————— */

function logoMark(size) {
  const el = brandMark(size);
  el.style.display = 'block';
  return el;
}

/* ==========================================================================
   Иллюстрации — свои, лёгкие, в цветах приложения
   ========================================================================== */

const NS = 'http://www.w3.org/2000/svg';

function svg(inner, vb = '0 0 220 180') {
  const s = document.createElementNS(NS, 'svg');
  s.setAttribute('viewBox', vb);
  s.setAttribute('fill', 'none');
  s.setAttribute('aria-hidden', 'true');
  s.innerHTML = inner;
  return s;
}

function artDiary() {
  return svg(`
    <defs>
      <linearGradient id="a1" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="var(--accent-bright)"/>
        <stop offset="100%" stop-color="var(--accent-deep)"/>
      </linearGradient>
    </defs>
    <rect x="18" y="26" width="128" height="132" rx="18" fill="var(--surface)"
          stroke="var(--line)" stroke-width="1.5"/>
    <rect x="34" y="46" width="62" height="8" rx="4" fill="var(--line)"/>
    <rect x="34" y="64" width="92" height="6" rx="3" fill="var(--line-soft)"/>
    <rect x="34" y="78" width="74" height="6" rx="3" fill="var(--line-soft)"/>
    <rect x="34" y="100" width="96" height="42" rx="10" fill="var(--accent-soft)"/>
    <path d="M44 128l12-12 10 9 12-17 10 12 12-8" stroke="var(--accent)" stroke-width="2.6"
          stroke-linecap="round" stroke-linejoin="round"/>
    <circle cx="164" cy="92" r="40" fill="var(--surface)" stroke="var(--line)" stroke-width="1.5"/>
    <circle cx="164" cy="92" r="30" stroke="var(--surface-alt)" stroke-width="9" fill="none"/>
    <circle cx="164" cy="92" r="30" stroke="url(#a1)" stroke-width="9" fill="none"
            stroke-linecap="round" stroke-dasharray="188" stroke-dashoffset="62"
            transform="rotate(-90 164 92)"/>
    <text x="164" y="98" text-anchor="middle" font-size="20" font-weight="700"
          fill="var(--ink)" font-family="system-ui">9</text>
  `);
}

function artDevice() {
  return svg(`
    <rect x="66" y="16" width="88" height="148" rx="16" fill="var(--surface)"
          stroke="var(--line)" stroke-width="1.5"/>
    <rect x="96" y="24" width="28" height="5" rx="2.5" fill="var(--line)"/>
    <rect x="78" y="44" width="64" height="8" rx="4" fill="var(--line-soft)"/>
    <rect x="78" y="60" width="44" height="6" rx="3" fill="var(--line-soft)"/>
    <rect x="86" y="82" width="48" height="52" rx="12" fill="var(--accent-soft)"/>
    <path d="M100 104v-8a10 10 0 0 1 20 0v8" stroke="var(--accent)" stroke-width="3"
          stroke-linecap="round"/>
    <rect x="96" y="103" width="28" height="22" rx="6" fill="var(--accent)"/>
    <circle cx="110" cy="114" r="3" fill="var(--surface)"/>
    <path d="M30 96h22M168 96h22" stroke="var(--line-strong)" stroke-width="2"
          stroke-linecap="round" stroke-dasharray="4 6"/>
    <path d="M40 86l-10 10 10 10M180 86l10 10-10 10" stroke="var(--line-strong)"
          stroke-width="2" stroke-linecap="round" stroke-linejoin="round" opacity=".55"/>
    <path d="M26 82l14 28M180 82l14 28" stroke="var(--alert)" stroke-width="2.4"
          stroke-linecap="round" opacity=".5"/>
  `);
}

function artStart() {
  return svg(`
    <circle cx="110" cy="90" r="66" fill="var(--accent-soft)"/>
    <rect x="58" y="34" width="104" height="112" rx="16" fill="var(--surface)"
          stroke="var(--line)" stroke-width="1.5"/>
    <rect x="74" y="54" width="46" height="7" rx="3.5" fill="var(--line)"/>
    <rect x="74" y="70" width="72" height="9" rx="4.5" fill="var(--surface-alt)"/>
    <rect x="74" y="92" width="34" height="7" rx="3.5" fill="var(--line)"/>
    <rect x="74" y="108" width="72" height="9" rx="4.5" fill="var(--surface-alt)"/>
    <circle cx="150" cy="128" r="20" fill="var(--accent)"/>
    <path d="M142 128l5.5 5.5L159 122" stroke="#fff" stroke-width="3.2"
          stroke-linecap="round" stroke-linejoin="round"/>
  `);
}

function artFree() {
  return svg(`
    <circle cx="110" cy="90" r="62" fill="var(--accent-soft)"/>
    <path d="M78 96l18 18 46-46" stroke="var(--accent)" stroke-width="7"
          stroke-linecap="round" stroke-linejoin="round"/>
    <rect x="150" y="24" width="44" height="34" rx="10" fill="var(--surface)"
          stroke="var(--line)" stroke-width="1.5"/>
    <path d="M160 41h24" stroke="var(--line-strong)" stroke-width="3" stroke-linecap="round"/>
    <path d="M152 26l40 30" stroke="var(--alert)" stroke-width="3" stroke-linecap="round"/>
    <rect x="26" y="122" width="52" height="34" rx="10" fill="var(--surface)"
          stroke="var(--line)" stroke-width="1.5"/>
    <path d="M38 139h28" stroke="var(--line-strong)" stroke-width="3" stroke-linecap="round"/>
    <path d="M28 124l48 30" stroke="var(--alert)" stroke-width="3" stroke-linecap="round"/>
  `);
}
