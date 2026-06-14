package com.syncline.companion.service

import android.content.Context
import android.telephony.PhoneStateListener
import android.telephony.TelephonyManager
import android.util.Log
import com.google.gson.Gson
import com.syncline.companion.data.local.dao.CallEventDao
import com.syncline.companion.data.local.dao.OfflineQueueDao
import com.syncline.companion.data.local.entity.CallEventEntity
import com.syncline.companion.data.local.entity.OfflineQueueEntity
import com.syncline.companion.data.remote.websocket.WebSocketManager
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import java.util.UUID

class CallEventMonitor(
    private val context: Context,
    private val callEventDao: CallEventDao,
    private val offlineQueueDao: OfflineQueueDao,
    private val webSocketManager: WebSocketManager
) {
    private val telephonyManager = context.getSystemService(Context.TELEPHONY_SERVICE) as TelephonyManager
    private val scope = CoroutineScope(Dispatchers.IO)
    private val gson = Gson()

    private var currentCallId: String? = null
    private var callerNumber: String? = null
    private var startTime: Long = 0
    private var isAnswered = false
    private var lastState = TelephonyManager.CALL_STATE_IDLE

    private val listener = object : PhoneStateListener() {
        override fun onCallStateChanged(state: Int, phoneNumber: String?) {
            super.onCallStateChanged(state, phoneNumber)
            
            // Normalize incoming number
            val num = phoneNumber?.ifBlank { null } ?: callerNumber ?: "Private Number"

            when (state) {
                TelephonyManager.CALL_STATE_RINGING -> {
                    Log.d("CallMonitor", "Call ringing: $num")
                    currentCallId = UUID.randomUUID().toString()
                    callerNumber = num
                    startTime = System.currentTimeMillis()
                    isAnswered = false
                    
                    reportCallEvent("ringing", startTime, null, null)
                }
                
                TelephonyManager.CALL_STATE_OFFHOOK -> {
                    Log.d("CallMonitor", "Call offhook (answered or outgoing): $num")
                    if (lastState == TelephonyManager.CALL_STATE_RINGING) {
                        isAnswered = true
                        val answerTime = System.currentTimeMillis()
                        reportCallEvent("answered", startTime, answerTime, null)
                    }
                }
                
                TelephonyManager.CALL_STATE_IDLE -> {
                    Log.d("CallMonitor", "Call idle (ended): $num")
                    if (currentCallId != null) {
                        val endTime = System.currentTimeMillis()
                        val duration = ((endTime - startTime) / 1000).toInt()
                        
                        val status = if (isAnswered) "ended" else "missed"
                        reportCallEvent(status, startTime, if (isAnswered) startTime else null, endTime)
                        
                        // Save call log in database
                        saveCallLog(status, startTime, endTime, duration)
                        
                        // Reset
                        currentCallId = null
                        callerNumber = null
                        isAnswered = false
                    }
                }
            }
            lastState = state
        }
    }

    fun start() {
        Log.d("CallMonitor", "Starting CallEventMonitor phone listener")
        telephonyManager.listen(listener, PhoneStateListener.LISTEN_CALL_STATE)
    }

    fun stop() {
        Log.d("CallMonitor", "Stopping CallEventMonitor phone listener")
        telephonyManager.listen(listener, PhoneStateListener.LISTEN_NONE)
    }

    private fun reportCallEvent(status: String, startedAt: Long, answeredAt: Long?, endedAt: Long?) {
        val callId = currentCallId ?: return
        val caller = callerNumber ?: "Private"
        
        val payload = mapOf(
            "caller" to caller,
            "callerName" to null,
            "status" to status,
            "startedAt" to startedAt,
            "answeredAt" to answeredAt,
            "endedAt" to endedAt
        )

        scope.launch {
            val success = webSocketManager.sendMessage("call_event", payload, callId)
            if (!success && (status == "ended" || status == "missed")) {
                // If call ended and server is offline, queue the final state
                offlineQueueDao.enqueueEvent(
                    OfflineQueueEntity(
                        eventType = "call_event",
                        payloadEncrypted = gson.toJson(payload),
                        payloadIv = ""
                    )
                )
            }
        }
    }

    private fun saveCallLog(status: String, started: Long, ended: Long, duration: Int) {
        val callId = currentCallId ?: return
        val caller = callerNumber ?: "Private"
        
        scope.launch {
            val entity = CallEventEntity(
                id = callId,
                caller = caller,
                callerName = null,
                status = status,
                startedAt = started,
                answeredAt = if (isAnswered) started else null,
                endedAt = ended,
                durationSec = duration
            )
            callEventDao.insertCallEvent(entity)
        }
    }
}
