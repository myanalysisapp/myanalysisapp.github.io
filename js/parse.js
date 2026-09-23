/* ==========================================================================
   Разбор результата, вставленного текстом.

   Лаборатории присылают результаты письмом или PDF, откуда текст спокойно
   копируется. Это честнее и точнее распознавания фотографии: работает
   офлайн, не требует библиотек и не выдумывает цифры.

   Разбирается строка вида:
       Гемоглобин (HGB)    107    г/л    130 - 160
   Берём название по словарю синонимов, затем ПЕРВОЕ число после него —
   и, если рядом стоит знакомая единица, пересчитываем в каноничную.
   ========================================================================== */

import { ANALYTES, ALIASES, flatten, unitsFor, toBase, analyte } from './catalog.js';

/* — Индекс синонимов: «сплющенное» имя → ключ показателя ——————
   Длинные имена проверяем первыми, иначе «билирубин» перехватит
   «билирубин непрямой», а «нейтрофилы» — «нейтрофилы абс.». */

const INDEX = (() => {
  const rows = [];
  for (const [key, list] of Object.entries(ALIASES)) {
    for (const alias of list) rows.push({ key, alias: flatten(alias) });
  }
  for (const [key, a] of Object.entries(ANALYTES)) {
    rows.push({ key, alias: flatten(a.name) });
    if (a.short) rows.push({ key, alias: flatten(a.short) });
  }
  /* убираем дубли, сортируем по убыванию длины */
  const seen = new Set();
  return rows
    .filter((r) => r.alias.length >= 2 && !seen.has(r.alias) && seen.add(r.alias))
    .sort((a, b) => b.alias.length - a.alias.length);
})();

/* — Единицы: «сплющенная» запись → идентификатор ——————————— */

const UNIT_INDEX = (() => {
  const map = new Map();
  for (const key of Object.keys(ANALYTES)) {
    for (const u of unitsFor(key)) {
      const flat = flatten(u.id);
      if (flat) map.set(`${key}|${flat}`, u.id);
    }
  }
  return map;
})();

/* Короткие синонимы единиц, которые пишут в бланках. */
const UNIT_SYNONYMS = {
  'gl': 'г/л', 'gdl': 'г/дл',
  'ul': 'U/L', 'едл': 'Ед/л', 'мел': 'МЕ/л', 'iul': 'U/L',
  'мкмольл': 'мкмоль/л', 'ммольл': 'ммоль/л', 'мгдл': 'мг/дл',
  'нгмл': 'нг/мл', 'пгмл': 'пг/мл', 'мкгл': 'мкг/л', 'нгл': 'нг/л',
  'нмольл': 'нмоль/л', 'пмольл': 'пмоль/л',
  '109л': '×10⁹/л', '10e9л': '×10⁹/л', 'x109l': '×10⁹/л', '109l': '×10⁹/л',
  '1012л': '×10¹²/л', '10e12л': '×10¹²/л', 'x1012l': '×10¹²/л', '1012l': '×10¹²/л',
  'тысмкл': 'тыс/мкл', 'млнмкл': 'млн/мкл', 'клмкл': 'кл/мкл',
  'мэквл': 'мэкв/л', 'млмин': 'мл/мин', 'гсут': 'г/сут', 'мгсут': 'мг/сут',
};

/* ==========================================================================
   Разбор
   ========================================================================== */

/**
 * parseLabText(text) → {
 *   values: { [key]: { value, unit, raw, sure } },
 *   order:  [key, ...]        — в порядке появления в тексте
 *   date:   'ГГГГ-ММ-ДД' | null,
 *   lab:    строка | null,
 *   skipped: [строка, ...]    — что не разобрали
 * }
 */
export function parseLabText(text) {
  const out = { values: {}, order: [], date: null, lab: null, skipped: [] };
  if (!text || !text.trim()) return out;

  const lines = String(text)
    .replace(/\r/g, '')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

  for (const line of lines) {
    if (tryMeta(line, out)) continue;

    const hit = matchAnalyte(line);
    if (!hit) {
      if (/\d/.test(line)) out.skipped.push(line);
      continue;
    }

    const parsed = readValue(line.slice(hit.end), hit.key);
    if (parsed == null) { out.skipped.push(line); continue; }

    if (!(hit.key in out.values)) out.order.push(hit.key);
    out.values[hit.key] = parsed;
  }

  return out;
}

