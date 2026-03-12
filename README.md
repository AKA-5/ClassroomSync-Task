# ClassroomSync Tasks

Automatically creates Google Tasks from Google Classroom announcements with intelligent deadline detection.

## Features

- Background sync every 15, 30, or 60 minutes — configurable from the settings page
- Parses natural language dates from announcement text ("due Friday", "March 15", "in 3 days")
- Per-course filters and dark mode support
- Smart duplicate prevention ensures each announcement becomes a task exactly once
- Runs entirely in the browser — no external servers, no third-party accounts

## How to Use

1. Install from the Chrome Web Store
2. Click the extension icon and select "Sync Now"
3. Sign in with your Google account when prompted
4. Tasks appear automatically in Google Tasks with extracted due dates

## Built With

Chrome Extension Manifest V3, Google Classroom API, Google Tasks API, JavaScript ES modules, regex-based NLP for date and priority extraction, `chrome.alarms` for background scheduling, `chrome.storage.sync` for cross-device settings persistence

## Author

Muhammad Kaleem Akhtar
GitHub: [github.com/AKA-5](https://github.com/AKA-5)
