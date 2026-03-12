# Privacy Policy

**ClassroomSync Tasks** — Chrome Extension
Last updated: March 12, 2026

---

## Summary

ClassroomSync Tasks does not collect, transmit, or share any personal data. All processing occurs locally inside your browser. No external servers are involved.

---

## Data Accessed

To function, the extension requests read access to your Google Classroom courses and announcements, and write access to Google Tasks. Specifically:

- **Google Classroom courses** — course names and IDs are cached locally to populate course filters.
- **Google Classroom announcements** — announcement text is read locally to extract due dates and create task titles. It is never transmitted to any server other than Google's own APIs.
- **Google Tasks** — tasks are created in your chosen task list. No existing tasks are read, modified, or deleted.
- **Google account** — authentication is handled entirely by Google via `chrome.identity`. The extension never receives or stores your password or full account credentials.

---

## Data Storage

All data is stored locally on your device only:

- **`chrome.storage.sync`** — user preferences (auto-sync toggle, sync interval, dark mode, task list name, course filters, priority keywords). Synced across your signed-in Chrome devices by Google.
- **`chrome.storage.local`** — hashes of already-synced announcements (for duplicate prevention) and sync history (last sync time, task count). Entries older than 90 days are automatically pruned.

No data is sent to any server operated by the developer.

---

## Permissions

| Permission | Purpose |
|---|---|
| `identity` | Google OAuth 2.0 sign-in via `chrome.identity` |
| `storage` | Save settings and sync history locally |
| `alarms` | Schedule background sync at your chosen interval |
| `https://www.googleapis.com/*` | Calls to Google Classroom and Tasks APIs |

**OAuth scopes requested:**

| Scope | Purpose |
|---|---|
| `classroom.courses.readonly` | Read your enrolled courses |
| `classroom.announcements.readonly` | Read announcements from those courses |
| `tasks` | Create tasks in Google Tasks |

---

## Google API Services User Data Policy

ClassroomSync Tasks' use of information received from Google APIs adheres to the [Google API Services User Data Policy](https://developers.google.com/terms/api-services-user-data-policy), including the Limited Use requirements. Google user data obtained via these APIs is used solely to provide the core functionality of the extension (converting Classroom announcements into Google Tasks) and is not used for any other purpose, sold, or shared with third parties.

---

## Third Parties

This extension does not use analytics, advertising, crash reporting, or any third-party SDK. No data is shared with any party other than Google's own API endpoints.

---

## Children's Privacy

This extension is not directed at children under 13. It does not knowingly collect data from children.

---

## Changes to This Policy

If this policy changes materially, the "Last updated" date above will be revised. Continued use of the extension after changes constitutes acceptance of the updated policy.

---

## Contact

Muhammad Kaleem Akhtar
GitHub: [github.com/AKA-5](https://github.com/AKA-5)

Source code is fully open source and available for review at [github.com/AKA-5/ClassroomSync-Task](https://github.com/AKA-5/ClassroomSync-Task).
