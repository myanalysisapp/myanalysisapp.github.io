/* ==========================================================================
   Графики на чистом SVG. Без библиотек — значит без CDN и без лишних байт.
   Полоса референса и вертикальные метки инфузий.

   SVG рисуется в реальных пикселях контейнера (viewBox совпадает с размером),
   поэтому подписи осей не растягиваются и штрихи не искажаются.
   ========================================================================== */

import { h, svgEl, daysBetween, fmtDate, fmtDateShort } from './ui.js';
import { analyte, fmtNum } from './catalog.js';

let gradSeq = 0;

/* — Служебное ————————————————————————————————— */

function niceTicks(min, max, count = 3) {
  if (min === max) { min -= 1; max += 1; }
  const span = max - min;
  const raw = span / count;
  const mag = Math.pow(10, Math.floor(Math.log10(Math.abs(raw) || 1)));
  const norm = raw / mag;
  const step = (norm >= 7.5 ? 10 : norm >= 3.5 ? 5 : norm >= 1.5 ? 2 : 1) * mag;
  const start = Math.ceil(min / step) * step;
  const out = [];
  for (let v = start; v <= max + step * 0.001 && out.length < 12; v += step) {
    out.push(Number(v.toFixed(10)));
  }
  return out;
}

function pathD(pts) {
  return pts.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
}

/* ==========================================================================
   Большой график показателя
   ========================================================================== */

/**
 * lineChart({ key, data:[{date,value,flag,cycleDay}], threshold, infusions, height })
 * Возвращает контейнер; перерисовывается сам при изменении ширины.
 */
