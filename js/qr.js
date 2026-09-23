/* ==========================================================================
   QR-код, модель 2. Собственная реализация: генерация полностью локальная,
   без обращения к внешним сервисам.

   Поддержано: байтовый режим (UTF-8), версии 1–40, уровни коррекции L/M/Q/H,
   автоподбор версии, выбор маски по штрафным баллам.
   ========================================================================== */

/* — Таблицы стандарта —————————————————————————— */

const ECC_LEVELS = { L: 0, M: 1, Q: 2, H: 3 };
/* биты уровня коррекции в блоке формата */
const ECC_FORMAT_BITS = { L: 1, M: 0, Q: 3, H: 2 };

const ECC_CODEWORDS_PER_BLOCK = {
  L: [-1, 7, 10, 15, 20, 26, 18, 20, 24, 30, 18, 20, 24, 26, 30, 22, 24, 28, 30, 28, 28, 28, 28, 30, 30, 26, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
  M: [-1, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26, 30, 22, 22, 24, 24, 28, 28, 26, 26, 26, 26, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28],
  Q: [-1, 13, 22, 18, 26, 18, 24, 18, 22, 20, 24, 28, 26, 24, 20, 30, 24, 28, 28, 26, 30, 28, 30, 30, 30, 30, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
  H: [-1, 17, 28, 22, 16, 22, 28, 26, 26, 24, 28, 24, 28, 22, 24, 24, 30, 28, 28, 26, 28, 30, 24, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
};

const NUM_EC_BLOCKS = {
  L: [-1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 4, 4, 4, 4, 4, 6, 6, 6, 6, 7, 8, 8, 9, 9, 10, 12, 12, 12, 13, 14, 15, 16, 17, 18, 19, 19, 20, 21, 22, 24, 25],
  M: [-1, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5, 5, 8, 9, 9, 10, 10, 11, 13, 14, 16, 17, 17, 18, 20, 21, 23, 25, 26, 28, 29, 31, 33, 35, 37, 38, 40, 43, 45, 47, 49],
  Q: [-1, 1, 1, 2, 2, 4, 4, 6, 6, 8, 8, 8, 10, 12, 16, 12, 17, 16, 18, 21, 20, 23, 23, 25, 27, 29, 34, 34, 35, 38, 40, 43, 45, 48, 51, 53, 56, 59, 62, 65, 68],
  H: [-1, 1, 1, 2, 4, 4, 4, 5, 6, 8, 8, 11, 11, 16, 16, 18, 16, 19, 21, 25, 25, 25, 34, 30, 32, 35, 37, 40, 42, 45, 48, 51, 54, 57, 60, 63, 66, 70, 74, 77, 81],
};

/* — Арифметика в поле Галуа GF(256), примитивный многочлен 0x11D ————— */

const GF_EXP = new Uint8Array(512);
const GF_LOG = new Uint8Array(256);
(function initGF() {
  let x = 1;
  for (let i = 0; i < 255; i++) {
    GF_EXP[i] = x;
    GF_LOG[x] = i;
    x <<= 1;
    if (x & 0x100) x ^= 0x11D;
  }
  for (let i = 255; i < 512; i++) GF_EXP[i] = GF_EXP[i - 255];
})();

function gfMul(a, b) {
  if (a === 0 || b === 0) return 0;
  return GF_EXP[GF_LOG[a] + GF_LOG[b]];
}

/** Порождающий многочлен Рида — Соломона степени degree. */
function rsGenerator(degree) {
  let poly = [1];
  for (let i = 0; i < degree; i++) {
    const next = new Array(poly.length + 1).fill(0);
    for (let j = 0; j < poly.length; j++) {
      next[j] ^= gfMul(poly[j], 1);           // умножение на x
      next[j + 1] ^= gfMul(poly[j], GF_EXP[i]);
    }
    poly = next;
  }
  return poly.slice(1); // старший коэффициент всегда 1, его не храним
}

function rsRemainder(data, gen) {
  const res = new Uint8Array(gen.length);
  for (const b of data) {
    const factor = b ^ res[0];
    res.copyWithin(0, 1);
    res[res.length - 1] = 0;
    for (let i = 0; i < gen.length; i++) res[i] ^= gfMul(gen[i], factor);
  }
  return res;
}

/* — Ёмкости —————————————————————————————————————— */

function numRawDataModules(ver) {
  let result = (16 * ver + 128) * ver + 64;
  if (ver >= 2) {
    const numAlign = Math.floor(ver / 7) + 2;
    result -= (25 * numAlign - 10) * numAlign - 55;
    if (ver >= 7) result -= 36;
  }
  return result;
}

function numDataCodewords(ver, ecl) {
  return Math.floor(numRawDataModules(ver) / 8)
    - ECC_CODEWORDS_PER_BLOCK[ecl][ver] * NUM_EC_BLOCKS[ecl][ver];
}

function alignPositions(ver) {
  if (ver === 1) return [];
  const numAlign = Math.floor(ver / 7) + 2;
  const step = ver === 32 ? 26 : Math.ceil((ver * 4 + 4) / (numAlign * 2 - 2)) * 2;
  const result = [6];
  for (let pos = ver * 4 + 10; result.length < numAlign; pos -= step) result.splice(1, 0, pos);
  return result;
}

/* — Кодирование данных ————————————————————————— */

function toUtf8(str) {
  return Array.from(new TextEncoder().encode(str));
}

function makeBitBuffer(bytes, ver, ecl) {
  const bits = [];
  const push = (value, len) => {
    for (let i = len - 1; i >= 0; i--) bits.push((value >>> i) & 1);
  };

  push(0b0100, 4);                                   // байтовый режим
  push(bytes.length, ver <= 9 ? 8 : 16);             // счётчик символов
  for (const b of bytes) push(b, 8);

  const capacityBits = numDataCodewords(ver, ecl) * 8;
  push(0, Math.min(4, capacityBits - bits.length));  // терминатор
  while (bits.length % 8 !== 0) bits.push(0);        // добивка до байта

  const out = [];
  for (let i = 0; i < bits.length; i += 8) {
    let b = 0;
    for (let j = 0; j < 8; j++) b = (b << 1) | bits[i + j];
    out.push(b);
  }
  /* заполнители 0xEC / 0x11 по стандарту */
  for (let pad = 0xEC; out.length < capacityBits / 8; pad ^= 0xEC ^ 0x11) out.push(pad);
  return out;
}

/** Разбивка на блоки, добавление кодов коррекции, чередование. */
function interleave(data, ver, ecl) {
  const numBlocks = NUM_EC_BLOCKS[ecl][ver];
  const ecLen = ECC_CODEWORDS_PER_BLOCK[ecl][ver];
  const rawCodewords = Math.floor(numRawDataModules(ver) / 8);
  const numShort = numBlocks - (rawCodewords % numBlocks);
  const shortLen = Math.floor(rawCodewords / numBlocks);

  const gen = rsGenerator(ecLen);
  const blocks = [];
  for (let i = 0, k = 0; i < numBlocks; i++) {
    const len = shortLen - ecLen + (i < numShort ? 0 : 1);
    const dat = data.slice(k, k + len);
    k += len;
    blocks.push({ dat, ec: rsRemainder(dat, gen) });
  }

  const result = [];
  const maxDat = shortLen - ecLen + 1;
  for (let i = 0; i < maxDat; i++) {
    for (let b = 0; b < numBlocks; b++) {
      if (i < blocks[b].dat.length) result.push(blocks[b].dat[i]);
    }
  }
  for (let i = 0; i < ecLen; i++) {
    for (let b = 0; b < numBlocks; b++) result.push(blocks[b].ec[i]);
  }
  return result;
}

/* — Построение матрицы ————————————————————————— */

function buildMatrix(codewords, ver, ecl) {
  const size = ver * 4 + 17;
  const grid = Array.from({ length: size }, () => new Int8Array(size).fill(-1)); // -1 = свободно

  const set = (x, y, v) => {
    if (x >= 0 && x < size && y >= 0 && y < size) grid[y][x] = v;
  };

  /* поисковые узоры + разделители */
  const finder = (cx, cy) => {
    for (let dy = -4; dy <= 4; dy++) {
      for (let dx = -4; dx <= 4; dx++) {
        const d = Math.max(Math.abs(dx), Math.abs(dy));
        const x = cx + dx, y = cy + dy;
        if (x < 0 || x >= size || y < 0 || y >= size) continue;
        set(x, y, d === 2 || d === 4 ? 0 : 1);
      }
    }
  };
  finder(3, 3); finder(size - 4, 3); finder(3, size - 4);

  /* синхрополосы */
  for (let i = 8; i < size - 8; i++) {
    const v = i % 2 === 0 ? 1 : 0;
    set(6, i, v); set(i, 6, v);
  }

  /* узоры выравнивания */
  const aligns = alignPositions(ver);
  for (let i = 0; i < aligns.length; i++) {
    for (let j = 0; j < aligns.length; j++) {
      const skip = (i === 0 && j === 0) ||
                   (i === 0 && j === aligns.length - 1) ||
                   (i === aligns.length - 1 && j === 0);
      if (skip) continue;
      for (let dy = -2; dy <= 2; dy++) {
        for (let dx = -2; dx <= 2; dx++) {
          const d = Math.max(Math.abs(dx), Math.abs(dy));
          set(aligns[j] + dx, aligns[i] + dy, d === 1 ? 0 : 1);
        }
      }
    }
  }

  /* резерв под формат и версию */
  const reserveFormat = () => {
    for (let i = 0; i < 9; i++) { if (grid[i][8] === -1) grid[i][8] = 0; if (grid[8][i] === -1) grid[8][i] = 0; }
    for (let i = 0; i < 8; i++) { grid[size - 1 - i][8] = 0; grid[8][size - 1 - i] = 0; }
    grid[size - 8][8] = 1; // «тёмный модуль» — всегда чёрный
  };
  const formatMask = Array.from({ length: size }, () => new Int8Array(size));
  const markFn = () => {
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) formatMask[y][x] = grid[y][x] !== -1 ? 1 : 0;
  };
  reserveFormat();
  if (ver >= 7) {
    for (let i = 0; i < 18; i++) {
      const a = size - 11 + (i % 3), b = Math.floor(i / 3);
      if (grid[b][a] === -1) grid[b][a] = 0;
      if (grid[a][b] === -1) grid[a][b] = 0;
    }
  }
  markFn(); // функциональные модули — их нельзя занимать данными и маскировать

  /* размещение данных «змейкой» снизу вверх, справа налево */
  let bitIndex = 0;
  const totalBits = codewords.length * 8;
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;  // столбец синхрополосы пропускаем
    for (let vert = 0; vert < size; vert++) {
      for (let j = 0; j < 2; j++) {
        const x = right - j;
        const upward = ((right + 1) & 2) === 0;
        const y = upward ? size - 1 - vert : vert;
        if (formatMask[y][x]) continue;
        let bit = 0;
        if (bitIndex < totalBits) {
          bit = (codewords[bitIndex >>> 3] >>> (7 - (bitIndex & 7))) & 1;
          bitIndex++;
        }
        grid[y][x] = bit;
      }
    }
  }

  return { grid, size, functional: formatMask };
}

/* — Маски ————————————————————————————————————— */

const MASKS = [
  (x, y) => (x + y) % 2 === 0,
  (x, y) => y % 2 === 0,
  (x, y) => x % 3 === 0,
  (x, y) => (x + y) % 3 === 0,
  (x, y) => (Math.floor(y / 2) + Math.floor(x / 3)) % 2 === 0,
  (x, y) => ((x * y) % 2) + ((x * y) % 3) === 0,
  (x, y) => (((x * y) % 2) + ((x * y) % 3)) % 2 === 0,
  (x, y) => (((x + y) % 2) + ((x * y) % 3)) % 2 === 0,
];

function applyMask(grid, functional, size, maskIdx) {
  const fn = MASKS[maskIdx];
  const out = grid.map((row) => Int8Array.from(row));
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (!functional[y][x] && fn(x, y)) out[y][x] ^= 1;
    }
  }
  return out;
}

