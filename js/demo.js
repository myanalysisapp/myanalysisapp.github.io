/* ==========================================================================
   Демо-данные. Пациент вымышленный, совпадения случайны.

   Сценарий: ПНГ, экулизумаб 900 мг каждые 14 дней, полгода истории,
   эпизод прорывного гемолиза ~2,5 месяца назад с переливанием
   и последующим восстановлением.
   ========================================================================== */

import { today, addDays, iso } from './ui.js';
import { HOSP_CHECKLIST, SCHEDULE, DEFAULT_THRESHOLDS, SAFETY_DEFAULTS } from './catalog.js';
import * as store from './store.js';
import { uid } from './db.js';

/* — Детерминированный генератор: демо выглядит одинаково при каждом запуске — */
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rnd = rng(20260918);
const jitter = (amp) => (rnd() - 0.5) * 2 * amp;
const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
const D = (offset) => addDays(today(), offset);

/** Кусочно-линейная интерполяция по опорным точкам [[offset, value], ...] */
function curve(points, x) {
  if (x <= points[0][0]) return points[0][1];
  const last = points[points.length - 1];
  if (x >= last[0]) return last[1];
  for (let i = 1; i < points.length; i++) {
    const [x0, y0] = points[i - 1];
    const [x1, y1] = points[i];
    if (x <= x1) {
      const t = (x - x0) / (x1 - x0 || 1);
      return y0 + (y1 - y0) * t;
    }
  }
  return last[1];
}

/* ==========================================================================
   Хронология эпизода (смещения в днях от сегодня, отрицательные — прошлое)
   ========================================================================== */

const T = {
  stressFrom:   -80,   // 10 дней недосыпа, переработки и стресса
  stressTo:     -71,
  fever:        -70,   // 38,1 один день
  urticariaFrom:-69,
  urticariaTo:  -68,
  hospFrom:     -56,   // короткая госпитализация
  hospTo:       -50,
  transfusion:  -54,
  discharge:    -50,   // смена дозы циклоспорина при выписке
  coldFrom:     -26,   // простуда 37,4 без последствий
  coldTo:       -23,
  lastInfusion: -8,    // сегодня 9-й день интервала из 14
};

/* — Опорные кривые показателей —————————————————— */

const CURVES = {
  hb: [
    [-190, 106], [-120, 110], [-80, 111], [-72, 110], [-66, 98], [-60, 84],
    [-55, 72], [-54.4, 96], [-46, 99], [-38, 103], [-24, 107], [0, 110],
  ],
  ldh: [
    [-190, 268], [-90, 255], [-72, 300], [-68, 780], [-62, 1460], [-58, 1180],
    [-55, 720], [-50, 520], [-44, 395], [-36, 305], [-24, 272], [0, 258],
  ],
  bil_t: [
    [-190, 23], [-80, 22], [-70, 30], [-62, 58], [-56, 44], [-50, 33],
    [-42, 27], [-30, 24], [0, 22],
  ],
  retic: [
    [-190, 92], [-80, 95], [-70, 118], [-62, 176], [-54, 198], [-46, 150],
    [-36, 118], [-24, 100], [0, 94],
  ],
  plt: [
    [-190, 196], [-80, 192], [-62, 158], [-54, 149], [-44, 172], [-30, 188], [0, 195],
  ],
  creat: [
    [-190, 86], [-70, 88], [-60, 104], [-54, 99], [-44, 92], [0, 88],
  ],
};

