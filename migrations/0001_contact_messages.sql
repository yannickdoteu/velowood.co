-- Contact form submissions. Rows are deleted after 180 days by the Worker's cron trigger.
CREATE TABLE IF NOT EXISTS contact_messages (
  id           TEXT PRIMARY KEY,                -- UUID
  created_at   TEXT NOT NULL,                   -- ISO 8601 UTC, e.g. 2026-11-24T10:00:00.000Z
  lang         TEXT NOT NULL,
  role         TEXT NOT NULL CHECK (role IN ('rider', 'hotel', 'partner', 'press', 'other')),
  name         TEXT NOT NULL,
  email        TEXT NOT NULL,
  message      TEXT NOT NULL,
  email_status TEXT NOT NULL DEFAULT 'pending' CHECK (email_status IN ('pending', 'sent', 'failed'))
);
CREATE INDEX IF NOT EXISTS idx_contact_messages_created_at ON contact_messages (created_at);
