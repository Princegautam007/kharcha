package com.example.kharcha

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.provider.Telephony

// Listens for incoming SMS in real time.
// Registered in AndroidManifest.xml with RECEIVE_SMS permission.
// When a new SMS arrives, it passes the body to MainActivity
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

        // Forward to MainActivity via a static reference
        // In a real app, use a local broadcast or a ViewModel
        MainActivityRef.instance?.onNewSms(body, address)
    }
}

// Simple static reference to the active MainActivity
// This is fine for a single-activity app
object MainActivityRef {
    var instance: MainActivity? = null
}
