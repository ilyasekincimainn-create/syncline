CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    android_device_id UUID NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
    ios_device_id UUID REFERENCES devices(id) ON DELETE SET NULL,
    pair_code VARCHAR(6) NOT NULL,
    paired_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_android_device UNIQUE (android_device_id)
);

CREATE INDEX IF NOT EXISTS idx_users_pair_code ON users(pair_code);
