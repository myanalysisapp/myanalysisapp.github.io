/* ==========================================================================
   Шаблон «ПНГ»: показатели, единицы, референсы, наборы, расписание контроля.
   Все значения — редактируемые значения по умолчанию, а не догма.
   Референсы типичные для взрослых; в интерфейсе везде стоит пометка
   «уточните по бланку вашей лаборатории».
   ========================================================================== */

/**
 * ref: [min, max] — двусторонний коридор
 *      [null, max] — «до N»
 *      [min, null] — «от N»
 * dec: знаков после запятой
 * bad: в какую сторону отклонение считается клинически значимым для трендов
 *      ('low' — плохо вниз, 'high' — плохо вверх, 'both')
 */
export const ANALYTES = {
  /* — Общий анализ крови ————————————————————————— */
  hb:        { name: 'Гемоглобин',            short: 'Hb',        unit: 'г/л',      ref: [130, 160],  dec: 0, bad: 'low',  group: 'oak' },
  rbc:       { name: 'Эритроциты',            short: 'Эр.',       unit: '×10¹²/л',  ref: [4.0, 5.1],  dec: 2, bad: 'low',  group: 'oak' },
  plt:       { name: 'Тромбоциты',            short: 'Тром.',     unit: '×10⁹/л',   ref: [180, 320],  dec: 0, bad: 'low',  group: 'oak' },
  wbc:       { name: 'Лейкоциты',             short: 'Лейк.',     unit: '×10⁹/л',   ref: [4.0, 9.0],  dec: 1, bad: 'both', group: 'oak' },
  anc:       { name: 'Нейтрофилы абс. (АЧН)', short: 'АЧН',       unit: '×10⁹/л',   ref: [1.8, 6.5],  dec: 2, bad: 'low',  group: 'oak' },
  retic:     { name: 'Ретикулоциты абс.',     short: 'Рет.',      unit: '×10⁹/л',   ref: [25, 85],    dec: 1, bad: 'high', group: 'oak' },

  /* — Биохимия ——————————————————————————————————— */
  ldh:       { name: 'ЛДГ',                   short: 'ЛДГ',       unit: 'Ед/л',     ref: [125, 220],  dec: 0, bad: 'high', group: 'bio' },
  bil_t:     { name: 'Билирубин общий',       short: 'Бил. общ.', unit: 'мкмоль/л', ref: [3.4, 20.5], dec: 1, bad: 'high', group: 'bio' },
  bil_d:     { name: 'Билирубин прямой',      short: 'Бил. пр.',  unit: 'мкмоль/л', ref: [0, 5.1],    dec: 1, bad: 'high', group: 'bio' },
  bil_i:     { name: 'Билирубин непрямой',    short: 'Бил. непр.',unit: 'мкмоль/л', ref: [1.7, 15.4], dec: 1, bad: 'high', group: 'bio' },
  creat:     { name: 'Креатинин',             short: 'Креат.',    unit: 'мкмоль/л', ref: [62, 106],   dec: 0, bad: 'high', group: 'bio' },
  urea:      { name: 'Мочевина',              short: 'Мочев.',    unit: 'ммоль/л',  ref: [2.8, 7.2],  dec: 1, bad: 'high', group: 'bio' },
  uric:      { name: 'Мочевая кислота',       short: 'Моч. к-та', unit: 'мкмоль/л', ref: [202, 416],  dec: 0, bad: 'high', group: 'bio' },
  alt:       { name: 'АЛТ',                   short: 'АЛТ',       unit: 'Ед/л',     ref: [null, 41],  dec: 0, bad: 'high', group: 'bio' },
  ast:       { name: 'АСТ',                   short: 'АСТ',       unit: 'Ед/л',     ref: [null, 40],  dec: 0, bad: 'high', group: 'bio' },
  ggt:       { name: 'ГГТП',                  short: 'ГГТП',      unit: 'Ед/л',     ref: [10, 71],    dec: 0, bad: 'high', group: 'bio' },
  alp:       { name: 'Щелочная фосфатаза',    short: 'ЩФ',        unit: 'Ед/л',     ref: [40, 130],   dec: 0, bad: 'high', group: 'bio' },
  glu:       { name: 'Глюкоза',               short: 'Глюк.',     unit: 'ммоль/л',  ref: [3.9, 6.1],  dec: 1, bad: 'both', group: 'bio' },
  alb:       { name: 'Альбумин',              short: 'Альб.',     unit: 'г/л',      ref: [35, 52],    dec: 0, bad: 'low',  group: 'bio' },
  tp:        { name: 'Общий белок',           short: 'Белок',     unit: 'г/л',      ref: [64, 83],    dec: 0, bad: 'low',  group: 'bio' },
  k:         { name: 'Калий',                 short: 'K',         unit: 'ммоль/л',  ref: [3.5, 5.1],  dec: 2, bad: 'both', group: 'bio' },
  na:        { name: 'Натрий',                short: 'Na',        unit: 'ммоль/л',  ref: [136, 145],  dec: 0, bad: 'both', group: 'bio' },
  mg:        { name: 'Магний',                short: 'Mg',        unit: 'ммоль/л',  ref: [0.66, 1.07],dec: 2, bad: 'low',  group: 'bio' },
  probnp:    { name: 'NT-proBNP',             short: 'NT-proBNP', unit: 'пг/мл',    ref: [null, 125], dec: 0, bad: 'high', group: 'bio' },

  /* — Циклоспорин ——————————————————————————————— */
  csa:       { name: 'Циклоспорин', short: 'Циклоспорин', unit: 'нг/мл',
               ref: [150, 250], dec: 0, bad: 'both', group: 'csa',
               note: 'Целевой коридор задаётся врачом. Кровь берут строго до утренней дозы.' },

  /* — Витамины и железо ——————————————————————————— */
  b12:       { name: 'Витамин B12',           short: 'B12',       unit: 'пг/мл',    ref: [187, 883],  dec: 0, bad: 'low',  group: 'vit' },
  folate:    { name: 'Фолиевая кислота',      short: 'Фолат',     unit: 'нг/мл',    ref: [3.1, 20.5], dec: 1, bad: 'low',  group: 'vit' },
  vitd:      { name: 'Витамин D (25-OH)',     short: 'Вит. D',    unit: 'нг/мл',    ref: [30, 100],   dec: 1, bad: 'low',  group: 'vit' },
  ferritin:  { name: 'Ферритин',              short: 'Ферритин',  unit: 'нг/мл',    ref: [30, 400],   dec: 0, bad: 'both', group: 'vit' },

  /* — Почки ————————————————————————————————————— */
  gfr:       { name: 'СКФ (проба Реберга)',   short: 'СКФ',       unit: 'мл/мин',   ref: [80, 120],   dec: 0, bad: 'low',  group: 'kid' },
  prot24:    { name: 'Суточная протеинурия',  short: 'Белок сут.',unit: 'г/сут',    ref: [null, 0.15],dec: 2, bad: 'high', group: 'kid' },
  alburia:   { name: 'Альбуминурия',          short: 'Альб. мочи',unit: 'мг/сут',   ref: [null, 30],  dec: 0, bad: 'high', group: 'kid' },
  urine_pro: { name: 'Белок в ОАМ',           short: 'Белок ОАМ', unit: 'г/л',      ref: [null, 0.1], dec: 2, bad: 'high', group: 'kid' },
  urine_ph:  { name: 'pH мочи',               short: 'pH',        unit: '',         ref: [5.0, 7.0],  dec: 1, bad: 'both', group: 'kid' },
  urine_hb:  { name: 'Гемоглобин в моче',     short: 'Hb мочи',   unit: '',         ref: null,        dec: 0, bad: 'high', group: 'kid',
               kind: 'text', note: 'Отрицательно / следы / +, ++, +++' },
};

