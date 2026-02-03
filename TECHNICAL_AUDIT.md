# Technical Audit & Functional Map
## Visitor Management System (VMS3)

---

## Executive Summary

**This is a Visitor Management System (VMS) built with Next.js 14 that manages guest visit requests through a multi-level approval workflow.** The system supports role-based access control (admin, requester, approver1, approver2, reception), handles guest check-in/check-out processes, generates QR codes for approvals, sends email/SMS notifications, and maintains comprehensive audit logs. **The application uses PostgreSQL as the database backend with Prisma ORM, implements client-side authentication via localStorage, and follows Next.js App Router architecture with Server Actions for data mutations.**

---

## 1. Structural Blueprint

### 1.1 Project Pattern

**Architecture Pattern: Layered Architecture with Server Actions (Next.js App Router)**

- **Presentation Layer**: React components in `/app` and `/components` directories
- **Business Logic Layer**: Server Actions in `/lib/actions.ts` (marked with `'use server'`)
- **Data Access Layer**: Prisma ORM client in `/lib/db.ts`
- **Database Layer**: PostgreSQL database

**Key Characteristics:**
- **Monolithic Full-Stack Application**: Single Next.js application handling both frontend and backend
- **Server Components & Client Components**: Mix of server-rendered and client-side interactive components
- **Server Actions**: Next.js 14 Server Actions pattern for mutations (no traditional REST API routes except QR generation)
- **Component-Based UI**: Radix UI primitives with shadcn/ui styling

### 1.2 Entry Points

#### Application Entry Point
- **File**: `app/layout.tsx`
- **Function**: Root layout wraps entire application
- **Initialization Flow**:
  1. `app/layout.tsx` → Wraps app with `AuthProvider` and `SidebarLayout`
  2. `lib/auth.tsx` → `AuthProvider` initializes user from localStorage on mount
  3. `lib/storage.ts` → Reads `document_management_current_user` from localStorage
  4. Routes to appropriate page based on authentication state

#### Page Entry Points (Route-Based)
- **Root (`/`)**: `app/page.tsx` - Landing/dashboard page
- **Login (`/login`)**: `app/login/page.tsx` - Authentication page
- **Requester (`/requester`)**: `app/requester/page.tsx` - Request submission form
- **Approver1 (`/approver1`)**: `app/approver1/page.tsx` - First-level approval interface
- **Approver2 (`/approver2`)**: `app/approver2/page.tsx` - Second-level approval interface
- **Reception (`/reception`)**: `app/reception/page.tsx` - Check-in/check-out interface
- **Admin (`/admin`)**: `app/admin/page.tsx` - System administration
- **Settings (`/settings`)**: `app/settings/page.tsx` - System configuration
- **Notifications (`/notifications`)**: `app/notifications/page.tsx` - User notifications
- **Survey (`/survey`)**: `app/survey/page.tsx` - Guest feedback surveys

#### API Route Entry Point
- **QR Code Generation (`/api/qr`)**: `app/api/qr/route.ts` - GET endpoint for QR code image generation

### 1.3 Core Dependencies

#### Framework & Runtime
- **`next@14.2.5`**: React framework with App Router, Server Components, Server Actions
- **`react@18.2.0`** & **`react-dom@18.2.0`**: UI library
- **`typescript@5`**: Type safety

#### Database & ORM
- **`@prisma/client@5.17.0`**: Prisma ORM client for type-safe database access
- **`prisma@5.17.0`**: Prisma CLI for migrations and schema management
- **PostgreSQL**: Database backend (configured via `DATABASE_URL`)

#### UI Components & Styling
- **`@radix-ui/*`**: Headless UI primitives (46+ packages for dialogs, forms, navigation, etc.)
- **`tailwindcss@4.1.9`**: Utility-first CSS framework
- **`lucide-react@0.454.0`**: Icon library
- **`class-variance-authority`**: Component variant management
- **`clsx`** & **`tailwind-merge`**: Conditional class name utilities

