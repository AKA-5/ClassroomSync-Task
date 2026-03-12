// ClassroomSync Tasks - Announcement Parser
// Extracts task-related keywords and infers due dates from announcement text.
// Pure functions — no Chrome API dependencies.

// ─── Keyword Detection ────────────────────────────────────────────────────────

const TASK_KEYWORDS_RE = /\b(quiz|test|exam|assignment|homework|hw|project|essay|report|presentation|lab|reading|chapter|problem\s+set|pset|submit|turn\s+in|due|deadline|complete|finish)\b/i;

/**
 * Returns true if the announcement text contains any task-related keywords.
 * @param {string} text
 */
export function isTaskRelated(text) {
  return TASK_KEYWORDS_RE.test(text);
}

// ─── Date Parsing ─────────────────────────────────────────────────────────────

const WEEKDAY_MAP = {
  sunday: 0, monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6,
  sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6,
};

const MONTH_MAP = {
  january: 0, february: 1, march: 2, april: 3, may: 4, june: 5,
  july: 6, august: 7, september: 8, october: 9, november: 10, december: 11,
  jan: 0, feb: 1, mar: 2, apr: 3, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
};

function endOfDay(date) {
  const d = new Date(date);
  d.setHours(23, 59, 0, 0);
  return d;
}

function nextDayOfWeek(dayIndex, forceNextWeek = false) {
  const today = new Date();
  const diff = dayIndex - today.getDay();
  const daysAhead = (diff <= 0 || forceNextWeek) ? diff + 7 : diff;
  const result = new Date(today);
  result.setDate(today.getDate() + daysAhead);
  return endOfDay(result);
}

/**
 * Attempts to extract a due date from announcement text.
 * Returns a Date object at 23:59 on the detected day, or null.
 * @param {string} text
 * @returns {Date|null}
 */
export function extractDueDate(text) {
  const lower = text.toLowerCase();

  // "today" / "tonight"
  if (/\b(today|tonight)\b/.test(lower)) return endOfDay(new Date());

  // "tomorrow"
  if (/\btomorrow\b/.test(lower)) {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return endOfDay(d);
  }

  // "in X days"
  const inDays = lower.match(/\bin\s+(\d+)\s+days?\b/);
  if (inDays) {
    const d = new Date();
    d.setDate(d.getDate() + parseInt(inDays[1], 10));
    return endOfDay(d);
  }

  // "next [weekday]" — forces next week's occurrence
  const nextDayRe = /\bnext\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday|mon|tue|wed|thu|fri|sat|sun)\b/;
  const nextDayMatch = lower.match(nextDayRe);
  if (nextDayMatch) return nextDayOfWeek(WEEKDAY_MAP[nextDayMatch[1]], true);

  // "(this) [weekday]" — soonest upcoming occurrence
  const thisDayRe = /\b(?:this\s+)?(monday|tuesday|wednesday|thursday|friday|saturday|sunday|mon|tue|wed|thu|fri|sat|sun)\b/;
  const thisDayMatch = lower.match(thisDayRe);
  if (thisDayMatch) return nextDayOfWeek(WEEKDAY_MAP[thisDayMatch[1]], false);

  // "Month DD" or "Month DDth, YYYY"
  const monthDayRe = /\b(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|oct|nov|dec)\s+(\d{1,2})(?:st|nd|rd|th)?(?:,?\s*(\d{4}))?\b/;
  const mdMatch = lower.match(monthDayRe);
  if (mdMatch) {
    const month = MONTH_MAP[mdMatch[1]];
    const day = parseInt(mdMatch[2], 10);
    const now = new Date();
    const year = mdMatch[3] ? parseInt(mdMatch[3], 10) : now.getFullYear();
    const candidate = new Date(year, month, day, 23, 59, 0);
    if (!isNaN(candidate.getTime())) {
      // If no year given and date already passed, assume next year
      if (!mdMatch[3] && candidate < now) candidate.setFullYear(candidate.getFullYear() + 1);
      return candidate;
    }
  }

  // "MM/DD" or "MM/DD/YY" or "MM/DD/YYYY"
  const numDateRe = /\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/;
  const numMatch = text.match(numDateRe);
  if (numMatch) {
    const m = parseInt(numMatch[1], 10) - 1;
    const d = parseInt(numMatch[2], 10);
    let y = numMatch[3] ? parseInt(numMatch[3], 10) : new Date().getFullYear();
    if (numMatch[3] && numMatch[3].length === 2) y += 2000;
    const candidate = new Date(y, m, d, 23, 59, 0);
    if (!isNaN(candidate.getTime()) && m >= 0 && m < 12 && d >= 1 && d <= 31) {
      if (!numMatch[3] && candidate < new Date()) candidate.setFullYear(candidate.getFullYear() + 1);
      return candidate;
    }
  }

  return null;
}

// ─── Title Building ───────────────────────────────────────────────────────────

/**
 * Builds a human-readable task title from announcement text and course name.
 * @param {string} text  - Raw announcement text
 * @param {string} courseName
 * @returns {string}
 */
export function buildTaskTitle(text, courseName) {
  const clean = text.replace(/\s+/g, ' ').trim();

  // Try extracting a keyword + surrounding context
  const kwMatch = clean.match(/\b(quiz|test|exam|assignment|homework|project|essay|report|reading|lab|chapter|problem\s+set)\b[^.!?\n]{0,70}/i);
  if (kwMatch) {
    const fragment = kwMatch[0].trim().replace(/[,;:]$/, '');
    return `[${courseName}] ${capitalise(fragment)}`.substring(0, 100);
  }

  // Fall back to first sentence / line
  const firstLine = clean.split(/[.!\n]/)[0].trim();
  const snippet = firstLine.length > 70 ? `${firstLine.substring(0, 67)}…` : firstLine;
  return `[${courseName}] ${snippet}`.substring(0, 100);
}

function capitalise(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// ─── Duplicate Key ────────────────────────────────────────────────────────────

/**
 * Generates a stable storage key for deduplication.
 * Using courseId + announcementId is reliable since both are permanent IDs.
 * @param {string} courseId
 * @param {string} announcementId
 */
export function announcementKey(courseId, announcementId) {
  return `cs_${courseId}_${announcementId}`;
}
