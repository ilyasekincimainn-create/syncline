package com.syncline.companion.data.remote.websocket

import android.util.Log
import com.google.gson.Gson
import com.syncline.companion.security.TokenManager
import kotlinx.coroutines.*
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.StateFlow
import okhttp3.*
import java.util.concurrent.TimeUnit

class WebSocketManager(
    private val client: OkHttpClient,
    private val tokenManager: TokenManager,
    private val serverUrl: String
) {
    private var webSocket: WebSocket? = null
    private val gson = Gson()
    private val scope = CoroutineScope(Dispatchers.IO + SupervisorJob())
    
    private val _connectionState = MutableStateFlow(false)
    val connectionState: StateFlow<Boolean> = _connectionState

    private val _incomingMessages = MutableSharedFlow<String>(extraBufferCapacity = 100)
    val incomingMessages: SharedFlow<String> = _incomingMessages

    private var reconnectDelay = 1000L
    private val maxReconnectDelay = 30000L
    private var isConnecting = false
    private var shouldReconnect = true

    fun connect() {
        if (isConnecting || _connectionState.value) return
        isConnecting = true
        shouldReconnect = true

        val request = Request.Builder()
            .url(serverUrl)
            .build()

        webSocket = client.newWebSocket(request, object : WebSocketListener() {
            override fun onOpen(webSocket: WebSocket, response: Response) {
                Log.d("WebSocketManager", "WebSocket Connection opened. Authenticating...")
                authenticate(webSocket)
            }

            override fun onMessage(webSocket: WebSocket, text: String) {
                scope.launch {
                    try {
                        val messageMap = gson.fromJson(text, Map::class.java)
                        val type = messageMap["type"] as? String
                        
                        if (type == "auth_ok") {
                            Log.d("WebSocketManager", "Authenticated successfully!")
                            _connectionState.value = true
                            isConnecting = false
                            reconnectDelay = 1000L // Reset backoff
                        } else if (type == "auth_fail") {
                            Log.e("WebSocketManager", "Authentication failed!")
                            disconnect()
                        } else {
                            _incomingMessages.emit(text)
                        }
                    } catch (e: Exception) {
                        Log.e("WebSocketManager", "Failed to parse message", e)
                    }
                }
            }

            override fun onClosing(webSocket: WebSocket, code: Int, reason: String) {
                Log.w("WebSocketManager", "Closing: $code / $reason")
                _connectionState.value = false
            }

            override fun onClosed(webSocket: WebSocket, code: Int, reason: String) {
                Log.w("WebSocketManager", "Closed: $code / $reason")
                _connectionState.value = false
                isConnecting = false
                triggerReconnection()
            }

            override fun onFailure(webSocket: WebSocket, t: Throwable, response: Response?) {
                Log.e("WebSocketManager", "Failure: ${t.message}", t)
                _connectionState.value = false
                isConnecting = false
                triggerReconnection()
            }
        })
    }

    private fun authenticate(ws: WebSocket) {
        val token = tokenManager.getAccessToken() ?: return
        val deviceId = tokenManager.getDeviceId() ?: return
        
        val authMessage = mapOf(
            "type" to "auth",
            "id" to "auth_${System.currentTimeMillis()}",
            "timestamp" to System.currentTimeMillis(),
            "payload" to mapOf(
                "accessToken" to token,
                "deviceId" to deviceId
            )
        )
        
        ws.send(gson.toJson(authMessage))
    }

    private fun triggerReconnection() {
        if (!shouldReconnect) return
        scope.launch {
            Log.d("WebSocketManager", "Reconnecting in ${reconnectDelay}ms...")
            delay(reconnectDelay)
            reconnectDelay = (reconnectDelay * 2).coerceAtMost(maxReconnectDelay)
            connect()
        }
    }

    fun sendMessage(messageType: String, payload: Any, msgId: String = "msg_${System.currentTimeMillis()}"): Boolean {
        val ws = webSocket ?: return false
        if (!_connectionState.value) return false
        
        val message = mapOf(
            "type" to messageType,
            "id" to msgId,
            "timestamp" to System.currentTimeMillis(),
            "payload" to payload
        )
        
        val json = gson.toJson(message)
        return ws.send(json)
    }

    fun disconnect() {
        shouldReconnect = false
        webSocket?.close(1000, "App closed")
        webSocket = null
        _connectionState.value = false
        isConnecting = false
    }
}
