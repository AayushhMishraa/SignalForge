# SignalForge

A Chrome extension that detects phishing URLs before you open them. Built for my B.Tech 6th semester minor project.

## What it does

SignalForge checks URLs in real-time and warns you if they look suspicious. It uses pattern matching to catch common phishing tricks like:
- Fake domains (amaz0n.com instead of amazon.com)
- Suspicious TLDs (.xyz, .tk, etc.)
- URL shorteners hiding the real destination
- IP addresses instead of domain names
- Missing HTTPS
- And a bunch of other red flags

If a URL scores high enough on the threat scale, you get a popup explaining what's wrong with it. You can go back or continue anyway (your choice).

## How to install

Since this isn't on the Chrome Web Store, you'll need to load it manually:

1. Download or clone this repo
2. Open Chrome and go to `chrome://extensions/`
3. Turn on **Developer mode** (top right corner)
4. Click **Load unpacked**
5. Select the SignalForge folder
6. Done

## AI Analysis (optional)

The extension can use Groq's API to explain threats in plain English. To enable this:

1. Get a free API key from [console.groq.com](https://console.groq.com)
2. Open `ai-helper.js` in a text editor
3. Replace `'YOUR_GROQ_API_KEY_HERE'` with your actual key

If you don't add a key, the extension still works — you just won't get the AI explanations.

## Tech stack

- Vanilla JavaScript (no frameworks)
- Chrome Extension APIs (webNavigation, storage, tabs)
- Groq API for AI analysis (optional)

## Files

- `background.js` — service worker that intercepts URLs
- `content.js` — shows safe/unsafe notifications on pages
- `rules.js` — scoring engine with 12 detection rules
- `popup.html/js/css` — warning popup and manual scanner
- `ai-helper.js` — Groq API integration
- `history.js` — stores recent scans

## Known limitations

- Can't inject warnings on Chrome's own error pages (chrome-error://)
- Redirect checking doesn't work due to CORS
- No database of known phishing sites (just pattern matching)
- AI analysis requires internet connection

## License

MIT License — do whatever you want with it.

## Notes

This was built as a learning project for college. It's not meant to replace proper antivirus software or browser security features. Use at your own risk.

If you find bugs or have suggestions, feel free to open an issue.
