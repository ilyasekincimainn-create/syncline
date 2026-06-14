package com.syncline.companion.security

import android.content.Context
import android.os.Build
import android.provider.Settings
import java.security.MessageDigest
import java.util.UUID

object DeviceFingerprint {

    fun getUuid(context: Context): String {
        val androidId = Settings.Secure.getString(context.contentResolver, Settings.Secure.ANDROID_ID)
        return UUID.nameUUIDFromBytes(androidId.toByteArray(Charsets.UTF_8)).toString()
    }

    fun getFingerprint(context: Context): String {
        val raw = "${Build.BOARD}|${Build.BRAND}|${Build.DEVICE}|${Build.DISPLAY}|${Build.FINGERPRINT}|${Build.HOST}|${Build.ID}|${Build.MANUFACTURER}|${Build.MODEL}|${Build.PRODUCT}"
        val digest = MessageDigest.getInstance("SHA-256")
        val hashBytes = digest.digest(raw.toByteArray(Charsets.UTF_8))
        return hashBytes.joinToString("") { "%02x".format(it) }
    }

    fun getModel(): String {
        return "${Build.MANUFACTURER} ${Build.MODEL}"
    }

    fun getOsVersion(): String {
        return "Android ${Build.VERSION.RELEASE} (API ${Build.VERSION.SDK_INT})"
    }
}
