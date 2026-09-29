# Android transaction notifications

Kharcha can show a notification when Android receives a bank transaction SMS.

The Android app asks for notification permission on Android 13 and newer. Notification messages are grouped under the Transactions notification channel.

When a new SMS arrives:

1. The SMS receiver sends the message to the Kotlin SMS parser.
2. The parser checks for a transaction and extracts the amount, type, merchant and bank.
3. A notification is shown for a detected transaction.
4. When the Kharcha screen is open, the SMS is also passed to the WebView so the existing web parser and storage path can handle it.

The notification path does not depend on the WebView being open.

Kotlin and Android code cannot be compiled in the sandbox used to prepare patches. Build the Android app in Android Studio after applying these patches. Test on a physical Android phone or Android device with notification permission enabled.
