-- ============================================
-- User Activity Log Table
-- Crystal Sand Hotel Management System
-- ============================================

CREATE TABLE IF NOT EXISTS user_activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES system_users(id) ON DELETE CASCADE,
  user_name TEXT NOT NULL,
  user_role TEXT NOT NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  description TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_activity_user_id ON user_activity_log(user_id);
CREATE INDEX IF NOT EXISTS idx_user_activity_created_at ON user_activity_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_activity_entity_type ON user_activity_log(entity_type);
CREATE INDEX IF NOT EXISTS idx_user_activity_action ON user_activity_log(action);

ALTER TABLE user_activity_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read activity log"
  ON user_activity_log FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert activity log"
  ON user_activity_log FOR INSERT
  TO authenticated
  WITH CHECK (true);
