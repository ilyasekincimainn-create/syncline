package com.syncline.companion.data.local.dao

import androidx.room.*
import com.syncline.companion.data.local.entity.SmsEventEntity
import com.syncline.companion.data.local.entity.CallEventEntity
import com.syncline.companion.data.local.entity.OfflineQueueEntity
import kotlinx.coroutines.flow.Flow

@Dao
interface SmsEventDao {
    @Query("SELECT * FROM sms_events ORDER BY receivedAt DESC")
    fun getAllSmsEvents(): Flow<List<SmsEventEntity>>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertSmsEvent(event: SmsEventEntity)

    @Query("SELECT EXISTS(SELECT * FROM sms_events WHERE messageHash = :hash)")
    suspend fun isDuplicate(hash: String): Boolean
}

@Dao
interface CallEventDao {
    @Query("SELECT * FROM call_events ORDER BY startedAt DESC")
    fun getAllCallEvents(): Flow<List<CallEventEntity>>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertCallEvent(event: CallEventEntity)
}

@Dao
interface OfflineQueueDao {
    @Query("SELECT * FROM offline_queue ORDER BY createdAt ASC")
    suspend fun getQueuedEvents(): List<OfflineQueueEntity>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun enqueueEvent(event: OfflineQueueEntity)

    @Delete
    suspend fun dequeueEvent(event: OfflineQueueEntity)

    @Query("DELETE FROM offline_queue")
    suspend fun clearQueue()
}
