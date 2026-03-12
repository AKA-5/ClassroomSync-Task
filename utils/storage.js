// ClassroomSync Tasks - Storage Utilities
// Wraps chrome.storage.sync (settings) and chrome.storage.local (sync history).
// chrome.storage.sync  → user preferences synced across devices (~100 KB quota)
// chrome.storage.local → synced-item hashes, can grow larger (~10 MB quota)

// ─── Defaults ─────────────────────────────────────────────────────────────────

export const DEFAULTS = {
  autoSync:       true,
  syncInterval:   1800000,  // ms — 30 min default
  darkMode:       false,
  taskListName:   'Classroom Tasks',
  enabledCourses: null,   // null = all courses enabled
  cachedCourses:  [],     // [{id, name}] populated after each sync
  lastSyncTime:   null,   // Unix ms timestamp
  lastSyncCount:  0,      // tasks created on last sync
  lastSyncError:  null,   // error string or null
  priorityKeywords: {
    high:   'exam, final, midterm, deadline, due tomorrow, urgent',
    medium: 'quiz, assignment, homework, hw, project, essay, report',
    low:    'reading, optional, suggested, chapter, lecture',
  },
};

// ─── Settings ─────────────────────────────────────────────────────────────────

/** Returns merged settings object with defaults filled in. */
export async function getSettings() {
  const data = await chrome.storage.sync.get(Object.keys(DEFAULTS));
  return { ...DEFAULTS, ...data };
}

/** Persists one or more setting keys. */
export async function updateSettings(updates) {
  await chrome.storage.sync.set(updates);
}

// ─── Course Filter ────────────────────────────────────────────────────────────

/**
 * Returns true if the given course should be synced.
 * When enabledCourses is null, all courses are enabled.
 */
export async function isCourseEnabled(courseId) {
  const { enabledCourses } = await getSettings();
  return !enabledCourses || enabledCourses.includes(courseId);
}

// ─── Duplicate-Check Helpers ──────────────────────────────────────────────────

const SYNCED_KEY = 'syncedItems'; // stored in chrome.storage.local
const PRUNE_AGE_MS = 90 * 24 * 60 * 60 * 1000; // 90 days

/** Returns true if this announcement has already been turned into a task. */
export async function isAlreadySynced(key) {
  const { [SYNCED_KEY]: map = {} } = await chrome.storage.local.get(SYNCED_KEY);
  return Object.prototype.hasOwnProperty.call(map, key);
}

/** Records that an announcement has been synced, and prunes old entries. */
export async function markAsSynced(key) {
  const { [SYNCED_KEY]: map = {} } = await chrome.storage.local.get(SYNCED_KEY);
  map[key] = Date.now();

  // Prune entries older than 90 days to keep storage lean
  const cutoff = Date.now() - PRUNE_AGE_MS;
  for (const k of Object.keys(map)) {
    if (map[k] < cutoff) delete map[k];
  }

  await chrome.storage.local.set({ [SYNCED_KEY]: map });
}

// ─── First-Run Detection ──────────────────────────────────────────────────────

const FIRST_RUN_KEY = 'firstRunComplete';

/**
 * Returns true if the user has never completed a sync (i.e. first time opening).
 * Stored in chrome.storage.local (per-device, not synced across browsers).
 */
export async function isFirstRun() {
  const { [FIRST_RUN_KEY]: done } = await chrome.storage.local.get(FIRST_RUN_KEY);
  return !done;
}

/** Call after the first successful sync to prevent the welcome flow showing again. */
export async function markFirstRunDone() {
  await chrome.storage.local.set({ [FIRST_RUN_KEY]: true });
}