/* — Наборы для ручного ввода ————————————————————— */

export const PANELS = [
  { id: 'oak',  name: 'Общий анализ крови', short: 'ОАК',
    hint: 'с формулой, ретикулоцитами и тромбоцитами',
    keys: ['hb', 'rbc', 'plt', 'wbc', 'anc', 'retic'] },

  { id: 'bio',  name: 'Биохимия крови', short: 'Биохимия',
    hint: 'ЛДГ, билирубин, печень, почки, электролиты',
    keys: ['ldh', 'bil_t', 'bil_d', 'bil_i', 'creat', 'urea', 'uric',
           'alt', 'ast', 'ggt', 'alp', 'glu', 'alb', 'tp', 'k', 'na', 'mg'] },

  { id: 'csa',  name: 'Циклоспорин', short: 'Циклоспорин',
    hint: 'концентрация до утренней дозы',
    keys: ['csa'] },

  { id: 'vit',  name: 'Витамины и железо', short: 'Витамины',
    hint: 'B12, фолат, витамин D, ферритин',
    keys: ['b12', 'folate', 'vitd', 'ferritin'] },

  { id: 'kid',  name: 'Почки и моча', short: 'Почки',
    hint: 'креатинин, мочевина, Реберг, ОАМ, протеинурия',
    keys: ['creat', 'urea', 'gfr', 'prot24', 'alburia', 'urine_pro', 'urine_ph', 'urine_hb'] },

  { id: 'cardio', name: 'NT-proBNP', short: 'NT-proBNP',
    hint: 'раз в год',
    keys: ['probnp'] },
];