function drawFormat(grid, size, ecl, maskIdx) {
  const data = (ECC_FORMAT_BITS[ecl] << 3) | maskIdx;
  let rem = data;
  for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
  const bits = ((data << 10) | rem) ^ 0x5412;

  const get = (i) => (bits >>> i) & 1;
  for (let i = 0; i <= 5; i++) grid[i][8] = get(i);
  grid[7][8] = get(6);
  grid[8][8] = get(7);
  grid[8][7] = get(8);
  for (let i = 9; i < 15; i++) grid[8][14 - i] = get(i);

  for (let i = 0; i < 8; i++) grid[8][size - 1 - i] = get(i);
  for (let i = 8; i < 15; i++) grid[size - 15 + i][8] = get(i);
  grid[size - 8][8] = 1;
}

function drawVersion(grid, size, ver) {
  if (ver < 7) return;
  let rem = ver;
  for (let i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >>> 11) * 0x1F25);
  const bits = (ver << 12) | rem;
  for (let i = 0; i < 18; i++) {
    const bit = (bits >>> i) & 1;
    const a = size - 11 + (i % 3), b = Math.floor(i / 3);
    grid[b][a] = bit;
    grid[a][b] = bit;
  }
}

/* — Штрафные баллы (выбор лучшей маски) ————————— */

