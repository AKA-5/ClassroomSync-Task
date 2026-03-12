# ClassroomSync Tasks — Architecture

> **Single source of truth** for tech decisions, data flow, and key constraints.
> Update this file whenever a structural change is made to the extension.

---

## Tech Stack

| Layer | Technology | Notes |
|---|---|---|
| Extension Runtime | Chrome Manifest V3 | Service worker background, ES modules |
| Authentication | `chrome.identity.getAuthToken` | OAuth2, no server required |
| Classroom Data | Google Classroom API v1 | `courses.readonly`, `announcements.readonly` |
| Task Creation | Google Tasks API v1 | `tasks` scope |
| Parsing | Vanilla JS RegExp | No NLP library dependency |
| Storage | `chrome.storage.sync` + `.local` | Sync = settings; Local = dedup history |
| UI | Vanilla HTML/CSS/JS (no framework) | ES module scripts |
| Dev Tooling | VS Code + GitHub | No build step needed |

---

## Project Structure

```
ClassroomSync-Task/
├── manifest.json          # MV3 manifest — permissions, oauth2, background
├── background.js          # Service worker: alarm scheduling + message routing
├── popup.html/js/css      # Browser-action popup (340 px wide)
├── options.html/js/css    # Full settings page
├── utils/
│   ├── api.js             # Raw Google API calls (auth, Classroom, Tasks)
│   ├── parser.js          # Keyword detection + date inference
│   ├── storage.js         # chrome.storage wrappers + dedup helpers
│   └── sync.js            # Orchestrates a full sync cycle
└── icons/
    ├── icon.svg           # Source SVG
    ├── generate-icons.html # Browser-based PNG generator (open + download)
    ├── icon16.png  }
    ├── icon48.png  }      # Generated from generate-icons.html
    └── icon128.png }
```

---

## Data Flow

```
User opens popup
   │
   ▼
[popup.js] reads chrome.storage → renders cached courses + last-sync status
   │
   │  click "Sync Now"
   ▼
chrome.runtime.sendMessage({ action:'syncNow' })
   │
   ▼
[background.js] receives message → calls runSync({ interactive: true })
   │
   ▼
[utils/sync.js] runSync()
   ├─ getAuthToken(interactive)        via chrome.identity
   ├─ listCourses(token)               GET /v1/courses
   ├─ updateSettings({ cachedCourses }) → persists for popup display
   ├─ getOrCreateTaskList(token, name) GET/POST /tasks/v1/.../lists
   └─ for each enabled course:
         listAnnouncements(courseId)   GET /v1/courses/:id/announcements
         │
         for each announcement:
           isTaskRelated(text)         keyword regex
           extractDueDate(text)        date pattern matching
           isAlreadySynced(key)        chrome.storage.local check
           createTask(token, ...)      POST /tasks/v1/lists/:id/tasks
           markAsSynced(key)           writes to chrome.storage.local
   │
   ▼
sendResponse({ success, result }) → popup renders result

Background alarm (every 30 min)
   └─ Same flow as above, interactive=false (no UI prompts)
```

---

## Key Files — Responsibilities

### `background.js`
- Registers `chrome.alarms` listener on install/startup
- Routes three message types: `syncNow`, `updateAlarm`, `getStatus`
- Writes sync results to `chrome.storage.sync` for popup display

### `utils/api.js`
- `getAuthToken(interactive)` — wraps `chrome.identity.getAuthToken`
- `listCourses(token)` — paginated, ACTIVE courses only
- `listAnnouncements(courseId, token)` — last 7 days, non-fatal 403/404
- `getOrCreateTaskList(token, name)` — idempotent
- `createTask(token, listId, {title, notes, dueDate})` — RFC 3339 due date

### `utils/parser.js`
- `isTaskRelated(text)` — keyword regex (quiz, test, exam, assignment…)
- `extractDueDate(text)` — handles: today/tomorrow/weekdays/in N days/Month DD/MM-DD
- `buildTaskTitle(text, courseName)` — `[Course] Keyword fragment…` format
- `announcementKey(courseId, annId)` — stable dedup key

### `utils/storage.js`
- `getSettings()` / `updateSettings()` — `chrome.storage.sync` with defaults
- `isAlreadySynced(key)` / `markAsSynced(key)` — `chrome.storage.local`, pruned at 90 days

### `utils/sync.js`
- Single exported `runSync({ interactive })` function consumed by background and popup

---

## API Constraints & Quotas

| API | Free Quota | Strategy |
|---|---|---|
| Classroom API | 500 req/100s per user | Max 50 courses × 20 announcements = 50+ req/sync; well within limit |
| Tasks API | 50,000 req/day | One `createTask` per new announcement; minimal usage |
| `chrome.storage.sync` | 100 KB total | Settings only; history in `.local` (~10 MB) |

---

## OAuth2 Scopes

```
https://www.googleapis.com/auth/classroom.courses.readonly
https://www.googleapis.com/auth/classroom.announcements.readonly
https://www.googleapis.com/auth/tasks
```

> Principle of least privilege — read-only for Classroom, write only for Tasks.

---

## Security Notes

- No external servers; all traffic goes directly `extension → Google APIs`
- OAuth token handled by Chrome (`chrome.identity`) — never stored manually
- All user-controlled strings are HTML-escaped before insertion into DOM
- `rel="noopener noreferrer"` on all external links
- MV3 default CSP (`script-src 'self'`) enforced — no `eval`, no inline scripts

---

## Changelog

| Version | Date | Notes |
|---|---|---|
| 1.0.0 | 2026-03-12 | Initial build — full sync pipeline, popup, options page |