/* — Что показывать на «Динамике» ————————————————— */

export const CHART_KEYS = ['hb', 'ldh', 'plt', 'anc', 'retic', 'bil_t', 'bil_i', 'creat', 'csa'];

/* — Мини-карточки на «Сегодня» ———————————————————— */

export const TODAY_KEYS = ['hb', 'ldh', 'plt', 'wbc'];

/* — Расписание контроля (шаблон ПНГ) —————————————
   every / everyStable — интервал в днях. Переключатель «стабилизация»
   переводит пункт на более редкий режим.                              */

export const SCHEDULE = [
  { id: 'sch_oak',    title: 'Сдать общий анализ крови',
    every: 14, everyStable: 30, panel: 'oak', beforeInfusion: true, stable: false,
    note: 'С ретикулоцитами и тромбоцитами, до инфузии' },

  { id: 'sch_bio',    title: 'Сдать биохимию крови',
    every: 18, everyStable: 30, panel: 'bio', beforeInfusion: true, stable: false,
    note: 'Раз в 2–3 недели, до инфузии' },

  { id: 'sch_csa',    title: 'Сдать кровь на циклоспорин',
    every: 7, everyStable: 30, panel: 'csa', beforeInfusion: false, stable: false,
    note: 'Утром, до первой таблетки' },

  { id: 'sch_vit',    title: 'Сдать витамины и железо',
    every: 90, everyStable: 180, panel: 'vit', beforeInfusion: false, stable: false, note: 'Раз в 3 месяца' },

  { id: 'sch_kid',    title: 'Проверить почки',
    every: 180, everyStable: 365, panel: 'kid', beforeInfusion: false, stable: false, note: 'Раз в 6 месяцев' },

  { id: 'sch_probnp', title: 'Сдать NT-proBNP',
    every: 365, everyStable: 365, panel: 'cardio', beforeInfusion: false, stable: false, note: 'Раз в 12 месяцев' },
];

/* — Пороги от врача по умолчанию ————————————————— */

export const DEFAULT_THRESHOLDS = {
  hb:  { min: 80,  max: null, label: 'Гемоглобин' },
  plt: { min: 50,  max: null, label: 'Тромбоциты' },
  anc: { min: 1.0, max: null, label: 'Нейтрофилы абс.' },
  csa: { min: 150, max: 250,  label: 'Циклоспорин, коридор' },
  bp:  { sysMax: 140, diaMax: 90, sysMin: 90, diaMin: 60, label: 'Артериальное давление' },
};

