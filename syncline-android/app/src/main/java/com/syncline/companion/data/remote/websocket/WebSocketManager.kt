package com.syncline.companion.data.remote.websocket

import android.content.Context
import android.util.Log
import com.google.gson.Gson
import com.syncline.companion.data.remote.api.AuthApi
import com.syncline.companion.data.remote.dto.RegisterRequest
import com.syncline.companion.security.DeviceFingerprint
import com.syncline.companion.security.TokenManager
import kotlinx.coroutines.*
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.StateFlow
import okhttp3.*
import java.util.concurrent.TimeUnit

class WebSocketManager(
    private val context: Context,
    private val client: OkHttpClient,
    private val tokenManager: TokenManager,
    private val authApi: AuthApi,
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

    private var heartbeatJob: Job? = null
    private var authTimeoutJob: Job? = null

    private fun setConnectionState(isConnected: Boolean) {
        val oldState = _connectionState.value
        if (oldState != isConnected) {
            _connectionState.value = isConnected
            Log.d("WebSocketManager", "Connection state changed: $oldState -> $isConnected")
        }
    }

    private fun startHeartbeat() {
        stopHeartbeat()
        heartbeatJob = scope.launch {
            while (isActive) {
                delay(20000) // Send ping every 20 seconds
                Log.d("WebSocketManager", "Sending client-side application heartbeat ping...")
                sendHeartbeatDirect()
            }
        }
    }

    private fun stopHeartbeat() {
        heartbeatJob?.cancel()
        heartbeatJob = null
    }

    private fun sendHeartbeatDirect() {
        val ws = webSocket ?: return
        val message = mapOf(
            "type" to "heartbeat_ping",
            "id" to "heartbeat_${System.currentTimeMillis()}",
            "timestamp" to System.currentTimeMillis(),
            "payload" to mapOf("uptime" to 0, "queueSize" to 0)
        )
        val json = gson.toJson(message)
        try {
            val sent = ws.send(json)
            Log.d("WebSocketManager", "Application heartbeat sent: $sent")
        } catch (e: Exception) {
            Log.e("WebSocketManager", "Failed to send application heartbeat", e)
        }
    }

    fun connect() {
        if (isConnecting || _connectionState.value) return
        isConnecting = true
        shouldReconnect = true

        scope.launch {
            try {
                var token = tokenManager.getAccessToken()
                var deviceId = tokenManager.getDeviceId()
                Log.d("WebSocketManager", "connect() flow started. accessToken exists: ${!token.isNullOrEmpty()}, deviceId: $deviceId")

                if (token.isNullOrEmpty() || deviceId.isNullOrEmpty()) {
                    Log.d("WebSocketManager", "register started")
                    Log.d("WebSocketManager", "Device not registered or tokens missing. Registering device...")
                    
                    val uuid = DeviceFingerprint.getUuid(context)
                    val fingerprint = DeviceFingerprint.getFingerprint(context)
                    val model = DeviceFingerprint.getModel()
                    val osVersion = DeviceFingerprint.getOsVersion()
                    
                    val request = RegisterRequest(
                        uuid = uuid,
                        fingerprint = fingerprint,
                        platform = "android",
                        pushToken = "",
                        model = model,
                        osVersion = osVersion
                    )

                    val response = authApi.registerDevice(request)
                    if (response.isSuccessful && response.body() != null) {
                        val regResponse = response.body()!!
                        tokenManager.saveDeviceId(regResponse.deviceId)
                        tokenManager.saveTokens(
                            accessToken = regResponse.tokens.accessToken,
                            refreshToken = regResponse.tokens.refreshToken
                        )
                        tokenManager.savePairCode(regResponse.pairCode)
                        
                        token = regResponse.tokens.accessToken
                        deviceId = regResponse.deviceId
                        
                        Log.d("WebSocketManager", "register success: token=$token")
                        Log.i("WebSocketManager", "Device registered successfully! DeviceId: $deviceId, PairCode: ${regResponse.pairCode}")
                    } else {
                        val errBody = response.errorBody()?.string()
                        Log.e("WebSocketManager", "Device registration failed: ${response.code()} / $errBody")
                        isConnecting = false
                        triggerReconnection()
                        return@launch
                    }
                } else {
                    Log.d("WebSocketManager", "Using saved credentials for connection. Device ID: $deviceId")
                }

                // Connect to WebSocket with credentials ready
                connectWebSocket()
            } catch (e: Exception) {
                Log.e("WebSocketManager", "Error in connect/register flow", e)
                isConnecting = false
                triggerReconnection()
            }
        }
    }

    private fun connectWebSocket() {
        Log.d("WebSocketManager", "ws connecting to URL: $serverUrl")
        val request = Request.Builder()
            .url(serverUrl)
            .build()

        webSocket?.cancel() // Cancel previous connection if any
        webSocket = client.newWebSocket(request, object : WebSocketListener() {
            override fun onOpen(webSocket: WebSocket, response: Response) {
                Log.d("WebSocketManager", "ws opened")
                Log.d("WebSocketManager", "WebSocket Connection opened. Authenticating...")
                authenticate(webSocket)

                // Set 10-second authentication timeout
                authTimeoutJob?.cancel()
                authTimeoutJob = scope.launch {
                    delay(10000)
                    if (isActive && !_connectionState.value) {
                        Log.e("WebSocketManager", "Authentication timed out (10s). Cancelling WebSocket connection...")
                        webSocket.cancel()
                    }
                }
            }

            override fun onMessage(webSocket: WebSocket, text: String) {
                scope.launch {
                    try {
                        val messageMap = gson.fromJson(text, Map::class.java)
                        val type = messageMap["type"] as? String
                        
                        if (type == "auth_ok") {
                            Log.d("WebSocketManager", "Authenticated successfully!")
                            authTimeoutJob?.cancel()
                            setConnectionState(true)
                            isConnecting = false
                            reconnectDelay = 1000L // Reset backoff
                            startHeartbeat()
                        } else if (type == "auth_fail") {
                            Log.e("WebSocketManager", "Authentication failed! Clearing tokens and triggering re-registration...")
                            authTimeoutJob?.cancel()
                            tokenManager.clear()
                            disconnect()
                            triggerReconnection()
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
                setConnectionState(false)
                stopHeartbeat()
                authTimeoutJob?.cancel()
            }

            override fun onClosed(webSocket: WebSocket, code: Int, reason: String) {
                Log.w("WebSocketManager", "Closed: $code / $reason. Triggering reconnect...")
                setConnectionState(false)
                isConnecting = false
                stopHeartbeat()
                authTimeoutJob?.cancel()
                if (this@WebSocketManager.webSocket === webSocket) {
                    this@WebSocketManager.webSocket = null
                }
                triggerReconnection()
            }

            override fun onFailure(webSocket: WebSocket, t: Throwable, response: Response?) {
                val responseDetails = if (response != null) {
                    "Code: ${response.code}, Message: ${response.message}"
                } else {
                    "None"
                }
                Log.e("WebSocketManager", "Failure: ${t.message}. Response details: $responseDetails. Triggering reconnect...", t)
                setConnectionState(false)
                isConnecting = false
                stopHeartbeat()
                authTimeoutJob?.cancel()
                if (this@WebSocketManager.webSocket === webSocket) {
                    this@WebSocketManager.webSocket = null
                }
                triggerReconnection()
            }
        })
    }

    private fun authenticate(ws: WebSocket) {
        val token = tokenManager.getAccessToken()
        val deviceId = tokenManager.getDeviceId()
        
        if (token.isNullOrEmpty() || deviceId.isNullOrEmpty()) {
            Log.e("WebSocketManager", "Cannot authenticate: Token or DeviceID is null/empty")
            ws.close(1008, "Credentials missing")
            return
        }
        
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
            Log.d("WebSocketManager", "Reconnection triggered. Delay: ${reconnectDelay}ms")
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
        stopHeartbeat()
        authTimeoutJob?.cancel()
        webSocket?.close(1000, "App closed")
        webSocket = null
        setConnectionState(false)
        isConnecting = false
    }
}
