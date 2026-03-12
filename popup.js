// ClassroomSync Tasks - Popup Controller
// State machine: checking â†’ unauthenticated | ready | empty | syncing

import { getSettings, updateSettings, isFirstRun, markFirstRunDone } from './utils/storage.js';

// â”€â”€â”€ Constants â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const SYNC_TIMEOUT_MS = 30_000;  // 30-second hang guard
const TOAST_DURATION  = 3_500;   // ms before toast auto-hides
// â”€â”€â”€ Friendly error map â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const ERROR_MAP = [
  { re: /invalid_client|client.*not.*found/i,
    msg: "Couldn't connect to Google. Please try again or check your internet connection." },
  { re: /rate.?limit|quota.*exceeded|429/i,
    msg: 'Taking a short break to avoid hitting Google\u2019s limits. Auto-retry in 5 minutes.' },
  { re: /network|fetch.*failed|failed to fetch/i,
    msg: 'No internet connection. Syncing will resume when you\u2019re back online.' },
  { re: /HTTP 403|forbidden/i,
    msg: 'Need permission to access your Classroom. Please reconnect your account.' },
  { re: /AUTH_EXPIRED/i,
    msg: 'Your Google session expired. Click Sync Now to reconnect.' },
  { re: /not.*authenticated|not signed|no.*account/i,
    msg: 'Please connect your Google account first.' },
  { re: /HTTP 404/i,
    msg: 'A resource wasn\u2019t found \u2014 it may have been removed from Classroom.' },
  { re: /HTTP 5\d\d/i,
    msg: 'Google\u2019s servers had an issue. Please try again in a moment.' },
  { re: /cancelled|user.*cancelled|denied/i,
    msg: 'Sign-in was cancelled. Click Sync Now whenever you\u2019re ready.' },
];

function friendlyError(raw) {
  if (!raw) return 'An unexpected error occurred. Please try again.';
  for (const { re, msg } of ERROR_MAP) {
    if (re.test(raw)) return msg;
  }
  return raw;
}

// â”€â”€â”€ DOM refs â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const toastEl         = document.getElementById('toast');
const authPrompt      = document.getElementById('authPrompt');
const statusCard      = document.getElementById('statusCard');
const lastSyncEl      = document.getElementById('lastSyncTime');
const taskCountRow    = document.getElementById('taskCountRow');
const taskCountEl     = document.getElementById('lastSyncCount');
const errorMsgEl      = document.getElementById('errorMsg');
const syncBtn         = document.getElementById('syncBtn');
const syncIconSvg     = syncBtn.querySelector('.sync-icon-svg');
const syncLabel       = syncBtn.querySelector('.sync-btn__label');
const rippleCont      = syncBtn.querySelector('.ripple-container');
const progressWrap    = document.getElementById('progressWrap');
const progressFill    = document.getElementById('progressFill');
const progressTextEl  = document.getElementById('progressTextContent');
const noCoursesMsg    = document.getElementById('noCoursesMsg');
const coursesHead     = document.getElementById('coursesHead');
const coursesBadge    = document.getElementById('coursesBadge');
const courseList      = document.getElementById('courseList');
const darkToggle      = document.getElementById('darkModeToggle');
const optionsBtn      = document.getElementById('optionsBtn');
const nextSyncRow     = document.getElementById('nextSyncRow');
const nextSyncTimeEl  = document.getElementById('nextSyncTime');

// â”€â”€â”€ Runtime state â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

let currentState = 'checking';  // checking | unauthenticated | ready | empty | syncing
let syncTimeout  = null;
let toastTimer   = null;
let wasFirstRun  = false;
let countdownInterval = null;

// ─── Next-sync countdown ───────────────────────────────────────────────────────────

const ALARM_NAME = 'classroom-tasks-sync';

function stopNextSyncCountdown() {
  clearInterval(countdownInterval);
  countdownInterval = null;
  nextSyncRow.hidden = true;
}