#### Form Handling & Validation
- **`react-hook-form@7.60.0`**: Form state management
- **`@hookform/resolvers@3.10.0`**: Form validation resolvers
- **`zod@3.25.76`**: Schema validation library

#### Business Logic Libraries
- **`nodemailer@6.9.14`**: Email sending via SMTP
- **`qrcode@1.5.4`**: QR code generation
- **`xlsx@0.18.5`**: Excel file import/export
- **`date-fns@4.1.0`**: Date manipulation utilities
- **`recharts@2.15.4`**: Chart/visualization library

#### State Management
- **React Context API**: Used in `lib/auth.tsx` for global authentication state
- **localStorage**: Client-side user session persistence (`lib/storage.ts`)

---

## 2. Logical Workflow (The "Happy Path")

### 2.1 Request Submission Flow

**User Journey**: Requester submits a visit request with guest information

**Step-by-Step Execution:**

1. **User Navigation**
   - User navigates to `/requester` route
   - `app/requester/page.tsx` renders (wrapped by `ProtectedRoute`)

2. **Authentication Check**
   - `components/protected-route.tsx` → Checks `useAuth()` hook
   - `lib/auth.tsx` → `AuthProvider` reads user from `lib/storage.ts` (localStorage)
   - If authenticated and role matches, page renders

3. **Page Initialization**
   - `app/requester/page.tsx` → `useEffect` calls `getSettings()` server action
   - `lib/actions.ts` → `getSettings()` → Queries `db.settings.findFirst()` via Prisma
   - Returns available gates list to populate dropdown

4. **Form Data Entry**
   - User fills request details (destination, gate, dates, purpose)
   - User adds guests (name, organization, email, phone, devices, ID photo)
   - **Blacklist Check**: On guest name/org/email change → `checkBlacklist()` server action
   - `lib/actions.ts` → `checkBlacklist()` → Queries `db.blacklistEntry.findFirst()` with OR conditions
   - UI shows red/green indicator based on blacklist status

5. **Excel Import (Optional)**
   - User uploads Excel file → `handleImportExcel()` in `app/requester/page.tsx`
   - Uses `xlsx` library to parse file → Maps rows to guest objects
   - Adds guests to form state

6. **Form Submission**
   - User clicks "Submit Request" → `handleSubmit()` in `app/requester/page.tsx`
   - Validates required fields (request details + guest name/organization)
   - Validates no blacklisted guests present
   - Calls `saveRequest()` server action

7. **Server Action: Save Request**
   - `lib/actions.ts` → `saveRequest()` function (marked `'use server'`)
   - **User Resolution Logic**:
     - Checks if `requestedById` exists
     - If not, queries `db.user.findUnique({ email })`
     - If user doesn't exist, creates new user with random password and `role: 'requester'`
   - **Request Creation**:
     - `db.request.create()` with nested `guests.create()` (Prisma nested writes)
     - Maps TypeScript status strings to Prisma enum (e.g., `"submitted"` → `"submitted"`)
   - **Audit Log**: `createAuditLog()` → `db.auditLog.create()` (if model exists)
   - **Cache Revalidation**: `revalidatePath('/')` → Invalidates Next.js cache

8. **Database Transaction**
   - Prisma Client → PostgreSQL connection via `DATABASE_URL`
   - Transaction creates: 1 Request record + N Guest records
   - Foreign key: `guests.requestId` → `requests.id`

9. **Response & UI Update**
   - Server action returns → Client receives success
   - Toast notification shown via `useToast()` hook
   - Form reset → Router refresh via `router.refresh()`
   - User redirected or sees success message

---

### 2.2 Approval Workflow Flow

**User Journey**: Approver1 reviews and approves/rejects guests, then Approver2 does final approval

#### Approver1 Flow:

1. **Page Load**
   - User navigates to `/approver1`
   - `app/approver1/page.tsx` → `useEffect` calls `getRequests()`
   - `lib/actions.ts` → `getRequests()` → `db.request.findMany({ include: { guests: true } })`
   - Filters requests with status `"submitted"` or `"approver1-pending"`

