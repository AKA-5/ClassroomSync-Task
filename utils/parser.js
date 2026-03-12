// ClassroomSync Tasks - Announcement Parser
// Extracts task-related keywords, infers due dates, detects priority.
// Pure functions — no Chrome API dependencies.

// ─── Keyword Detection ────────────────────────────────────────────────────────

const TASK_KEYWORDS_RE = /\b(quiz|test|exam|assignment|homework|hw|project|essay|report|presentation|lab|reading|chapter|problem\s+set|pset|submit|turn\s+in|due|deadline|complete|finish|midterm|final)\b/i;

// Detects date-prefixed task phrasing even when no explicit task keyword is present.
// e.g. "Submit by Friday", "Reading for 3/25", "ends on March 20"
const STRONG_DATE_INDICATORS_RE = /\b(submit\s+by|turn\s+in\s+by|by\s+(?:tomorrow|today|tonight|monday|tuesday|wednesday|thursday|friday|saturday|sunday|next|this|\d)|due\s*:|ends?\s+(?:on\s+)?(?:\d{1,2}\/|\d{1,2}\s+(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)|today|tomorrow)|for\s+\d{1,2}\/\d{1,2})\b/i;

/**
 * Returns true if the announcement text contains task-related keywords OR
 * strong date-action phrases (e.g. "submit by Friday", "ends 04/20").
 * @param {string} text
 */
