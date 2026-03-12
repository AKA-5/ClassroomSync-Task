// ClassroomSync Tasks - Background Service Worker (Manifest V3)
// Responsibilities:
//   • Schedule a periodic alarm (every 30 min by default)
//   • Run silent background syncs when the alarm fires
//   • Handle messages from popup (syncNow, updateAlarm, getStatus)

import { runSync }                  from './utils/sync.js';
import { getSettings, updateSettings } from './utils/storage.js';

const ALARM_NAME = 'classroom-tasks-sync';

// ─── Lifecycle ────────────────────────────────────────────────────────────────

chrome.runtime.onInstalled.addListener(({ reason }) => {
  console.log(`[ClassroomSync] Installed — reason: ${reason}`);
  scheduleAlarm();
});

chrome.runtime.onStartup.addListener(() => {
  scheduleAlarm();
});

async function scheduleAlarm() {
  const { autoSync, syncInterval } = await getSettings();
  await chrome.alarms.clear(ALARM_NAME);
  if (autoSync) {
    const periodInMinutes = (syncInterval || 1800000) / 60000;
    chrome.alarms.create(ALARM_NAME, { periodInMinutes });
    console.log(`[ClassroomSync] Background alarm set (${periodInMinutes} min)`);
  }
}

// ─── Alarm Handler ────────────────────────────────────────────────────────────

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name !== ALARM_NAME) return;
  console.log('[ClassroomSync] Alarm fired — starting background sync');

  try {
    // interactive=false: no UI prompts in service worker context
    const result = await runSync({ interactive: false });
    await updateSettings({
      lastSyncTime:  Date.now(),
      lastSyncCount: result.tasksCreated,
      lastSyncError: result.errors.length ? result.errors[0] : null,
    });
    console.log(`[ClassroomSync] Sync done — ${result.tasksCreated} new task(s)`);
  } catch (err) {
    await updateSettings({ lastSyncError: err.message });
    console.warn('[ClassroomSync] Background sync error:', err.message);
  }
});

// ─── Message Handler (from popup / options) ───────────────────────────────────

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {

  // ── Manual sync triggered from popup ──────────────────────────────────────
  if (message.action === 'syncNow') {
    runSync({ interactive: true })
      .then(async (result) => {
        await updateSettings({
          lastSyncTime:  Date.now(),
          lastSyncCount: result.tasksCreated,
          lastSyncError: result.errors.length ? result.errors[0] : null,
        });
        sendResponse({ success: true, result });
      })
      .catch((err) => {
        updateSettings({ lastSyncError: err.message }).catch(() => {});
        sendResponse({ success: false, error: err.message });
      });
    return true; // keep message channel open for async response
  }

  // ── Re-schedule alarm (called when autoSync setting changes) ──────────────
  if (message.action === 'updateAlarm') {
    scheduleAlarm()
      .then(() => sendResponse({ success: true }))
      .catch((err) => sendResponse({ success: false, error: err.message }));
    return true;
  }

  // ── Status poll from popup ────────────────────────────────────────────────
  if (message.action === 'getStatus') {
    getSettings()
      .then((s) => sendResponse({
        lastSyncTime:  s.lastSyncTime,
        lastSyncCount: s.lastSyncCount,
        lastSyncError: s.lastSyncError,
        cachedCourses: s.cachedCourses,
        autoSync:      s.autoSync,
      }))
      .catch((err) => sendResponse({ error: err.message }));
    return true;
  }
});
