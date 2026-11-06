# BEE Property Service & Access API

Fast, modular, and developer-friendly Node.js/Express backend service for the BEE Property ecosystem, connecting **Residence**, **RWA**, **Agency**, **Technician**, and **Security** applications.

---

## 🌟 Architecture Highlights

The backend strictly follows a clean, decoupled layer structure:
```
Router ➔ Middleware ➔ Controller ➔ Service ➔ Business Service ➔ Model ➔ MongoDB
```

- **Router**: Defines HTTP paths and HTTP verbs (`src/routes/v1/`).
- **Middleware**: Authentication, machine client validation, role authorization, Zod schema validation, idempotency, rate limiting, and request context (`src/middleware/`).
- **Controller**: Ultra-thin orchestrators that parse HTTP requests and return standard response envelopes (`src/controllers/`).
- **Service**: Application workflow orchestration, transactional updates, audit logging, and outbox event enqueueing (`src/services/`).
- **Business Service**: Pure domain rules, eligibility, state machine transition checks, and gate verification (`src/business-services/`).
- **Model**: Mongoose schemas with explicit indexing, strict typing, and validation (`src/models/`).
- **Outbox Worker**: Event-driven decoupled outbox publisher ensuring resilient communication across apps.

---

## 🚀 Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Seed Initial Test Data
Initializes MongoDB with realistic sample accounts and records:
```bash
npm run seed
```

### 3. Run Development Server
```bash
npm run dev
# or for production:
npm start
```
The server will start at: `http://localhost:5000`

---

## 📚 Interactive Swagger / OpenAPI Documentation

Visit: **`http://localhost:5000/docs`** (or `http://localhost:5000/api/v1/docs`)

Explore and test all endpoints interactively with pre-configured request payloads directly from your browser!

---

## 🔑 Demo Credentials (Seeded)

| Application / Role | Email | Password | Primary Actions |
|---|---|---|---|
| **Agency Admin** | `admin@beeproperty.com` | `admin123` | Queue management, technician dispatch, resolve & close |
| **RWA President** | `rwa@beeproperty.com` | `password123` | Review & approve community maintenance complaints |
| **Resident** | `resident@beeproperty.com` | `password123` | Create home service tickets, pre-approved guest passes, arrival decisions |
| **Technician** | `tech@beeproperty.com` | `password123` | View assigned jobs, check-in, add notes/evidence, complete work |
| **Security Guard** | `guard@beeproperty.com` | `password123` | Register visitor arrival, verify QR/OTP passes, record entry/exit |

---

## 🛠 API Endpoints Overview

All APIs are versioned under `/api/v1`:

### 1. Authentication (`/api/v1/auth`)
- `POST /login` - User login with email and password
- `POST /refresh` - Refresh access token
- `POST /logout` - Invalidate session
- `GET /me` - Get current user profile

### 2. Application Integrations (`/api/v1/integrations`)
- `POST /residence/service-requests` - Ingest resident home service ticket (idempotent)
- `GET /residence/service-requests/:sourceRequestId` - Query synchronized ticket status
- `POST /residence/gate-pass-requests` - Create guest/contractor gate pass request
- `POST /rwa/complaints` - Ingest RWA maintenance complaint (idempotent)
- `GET /rwa/complaints/:sourceRequestId` - Query synchronized complaint status
- `POST /security/access-requests` - Guard registers arrival at gate

### 3. Agency Portal (`/api/v1/agency`)
- `GET /service-requests` - Filterable service request queue
- `GET /service-requests/:id` - Request detail with attachments and timeline
- `POST /service-requests/:id/dispatch` - Create Work Order and assign one or more technicians
- `GET /technicians` - Technician availability snapshot

### 4. Work Orders (`/api/v1/work-orders`)
- `GET /` - List all work orders
- `GET /:id` - Work order detail with assignments
- `POST /:id/assignments` - Add technician assignment

### 5. Technician App (`/api/v1/technician`)
- `GET /jobs` - List jobs assigned to authenticated technician
- `GET /jobs/:jobId` - Job details
- `POST /jobs/:jobId/check-in` - Record check-in / start work
- `POST /jobs/:jobId/notes` - Add progress note
- `POST /jobs/:jobId/attachments` - Add before/after photo
- `POST /jobs/:jobId/hold` - Put work on hold with reason & material requests
- `POST /jobs/:jobId/resume` - Resume work
- `POST /jobs/:jobId/complete` - Complete work
- `GET /jobs/:jobId/gate-pass` - View linked gate pass details

### 6. Gate Pass & Security (`/api/v1/gate-passes` & `/api/v1/security`)
- `POST /gate-passes/requests` - Request gate pass
- `GET /gate-passes/requests` - List gate pass requests
- `POST /gate-passes/requests/:id/approve` - Approve request
- `POST /gate-passes/requests/:id/reject` - Reject request
- `GET /gate-passes` - List issued passes
- `POST /gate-passes/:id/revoke` - Revoke pass
- `POST /security/gate-passes/verify` - Guard scans QR token or enters OTP
- `POST /security/gate-passes/:id/check-in` - Guard records entry
- `POST /security/gate-passes/:id/check-out` - Guard records exit
- `POST /security/resident/access-requests/:id/decision` - Resident approves/rejects arrival

### 7. Health & Monitoring (`/health`)
- `GET /health/live` - Liveness check
- `GET /health/ready` - Readiness check with MongoDB connection status

---

## ⚡ Unified Response Format

### Success Response:
```json
{
  "success": true,
  "data": { ... },
  "meta": {
    "requestId": "54ab3a47-f66f-46b3-b882-a3ac46e2942d",
    "timestamp": "2026-11-06T07:35:00.000Z",
    "pagination": { "total": 1, "page": 1, "limit": 20, "totalPages": 1 }
  }
}
```

### Error Response:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Validation failed",
    "details": [
      { "field": "category", "message": "category is required" }
    ]
  },
  "meta": {
    "requestId": "e4781855-8815-4efb-93ad-7b3a3b7f11f7",
    "timestamp": "2026-11-06T07:35:00.000Z"
  }
}
```

---

## 🧪 Testing

Run all unit and integration tests:
```bash
npm test
```
All 15 automated test suites run in under 2 seconds.

