// ClassroomSync Tasks - Google API Layer
// All requests go directly to Google REST APIs using a Bearer token obtained
// via chrome.identity.  No external libraries or proxy servers required.

const CLASSROOM_BASE = 'https://classroom.googleapis.com/v1';
const TASKS_BASE     = 'https://tasks.googleapis.com/tasks/v1';
const LOOKBACK_MS    = 7 * 24 * 60 * 60 * 1000; // 7 days

// ─── Auth ─────────────────────────────────────────────────────────────────────

/**
 * Retrieves an OAuth2 access token from Chrome's identity cache.
 * Pass interactive=true when called from a popup/foreground context so Chrome
 * can show a consent screen if needed.
 * @param {boolean} interactive
 * @returns {Promise<string>}
 */
export function getAuthToken(interactive = false) {
  return new Promise((resolve, reject) => {
    chrome.identity.getAuthToken({ interactive }, (token) => {
      if (chrome.runtime.lastError) {
        const raw = chrome.runtime.lastError.message || '';
        // Normalize Chrome identity error strings so popup.js ERROR_MAP can match them
        let normalized;
        if (/not approved|did not approve|user cancel|cancelled the/i.test(raw)) {
          normalized = `cancelled: ${raw}`;
        } else if (/not granted|revoked|invalid credentials|invalid_client/i.test(raw)) {
          normalized = `AUTH_EXPIRED: ${raw}`;
        } else if (/could not be loaded|authorization page/i.test(raw)) {
          normalized = `network: ${raw}`;
        } else {
          normalized = raw;
        }
        reject(new Error(normalized));
      } else {
        resolve(token);
      }
    });
  });
}

/**
 * Removes the cached token so the next getAuthToken call forces a fresh grant.
 * @param {string} token
 */
export function removeCachedToken(token) {
  return new Promise(resolve => chrome.identity.removeCachedAuthToken({ token }, resolve));
}

// ─── Fetch Wrapper ────────────────────────────────────────────────────────────

/**
 * Authenticated fetch helper.  Throws on HTTP errors; for 401 it removes the
 * stale cached token before throwing so callers can retry with interactive=true.
 */
async function apiFetch(url, token, options = {}) {
  const res = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });

  if (res.status === 401) {
    await removeCachedToken(token);
    throw new Error('AUTH_EXPIRED: token revoked or expired. Re-authenticate.');
  }

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`HTTP ${res.status} from ${new URL(url).pathname}: ${body.substring(0, 300)}`);
  }

  return res.json();
}

// ─── Classroom API ────────────────────────────────────────────────────────────

/**
 * Lists all active courses for the authenticated user.
 * Handles pagination automatically.
 * @param {string} token
 * @returns {Promise<Array>}
 */
export async function listCourses(token) {
  const courses = [];
  let pageToken = '';
  do {
    const url = new URL(`${CLASSROOM_BASE}/courses`);
    url.searchParams.set('courseStates', 'ACTIVE');
    url.searchParams.set('pageSize', '50');
    if (pageToken) url.searchParams.set('pageToken', pageToken);

    const data = await apiFetch(url.href, token);
    courses.push(...(data.courses || []));
    pageToken = data.nextPageToken || '';
  } while (pageToken);
  return courses;
}

/**
 * Returns announcements for one course posted in the last 7 days.
 * Returns [] instead of throwing for 403/404 (student lacks access to older items).
 * @param {string} courseId
 * @param {string} token
 * @returns {Promise<Array>}
 */
export async function listAnnouncements(courseId, token) {
  const cutoff = new Date(Date.now() - LOOKBACK_MS).toISOString();
  const url = new URL(`${CLASSROOM_BASE}/courses/${encodeURIComponent(courseId)}/announcements`);
  url.searchParams.set('pageSize', '20');
  url.searchParams.set('orderBy', 'updateTime desc');

  try {
    const data = await apiFetch(url.href, token);
    const items = data.announcements || [];
    return items.filter(a => (a.updateTime || a.creationTime) >= cutoff);
  } catch (err) {
    // 403 = student has no announcement access; 404 = course gone — both are non-fatal
    if (/HTTP (403|404)/.test(err.message)) return [];
    throw err;
  }
}

// ─── Tasks API ────────────────────────────────────────────────────────────────

/**
 * Returns the ID of the named task list, creating it if it doesn't exist.
 * @param {string} token
 * @param {string} listName
 * @returns {Promise<string>} list ID
 */
export async function getOrCreateTaskList(token, listName = 'Classroom Tasks') {
  const data = await apiFetch(`${TASKS_BASE}/users/@me/lists?maxResults=100`, token);
  const existing = (data.items || []).find(l => l.title === listName);
  if (existing) return existing.id;

  const created = await apiFetch(`${TASKS_BASE}/users/@me/lists`, token, {
    method: 'POST',
    body: JSON.stringify({ title: listName }),
  });
  return created.id;
}

/**
 * Creates a single task in the specified list.
 * @param {string} token
 * @param {string} listId
 * @param {{ title: string, notes: string, dueDate: Date|null }} task
 */
export async function createTask(token, listId, { title, notes, dueDate }) {
  const body = { title, notes };

  if (dueDate instanceof Date && !isNaN(dueDate.getTime())) {
    // Tasks API requires due as RFC 3339 with time at midnight UTC
    const d = new Date(dueDate);
    d.setUTCHours(0, 0, 0, 0);
    body.due = d.toISOString();
  }

  return apiFetch(
    `${TASKS_BASE}/lists/${encodeURIComponent(listId)}/tasks`,
    token,
    { method: 'POST', body: JSON.stringify(body) },
  );
}
