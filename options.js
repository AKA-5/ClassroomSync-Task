// ClassroomSync Tasks - Options Page Controller
// Manages all user settings: auto-sync, dark mode, task list name, course filters.

import { getSettings, updateSettings } from './utils/storage.js';

// ─── DOM refs ─────────────────────────────────────────────────────────────────
const page            = document.getElementById('page');
const autoSyncToggle  = document.getElementById('autoSyncToggle');
const darkModeToggle  = document.getElementById('darkModeToggle');
const taskListInput   = document.getElementById('taskListName');
const courseFiltersEl = document.getElementById('courseFilters');

const statLastSync    = document.getElementById('statLastSync');
const statTaskCount   = document.getElementById('statTaskCount');
const statCourseCount = document.getElementById('statCourseCount');

const signOutBtn      = document.getElementById('signOutBtn');
const saveStatusEl    = document.getElementById('saveStatus');

const kwHighInput     = document.getElementById('kwHigh');
const kwMediumInput   = document.getElementById('kwMedium');
const kwLowInput      = document.getElementById('kwLow');

// ─── Theme ────────────────────────────────────────────────────────────────────

function applyTheme(dark) {
  document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
}

// ─── Save feedback ────────────────────────────────────────────────────────────

let saveTimer;
function flashSaved() {
  saveStatusEl.textContent = 'Saved ✓';
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => { saveStatusEl.textContent = ''; }, 2000);
}

function escapeHtml(s) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ─── Course filters ───────────────────────────────────────────────────────────

function renderCourseFilters(courses, enabledCourses) {
  if (!courses || courses.length === 0) return;

  courseFiltersEl.innerHTML = courses.map(c => {
    const checked = !enabledCourses || enabledCourses.includes(c.id);
    return `
      <label class="course-filter-row" title="${escapeHtml(c.name)}">
        <input type="checkbox" class="course-cb" data-id="${escapeHtml(c.id)}" ${checked ? 'checked' : ''}>
        <span class="course-filter-name">${escapeHtml(c.name)}</span>
      </label>`;
  }).join('');

  courseFiltersEl.querySelectorAll('.course-cb').forEach(cb => {
    cb.addEventListener('change', saveCourseFilters);
  });
}

async function saveCourseFilters() {
  const checkboxes    = [...courseFiltersEl.querySelectorAll('.course-cb')];
  const checkedIds    = checkboxes.filter(cb => cb.checked).map(cb => cb.dataset.id);
  const allEnabled    = checkedIds.length === checkboxes.length;
  const toStore       = allEnabled ? null : checkedIds;
  await updateSettings({ enabledCourses: toStore });
  // Keep the stat counter in sync with the current filter
  statCourseCount.textContent = checkedIds.length;
  flashSaved();
}

// ─── General settings ─────────────────────────────────────────────────────────

async function saveGeneral() {
  const dark         = darkModeToggle.checked;
  const autoSync     = autoSyncToggle.checked;
  const taskListName = taskListInput.value.trim() || 'Classroom Tasks';

  applyTheme(dark);
  await updateSettings({ darkMode: dark, autoSync, taskListName });

  // Tell background to re-schedule or cancel its alarm
  chrome.runtime.sendMessage({ action: 'updateAlarm' });
  flashSaved();
}

// ─── Init ─────────────────────────────────────────────────────────────────────

async function init() {
  const s = await getSettings();

  applyTheme(s.darkMode);
  autoSyncToggle.checked = s.autoSync;
  darkModeToggle.checked = s.darkMode;
  taskListInput.value    = s.taskListName || 'Classroom Tasks';

  // Stats
  statLastSync.textContent    = s.lastSyncTime    ? new Date(s.lastSyncTime).toLocaleString() : '—';
  statTaskCount.textContent   = s.lastSyncCount   != null ? s.lastSyncCount : '—';
  const enabledCount          = s.enabledCourses  ? s.enabledCourses.length : (s.cachedCourses?.length ?? 0);
  statCourseCount.textContent = s.cachedCourses?.length ? enabledCount : '—';

  renderCourseFilters(s.cachedCourses || [], s.enabledCourses);

  // Priority keywords
  const kw = s.priorityKeywords || {};
  if (kwHighInput)   kwHighInput.value   = kw.high   || '';
  if (kwMediumInput) kwMediumInput.value = kw.medium || '';
  if (kwLowInput)    kwLowInput.value    = kw.low    || '';
}

// ─── Events ───────────────────────────────────────────────────────────────────

autoSyncToggle.addEventListener('change', saveGeneral);
darkModeToggle.addEventListener('change', saveGeneral);
taskListInput.addEventListener('change', saveGeneral);

async function savePriorityKeywords() {
  await updateSettings({
    priorityKeywords: {
      high:   kwHighInput?.value.trim()   || '',
      medium: kwMediumInput?.value.trim() || '',
      low:    kwLowInput?.value.trim()    || '',
    },
  });
  flashSaved();
}

if (kwHighInput)   kwHighInput.addEventListener('change', savePriorityKeywords);
if (kwMediumInput) kwMediumInput.addEventListener('change', savePriorityKeywords);
if (kwLowInput)    kwLowInput.addEventListener('change', savePriorityKeywords);

signOutBtn.addEventListener('click', async () => {
  const confirmed = window.confirm(
    'Sign out and clear all sync history?\n\n' +
    'Your Google Tasks are not affected — only the local cache and auth token will be removed.'
  );
  if (!confirmed) return;

  // Remove cached OAuth token
  await new Promise(resolve => {
    chrome.identity.getAuthToken({ interactive: false }, (token) => {
      if (token) {
        chrome.identity.removeCachedAuthToken({ token }, resolve);
      } else {
        resolve();
      }
    });
  });

  // Clear local sync history (stored in chrome.storage.local)
  await chrome.storage.local.clear();

  // Reset sync stats in sync storage
  await updateSettings({
    lastSyncTime:  null,
    lastSyncCount: 0,
    lastSyncError: null,
    cachedCourses: [],
  });

  window.alert('Signed out. Reopen the popup and click Sync Now to reconnect.');
  window.close();
});

// ─── Boot ─────────────────────────────────────────────────────────────────────
init();
