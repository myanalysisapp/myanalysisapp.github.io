/* ==========================================================================
   Карточка безопасности — то, что показывают врачу скорой.
   Крупно, на весь экран, с QR-кодом. Печать в размер банковской карты.
   ========================================================================== */

import { h, icon, sheet, toast, today, fmtDate, printNode } from '../ui.js';
import * as store from '../store.js';
import { qrSvg } from '../qr.js';
import { SAFETY_DEFAULTS, therapyName } from '../catalog.js';

export function renderSafety(ctx) {
  const S = ctx.screen;
  const s = store.state.safety;
  const p = store.state.profile;
  const c = store.cycle();

  S.appendChild(h('.section', { style: { marginTop: 'var(--sp-4)' } },
    h('.card__sub', { style: { marginTop: 0 } },
      'Покажите этот экран врачу. Всё, что здесь написано, вносите вы сами — ' +
      'перепишите из выписки, чтобы ничего не искать в трудный момент.'),
  ));

  S.appendChild(h('.section', null, safetyCard()));

  S.appendChild(h('.section', null,
    h('.grid-2', null,
      h('button.btn.btn--primary', {
        type: 'button',
        onclick: () => printNode(printCards()),
      }, icon('print'), 'Печать'),
      h('button.btn.btn--ghost', {
        type: 'button', onclick: () => openSafetyForm(ctx),
      }, icon('edit'), 'Изменить'),
    ),
    h('.field__hint', { style: { marginTop: 'var(--sp-3)', textAlign: 'center' } },
      'Печатается двусторонняя карточка в размер банковской: лицевая сторона — ' +
      'кто вы и чем лечитесь, оборот — противопоказания, контакты и QR.'),
  ));

  S.appendChild(h('p.disclaimer', null,
    'Карточка содержит только те сведения, которые внесли вы. Это не медицинский документ.'));

  return {};

  function safetyCard() {
    const card = h('.safety');
    card.appendChild(h('.safety__h', null, 'Карточка пациента'));
    card.appendChild(h('.safety__name', null, s.fullName || p.name || 'Имя не указано'));
    card.appendChild(h('.safety__dx', null, s.diagnosis || p.diseaseName));

    if (s.birth || s.bloodType) {
      card.appendChild(h('.safety__v', { style: { marginTop: '6px', opacity: .78 } },
        [s.birth ? 'д. р. ' + s.birth : null, s.bloodType].filter(Boolean).join(' · ')));
    }

    /* терапия */
    const meds = store.activeMeds(today());
    card.appendChild(h('.safety__sec', null,
      h('.safety__lbl', null, 'Терапия'),
      h('.safety__v', null,
        `${therapyName(p)}, каждые ${p.interval} дней. ` +
        (c.last ? `Последняя инфузия ${fmtDate(c.last.date, { year: true })}.` : 'Инфузии не отмечены.')),
      meds.length ? h('.safety__v', { style: { marginTop: '4px' } },
        meds.map((m) => `${m.name} ${m.perDose || m.dose}` +
          ((m.times || []).length ? ` × ${m.times.length}` : '')).join('; ')) : null,
    ));

    /* противопоказания */
    const contra = (s.contraindications && s.contraindications.length)
      ? s.contraindications : SAFETY_DEFAULTS.contraindications;
    card.appendChild(h('.safety__sec', null,
      h('.safety__lbl', null, 'Противопоказано'),
      h('.safety__v', null, contra.join(' · ')),
    ));

    /* предупреждение */
    card.appendChild(h('.safety__warn', null, s.warning || SAFETY_DEFAULTS.warning));

    /* контакты */
    if (s.doctor || s.center) {
      card.appendChild(h('.safety__sec', null,
        h('.safety__lbl', null, 'Контакты'),
        s.doctor ? h('.safety__v', null, s.doctor + (s.doctorPhone ? ' — ' + s.doctorPhone : '')) : null,
        s.center ? h('.safety__v', null, s.center + (s.centerPhone ? ' — ' + s.centerPhone : '')) : null,
      ));
    }

    /* QR — генерируется локально */
    try {
      const svg = qrSvg(safetyText(), { ecl: 'M', px: 148, dark: '#10201D', light: '#ffffff' });
      card.appendChild(h('.safety__qr', null, svg));
    } catch (e) {
      console.error(e);
      card.appendChild(h('.safety__v', { style: { marginTop: '12px', opacity: .7 } },
        'QR-код не поместился: сократите контакты или диагноз.'));
    }

    return card;
  }

  /* ——— Двусторонняя карточка для печати ———
     На 85,6 × 54 мм всё сразу не помещается, поэтому лицевая сторона —
     кто перед врачом и чем лечится, оборот — противопоказания и контакты. */
  function printCards() {
    const meds = store.activeMeds(today());
    const contra = (s.contraindications && s.contraindications.length)
      ? s.contraindications : SAFETY_DEFAULTS.contraindications;

    const front = h('.safety.safety--card', null,
      h('.safety__h', null, 'Карточка пациента'),
      h('.safety__name', null, s.fullName || p.name || 'Имя не указано'),
      h('.safety__dx', null, s.diagnosis || p.diseaseName),
      (s.birth || s.bloodType)
        ? h('.safety__v', { style: { marginTop: '2px', opacity: .8 } },
            [s.birth ? 'д. р. ' + s.birth : null, s.bloodType].filter(Boolean).join(' · '))
        : null,
      h('.safety__sec', null,
        h('.safety__lbl', null, 'Терапия'),
        h('.safety__v', null,
          `${therapyName(p)}, каждые ${p.interval} дн.` +
          (c.last ? ` Последняя инфузия ${fmtDate(c.last.date, { year: true })}.` : '')),
        meds.length
          ? h('.safety__v', null, meds.map((m) => `${m.name} ${m.perDose || m.dose}`).join('; '))
          : null,
      ),
      h('.safety__warn', null, s.warning || SAFETY_DEFAULTS.warning),
      h('.safety__side', null, 'лицевая сторона'),
    );

    const back = h('.safety.safety--card.safety--back', null,
      h('.safety__sec', { style: { marginTop: 0 } },
        h('.safety__lbl', null, 'Противопоказано'),
        h('.safety__v', null, contra.join(' · ')),
      ),
      (s.doctor || s.center) ? h('.safety__sec', null,
        h('.safety__lbl', null, 'Контакты'),
        s.doctor ? h('.safety__v', null, s.doctor + (s.doctorPhone ? ' — ' + s.doctorPhone : '')) : null,
        s.center ? h('.safety__v', null, s.center + (s.centerPhone ? ' — ' + s.centerPhone : '')) : null,
      ) : null,
      h('.safety__side', null, 'оборот · «Мой Анализ»'),
    );

    try {
      back.appendChild(h('.safety__qr', null,
        qrSvg(safetyText(), { ecl: 'M', px: 148, dark: '#000', light: '#fff' })));
    } catch (_) { /* если текст слишком длинный — печатаем без QR */ }

    return h('.safety-print-wrap', null,
      front,
      h('.safety-cut', null, 'линия сгиба / разреза'),
      back,
    );
  }

  function safetyText() {
    const meds = store.activeMeds(today());
    const contra = (s.contraindications && s.contraindications.length)
      ? s.contraindications : SAFETY_DEFAULTS.contraindications;
    return [
      s.fullName || p.name || '',
      s.birth ? 'д.р. ' + s.birth : '',
      'Диагноз: ' + (s.diagnosis || p.diseaseName),
      s.bloodType ? 'Группа крови: ' + s.bloodType : '',
      `Терапия: ${therapyName(p)} каждые ${p.interval} дн.`,
      c.last ? 'Последняя инфузия: ' + fmtDate(c.last.date, { year: true }) : '',
      meds.length ? 'Приём: ' + meds.map((m) => `${m.name} ${m.perDose || m.dose}`).join('; ') : '',
      'Противопоказано: ' + contra.join(', '),
      s.warning || SAFETY_DEFAULTS.warning,
      s.doctor ? `Гематолог: ${s.doctor} ${s.doctorPhone || ''}`.trim() : '',
      s.center ? `Центр: ${s.center} ${s.centerPhone || ''}`.trim() : '',
    ].filter(Boolean).join('\n');
  }
}

