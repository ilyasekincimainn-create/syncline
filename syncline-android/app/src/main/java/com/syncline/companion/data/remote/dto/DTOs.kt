package com.syncline.companion.data.remote.dto

data class RegisterRequest(
    val uuid: String,
    val fingerprint: String,
    val platform: String = "android",
    val pushToken: String,
    val model: String,
    val osVersion: String
)

data class TokenPair(
    val accessToken: String,
    val refreshToken: String,
    val expiresIn: Int,
    val tokenType: String
)

data class RegisterResponse(
    val deviceId: String,
    val userId: String,
    val pairCode: String,
    val tokens: TokenPair
)

data class RefreshRequest(
    val refreshToken: String
)

data class RefreshResponse(
    val tokens: TokenPair
)

data class WSMessage<T>(
    val type: String,
    val id: String,
    val timestamp: Long,
    val payload: T
)
