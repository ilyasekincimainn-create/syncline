package com.syncline.companion.data.local.entity

import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "sms_events")
data class SmsEventEntity(
    @PrimaryKey val id: String,
    val sender: String,
    val contentEncrypted: String,
    val contentIv: String,
    val receivedAt: Long,
    val deliveredAt: Long?,
    val messageHash: String
)