export function lineChart({
  key,
  data = [],
  threshold = null,   /* принимается ради совместимости вызовов, на графике не рисуется */
  infusions = [],
  height = 168,
  showAxis = true,
  from = null,
  to = null,
}) {
  const a = analyte(key);
  const wrap = h('div', { style: { position: 'relative', width: '100%' } });

  if (!data.length) {
    wrap.appendChild(h('div', {
      style: {
        height: height + 'px', display: 'grid', placeItems: 'center',
        color: 'var(--ink-3)', fontSize: 'var(--t-sm)', textAlign: 'center',
      },
    }, 'За этот период записей нет'));
    return wrap;
  }

  let lastW = 0;
  let drawn = false;

  function draw() {
    const raw = Math.round(wrap.clientWidth || 0);
    const W = Math.max(220, raw || 320);
    if (W === lastW && drawn) return;
    /* нулевую ширину не запоминаем: элемент ещё не разложен,
       и при следующем замере график надо перерисовать */
    lastW = raw ? W : 0;
    drawn = true;
    wrap.replaceChildren();

    const H = height;
    const padL = showAxis ? 52 : 6;
    const padR = 10;
    const padT = 12;
    const padB = showAxis ? 28 : 6;
    const iw = W - padL - padR;
    const ih = H - padT - padB;

    /* — домен по X: период задаётся снаружи, чтобы все графики
       и лента событий стояли на одной временной оси — */
    const d0 = from || data[0].date;
    const d1 = to || data[data.length - 1].date;
    const spanDays = Math.max(1, daysBetween(d0, d1));
    const x = (dateISO) => padL + (daysBetween(d0, dateISO) / spanDays) * iw;

    /* — домен по Y: данные и референс —
       Личный порог в домен не входит: линию его мы не рисуем, а
       растягивать из-за него шкалу означало бы приплюснуть сами
       данные ради невидимого ориентира. */
    const vals = data.map((d) => d.value);
    const rawMin = Math.min(...vals);
    let lo = rawMin;
    let hi = Math.max(...vals);
    if (a.ref) {
      if (a.ref[0] != null) lo = Math.min(lo, a.ref[0]);
      if (a.ref[1] != null) hi = Math.max(hi, a.ref[1]);
    }
    const pad = (hi - lo) * 0.16 || Math.abs(hi * 0.1) || 1;
    lo -= pad; hi += pad;
    if (lo < 0 && rawMin >= 0) lo = 0;
    const y = (v) => padT + ih - ((v - lo) / (hi - lo)) * ih;

    const uid = 'cg' + (++gradSeq);
    const svg = svgEl('svg', {
      class: 'chart-svg',
      viewBox: `0 0 ${W} ${H}`,
      width: W, height: H,
      role: 'img',
      'aria-label': `График: ${a.name}. Последнее значение ${fmtNum(vals[vals.length - 1], a.dec)} ${a.unit}`,
    });

    const defs = svgEl('defs');
    const grad = svgEl('linearGradient', { id: uid, x1: '0', y1: '0', x2: '0', y2: '1' });
    grad.appendChild(svgEl('stop', { offset: '0%',   'stop-color': 'var(--accent)', 'stop-opacity': '.18' }));
    grad.appendChild(svgEl('stop', { offset: '100%', 'stop-color': 'var(--accent)', 'stop-opacity': '0' }));
    defs.appendChild(grad);
    svg.appendChild(defs);

    /* — полоса референса — */
    if (a.ref) {
      const top = a.ref[1] != null ? y(a.ref[1]) : padT;
      const bot = a.ref[0] != null ? y(a.ref[0]) : padT + ih;
      const yy = Math.max(padT, Math.min(top, bot));
      const hh = Math.min(padT + ih, Math.max(top, bot)) - yy;
      if (hh > 0) {
        svg.appendChild(svgEl('rect', { class: 'c-band', x: padL, y: yy, width: iw, height: hh, rx: 3 }));
      }
    }

    /* — сетка и подписи оси Y — */
    if (showAxis) {
      for (const t of niceTicks(lo, hi, 3)) {
        const ty = y(t);
        if (ty < padT - 1 || ty > padT + ih + 1) continue;
        svg.appendChild(svgEl('line', { class: 'c-grid', x1: padL, y1: ty, x2: padL + iw, y2: ty }));
        const lbl = svgEl('text', { class: 'c-axis', x: padL - 8, y: ty + 5.5, 'text-anchor': 'end' });
        lbl.textContent = fmtNum(t, Number.isInteger(t) ? 0 : a.dec);
        svg.appendChild(lbl);
      }
    }

    /* — вертикальные метки инфузий — */
    for (const inf of infusions) {
      if (inf < d0 || inf > d1) continue;
      svg.appendChild(svgEl('line', {
        class: 'c-inf', x1: x(inf), y1: padT, x2: x(inf), y2: padT + ih,
      }));
    }

    /* — область и линия — */
    const pts = data.map((d) => ({ ...d, x: x(d.date), y: y(d.value) }));
    svg.appendChild(svgEl('path', {
      class: 'c-area',
      fill: `url(#${uid})`,
      d: pathD(pts) +
         ` L${pts[pts.length - 1].x.toFixed(1)} ${(padT + ih).toFixed(1)}` +
         ` L${pts[0].x.toFixed(1)} ${(padT + ih).toFixed(1)} Z`,
    }));

    const line = svgEl('path', { class: 'c-line c-draw', d: pathD(pts) });
    svg.appendChild(line);

    const r = pts.length > 30 ? 2.4 : 3.4;
    for (const p of pts) {
      const cls = p.flag === 'alert' ? 'c-dot c-dot--alert' : p.flag === 'warn' ? 'c-dot c-dot--warn' : 'c-dot';
      svg.appendChild(svgEl('circle', { class: cls, cx: p.x, cy: p.y, r }));
    }

    /* — подписи оси X — */
    if (showAxis) {
      const t0 = svgEl('text', { class: 'c-axis', x: padL, y: H - 7, 'text-anchor': 'start' });
      t0.textContent = fmtDateShort(d0);
      const t1 = svgEl('text', { class: 'c-axis', x: padL + iw, y: H - 7, 'text-anchor': 'end' });
      t1.textContent = fmtDateShort(d1);
      svg.appendChild(t0); svg.appendChild(t1);
    }

    /* — курсор и подсказка — */
    const cursor = svgEl('line', { class: 'c-cursor', x1: 0, y1: padT, x2: 0, y2: padT + ih, opacity: 0 });
    svg.appendChild(cursor);
    const hit = svgEl('rect', { x: 0, y: 0, width: W, height: H, fill: 'transparent' });
    svg.appendChild(hit);

    let tip = null;
    const hide = () => {
      cursor.setAttribute('opacity', 0);
      if (tip) { tip.remove(); tip = null; }
    };
    const show = (clientX) => {
      const box = svg.getBoundingClientRect();
      const scale = box.width / W || 1;
      const rel = (clientX - box.left) / scale;
      let best = pts[0], bd = Infinity;
      for (const p of pts) {
        const d = Math.abs(p.x - rel);
        if (d < bd) { bd = d; best = p; }
      }
      cursor.setAttribute('x1', best.x);
      cursor.setAttribute('x2', best.x);
      cursor.setAttribute('opacity', 1);

      if (!tip) { tip = h('.chart-tip'); wrap.appendChild(tip); }
      tip.replaceChildren(
        h('b', null, fmtNum(best.value, a.dec) + (a.unit ? ' ' + a.unit : '')),
        h('div', null, fmtDate(best.date) + (best.cycleDay ? ` · день ${best.cycleDay}` : '')),
      );
      tip.style.left = Math.round(best.x * scale) + 'px';
      tip.style.top = Math.round(best.y * scale - 10) + 'px';
    };

    hit.addEventListener('pointerdown', (e) => {
      show(e.clientX);
      try { hit.setPointerCapture(e.pointerId); } catch (_) { /* не критично */ }
    });
    hit.addEventListener('pointermove', (e) => {
      if (e.buttons || e.pointerType === 'mouse') show(e.clientX);
    });
    hit.addEventListener('pointerup', hide);
    hit.addEventListener('pointerleave', hide);
    hit.addEventListener('pointercancel', hide);

    wrap.appendChild(svg);

    /* длина линии — для анимации отрисовки; тоже с запасным таймером */
    const measure = () => {
      try {
        line.style.setProperty('--len', line.getTotalLength());
      } catch (_) {
        line.classList.remove('c-draw');
      }
    };
    requestAnimationFrame(measure);
    setTimeout(measure, 0);
  }

  /* Первая отрисовка. Кадры не идут, пока вкладка скрыта, поэтому
     на rAF полагаться нельзя — иначе график молча остаётся пустым.
     Дублируем таймером: сработает то, что успеет раньше. */
  requestAnimationFrame(draw);
  setTimeout(draw, 0);

  if (typeof ResizeObserver !== 'undefined') {
    const ro = new ResizeObserver(() => draw());
    ro.observe(wrap);
  } else {
    window.addEventListener('resize', draw);
  }

  return wrap;
}