function startNextSyncCountdown() {
  stopNextSyncCountdown();
  chrome.alarms.get(ALARM_NAME, (alarm) => {
    if (!alarm) return;
    nextSyncRow.hidden = false;
    function tick() {
      const ms = alarm.scheduledTime - Date.now();
      if (ms <= 0) {
        nextSyncTimeEl.textContent = 'soon…';
        return;
      }
      const totalSecs = Math.floor(ms / 1000);
      const mins = Math.floor(totalSecs / 60);
      const secs = totalSecs % 60;
      nextSyncTimeEl.textContent =
        `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    }
    tick();
    countdownInterval = setInterval(tick, 1000);
  });
}

// â”€â”€â”€ Helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function escapeHtml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function relativeTime(ts) {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 5)     return 'just now';
  if (s < 3600)  return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return new Date(ts).toLocaleDateString();
}

function applyTheme(dark) {
  document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
  document.body.classList.toggle('dark-mode', !!dark);
  const label = dark ? 'Switch to light mode' : 'Switch to dark mode';
  darkToggle.setAttribute('aria-label', label);
  darkToggle.title = label;
}

/** Non-interactive auth probe â€” never shows a sign-in prompt. */
function isAuthenticated() {
  return new Promise(resolve => {
    chrome.identity.getAuthToken({ interactive: false }, token => {
      const _consume = chrome.runtime.lastError; // must consume to avoid console warning
      resolve(!!token);
    });
  });
}

// â”€â”€â”€ Toast â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function showToast(msg, type = 'success') {
  clearTimeout(toastTimer);
  toastEl.textContent = msg;
  toastEl.className = `toast toast--${type}`;
  toastEl.hidden = false;
  toastTimer = setTimeout(() => {
    toastEl.classList.add('toast--fade');
    setTimeout(() => { toastEl.hidden = true; toastEl.classList.remove('toast--fade'); }, 350);
  }, TOAST_DURATION);
}

// â”€â”€â”€ Progress bar (sync-only) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const PROGRESS_STEPS = [
  'Connecting to Google\u2026',
  'Fetching courses\u2026',
  'Parsing announcements\u2026',
  'Creating tasks\u2026',
];
let progressInterval = null;

function startProgress() {
  let pct = 0;
  progressFill.style.width = '0%';
  progressTextEl.textContent = PROGRESS_STEPS[0];
  progressWrap.hidden = false;
  progressInterval = setInterval(() => {
    pct = Math.min(pct + (Math.random() * 8 + 2), 88);
    progressFill.style.width = `${pct}%`;
    progressTextEl.textContent = PROGRESS_STEPS[Math.min(Math.floor(pct / 25), PROGRESS_STEPS.length - 1)];
    progressFill.setAttribute('aria-valuenow', Math.floor(pct));
  }, 400);
}

function stopProgress(success = true) {
  clearInterval(progressInterval);
  progressFill.style.width = '100%';
  progressFill.setAttribute('aria-valuenow', 100);
  progressTextEl.textContent = success ? 'Done!' : 'Failed.';
  setTimeout(() => { progressWrap.hidden = true; }, 700);
}

// â”€â”€â”€ UI State Machine â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
//
//  States:
//    checking        â€” briefly before auth probe resolves (cached data visible)
//    unauthenticated â€” no Google session; button says "Connect & Sync"
//    empty           â€” signed in but no courses yet; shows empty-state prompt
//    ready           â€” signed in + courses loaded; normal operation
//    syncing         â€” request in flight; button disabled + progress bar visible

function setUIState(state) {
  currentState = state;
  const syncing = (state === 'syncing');
  const authed  = (state !== 'unauthenticated');

  // â€” Sync button
  syncBtn.disabled = syncing;
  syncIconSvg.classList.toggle('spinning', syncing);
  syncLabel.textContent = syncing ? 'Syncing\u2026'
    : authed ? 'Sync Now'
    : 'Connect & Sync';
  syncBtn.setAttribute('aria-label',
    syncing ? 'Sync in progress \u2014 please wait'
    : authed ? 'Sync Google Classroom now'
    :          'Connect your Google account and sync'
  );

  // â€” Progress: ONLY visible during an active sync operation
  if (!syncing) progressWrap.hidden = true;

  // – Auth connection prompt: only visible on first run, not on every re-auth
  authPrompt.hidden = authed || !wasFirstRun;

  // – Status card (always visible — shows last-sync context)
  statusCard.hidden = false;

  // – No-courses empty state: hide if courses are already rendered
  noCoursesMsg.hidden = (state !== 'empty') || courseList.children.length > 0;

  // â€” Courses section: cleared when unauthenticated or empty
  if (state === 'unauthenticated' || state === 'empty') {
    coursesHead.hidden = true;
    courseList.innerHTML = '';
  }
}

// â”€â”€â”€ Render helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function renderStatusCard({ lastSyncTime, lastSyncCount, lastSyncError }) {
  lastSyncEl.textContent = lastSyncTime ? relativeTime(lastSyncTime) : 'Never';
  if (lastSyncTime != null) {
    taskCountRow.hidden = false;
    taskCountEl.textContent = lastSyncCount ?? 0;
  }
  if (lastSyncError) {
    errorMsgEl.textContent = friendlyError(lastSyncError);
    errorMsgEl.hidden = false;
  } else {
    errorMsgEl.hidden = true;
  }
}

function renderCourses(courses, enabledCourses) {
  if (!courses?.length) return;
  const enabledCount = enabledCourses
    ? courses.filter(c => enabledCourses.includes(c.id)).length
    : courses.length;
  coursesHead.hidden = false;
  coursesBadge.textContent = enabledCount;
  coursesBadge.setAttribute('aria-label', `${enabledCount} course${enabledCount !== 1 ? 's' : ''}`);
  courseList.innerHTML = courses.map(c => {
    const active = !enabledCourses || enabledCourses.includes(c.id);
    return `
      <li class="course-item${active ? '' : ' course-item--disabled'}" aria-label="${escapeHtml(c.name)}${active ? '' : ' (disabled)'}">
        <svg class="course-item__icon" width="15" height="15" viewBox="0 0 15 15" fill="none" aria-hidden="true" focusable="false">
          <rect x="1.5" y="1.5" width="5.5" height="12" rx="1" fill="currentColor" opacity="0.85"/>
          <rect x="7" y="1.5" width="6.5" height="12" rx="1" fill="currentColor" opacity="0.45"/>
          <path d="M7 1.5v12" stroke="white" stroke-width="0.75"/>
        </svg>
        <span class="course-item__name" title="${escapeHtml(c.name)}">${escapeHtml(c.name)}</span>
      </li>`;
  }).join('');
}

// â”€â”€â”€ Sync â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function doSync() {
  stopNextSyncCountdown();
  const returnState = currentState;  // remember where to return after sync
  setUIState('syncing');
  errorMsgEl.hidden = true;
  startProgress();

  // 30-second hang guard
  syncTimeout = setTimeout(() => {
    clearInterval(progressInterval);
    stopProgress(false);
    setUIState(returnState !== 'syncing' ? returnState : 'ready');
    errorMsgEl.textContent = 'Sync is taking too long. Please try again in a moment.';
    errorMsgEl.hidden = false;
  }, SYNC_TIMEOUT_MS);

  chrome.runtime.sendMessage({ action: 'syncNow' }, async response => {
    clearTimeout(syncTimeout);
    const runtimeErr = chrome.runtime.lastError;
    const success    = !runtimeErr && response?.success;
    stopProgress(success);

    if (runtimeErr || !response) {
      setUIState(returnState !== 'syncing' ? returnState : 'ready');
      errorMsgEl.textContent = 'Background service unreachable \u2014 try reloading the extension.';
      errorMsgEl.hidden = false;
      return;
    }

    const settings   = await getSettings();
    const hasCourses = settings.cachedCourses?.length > 0;

    if (success) {
      // First-run: show welcome toast then clear the flag
      if (wasFirstRun) {
        await markFirstRunDone();
        wasFirstRun = false;
        showToast('Google Account connected. Ready to sync.');
      }

      lastSyncEl.textContent  = 'just now';
      taskCountRow.hidden     = false;
      taskCountEl.textContent = response.result.tasksCreated;
      errorMsgEl.hidden       = true;

      setUIState(hasCourses ? 'ready' : 'empty');
      if (hasCourses) renderCourses(settings.cachedCourses, settings.enabledCourses);
      if (settings.autoSync) startNextSyncCountdown();

      if (response.result.errors?.length) {
        errorMsgEl.textContent = friendlyError(response.result.errors[0]);
        errorMsgEl.hidden = false;
      }
    } else {
      const isAuthErr = /AUTH_EXPIRED|denied|cancelled/i.test(response.error || '');
      setUIState(isAuthErr ? 'unauthenticated' : hasCourses ? 'ready' : 'empty');
      errorMsgEl.textContent = friendlyError(response.error || 'Sync failed.');
      errorMsgEl.hidden = false;
    }
  });
}

// â”€â”€â”€ Ripple effect â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function triggerRipple(e) {
  const rect   = syncBtn.getBoundingClientRect();
  const size   = Math.max(rect.width, rect.height);
  const x      = e.clientX - rect.left - size / 2;
  const y      = e.clientY - rect.top  - size / 2;
  const ripple = document.createElement('span');
  ripple.className = 'ripple';
  ripple.style.cssText = `width:${size}px;height:${size}px;left:${x}px;top:${y}px`;
  rippleCont.appendChild(ripple);
  ripple.addEventListener('animationend', () => ripple.remove(), { once: true });
}

// â”€â”€â”€ Events â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

syncBtn.addEventListener('click', e => { triggerRipple(e); doSync(); });

darkToggle.addEventListener('click', async () => {
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  applyTheme(!isDark);
  await updateSettings({ darkMode: !isDark });
});

optionsBtn.addEventListener('click', () => chrome.runtime.openOptionsPage());

// â”€â”€â”€ Init â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

async function init() {
  // Phase 1 â€” render cached data immediately (fast startup, no blank-state flash)
  const settings = await getSettings();
  applyTheme(settings.darkMode);
  renderStatusCard(settings);

  // Explicitly hide progress bar â€” fixes "Connectingâ€¦" showing at idle on popup open
  progressWrap.hidden = true;

  if (settings.cachedCourses?.length > 0) {
    renderCourses(settings.cachedCourses, settings.enabledCourses);
  }

  // Phase 2 â€” async checks; state corrects once results arrive
  const [firstRun, authed] = await Promise.all([isFirstRun(), isAuthenticated()]);
  wasFirstRun = firstRun;

  if (!authed) {
    setUIState('unauthenticated');
    stopNextSyncCountdown();
  } else {
    setUIState(settings.cachedCourses?.length > 0 ? 'ready' : 'empty');
    if (settings.autoSync) startNextSyncCountdown();
  }
}

// â”€â”€â”€ Boot â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
init();
