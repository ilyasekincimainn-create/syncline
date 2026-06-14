CREATE TABLE IF NOT EXISTS devices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    uuid VARCHAR(255) UNIQUE NOT NULL,
    platform VARCHAR(50) NOT NULL CHECK (platform IN ('android', 'ios')),
    fingerprint VARCHAR(255) NOT NULL,
    push_token VARCHAR(500) NOT NULL,
    model VARCHAR(255) NOT NULL,
    os_version VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_seen TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_devices_uuid ON devices(uuid);
