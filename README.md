# LungCare PWA — Deployment Guide

## Your app files

- `index.html` — complete app (checklist, SpO2 log, meds, progress)
- `sw.js` — service worker (offline support)
- `manifest.json` — PWA manifest (install on Android)

---

## How to install on your Android phone (FREE — 5 minutes)

### Step 1: Create a free GitHub account

Go to https://github.com and sign up (free).

### Step 2: Create a new repository

1. Click the "+" button → "New repository"
2. Name it: `lungcare` (or anything you like)
3. Set it to **Public**
4. Click "Create repository"

### Step 3: Upload the 3 files

1. On your new repo page, click "uploading an existing file"
2. Drag and drop all 3 files: `index.html`, `sw.js`, `manifest.json`
3. Click "Commit changes"

### Step 4: Enable GitHub Pages

1. Go to repo → Settings → Pages (left sidebar)
2. Under "Source", select **Deploy from a branch**
3. Branch: **main**, Folder: **/ (root)**
4. Click Save

### Step 5: Get your URL

After 1–2 minutes, your app is live at:
`https://YOUR-USERNAME.github.io/lungcare/`

---

## Install as PWA on Android

1. Open Chrome on your Android phone
2. Go to your GitHub Pages URL above
3. Wait for the page to fully load
4. Tap the **3-dot menu (⋮)** in Chrome
5. Tap **"Add to Home screen"** or **"Install app"**
6. Tap **"Install"** or **"Add"**
7. Done! The LungCare icon now appears on your home screen

The app works fully **offline** after the first load — all your data is saved on your phone.

---

## Features

- **Today tab**: 29-task daily checklist with progress ring and streak counter
- **SpO2 tab**: Log readings with pulse, feeling, and notes. Color-coded alerts.
- **Meds tab**: Track Forocot G and nebuliser doses (AM + PM)
- **Progress tab**: Streak counter, weekly grid, 14-day history

## Data

All data is stored in your phone's browser (IndexedDB). It persists as long as you don't clear browser data. The checklist auto-resets each day at midnight.

## Troubleshooting

- If the install banner doesn't appear, wait 30 seconds and reload the page
- Data only saves if you use the same browser (Chrome) consistently
- To back up data in the future, we can add export functionality