2. **Guest Selection**
   - Approver selects guests to approve/reject using checkboxes
   - Approver can add comments per request

3. **Approval Action**
   - User clicks "Approve Selected" → `approveRow()` in `app/approver1/page.tsx`
   - Updates guest `approver1Status` to `"approved"` or `"rejected"` or `"blacklisted"`
   - Checks if all guests processed → If yes, updates request status

4. **Status Transition Logic**
   - If all guests approved → Request status → `"approver1-approved"`
   - If all guests rejected → Request status → `"approver1-rejected"`
   - If mixed → Request status → `"approver1-pending"` (partial)
   - If all processed → Request status → `"approver1-approved"` and forward to Approver2

5. **Save to Database**
   - Calls `saveRequest()` with updated request and guests
   - `lib/actions.ts` → `saveRequest()` detects `request.id` exists → Update path
   - **Update Logic**:
     - `db.guest.findMany({ requestId })` → Get existing guests
     - For each guest: If `guest.id` exists → `db.guest.update()`, else → `db.guest.create()`
     - Delete guests not in new list: `db.guest.delete()`
     - `db.request.update()` with new status and approver metadata

6. **Notification Trigger**
   - If forwarded to Approver2 → `triggerApprovalNotifications()` called
   - `lib/notification-service.ts` → `sendApprovalNotifications()` (if settings enabled)
   - Creates notification records via `saveNotification()` → `db.notification.create()`

#### Approver2 Flow:

1. **Page Load**
   - Similar to Approver1 → Loads requests with status `"approver1-approved"` or `"approver2-pending"`

2. **Final Approval**
   - Approver2 selects guests → Clicks "Approve Selected"
   - `approveRow()` in `app/approver2/page.tsx`
   - Updates `approver2Status` for selected guests

3. **Final Status & Approval Number**
   - If all guests approved → Request status → `"approver2-approved"`
   - **Approval Number Generation**: `generateApprovalNumber()` → Format: `APV-{timestamp}-{random}`
   - Saves approval number to request: `request.approvalNumber = "APV-..."`

4. **Notification & QR Code**
   - `triggerApprovalNotifications()` → Sends email/SMS to requester and guests
   - Email includes approval number, gate, dates
   - QR code can be generated via `/api/qr?data={approvalNumber}`

---

### 2.3 Check-In/Check-Out Flow

**User Journey**: Reception staff checks in approved guests, then checks them out

1. **Page Load**
   - User navigates to `/reception`
   - `app/reception/page.tsx` → `loadGuests()` function
   - Calls `getRequests()` and `getSettings()`
   - Filters: Only guests with `approver2Status === "approved"`
   - Filters by user's `assignedGates` (if not admin)

2. **Guest Search & Display**
   - Displays table of approved guests with request details
   - Search by name, organization, approval number
   - Filter by gate number

3. **Check-In Action**
   - User clicks "Check In" → `handleCheckIn()` in `app/reception/page.tsx`
   - Calls `checkInGuest(requestId, guestId)` server action
   - `lib/actions.ts` → `checkInGuest()`:
     - `db.guest.update({ where: { id: guestId }, data: { checkInTime: new Date() } })`
     - Creates audit log entry
     - Calls `triggerCheckInNotification()` → Sends email to requester

4. **Check-Out Action**
   - User clicks "Check Out" → `handleCheckOut()` in `app/reception/page.tsx`
   - Opens dialog with survey form (rating 1-5, comment)
   - Calls `checkOutGuest(requestId, guestId)` server action
   - `lib/actions.ts` → `checkOutGuest()`:
     - `db.guest.update({ data: { checkOutTime: new Date() } })`
     - Creates audit log
     - Calls `triggerCheckOutNotification()`
   - If survey submitted → `saveSurvey()` → `db.survey.create()`

