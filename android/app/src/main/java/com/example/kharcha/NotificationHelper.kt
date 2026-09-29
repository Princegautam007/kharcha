package com.example.kharcha

import android.Manifest
import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.Context
import android.content.pm.PackageManager
import android.os.Build
import androidx.core.content.ContextCompat

object NotificationHelper {
    private const val CHANNEL_ID = "kharcha_transactions"
    private const val CHANNEL_NAME = "Transactions"
    private const val CHANNEL_DESCRIPTION = "Notifications for detected bank transactions"

    fun createChannel(context: Context) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return

        val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        val channel = NotificationChannel(
            CHANNEL_ID,
            CHANNEL_NAME,
            NotificationManager.IMPORTANCE_DEFAULT
        ).apply {
            description = CHANNEL_DESCRIPTION
        }
        manager.createNotificationChannel(channel)
    }

    fun showTransactionNotification(
        context: Context,
        transaction: SmsParser.Transaction
    ): Boolean {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU &&
            ContextCompat.checkSelfPermission(
                context,
                Manifest.permission.POST_NOTIFICATIONS
            ) != PackageManager.PERMISSION_GRANTED
        ) {
            return false
        }

        createChannel(context)

        val direction = if (transaction.type == "credit") "Received" else "Spent"
        val merchant = transaction.merchant.ifBlank { "Unknown merchant" }
        val bank = transaction.bank?.takeIf { it.isNotBlank() }
        val title = "$direction Rs.${formatAmount(transaction.amount)}"
        val text = if (bank == null) {
            "Transaction at $merchant"
        } else {
            "Transaction at $merchant via $bank"
        }

        val notification = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            android.app.Notification.Builder(context, CHANNEL_ID)
                .setSmallIcon(R.mipmap.ic_launcher)
                .setContentTitle(title)
                .setContentText(text)
                .setAutoCancel(true)
                .setCategory(android.app.Notification.CATEGORY_STATUS)
                .build()
        } else {
            android.app.Notification.Builder(context)
                .setSmallIcon(R.mipmap.ic_launcher)
                .setContentTitle(title)
                .setContentText(text)
                .setAutoCancel(true)
                .build()
        }

        val notificationId = (System.currentTimeMillis() and 0x7fffffff).toInt()
        val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        manager.notify(notificationId, notification)
        return true
    }

    private fun formatAmount(amount: Double): String {
        return if (amount % 1.0 == 0.0) {
            amount.toLong().toString()
        } else {
            String.format(java.util.Locale.US, "%.2f", amount)
        }
    }
}
