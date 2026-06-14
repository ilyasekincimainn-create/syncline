package com.syncline.companion.data.local.entity

import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "offline_queue")
data class OfflineQueueEntity(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val eventType: String,
    val payloadEncrypted: String,
    val payloadIv: String,
    val createdAt: Long = System.currentTimeMillis(),
    val attempts: Int = 0
)