/** Ищем в начале строки самое длинное знакомое название. */
function matchAnalyte(line) {
  /* сравниваем по «сплющенной» строке, но помним, где кончается имя
     в исходной: для этого наращиваем префикс посимвольно */
  let flat = '';
  const map = [];                     // позиция в исходной строке для каждого символа flat
  for (let i = 0; i < line.length && flat.length <= 48; i++) {
    const ch = line[i].toLowerCase().replace('ё', 'е');
    if (/[a-zа-я0-9]/.test(ch)) { flat += ch; map.push(i + 1); }
  }
  if (!flat) return null;

  for (const row of INDEX) {
    if (flat.startsWith(row.alias)) {
      return { key: row.key, end: map[row.alias.length - 1] };
    }
  }
  return null;
}

/**
 * Из хвоста строки достаём число и, если получится, единицу.
 * Скобки сразу после названия пропускаем: «(HGB)», «(25-OH)» — часть имени,
 * а не результат.
 */
function readValue(tail, key) {
  let rest = tail;

  /* пропускаем скобочные пояснения и разделители перед значением */
  for (let guard = 0; guard < 4; guard++) {
    const m = /^[\s:;.\-—–|\t]*\(([^)]*)\)/.exec(rest);
    if (!m) break;
    rest = rest.slice(m[0].length);
  }
  rest = rest.replace(/^[\s:;.\-—–|\t]+/, '');

  const num = /(-?\d+(?:[.,]\d+)?)/.exec(rest);
  if (!num) return null;

  const value = Number(num[1].replace(',', '.'));
  if (!Number.isFinite(value)) return null;

  /* единица — сразу за числом */
  const after = rest.slice(num.index + num[1].length).replace(/^[\s|\t]+/, '');
  const unit = readUnit(after, key);

  const sure = plausible(key, unit ? toBase(key, value, unit) : value);
  return { value, unit: unit || unitsFor(key)[0].id, raw: num[1], sure };
}

function readUnit(after, key) {
  const token = /^([^\s|\t,;]{1,14})/.exec(after);
  if (!token) return null;
  const flat = flatten(token[1]);
  if (!flat) return null;

  const direct = UNIT_INDEX.get(`${key}|${flat}`);
  if (direct) return direct;

  const syn = UNIT_SYNONYMS[flat];
  if (syn && unitsFor(key).some((u) => u.id === syn)) return syn;
  return null;
}

/**
 * Правдоподобность: если значение далеко за пределами разумного,
 * скорее всего мы взяли число из колонки референса. Такое поле
 * подсветим как «проверьте» — но не выбросим.
 */
function plausible(key, base) {
  const a = analyte(key);
  if (base == null || !a.ref) return true;
  const [lo, hi] = a.ref;
  const low = lo != null ? lo : (hi != null ? hi / 10 : 0);
  const high = hi != null ? hi : (lo != null ? lo * 10 : Infinity);
  const span = Math.max(high - low, Math.abs(high) * 0.5, 1);
  return base >= low - span * 6 && base <= high + span * 12;
}

/* — Дата и лаборатория из шапки бланка ————————————— */

const LABS = ['инвитро', 'гемотест', 'ситилаб', 'хеликс', 'кдл', 'лабквест', 'склифосовского'];

function tryMeta(line, out) {
  if (!out.date) {
    const d = /(\d{1,2})[.\-/](\d{1,2})[.\-/](\d{2,4})/.exec(line);
    if (d) {
      const [, dd, mm, yy] = d;
      const year = yy.length === 2 ? 2000 + Number(yy) : Number(yy);
      const month = Number(mm), day = Number(dd);
      if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
        const p = (n) => String(n).padStart(2, '0');
        out.date = `${year}-${p(month)}-${p(day)}`;
        /* строка с датой может нести и значение — дальше её тоже разберём */
      }
    }
  }
  if (!out.lab) {
    const flat = flatten(line);
    const found = LABS.find((l) => flat.includes(l));
    if (found) {
      out.lab = line.length <= 60 ? line : found;
      return true;                       // строку с названием лаборатории дальше не разбираем
    }
  }
  return false;
}
