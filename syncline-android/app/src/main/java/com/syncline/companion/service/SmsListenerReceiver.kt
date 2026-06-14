package com.syncline.companion.service

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.provider.Telephony
import android.util.Log
import com.google.gson.Gson
import com.syncline.companion.data.local.dao.OfflineQueueDao
import com.syncline.companion.data.local.dao.SmsEventDao
import com.syncline.companion.data.local.entity.OfflineQueueEntity
import com.syncline.companion.data.local.entity.SmsEventEntity
import com.syncline.companion.data.remote.websocket.WebSocketManager
import com.syncline.companion.security.CryptoManager
import dagger.hilt.android.AndroidEntryPoint
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import java.security.MessageDigest
import java.util.UUID
import javax.inject.Inject

@AndroidEntryPoint
class SmsListenerReceiver : BroadcastReceiver() {

    @Inject
    lateinit var smsEventDao: SmsEventDao

    @Inject
    lateinit var offlineQueueDao: OfflineQueueDao

    @Inject
    lateinit var webSocketManager: WebSocketManager

    @Inject
    lateinit var cryptoManager: CryptoManager

    private val gson = Gson()

    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action != Telephony.Sms.Intents.SMS_RECEIVED_ACTION) return

        val messages = Telephony.Sms.Intents.getMessagesFromIntent(intent)
        if (messages.isEmpty()) return

        val sender = messages[0].originatingAddress ?: "Unknown"
        val body = messages.joinToString(separator = "") { it.messageBody ?: "" }
        val timestamp = messages[0].timestampMillis

        val hash = generateMessageHash(sender, body, timestamp)

        CoroutineScope(Dispatchers.IO).launch {
            if (smsEventDao.isDuplicate(hash)) {
                Log.d("SmsReceiver", "Duplicate SMS ignored: $hash")
                return@launch
            }

            // 1. Encrypt Content
            val (encryptedContent, iv) = cryptoManager.encryptText(body)
            val eventId = UUID.randomUUID().toString()

            val entity = SmsEventEntity(
                id = eventId,
                sender = sender,
                contentEncrypted = encryptedContent,
                contentIv = iv,
                receivedAt = timestamp,
                deliveredAt = null,
                messageHash = hash
            )

            // 2. Save to local DB
            smsEventDao.insertSmsEvent(entity)
            Log.d("SmsReceiver", "Saved SMS to DB: $eventId")

            // 3. Format payload
            val payload = mapOf(
                "sender" to sender,
                "contentEncrypted" to encryptedContent,
                "contentIv" to iv,
                "receivedAt" to timestamp,
                "messageHash" to hash
            )

            // 4. Send or queue
            val success = webSocketManager.sendMessage("sms_event", payload, eventId)
            if (!success) {
                Log.w("SmsReceiver", "WS Offline, queuing SMS event")
                offlineQueueDao.enqueueEvent(
                    OfflineQueueEntity(
                        eventType = "sms_event",
                        payloadEncrypted = gson.toJson(payload),
                        payloadIv = iv
                    )
                )
            }
        }
    }

    private fun generateMessageHash(sender: String, body: String, timestamp: Long): String {
        val raw = "$sender|$body|$timestamp"
        val digest = MessageDigest.getInstance("SHA-256")
        return digest.digest(raw.toByteArray(Charsets.UTF_8)).joinToString("") { "%02x".format(it) }
    }
}