/* — Чек-лист госпитализации: сроки годности ——————— */

export const HOSP_CHECKLIST = [
  { id: 'hbsag',  name: 'Гепатит B (HBsAg)',        months: 1 },
  { id: 'hcv',    name: 'Гепатит C (anti-HCV)',     months: 1 },
  { id: 'hiv',    name: 'ВИЧ',                      months: 1 },
  { id: 'rw',     name: 'Сифилис (RW)',             months: 1 },
  { id: 'ecg',    name: 'ЭКГ',                      months: 1 },
  { id: 'flg',    name: 'Флюорография',             months: 12 },
  { id: 'hemlist',name: 'Гематологический лист (распечатать)', months: 1, kind: 'doc' },
  { id: 'copies', name: 'Копии обследований и выписок',        months: null, kind: 'doc' },
];

/* — Симптомы для быстрой отметки ————————————————— */

export const SYMPTOMS = [
  { id: 'urticaria', name: 'Крапивница',  icon: '🫧' },
  { id: 'weakness',  name: 'Слабость',    icon: '🥱' },
  { id: 'dyspnea',   name: 'Одышка',      icon: '🌬️' },
  { id: 'pain',      name: 'Боль',        icon: '⚡' },
  { id: 'cold',      name: 'Простуда',    icon: '🤧' },
  { id: 'headache',  name: 'Головная боль', icon: '🌀' },
  { id: 'nausea',    name: 'Тошнота',     icon: '🫗' },
  { id: 'darkurine', name: 'Тёмная моча', icon: '🍂' },
];

/* — Типы событий на временной оси ————————————————— */

export const EVENT_TYPES = {
  fever:      { name: 'Температура',        icon: '🌡️', tone: 'warn' },
  urticaria:  { name: 'Крапивница',         icon: '🫧',  tone: 'warn' },
  infection:  { name: 'Простуда / инфекция',icon: '🤧',  tone: 'warn' },
  stress:     { name: 'Стресс',             icon: '🌪️', tone: '' },
  nosleep:    { name: 'Недосып',            icon: '🌙',  tone: '' },
  overwork:   { name: 'Переработка',        icon: '💼',  tone: '' },
  vaccine:    { name: 'Вакцинация',         icon: '💉',  tone: '' },
  hospital:   { name: 'Госпитализация',     icon: '🏥',  tone: 'alert' },
  transfusion:{ name: 'Переливание',        icon: '🩸',  tone: 'alert' },
  dosechange: { name: 'Смена дозы',         icon: '💊',  tone: '' },
  infusion:   { name: 'Инфузия',            icon: '💧',  tone: 'accent' },
};

/* — Шкала цвета мочи —————————————————————————————

   URINE_ON — временная заглушка на время демонстрации. Раздел скрыт
   из интерфейса целиком: с «Сегодня», из ежедневного опроса, из быстрой
   записи, из календаря и настроек. Код и уже записанные дни остаются на
   месте, вернуть раздел — поставить здесь true. */

export const URINE_ON = false;

export const URINE = [
  { n: 1, css: 'var(--urine-1)', label: 'Светло-жёлтая' },
  { n: 2, css: 'var(--urine-2)', label: 'Жёлтая' },
  { n: 3, css: 'var(--urine-3)', label: 'Насыщенно-жёлтая' },
  { n: 4, css: 'var(--urine-4)', label: 'Янтарная' },
  { n: 5, css: 'var(--urine-5)', label: 'Тёмно-коричневая' },
  { n: 6, css: 'var(--urine-6)', label: 'Цвета крепкого чая' },
];

/* Самочувствие. Цвет идёт сверху вниз: зелёный — хороший день,
   дальше по убыванию. Это главная шкала дневника. */
