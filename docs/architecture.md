# Architecture

## Overview

Kharcha has two parts that work together: a web app and an Android wrapper.

```
SMS arrives on phone
      |
      v
Android SmsReceiver (BroadcastReceiver)
      |
      v
MainActivity.onNewSms()
      |
      v  JavaScript bridge
webView.evaluateJavascript("window.onSmsReceived(smsBody)")
      |
      v
parseSms() in index.html
      |
      v
Expense object saved to localStorage
      |
      v
UI re-renders with new transaction
```

## Web app (index.html)

Single HTML file. No framework, no build step.

- All state lives in memory (a JavaScript array called `expenses`)
- State is saved to `localStorage` under a key like `kharcha_2026_9`
- Each month has its own key so navigation between months is instant
- Charts are drawn with the Canvas 2D API (no Chart.js dependency)
- The SMS parser is a set of regex patterns, runs fully on device

## Android app (android/)

Kotlin + WebView. Three files matter:

- `MainActivity.kt` - hosts the WebView, loads SMS history on startup
- `SmsReceiver.kt` - BroadcastReceiver, fires on every incoming SMS
- `AndroidManifest.xml` - declares READ_SMS and RECEIVE_SMS permissions

## JavaScript bridge

Android calls into JavaScript with `webView.evaluateJavascript()`.

Two functions are exposed on `window`:

- `window.onSmsReceived(body)` - single SMS, called in real time
- `window.onSmsHistoryReceived(array)` - array of past SMS on first load

JavaScript calls back into Android through `AndroidSms.requestSmsPermission()` if permission was not granted.

## Data flow for SMS history (on first app launch)

1. Page finishes loading
2. `onPageFinished` fires in Android
3. Android queries `content://sms/inbox` for last 90 days
4. Filters to bank SMS only (checks sender address and body keywords)
5. Passes array of `{body, date, address}` objects to JavaScript
6. JavaScript runs each through `parseSms()`, discards non-financial ones
7. Valid expenses are saved to localStorage and shown on screen

## Data flow for new incoming SMS

1. SMS arrives
2. Android OS fires `SMS_RECEIVED` broadcast
3. `SmsReceiver.onReceive()` catches it
4. Checks if it looks like a bank SMS
5. Calls `MainActivity.onNewSms()`
6. MainActivity calls `webView.evaluateJavascript("window.onSmsReceived(...)")`
7. Web app parses and logs it, shows a toast notification

## Storage

Data is in `localStorage`. No server, no database, no account needed.

Key format: `kharcha_YYYY_M` (example: `kharcha_2026_9`)
Value: JSON array of expense objects

Each expense object:
```json
{
  "id": 1727123456789.5,
  "amount": 249,
  "type": "debit",
  "merchant": "Swiggy",
  "category": "food",
  "bank": "HDFC",
  "date": "2026-09-29T14:30:00.000Z",
  "source": "sms"
}
```

`source` is either `"sms"` (auto-detected) or `"manual"` (user typed it in).
