// ClassroomSync Tasks - Sync Orchestrator
// Coordinates: auth → courses → announcements → parse → deduplicate → create tasks
// Used by both background.js (alarm-based) and popup.js (manual trigger).

import { getAuthToken, listCourses, listAnnouncements, getOrCreateTaskList, createTask } from './api.js';
import { isTaskRelated, extractDueDate, buildTaskTitle, announcementKey, detectPriority } from './parser.js';
import { getSettings, updateSettings, isCourseEnabled, isAlreadySynced, markAsSynced } from './storage.js';

/**
 * Runs a full sync cycle.
 *
 * @param {object}  opts
 * @param {boolean} opts.interactive - true when called from popup (allows sign-in prompt)
 * @returns {Promise<{ tasksCreated: number, coursesScanned: number, errors: string[] }>}
 */
export async function runSync({ interactive = false } = {}) {
  const settings = await getSettings();

  // ── 1. Authenticate ────────────────────────────────────────────────────────
  let token;
  try {
    token = await getAuthToken(interactive);
  } catch (err) {
    throw new Error(`Authentication failed: ${err.message}`);
  }

  // ── 2. Fetch courses ───────────────────────────────────────────────────────
  let courses;
  try {
    courses = await listCourses(token);
  } catch (err) {
    throw new Error(`Could not fetch courses: ${err.message}`);
  }

  // Cache course names/IDs so the popup can display them without re-fetching
  await updateSettings({
    cachedCourses: courses.map(c => ({ id: c.id, name: c.name })),
  });

  // ── 3. Ensure target task list exists ──────────────────────────────────────
  let taskListId;
  try {
    taskListId = await getOrCreateTaskList(token, settings.taskListName);
  } catch (err) {
    throw new Error(`Could not access task list: ${err.message}`);
  }

  // ── 4. Process each course ─────────────────────────────────────────────────
  const result = { tasksCreated: 0, coursesScanned: 0, errors: [] };

  for (const course of courses) {
    if (!await isCourseEnabled(course.id)) continue;
    result.coursesScanned++;

    let announcements;
    try {
      announcements = await listAnnouncements(course.id, token);
    } catch (err) {
      result.errors.push(`${course.name}: ${err.message}`);
      continue;
    }

    for (const ann of announcements) {
      const text = ann.text || '';
      if (!isTaskRelated(text)) continue;

      // Deduplicate by courseId + announcementId (stable identifiers)
      const key = announcementKey(course.id, ann.id);
      if (await isAlreadySynced(key)) continue;

      const title   = buildTaskTitle(text, course.name);
      const dueDate = extractDueDate(text);
      const link    = ann.alternateLink || '';

      // Build priority-aware notes
      const kwObj   = settings.priorityKeywords || {};
      const kwMap   = {
        high:   kwObj.high   ? kwObj.high.split(',').map(s => s.trim()).filter(Boolean)   : undefined,
        medium: kwObj.medium ? kwObj.medium.split(',').map(s => s.trim()).filter(Boolean) : undefined,
        low:    kwObj.low    ? kwObj.low.split(',').map(s => s.trim()).filter(Boolean)    : undefined,
      };
      const priority = detectPriority(text, (kwMap.high || kwMap.medium || kwMap.low) ? kwMap : undefined);
      const snippet  = text.length > 800 ? `${text.substring(0, 800)}…` : text;
      const notes    = `Priority: ${priority.charAt(0).toUpperCase() + priority.slice(1)}\n\n${snippet}\n\n${link}`.trim();

      try {
        await createTask(token, taskListId, { title, notes, dueDate });
        await markAsSynced(key);
        result.tasksCreated++;
      } catch (err) {
        result.errors.push(`Task "${title}": ${err.message}`);
      }
    }
  }

  return result;
}