export const MOODS = [
  { n: 1, face: '😣', label: 'Плохо',      css: 'var(--mood-1)', soft: 'var(--mood-1-soft)' },
  { n: 2, face: '🙁', label: 'Так себе',   css: 'var(--mood-2)', soft: 'var(--mood-2-soft)' },
  { n: 3, face: '😐', label: 'Нормально',  css: 'var(--mood-3)', soft: 'var(--mood-3-soft)' },
  { n: 4, face: '🙂', label: 'Хорошо',     css: 'var(--mood-4)', soft: 'var(--mood-4-soft)' },
  { n: 5, face: '😃', label: 'Отлично',    css: 'var(--mood-5)', soft: 'var(--mood-5-soft)' },
];

export function mood(n) { return n >= 1 && n <= 5 ? MOODS[n - 1] : null; }

/* — Противопоказания и предупреждения для карточки безопасности ——
   Это не рекомендации по лечению, а фактические сведения,
   которые пациент переносит из выписки, чтобы показать врачу. */

export const SAFETY_DEFAULTS = {
  contraindications: [
    'Внутримышечные инъекции',
    'Тепловые процедуры и физиотерапия',
    'Иглоукалывание',
  ],
  warning: 'Пациент получает ингибитор комплемента (экулизумаб). Повышен риск менингококковой инфекции: ' +
           'при лихорадке требуется срочная оценка врача.',
};

/* ==========================================================================
   Единицы измерения

   Первая в списке — каноничная: именно в ней значение хранится и строятся
   графики. `k` переводит значение ИЗ этой единицы В каноничную.

   Нужно это не для красоты: одна и та же лаборатория пишет ЛДГ то в Ед/л,
   то в U/L, а креатинин бывает и в мг/дл. Введённое в чужих единицах
   значение молча испортило бы график, по которому смотрит врач.
   ========================================================================== */