/* ==========================================================================
   Спарклайн для мини-карточек
   ========================================================================== */

export function sparkline(values, { w = 80, hgt = 22, tone = 'var(--accent)' } = {}) {
  const svg = svgEl('svg', {
    class: 'metric__spark', viewBox: `0 0 ${w} ${hgt}`,
    preserveAspectRatio: 'none', 'aria-hidden': 'true',
  });
  if (!values || values.length < 2) return svg;

  const lo = Math.min(...values), hi = Math.max(...values);
  const span = hi - lo || 1;
  const pts = values.map((v, i) => ({
    x: (i / (values.length - 1)) * (w - 2) + 1,
    y: hgt - 2 - ((v - lo) / span) * (hgt - 4),
  }));

  svg.appendChild(svgEl('path', {
    d: pathD(pts), fill: 'none', stroke: tone, 'stroke-width': 1.6,
    'stroke-linecap': 'round', 'stroke-linejoin': 'round',
    'vector-effect': 'non-scaling-stroke', opacity: '.9',
  }));
  const last = pts[pts.length - 1];
  svg.appendChild(svgEl('circle', {
    cx: last.x, cy: last.y, r: 1.9, fill: tone,
    'vector-effect': 'non-scaling-stroke',
  }));
  return svg;
}

/* ==========================================================================
   Кольцо интервала между инфузиями — визитная карточка приложения
   ========================================================================== */

