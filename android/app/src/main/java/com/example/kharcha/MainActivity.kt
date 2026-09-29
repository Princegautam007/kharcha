package com.example.kharcha

import android.Manifest
import android.content.pm.PackageManager
import android.database.Cursor
import android.net.Uri
import android.os.Bundle
import android.provider.Telephony
import android.webkit.JavascriptInterface
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.appcompat.app.AppCompatActivity
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import org.json.JSONArray
import org.json.JSONObject

class MainActivity : AppCompatActivity() {

    private lateinit var webView: WebView
    private val SMS_PERMISSION_CODE = 101

    // Banks and keywords we care about - ignore marketing SMS
    private val bankSenders = listOf(
        "hdfc", "sbi", "icici", "axis", "kotak", "pnb", "bob", "paytm",
        "phonepe", "gpay", "yesbank", "idfc", "federal", "union", "canara",
        "ubi", "iob", "uco", "alert", "txn", "debit", "credit", "bank",
        "phonpe", "pytm", "canbnk"
    )

    private val amountMarkers = listOf("rs.", "rs ", "inr", "debited", "credited")

    private val transactionWords = listOf(
        "debited", "credited", "spent", "withdrawn", "paid to", "upi", "a/c", "txn"
    )

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        webView = findViewById(R.id.webView)
        setupWebView()
        checkSmsPermission()

        // Let SmsReceiver reach this screen while the app is open.
        // Without this, SmsReceiver finds no screen and drops every new SMS.
        MainActivityRef.instance = this
    }

    override fun onDestroy() {
        // Only clear the reference if it still points at this screen.
        if (MainActivityRef.instance === this) MainActivityRef.instance = null
        webView.destroy()
        super.onDestroy()
    }

    private fun setupWebView() {
        val settings: WebSettings = webView.settings
        settings.javaScriptEnabled = true
        settings.domStorageEnabled = true      // for localStorage
        settings.databaseEnabled = true
        // The app only loads its own page from the assets folder, so it does not
        // need to read other files or other sites from a file page.
        settings.allowFileAccessFromFileURLs = false
        settings.allowUniversalAccessFromFileURLs = false
        settings.setSupportZoom(false)
        settings.builtInZoomControls = false
        settings.displayZoomControls = false
        settings.loadWithOverviewMode = true
        settings.useWideViewPort = true

        // Bridge between Android and JavaScript
        webView.addJavascriptInterface(SmsJsBridge(), "AndroidSms")

        webView.webViewClient = object : WebViewClient() {
            override fun onPageFinished(view: WebView?, url: String?) {
                super.onPageFinished(view, url)
                // Once page loads, inject past SMS history
                if (ContextCompat.checkSelfPermission(
                        this@MainActivity, Manifest.permission.READ_SMS
                    ) == PackageManager.PERMISSION_GRANTED
                ) {
                    loadSmsHistory()
                }
            }
        }

        // Load the web app
        // For production: webView.loadUrl("https://princegautam007.github.io/kharcha")
        // For local development (assets folder):
        webView.loadUrl("file:///android_asset/index.html")
    }

    private fun checkSmsPermission() {
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.READ_SMS)
            != PackageManager.PERMISSION_GRANTED ||
            ContextCompat.checkSelfPermission(this, Manifest.permission.RECEIVE_SMS)
            != PackageManager.PERMISSION_GRANTED
        ) {
            ActivityCompat.requestPermissions(
                this,
                arrayOf(
                    Manifest.permission.READ_SMS,
                    Manifest.permission.RECEIVE_SMS
                ),
                SMS_PERMISSION_CODE
            )
        }
    }

    override fun onRequestPermissionsResult(
        requestCode: Int,
        permissions: Array<out String>,
        grantResults: IntArray
    ) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        if (requestCode == SMS_PERMISSION_CODE &&
            grantResults.isNotEmpty() &&
            grantResults[0] == PackageManager.PERMISSION_GRANTED
        ) {
            loadSmsHistory()
        }
    }

    // Reads last 3 months of SMS and sends to web app
    private fun loadSmsHistory() {
        Thread {
            val smsList = JSONArray()
            val threeMonthsAgo = System.currentTimeMillis() - (90L * 24 * 60 * 60 * 1000)

            val cursor: Cursor? = contentResolver.query(
                Uri.parse("content://sms/inbox"),
                arrayOf("_id", "address", "body", "date"),
                "date > ?",
                arrayOf(threeMonthsAgo.toString()),
                "date DESC"
            )

            cursor?.use {
                val bodyIndex = it.getColumnIndex("body")
                val dateIndex = it.getColumnIndex("date")
                val addrIndex = it.getColumnIndex("address")

                while (it.moveToNext() && smsList.length() < 500) {
                    val body = it.getString(bodyIndex) ?: continue
                    val date = it.getLong(dateIndex)
                    val addr = it.getString(addrIndex) ?: ""

                    // Only process likely bank SMS
                    if (isBankSms(addr, body)) {
                        val obj = JSONObject()
                        obj.put("body", body)
                        obj.put("date", date)
                        obj.put("address", addr)
                        smsList.put(obj)
                    }
                }
            }

            runOnUiThread {
                // Older WebViews treat these two characters as line breaks inside
                // a string, so write them out as escape codes.
                val json = smsList.toString()
                    .replace("\u2028", "\\u2028")
                    .replace("\u2029", "\\u2029")
                webView.evaluateJavascript(
                    "window.onSmsHistoryReceived($json)", null
                )
            }
        }.start()
    }

    // Called by SmsReceiver when a new SMS arrives
    fun onNewSms(body: String, address: String) {
        if (!isBankSms(address, body)) return
        runOnUiThread {
            // JSONObject.quote turns the text into a safe JavaScript string.
            // It handles quotes, new lines, carriage returns and line separators.
            // If the page has not finished loading yet, nothing happens here.
            // The SMS is picked up by the history import instead, and the web
            // app skips it if it was already saved.
            val js = "if (typeof window.onSmsReceived === 'function') " +
                "window.onSmsReceived(${JSONObject.quote(body)})"
            webView.evaluateJavascript(js, null)
        }
    }

    private fun isBankSms(address: String, body: String): Boolean {
        val lowerAddr = address.lowercase()
        val lowerBody = body.lowercase()

        // OTP and password messages are never transactions
        val isOtp = lowerBody.contains("otp") || lowerBody.contains("password") ||
            lowerBody.contains("verification code")
        if (isOtp) return false

        // The SMS must mention an amount
        val hasAmount = amountMarkers.any { lowerBody.contains(it) }
        if (!hasAmount) return false

        // It must also come from a known bank sender, or use words that banks
        // use for a transaction. This keeps out shop offers such as "Rs 100 off".
        val isBankSender = bankSenders.any { lowerAddr.contains(it) }
        val hasTransactionWord = transactionWords.any { lowerBody.contains(it) }
        return isBankSender || hasTransactionWord
    }

    inner class SmsJsBridge {
        // JS can call this to trigger permission request again
        @JavascriptInterface
        fun requestSmsPermission() {
            runOnUiThread { checkSmsPermission() }
        }
    }

    override fun onBackPressed() {
        if (webView.canGoBack()) webView.goBack()
        else super.onBackPressed()
    }
}
