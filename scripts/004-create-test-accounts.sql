-- Create sample test accounts for all user roles
-- These are test accounts with simple passwords for demonstration purposes

-- Admin test account
INSERT INTO users (id, email, password, name, role, assigned_gates, active, created_at)
VALUES (
  'test-admin-001',
  'admin.test@example.com',
  'admin123',
  'Test Admin',
  'admin',
  ARRAY['228', '229', '230'],
  true,
  CURRENT_TIMESTAMP
) ON CONFLICT (id) DO NOTHING;

-- Reception test accounts (assigned to different gates)
INSERT INTO users (id, email, password, name, role, assigned_gates, active, created_at)
VALUES (
  'test-reception-001',
  'reception1@example.com',
  'reception123',
  'Reception User 1',
  'reception',
  ARRAY['228'],
  true,
  CURRENT_TIMESTAMP
) ON CONFLICT (id) DO NOTHING;

INSERT INTO users (id, email, password, name, role, assigned_gates, active, created_at)
VALUES (
  'test-reception-002',
  'reception2@example.com',
  'reception123',
  'Reception User 2',
  'reception',
  ARRAY['229'],
  true,
  CURRENT_TIMESTAMP
) ON CONFLICT (id) DO NOTHING;

INSERT INTO users (id, email, password, name, role, assigned_gates, active, created_at)
VALUES (
  'test-reception-003',
  'reception3@example.com',
  'reception123',
  'Reception User 3',
  'reception',
  ARRAY['230'],
  true,
  CURRENT_TIMESTAMP
) ON CONFLICT (id) DO NOTHING;

-- Requester test accounts
INSERT INTO users (id, email, password, name, role, assigned_gates, active, created_at)
VALUES (
  'test-requester-001',
  'requester1@example.com',
  'requester123',
  'Test Requester 1',
  'requester',
  NULL,
  true,
  CURRENT_TIMESTAMP
) ON CONFLICT (id) DO NOTHING;

INSERT INTO users (id, email, password, name, role, assigned_gates, active, created_at)
VALUES (
  'test-requester-002',
  'requester2@example.com',
  'requester123',
  'Test Requester 2',
  'requester',
  NULL,
  true,
  CURRENT_TIMESTAMP
) ON CONFLICT (id) DO NOTHING;

INSERT INTO users (id, email, password, name, role, assigned_gates, active, created_at)
VALUES (
  'test-requester-003',
  'requester3@example.com',
  'requester123',
  'Test Requester 3',
  'requester',
  NULL,
  true,
  CURRENT_TIMESTAMP
) ON CONFLICT (id) DO NOTHING;

-- Approver 1 test accounts
INSERT INTO users (id, email, password, name, role, assigned_gates, active, created_at)
VALUES (
  'test-approver1-001',
  'approver1@example.com',
  'approver123',
  'Test Approver Level 1',
  'approver1',
  NULL,
  true,
  CURRENT_TIMESTAMP
) ON CONFLICT (id) DO NOTHING;

INSERT INTO users (id, email, password, name, role, assigned_gates, active, created_at)
VALUES (
  'test-approver1-002',
  'approver1.alt@example.com',
  'approver123',
  'Alternative Approver Level 1',
  'approver1',
  NULL,
  true,
  CURRENT_TIMESTAMP
) ON CONFLICT (id) DO NOTHING;

-- Approver 2 test accounts
INSERT INTO users (id, email, password, name, role, assigned_gates, active, created_at)
VALUES (
  'test-approver2-001',
  'approver2@example.com',
  'approver123',
  'Test Approver Level 2',
  'approver2',
  NULL,
  true,
  CURRENT_TIMESTAMP
) ON CONFLICT (id) DO NOTHING;

INSERT INTO users (id, email, password, name, role, assigned_gates, active, created_at)
VALUES (
  'test-approver2-002',
  'approver2.alt@example.com',
  'approver123',
  'Alternative Approver Level 2',
  'approver2',
  NULL,
  true,
  CURRENT_TIMESTAMP
) ON CONFLICT (id) DO NOTHING;