export function cycleRing({ progress = 0, interval = 14, animate = true }) {
  const SZ = 200, R = 84, C = 2 * Math.PI * R;
  const svg = svgEl('svg', { class: 'ring-svg', viewBox: `0 0 ${SZ} ${SZ}`, 'aria-hidden': 'true' });

  const defs = svgEl('defs');
  const gid = 'ringGrad' + (++gradSeq);
  const grad = svgEl('linearGradient', { id: gid, x1: '0', y1: '0', x2: '1', y2: '1' });
  grad.appendChild(svgEl('stop', { offset: '0%',   'stop-color': 'var(--accent-bright)' }));
  grad.appendChild(svgEl('stop', { offset: '100%', 'stop-color': 'var(--accent-deep)' }));
  defs.appendChild(grad);
  svg.appendChild(defs);

  svg.appendChild(svgEl('circle', { class: 'ring-track', cx: SZ / 2, cy: SZ / 2, r: R }));

  /* засечки по дням интервала: сразу видно, сколько дней осталось */
  const ticks = svgEl('g');
  const n = Math.min(interval, 31);
  for (let i = 0; i < n; i++) {
    const ang = (i / n) * Math.PI * 2;
    const r1 = R + 13, r2 = R + 17;
    ticks.appendChild(svgEl('line', {
      class: 'ring-tick',
      x1: SZ / 2 + Math.cos(ang) * r1, y1: SZ / 2 + Math.sin(ang) * r1,
      x2: SZ / 2 + Math.cos(ang) * r2, y2: SZ / 2 + Math.sin(ang) * r2,
      opacity: i / n <= progress ? 0.95 : 0.28,
    }));
  }
  svg.appendChild(ticks);

  const prog = svgEl('circle', {
    class: 'ring-prog', cx: SZ / 2, cy: SZ / 2, r: R,
    stroke: `url(#${gid})`,
    'stroke-dasharray': C,
    'stroke-dashoffset': animate ? C : C * (1 - progress),
  });
  svg.appendChild(prog);

  const ang = progress * Math.PI * 2;
  const dot = svgEl('circle', {
    class: 'ring-dot',
    cx: SZ / 2 + Math.cos(ang) * R, cy: SZ / 2 + Math.sin(ang) * R, r: 6,
    opacity: animate ? 0 : 1,
  });
  svg.appendChild(dot);

  if (animate) {
    /* Кадры не идут, пока вкладка скрыта, а кольцо до первого кадра
       нарисовано пустым. Дублируем таймером, как и линию графика:
       сработает то, что успеет раньше, второй вызов ничего не меняет. */
    const fill = () => {
      prog.setAttribute('stroke-dashoffset', C * (1 - progress));
      if (dot.getAttribute('opacity') !== '1') {
        dot.style.transition = 'opacity .4s .75s';
        dot.setAttribute('opacity', 1);
      }
    };
    requestAnimationFrame(fill);
    setTimeout(fill, 0);
  }
  return svg;
}

/* ==========================================================================
   Общая временная ось событий под графиками
   ========================================================================== */

export function eventRail({ events, from, to, onPick }) {
  const rail = h('.evt-rail', { style: { height: '40px' } });
  rail.appendChild(h('.evt-line'));
  const span = Math.max(1, daysBetween(from, to));

  const inRange = events.filter((e) => e.date >= from && e.date <= to);

  /* Значки, попадающие почти в одну точку, склеиваются в один кружок
     со счётчиком — иначе на длинном периоде они наезжают друг на друга. */
  const MIN_GAP = 8.5;   // в процентах ширины ленты ≈ диаметр значка
  const clusters = [];
  for (const e of inRange) {
    const pct = (daysBetween(from, e.date) / span) * 100;
    const last = clusters[clusters.length - 1];
    if (last && pct - last.pct < MIN_GAP) {
      last.items.push(e);
      last.pct = (last.pct * (last.items.length - 1) + pct) / last.items.length;
    } else {
      clusters.push({ pct, items: [e] });
    }
  }

  for (const c of clusters) {
    const tone = c.items.some((i) => i.tone === 'alert') ? '.evt-dot--alert'
      : c.items.some((i) => i.tone === 'warn') ? '.evt-dot--warn' : '';
    const label = c.items.length === 1
      ? `${c.items[0].name}, ${fmtDate(c.items[0].date)}`
      : `${c.items.length} событий: ${fmtDate(c.items[0].date)} — ${fmtDate(c.items[c.items.length - 1].date)}`;

    const dot = h('button.evt-dot' + tone, {
      type: 'button',
      title: label,
      'aria-label': label,
      style: { left: `clamp(14px, ${c.pct.toFixed(2)}%, calc(100% - 14px))` },
      onclick: () => onPick && onPick(c.items),
    }, c.items[0].icon);

    if (c.items.length > 1) dot.appendChild(h('span.evt-dot__n', null, String(c.items.length)));
    rail.appendChild(dot);
  }

  if (!clusters.length) {
    rail.appendChild(h('div', {
      style: {
        position: 'absolute', inset: 0, display: 'grid', placeItems: 'center',
        fontSize: 'var(--t-xs)', color: 'var(--ink-3)',
      },
    }, 'Событий за период нет'));
  }
  return rail;
}
