# Kharcha

Track every rupee. Zero effort.

Kharcha reads your bank SMS automatically and turns them into a clean spending dashboard. No manual entry. No syncing bank accounts. No privacy risk. Your data stays on your phone.

---

## How it works

Your bank sends you an SMS every time money moves. Kharcha intercepts those SMS messages, pulls out the amount, merchant name, and date, and logs them as transactions. You see charts, category breakdowns, and monthly summaries without typing a single thing.

---

## Features

- Automatic SMS reading from HDFC, SBI, ICICI, Axis, Kotak, Paytm, PhonePe, GPay, and more
- Smart category detection (Swiggy goes to Food, Ola goes to Transport, Jio goes to Bills)
- Monthly bar chart showing your daily spending
- Category donut chart so you know where money is going
- Month-by-month navigation
- Filter transactions by category
- Manual add option when you pay cash
- Works offline, data stays on your device

---

## Tech

**Web app** - plain HTML, CSS, JavaScript. No framework. No build step. Runs in a browser or inside the Android WebView.

**Android app** - Kotlin + WebView. Requests READ_SMS and RECEIVE_SMS permissions. Passes SMS text into the web app via a JavaScript bridge.

The web app and Android app share one codebase. The SMS parsing logic lives in `index.html` and works identically whether called from Android or a browser.

---

## Project structure

```
kharcha/
  index.html              the full web app
  android/                Android wrapper app
    app/src/main/
      java/com/example/kharcha/
        MainActivity.kt   WebView host + SMS history loader
        SmsReceiver.kt    BroadcastReceiver for new SMS
      AndroidManifest.xml permissions and receiver registration
      res/layout/         activity layout
  docs/                   documentation
  memory/                 project logs and roadmap
```

---

## Running the web app

Open `index.html` in any browser. Works as a standalone PWA on desktop and mobile.

On a non-Android device the SMS reading is not available and a banner tells the user to use the Android app.

---

## Building the Android app

1. Open the `android/` folder in Android Studio
2. Copy `index.html` into `android/app/src/main/assets/`
3. Build and run on a device (emulator does not have real SMS)
4. On first launch, grant SMS permissions when prompted
5. The app reads the last 3 months of SMS history and imports transactions automatically

---

## SMS permission note

READ_SMS and RECEIVE_SMS are sensitive permissions. Google Play requires apps using them to justify the need. Kharcha uses them solely to read bank transaction SMS. No SMS content is sent to any server. Everything is processed on device and stored in local storage.

---

## Supported banks

HDFC, SBI, ICICI, Axis, Kotak, PNB, Bank of Baroda, Yes Bank, IDFC First, Federal Bank, Union Bank, Canara Bank, Indian Overseas Bank, UCO Bank, Paytm, PhonePe, Google Pay

The parser handles all common Indian bank SMS formats including UPI credit/debit, card transactions, NEFT/IMPS transfers, and net banking alerts.

---

## Live demo

[princegautam007.github.io/kharcha](https://princegautam007.github.io/kharcha)
