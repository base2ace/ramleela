# DriveDrop — Simple & Elegant Media Uploader to Google Drive

A fast, lightweight, and modern web application that allows users to upload images and videos directly to a designated Google Drive folder. Designed to be hosted for free on **GitHub Pages**.

![DriveDrop](https://img.shields.io/badge/Platform-GitHub%20Pages-blue)
![Backend](https://img.shields.io/badge/Backend-Google%20Apps%20Script-green)
![Status](https://img.shields.io/badge/Status-Ready%20to%20Deploy-brightgreen)

---

## ✨ Features

- 🎨 **Simple, Elegant UI**: Apple-grade minimalism with glassmorphism, responsive cards, and curated dark palette.
- 📸 **Supports Images & Videos**: Auto-generates instant previews for JPG, PNG, WEBP, GIF, HEIC, MP4, MOV, and WEBM.
- ☁️ **Direct to Google Drive**: Files are saved directly into your specified Google Drive folder without storing them on intermediary servers.
- ⚡ **Zero Infrastructure Cost**: 100% free hosting on GitHub Pages with Google Apps Script as the serverless API.
- 🛡️ **Robust Error Handling**: Real-time progress bars, retry buttons for failed uploads, duplicate detection, and friendly toast alerts.
- 🧪 **Built-in Demo Mode**: Test and showcase upload animations and queue states even before connecting your live Google Apps Script endpoint.
- 🔍 **Interactive Media Lightbox**: Click any uploaded image or video card to inspect full preview.

---

## 📁 Repository Structure

```
fileupload-gdrive/
├── index.html                   # Main application entrypoint
├── css/
│   └── style.css                # Modern Vanilla CSS design system & glassmorphism
├── js/
│   ├── config.js                # App configuration & folder details
│   └── app.js                   # Upload queue, drag & drop, and base64 transfer logic
├── google-apps-script/
│   └── Code.gs                  # Google Apps Script Web App backend
├── SETUP_GUIDE.md               # 2-minute step-by-step deployment guide
└── README.md                    # Project overview
```

---

## 🚀 Quick Start (Local Preview)

To run and preview locally:

```bash
# Using Python
python -m http.server 8000

# Or using Node.js
npx serve .
```

Then open `http://localhost:8000` in your browser.

For complete instructions on deploying the Google Apps Script backend and hosting on GitHub Pages, see **[SETUP_GUIDE.md](SETUP_GUIDE.md)**.
