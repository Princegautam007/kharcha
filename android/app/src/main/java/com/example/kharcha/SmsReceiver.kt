package com.example.kharcha

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.provider.Telephony

// Listens for incoming SMS in real time.
// Parses transaction messages and shows a notification immediately.
// When the app is open, it also passes the SMS to MainActivity
// which then calls window.onSmsReceived() in the WebView.

class SmsReceiver : BroadcastReceiver() {

    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action != Telephony.Sms.Intents.SMS_RECEIVED_ACTION) return

        val messages = Telephony.Sms.Intents.getMessagesFromIntent(intent)
        val fullBody = StringBuilder()
        var address = ""

        messages?.forEach { msg ->
            fullBody.append(msg.messageBody)
            address = msg.originatingAddress ?: ""
        }

        val body = fullBody.toString()
        if (body.isBlank()) return

        val transaction = SmsParser.parse(body, address)
        if (transaction != null) {
            NotificationHelper.showTransactionNotification(context, transaction)
        }

        // Forward to MainActivity when the WebView is active.
        MainActivityRef.instance?.onNewSms(body, address)
    }
}

// Simple static reference to the active MainActivity
// This is fine for a single-activity app
// Volatile because the receiver and the screen can run on different threads.
object MainActivityRef {
    @Volatile
    var instance: MainActivity? = null
}