function labValues(offset) {
  const hb    = curve(CURVES.hb, offset)    + jitter(2.4);
  const ldh   = curve(CURVES.ldh, offset)   * (1 + jitter(0.05));
  const bilT  = curve(CURVES.bil_t, offset) + jitter(1.6);
  const bilD  = Math.max(1.8, bilT * 0.17 + jitter(0.5));
  const retic = curve(CURVES.retic, offset) + jitter(6);
  const plt   = curve(CURVES.plt, offset)   + jitter(11);
  const creat = curve(CURVES.creat, offset) + jitter(3);

  return {
    hb:    Math.round(hb),
    rbc:   Number((hb / 30.5 + jitter(0.08)).toFixed(2)),
    plt:   Math.round(plt),
    wbc:   Number((5.6 + jitter(0.9)).toFixed(1)),
    anc:   Number((2.95 + jitter(0.55)).toFixed(2)),
    retic: Number(retic.toFixed(1)),
    ldh:   Math.round(ldh),
    bil_t: Number(bilT.toFixed(1)),
    bil_d: Number(bilD.toFixed(1)),
    bil_i: Number(Math.max(1, bilT - bilD).toFixed(1)),
    creat: Math.round(creat),
    urea:  Number((5.2 + jitter(0.9)).toFixed(1)),
    uric:  Math.round(330 + jitter(45)),
    alt:   Math.round(28 + jitter(9)),
    ast:   Math.round(30 + jitter(10)),
    ggt:   Math.round(38 + jitter(12)),
    alp:   Math.round(88 + jitter(16)),
    glu:   Number((5.1 + jitter(0.5)).toFixed(1)),
    alb:   Math.round(42 + jitter(3)),
    tp:    Math.round(72 + jitter(4)),
    k:     Number((4.3 + jitter(0.3)).toFixed(2)),
    na:    Math.round(140 + jitter(2.5)),
    mg:    Number((0.78 + jitter(0.08)).toFixed(2)),
  };
}

const OAK_KEYS = ['hb', 'rbc', 'plt', 'wbc', 'anc', 'retic'];
const BIO_KEYS = ['ldh', 'bil_t', 'bil_d', 'bil_i', 'creat', 'urea', 'uric',
                  'alt', 'ast', 'ggt', 'alp', 'glu', 'alb', 'tp', 'k', 'na', 'mg'];

function subset(all, keys) {
  const out = {};
  for (const k of keys) if (all[k] != null) out[k] = all[k];
  return out;
}

const LABS_NAMES = ['Гемотест', 'Инвитро', 'КДЛ гематологического центра', 'Лаборатория стационара'];

/* ==========================================================================
   Сборка набора
   ========================================================================== */

