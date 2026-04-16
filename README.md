# SignalForge

> **Smart Phishing Protection Chrome Extension** 🛡️

SignalForge is an AI-powered Chrome extension designed to detect, analyze, and block phishing URLs before you even open them. Using a combination of advanced heuristic patterns and Large Language Model (LLM) analysis via the Groq API, SignalForge accurately rates links and explains potential threats in plain English.

![SignalForge Demo](assets/demo.png) *(Note: You can add a screenshot later and put it in an assets folder)*

## ✨ Features

- **Real-Time Threat Detection:** Intercepts suspicious URLs instantly upon navigation.
- **Advanced Scoring Engine:** Checks for IP-based links, suspicious TLDs, known phishing keywords, URL shortener abuse, and fake domain structures (e.g. `amaz0n.com`).
- **AI Explanations:** Uses Groq's high-speed LLaMA-based API to write a human-friendly explanation of why the page is dangerous.
- **Smart Loop Guard:** Prevents annoying popup loops when malicious sites attempt to rapidly auto-refresh.
- **Safe Website Toasts:** Confirms completely safe sites via a sleek, non-intrusive UI toast that automatically disappears.
- **Bypass Protections:** Allows users to bypass warnings (with a 3-strike rule before permanently allowing a site for development ease).

## 🚀 Installation (Load Unpacked)

Since this extension is in development and not yet on the Chrome Web Store, you can install it manually:

1. Clone or download this repository to your computer.
2. Open Google Chrome and type `chrome://extensions/` into the URL bar.
3. Turn on **Developer mode** (the toggle switch in the top right corner).
4. Click the **Load unpacked** button in the top left.
5. Select the folder containing the SignalForge files.
6. **Done!** SignalForge is now active.

## ⚙️ Configuration (Important!)

To enable the AI capabilities, you need a free Groq API key:
1. Go to the [Groq Console](https://console.groq.com) and create an account.
2. Generate an API Key.
3. Open `ai-helper.js` in a text editor.
4. Replace `"YOUR_GROQ_API_KEY_HERE"` with your actual API key. 

*(Note: Never commit your real API key to public GitHub! Keep it private.)*

## 🛠️ Tech Stack

- **Core:** Vanilla JavaScript, HTML, CSS (No heavy frameworks — incredibly fast and lightweight).
- **Chrome APIs:** `chrome.webNavigation`, `chrome.storage.local`, `chrome.windows`, `chrome.tabs`.
- **AI Integration:** Groq API (LLaMA-3) for instantaneous LLM threat analysis.

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
