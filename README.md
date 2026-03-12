# ClassroomSync Tasks

Automatically converts Google Classroom announcements into Google Tasks with due dates, priorities, and clean titles — no manual entry needed.

## What it does

Each announcement matching a task keyword (quiz, assignment, exam, deadline, etc.) becomes a Google Task with:

- **Title** — `[Course Name] Quiz on chapters 3–4` (date noise removed)
- **Due date** — extracted from text: "due Friday", "March 15", "in 3 days", "by EOD", etc.
- **Priority** — High / Medium / Low written to task notes, based on keywords
- **Notes** — priority level + announcement text + link back to Classroom

## Features

- Auto-sync every 15, 30, or 60 min — live countdown shown in popup
- Manual "Sync Now" button for on-demand sync
- Per-course filters — toggle individual courses in Settings
- Customisable priority keywords for all three levels
- Duplicate prevention — same announcement never creates two tasks
- Dark mode toggle in popup and Settings
- Fully local — no external servers, no data collected

## How to Use

1. Install from the Chrome Web Store
2. Click the extension icon and tap "Sync Now"
3. Sign in with Google when prompted
4. Tasks appear in Google Tasks automatically — with dates and priorities already set

Open the gear icon to configure sync interval, course filters, or priority keywords.

## Built With

Manifest V3, Google Classroom API, Google Tasks API, JavaScript ES modules, regex NLP for date/priority extraction, `chrome.alarms`, `chrome.storage.sync`

## Author

Muhammad Kaleem Akhtar — [github.com/AKA-5](https://github.com/AKA-5)
