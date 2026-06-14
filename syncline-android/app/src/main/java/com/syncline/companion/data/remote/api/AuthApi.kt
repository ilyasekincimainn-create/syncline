package com.syncline.companion.data.remote.api

import com.syncline.companion.data.remote.dto.*
import retrofit2.Response
import retrofit2.http.Body
import retrofit2.http.POST

interface AuthApi {

    @POST("api/auth/register")
    suspend fun registerDevice(
        @Body request: RegisterRequest
    ): Response<RegisterResponse>

    @POST("api/auth/token/refresh")
    suspend fun refreshToken(
        @Body request: RefreshRequest
    ): Response<RefreshResponse>
}
