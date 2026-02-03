-- Insert default admin user
INSERT INTO users (id, email, password, name, role, assigned_gates, active, created_at)
VALUES (
  '1',
  'admin@example.com',
  'admin123',
  'Admin User',
  'admin',
  ARRAY['228', '229', '230'],
  true,
  CURRENT_TIMESTAMP
) ON CONFLICT (id) DO NOTHING;

-- Insert default settings
INSERT INTO settings (id, approval_steps, enable_email_notifications, enable_sms_notifications, gates)
VALUES (
  1,
  2,
  true,
  true,
  ARRAY['228', '229', '230']
) ON CONFLICT (id) DO NOTHING;