5. **Auto-Refresh**
   - Page polls every 2 seconds: `setInterval(() => loadGuests(), 2000)`
   - Ensures reception sees latest approved guests

---

### 2.4 QR Code Generation Flow

**User Journey**: System generates QR code for approved requests

1. **QR Code Request**
   - Frontend calls: `/api/qr?data={approvalNumber}`
   - `app/api/qr/route.ts` → `GET` handler

2. **QR Generation**
   - Extracts `data` query parameter
   - Calls `generateQRCode(data)` from `lib/qr.ts`
   - Uses `qrcode` library: `QRCode.toDataURL(data, { margin: 1, scale: 6 })`
   - Converts base64 data URL to PNG buffer

3. **Response**
   - Returns PNG buffer with `Content-Type: image/png`
   - Browser displays or downloads QR code image

---

## 3. Component Interaction

### 3.1 Frontend to Backend Communication

**Pattern: Server Actions (No Traditional REST API)**

- **Client Components** (`"use client"`) call server actions directly
- **Server Actions** (`'use server'`) are async functions exported from `lib/actions.ts`
- **No Fetch Calls**: Direct function imports, Next.js handles serialization
- **Example**:
  ```typescript
  // Client Component
  import { saveRequest } from "@/lib/actions"
  await saveRequest(requestData) // Direct call, no HTTP
  ```

**Exception: QR Code API Route**
- Traditional REST endpoint: `app/api/qr/route.ts`
- Uses `fetch()` or `<img src="/api/qr?data=...">` in frontend

### 3.2 Service Layer to Database Communication

**Pattern: Prisma ORM Client**

- **Database Client**: `lib/db.ts` exports singleton PrismaClient instance
- **Connection Management**: Uses global singleton pattern for development (prevents multiple connections)
- **Type Safety**: Prisma generates TypeScript types from `prisma/schema.prisma`
- **Query Pattern**:
  ```typescript
  // Server Action
  import db from "@/lib/db"
  const requests = await db.request.findMany({
    include: { guests: true, requestedBy: true }
  })
  ```

**Database Connection**:
- Environment variable: `DATABASE_URL` (PostgreSQL connection string)
- Format: `postgresql://user:password@host:port/database`

### 3.3 Authentication Flow

**Pattern: Client-Side Session with localStorage**

1. **Login**:
   - `app/login/page.tsx` → User enters email/password
   - Calls `getUserByEmail(email)` server action
   - Compares plaintext password (⚠️ **Security Issue**: No hashing)
   - If match → `storage.setCurrentUser(user)` → Saves to localStorage
   - `AuthProvider` updates context state

2. **Session Persistence**:
   - `lib/auth.tsx` → `AuthProvider` reads from localStorage on mount
   - `lib/storage.ts` → `getCurrentUser()` reads `document_management_current_user` key
   - No server-side session validation (⚠️ **Security Issue**: Client-only auth)

3. **Route Protection**:
   - `components/protected-route.tsx` → Wraps pages
   - Checks `useAuth().user` → Redirects to `/login` if null
   - Checks `allowedRoles` array → Redirects if role mismatch

### 3.4 Notification System Communication

**Pattern: Service Layer with External Gateways**

1. **Notification Trigger**:
   - Server actions call `notificationService.sendApprovalNotifications()`
   - `lib/notification-service.ts` → Service object with methods

2. **Email Notification**:
   - If SMTP configured → Uses `nodemailer.createTransport()` → Sends via SMTP
   - If email gateway URL configured → `fetch(emailGatewayUrl, { method: 'POST', body: JSON })`
   - Fallback: Console log (development mode)

3. **SMS Notification**:
   - If SMS gateway URL configured → `fetch(smsGatewayUrl, { method: 'POST', body: JSON })`
   - Fallback: Console log

4. **Settings Integration**:
   - Settings loaded from database → `getSettings()` → Returns SMTP/gateway configs
   - Notification service reads settings to determine delivery method

### 3.5 Component Hierarchy