export const UNITS = {
  hb:        [{ id: 'г/л', k: 1, dec: 0 }, { id: 'г/дл', k: 10, dec: 1 }],
  rbc:       [{ id: '×10¹²/л', k: 1, dec: 2 }, { id: 'млн/мкл', k: 1, dec: 2 }],
  plt:       [{ id: '×10⁹/л', k: 1, dec: 0 }, { id: 'тыс/мкл', k: 1, dec: 0 }],
  wbc:       [{ id: '×10⁹/л', k: 1, dec: 1 }, { id: 'тыс/мкл', k: 1, dec: 1 }],
  anc:       [{ id: '×10⁹/л', k: 1, dec: 2 }, { id: 'кл/мкл', k: 0.001, dec: 0 }],
  retic:     [{ id: '×10⁹/л', k: 1, dec: 1 }, { id: 'кл/мкл', k: 0.001, dec: 0 }],

  ldh:       [{ id: 'Ед/л', k: 1, dec: 0 }, { id: 'U/L', k: 1, dec: 0 }, { id: 'МЕ/л', k: 1, dec: 0 }],
  bil_t:     [{ id: 'мкмоль/л', k: 1, dec: 1 }, { id: 'мг/дл', k: 17.104, dec: 2 }],
  bil_d:     [{ id: 'мкмоль/л', k: 1, dec: 1 }, { id: 'мг/дл', k: 17.104, dec: 2 }],
  bil_i:     [{ id: 'мкмоль/л', k: 1, dec: 1 }, { id: 'мг/дл', k: 17.104, dec: 2 }],
  creat:     [{ id: 'мкмоль/л', k: 1, dec: 0 }, { id: 'мг/дл', k: 88.4, dec: 2 }],
  urea:      [{ id: 'ммоль/л', k: 1, dec: 1 }, { id: 'мг/дл', k: 0.1665, dec: 0 }],
  uric:      [{ id: 'мкмоль/л', k: 1, dec: 0 }, { id: 'мг/дл', k: 59.48, dec: 1 }],
  alt:       [{ id: 'Ед/л', k: 1, dec: 0 }, { id: 'U/L', k: 1, dec: 0 }],
  ast:       [{ id: 'Ед/л', k: 1, dec: 0 }, { id: 'U/L', k: 1, dec: 0 }],
  ggt:       [{ id: 'Ед/л', k: 1, dec: 0 }, { id: 'U/L', k: 1, dec: 0 }],
  alp:       [{ id: 'Ед/л', k: 1, dec: 0 }, { id: 'U/L', k: 1, dec: 0 }],
  glu:       [{ id: 'ммоль/л', k: 1, dec: 1 }, { id: 'мг/дл', k: 0.0555, dec: 0 }],
  alb:       [{ id: 'г/л', k: 1, dec: 0 }, { id: 'г/дл', k: 10, dec: 1 }],
  tp:        [{ id: 'г/л', k: 1, dec: 0 }, { id: 'г/дл', k: 10, dec: 1 }],
  k:         [{ id: 'ммоль/л', k: 1, dec: 2 }, { id: 'мэкв/л', k: 1, dec: 2 }],
  na:        [{ id: 'ммоль/л', k: 1, dec: 0 }, { id: 'мэкв/л', k: 1, dec: 0 }],
  mg:        [{ id: 'ммоль/л', k: 1, dec: 2 }, { id: 'мг/дл', k: 0.4114, dec: 2 }, { id: 'мэкв/л', k: 0.5, dec: 2 }],
  probnp:    [{ id: 'пг/мл', k: 1, dec: 0 }, { id: 'нг/л', k: 1, dec: 0 }],

  csa:       [{ id: 'нг/мл', k: 1, dec: 0 }, { id: 'мкг/л', k: 1, dec: 0 }],

  b12:       [{ id: 'пг/мл', k: 1, dec: 0 }, { id: 'пмоль/л', k: 1.355, dec: 0 }],
  folate:    [{ id: 'нг/мл', k: 1, dec: 1 }, { id: 'нмоль/л', k: 0.4413, dec: 1 }],
  vitd:      [{ id: 'нг/мл', k: 1, dec: 1 }, { id: 'нмоль/л', k: 0.4006, dec: 1 }],
  ferritin:  [{ id: 'нг/мл', k: 1, dec: 0 }, { id: 'мкг/л', k: 1, dec: 0 }],

  gfr:       [{ id: 'мл/мин', k: 1, dec: 0 }],
  prot24:    [{ id: 'г/сут', k: 1, dec: 2 }, { id: 'мг/сут', k: 0.001, dec: 0 }],
  alburia:   [{ id: 'мг/сут', k: 1, dec: 0 }, { id: 'г/сут', k: 1000, dec: 3 }],
  urine_pro: [{ id: 'г/л', k: 1, dec: 2 }, { id: 'мг/дл', k: 0.01, dec: 0 }],
};

/* ==========================================================================
   Синонимы названий

   Тем же словарём пользуются разбор вставленного текста и поиск показателя
   в форме. Сравнение идёт по «сплющенной» строке: нижний регистр,
   ё → е, без пробелов и знаков препинания.
   ========================================================================== */

