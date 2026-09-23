/* ==========================================================================
   IndexedDB — всё хранится только на устройстве пациента.
   Ни одного сетевого запроса: бэкенда нет.
   ========================================================================== */

const DB_NAME = 'moy-analiz';
const DB_VER = 1;

/** Хранилища с автоинкрементом отключены: id генерируем сами (uid()). */
export const STORES = [
  'kv',            // профиль, пороги, настройки, расписание, карточка безопасности
  'labs',          // сдачи анализов
  'infusions',     // инфузии экулизумаба
  'meds',          // текущая схема лекарств
  'medLog',        // отметки приёма
  'medHistory',    // лента «было → стало»
  'daily',         // самочувствие по дням (id = дата)
  'events',        // события на временной оси
  'transfusions',  // переливания
  'studies',       // прочие исследования
  'reminders',     // напоминания
  'checklist',     // подготовка к госпитализации
  'vaccines',      // прививки
  'questions',     // вопросы к врачу
  'files',         // прикреплённые файлы и фото (dataURL)
];

let _db = null;

export function open() {
  if (_db) return Promise.resolve(_db);
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VER);
    req.onupgradeneeded = () => {
      const db = req.result;
      for (const name of STORES) {
        if (!db.objectStoreNames.contains(name)) {
          const keyPath = name === 'kv' ? 'k' : 'id';
          const st = db.createObjectStore(name, { keyPath });
          if (name !== 'kv' && name !== 'daily') {
            try { st.createIndex('date', 'date'); } catch (_) { /* не критично */ }
          }
        }
      }
    };
    req.onsuccess = () => {
      _db = req.result;
      _db.onversionchange = () => { _db.close(); _db = null; };
      resolve(_db);
    };
    req.onerror = () => reject(req.error);
  });
}

function tx(names, mode) {
  return open().then((db) => db.transaction(names, mode));
}

function wrap(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function getAll(store) {
  const t = await tx([store], 'readonly');
  return wrap(t.objectStore(store).getAll());
}

export async function get(store, key) {
  const t = await tx([store], 'readonly');
  return wrap(t.objectStore(store).get(key));
}

export async function put(store, value) {
  const t = await tx([store], 'readwrite');
  const res = await wrap(t.objectStore(store).put(value));
  await done(t);
  return res;
}

export async function putMany(store, values) {
  if (!values.length) return;
  const t = await tx([store], 'readwrite');
  const os = t.objectStore(store);
  for (const v of values) os.put(v);
  await done(t);
}

export async function del(store, key) {
  const t = await tx([store], 'readwrite');
  await wrap(t.objectStore(store).delete(key));
  await done(t);
}

export async function clear(store) {
  const t = await tx([store], 'readwrite');
  await wrap(t.objectStore(store).clear());
  await done(t);
}

export async function clearAll() {
  const t = await tx(STORES, 'readwrite');
  for (const s of STORES) t.objectStore(s).clear();
  await done(t);
}

function done(t) {
  return new Promise((resolve, reject) => {
    t.oncomplete = () => resolve();
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error);
  });
}

/* — Ключ-значение ————————————————————————————————— */

export async function kvGet(k, fallback = null) {
  const row = await get('kv', k);
  return row ? row.v : fallback;
}

export function kvSet(k, v) {
  return put('kv', { k, v });
}

/* — Экспорт и импорт всех данных одним файлом ———————
   Данные принадлежат пациенту: забрать их можно целиком и в любой момент. */

export async function exportAll() {
  const out = { app: 'moy-analiz', version: DB_VER, exportedAt: new Date().toISOString(), data: {} };
  for (const s of STORES) out.data[s] = await getAll(s);
  return out;
}

export async function importAll(dump, { replace = true } = {}) {
  if (!dump || dump.app !== 'moy-analiz' || !dump.data) {
    throw new Error('Файл не похож на резервную копию «Моего Анализа»');
  }
  if (replace) await clearAll();
  for (const s of STORES) {
    const rows = dump.data[s];
    if (Array.isArray(rows) && rows.length) await putMany(s, rows);
  }
}

/* — Идентификаторы ————————————————————————————— */

export function uid(prefix = 'id') {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}
