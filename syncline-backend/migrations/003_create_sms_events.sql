CREATE TABLE IF NOT EXISTS sms_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    sender VARCHAR(100) NOT NULL,
    content_encrypted TEXT NOT NULL,
    content_iv VARCHAR(100) NOT NULL,
    message_hash VARCHAR(64) NOT NULL,
    received_at TIMESTAMP WITH TIME ZONE NOT NULL,
    delivered_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_message_hash_per_user UNIQUE (user_id, message_hash)
);

CREATE INDEX IF NOT EXISTS idx_sms_events_user_received ON sms_events(user_id, received_at DESC);
