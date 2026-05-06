const { query } = require('./database');
const { logger } = require('./logger');

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS videos (
    id            UUID        PRIMARY KEY,
    uploader_id   TEXT        NOT NULL DEFAULT '',
    title         TEXT        NOT NULL DEFAULT '',
    description   TEXT        NOT NULL DEFAULT '',
    status        TEXT        NOT NULL DEFAULT 'processing',
    original_name TEXT,
    master_key    TEXT,
    thumbnail_key TEXT,
    rendition_keys JSONB      NOT NULL DEFAULT '{}',
    s3_prefix     TEXT,
    duration      INTEGER,
    resolution    TEXT,
    video_codec   TEXT,
    audio_codec   TEXT,
    error_message TEXT,
    privacy       TEXT        NOT NULL DEFAULT 'public',
    likes_count   INTEGER     NOT NULL DEFAULT 0,
    views_count   INTEGER     NOT NULL DEFAULT 0,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  CREATE TABLE IF NOT EXISTS profiles (
    user_id      TEXT        PRIMARY KEY,
    channel_name TEXT        UNIQUE NOT NULL,
    bio          TEXT        NOT NULL DEFAULT '',
    avatar_url   TEXT        NOT NULL DEFAULT '',
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  CREATE TABLE IF NOT EXISTS video_likes (
    video_id   UUID        NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
    user_id    TEXT        NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (video_id, user_id)
  );

  CREATE TABLE IF NOT EXISTS audit_log (
    id          BIGSERIAL   PRIMARY KEY,
    admin_id    TEXT        NOT NULL,
    action      TEXT        NOT NULL,
    target_type TEXT        NOT NULL,
    target_id   TEXT        NOT NULL,
    details     JSONB       NOT NULL DEFAULT '{}',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  CREATE TABLE IF NOT EXISTS suspensions (
    user_id          TEXT        PRIMARY KEY,
    suspended_by     TEXT        NOT NULL,
    reason           TEXT        NOT NULL DEFAULT '',
    suspended_until  TIMESTAMPTZ,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  CREATE TABLE IF NOT EXISTS transcripts (
    video_id      UUID        PRIMARY KEY REFERENCES videos(id) ON DELETE CASCADE,
    full_text     TEXT        NOT NULL DEFAULT '',
    segments      JSONB       NOT NULL DEFAULT '[]',
    language      TEXT,
    search_vector TSVECTOR GENERATED ALWAYS AS (to_tsvector('english', full_text)) STORED,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  CREATE TABLE IF NOT EXISTS watch_progress (
    user_id    TEXT        NOT NULL,
    video_id   UUID        NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
    position   INTEGER     NOT NULL DEFAULT 0,
    duration   INTEGER     NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, video_id)
  );

  CREATE TABLE IF NOT EXISTS heatmap_events (
    video_id UUID    NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
    bucket   INTEGER NOT NULL,
    count    INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (video_id, bucket)
  );

  CREATE TABLE IF NOT EXISTS view_log (
    id        BIGSERIAL   PRIMARY KEY,
    video_id  UUID        NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
    user_id   TEXT        NOT NULL,
    viewed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  CREATE INDEX IF NOT EXISTS idx_videos_uploader    ON videos(uploader_id);
  CREATE INDEX IF NOT EXISTS idx_videos_status      ON videos(status);
  CREATE INDEX IF NOT EXISTS idx_videos_privacy     ON videos(privacy);
  CREATE INDEX IF NOT EXISTS idx_audit_created      ON audit_log(created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_transcripts_search ON transcripts USING GIN(search_vector);
  CREATE INDEX IF NOT EXISTS idx_watch_progress_vid ON watch_progress(video_id);
  CREATE INDEX IF NOT EXISTS idx_view_log_video     ON view_log(video_id, viewed_at DESC);
`;

async function migrate() {
  try {
    await query(SCHEMA);
    logger.info('✅ DB migration complete');
  } catch (err) {
    logger.error(`Migration failed: ${err.message}`);
    throw err;
  }
}

module.exports = { migrate };