```
app/layout.tsx (Root)
├── AuthProvider (lib/auth.tsx)
│   └── SidebarLayout (components/sidebar-layout.tsx)
│       ├── AppSidebar (components/app-sidebar.tsx)
│       └── {children} (Page Components)
│           ├── app/requester/page.tsx
│           ├── app/approver1/page.tsx
│           ├── app/approver2/page.tsx
│           ├── app/reception/page.tsx
│           └── ...
└── Toaster (components/ui/toaster.tsx)
```

**Data Flow**:
- Pages (Client Components) → Import server actions → Call directly
- Server Actions → Import `db` → Query via Prisma
- Prisma → PostgreSQL → Returns data
- Server Actions → Return data → Client receives
- Client updates React state → UI re-renders

---

## 4. Testing & Validation Plan

### 4.1 Unit Tests: Most Fragile Functions

#### 1. `saveRequest()` in `lib/actions.ts` (Lines 194-370)

**Why Fragile:**
- Complex user resolution logic with multiple fallback paths (lines 201-265)
- Duplicate user creation logic (appears 3 times)
- Nested guest update/create/delete operations
- Status enum conversion (string ↔ Prisma enum)
- Potential race conditions if multiple requests for same email

**Test Cases Needed:**
```typescript
// Test user resolution edge cases
- Request with existing requestedById
- Request with email but no user exists (should create)
- Request with email, user exists but different ID
- Request with no email and no requestedById (should throw)

// Test guest update logic
- Update existing guest (preserve ID)
- Add new guest to existing request
- Remove guest from request
- Update guest with status changes

// Test status conversion
- "approver1-approved" → "approver1_approved" (enum)
- Handle invalid status strings
```

#### 2. `checkBlacklist()` in `lib/actions.ts` (Lines 796-831)

**Why Fragile:**
- Case-insensitive matching logic (multiple `toLowerCase()` calls)
- OR query construction with optional fields
- Partial matching (name, org, email, phone can be undefined)
- Edge cases: empty strings, null values, special characters

**Test Cases Needed:**
```typescript
// Test matching logic
- Match by name (case-insensitive)
- Match by organization
- Match by email
- Match by phone
- Multiple matches (should return first)
- No matches (should return false)

// Test edge cases
- Empty name but organization matches
- Null/undefined email
- Phone number with/without formatting
- Special characters in names
- Active vs inactive blacklist entries
```

#### 3. `mapRowToRequest()` and `mapRowToGuest()` in `lib/actions.ts` (Lines 11-79)

**Why Fragile:**
- Complex status string parsing with multiple `includes()` checks (lines 52-78)
- Date conversion (ISO string formatting)
- Type coercion (string status → enum-like strings)
- Null/undefined handling for optional fields
- Status normalization: `"approver1_blacklisted"` handling (not in enum)

**Test Cases Needed:**
```typescript
// Test status mapping
- "approver1_approved" → "approver1-approved"
- "approver1_blacklisted" → "blacklisted" (edge case)
- Invalid status strings
- Null/undefined status

// Test date conversion
- Valid DateTime → ISO string
- Null dates → undefined
- Invalid date formats

// Test guest status parsing
- approver1Status: "approved" → "approved"
- approver1Status: "blacklisted" → "blacklisted"
- approver1Status: null → undefined
```

### 4.2 Integration Tests: Workflow Test

**Suggested Test: End-to-End Request Approval Workflow**

