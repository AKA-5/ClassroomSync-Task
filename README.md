# ClassroomSync Tasks

A free, open-source Chrome extension that automatically syncs Google Classroom announcements into Google Tasks — so you never miss a deadline again.

---

## Features

- 🔄 **Auto-sync** every 30 minutes in the background
- 📅 **Smart date parsing** — detects "due Friday", "tomorrow", "March 15", "MM/DD" in announcement text
- 🔑 **Keyword detection** — quiz, test, exam, assignment, homework, project, and more
- ✅ **Deduplication** — each announcement only becomes a task once
- 🎛️ **Course filters** — enable/disable individual courses
- 🌙 **Dark mode** — toggle in popup or settings
- 🚫 **No servers, no fees** — runs entirely in Chrome using Google's free APIs

---

## Quick Start

### 1. Create a Google Cloud Project

1. Go to [console.cloud.google.com](https://console.cloud.google.com) → **New Project**
2. Enable these APIs:
   - **Google Classroom API**
   - **Google Tasks API**
3. Go to **APIs & Services → Credentials → Create Credentials → OAuth 2.0 Client ID**
4. Application type: **Chrome Extension**
5. Copy the generated **Client ID**

### 2. Configure the Extension

Open `manifest.json` and replace the placeholder:

```json
"oauth2": {
  "client_id": "YOUR_CLIENT_ID.apps.googleusercontent.com",
  ...
}
```

### 3. Generate Icons

Open `icons/generate-icons.html` in any browser, then click each download button.  
Save the three PNGs (`icon16.png`, `icon48.png`, `icon128.png`) into the `icons/` folder.

### 4. Load in Chrome

1. Open `chrome://extensions/`
2. Enable **Developer mode** (top-right toggle)
3. Click **Load unpacked** → select this project folder
4. The 📚 icon appears in your toolbar — click it and hit **Sync Now**

---

## Project Structure

```
ClassroomSync-Task/
├── manifest.json          # MV3 manifest
├── background.js          # Service worker (alarms + message routing)
├── popup.html/js/css      # Browser-action popup
├── options.html/js/css    # Settings page
├── utils/
│   ├── api.js             # Google Classroom + Tasks API calls
│   ├── parser.js          # Keyword & date extraction
│   ├── storage.js         # chrome.storage wrappers
│   └── sync.js            # Full sync orchestration
├── icons/                 # Extension icons
└── ARCHITECTURE.md        # Full technical architecture docs
```

See [ARCHITECTURE.md](ARCHITECTURE.md) for the complete data-flow diagram, API quotas, and security notes.

---

## Permissions Used

| Permission | Purpose |
|---|---|
| `identity` | Google OAuth via `chrome.identity` |
| `alarms` | 30-minute background sync |
| `storage` | Settings + sync history |
| `tabs` | Open options page |
| `https://www.googleapis.com/*` | Classroom + Tasks API calls |

---

## Development

No build step required — it's plain ES modules.

```bash
# Clone
git clone https://github.com/your-username/ClassroomSync-Tasks.git

# Open in VS Code
code ClassroomSync-Tasks/

# Load unpacked in Chrome after any changes
```

Use `chrome://extensions/` → **Inspect views: service worker** to see background logs.

---

## License

MIT — see [LICENSE](LICENSE)
