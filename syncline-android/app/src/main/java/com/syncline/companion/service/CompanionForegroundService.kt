package com.syncline.companion.service

import android.app.Notification
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.net.wifi.WifiManager
import android.os.IBinder
import android.os.PowerManager
import android.util.Log
import androidx.core.app.NotificationCompat
import com.google.gson.Gson
import com.syncline.companion.R
import com.syncline.companion.data.local.dao.CallEventDao
import com.syncline.companion.data.local.dao.OfflineQueueDao
import com.syncline.companion.data.local.entity.OfflineQueueEntity
import com.syncline.companion.data.remote.websocket.WebSocketManager
import com.syncline.companion.presentation.MainActivity
import dagger.hilt.android.AndroidEntryPoint
import kotlinx.coroutines.*
import kotlinx.coroutines.flow.collectLatest
import javax.inject.Inject

@AndroidEntryPoint
class CompanionForegroundService : Service() {

    @Inject
    lateinit var webSocketManager: WebSocketManager

    @Inject
    lateinit var offlineQueueDao: OfflineQueueDao

    @Inject
    lateinit var callEventDao: CallEventDao

    private val serviceJob = SupervisorJob()
    private val serviceScope = CoroutineScope(Dispatchers.IO + serviceJob)

    private var wakeLock: PowerManager.WakeLock? = null
    private var wifiLock: WifiManager.WifiLock? = null
    private var callEventMonitor: CallEventMonitor? = null
    private val gson = Gson()

    override fun onCreate() {
        super.onCreate()
        Log.d("ForegroundService", "Service onCreate")
        acquireWakeLocks()
        startForeground(NOTIFICATION_ID, createNotification())
        
        // Initialize call monitoring
        callEventMonitor = CallEventMonitor(this, callEventDao, offlineQueueDao, webSocketManager)
        callEventMonitor?.start()

        // Connect websocket
        webSocketManager.connect()

        // Sync local queue when websocket gets online
        serviceScope.launch {
            webSocketManager.connectionState.collectLatest { isConnected ->
                if (isConnected) {
                    flushOfflineQueue()
                }
            }
        }

        // Listen for incoming websocket replies/commands
        serviceScope.launch {
            webSocketManager.incomingMessages.collect { message ->
                handleIncomingMessage(message)
            }
        }
    }

    private fun acquireWakeLocks() {
        val powerManager = getSystemService(Context.POWER_SERVICE) as PowerManager
        wakeLock = powerManager.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "SyncLine::ForegroundWakeLock").apply {
            acquire()
        }

        val wifiManager = applicationContext.getSystemService(Context.WIFI_SERVICE) as WifiManager
        wifiLock = wifiManager.createWifiLock(WifiManager.WIFI_MODE_FULL_HIGH_PERF, "SyncLine::ForegroundWifiLock").apply {
            acquire()
        }
    }

    private fun createNotification(): Notification {
        val intent = Intent(this, MainActivity::class.java)
        val pendingIntent = PendingIntent.getActivity(
            this, 0, intent,
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
        )

        return NotificationCompat.Builder(this, "syncline_foreground_service")
            .setContentTitle(getString(R.string.service_notification_title))
            .setContentText(getString(R.string.service_notification_desc))
            .setSmallIcon(android.R.drawable.stat_notify_chat)
            .setContentIntent(pendingIntent)
            .setOngoing(true)
            .setCategory(NotificationCompat.CATEGORY_SERVICE)
            .build()
    }

    private fun handleIncomingMessage(messageJson: String) {
        try {
            val messageMap = gson.fromJson(messageJson, Map::class.java)
            val type = messageMap["type"] as? String
            Log.d("ForegroundService", "Received WS Message: $type")
            
            if (type == "event_ack") {
                // Event verified
            }
        } catch (e: Exception) {
            Log.e("ForegroundService", "Error handling socket message", e)
        }
    }

    private suspend fun flushOfflineQueue() {
        val events = offlineQueueDao.getQueuedEvents()
        if (events.isEmpty()) return

        Log.d("ForegroundService", "Flushing ${events.size} local events to server")
        for (event in events) {
            val success = webSocketManager.sendMessage(
                messageType = event.eventType,
                payload = gson.fromJson(event.payloadEncrypted, Map::class.java)
            )
            if (success) {
                offlineQueueDao.dequeueEvent(event)
            }
        }
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        return START_STICKY
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onDestroy() {
        super.onDestroy()
        Log.w("ForegroundService", "ForegroundService onDestroy. Releasing locks...")
        serviceScope.cancel()
        
        callEventMonitor?.stop()
        
        wakeLock?.let {
            if (it.isHeld) it.release()
        }
        wifiLock?.let {
            if (it.isHeld) it.release()
        }
        
        val broadcastIntent = Intent("com.syncline.companion.RESTART_SERVICE")
        sendBroadcast(broadcastIntent)
    }

    companion object {
        private const val NOTIFICATION_ID = 4859
    }
}
