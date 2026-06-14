package com.syncline.companion.data.local.entity

import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "call_events")
data class CallEventEntity(
    @PrimaryKey val id: String,
    val caller: String,
    val callerName: String?,
    val status: String,
    val startedAt: Long,
    val answeredAt: Long?,
    val endedAt: Long?,
    val durationSec: Int?
)