export const ALIASES = {
  hb:        ['гемоглобин', 'hgb', 'hb', 'haemoglobin', 'hemoglobin'],
  rbc:       ['эритроциты', 'rbc'],
  plt:       ['тромбоциты', 'plt'],
  wbc:       ['лейкоциты', 'wbc'],
  anc:       ['нейтрофилыабс', 'абснейтрофилы', 'ачн', 'нейтрофилыабсолютное',
              'абсолютноесодержаниенейтрофилов', 'neutabs', 'neut', 'нейтрофилы'],
  retic:     ['ретикулоцитыабс', 'абсретикулоциты', 'ретикулоциты', 'retabs', 'ret'],

  ldh:       ['лдг', 'лактатдегидрогеназа', 'ldh'],
  bil_t:     ['билирубинобщий', 'общийбилирубин', 'билирубин', 'tbil', 'totalbilirubin'],
  bil_d:     ['билирубинпрямой', 'прямойбилирубин', 'билирубинконъюгированный', 'dbil'],
  bil_i:     ['билирубиннепрямой', 'непрямойбилирубин', 'билирубиннеконъюгированный', 'ibil'],
  creat:     ['креатинин', 'creat', 'crea', 'creatinine'],
  urea:      ['мочевина', 'urea'],
  uric:      ['мочеваякислота', 'мочевкислота', 'uricacid'],
  alt:       ['алт', 'аланинаминотрансфераза', 'alt'],
  ast:       ['аст', 'аспартатаминотрансфераза', 'ast'],
  ggt:       ['ггтп', 'ггт', 'гаммаглутамилтранспептидаза', 'ggt'],
  alp:       ['щф', 'щелочнаяфосфатаза', 'alp'],
  glu:       ['глюкоза', 'glucose', 'glu'],
  alb:       ['альбумин', 'alb'],
  tp:        ['общийбелок', 'белокобщий', 'totalprotein'],
  k:         ['калий', 'kalium', 'potassium'],
  na:        ['натрий', 'natrium', 'sodium'],
  mg:        ['магний', 'magnesium'],
  probnp:    ['ntprobnp', 'probnp'],

  csa:       ['циклоспорин', 'циклоспорина', 'cyclosporine'],

  b12:       ['витаминb12', 'витаминв12', 'цианокобаламин', 'кобаламин'],
  folate:    ['фолиеваякислота', 'фолат', 'folate', 'folicacid'],
  vitd:      ['витаминd25oh', '25ohвитаминd', 'витаминd', 'витаминд', '25ohd', 'vitamind'],
  ferritin:  ['ферритин', 'ferritin'],

  gfr:       ['скф', 'пробареберга', 'клубочковаяфильтрация', 'реберг', 'gfr'],
  prot24:    ['суточнаяпротеинурия', 'протеинуриясуточная', 'белоквсуточноймоче'],
  alburia:   ['альбуминурия', 'микроальбуминурия', 'альбуминвмоче'],
  urine_pro: ['белоквмоче', 'белокоам'],
  urine_ph:  ['phмочи', 'реакциямочи'],
  urine_hb:  ['гемоглобинвмоче', 'кровьвмоче', 'эритроцитывмоче'],
};

/* — Хелперы ———————————————————————————————————— */

/** «Гемоглобин (HGB)» → «гемоглобинhgb»: приводим названия к сравнимому виду. */
export function flatten(text) {
  return String(text)
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[^a-zа-я0-9]/g, '');
}

/** Единицы показателя; первая — каноничная. */
export function unitsFor(key) {
  const a = analyte(key);
  return UNITS[key] || [{ id: a.unit || '', k: 1, dec: a.dec }];
}

export function unitById(key, id) {
  const list = unitsFor(key);
  return list.find((u) => u.id === id) || list[0];
}

/** Из выбранной единицы в каноничную — в ней всё хранится. */
export function toBase(key, value, unitId) {
  const n = Number(value);
  if (Number.isNaN(n)) return null;
  return n * unitById(key, unitId).k;
}

/** Из каноничной в выбранную — для показа в поле. */
export function fromBase(key, value, unitId) {
  const n = Number(value);
  if (Number.isNaN(n)) return null;
  const u = unitById(key, unitId);
  return Number((n / u.k).toFixed(Math.max(u.dec, 0) + 2));
}

/** Референс, пересчитанный в выбранную единицу. */
export function refIn(key, unitId) {
  const a = analyte(key);
  if (!a.ref) return null;
  const u = unitById(key, unitId);
  return a.ref.map((v) => (v == null ? null : v / u.k));
}

export function analyte(key) {
  return ANALYTES[key] || { name: key, short: key, unit: '', ref: null, dec: 1, bad: 'both' };
}

export function panelById(id) {
  return PANELS.find((p) => p.id === id) || null;
}

/**
 * Текст референса: «130–160», «до 41», «от 30».
 * С unitId — пересчитанный в эту единицу (в форме поле и референс
 * обязаны быть в одних единицах, иначе подсказка врёт).
 */
