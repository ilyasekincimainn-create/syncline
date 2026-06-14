package com.syncline.companion.data.local

import androidx.room.Database
import androidx.room.RoomDatabase
import com.syncline.companion.data.local.dao.SmsEventDao
import com.syncline.companion.data.local.dao.CallEventDao
import com.syncline.companion.data.local.dao.OfflineQueueDao
import com.syncline.companion.data.local.entity.SmsEventEntity
import com.syncline.companion.data.local.entity.CallEventEntity
import com.syncline.companion.data.local.entity.OfflineQueueEntity

@Database(
    entities = [SmsEventEntity::class, CallEventEntity::class, OfflineQueueEntity::class],
    version = 1,
    exportSchema = false
)
abstract class SyncLineDatabase : RoomDatabase() {
    abstract fun smsEventDao(): SmsEventDao
    abstract fun callEventDao(): CallEventDao
    abstract fun offlineQueueDao(): OfflineQueueDao
}
