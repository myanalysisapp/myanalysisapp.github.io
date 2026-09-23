/* ==========================================================================
   Слой данных: кэш в памяти поверх IndexedDB + производные величины
   (день интервала, серии для графиков, статусы чек-листа).
   ========================================================================== */

import * as db from './db.js';
import { today, addDays, daysBetween, parseISO } from './ui.js';
import { SCHEDULE, DEFAULT_THRESHOLDS, HOSP_CHECKLIST, evaluate } from './catalog.js';

export const state = {
  ready: false,
  profile: null,
  thresholds: null,
  settings: null,
  schedule: [],
  safety: null,
  labs: [],
  infusions: [],
  meds: [],
  medLog: [],
  medHistory: [],
  daily: [],
  events: [],
  transfusions: [],
  studies: [],
  reminders: [],
  checklist: [],
  vaccines: [],
  questions: [],
  files: [],
};

const listeners = new Set();

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function emit() {
  for (const fn of listeners) {
    try { fn(); } catch (e) { console.error('Ошибка подписчика', e); }
  }
}

/* — Значения по умолчанию ————————————————————————— */

export const DEFAULT_PROFILE = {
  name: '',
  disease: 'png',
  diseaseName: 'Пароксизмальная ночная гемоглобинурия (ПНГ)',
  birthYear: null,
  /* Пусто по умолчанию: препарат и доза спрашиваются при знакомстве.
     Подставлять экулизумаб всем подряд нельзя — схемы у людей разные. */
  drug: '',
  dose: '',
  interval: 14,
  lastInfusion: null,
  onboarded: false,
  demo: false,
};

export const DEFAULT_SETTINGS = {
  theme: 'light',        // light | dark | auto
  eveningSurvey: true,
  a2hsDismissed: false,
  pet: 'cat',            // id из pets.js или 'none'
  urineDaily: true,      // спрашивать цвет мочи в ежедневном опросе
  tourSeen: false,       // короткую экскурсию показываем один раз
  ownDiary: false,       // человек сам отказался от демо: больше не подсовываем
};

export const DEFAULT_SAFETY = {
  fullName: '',
  birth: '',
  diagnosis: 'Пароксизмальная ночная гемоглобинурия (ПНГ)',
  contraindications: [],
  warning: '',
  doctor: '',
  doctorPhone: '',
  center: '',
  centerPhone: '',
  bloodType: '',
};

/* — Загрузка ———————————————————————————————————— */

export async function load() {
  const [
    profile, thresholds, settings, schedule, safety,
    labs, infusions, meds, medLog, medHistory, daily,
    events, transfusions, studies, reminders, checklist, vaccines, questions, files,
  ] = await Promise.all([
    db.kvGet('profile'), db.kvGet('thresholds'), db.kvGet('settings'),
    db.kvGet('schedule'), db.kvGet('safety'),
    db.getAll('labs'), db.getAll('infusions'), db.getAll('meds'), db.getAll('medLog'),
    db.getAll('medHistory'), db.getAll('daily'), db.getAll('events'),
    db.getAll('transfusions'), db.getAll('studies'), db.getAll('reminders'),
    db.getAll('checklist'), db.getAll('vaccines'), db.getAll('questions'), db.getAll('files'),
  ]);

  state.profile    = { ...DEFAULT_PROFILE, ...(profile || {}) };
  state.thresholds = thresholds || structuredClone(DEFAULT_THRESHOLDS);
  state.settings   = { ...DEFAULT_SETTINGS, ...(settings || {}) };
  state.schedule   = schedule || structuredClone(SCHEDULE);
  state.safety     = { ...DEFAULT_SAFETY, ...(safety || {}) };

  state.labs         = sortByDate(labs);
  state.infusions    = sortByDate(infusions);
  state.meds         = meds || [];
  state.medLog       = medLog || [];
  state.medHistory   = sortByDate(medHistory);
  state.daily        = sortByDate(daily);
  state.events       = sortByDate(events);
  state.transfusions = sortByDate(transfusions);
  state.studies      = sortByDate(studies);
  state.reminders    = reminders || [];
  state.checklist    = checklist && checklist.length ? checklist : structuredClone(HOSP_CHECKLIST).map((c) => ({ ...c, date: null }));
  state.vaccines     = sortByDate(vaccines);
  state.questions    = questions || [];
  state.files        = files || [];

  state.ready = true;
  return state;
}

function sortByDate(arr, dir = 1) {
  return (arr || []).slice().sort((a, b) => (a.date < b.date ? -dir : a.date > b.date ? dir : 0));
}

/* — Профиль и настройки ————————————————————————— */

export async function saveProfile(patch) {
  state.profile = { ...state.profile, ...patch };
  await db.kvSet('profile', state.profile);
  emit();
}

export async function saveSettings(patch) {
  state.settings = { ...state.settings, ...patch };
  await db.kvSet('settings', state.settings);
  emit();
}

export async function saveThresholds(next) {
  state.thresholds = next;
  await db.kvSet('thresholds', next);
  emit();
}

export async function saveSchedule(next) {
  state.schedule = next;
  await db.kvSet('schedule', next);
  emit();
}

