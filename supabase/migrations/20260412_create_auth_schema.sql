-- ============================================
-- Role-Based Authentication Schema
-- Crystal Sand Hotel Management System
-- ============================================

-- 1. System Users Table
-- Maps Supabase Auth users to application roles
CREATE TABLE IF NOT EXISTS system_users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('super_admin', 'admin', 'user')),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES system_users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. System Activation Table
-- Stores global system on/off configuration (singleton row)
-- Named 'system_activation' to avoid conflict with existing 'system_settings'
CREATE TABLE IF NOT EXISTS system_activation (
  id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  is_system_active BOOLEAN NOT NULL DEFAULT true,
  deactivated_by UUID REFERENCES system_users(id) ON DELETE SET NULL,
  deactivated_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Insert default system activation (system active by default)
INSERT INTO system_activation (id, is_system_active)
VALUES (1, true)
ON CONFLICT (id) DO NOTHING;

-- 3. Indexes
CREATE INDEX IF NOT EXISTS idx_system_users_role ON system_users(role);
CREATE INDEX IF NOT EXISTS idx_system_users_email ON system_users(email);
CREATE INDEX IF NOT EXISTS idx_system_users_created_by ON system_users(created_by);

-- 4. Updated_at trigger
CREATE OR REPLACE FUNCTION update_system_users_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_system_users_updated_at
  BEFORE UPDATE ON system_users
  FOR EACH ROW
  EXECUTE FUNCTION update_system_users_updated_at();

CREATE OR REPLACE FUNCTION update_system_activation_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_system_activation_updated_at
  BEFORE UPDATE ON system_activation
  FOR EACH ROW
  EXECUTE FUNCTION update_system_activation_updated_at();

-- 5. Row Level Security
ALTER TABLE system_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_activation ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read system_users
CREATE POLICY "Authenticated users can read system_users"
  ON system_users FOR SELECT
  TO authenticated
  USING (true);

-- Allow authenticated users to insert system_users (creation is validated in app)
CREATE POLICY "Authenticated users can insert system_users"
  ON system_users FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Allow authenticated users to update system_users
CREATE POLICY "Authenticated users can update system_users"
  ON system_users FOR UPDATE
  TO authenticated
  USING (true);

-- Allow authenticated users to delete system_users
CREATE POLICY "Authenticated users can delete system_users"
  ON system_users FOR DELETE
  TO authenticated
  USING (true);

-- Allow authenticated users to read system_activation
CREATE POLICY "Authenticated users can read system_activation"
  ON system_activation FOR SELECT
  TO authenticated
  USING (true);

-- Allow authenticated users to update system_activation
CREATE POLICY "Authenticated users can update system_activation"
  ON system_activation FOR UPDATE
  TO authenticated
  USING (true);

-- ============================================
-- INITIAL SETUP INSTRUCTIONS:
-- ============================================
-- After running this migration:
--
-- 1. Go to Supabase Dashboard → Authentication → Users → Add User
--    Create a user with your desired email and password
--
-- 2. Copy the user's UUID from the dashboard
--
-- 3. Run this SQL (replace the values):
--
--    INSERT INTO system_users (id, email, full_name, role)
--    VALUES (
--      'YOUR-USER-UUID-HERE',
--      'your-email@example.com',
--      'Super Admin',
--      'super_admin'
--    );
-- ============================================
