# Android Companion Battery Optimization & OEM Bypass Guide

This document provides a comprehensive guide to maintaining an uninterrupted background execution state for the SyncLine Android Companion App. It addresses standard Android Doze limits and provides developer patterns (Kotlin) and user-facing instructions (Turkish) to bypass aggressive battery-saving systems on OEM-customized Android platforms (Xiaomi, Samsung, Huawei, OnePlus, Oppo).

---

## 1. Background Constraints & The OEM Problem

Standard Android introduces **Doze Mode** and **App Standby** to restrict CPU and network activity when a device is idle. However, various OEMs implement proprietary task killers that terminate background processes, release system wake locks, and ignore standard foreground service configurations.

### OEM Severity Level Matrix
| OEM | System Tool | Severity | Failure Behavior | Bypass Complexity |
| :--- | :--- | :--- | :--- | :--- |
| **Xiaomi / Poco** | MIUI Battery Saver & Autostart | Critical | Kills WebSocket connection after 5 minutes of screen-off. | High (Autostart + No Restrictions required) |
| **Samsung** | Device Care & App Sleeping | High | Puts companion app into "Deep Sleep", freezing background listeners. | Medium (Add to Never Sleeping Apps list) |
| **Huawei** | Power Intensive Apps | Critical | Forcibly terminates foreground services not whitelisted. | High (App Launch custom configurations) |
| **OnePlus** | Battery Optimization | Medium | Disconnects long-lived sockets during sleep states. | Low (Disable optimization in settings) |

---

## 2. Technical Kotlin Patterns

### 2.1. Requesting Battery Optimization Exemption
To request exclusion from the standard system-wide battery-saver limitations, the application prompts the user to grant the `REQUEST_IGNORE_BATTERY_OPTIMIZATIONS` permission.

```kotlin
import android.annotation.SuppressLint
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.PowerManager
import android.provider.Settings

object BatteryOptimizationHelper {

    fun isIgnoringBatteryOptimizations(context: Context): Boolean {
        val powerManager = context.getSystemService(Context.POWER_SERVICE) as PowerManager
        return powerManager.isIgnoringBatteryOptimizations(context.packageName)
    }

    @SuppressLint("BatteryLife")
    fun requestIgnoreBatteryOptimization(context: Context) {
        if (!isIgnoringBatteryOptimizations(context)) {
            val intent = Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS).apply {
                data = Uri.parse("package:${context.packageName}")
                flags = Intent.FLAG_ACTIVITY_NEW_TASK
            }
            context.startActivity(intent)
        }
    }
}
```

### 2.2. Robust WakeLock and Wi-Fi Lock Management
Acquired inside the `onCreate()` of the `CompanionForegroundService`. It forces the CPU and Wi-Fi chipsets to remain powered even during deep sleep.

```kotlin
import android.content.Context
import android.net.wifi.WifiManager
import android.os.PowerManager
import android.util.Log

class ConnectionLockManager(private val context: Context) {
    private var wakeLock: PowerManager.WakeLock? = null
    private var wifiLock: WifiManager.WifiLock? = null

    fun acquireLocks() {
        try {
            val powerManager = context.getSystemService(Context.POWER_SERVICE) as PowerManager
            if (wakeLock == null) {
                wakeLock = powerManager.newWakeLock(
                    PowerManager.PARTIAL_WAKE_LOCK,
                    "SyncLine::CompanionWakeLock"
                ).apply {
                    setReferenceCounted(false)
                    acquire()
                }
            }
            
            val wifiManager = context.applicationContext.getSystemService(Context.WIFI_SERVICE) as WifiManager
            if (wifiLock == null) {
                // High performance Wi-Fi lock keeps connection active in low-power modes
                wifiLock = wifiManager.createWifiLock(
                    WifiManager.WIFI_MODE_FULL_HIGH_PERF,
                    "SyncLine::CompanionWifiLock"
                ).apply {
                    setReferenceCounted(false)
                    acquire()
                }
            }
            Log.d("LockManager", "CPU and Wi-Fi high performance locks acquired successfully.")
        } catch (e: Exception) {
            Log.e("LockManager", "Failed to acquire locks", e)
        }
    }

    fun releaseLocks() {
        try {
            wakeLock?.let { if (it.isHeld) it.release() }
            wifiLock?.let { if (it.isHeld) it.release() }
            wakeLock = null
            wifiLock = null
            Log.w("LockManager", "CPU and Wi-Fi locks released.")
        } catch (e: Exception) {
            Log.e("LockManager", "Error releasing locks", e)
        }
    }
}
```

### 2.3. Dynamic OEM Autostart Setting Redirection
For OEMs that block background receiver operations unless explicitly whitelisted in custom Autostart controls, developers must deep-link users directly to the platform settings.

