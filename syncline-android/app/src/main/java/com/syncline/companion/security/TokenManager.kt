package com.syncline.companion.security

import android.content.Context
import android.content.SharedPreferences
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKeys

class TokenManager(context: Context) {
    private val masterKeyAlias = MasterKeys.getOrCreate(MasterKeys.AES256_GCM_SPEC)
    
    private val sharedPrefs: SharedPreferences = EncryptedSharedPreferences.create(
        "security_prefs",
        masterKeyAlias,
        context,
        EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
        EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM
    )

    fun saveTokens(accessToken: String, refreshToken: String) {
        sharedPrefs.edit().apply {
            putString("access_token", accessToken)
            putString("refresh_token", refreshToken)
            apply()
        }
    }

    fun getAccessToken(): String? = sharedPrefs.getString("access_token", null)

    fun getRefreshToken(): String? = sharedPrefs.getString("refresh_token", null)

    fun saveDeviceId(deviceId: String) {
        sharedPrefs.edit().putString("device_id", deviceId).apply()
    }

    fun getDeviceId(): String? = sharedPrefs.getString("device_id", null)

    fun savePairCode(pairCode: String) {
        sharedPrefs.edit().putString("pair_code", pairCode).apply()
    }

    fun getPairCode(): String? = sharedPrefs.getString("pair_code", null)

    fun clear() {
        sharedPrefs.edit().clear().apply()
    }
}
