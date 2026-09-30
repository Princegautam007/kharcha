# Android App Setup

## What you need

- Android Studio (latest version)
- An Android phone (emulators do not send real SMS)
- USB cable or wireless debugging enabled

## Steps

### 1. Open the project

Open Android Studio. Choose "Open" and select the `android/` folder inside the kharcha repo. Let Gradle sync finish.

### 2. Add the web app as an asset

The Android app is a shell around the web UI. It needs its own copy of
`index.html` inside the project, because the WebView loads it from the app's
assets folder — not from the repo root.

**From a terminal (easiest):** run this from the repository root, in the
project folder:

```sh
# macOS / Linux
mkdir -p android/app/src/main/assets
cp index.html android/app/src/main/assets/
```

```powershell
# Windows PowerShell
New-Item -ItemType Directory -Force android\app\src\main\assets
Copy-Item index.html android\app\src\main\assets\
```

**From Android Studio:** in the Project pane, switch the dropdown from
"Android" to "Project" view, then right-click
`app/src/main` → New → Directory → name it `assets`. Right-click the new
`assets` folder → Paste, and copy `index.html` from the repo root into it.

You end up with:

```
kharcha/
├── index.html                              <- the source of truth
└── android/app/src/main/
    └── assets/
        └── index.html                      <- the copy the app loads
```

> **Important:** these are two separate files. Whenever you edit the root
> `index.html`, copy it to `assets/` again **before every build**, otherwise
> the app keeps running the old version. A common way to remember: run the
> `cp` command above first, then press Run in Android Studio.

### 3. Run on a physical device

Connect your phone. Enable Developer Options and USB Debugging on the phone (Settings > About Phone > tap Build Number 7 times).

Press the Run button in Android Studio (green triangle). Select your device.

### 4. Grant SMS permission

On first launch the app asks for SMS permission. Tap Allow.

The app then reads your last 3 months of SMS history and imports all bank transactions. This takes 2 to 5 seconds.

### 5. Going forward

New SMS arrive automatically. Every time a bank sends a debit or credit alert, it shows up in Kharcha within a second.

## How the WebView loads the app

The WebView loads from `file:///android_asset/index.html` in development. For production, change the URL in `MainActivity.kt` to load from GitHub Pages:

```kotlin
webView.loadUrl("https://princegautam007.github.io/kharcha")
```

Loading from GitHub Pages means you can update the web app without rebuilding the Android APK. The Android part (SMS reading) stays the same, the web UI gets updated by pushing to GitHub.

## Common issues

**App crashes on launch** - Make sure the `assets/` folder exists and contains `index.html`.

**No transactions showing** - Check that SMS permission was granted. Go to Settings > Apps > Kharcha > Permissions > SMS and enable it.

**Missing some banks** - The filter in `MainActivity.kt` checks the sender address against a keyword list. Add your bank's sender ID to `bankSenders` in `MainActivity.kt`.

**Transactions showing wrong category** - Update the keyword lists in `parseSms()` in `index.html`.
