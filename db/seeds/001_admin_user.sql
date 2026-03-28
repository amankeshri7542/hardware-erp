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

-- To create a new admin or change password, generate a hash:
--   node -e "require('bcrypt').hash('YourPassword', 12).then(console.log)"

INSERT INTO users (name, email, password_hash, role, is_active)
VALUES (
  'Aman Kumar',
  'admin@store.local',
  '$2b$12$JAxPAU7Qa5pWb1DS5PmgMuhXHKoDOeGey49g9RfNbsKmvUl4Wo2pe',
  'admin',
  true
)
ON CONFLICT (email) DO UPDATE SET
  password_hash = EXCLUDED.password_hash,
  name = EXCLUDED.name;