export async function saveSafety(patch) {
  state.safety = { ...state.safety, ...patch };
  await db.kvSet('safety', state.safety);
  emit();
}

/* — Универсальные операции над коллекциями —————————— */

const COLLECTIONS = {
  labs: 'labs', infusions: 'infusions', meds: 'meds', medLog: 'medLog',
  medHistory: 'medHistory', daily: 'daily', events: 'events',
  transfusions: 'transfusions', studies: 'studies', reminders: 'reminders',
  checklist: 'checklist', vaccines: 'vaccines', questions: 'questions', files: 'files',
};

export async function upsert(coll, row) {
  const store = COLLECTIONS[coll];
  if (!store) throw new Error('Неизвестная коллекция: ' + coll);
  if (!row.id) row.id = db.uid(coll);
  await db.put(store, row);
  const list = state[coll];
  const i = list.findIndex((x) => x.id === row.id);
  if (i >= 0) list[i] = row; else list.push(row);
  if (row.date != null) state[coll] = sortByDate(list);
  emit();
  return row;
}

export async function remove(coll, id) {
  await db.del(COLLECTIONS[coll], id);
  state[coll] = state[coll].filter((x) => x.id !== id);
  emit();
}

export async function replaceAll(coll, rows) {
  await db.clear(COLLECTIONS[coll]);
  await db.putMany(COLLECTIONS[coll], rows);
  state[coll] = rows.some((r) => r.date != null) ? sortByDate(rows) : rows;
  emit();
}

/* ==========================================================================
   Интервал между инфузиями
   ========================================================================== */

/** Последняя состоявшаяся инфузия (по отметке done). */
export function lastInfusion() {
  const done = state.infusions.filter((i) => i.done && i.date <= today());
  return done.length ? done[done.length - 1] : null;
}

/** Ближайшая запланированная инфузия (в т.ч. просроченная). */
export function nextInfusion() {
  const planned = state.infusions.filter((i) => !i.done).sort((a, b) => (a.date < b.date ? -1 : 1));
  if (planned.length) return planned[0];
  const last = lastInfusion();
  if (!last) return null;
  return { id: null, date: addDays(last.date, state.profile.interval), done: false, virtual: true };
}

/**
 * Состояние интервала на сегодня.
 * day — номер дня интервала (день инфузии = 1), left — дней до следующей.
 */
export function cycle(onDate = today()) {
  const interval = state.profile.interval || 14;
  const last = lastInfusion();
  const next = nextInfusion();
  if (!last && !next) return { interval, day: null, left: null, next: null, last: null, progress: 0 };

  const nextDate = next ? next.date : addDays(last.date, interval);
  const left = daysBetween(onDate, nextDate);
  const day = last ? daysBetween(last.date, onDate) + 1 : null;
  const progress = day == null
    ? 0
    : Math.max(0, Math.min(1, (day - 1) / interval));

  return {
    interval, day, left, next, last,
    nextDate,
    progress,
    isDue: left === 0,
    isOverdue: left < 0,
  };
}

/** Записи анализов, помеченные «до инфузии» для текущего интервала. */
export function labsInCycle() {
  const c = cycle();
  if (!c.last) return [];
  return state.labs.filter((l) => l.date >= c.last.date);
}

/* ==========================================================================
   Анализы
   ========================================================================== */

/** Последнее значение показателя: { value, date, prev, labId } */
/** Норма лаборатории для показателя из конкретной сдачи, если указана. */
export function labRef(labId, key) {
  if (!labId) return null;
  const rec = state.labs.find((l) => l.id === labId);
  const r = rec && rec.refs && rec.refs[key];
  return (r && (r[0] != null || r[1] != null)) ? r : null;
}

export function latest(key) {
  for (let i = state.labs.length - 1; i >= 0; i--) {
    const v = state.labs[i].values && state.labs[i].values[key];
    if (v != null && v !== '') {
      let prev = null;
      for (let j = i - 1; j >= 0; j--) {
        const p = state.labs[j].values && state.labs[j].values[key];
        if (p != null && p !== '') { prev = { value: Number(p), date: state.labs[j].date }; break; }
      }
      return { value: Number(v), date: state.labs[i].date, prev, labId: state.labs[i].id };
    }
  }
  return null;
}

/** Временной ряд показателя: [{ date, value, flag }] по возрастанию даты. */
export function series(key, fromISO = null) {
  const out = [];
  for (const l of state.labs) {
    if (fromISO && l.date < fromISO) continue;
    const v = l.values && l.values[key];
    if (v == null || v === '' || Number.isNaN(Number(v))) continue;
    out.push({
      date: l.date,
      value: Number(v),
      flag: evaluate(key, v, state.thresholds).level,
      labId: l.id,
    });
  }
  return out;
}

export function labById(id) { return state.labs.find((l) => l.id === id) || null; }

/** Есть ли уже сдача в этом интервале для набора (для карточек «Что сегодня»). */
export function panelDoneInCycle(panelId) {
  const c = cycle();
  if (!c.last) return false;
  return state.labs.some((l) => l.date >= c.last.date && (l.panels || []).includes(panelId));
}

