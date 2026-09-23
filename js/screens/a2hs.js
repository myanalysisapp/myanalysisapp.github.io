/* ==========================================================================
   «Установите на экран Домой» — пошаговая подсказка для iPhone
   и обычная установка для Android.
   ========================================================================== */

import { h, icon, sheet, toast } from '../ui.js';
import * as store from '../store.js';

let deferredPrompt = null;

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
});

export function isStandalone() {
  return window.matchMedia('(display-mode: standalone)').matches ||
         window.navigator.standalone === true;
}

export function isIOS() {
  const ua = navigator.userAgent;
  return /iPad|iPhone|iPod/.test(ua) ||
         (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

export function shouldOfferA2HS() {
  if (isStandalone()) return false;
  if (store.state.settings && store.state.settings.a2hsDismissed) return false;
  return isIOS() || !!deferredPrompt;
}

export function openA2HS() {
  const ios = isIOS();

  sheet({
    title: 'На экран «Домой»',
    body: h('.stack', null,
      h('p.card__sub', { style: { marginTop: 0 } },
        ios
          ? 'Приложение откроется во весь экран, без адресной строки, и будет работать без интернета.'
          : 'Приложение установится как обычное и будет работать без интернета.'),

      ios ? frag_steps() : h('.stack', null,
        h('button.btn.btn--primary.btn--block', {
          type: 'button',
          onclick: async () => {
            if (!deferredPrompt) { toast('Откройте меню браузера → «Установить приложение»', { icon: 'info' }); return; }
            deferredPrompt.prompt();
            const res = await deferredPrompt.userChoice;
            deferredPrompt = null;
            if (res && res.outcome === 'accepted') toast('Устанавливаем…', { icon: 'check' });
          },
        }, icon('download'), 'Установить'),
        h('.field__hint', null,
          'Если кнопка не сработала — откройте меню браузера (⋮) и выберите «Установить приложение».'),
      ),
    ),
    foot: (api) => h('button.btn.btn--ghost.btn--block', {
      type: 'button',
      onclick: async () => {
        await store.saveSettings({ a2hsDismissed: true });
        api.close();
      },
    }, 'Больше не показывать'),
  });
}

/* — Пошаговая картинка для iOS ————————————————— */

function frag_steps() {
  const wrap = h('.stack.stack--sm');

  wrap.appendChild(step(1,
    shareGlyph(),
    'Нажмите «Поделиться»',
    'Значок внизу экрана Safari — квадрат со стрелкой вверх.'));

  wrap.appendChild(step(2,
    plusGlyph(),
    'Выберите «На экран „Домой“»',
    'Пункт в списке действий, может понадобиться пролистать.'));

  wrap.appendChild(step(3,
    checkGlyph(),
    'Нажмите «Добавить»',
    'Значок «Мой Анализ» появится рядом с другими приложениями.'));

  wrap.appendChild(h('.card.card--flat.card--tight', { style: { marginTop: 'var(--sp-3)' } },
    h('.card__sub', null,
      'Подсказка работает в Safari. Если открыто в другом браузере — сначала откройте адрес в Safari.'),
  ));

  return wrap;
}

function step(n, glyph, title, text) {
  return h('.row.row--top', { style: { gap: 'var(--sp-3)', padding: '10px 0' } },
    h('.a2hs-n', null, String(n)),
    h('.a2hs-ico', null, glyph),
    h('div', { style: { flex: 1 } },
      h('.list__t', null, title),
      h('.list__s', null, text),
    ),
  );
}

const NS = 'http://www.w3.org/2000/svg';
function glyph(inner) {
  const s = document.createElementNS(NS, 'svg');
  s.setAttribute('viewBox', '0 0 24 24');
  s.setAttribute('fill', 'none');
  s.setAttribute('stroke', 'currentColor');
  s.setAttribute('stroke-width', '1.8');
  s.setAttribute('stroke-linecap', 'round');
  s.setAttribute('stroke-linejoin', 'round');
  s.innerHTML = inner;
  return s;
}

const shareGlyph = () => glyph('<path d="M12 15V3m0 0L8.5 6.5M12 3l3.5 3.5"/><path d="M6 11H5a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-8a1 1 0 0 0-1-1h-1"/>');
const plusGlyph  = () => glyph('<rect x="4" y="4" width="16" height="16" rx="4"/><path d="M12 9v6M9 12h6"/>');
const checkGlyph = () => glyph('<rect x="4" y="4" width="16" height="16" rx="4"/><path d="M8.5 12.2l2.6 2.6 4.6-5"/>');