export async function loadDemo() {
  await store.wipe();

  /* — Профиль —————————————————————————————————— */
  await store.saveProfile({
    name: 'Иван',
    disease: 'png',
    diseaseName: 'Пароксизмальная ночная гемоглобинурия (ПНГ)',
    birthYear: new Date().getFullYear() - 34,
    drug: 'Экулизумаб',
    dose: '900 мг',
    interval: 14,
    lastInfusion: D(T.lastInfusion),
    onboarded: true,
    demo: true,
  });

  await store.saveThresholds(structuredClone(DEFAULT_THRESHOLDS));
  await store.saveSchedule(structuredClone(SCHEDULE).map((s) => ({
    ...s,
    stable: s.id === 'sch_csa' ? false : s.stable,
  })));

  await store.saveSafety({
    fullName: 'Петров Иван Сергеевич',
    birth: `12.04.${new Date().getFullYear() - 34}`,
    diagnosis: 'Пароксизмальная ночная гемоглобинурия (ПНГ)',
    bloodType: 'A (II) Rh+',
    contraindications: [...SAFETY_DEFAULTS.contraindications],
    warning: SAFETY_DEFAULTS.warning,
    doctor: 'Смирнова Анна Павловна, гематолог',
    doctorPhone: '+7 900 000-00-01',
    center: 'Городской гематологический центр, отделение № 3',
    centerPhone: '+7 900 000-00-02',
  });

  /* — Инфузии: полгода назад и три запланированные вперёд ——— */
  const infusions = [];
  for (let k = 12; k >= 0; k--) {
    const date = D(T.lastInfusion - 14 * k);
    /* во время госпитализации инфузия шла в стационаре */
    const off = T.lastInfusion - 14 * k;
    const place = off >= T.hospFrom && off <= T.hospTo ? 'Стационар, отделение № 3' : 'Дневной стационар';
    infusions.push({
      id: uid('inf'), date, done: true, place,
      drug: 'Экулизумаб', dose: '900 мг',
      note: off === T.lastInfusion ? '' : '',
    });
  }
  for (let k = 1; k <= 3; k++) {
    infusions.push({
      id: uid('inf'), date: D(T.lastInfusion + 14 * k), done: false,
      place: 'Дневной стационар', drug: 'Экулизумаб', dose: '900 мг',
    });
  }
  await store.replaceAll('infusions', infusions);

  /* — Анализы —————————————————————————————————— */
  const labs = [];
  const addLab = (offset, panels, opts = {}) => {
    const all = labValues(offset);
    let values = {};
    if (panels.includes('oak')) Object.assign(values, subset(all, OAK_KEYS));
    if (panels.includes('bio')) Object.assign(values, subset(all, BIO_KEYS));
    if (opts.values) Object.assign(values, opts.values);
    labs.push({
      id: uid('lab'),
      date: D(offset),
      time: opts.time || (rnd() < 0.6 ? '08:20' : '09:05'),
      panels,
      lab: opts.lab || pick(LABS_NAMES),
      beforeInfusion: !!opts.beforeInfusion,
      /* Норма ЛДГ у каждой лаборатории своя: реактивы разные, и верхняя
         граница гуляет. Демо показывает, как она хранится рядом с
         результатом и по ней же оценивается. */
      refs: { ldh: [120, 450] },
      note: opts.note || '',
      values,
      files: [],
    });
  };

  /* плановые сдачи — за день до каждой инфузии */
  for (let k = 12; k >= 0; k--) {
    const off = T.lastInfusion - 14 * k - 1;
    if (off < -190) continue;
    /* пара пропусков — заполнение правдоподобно неидеальное */
    if (k === 7 || k === 11) continue;
    addLab(off, ['oak', 'bio'], {
      beforeInfusion: true,
      lab: 'КДЛ гематологического центра',
      note: 'До введения экулизумаба',
    });
  }

  /* частые сдачи во время эпизода */
  for (const off of [-70, -66, -62, -58, -55, -53, -48, -44]) {
    addLab(off, ['oak', 'bio'], {
      lab: off >= T.hospFrom && off <= T.hospTo ? 'Лаборатория стационара' : 'Гемотест',
      note: off === -53 ? 'После переливания эритроцитной взвеси' : '',
    });
  }

  /* циклоспорин — раз в неделю, до утренней дозы */
  for (let off = -84; off <= -1; off += 7) {
    const base = off > T.discharge ? 178 : 232;   // после снижения дозы уровень ниже
    labs.push({
      id: uid('lab'), date: D(off), time: '07:40',
      panels: ['csa'], lab: 'КДЛ гематологического центра',
      beforeInfusion: false, note: 'До утренней дозы',
      values: { csa: Math.round(base + jitter(34)) },
      files: [],
    });
  }

  /* витамины и почки — редкие наборы */
  labs.push({
    id: uid('lab'), date: D(-96), time: '08:30', panels: ['vit'],
    lab: 'Инвитро', beforeInfusion: false, note: '',
    values: { b12: 312, folate: 6.4, vitd: 21.5, ferritin: 48 }, files: [],
  });
  labs.push({
    id: uid('lab'), date: D(-12), time: '08:30', panels: ['vit'],
    lab: 'Инвитро', beforeInfusion: false, note: '',
    values: { b12: 604, folate: 11.2, vitd: 28.4, ferritin: 61 }, files: [],
  });
  labs.push({
    id: uid('lab'), date: D(-58), time: '09:10', panels: ['kid'],
    lab: 'Лаборатория стационара', beforeInfusion: false, note: 'На фоне эпизода',
    values: { creat: 104, urea: 7.8, gfr: 74, prot24: 0.24, alburia: 46, urine_pro: 0.22, urine_ph: 5.5, urine_hb: '++' },
    files: [],
  });
  labs.push({
    id: uid('lab'), date: D(-19), time: '08:45', panels: ['cardio'],
    lab: 'Инвитро', beforeInfusion: false, note: '',
    values: { probnp: 96 }, files: [],
  });

  await store.replaceAll('labs', labs);

  /* — Лекарства ————————————————————————————————— */
  const meds = [
    {
      id: 'med_csa', name: 'Циклоспорин', dose: '50 мг', form: 'капсулы',
      freq: 'daily', times: ['09:00', '21:00'], perDose: '50 мг',
      note: 'Интервал 12 часов, много жидкости. Кровь на концентрацию — до утренней дозы.',
      startDate: D(T.discharge), endDate: null, needsRx: true, archived: false,
    },
    {
      id: 'med_folate', name: 'Фолиевая кислота', dose: '5 мг', form: 'таблетки',
      freq: 'daily', times: ['09:00'], perDose: '5 мг',
      note: 'Постоянно, утром', startDate: D(-190), endDate: null, needsRx: false, archived: false,
    },
    {
      id: 'med_allo', name: 'Аллопуринол', dose: '100 мг', form: 'таблетки',
      freq: 'daily', times: ['20:00'], perDose: '100 мг',
      note: 'Под контролем мочевой кислоты', startDate: D(-150), endDate: null, needsRx: true, archived: false,
    },
    {
      id: 'med_b12', name: 'Витамин B12', dose: '500 мкг', form: 'курс, инъекции',
      freq: 'daily', times: ['10:00'], perDose: '500 мкг',
      note: 'Курс 2 месяца', startDate: D(-58), endDate: D(3), needsRx: false, archived: false, course: true,
    },
    {
      id: 'med_mg', name: 'Магния оротат', dose: '500 мг', form: 'курс, таблетки',
      freq: 'daily', times: ['09:00', '21:00'], perDose: '500 мг',
      note: 'Курсами, под контролем уровня магния', startDate: D(-30), endDate: D(30), needsRx: false, archived: false, course: true,
    },
  ];
  await store.replaceAll('meds', meds);

  await store.replaceAll('medHistory', [
    {
      id: uid('mh'), medId: 'med_csa', date: D(T.discharge),
      from: '100 мг × 2 раза в день', to: '50 мг × 2 раза в день',
      reason: 'Выписка из стационара',
    },
    {
      id: uid('mh'), medId: 'med_b12', date: D(-58),
      from: '—', to: '500 мкг, курс 2 месяца', reason: 'Назначен гематологом',
    },
    {
      id: uid('mh'), medId: 'med_mg', date: D(-30),
      from: '—', to: '500 мг × 2 раза в день, курс', reason: 'Снижение магния на фоне циклоспорина',
    },
  ]);

  /* отметки приёма за последние 3 недели, с пропусками */
  const medLog = [];
  for (let off = -21; off <= 0; off++) {
    const date = D(off);
    for (const m of meds) {
      if (m.startDate > date || (m.endDate && m.endDate < date)) continue;
      for (const t of m.times) {
        if (off === 0 && t >= '20:00') continue;              // вечер ещё не наступил
        if (rnd() < 0.12) continue;                            // пропущенные отметки
        medLog.push({ id: uid('mlog'), medId: m.id, date, time: t, status: 'taken' });
      }
    }
  }
  await store.replaceAll('medLog', medLog);

  /* — Самочувствие по дням ———————————————————————— */
  const daily = [];
  for (let off = -180; off <= 0; off++) {
    const inStress = off >= T.stressFrom && off <= T.stressTo;
    const inEpisode = off >= -71 && off <= -46;
    const inCold = off >= T.coldFrom && off <= T.coldTo;

    /* заполнение неидеальное: чем дальше, тем больше пропусков */
    const skipChance = off < -120 ? 0.45 : off < -90 ? 0.3 : inEpisode ? 0.05 : 0.16;
    if (rnd() < skipChance) continue;

    const rec = { id: D(off), date: D(off) };

    if (inEpisode) rec.mood = off > -52 ? 3 : off > -58 ? 2 : 1;
    else if (inStress) rec.mood = 3;
    else if (inCold) rec.mood = 3;
    else rec.mood = rnd() < 0.62 ? 4 : rnd() < 0.6 ? 5 : 3;

    /* цвет мочи — важный наглядный маркер при ПНГ */
    if (rnd() > 0.14) {
      if (inEpisode) rec.urine = off > -50 ? 3 : off > -56 ? 4 : off > -66 ? 6 : 5;
      else if (inStress) rec.urine = 3;
      else rec.urine = rnd() < 0.55 ? 2 : rnd() < 0.6 ? 3 : 1;
    }

    const symptoms = [];
    if (inStress && rnd() < 0.7) symptoms.push('weakness');
    if (inEpisode) {
      symptoms.push('weakness');
      if (off > -68 && rnd() < 0.7) symptoms.push('dyspnea');
      if (off >= T.urticariaFrom && off <= T.urticariaTo) symptoms.push('urticaria');
      if (off > -70 && off < -52 && rnd() < 0.6) symptoms.push('darkurine');
    }
    if (inCold) symptoms.push('cold');
    if (symptoms.length) rec.symptoms = [...new Set(symptoms)];

    if (off === T.fever) rec.temp = 38.1;
    else if (off === T.fever + 1) rec.temp = 37.3;
    else if (inCold && off <= T.coldFrom + 1) rec.temp = 37.4;
    else if (inEpisode && rnd() < 0.25) rec.temp = Number((36.8 + rnd() * 0.5).toFixed(1));
    else if (rnd() < 0.12) rec.temp = Number((36.4 + rnd() * 0.4).toFixed(1));

    /* вечерний мини-опрос — заполняется не каждый день */
    if (rnd() < (inStress ? 0.8 : 0.35)) {
      rec.sleep  = inStress ? 1 + Math.floor(rnd() * 2) : inEpisode ? 2 + Math.floor(rnd() * 2) : 3 + Math.floor(rnd() * 2);
      rec.load   = inStress ? 4 + Math.floor(rnd() * 2) : 2 + Math.floor(rnd() * 2);
      rec.stress = inStress ? 4 + Math.floor(rnd() * 2) : inEpisode ? 3 : 2;
    }
    daily.push(rec);
  }
  await store.replaceAll('daily', daily);

  /* — События на временной оси ——————————————————— */
  const events = [];
  const addEvent = (offset, type, note = '') => events.push({ id: uid('ev'), date: D(offset), type, note });

  /* десять дней подряд: так на временной оси видно сплошную полосу,
     а в отчёте события склеиваются в «Недосып (10 дн.)» */
  for (let off = T.stressFrom; off <= T.stressTo; off++) {
    addEvent(off, 'nosleep', off === T.stressFrom ? 'Сон 4–5 часов десять дней подряд' : '');
    if (off <= T.stressFrom + 6) addEvent(off, 'overwork', off === T.stressFrom ? 'Переработки, дедлайн' : '');
    if (off >= T.stressFrom + 3) addEvent(off, 'stress', '');
  }
  addEvent(T.fever, 'fever', 'Температура 38,1 один день');
  addEvent(T.urticariaFrom, 'urticaria', 'Крапивница на предплечьях');
  addEvent(T.urticariaTo, 'urticaria', '');
  addEvent(T.hospFrom, 'hospital', 'Госпитализация, отделение № 3');
  addEvent(T.transfusion, 'transfusion', 'Эритроцитная взвесь, 2 дозы');
  addEvent(T.discharge, 'dosechange', 'Циклоспорин 100 мг × 2 → 50 мг × 2');
  addEvent(T.coldFrom, 'infection', 'ОРВИ, температура 37,4');
  addEvent(-913, 'vaccine', 'Менингококковая вакцина');
  for (const inf of infusions.filter((i) => i.done)) {
    events.push({ id: uid('ev'), date: inf.date, type: 'infusion', note: '' });
  }
  await store.replaceAll('events', events);

  /* — Переливание ————————————————————————————— */
  await store.replaceAll('transfusions', [{
    id: uid('tr'), date: D(T.transfusion), component: 'Эритроцитная взвесь (ЭВ)',
    volume: '2 дозы',
    hbBefore: 72, hbAfter: 96, pltBefore: 149, pltAfter: 152,
    place: 'Стационар, отделение № 3', note: 'Реакций не было',
  }]);

  /* — Прочие исследования ————————————————————————— */
  await store.replaceAll('studies', [
    { id: uid('st'), date: D(-172), name: 'ПНГ-клон (проточная цитометрия)', next: D(13),
      note: 'Гранулоциты 92 %', files: [] },
    { id: uid('st'), date: D(-172), name: 'Пункция костного мозга', next: null, note: '', files: [] },
    { id: uid('st'), date: D(-57), name: 'УЗИ органов брюшной полости', next: D(123),
      note: 'В стационаре', files: [] },
    { id: uid('st'), date: D(-19), name: 'ЭхоКГ', next: D(346), note: '', files: [] },
  ]);

  /* — Чек-лист госпитализации: часть просрочена, часть истекает ——— */
  const chkDates = {
    hbsag: -41, hcv: -41, hiv: -26, rw: -12, ecg: -33, flg: -300,
    hemlist: null, copies: -60,
  };
  await store.replaceAll('checklist', structuredClone(HOSP_CHECKLIST).map((c) => ({
    ...c, date: chkDates[c.id] == null ? null : D(chkDates[c.id]),
  })));

  /* — Прививки ————————————————————————————————— */
  await store.replaceAll('vaccines', [
    { id: uid('vac'), date: D(-913), name: 'Менингококковая вакцина', everyYears: 3,
      note: 'Введена на 2-й день после инфузии' },
    { id: uid('vac'), date: D(-240), name: 'Пневмококковая вакцина', everyYears: 5, note: '' },
  ]);

  /* — Напоминания ————————————————————————————————— */
  await store.replaceAll('reminders', [
    { id: uid('rem'), title: 'Циклоспорин, утро', kind: 'daily', time: '09:00', enabled: true, medId: 'med_csa' },
    { id: uid('rem'), title: 'Циклоспорин, вечер', kind: 'daily', time: '21:00', enabled: true, medId: 'med_csa' },
    { id: uid('rem'), title: 'Фолиевая кислота', kind: 'daily', time: '09:00', enabled: true, medId: 'med_folate' },
    { id: uid('rem'), title: 'Сдать ОАК и биохимию до инфузии', kind: 'beforeInfusion', daysBefore: 1, time: '18:00', enabled: true },
    { id: uid('rem'), title: 'Инфузия экулизумаба', kind: 'beforeInfusion', daysBefore: 0, time: '08:00', enabled: true },
    { id: uid('rem'), title: 'Выписать рецепт на циклоспорин', kind: 'everyN', everyN: 30, startDate: D(-12), time: '12:00', enabled: true },
    { id: uid('rem'), title: 'Кровь на циклоспорин до утренней дозы', kind: 'everyN', everyN: 7, startDate: D(-1), time: '07:00', enabled: false },
  ]);

  /* — Заметки и документы ————————————————————————— */
  await store.replaceAll('files', [
    { id: uid('note'), date: D(T.discharge), time: '14:20',
      note: 'Выписка из стационара. Циклоспорин снижен до 50 мг × 2. ' +
            'Контроль концентрации через неделю, ОАК и биохимия — перед следующей инфузией.',
      files: [] },
    { id: uid('note'), date: D(-12), time: '11:05',
      note: 'Приём гематолога: схема без изменений, при стабильных показателях ' +
            'обсудить более редкий контроль циклоспорина.',
      files: [] },
  ]);

  /* — Вопросы к врачу ————————————————————————————— */
  await store.replaceAll('questions', [
    { id: uid('q'), text: 'Можно ли перейти на более редкий контроль циклоспорина?', date: D(-4), asked: false },
    { id: uid('q'), text: 'Когда делать ревакцинацию от менингококка?', date: D(-2), asked: false },
    { id: uid('q'), text: 'Нужно ли повторять ПНГ-клон в этом году?', date: D(-1), asked: false },
  ]);

  await store.load();
  store.emit();
}

/** Очистка демо: возвращает приложение к чистому листу. */
export async function clearDemo() {
  await store.wipe();
  await store.load();
  store.emit();
}

export { iso };
