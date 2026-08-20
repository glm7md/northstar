ALTER TABLE students ADD COLUMN IF NOT EXISTS active_session_id TEXT;
ALTER TABLE students ADD COLUMN IF NOT EXISTS active_session_expires_at BIGINT;