/* ==========================================================================
   Форма карточки
   ========================================================================== */

function openSafetyForm(ctx) {
  const s = { ...store.state.safety };
  const contra = [...((s.contraindications && s.contraindications.length)
    ? s.contraindications : SAFETY_DEFAULTS.contraindications)];

  const contraWrap = h('.chips');
  const drawContra = () => {
    contraWrap.replaceChildren();
    contra.forEach((c, i) => {
      contraWrap.appendChild(h('span.chip.is-on', null, c,
        h('button', {
          type: 'button', 'aria-label': 'Убрать',
          style: { border: 0, background: 'none', padding: 0, marginLeft: '4px', color: 'inherit' },
          onclick: () => { contra.splice(i, 1); drawContra(); },
        }, icon('close')),
      ));
    });
    contraWrap.appendChild(h('button.chip', {
      type: 'button',
      onclick: () => {
        let text = '';
        sheet({
          title: 'Противопоказание',
          body: h('.field', null,
            h('label.field__label', null, 'Что нельзя'),
            h('input.input', { type: 'text', autofocus: true, oninput: (e) => { text = e.target.value; } }),
          ),
          foot: (api) => h('button.btn.btn--primary.btn--block', {
            type: 'button',
            onclick: () => {
              if (text.trim()) { contra.push(text.trim()); drawContra(); }
              api.close();
            },
          }, 'Добавить'),
        });
      },
    }, icon('plus'), 'Добавить'));
  };
  drawContra();

  sheet({
    title: 'Карточка безопасности',
    body: h('.stack', null,
      field('ФИО полностью', 'fullName', 'Петров Иван Сергеевич'),
      h('.grid-2', null,
        field('Дата рождения', 'birth', '12.04.1991'),
        field('Группа крови', 'bloodType', 'A (II) Rh+'),
      ),
      field('Диагноз', 'diagnosis', ''),

      h('.field', null,
        h('label.field__label', null, 'Противопоказано'),
        contraWrap,
      ),

      h('.field', null,
        h('label.field__label', null, 'Важное предупреждение'),
        h('textarea.textarea', {
          oninput: (e) => { s.warning = e.target.value; },
        }, s.warning || SAFETY_DEFAULTS.warning),
        h('.field__hint', null,
          'Например: о повышенном риске менингококковой инфекции на терапии ингибитором комплемента.'),
      ),

      h('.grid-2', null,
        field('Гематолог', 'doctor', 'ФИО'),
        field('Телефон', 'doctorPhone', '+7 …'),
      ),
      h('.grid-2', null,
        field('Центр / отделение', 'center', ''),
        field('Телефон центра', 'centerPhone', '+7 …'),
      ),
    ),
    foot: (api) => h('button.btn.btn--primary.btn--block', {
      type: 'button',
      onclick: async () => {
        await store.saveSafety({ ...s, contraindications: contra });
        api.close();
        toast('Карточка обновлена', { icon: 'check' });
        ctx.rerender();
      },
    }, 'Сохранить'),
  });

  function field(label, key, placeholder) {
    return h('.field', null,
      h('label.field__label', null, label),
      h('input.input', {
        type: 'text', value: s[key] || '', placeholder,
        oninput: (e) => { s[key] = e.target.value; },
      }),
    );
  }
}
