package com.syncline.companion.security

import android.content.Context
import android.content.SharedPreferences
import android.util.Log
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKeys

class TokenManager(context: Context) {
    private val sharedPrefs: SharedPreferences

    init {
        var prefs: SharedPreferences? = null
        try {
            val masterKeyAlias = MasterKeys.getOrCreate(MasterKeys.AES256_GCM_SPEC)
            prefs = EncryptedSharedPreferences.create(
                "security_prefs",
                masterKeyAlias,
                context,
                EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
                EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM
            )
            Log.d("TokenManager", "EncryptedSharedPreferences initialized successfully")
        } catch (e: Exception) {
            Log.e("TokenManager", "Failed to initialize EncryptedSharedPreferences, falling back to standard SharedPreferences", e)
            prefs = context.getSharedPreferences("security_prefs_fallback", Context.MODE_PRIVATE)
        }
        sharedPrefs = prefs!!
    }

    fun saveTokens(accessToken: String, refreshToken: String) {
        sharedPrefs.edit().apply {
            putString("access_token", accessToken)
            putString("refresh_token", refreshToken)
            commit()
        }
    }

    fun getAccessToken(): String? = sharedPrefs.getString("access_token", null)

    fun getRefreshToken(): String? = sharedPrefs.getString("refresh_token", null)

    fun saveDeviceId(deviceId: String) {
        sharedPrefs.edit().putString("device_id", deviceId).commit()
    }

    fun getDeviceId(): String? = sharedPrefs.getString("device_id", null)

    fun savePairCode(pairCode: String) {
        sharedPrefs.edit().putString("pair_code", pairCode).commit()
    }

    fun getPairCode(): String? = sharedPrefs.getString("pair_code", null)

    fun clear() {
        sharedPrefs.edit().clear().commit()
    }
}
