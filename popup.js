// ClassroomSync Tasks - Popup Controller
// Displays sync status, course list, and triggers manual sync via background message.

import { getSettings, updateSettings } from './utils/storage.js';

// ─── DOM refs ─────────────────────────────────────────────────────────────────
const syncBtn       = document.getElementById('syncBtn');
const syncIcon      = syncBtn.querySelector('.sync-icon-svg');
const syncLabel     = syncBtn.querySelector('.sync-btn__label');
const rippleContainer = syncBtn.querySelector('.ripple-container');
const darkToggle    = document.getElementById('darkModeToggle');
const optionsBtn    = document.getElementById('optionsBtn');

const lastSyncEl    = document.getElementById('lastSyncTime');
const taskCountRow  = document.getElementById('taskCountRow');
const taskCountEl   = document.getElementById('lastSyncCount');
const errorMsgEl    = document.getElementById('errorMsg');

const progressWrap  = document.getElementById('progressWrap');
const progressFill  = document.getElementById('progressFill');
const progressText  = document.getElementById('progressText');

const coursesHead   = document.getElementById('coursesHead');
const coursesBadge  = document.getElementById('coursesBadge');
const courseList    = document.getElementById('courseList');

// ─── Helpers ──────────────────────────────────────────────────────────────────

function escapeHtml(s) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function relativeTime(ts) {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 5)     return 'just now';
  if (s < 3600)  return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return new Date(ts).toLocaleDateString();
}

// ─── Theme ────────────────────────────────────────────────────────────────────

function applyTheme(dark) {
  document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
  const label = dark ? 'Switch to light mode' : 'Switch to dark mode';
  darkToggle.setAttribute('aria-label', label);
  darkToggle.title = label;
}

// ─── Render helpers ───────────────────────────────────────────────────────────

function renderStatus({ lastSyncTime, lastSyncCount, lastSyncError }) {
  lastSyncEl.textContent = lastSyncTime ? relativeTime(lastSyncTime) : 'Never';

  if (lastSyncTime != null) {
    taskCountRow.hidden = false;
    taskCountEl.textContent = lastSyncCount ?? 0;
  }

  if (lastSyncError) {
    errorMsgEl.textContent = `⚠️ ${lastSyncError}`;
    errorMsgEl.hidden = false;
  } else {
    errorMsgEl.hidden = true;
  }
}

function renderCourses(courses, enabledCourses) {
  if (!courses || courses.length === 0) return;
  const enabledCount = enabledCourses
    ? courses.filter(c => enabledCourses.includes(c.id)).length
    : courses.length;
  coursesHead.hidden = false;
  coursesBadge.textContent = enabledCount;
  coursesBadge.setAttribute('aria-label', `${enabledCount} course${enabledCount !== 1 ? 's' : ''}`);
  courseList.innerHTML = courses
    .map(c => {
      const active = !enabledCourses || enabledCourses.includes(c.id);
      return `
      <li class="course-item${active ? '' : ' course-item--disabled'}" aria-label="${escapeHtml(c.name)}${active ? '' : ' (disabled)'}">        <svg class="course-item__icon" width="15" height="15" viewBox="0 0 15 15" fill="none" aria-hidden="true" focusable="false">
          <rect x="1.5" y="1.5" width="5.5" height="12" rx="1" fill="currentColor" opacity="0.85"/>
          <rect x="7" y="1.5" width="6.5" height="12" rx="1" fill="currentColor" opacity="0.45"/>
          <path d="M7 1.5v12" stroke="white" stroke-width="0.75"/>
        </svg>
        <span class="course-item__name" title="${escapeHtml(c.name)}">${escapeHtml(c.name)}</span>
      </li>`;
    })
    .join('');
}

// ─── Progress animation ───────────────────────────────────────────────────────

let progressTimer = null;
const PROGRESS_MESSAGES = ['Connecting to Google…', 'Fetching courses…', 'Parsing announcements…', 'Creating tasks…'];

function startProgress() {
  let pct = 0;
  progressFill.style.width = '0%';
  progressText.textContent = PROGRESS_MESSAGES[0];
  progressWrap.hidden = false;

  progressTimer = setInterval(() => {
    pct = Math.min(pct + (Math.random() * 8 + 2), 88);
    progressFill.style.width = `${pct}%`;
    progressText.textContent = PROGRESS_MESSAGES[Math.min(Math.floor(pct / 25), 3)];
  }, 400);
}

function stopProgress(success = true) {
  clearInterval(progressTimer);
  progressFill.style.width = '100%';
  progressText.textContent = success ? 'Done!' : 'Failed.';
  setTimeout(() => {
    progressWrap.hidden = true;
    progressFill.style.width = '0%';
  }, 700);
}

// ─── Sync ─────────────────────────────────────────────────────────────────────

function doSync() {
  syncBtn.disabled = true;
  syncIcon.classList.add('spinning');
  syncLabel.textContent = 'Syncing…';
  syncBtn.setAttribute('aria-label', 'Syncing in progress…');
  errorMsgEl.hidden = true;
  startProgress();

  chrome.runtime.sendMessage({ action: 'syncNow' }, async (response) => {
    const runtimeErr = chrome.runtime.lastError;
    const success    = !runtimeErr && response?.success;
    stopProgress(success);

    syncBtn.disabled = false;
    syncIcon.classList.remove('spinning');
    syncLabel.textContent = 'Sync Now';
    syncBtn.setAttribute('aria-label', 'Sync Google Classroom now');

    if (runtimeErr || !response) {
      errorMsgEl.textContent = 'Background service unreachable — try reloading the extension.';
      errorMsgEl.hidden = false;
      return;
    }

    if (success) {
      lastSyncEl.textContent = 'just now';
      taskCountRow.hidden = false;
      taskCountEl.textContent = response.result.tasksCreated;

      if (response.result.errors?.length) {
        errorMsgEl.textContent = response.result.errors[0];
        errorMsgEl.hidden = false;
      }

      // Refresh courses panel from freshly-cached data
      const settings = await getSettings();
      renderCourses(settings.cachedCourses, settings.enabledCourses);
    } else {
      errorMsgEl.textContent = response.error || 'Sync failed. Check your Google account connection.';
      errorMsgEl.hidden = false;
    }
  });
}

// ─── Init ─────────────────────────────────────────────────────────────────────

async function init() {
  const settings = await getSettings();
  applyTheme(settings.darkMode);
  renderStatus(settings);
  renderCourses(settings.cachedCourses, settings.enabledCourses);
}

// ─── Events ───────────────────────────────────────────────────────────────────

function triggerRipple(e) {
  const rect   = syncBtn.getBoundingClientRect();
  const size   = Math.max(rect.width, rect.height);
  const x      = e.clientX - rect.left - size / 2;
  const y      = e.clientY - rect.top  - size / 2;
  const ripple = document.createElement('span');
  ripple.className = 'ripple';
  ripple.style.cssText = `width:${size}px;height:${size}px;left:${x}px;top:${y}px`;
  rippleContainer.appendChild(ripple);
  ripple.addEventListener('animationend', () => ripple.remove(), { once: true });
}

syncBtn.addEventListener('click', (e) => { triggerRipple(e); doSync(); });

darkToggle.addEventListener('click', async () => {
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  applyTheme(!isDark);
  await updateSettings({ darkMode: !isDark });
});

optionsBtn.addEventListener('click', () => chrome.runtime.openOptionsPage());

// ─── Boot ─────────────────────────────────────────────────────────────────────
init();
