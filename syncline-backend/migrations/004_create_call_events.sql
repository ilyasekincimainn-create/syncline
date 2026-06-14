CREATE TYPE call_status_type AS ENUM ('ringing', 'answered', 'ended', 'missed', 'rejected');

CREATE TABLE IF NOT EXISTS call_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    caller VARCHAR(100) NOT NULL,
    caller_name VARCHAR(255),
    status call_status_type NOT NULL,
    started_at TIMESTAMP WITH TIME ZONE NOT NULL,
    answered_at TIMESTAMP WITH TIME ZONE,
    ended_at TIMESTAMP WITH TIME ZONE,
    duration_sec INT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_call_events_user_started ON call_events(user_id, started_at DESC);
