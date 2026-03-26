-- ============================================================================
-- Seed 001: Default Admin User
-- Hardware Store ERP
--
-- Creates the initial administrator account so the system can be accessed
-- after a fresh deployment.
--
-- IMPORTANT: Replace the password_hash placeholder with an actual bcrypt hash
-- before running this seed. You can generate one with:
--   node -e "require('bcrypt').hash('yourpassword', 12).then(console.log)"
-- ============================================================================

INSERT INTO users (name, email, password_hash, role, is_active)
VALUES (
  'Admin',
  'admin@store.local',
  '-- Replace with bcrypt hash of your password',
  'admin',
  true
);