export function refText(key, unitId) {
  const a = analyte(key);
  if (!a.ref) return '';
  const u = unitId ? unitById(key, unitId) : null;
  const [lo, hi] = u ? refIn(key, unitId) : a.ref;
  const dec = u ? u.dec : a.dec;
  const f = (v) => fmtNum(v, dec);
  if (lo == null && hi == null) return '';
  if (lo == null) return `до ${f(hi)}`;
  if (hi == null) return `от ${f(lo)}`;
  return `${f(lo)}–${f(hi)}`;
}

export function fmtNum(v, dec = 1) {
  if (v == null || v === '' || Number.isNaN(Number(v))) return '—';
  const n = Number(v);
  const s = dec === 0 ? String(Math.round(n)) : n.toFixed(dec).replace(/\.?0+$/, '');
  return s.replace('.', ',');
}

/**
 * Оценка значения. Порядок важен: личный порог врача строже референса.
 * Возвращает { level: 'ok' | 'warn' | 'alert', text, dir }
 *   warn  — вне референса лаборатории
 *   alert — вне личного порога, заданного врачом
 */
/**
 * @param {Array} [labRef] норма той лаборатории, где сдавали: [min, max]
 *
 * У разных лабораторий разные реактивы, и у ЛДГ верхняя граница может
 * отличаться в полтора раза. Если бланк принёс свою норму, судим по ней,
 * а не по справочной: иначе приложение назовёт нормальный результат
 * повышенным просто потому, что клиника другая.
 */
export function evaluate(key, value, thresholds, labRef) {
  const a = analyte(key);
  const v = Number(value);
  if (value == null || value === '' || Number.isNaN(v)) return { level: 'ok', text: '', dir: null };

  const th = thresholds && thresholds[key];
  if (th) {
    if (th.min != null && v < th.min) {
      return { level: 'alert', text: 'ниже вашего порога', dir: 'low' };
    }
    if (th.max != null && v > th.max) {
      return { level: 'alert', text: 'выше вашего порога', dir: 'high' };
    }
  }

  const useRef = (labRef && (labRef[0] != null || labRef[1] != null)) ? labRef : a.ref;
  if (useRef) {
    const [lo, hi] = useRef;
    if (lo != null && v < lo) return { level: 'warn', text: 'ниже нормы лаборатории', dir: 'low' };
    if (hi != null && v > hi) return { level: 'warn', text: 'выше нормы лаборатории', dir: 'high' };
  }

  return { level: 'ok', text: '', dir: null };
}

/* ==========================================================================
   Норма конкретной лаборатории
   ========================================================================== */

/** Пара [min, max] в читаемый вид: «125–220», «до 220», «от 125». */
export function refLabel(ref, key, unitId) {
  if (!ref) return '';
  const u = unitId ? unitById(key, unitId) : null;
  const dec = u ? u.dec : analyte(key).dec;
  const f = (v) => fmtNum(v, dec);
  const [lo, hi] = ref;
  if (lo == null && hi == null) return '';
  if (lo == null) return 'до ' + f(hi);
  if (hi == null) return 'от ' + f(lo);
  return f(lo) + '–' + f(hi);
}

/**
 * Разбирает то, что человек списал с бланка: «125-220», «125 – 220»,
 * «до 220», «от 125», «220». Одно число считаем верхней границей —
 * так его и пишут в бланках чаще всего.
 */
export function parseRef(text) {
  const t = String(text || '').trim().replace(',', '.').toLowerCase();
  if (!t) return null;
  const nums = (t.match(/\d+(?:\.\d+)?/g) || []).map(Number);
  if (!nums.length) return null;
  if (/^до\b/.test(t)) return [null, nums[0]];
  if (/^от\b/.test(t)) return [nums[0], null];
  if (nums.length >= 2) return [Math.min(nums[0], nums[1]), Math.max(nums[0], nums[1])];
  return [null, nums[0]];
}

/** «Экулизумаб 900 мг» из профиля. Пустые поля не оставляют пробелов. */
export function therapyName(profile, fallback = 'Препарат не указан') {
  return [profile && profile.drug, profile && profile.dose]
    .filter(Boolean).join(' ') || fallback;
}