export function isTaskRelated(text) {
  return TASK_KEYWORDS_RE.test(text) || STRONG_DATE_INDICATORS_RE.test(text);
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

// Holidays to skip (month is 0-indexed)
const HOLIDAYS = [
  { month: 11, day: 25, name: 'Christmas'     },
  { month: 11, day: 31, name: 'New Year Eve'  },
  { month:  0, day:  1, name: 'New Year'      },
  { month:  6, day:  4, name: 'Independence Day' },
  { month: 10, day: 11, name: 'Veterans Day'  },
  { month: 10, day: 28, name: 'Thanksgiving approx' }, // approximate
];

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

function isHoliday(date) {
  return HOLIDAYS.some(h => h.month === date.getMonth() && h.day === date.getDate());
}

/**
 * Parsed date result with a confidence score (0–100).
 * @typedef {{ date: Date, confidence: number, source: string }} DateResult
 */

/**
 * Attempts to extract due date(s) from announcement text.
 * Returns an array of DateResult objects sorted by confidence descending.
 * @param {string} text
 * @returns {DateResult[]}
 */
export function extractDueDates(text) {
  const lower = text.toLowerCase();
  const results = [];

  // ── "today" / "tonight" (100 confidence)
  if (/\b(today|tonight)\b/.test(lower)) {
    results.push({ date: endOfDay(new Date()), confidence: 95, source: 'today' });
  }

  // ── "tomorrow" (100 confidence)
  if (/\btomorrow\b/.test(lower)) {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    results.push({ date: endOfDay(d), confidence: 98, source: 'tomorrow' });
  }

  // ── "by EOD" / "end of day" (high confidence, maps to today)
  if (/\b(eod|end of day|by close|cob)\b/.test(lower)) {
    results.push({ date: endOfDay(new Date()), confidence: 85, source: 'eod' });
  }

  // ── "COB tomorrow" / "EOD tomorrow"
  if (/\b(cob|eod)\s+tomorrow\b/.test(lower)) {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    results.push({ date: endOfDay(d), confidence: 88, source: 'eod-tomorrow' });
  }

  // ── "end of week" / "end of the week" → coming Friday
  if (/\bend\s+of\s+(?:the\s+)?week\b/.test(lower)) {
    results.push({ date: nextDayOfWeek(5, false), confidence: 75, source: 'end-of-week' });
  }

  // ── "in X days"
  const inDays = lower.match(/\bin\s+(\d+)\s+days?\b/);
  if (inDays) {
    const d = new Date();
    d.setDate(d.getDate() + parseInt(inDays[1], 10));
    results.push({ date: endOfDay(d), confidence: 90, source: 'in-n-days' });
  }

  // ── "in X weeks" / "X weeks from today"
  const inWeeks = lower.match(/\bin\s+(\d+)\s+weeks?\b|\b(\d+)\s+weeks?\s+from\s+(?:today|now)\b/);
  if (inWeeks) {
    const n = parseInt(inWeeks[1] || inWeeks[2], 10);
    const d = new Date();
    d.setDate(d.getDate() + n * 7);
    results.push({ date: endOfDay(d), confidence: 88, source: 'in-n-weeks' });
  }

  // ── "end of month"
  if (/\bend\s+of\s+(?:the\s+)?month\b/.test(lower)) {
    const d = new Date();
    d.setMonth(d.getMonth() + 1, 0); // last day of current month
    results.push({ date: endOfDay(d), confidence: 80, source: 'end-of-month' });
  }

  // ── "start of next month" / "beginning of next month"
  if (/\b(start|beginning)\s+of\s+next\s+month\b/.test(lower)) {
    const d = new Date();
    d.setMonth(d.getMonth() + 1, 1);
    results.push({ date: endOfDay(d), confidence: 78, source: 'start-of-next-month' });
  }

  // ── "next [weekday]" — forces next week's occurrence
  const nextDayRe = /\bnext\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday|mon|tue|wed|thu|fri|sat|sun)\b/g;
  let m;
  while ((m = nextDayRe.exec(lower)) !== null) {
    results.push({ date: nextDayOfWeek(WEEKDAY_MAP[m[1]], true), confidence: 88, source: `next-${m[1]}` });
  }

  // ── "(this) [weekday]" — soonest upcoming occurrence
  const thisDayRe = /\b(?:this\s+)?(monday|tuesday|wednesday|thursday|friday|saturday|sunday|mon|tue|wed|thu|fri|sat|sun)\b/g;
  while ((m = thisDayRe.exec(lower)) !== null) {
    // Skip if already captured as "next weekday"
    const alreadyCaptured = results.some(r => r.source === `next-${m[1]}`);
    if (!alreadyCaptured) {
      results.push({ date: nextDayOfWeek(WEEKDAY_MAP[m[1]], false), confidence: 80, source: `this-${m[1]}` });
    }
  }

  // ── "Month DD" or "Month DDth, YYYY"
  const monthDayRe = /\b(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|oct|nov|dec)\s+(\d{1,2})(?:st|nd|rd|th)?(?:,?\s*(\d{4}))?\b/g;
  while ((m = monthDayRe.exec(lower)) !== null) {
    const month = MONTH_MAP[m[1]];
    const day   = parseInt(m[2], 10);
    const now   = new Date();
    const year  = m[3] ? parseInt(m[3], 10) : now.getFullYear();
    const candidate = new Date(year, month, day, 23, 59, 0);
    if (!isNaN(candidate.getTime()) && day >= 1 && day <= 31) {
      if (!m[3] && candidate < now) candidate.setFullYear(candidate.getFullYear() + 1);
      results.push({ date: candidate, confidence: m[3] ? 95 : 85, source: 'month-day' });
    }
  }

  // ── "MM/DD" or "MM/DD/YY" or "MM/DD/YYYY"
  const numDateRe = /\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/g;
  while ((m = numDateRe.exec(text)) !== null) {
    const mo = parseInt(m[1], 10) - 1;
    const dy = parseInt(m[2], 10);
    let yr   = m[3] ? parseInt(m[3], 10) : new Date().getFullYear();
    if (m[3] && m[3].length === 2) yr += 2000;
    const candidate = new Date(yr, mo, dy, 23, 59, 0);
    if (!isNaN(candidate.getTime()) && mo >= 0 && mo < 12 && dy >= 1 && dy <= 31) {
      if (!m[3] && candidate < new Date()) candidate.setFullYear(candidate.getFullYear() + 1);
      results.push({ date: candidate, confidence: m[3] ? 92 : 82, source: 'numeric-date' });
    }
  }

  // Deduplicate results that resolve to the same calendar date
  const seen = new Set();
  const unique = results.filter(r => {
    const key = r.date.toDateString();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return unique.sort((a, b) => b.confidence - a.confidence);
}

/**
 * Attempts to extract a single best-guess due date from announcement text.
 * Returns a Date at 23:59 on the detected day, or null.
 * Falls back to null if top confidence < 60 (manual entry recommended).
 * @param {string} text
 * @returns {Date|null}
 */
export function extractDueDate(text) {
  const results = extractDueDates(text);
  if (!results.length || results[0].confidence < 60) return null;
  const best = results[0];
  return isHoliday(best.date) ? null : best.date;
}

// ─── Priority Detection ───────────────────────────────────────────────────────

const DEFAULT_PRIORITY_KEYWORDS = {
  high:   ['exam', 'final', 'midterm', 'deadline', 'due tomorrow', 'urgent', 'critical', 'last chance'],
  medium: ['quiz', 'assignment', 'homework', 'hw', 'project', 'essay', 'report', 'presentation'],
  low:    ['reading', 'optional', 'suggested', 'chapter', 'lecture', 'review', 'practice'],
};

/**
 * Detects the priority level of an announcement.
 * @param {string} text
 * @param {{ high: string[], medium: string[], low: string[] }} [customKeywords]
 * @returns {'high'|'medium'|'low'}
 */
export function detectPriority(text, customKeywords) {
  const lower = text.toLowerCase();
  const kw    = customKeywords || DEFAULT_PRIORITY_KEYWORDS;

  // Also treat near-future dates as high priority
  const dates = extractDueDates(text);
  if (dates.length) {
    const daysUntil = (dates[0].date - Date.now()) / 86_400_000;
    if (daysUntil <= 1) return 'high';
    if (daysUntil <= 3 && kw.high.some(k => lower.includes(k))) return 'high';
  }

  if (kw.high.some(k => lower.includes(k)))   return 'high';
  if (kw.medium.some(k => lower.includes(k))) return 'medium';
  if (kw.low.some(k => lower.includes(k)))    return 'low';
  return 'medium'; // default
}

// ─── Title Building ───────────────────────────────────────────────────────────

/**
 * Strips date, time, and weekday phrases from a title fragment.
 * Produces cleaner task titles like "Quiz on chapters 3-4" instead of
 * "Quiz next Tuesday on chapters 3-4".
 */
function stripDatePhrases(s) {
  return s
    // "next/this weekday"
    .replace(/\bnext\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday|mon|tue|wed|thu|fri|sat|sun)\b/gi, '')
    .replace(/\bthis\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday|mon|tue|wed|thu|fri|sat|sun)\b/gi, '')
    // standalone weekday names
    .replace(/\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/gi, '')
    // today / tomorrow / tonight
    .replace(/\b(today|tonight|tomorrow)\b/gi, '')
    // "Month DDth[, YYYY]"
    .replace(/\b(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|oct|nov|dec)\s+\d{1,2}(?:st|nd|rd|th)?(?:,?\s*\d{4})?\b/gi, '')
    // MM/DD[/YYYY]
    .replace(/\b\d{1,2}\/\d{1,2}(?:\/\d{2,4})?\b/g, '')
    // time e.g. "at 5pm", "by 11:59am"
    .replace(/\bat\s+\d{1,2}(?::\d{2})?\s*(?:am|pm)\b/gi, '')
    // trailing prepositions left after date removal
    .replace(/\b(by|for|on|at|before|until)\s*$/i, '')
    // clean up loose punctuation and extra whitespace
    .replace(/\s*[-–—,;:]\s*/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Builds a human-readable task title from announcement text and course name.
 * Date/time phrases are stripped from the extracted fragment for clean titles.
 * e.g. "Quiz next Tuesday on chapters 3-4" → "[Math] Quiz on chapters 3-4"
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
    const stripped = stripDatePhrases(fragment);
    // Use stripped version only if it remains meaningful (> 4 chars)
    const titleFrag = stripped.length > 4 ? stripped : fragment;
    return `[${courseName}] ${capitalise(titleFrag)}`.substring(0, 100);
  }

  // Fall back to first sentence / line, stripping date noise
  const firstLine = clean.split(/[.!\n]/)[0].trim();
  const stripped  = stripDatePhrases(firstLine);
  const snippet   = stripped.length > 4 ? stripped : firstLine;
  const truncated = snippet.length > 70 ? `${snippet.substring(0, 67)}…` : snippet;
  return `[${courseName}] ${truncated}`.substring(0, 100);
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