```typescript
describe("Request Approval Workflow", () => {
  it("should complete full approval cycle", async () => {
    // 1. Create requester user
    const requester = await createUser({ role: "requester", email: "req@test.com" })
    
    // 2. Submit request
    const request = await saveRequest({
      requestedById: requester.id,
      requestedByEmail: requester.email,
      destination: "IT Dept",
      gate: "228",
      fromDate: "2024-01-15",
      toDate: "2024-01-16",
      purpose: "Meeting",
      guests: [
        { name: "John Doe", organization: "Acme Corp", email: "john@acme.com" }
      ],
      status: "submitted"
    })
    
    // 3. Approver1 approves
    const updated1 = await saveRequest({
      ...request,
      status: "approver1-approved",
      guests: [{
        ...request.guests[0],
        approver1Status: "approved"
      }]
    })
    expect(updated1.status).toBe("approver1-approved")
    
    // 4. Approver2 approves
    const updated2 = await saveRequest({
      ...updated1,
      status: "approver2-approved",
      approvalNumber: "APV-TEST-123",
      guests: [{
        ...updated1.guests[0],
        approver2Status: "approved"
      }]
    })
    expect(updated2.approvalNumber).toBeDefined()
    
    // 5. Reception checks in
    await checkInGuest(updated2.id, updated2.guests[0].id)
    const guest = await db.guest.findUnique({ where: { id: updated2.guests[0].id } })
    expect(guest.checkInTime).toBeDefined()
    
    // 6. Reception checks out
    await checkOutGuest(updated2.id, updated2.guests[0].id)
    const guestOut = await db.guest.findUnique({ where: { id: updated2.guests[0].id } })
    expect(guestOut.checkOutTime).toBeDefined()
    
    // 7. Survey submission
    await saveSurvey({
      requestId: updated2.id,
      guestId: updated2.guests[0].id,
      rating: 5,
      comment: "Great experience"
    })
  })
})
```

**Additional Integration Tests:**
- **Blacklist Integration**: Submit request with blacklisted guest → Should be blocked
- **Notification Integration**: Approve request → Verify notification created in database
- **Multi-Gate Access**: Reception user with assigned gates → Should only see guests for those gates
- **Concurrent Updates**: Two approvers updating same request simultaneously → Should handle gracefully

### 4.3 Edge Cases: Potential Failure Points

#### Edge Case 1: Missing Environment Variables

**Location**: `lib/db.ts`, `lib/notification-service.ts`

**Problem**:
- `DATABASE_URL` not set → Prisma Client fails to connect
- SMTP settings missing → Email notifications fail silently (returns false)
- No error handling for missing `DATABASE_URL` at startup

**Failure Scenario**:
```typescript
// lib/db.ts - No validation
const prisma = new PrismaClient() // Crashes if DATABASE_URL missing

// lib/notification-service.ts - Silent failure
if (!settings?.smtpHost) {
  console.log("[v0] Email Notification:") // Just logs, doesn't throw
  return true // Returns success even though not sent
}
```

**Recommendation**:
- Add environment variable validation on app startup
- Throw errors for critical missing configs (DATABASE_URL)
- Return explicit failure status for optional configs (SMTP)

#### Edge Case 2: Race Condition in User Creation

**Location**: `lib/actions.ts` - `saveRequest()` function (Lines 201-265)

**Problem**:
- Multiple requests with same email submitted simultaneously
- Both threads check `db.user.findUnique({ email })` → Both get `null`
- Both threads create new user → Database unique constraint violation
- Current code has duplicate user creation logic (appears 3 times), suggesting past issues

**Failure Scenario**:
```typescript
// Thread 1: Check user → null
const existingUser = await db.user.findUnique({ where: { email } })
// Thread 2: Check user → null (Thread 1 hasn't created yet)
const existingUser = await db.user.findUnique({ where: { email } })
// Thread 1: Create user → Success
await db.user.create({ data: { email, ... } })
// Thread 2: Create user → ERROR: Unique constraint violation
await db.user.create({ data: { email, ... } })
```

**Recommendation**:
- Use database transaction with `db.$transaction()`
- Use `upsert()` instead of `findUnique()` + `create()`
- Add retry logic with exponential backoff
- Remove duplicate user creation code

**Additional Edge Cases**:
- **Large File Uploads**: ID photos stored as base64 in database → Could exceed PostgreSQL column size limits
- **Date Timezone Issues**: Date strings converted without timezone consideration → Could cause off-by-one day errors
- **Concurrent Guest Updates**: Multiple approvers updating same request → Last write wins, could lose data

