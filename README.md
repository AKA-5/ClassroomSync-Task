# ClassroomSync Tasks

Automatically converts Google Classroom announcements into Google Tasks — with due dates, priority levels, and clean task titles extracted from announcement text.

## Features

**Intelligent task creation**
Each qualifying announcement is turned into a Google Task with a clean, context-aware title (e.g. `[Math 101] Quiz on chapters 3–4`), a due date inferred from the text, and a priority level. The full announcement text and a link back to Classroom are included in the task notes.

**Natural language date parsing**
The extension understands a wide range of deadline phrasings found in real announcements:
- Day names: "due Friday", "this Monday", "next Wednesday"
- Relative: "tomorrow", "tonight", "in 3 days", "in 2 weeks", "end of week", "end of month"
- Absolute: "March 15", "March 15th, 2026", "3/15", "3/15/26"
- Shorthand: "by EOD", "by COB", "submit by close"

**Automatic priority detection**
Tasks are tagged High, Medium, or Low in their notes based on keywords found in the announcement:
- High — exam, final, midterm, deadline, urgent, due tomorrow
- Medium — quiz, assignment, homework, project, essay, report
- Low — reading, optional, suggested, chapter, lecture

You can fully customise all three keyword lists from the Settings page.

**Configurable background sync**
Auto-sync runs silently in the background at your chosen interval (15, 30, or 60 minutes). The popup shows a live countdown to the next scheduled sync. You can also trigger a manual sync at any time.

**Course filters**
Choose exactly which courses to include. Courses are discovered automatically on the first sync and can be toggled individually in Settings.

**Smart duplicate prevention**
Every processed announcement is recorded by a stable ID. Re-syncing the same announcement never creates a duplicate task, even across browser restarts.

**Dark mode**
A dark theme is available and can be toggled directly from the popup or the Settings page.

**Fully local — no servers, no accounts**
No data ever leaves your browser except for direct calls to Google's own APIs. Nothing is stored on external servers.

## How to Use

1. Install from the Chrome Web Store
2. Click the extension icon and select "Sync Now"
3. Sign in with your Google account when prompted
4. Tasks are created automatically in Google Tasks — open Google Tasks or tasks.google.com to see them

**Optional:** Open Settings (gear icon) to set your sync interval, filter courses, rename the target task list, or customise priority keywords.

## What Gets Created in Google Tasks

For each qualifying announcement:

| Field | Content |
|---|---|
| Title | `[Course Name] Keyword + context` (up to 100 characters, date phrases removed) |
| Due date | Extracted from announcement text, set to 23:59 on the detected day |
| Notes | Priority level, first 800 characters of announcement text, link to Classroom |

## Built With

Chrome Extension Manifest V3, Google Classroom API, Google Tasks API, JavaScript ES modules, regex-based NLP for natural language date extraction and priority scoring, `chrome.alarms` for background scheduling, `chrome.storage.sync` for cross-device settings persistence

## Author

Muhammad Kaleem Akhtar

GitHub: [github.com/AKA-5](https://github.com/AKA-5)
