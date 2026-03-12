# ClassroomSync Tasks

A Chrome extension that automatically syncs Google Classroom announcements into Google Tasks. Never miss an assignment deadline again.

[![License: AGPL v3](https://img.shields.io/badge/License-AGPL%20v3-blue.svg)](LICENSE.md)
[![Chrome Extension](https://img.shields.io/badge/Platform-Chrome%20Extension-brightgreen.svg)]()
[![Manifest: V3](https://img.shields.io/badge/Manifest-V3-orange.svg)]()

---

## Overview

ClassroomSync Tasks monitors your Google Classroom courses for assignment announcements and creates corresponding tasks in Google Tasks, complete with due dates extracted from the announcement text. It runs silently in the background every 30 minutes and creates each task exactly once.

All processing happens locally in your browser. No external servers, no accounts, no fees.

---

## Features

- **Automatic background sync** — checks for new announcements every 30 minutes
- **Natural language date parsing** — understands "due Friday", "next Monday", "March 15", "end of month", "in 3 days", "by EOD", and more
- **Priority detection** — classifies tasks as High, Medium, or Low based on keywords
- **Smart deduplication** — each announcement becomes a task exactly once
- **Course filters** — choose which courses to include or exclude
- **Dark mode** — toggle in the popup or settings
- **No servers** — runs entirely in Chrome using Google’s official APIs

---

## Installation

### Step 1 — Create a Google Cloud Project

1. Visit [Google Cloud Console](https://console.cloud.google.com) and create a new project.
2. Go to **APIs & Services → Library** and enable:
   - **Google Classroom API**
   - **Google Tasks API**
3. Go to **APIs & Services → Credentials → Create Credentials → OAuth 2.0 Client ID**.
4. Set **Application type** to **Chrome Extension**.
5. Copy the generated **Client ID**.

### Step 2 — Configure the Extension

Open `manifest.json` and replace the placeholder:

```json
"oauth2": {
  "client_id": "YOUR_CLIENT_ID.apps.googleusercontent.com",
  ...
}
```

### Step 3 — Generate Icons

Open `icons/generate-icons.html` in any browser and click each download button. Save the three files (`icon16.png`, `icon48.png`, `icon128.png`) into the `icons/` folder.

### Step 4 — Load the Extension

1. Open `chrome://extensions/`.
2. Enable **Developer mode** using the toggle in the top-right corner.
3. Click **Load unpacked** and select this project folder.
4. The ClassroomSync icon will appear in your toolbar.

Click the icon and hit **Sync Now** to connect your Google account and import your courses.

---

## Usage

| Action | How |
|---|---|
| Manual sync | Click the extension icon, then **Sync Now** |
| Auto-sync | Enable in Settings (syncs every 30 minutes) |
| Filter courses | Settings → Course Filters |
| Toggle dark mode | Moon/sun icon in the popup header |
| Priority keywords | Settings → Priority Keywords |

---

## Settings Reference

| Setting | Default | Description |
|---|---|---|
| Auto-sync | On | Background sync every 30 minutes |
| Dark mode | Off | Dark theme for popup and settings |
| Task list name | Classroom Tasks | Google Tasks list to write to |
| Course filters | All enabled | Include or exclude individual courses |
| Priority keywords | Preset | Comma-separated keywords per priority level |

---

## Troubleshooting

**“Authentication failed”**
Open the popup and click **Sync Now** — Chrome will prompt you to sign in. Make sure you are using the same Google account as your Classroom.

**“Could not fetch courses”**
Verify that the **Google Classroom API** is enabled in your Cloud project and that your OAuth Client ID matches `manifest.json`.

**No tasks appear in Google Tasks**
Recent announcements must contain task-related keywords (exam, assignment, quiz, etc.) and must have been posted in the last 7 days. Check the **Last sync** time in the popup.

**Tasks appear more than once**
Go to **Settings → Sign Out & Clear Data** to reset the deduplication cache. Note that this also clears your auth token.

---

## Project Structure

```
ClassroomSync-Task/
├── manifest.json          # MV3 manifest — permissions, OAuth2, background
├── background.js          # Service worker: alarm scheduling and message routing
├── popup.html/js/css      # Browser-action popup (340 px)
├── options.html/js/css    # Settings page
├── utils/
│   ├── api.js             # Google Classroom and Tasks API calls
│   ├── parser.js          # Date extraction, keyword detection, priority scoring
│   ├── storage.js         # chrome.storage wrappers and deduplication helpers
│   └── sync.js            # Full sync orchestration
└── icons/                 # Extension icons
```

See [ARCHITECTURE.md](ARCHITECTURE.md) for the full data-flow diagram, API quotas, and security notes.

---

## Permissions

| Permission | Reason |
|---|---|
| `identity` | Google OAuth via `chrome.identity` — no passwords stored |
| `alarms` | 30-minute background sync |
| `storage` | Settings, sync history, and course cache |
| `https://www.googleapis.com/*` | Classroom and Tasks API calls |

No data leaves your browser except direct API calls to Google.

---

## Development

No build step is required. The extension uses plain ES modules.

```bash
git clone https://github.com/your-username/ClassroomSync-Tasks.git
code ClassroomSync-Tasks/
```

After any change, go to `chrome://extensions/` and click the refresh icon on the extension card. For background script changes, open **Service Worker** → **Inspect** to see logs.

---

## License

Licensed under the [GNU Affero General Public License v3.0](LICENSE.md).

You are free to use, modify, and distribute this project under the AGPL-3.0 terms. Any modified version deployed as a network service must make its source code available under the same license.

---

## Contributing

Bug reports, feature requests, and pull requests are welcome.

1. Fork the repository.
2. Create a feature branch: `git checkout -b feature/your-feature`
3. Commit with a clear message: `git commit -m "feat: description"`
4. Open a pull request describing what changed and why.

Please test against at least one active Google Classroom course before submitting.