function penalty(grid, size) {
  let score = 0;

  /* N1: серии одинаковых модулей длиной 5+ */
  const runScore = (run) => (run >= 5 ? 3 + (run - 5) : 0);
  for (let y = 0; y < size; y++) {
    let run = 1;
    for (let x = 1; x < size; x++) {
      if (grid[y][x] === grid[y][x - 1]) run++;
      else { score += runScore(run); run = 1; }
    }
    score += runScore(run);
  }
  for (let x = 0; x < size; x++) {
    let run = 1;
    for (let y = 1; y < size; y++) {
      if (grid[y][x] === grid[y - 1][x]) run++;
      else { score += runScore(run); run = 1; }
    }
    score += runScore(run);
  }

  /* N2: блоки 2×2 одного цвета */
  for (let y = 0; y < size - 1; y++) {
    for (let x = 0; x < size - 1; x++) {
      const c = grid[y][x];
      if (c === grid[y][x + 1] && c === grid[y + 1][x] && c === grid[y + 1][x + 1]) score += 3;
    }
  }

  /* N3: узор, похожий на поисковый (1:1:3:1:1 с полем) */
  const PAT1 = [1, 0, 1, 1, 1, 0, 1, 0, 0, 0, 0];
  const PAT2 = [0, 0, 0, 0, 1, 0, 1, 1, 1, 0, 1];
  const matches = (get, i) => {
    let ok1 = true, ok2 = true;
    for (let k = 0; k < 11; k++) {
      const v = get(i + k);
      if (v !== PAT1[k]) ok1 = false;
      if (v !== PAT2[k]) ok2 = false;
    }
    return ok1 || ok2;
  };
  for (let y = 0; y < size; y++) {
    for (let x = 0; x <= size - 11; x++) if (matches((i) => grid[y][i], x)) score += 40;
  }
  for (let x = 0; x < size; x++) {
    for (let y = 0; y <= size - 11; y++) if (matches((i) => grid[i][x], y)) score += 40;
  }

  /* N4: отклонение доли тёмных модулей от 50 % */
  let dark = 0;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) dark += grid[y][x];
  const ratio = (dark * 100) / (size * size);
  score += Math.floor(Math.abs(ratio - 50) / 5) * 10;

  return score;
}

