/* ==========================================================================
   Питомец — спутник на главном экране.

   Зачем он здесь. Дневник хронического заболевания ведут годами, и
   каждый день он спрашивает примерно одно и то же. Небольшое живое
   присутствие делает возвращение чуть приятнее.

   Но приём намеренно тихий. Питомец ничего не требует, не считает
   пропуски, не грустит и не «умирает» без отметок — иначе дневник
   начал бы давить чувством вины, а это ровно то, чего в нём быть
   не должно. Он спит, пока день не отмечен, и радуется, когда
   отмечен. Больше ничего.

   Рисунки лежат в assets/pets картинками. Раньше звери были собраны
   инлайновым SVG прямо здесь; теперь это готовые иллюстрации одной
   серии, и рисовать их кодом больше незачем. Наружу приложение
   по-прежнему не ходит: файлы свои и попадают в офлайн-кэш.

   Медоед сюда не входит: он ведёт экскурсию и не предлагается
   пациенту как питомец.
   ========================================================================== */

import { h, sheet, tap } from './ui.js';
import * as store from './store.js';

/* ==========================================================================
   Звери
   ========================================================================== */

export const PETS = [
  { id: 'cat',      name: 'Кот' },
  { id: 'dog',      name: 'Пёс' },
  { id: 'hedgehog', name: 'Ёжик' },
];

export const PET_IDS = PETS.map((p) => p.id);

export function petById(id) {
  /* Раньше в наборе были лиса, птица и черепаха. У кого они выбраны,
     тот получит кота, а не пустое место на экране. */
  if (!id || id === 'none') return null;
  return PETS.find((p) => p.id === id) || PETS[0];
}

/* ==========================================================================
   Отрисовка
   ========================================================================== */

/**
 * Настроение питомца по записи дня.
 *   sleep — день не отмечен: питомец спит и ждёт, без упрёка
 *   happy — отмечен, самочувствие хорошее
 *   soft  — отмечен, день выдался трудный: питомец просто рядом
 *   calm  — отмечен, всё ровно
 */
export function petState(day) {
  if (!day || day.mood == null) return day && hasAny(day) ? 'calm' : 'sleep';
  if (day.mood >= 4) return 'happy';
  if (day.mood <= 2) return 'soft';
  return 'calm';
}

function hasAny(day) {
  return day.urine != null || day.temp != null
    || (day.symptoms && day.symptoms.length);
}

/**
 * Элемент с питомцем. Размер задаётся снаружи через CSS-переменную,
 * чтобы один и тот же рисунок годился и для уголка карточки, и для
 * крупной плитки выбора.
 */
/* Кадров у каждого зверя два: спит и доволен. Трудный день не делает
   питомца грустным — дневник не должен упрекать. */
function frameOf(state) {
  return state === 'sleep' ? 'sleep' : 'happy';
}

export function petNode(id, state = 'calm', { size, label, onclick } = {}) {
  const pet = petById(id);
  if (!pet) return null;

  const box = h((onclick ? 'button' : 'span') + '.pet.pet--' + state, {
    ...(onclick ? { type: 'button', onclick } : { 'aria-hidden': 'true' }),
    ...(onclick ? { 'aria-label': label || 'Выбрать питомца' } : {}),
  });
  /* размер — через переменную: один рисунок и для уголка, и для плитки */
  if (size) box.style.setProperty('--pet-size', size + 'px');

  box.appendChild(h('img.pet__art', {
    src: `assets/pets/${pet.id}-${frameOf(state)}.png`,
    alt: '', draggable: 'false', decoding: 'async',
  }));
  return box;
}

/* ==========================================================================
   Выбор питомца
   ========================================================================== */

/**
 * Лист выбора. Выбор сохраняется сразу, без кнопки «Сохранить»:
 * решение мелкое и легко отменяется, лишний шаг тут только мешает.
 */
export function openPetPicker() {
  const grid = h('.petpick');
  const api = sheet({ title: 'Кто будет рядом', body: grid });

  function draw() {
    const cur = store.state.settings.pet || 'none';
    grid.replaceChildren();

    for (const p of PETS) {
      const opt = h('button.petpick__opt' + (cur === p.id ? '.is-picked' : ''), {
        type: 'button',
        'aria-pressed': cur === p.id ? 'true' : 'false',
        onclick: () => choose(p.id),
      });
      opt.appendChild(petNode(p.id, cur === p.id ? 'happy' : 'calm'));
      opt.appendChild(h('span.petpick__name', null, p.name));
      grid.appendChild(opt);
    }

    grid.appendChild(h('button.petpick__opt.petpick__none'
      + (cur === 'none' ? '.is-picked' : ''), {
      type: 'button',
      'aria-pressed': cur === 'none' ? 'true' : 'false',
      onclick: () => choose('none'),
    }, h('span.petpick__name', null, 'Без питомца')));
  }

  async function choose(id) {
    tap();
    await store.saveSettings({ pet: id });
    draw();
    setTimeout(() => api.close(), 240);
  }

  draw();
  return api;
}