```kotlin
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.util.Log

object OemAutostartHelper {

    private val AUTO_START_INTENTS = listOf(
        // Xiaomi
        Intent().setComponent(ComponentName("com.miui.securitycenter", "com.miui.permcenter.autostart.AutoStartManagementActivity")),
        // Huawei
        Intent().setComponent(ComponentName("com.huawei.systemmanager", "com.huawei.systemmanager.optimize.process.ProtectActivity")),
        Intent().setComponent(ComponentName("com.huawei.systemmanager", "com.huawei.systemmanager.startupmgr.ui.StartupNormalAppListActivity")),
        // Samsung
        Intent().setComponent(ComponentName("com.samsung.android.sm_cn", "com.samsung.android.smartmanager.ui.MainActivity")),
        // OnePlus
        Intent().setComponent(ComponentName("com.oneplus.security", "com.oneplus.security.chainlaunch.defaultapp.DefaultAppActivity")),
        // Oppo
        Intent().setComponent(ComponentName("com.coloros.safecenter", "com.coloros.safecenter.permission.startup.StartupAppListActivity"))
    )

    fun openOemAutostartSettings(context: Context): Boolean {
        for (intent in AUTO_START_INTENTS) {
            try {
                intent.flags = Intent.FLAG_ACTIVITY_NEW_TASK
                context.startActivity(intent)
                return true
            } catch (e: Exception) {
                Log.d("OemHelper", "Failed to resolve intent: ${intent.component?.className}")
            }
        }
        return false
    }
}
```

### 2.4. Service Auto-Restart Broadcast Receiver
Catches system shutdown/boot triggers, network connectivity changes, and application kills to automatically re-initialize the `CompanionForegroundService`.

```kotlin
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Build
import android.util.Log

class ServiceRestarterReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        Log.w("Restarter", "System event '${intent.action}' triggered. Restarting SyncLine service...")
        
        val serviceIntent = Intent(context, CompanionForegroundService::class.java)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            context.startForegroundService(serviceIntent)
        } else {
            context.startService(serviceIntent)
        }
    }
}
```

---

## 3. User Configuration Guides (Kullanıcı Ayarları Rehberi)

Aşağıdaki adımlar, SyncLine servisinin arka planda kesintisiz çalışabilmesi için popüler Android telefon markalarında yapılması gereken ayarları listeler.

### 3.1. Xiaomi / Redmi (MIUI / HyperOS) Ayarları
1.  **Otomatik Başlatma (Autostart) İzni:**
    *   Cihaz **Ayarlar**'ına gidin.
    *   **Uygulamalar** > **Uygulamaları Yönet** > **SyncLine** seçeneğine tıklayın.
    *   **Otomatik Başlat (Autostart)** seçeneğini aktif hale getirin.
2.  **Pil Tasarrufu Modunu Devre Dışı Bırakma:**
    *   Aynı menüde alt kısımda yer alan **Pil Tasarrufu (Battery Saver)** seçeneğine dokunun.
    *   **Kısıtlama Yok (No Restrictions)** seçeneğini işaretleyin.
3.  **Uygulamayı Belleğe Kilitleme:**
    *   Telefonun **Son Uygulamalar (Recents)** ekranını açın.
    *   **SyncLine** kartına basılı tutun ve beliren **Kilit (Lock)** ikonuna tıklayın. Bu işlem, RAM temizleyici sistemlerin uygulamayı kapatmasını önler.

### 3.2. Samsung Ayarları
1.  **Arka Plan Sınırlarını Kaldırma:**
    *   **Ayarlar** > **Cihaz Bakımı (Device Care)** > **Pil (Battery)** menüsüne girin.
    *   **Arka plan kullanım sınırları (Background usage limits)** seçeneğine dokunun.
    *   **Asla uyutulmayacak uygulamalar (Never sleeping apps)** listesine gidin.
    *   Sağ üstteki **+** butonuna basarak **SyncLine** uygulamasını bu listeye ekleyin.
2.  **Otomatik Optimizasyonu Kapatma:**
    *   Cihaz Bakımı ayarlarında yer alan **Otomatik Optimizasyon (Auto Optimization)** özelliğini devre dışı bırakın.

### 3.3. Huawei (EMUI) Ayarları
1.  **Manuel Uygulama Yönetimi:**
    *   **Ayarlar** > **Pil (Battery)** > **Uygulama Başlatma (App Launch)** menüsünü açın.
    *   **SyncLine** uygulamasını bulun ve yanındaki otomatik anahtarı kapatın.
    *   Açılan pop-up menüde **Otomatik Başlatma (Auto-launch)**, **İkincil Başlatma (Secondary launch)** ve **Arka Planda Çalışma (Run in background)** seçeneklerinin tümünü **aktif** konuma getirin.

### 3.4. OnePlus / Oppo Ayarları
1.  **Pil Optimizasyonunu Devre Dışı Bırakma:**
    *   **Ayarlar** > **Pil (Battery)** > **Pil Optimizasyonu (Battery Optimization)** seçeneğine gidin.
    *   Listeden **SyncLine** uygulamasını bularak **Optimize Etme (Don't Optimize)** seçeneğini işaretleyin.
2.  **Gelişmiş Optimizasyonları Kapatma:**
    *   Pil ayarlarındaki "Gelişmiş Ayarlar" sekmesinde bulunan **Derin Optimizasyon (Deep Optimization)** veya **Uyku Bekleme Optimizasyonu (Sleep Standby Optimization)** özelliklerini devre dışı bırakın.
