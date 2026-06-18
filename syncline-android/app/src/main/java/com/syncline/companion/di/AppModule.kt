package com.syncline.companion.di

import android.content.Context
import androidx.room.Room
import com.syncline.companion.data.local.SyncLineDatabase
import com.syncline.companion.data.local.dao.*
import com.syncline.companion.data.remote.api.AuthApi
import com.syncline.companion.data.remote.websocket.WebSocketManager
import com.syncline.companion.security.CryptoManager
import com.syncline.companion.security.TokenManager
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.android.qualifiers.ApplicationContext
import dagger.hilt.components.SingletonComponent
import okhttp3.OkHttpClient
import okhttp3.logging.HttpLoggingInterceptor
import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory
import java.util.concurrent.TimeUnit
import javax.inject.Singleton

@Module
@InstallIn(SingletonComponent::class)
object AppModule {

    private const val BASE_URL = "https://syncline-production.up.railway.app/"
    private const val WS_URL = "wss://syncline-production.up.railway.app/ws"

    @Provides
    @Singleton
    fun provideContext(@ApplicationContext context: Context): Context = context

    @Provides
    @Singleton
    fun provideTokenManager(@ApplicationContext context: Context): TokenManager =
        TokenManager(context)

    @Provides
    @Singleton
    fun provideCryptoManager(): CryptoManager = CryptoManager()

    @Provides
    @Singleton
    fun provideDatabase(@ApplicationContext context: Context): SyncLineDatabase =
        Room.databaseBuilder(
            context,
            SyncLineDatabase::class.java,
            "syncline.db"
        ).fallbackToDestructiveMigration().build()

    @Provides
    @Singleton
    fun provideSmsEventDao(database: SyncLineDatabase): SmsEventDao = database.smsEventDao()

    @Provides
    @Singleton
    fun provideCallEventDao(database: SyncLineDatabase): CallEventDao = database.callEventDao()

    @Provides
    @Singleton
    fun provideOfflineQueueDao(database: SyncLineDatabase): OfflineQueueDao = database.offlineQueueDao()

    @Provides
    @Singleton
    fun provideOkHttpClient(): OkHttpClient {
        val logging = HttpLoggingInterceptor().apply {
            level = HttpLoggingInterceptor.Level.BODY
        }
        return OkHttpClient.Builder()
            .connectTimeout(15, TimeUnit.SECONDS)
            .readTimeout(15, TimeUnit.SECONDS)
            .writeTimeout(15, TimeUnit.SECONDS)
            .addInterceptor(logging)
            .build()
    }

    @Provides
    @Singleton
    fun provideAuthApi(okHttpClient: OkHttpClient): AuthApi {
        return Retrofit.Builder()
            .baseUrl(BASE_URL)
            .client(okHttpClient)
            .addConverterFactory(GsonConverterFactory.create())
            .build()
            .create(AuthApi::class.java)
    }

    @Provides
    @Singleton
    fun provideWebSocketManager(
        @ApplicationContext context: Context,
        okHttpClient: OkHttpClient,
        tokenManager: TokenManager,
        authApi: AuthApi
    ): WebSocketManager {
        val wsClient = OkHttpClient.Builder()
            .connectTimeout(15, TimeUnit.SECONDS)
            .readTimeout(15, TimeUnit.SECONDS)
            .writeTimeout(15, TimeUnit.SECONDS)
            .pingInterval(15, TimeUnit.SECONDS)
            .build()

        return WebSocketManager(
            context = context,
            client = wsClient,
            tokenManager = tokenManager,
            authApi = authApi,
            serverUrl = WS_URL
        )
    }
}