---

## 5. Local Execution Steps

### Quick Start Guide

#### Prerequisites
- Node.js 18+ installed
- PostgreSQL 12+ installed and running
- npm or pnpm package manager

#### Step 1: Clone and Install Dependencies
```bash
cd vms3
npm install
# or
pnpm install
```

#### Step 2: Database Setup

**Create PostgreSQL Database:**
```bash
# Connect to PostgreSQL
psql -U postgres

# Create database
CREATE DATABASE document_management;

# Exit psql
\q
```

**Configure Environment Variables:**
Create `.env.local` file in project root:
```env
DATABASE_URL="postgresql://postgres:your_password@localhost:5432/document_management"
NODE_ENV=development
```

Replace `your_password` with your PostgreSQL password.

#### Step 3: Run Database Migrations
```bash
# Generate Prisma Client
npx prisma generate

# Run migrations (creates tables)
npx prisma migrate deploy

# (Optional) Seed database with initial data
npm run db:seed
```

#### Step 4: Start Development Server
```bash
npm run dev
```

Application will be available at `http://localhost:3000`

#### Step 5: Access Application

**Default Admin Credentials** (if seeded):
- Email: `admin@example.com`
- Password: `admin123`

**Note**: Change default password after first login.

#### Step 6: Verify Setup

1. **Login**: Navigate to `/login` and sign in
2. **Create Request**: Go to `/requester` and submit a test request
3. **Check Database**: Verify data in PostgreSQL:
   ```bash
   psql -U postgres -d document_management
   SELECT * FROM requests;
   SELECT * FROM guests;
   ```

### Troubleshooting

**Database Connection Error:**
- Verify PostgreSQL is running: `pg_isready` or `psql -U postgres -c "SELECT 1"`
- Check `DATABASE_URL` format in `.env.local`
- Ensure database exists: `psql -U postgres -l | grep document_management`

**Prisma Client Not Generated:**
```bash
npx prisma generate
```

**Port Already in Use:**
- Change port: `npm run dev -- -p 3001`
- Or kill process on port 3000

**TypeScript Errors:**
- Run: `npm run lint` to see errors
- Note: Build ignores TypeScript errors (`ignoreBuildErrors: true` in `next.config.mjs`)

### Production Build

```bash
# Build for production
npm run build

# Start production server
npm start
```

**Note**: Ensure `DATABASE_URL` is set in production environment variables.

---

## Appendix: File Structure Summary

```
vms3/
├── app/                    # Next.js App Router pages
│   ├── api/qr/            # QR code API route
│   ├── admin/             # Admin dashboard
│   ├── approver1/         # First-level approval
│   ├── approver2/         # Second-level approval
│   ├── auth/              # Authentication page
│   ├── dashboard/         # Main dashboard
│   ├── login/             # Login page
│   ├── reception/         # Check-in/check-out
│   ├── requester/         # Request submission
│   ├── settings/          # System settings
│   ├── layout.tsx         # Root layout
│   └── page.tsx           # Landing page
├── components/            # React components
│   ├── ui/                # shadcn/ui components
│   ├── protected-route.tsx # Route guard
│   └── sidebar-layout.tsx  # Layout wrapper
├── lib/                   # Business logic
│   ├── actions.ts         # Server Actions (main data operations)
│   ├── auth.tsx           # Authentication context
│   ├── db.ts              # Prisma client
│   ├── notification-service.ts # Email/SMS service
│   ├── qr.ts              # QR code generation
│   ├── storage.ts         # localStorage utilities
│   └── types.ts           # TypeScript interfaces
├── prisma/                # Database schema
│   ├── schema.prisma      # Prisma schema
│   └── migrations/        # Database migrations
├── public/                # Static assets
├── styles/                # Global styles
└── package.json           # Dependencies
```

---

**Document Generated**: 2024-01-30  
**System Version**: 0.1.0  
**Architecture**: Next.js 14 App Router + Prisma ORM + PostgreSQL