/* — Публичный интерфейс ————————————————————————— */

/**
 * Возвращает { size, modules: boolean[][] }.
 * @param {string} text
 * @param {{ecl?: 'L'|'M'|'Q'|'H', minVersion?: number}} opts
 */
export function encode(text, { ecl = 'M', minVersion = 1 } = {}) {
  if (!(ecl in ECC_LEVELS)) ecl = 'M';
  const bytes = toUtf8(String(text));

  let ver = minVersion;
  for (; ver <= 40; ver++) {
    const capacity = numDataCodewords(ver, ecl);
    const needed = 4 + (ver <= 9 ? 8 : 16) + bytes.length * 8;
    if (needed <= capacity * 8) break;
  }
  if (ver > 40) throw new Error('Текст слишком длинный для QR-кода');

  const data = makeBitBuffer(bytes, ver, ecl);
  const codewords = interleave(data, ver, ecl);
  const { grid, size, functional } = buildMatrix(codewords, ver, ecl);

  let best = null;
  for (let m = 0; m < 8; m++) {
    const g = applyMask(grid, functional, size, m);
    drawFormat(g, size, ecl, m);
    drawVersion(g, size, ver);
    const p = penalty(g, size);
    if (!best || p < best.p) best = { g, p, m };
  }

  return {
    size,
    version: ver,
    modules: best.g.map((row) => Array.from(row, (v) => v === 1)),
  };
}

/**
 * SVG-элемент с QR-кодом. Векторный — печатается чётко в любом размере.
 */
export function qrSvg(text, { ecl = 'M', quiet = 3, px = 148, dark = '#111', light = '#fff' } = {}) {
  const { size, modules } = encode(text, { ecl });
  const total = size + quiet * 2;
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', `0 0 ${total} ${total}`);
  svg.setAttribute('width', px);
  svg.setAttribute('height', px);
  svg.setAttribute('shape-rendering', 'crispEdges');
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', 'QR-код с карточкой безопасности');

  const bg = document.createElementNS(ns, 'rect');
  bg.setAttribute('width', total);
  bg.setAttribute('height', total);
  bg.setAttribute('fill', light);
  svg.appendChild(bg);

  /* один path на весь код — меньше узлов, быстрее печать */
  let d = '';
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (modules[y][x]) d += `M${x + quiet} ${y + quiet}h1v1h-1z`;
    }
  }
  const path = document.createElementNS(ns, 'path');
  path.setAttribute('d', d);
  path.setAttribute('fill', dark);
  svg.appendChild(path);
  return svg;
}
