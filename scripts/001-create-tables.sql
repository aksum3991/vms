-- Create Users table
CREATE TABLE IF NOT EXISTS users (
  id VARCHAR(255) PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  name VARCHAR(255) NOT NULL,
  role VARCHAR(50) NOT NULL CHECK (role IN ('admin', 'requester', 'approver1', 'approver2', 'reception')),
  assigned_gates TEXT[],
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create Requests table
CREATE TABLE IF NOT EXISTS requests (
  id VARCHAR(255) PRIMARY KEY,
  approval_number VARCHAR(100) UNIQUE,
  requested_by VARCHAR(255) NOT NULL,
  requested_by_email VARCHAR(255) NOT NULL,
  destination TEXT NOT NULL,
  gate VARCHAR(50) NOT NULL,
  from_date VARCHAR(50) NOT NULL,
  to_date VARCHAR(50) NOT NULL,
  purpose TEXT NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'draft',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  approver1_comment TEXT,
  approver1_date VARCHAR(50),
  approver1_by VARCHAR(255),
  approver2_comment TEXT,
  approver2_date VARCHAR(50),
  approver2_by VARCHAR(255)
);

-- Create Guests table
CREATE TABLE IF NOT EXISTS guests (
  id VARCHAR(255) PRIMARY KEY,
  request_id VARCHAR(255) NOT NULL REFERENCES requests(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  organization VARCHAR(255) NOT NULL,
  email VARCHAR(255),
  phone VARCHAR(50),
  laptop BOOLEAN DEFAULT FALSE,
  mobile BOOLEAN DEFAULT FALSE,
  flash BOOLEAN DEFAULT FALSE,
  other_device BOOLEAN DEFAULT FALSE,
  other_device_description TEXT,
  id_photo_url TEXT,
  check_in_time VARCHAR(50),
  check_out_time VARCHAR(50)
);

-- Create Surveys table
CREATE TABLE IF NOT EXISTS surveys (
  id VARCHAR(255) PRIMARY KEY,
  request_id VARCHAR(255) NOT NULL REFERENCES requests(id) ON DELETE CASCADE,
  guest_id VARCHAR(255) NOT NULL,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create Notifications table
CREATE TABLE IF NOT EXISTS notifications (
  id VARCHAR(255) PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL,
  message TEXT NOT NULL,
  request_id VARCHAR(255) NOT NULL,
  read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create Settings table
CREATE TABLE IF NOT EXISTS settings (
  id SERIAL PRIMARY KEY,
  approval_steps INTEGER DEFAULT 2 CHECK (approval_steps IN (1, 2)),
  enable_email_notifications BOOLEAN DEFAULT TRUE,
  enable_sms_notifications BOOLEAN DEFAULT TRUE,
  gates TEXT[] DEFAULT ARRAY['228', '229', '230']
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_requests_status ON requests(status);
CREATE INDEX IF NOT EXISTS idx_requests_requested_by_email ON requests(requested_by_email);
CREATE INDEX IF NOT EXISTS idx_requests_approval_number ON requests(approval_number);
CREATE INDEX IF NOT EXISTS idx_guests_request_id ON guests(request_id);
CREATE INDEX IF NOT EXISTS idx_guests_name ON guests(name);
CREATE INDEX IF NOT EXISTS idx_guests_phone ON guests(phone);
CREATE INDEX IF NOT EXISTS idx_surveys_request_id ON surveys(request_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(read);

-- Insert default settings if not exists
INSERT INTO settings (id, approval_steps, enable_email_notifications, enable_sms_notifications, gates)
VALUES (1, 2, TRUE, TRUE, ARRAY['228', '229', '230'])
ON CONFLICT DO NOTHING;

-- Insert default admin user (password: admin123)
INSERT INTO users (id, email, password, name, role, active, created_at)
VALUES ('admin-1', 'admin@example.com', 'admin123', 'System Admin', 'admin', TRUE, CURRENT_TIMESTAMP)
ON CONFLICT (email) DO NOTHING;
