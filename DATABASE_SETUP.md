# PostgreSQL Database Setup Guide

This document management system now uses PostgreSQL as the database backend instead of localStorage.

## Prerequisites

- PostgreSQL 12 or higher installed on your system
- Node.js 18 or higher

## Installation Steps

### 1. Install PostgreSQL

**macOS (using Homebrew):**
```bash
brew install postgresql@16
brew services start postgresql@16
```

**Ubuntu/Debian:**
```bash
sudo apt update
sudo apt install postgresql postgresql-contrib
sudo systemctl start postgresql
```

**Windows:**
Download and install from [PostgreSQL Official Website](https://www.postgresql.org/download/windows/)

### 2. Create Database

Connect to PostgreSQL:
```bash
psql -U postgres
```

Create the database:
```sql
CREATE DATABASE document_management;
```

Exit psql:
```sql
\q
```

### 3. Configure Environment Variables

Create a `.env.local` file in the project root:

```env
DB_HOST=localhost
DB_PORT=5432
DB_NAME=document_management
DB_USER=postgres
DB_PASSWORD=your_password_here
NODE_ENV=development
```

Replace `your_password_here` with your PostgreSQL password.

### 4. Run Database Migration

The system will automatically create tables when you run the SQL script. You can execute it manually:

```bash
psql -U postgres -d document_management -f scripts/001-create-tables.sql
```

Or use a PostgreSQL client like pgAdmin or DBeaver to execute the script.

### 5. Start the Application

```bash
npm install
npm run dev
```

## Database Schema

The system creates the following tables:

- **users** - Store user accounts and roles
- **requests** - Store visit requests
- **guests** - Store guest information for each request
- **surveys** - Store guest feedback surveys
- **notifications** - Store system notifications
- **settings** - Store application settings

## Default Credentials

The migration script creates a default admin user:

- **Email:** admin@example.com
- **Password:** admin123

Please change this password after first login.

## Verification

To verify the database is set up correctly:

```sql
psql -U postgres -d document_management

-- List all tables
\dt

-- Check users table
SELECT * FROM users;

-- Check settings
SELECT * FROM settings;
```

## Troubleshooting

### Connection Issues

If you get connection errors:

1. Check PostgreSQL is running:
   ```bash
   # macOS
   brew services list
   
   # Linux
   sudo systemctl status postgresql
   ```

2. Verify database exists:
   ```bash
   psql -U postgres -l
   ```

3. Check environment variables in `.env.local`

### Permission Issues

If you get permission errors:

```sql
-- Grant all privileges
GRANT ALL PRIVILEGES ON DATABASE document_management TO postgres;
```

### Port Conflicts

If port 5432 is in use, change `DB_PORT` in `.env.local` and update PostgreSQL configuration.

## Migration from localStorage

If you have existing data in localStorage, you'll need to manually export and import it. The old localStorage data won't be automatically migrated.

## Backup and Restore

### Backup
```bash
pg_dump -U postgres document_management > backup.sql
```

### Restore
```bash
psql -U postgres document_management < backup.sql