/* ==========================================================================
   Самочувствие по дням
   ========================================================================== */

export function dayRecord(dateISO = today()) {
  return state.daily.find((d) => d.id === dateISO) || null;
}

export async function saveDay(dateISO, patch) {
  const cur = dayRecord(dateISO) || { id: dateISO, date: dateISO };
  const next = { ...cur, ...patch };
  await db.put('daily', next);
  const i = state.daily.findIndex((d) => d.id === dateISO);
  if (i >= 0) state.daily[i] = next; else state.daily.push(next);
  state.daily = sortByDate(state.daily);
  emit();
  return next;
}

/* ==========================================================================
   Лекарства
   ========================================================================== */

export function activeMeds(onDate = today()) {
  return state.meds.filter((m) => {
    if (m.archived) return false;
    if (m.startDate && m.startDate > onDate) return false;
    if (m.endDate && m.endDate < onDate) return false;
    return true;
  });
}

/** Сколько приёмов препарата запланировано на дату (с учётом схемы). */
export function dosesOn(med, dateISO = today()) {
  const times = med.times && med.times.length ? med.times : ['09:00'];
  if (med.freq === 'daily' || !med.freq) return times;
  if (med.freq === 'everyN') {
    const base = med.startDate || dateISO;
    const n = med.everyN || 1;
    const diff = daysBetween(base, dateISO);
    return diff >= 0 && diff % n === 0 ? times : [];
  }
  if (med.freq === 'weekdays') {
    const wd = parseISO(dateISO).getDay();
    return (med.weekdays || []).includes(wd) ? times : [];
  }
  return times;
}

export function medTaken(medId, dateISO, time) {
  return state.medLog.find((l) => l.medId === medId && l.date === dateISO && l.time === time) || null;
}

export async function toggleMed(medId, dateISO, time, status = 'taken') {
  const cur = medTaken(medId, dateISO, time);
  if (cur && cur.status === status) {
    await remove('medLog', cur.id);
    return null;
  }
  const row = cur ? { ...cur, status } : { id: db.uid('mlog'), medId, date: dateISO, time, status };
  await upsert('medLog', row);
  return row;
}

/* ==========================================================================
   Чек-лист госпитализации
   ========================================================================== */

/** status: ok | soon | expired | none; left — дней до истечения */
export function checklistStatus(item, onDate = today()) {
  if (!item.date) return { status: 'none', left: null };
  if (item.months == null) return { status: 'ok', left: null };
  const until = addDays(item.date, Math.round(item.months * 30.4));
  const left = daysBetween(onDate, until);
  if (left < 0) return { status: 'expired', left, until };
  if (left <= 7) return { status: 'soon', left, until };
  return { status: 'ok', left, until };
}

/* ==========================================================================
   Расписание контроля → задачи на сегодня
   ========================================================================== */

/** Когда пункт расписания сдавался последний раз. */
export function lastForSchedule(item) {
  const rows = state.labs.filter((l) => (l.panels || []).includes(item.panel));
  return rows.length ? rows[rows.length - 1] : null;
}

export function scheduleDue(item, onDate = today()) {
  const every = item.stable ? item.everyStable : item.every;
  const last = lastForSchedule(item);
  if (!last) return { due: true, left: 0, last: null, every };
  const nextDate = addDays(last.date, every);
  const left = daysBetween(onDate, nextDate);
  return { due: left <= 0, left, last, nextDate, every };
}

/* ==========================================================================
   Напоминания
   ========================================================================== */

export function remindersForDate(dateISO = today()) {
  return state.reminders.filter((r) => {
    if (!r.enabled) return false;
    if (r.kind === 'daily') return true;
    if (r.kind === 'everyN') {
      const diff = daysBetween(r.startDate || dateISO, dateISO);
      return diff >= 0 && diff % (r.everyN || 1) === 0;
    }
    if (r.kind === 'once') return r.date === dateISO;
    if (r.kind === 'beforeInfusion') {
      const c = cycle(dateISO);
      return c.left === (r.daysBefore ?? 1);
    }
    return false;
  });
}

/* ==========================================================================
   Прививки
   ========================================================================== */

export function vaccineDue(v, onDate = today()) {
  if (!v.date || !v.everyYears) return { due: false, left: null };
  const next = addDays(v.date, Math.round(v.everyYears * 365.25));
  const left = daysBetween(onDate, next);
  return { due: left <= 0, left, next };
}

/* ==========================================================================
   Полная очистка
   ========================================================================== */

export async function wipe() {
  await db.clearAll();
  Object.assign(state, {
    profile: { ...DEFAULT_PROFILE },
    thresholds: structuredClone(DEFAULT_THRESHOLDS),
    settings: { ...DEFAULT_SETTINGS },
    schedule: structuredClone(SCHEDULE),
    safety: { ...DEFAULT_SAFETY },
    labs: [], infusions: [], meds: [], medLog: [], medHistory: [], daily: [],
    events: [], transfusions: [], studies: [], reminders: [],
    checklist: structuredClone(HOSP_CHECKLIST).map((c) => ({ ...c, date: null })),
    vaccines: [], questions: [], files: [],
  });
  emit();
}

export { db };
