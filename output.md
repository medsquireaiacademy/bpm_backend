# BEE Property Service & Access API - Client Specification & API Reference

---

## 1. System Overview & Technology Stack

- **Runtime**: Node.js (v22+)
- **Framework**: Express.js 5
- **Database**: MongoDB Atlas (`bee_property`)
- **ODM**: Mongoose
- **Architecture**: Router ➔ Middleware ➔ Controller ➔ Service ➔ Business Service ➔ Model ➔ MongoDB
- **Base URL**: `http://localhost:5000/api/v1`
- **Interactive Documentation**: `http://localhost:5000/docs`

### Modules & Dependencies
- `express` - HTTP framework
- `mongoose` - MongoDB ODM and index enforcement
- `zod` - Input validation schemas
- `jsonwebtoken` - Stateless JWT authentication
- `bcryptjs` - Password hashing
- `helmet` - HTTP security headers
- `cors` - Origin access controls
- `dotenv` - Environment variable injection
- `swagger-ui-express` & `yamljs` - OpenAPI Swagger documentation

### Database Connection
- `MONGODB_URI`: MongoDB Atlas cluster
- `MONGODB_DB_NAME`: `bee_property`

---

## 2. API Endpoints Reference

---

### System & Health

#### 1. Service Liveness Check
- **Type**: `GET`
- **Link**: `/health/live`
- **Average Speed**: `~3 ms`
- **Headers**: None
- **Input JSON**: None
- **Output JSON**:
```json
{
  "success": true,
  "data": {
    "status": "UP",
    "timestamp": "2026-11-06T08:15:00.000Z"
  },
  "meta": {
    "timestamp": "2026-11-06T08:15:00.000Z"
  }
}
```

#### 2. Service & Database Readiness Check
- **Type**: `GET`
- **Link**: `/health/ready`
- **Average Speed**: `~4 ms`
- **Headers**: None
- **Input JSON**: None
- **Output JSON**:
```json
{
  "status": "READY",
  "database": "CONNECTED",
  "uptimeSeconds": 1420,
  "timestamp": "2026-11-06T08:15:00.000Z"
}
```

#### 3. Storage Upload Presign
- **Type**: `POST`
- **Link**: `/api/v1/uploads/presign`
- **Average Speed**: `~5 ms`
- **Headers**: `Content-Type: application/json`
- **Input JSON**:
```json
{
  "fileName": "pipe_damage.jpg",
  "fileType": "image/jpeg"
}
```
- **Output JSON**:
```json
{
  "success": true,
  "data": {
    "uploadUrl": "https://storage.beeproperty.example/uploads/1793951800-pipe_damage.jpg?signature=mock_presigned_url",
    "fileKey": "uploads/1793951800-pipe_damage.jpg",
    "mimeType": "image/jpeg",
    "expiresInSeconds": 900
  },
  "meta": {
    "requestId": "c19bb7c4-16a3-479e-82cb-4c3df2cf9226",
    "timestamp": "2026-11-06T08:15:00.000Z"
  }
}
```

---

### Authentication (`/api/v1/auth`)

#### 4. User Login
- **Type**: `POST`
- **Link**: `/api/v1/auth/login`
- **Average Speed**: `~85 ms`
- **Headers**: `Content-Type: application/json`
- **Input JSON**:
```json
{
  "email": "admin@beeproperty.com",
  "password": "admin123"
}
```
- **Output JSON**:
```json
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "userId": "AGY-ADMIN-01",
      "email": "admin@beeproperty.com",
      "name": "John Doe (Agency Admin)",
      "role": "AGENCY_ADMIN",
      "propertyId": "PROP-01"
    }
  },
  "meta": {
    "requestId": "2c09384d-2713-4ade-b36f-4f6afc91dc55",
    "timestamp": "2026-11-06T08:15:00.000Z"
  }
}
```

#### 5. Refresh Access Token
- **Type**: `POST`
- **Link**: `/api/v1/auth/refresh`
- **Average Speed**: `~12 ms`
- **Headers**: `Content-Type: application/json`
- **Input JSON**:
```json
{
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```
- **Output JSON**:
```json
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  },
  "meta": {
    "timestamp": "2026-11-06T08:15:00.000Z"
  }
}
```

#### 6. Current User Profile
- **Type**: `GET`
- **Link**: `/api/v1/auth/me`
- **Average Speed**: `~8 ms`
- **Headers**: `Authorization: Bearer <token>`
- **Input JSON**: None
- **Output JSON**:
```json
{
  "success": true,
  "data": {
    "userId": "AGY-ADMIN-01",
    "name": "John Doe (Agency Admin)",
    "email": "admin@beeproperty.com",
    "role": "AGENCY_ADMIN",
    "propertyId": "PROP-01",
    "active": true
  },
  "meta": {
    "timestamp": "2026-11-06T08:15:00.000Z"
  }
}
```

---

### Application Integrations (`/api/v1/integrations`)

#### 7. Residence Ticket Intake (Idempotent)
- **Type**: `POST`
- **Link**: `/api/v1/integrations/residence/service-requests`
- **Average Speed**: `~18 ms` (Repeated: `~2 ms` via Idempotency cache)
- **Headers**: 
  - `X-Client-Id: residence-api-client`
  - `X-Client-Secret: residence_secret_2026`
  - `Idempotency-Key: idemp_1001`
- **Input JSON**:
```json
{
  "sourceRequestId": "TKT-2026-901",
  "householdId": "HH-BLR-1204",
  "requesterId": "USR-RES-01",
  "requesterName": "Rajesh Kumar",
  "requesterPhone": "+91 98765 33333",
  "location": {
    "propertyId": "PROP-01",
    "apartmentName": "Bee Hive Residency",
    "tower": "Tower A",
    "flatNumber": "1204",
    "floor": "12"
  },
  "category": "Plumbing",
  "title": "Kitchen drain pipe leaking",
  "description": "Continuous leak below sink U-bend joint.",
  "urgency": "High",
  "preferredDate": "2026-11-08",
  "preferredTimeSlot": "Morning (09:00 AM - 12:00 PM)"
}
```
- **Output JSON**:
```json
{
  "success": true,
  "data": {
    "serviceRequestId": "SR-2026-00045",
    "sourceApplication": "RESIDENCE",
    "sourceRequestId": "TKT-2026-901",
    "status": "PENDING",
    "createdAt": "2026-11-06T08:15:00.000Z"
  },
  "meta": {
    "requestId": "25e9526b-50e4-40d8-a384-d4b55c7ca280",
    "timestamp": "2026-11-06T08:15:00.000Z"
  }
}
```

#### 8. Query Synchronized Residence Ticket
- **Type**: `GET`
- **Link**: `/api/v1/integrations/residence/service-requests/TKT-2026-901`
- **Average Speed**: `~9 ms`
- **Headers**: 
  - `X-Client-Id: residence-api-client`
  - `X-Client-Secret: residence_secret_2026`
- **Input JSON**: None
- **Output JSON**:
```json
{
  "success": true,
  "data": {
    "publicId": "SR-2026-00045",
    "source": {
      "application": "RESIDENCE",
      "sourceRequestId": "TKT-2026-901",
      "sourceStatus": "Pending"
    },
    "property": {
      "apartmentName": "Bee Hive Residency",
      "flatNumber": "1204"
    },
    "title": "Kitchen drain pipe leaking",
    "status": "PENDING"
  },
  "meta": {
    "timestamp": "2026-11-06T08:15:00.000Z"
  }
}
```

#### 9. RWA Complaint Intake
- **Type**: `POST`
- **Link**: `/api/v1/integrations/rwa/complaints`
- **Average Speed**: `~16 ms`
- **Headers**: 
  - `X-Client-Id: rwa-api-client`
  - `X-Client-Secret: rwa_secret_2026`
- **Input JSON**:
```json
{
  "sourceRequestId": "CMP-2026-105",
  "propertyId": "PROP-RWA-01",
  "apartmentName": "Golden Apartment",
  "location": {
    "placeName": "Clubhouse",
    "floor": "Ground Floor",
    "asset": "Air Conditioning Unit 1"
  },
  "category": "Air Conditioning",
  "title": "Clubhouse AC Compressor Making Noise",
  "description": "Loud vibration and low cooling in the main hall.",
  "priority": "Urgent",
  "complaintScope": "Common Area",
  "requiresApproval": true
}
```
- **Output JSON**:
```json
{
  "success": true,
  "data": {
    "serviceRequestId": "SR-2026-00046",
    "sourceApplication": "RWA",
    "sourceRequestId": "CMP-2026-105",
    "status": "PENDING_APPROVAL",
    "requiresApproval": true,
    "createdAt": "2026-11-06T08:15:00.000Z"
  },
  "meta": {
    "requestId": "4a7b64e6-056d-4923-b856-0763c52e0ba0",
    "timestamp": "2026-11-06T08:15:00.000Z"
  }
}
```

---

### Service Requests & Approvals (`/api/v1/service-requests`)

#### 10. List Service Requests (Paginated)
- **Type**: `GET`
- **Link**: `/api/v1/service-requests?page=1&limit=20`
- **Average Speed**: `~12 ms`
- **Headers**: `Authorization: Bearer <token>`
- **Input JSON**: None
- **Output JSON**:
```json
{
  "success": true,
  "data": [
    {
      "publicId": "SR-2026-00046",
      "title": "Clubhouse AC Compressor Making Noise",
      "status": "PENDING_APPROVAL",
      "priority": "URGENT",
      "createdAt": "2026-11-06T08:15:00.000Z"
    }
  ],
  "meta": {
    "pagination": {
      "total": 43,
      "page": 1,
      "limit": 20,
      "totalPages": 3,
      "hasNext": true,
      "hasPrev": false
    },
    "timestamp": "2026-11-06T08:15:00.000Z"
  }
}
```

#### 11. Approve Service Request (RWA / Admin)
- **Type**: `POST`
- **Link**: `/api/v1/service-requests/SR-2026-00046/approve`
- **Average Speed**: `~15 ms`
- **Headers**: `Authorization: Bearer <token>`
- **Input JSON**:
```json
{
  "reason": "Approved for emergency AMC dispatch"
}
```
- **Output JSON**:
```json
{
  "success": true,
  "data": {
    "publicId": "SR-2026-00046",
    "status": "APPROVED",
    "approval": {
      "required": true,
      "status": "APPROVED",
      "approvedBy": "RWA-PRES-01",
      "approvedAt": "2026-11-06T08:15:00.000Z",
      "reason": "Approved for emergency AMC dispatch"
    }
  },
  "meta": {
    "timestamp": "2026-11-06T08:15:00.000Z"
  }
}
```

#### 12. Reject Service Request
- **Type**: `POST`
- **Link**: `/api/v1/service-requests/SR-2026-00046/reject`
- **Average Speed**: `~14 ms`
- **Headers**: `Authorization: Bearer <token>`
- **Input JSON**:
```json
{
  "reason": "Duplicated complaint; already under inspection"
}
```
- **Output JSON**:
```json
{
  "success": true,
  "data": {
    "publicId": "SR-2026-00046",
    "status": "REJECTED"
  },
  "meta": {
    "timestamp": "2026-11-06T08:15:00.000Z"
  }
}
```

---

### Agency Operations (`/api/v1/agency`)

#### 13. Agency Queue
- **Type**: `GET`
- **Link**: `/api/v1/agency/service-requests?status=APPROVED`
- **Average Speed**: `~10 ms`
- **Headers**: `Authorization: Bearer <agency_admin_token>`
- **Input JSON**: None
- **Output JSON**:
```json
{
  "success": true,
  "data": [
    {
      "publicId": "SR-2026-00046",
      "title": "Clubhouse AC Compressor Making Noise",
      "status": "APPROVED",
      "priority": "URGENT"
    }
  ],
  "meta": {
    "pagination": { "total": 1, "page": 1, "limit": 20, "totalPages": 1 }
  }
}
```

#### 14. Dispatch Request to Technicians
- **Type**: `POST`
- **Link**: `/api/v1/agency/service-requests/SR-2026-00046/dispatch`
- **Average Speed**: `~22 ms`
- **Headers**: `Authorization: Bearer <agency_admin_token>`
- **Input JSON**:
```json
{
  "instructions": "Inspect compressor refrigerant level and electrical contactor",
  "createTechnicianGatePass": true,
  "assignments": [
    {
      "technicianId": "TECH-002",
      "technicianName": "Vikram Sharma",
      "role": "HVAC_LEAD",
      "skill": "AC & Refrigeration",
      "instructions": "Bring manifold gauge set"
    }
  ]
}
```
- **Output JSON**:
```json
{
  "success": true,
  "data": {
    "workOrder": {
      "publicId": "WO-2026-00028",
      "status": "ASSIGNED",
      "priority": "URGENT"
    },
    "assignments": [
      {
        "publicId": "ASG-2026-00031",
        "serviceOrderId": "SO-0031",
        "technicianId": "TECH-002",
        "technicianName": "Vikram Sharma",
        "role": "HVAC_LEAD",
        "status": "ASSIGNED"
      }
    ]
  },
  "meta": {
    "requestId": "27c2461e-8533-485e-92b6-635061a4f667",
    "timestamp": "2026-11-06T08:15:00.000Z"
  }
}
```

#### 15. Technician Directory
- **Type**: `GET`
- **Link**: `/api/v1/agency/technicians`
- **Average Speed**: `~8 ms`
- **Headers**: `Authorization: Bearer <agency_admin_token>`
- **Input JSON**: None
- **Output JSON**:
```json
{
  "success": true,
  "data": [
    {
      "userId": "TECH-002",
      "name": "Vikram Sharma",
      "role": "TECHNICIAN",
      "skills": ["Plumbing & Civil", "Water Supply", "General Maintenance"]
    }
  ]
}
```

---

### Technician App (`/api/v1/technician`)

#### 16. List Technician's Assigned Jobs
- **Type**: `GET`
- **Link**: `/api/v1/technician/jobs`
- **Average Speed**: `~8 ms`
- **Headers**: `Authorization: Bearer <technician_token>`
- **Input JSON**: None
- **Output JSON**:
```json
{
  "success": true,
  "data": [
    {
      "publicId": "ASG-2026-00031",
      "serviceOrderId": "SO-0031",
      "role": "HVAC_LEAD",
      "status": "ASSIGNED",
      "instructions": "Bring manifold gauge set"
    }
  ],
  "meta": {
    "pagination": { "total": 1, "page": 1, "limit": 20, "totalPages": 1 }
  }
}
```

#### 17. Technician Job Check-In
- **Type**: `POST`
- **Link**: `/api/v1/technician/jobs/ASG-2026-00031/check-in`
- **Average Speed**: `~16 ms`
- **Headers**: `Authorization: Bearer <technician_token>`
- **Input JSON**:
```json
{
  "latitude": 12.9716,
  "longitude": 77.5946,
  "evidenceKey": "uploads/checkin_location.jpg"
}
```
- **Output JSON**:
```json
{
  "success": true,
  "data": {
    "publicId": "ASG-2026-00031",
    "status": "IN_PROGRESS",
    "checkIn": {
      "at": "2026-11-06T08:15:00.000Z",
      "latitude": 12.9716,
      "longitude": 77.5946
    }
  }
}
```

#### 18. Add Progress Note
- **Type**: `POST`
- **Link**: `/api/v1/technician/jobs/ASG-2026-00031/notes`
- **Average Speed**: `~10 ms`
- **Headers**: `Authorization: Bearer <technician_token>`
- **Input JSON**:
```json
{
  "text": "Tested compressor capacitor; found value dropped below 15uF. Replacing capacitor."
}
```
- **Output JSON**:
```json
{
  "success": true,
  "data": {
    "publicId": "ASG-2026-00031",
    "notes": [
      {
        "noteId": "note_593cb8f2",
        "text": "Tested compressor capacitor; found value dropped below 15uF. Replacing capacitor.",
        "createdAt": "2026-11-06T08:15:00.000Z",
        "createdBy": "Vikram Sharma"
      }
    ]
  }
}
```

#### 19. Complete Technician Job
- **Type**: `POST`
- **Link**: `/api/v1/technician/jobs/ASG-2026-00031/complete`
- **Average Speed**: `~18 ms`
- **Headers**: `Authorization: Bearer <technician_token>`
- **Input JSON**:
```json
{
  "completionNote": "Replaced 45uF dual run capacitor and tested cooling delta (18C return, 8C supply).",
  "afterPhotos": [
    {
      "url": "https://storage.beeproperty.example/evidence/after_ac.jpg",
      "caption": "New capacitor installed and wiring tied"
    }
  ]
}
```
- **Output JSON**:
```json
{
  "success": true,
  "data": {
    "publicId": "ASG-2026-00031",
    "status": "COMPLETED",
    "completedAt": "2026-11-06T08:15:00.000Z"
  }
}
```

---

### Gate Pass & Security Access (`/api/v1/gate-passes` & `/api/v1/security`)

#### 20. Resident Creates Pre-Approved Guest Pass
- **Type**: `POST`
- **Link**: `/api/v1/gate-passes/requests`
- **Average Speed**: `~15 ms`
- **Headers**: `Authorization: Bearer <resident_token>`
- **Input JSON**:
```json
{
  "requestType": "RESIDENT_GUEST",
  "propertyId": "PROP-01",
  "validUntil": "2026-11-06T20:00:00.000Z",
  "visitor": {
    "name": "Arjun Patel",
    "phone": "+91 99887 76655",
    "vehicleNumber": "KA 03 MX 1290",
    "purpose": "Dinner visit"
  }
}
```
- **Output JSON**:
```json
{
  "success": true,
  "data": {
    "request": {
      "publicId": "GPR-2026-00007",
      "status": "ISSUED"
    },
    "issuedPass": {
      "publicId": "GP-2026-00025",
      "passType": "GUEST",
      "token": "493b0344066d445684a34a947af66f06",
      "otp": "6812",
      "status": "ACTIVE",
      "validUntil": "2026-11-06T20:00:00.000Z"
    }
  }
}
```

#### 21. Guard Verifies Gate Pass QR Token or OTP
- **Type**: `POST`
- **Link**: `/api/v1/security/gate-passes/verify`
- **Average Speed**: `~5 ms`
- **Headers**: `Authorization: Bearer <guard_token>`
- **Input JSON**:
```json
{
  "token": "493b0344066d445684a34a947af66f06",
  "gateId": "Main Gate"
}
```
- **Output JSON**:
```json
{
  "success": true,
  "data": {
    "allowed": true,
    "code": "ALLOW",
    "message": "Gate pass is valid.",
    "pass": {
      "publicId": "GP-2026-00025",
      "passType": "GUEST",
      "visitor": {
        "name": "Arjun Patel",
        "vehicleNumber": "KA 03 MX 1290",
        "purpose": "Dinner visit"
      },
      "status": "ACTIVE",
      "entryCount": 0
    }
  }
}
```

#### 22. Guard Records Gate Check-In
- **Type**: `POST`
- **Link**: `/api/v1/security/gate-passes/GP-2026-00025/check-in`
- **Average Speed**: `~7 ms`
- **Headers**: `Authorization: Bearer <guard_token>`
- **Input JSON**:
```json
{
  "gateId": "Main Gate",
  "remarks": "ID verified"
}
```
- **Output JSON**:
```json
{
  "success": true,
  "data": {
    "pass": {
      "publicId": "GP-2026-00025",
      "status": "USED",
      "entryCount": 1
    },
    "event": {
      "eventType": "CHECKED_IN",
      "decisionCode": "CHECKED_IN_ALLOWED",
      "occurredAt": "2026-11-06T08:15:00.000Z"
    }
  }
}
```

#### 23. Guard Records Gate Check-Out
- **Type**: `POST`
- **Link**: `/api/v1/security/gate-passes/GP-2026-00025/check-out`
- **Average Speed**: `~6 ms`
- **Headers**: `Authorization: Bearer <guard_token>`
- **Input JSON**:
```json
{
  "gateId": "Main Gate"
}
```
- **Output JSON**:
```json
{
  "success": true,
  "data": {
    "event": {
      "eventType": "CHECKED_OUT",
      "decisionCode": "CHECKED_OUT",
      "occurredAt": "2026-11-06T08:15:00.000Z"
    }
  }
}
```

#### 24. Resident Decides on Guard-Originated Visitor Arrival
- **Type**: `POST`
- **Link**: `/api/v1/security/resident/access-requests/GPR-2026-00007/decision`
- **Average Speed**: `~12 ms`
- **Headers**: `Authorization: Bearer <resident_token>`
- **Input JSON**:
```json
{
  "decision": "APPROVE"
}
```
- **Output JSON**:
```json
{
  "success": true,
  "data": {
    "decision": "APPROVED",
    "issuedPass": {
      "publicId": "GP-2026-00026",
      "status": "ACTIVE"
    }
  }
}
```

---

## 3. Performance Summary Table

| Category | Endpoint | Method | Average Latency |
|---|---|---|---|
| **Health** | `/health/ready` | `GET` | **3 - 4 ms** |
| **Auth** | `/api/v1/auth/login` | `POST` | **80 - 95 ms** *(Bcrypt 10 rounds)* |
| **Auth** | `/api/v1/auth/refresh` | `POST` | **10 - 15 ms** |
| **Integrations** | `/api/v1/integrations/residence/service-requests` | `POST` | **15 - 20 ms** *(Cached repeat: 2ms)* |
| **Integrations** | `/api/v1/integrations/rwa/complaints` | `POST` | **14 - 18 ms** |
| **Service Requests**| `/api/v1/service-requests` | `GET` | **8 - 12 ms** |
| **Service Requests**| `/api/v1/service-requests/:id/approve` | `POST` | **14 - 18 ms** |
| **Agency** | `/api/v1/agency/service-requests/:id/dispatch` | `POST` | **18 - 25 ms** |
| **Technician** | `/api/v1/technician/jobs` | `GET` | **7 - 10 ms** |
| **Technician** | `/api/v1/technician/jobs/:id/complete` | `POST` | **15 - 20 ms** |
| **Security** | `/api/v1/security/gate-passes/verify` | `POST` | **4 - 6 ms** |
| **Security** | `/api/v1/security/gate-passes/:id/check-in` | `POST` | **6 - 8 ms** |



---

## 4. Live Production API Endpoints (Render Deployment)

- **Production Base URL**: `https://bpm-backend-80wo.onrender.com`
- **API Version 1 Base**: `https://bpm-backend-80wo.onrender.com/api/v1`
- **Interactive Swagger Documentation**: [https://bpm-backend-80wo.onrender.com/docs](https://bpm-backend-80wo.onrender.com/docs)
- **API v1 Swagger Documentation**: [https://bpm-backend-80wo.onrender.com/api/v1/docs](https://bpm-backend-80wo.onrender.com/api/v1/docs)

---

### 4.1 System & Documentation Endpoints

| Method | Endpoint | Live Production URL | Authentication / Access | Description |
|---|---|---|---|---|
| `GET` | `/` | [https://bpm-backend-80wo.onrender.com/](https://bpm-backend-80wo.onrender.com/) | Public | API Root status, metadata, and doc links |
| `GET` | `/docs` | [https://bpm-backend-80wo.onrender.com/docs](https://bpm-backend-80wo.onrender.com/docs) | Public | Interactive Swagger / OpenAPI UI |
| `GET` | `/api/v1/docs` | [https://bpm-backend-80wo.onrender.com/api/v1/docs](https://bpm-backend-80wo.onrender.com/api/v1/docs) | Public | Interactive Swagger UI (V1 path) |
| `GET` | `/health/live` | [https://bpm-backend-80wo.onrender.com/health/live](https://bpm-backend-80wo.onrender.com/health/live) | Public | Liveness probe (Process status) |
| `GET` | `/health/ready` | [https://bpm-backend-80wo.onrender.com/health/ready](https://bpm-backend-80wo.onrender.com/health/ready) | Public | Readiness probe (Database & service state) |
| `GET` | `/api/v1/health/live` | [https://bpm-backend-80wo.onrender.com/api/v1/health/live](https://bpm-backend-80wo.onrender.com/api/v1/health/live) | Public | V1 Liveness probe |
| `GET` | `/api/v1/health/ready` | [https://bpm-backend-80wo.onrender.com/api/v1/health/ready](https://bpm-backend-80wo.onrender.com/api/v1/health/ready) | Public | V1 Readiness probe |
| `POST` | `/api/v1/uploads/presign` | [https://bpm-backend-80wo.onrender.com/api/v1/uploads/presign](https://bpm-backend-80wo.onrender.com/api/v1/uploads/presign) | Public | Generate presigned media upload URL |

---

### 4.2 Authentication & User Profile (`/api/v1/auth`)

| Method | Endpoint | Live Production URL | Headers / Auth | Description |
|---|---|---|---|---|
| `POST` | `/api/v1/auth/login` | [https://bpm-backend-80wo.onrender.com/api/v1/auth/login](https://bpm-backend-80wo.onrender.com/api/v1/auth/login) | Public (Rate-limited) | User login, returns JWT access & refresh tokens |
| `POST` | `/api/v1/auth/refresh` | [https://bpm-backend-80wo.onrender.com/api/v1/auth/refresh](https://bpm-backend-80wo.onrender.com/api/v1/auth/refresh) | Public (Rate-limited) | Refresh expired access token |
| `POST` | `/api/v1/auth/logout` | [https://bpm-backend-80wo.onrender.com/api/v1/auth/logout](https://bpm-backend-80wo.onrender.com/api/v1/auth/logout) | `Authorization: Bearer <token>` | User logout and session invalidation |
| `GET` | `/api/v1/auth/me` | [https://bpm-backend-80wo.onrender.com/api/v1/auth/me](https://bpm-backend-80wo.onrender.com/api/v1/auth/me) | `Authorization: Bearer <token>` | Get profile of currently logged-in user |

---

### 4.3 External Application Integrations (`/api/v1/integrations`)

| Method | Endpoint | Live Production URL | Headers / Auth | Description |
|---|---|---|---|---|
| `POST` | `/api/v1/integrations/residence/service-requests` | [https://bpm-backend-80wo.onrender.com/api/v1/integrations/residence/service-requests](https://bpm-backend-80wo.onrender.com/api/v1/integrations/residence/service-requests) | `x-client-id: residence-api-client`<br>`Idempotency-Key` | Residence App: Ingest service request |
| `GET` | `/api/v1/integrations/residence/service-requests/:sourceRequestId` | [https://bpm-backend-80wo.onrender.com/api/v1/integrations/residence/service-requests/:sourceRequestId](https://bpm-backend-80wo.onrender.com/api/v1/integrations/residence/service-requests/:sourceRequestId) | `x-client-id: residence-api-client` | Residence App: Query request status by source ID |
| `POST` | `/api/v1/integrations/residence/gate-pass-requests` | [https://bpm-backend-80wo.onrender.com/api/v1/integrations/residence/gate-pass-requests](https://bpm-backend-80wo.onrender.com/api/v1/integrations/residence/gate-pass-requests) | `x-client-id: residence-api-client`<br>`Idempotency-Key` | Residence App: Submit gate pass request |
| `POST` | `/api/v1/integrations/rwa/complaints` | [https://bpm-backend-80wo.onrender.com/api/v1/integrations/rwa/complaints](https://bpm-backend-80wo.onrender.com/api/v1/integrations/rwa/complaints) | `x-client-id: rwa-api-client`<br>`Idempotency-Key` | RWA App: Ingest community complaint |
| `GET` | `/api/v1/integrations/rwa/complaints/:sourceRequestId` | [https://bpm-backend-80wo.onrender.com/api/v1/integrations/rwa/complaints/:sourceRequestId](https://bpm-backend-80wo.onrender.com/api/v1/integrations/rwa/complaints/:sourceRequestId) | `x-client-id: rwa-api-client` | RWA App: Query complaint status |
| `POST` | `/api/v1/integrations/security/access-requests` | [https://bpm-backend-80wo.onrender.com/api/v1/integrations/security/access-requests](https://bpm-backend-80wo.onrender.com/api/v1/integrations/security/access-requests) | `x-client-id: security-api-client`<br>`Idempotency-Key` | Security App: Guard registers unannounced visitor arrival |

---

### 4.4 Service Requests (`/api/v1/service-requests`)

| Method | Endpoint | Live Production URL | Roles Allowed | Description |
|---|---|---|---|---|
| `GET` | `/api/v1/service-requests` | [https://bpm-backend-80wo.onrender.com/api/v1/service-requests](https://bpm-backend-80wo.onrender.com/api/v1/service-requests) | Authenticated | List all service requests (with filters & pagination) |
| `GET` | `/api/v1/service-requests/:id` | [https://bpm-backend-80wo.onrender.com/api/v1/service-requests/:id](https://bpm-backend-80wo.onrender.com/api/v1/service-requests/:id) | Authenticated | Get service request details by ID |
| `POST` | `/api/v1/service-requests/:id/approve` | [https://bpm-backend-80wo.onrender.com/api/v1/service-requests/:id/approve](https://bpm-backend-80wo.onrender.com/api/v1/service-requests/:id/approve) | `RWA_PRESIDENT`, `RWA_VICE_PRESIDENT`, `AGENCY_ADMIN` | Approve a pending service request |
| `POST` | `/api/v1/service-requests/:id/reject` | [https://bpm-backend-80wo.onrender.com/api/v1/service-requests/:id/reject](https://bpm-backend-80wo.onrender.com/api/v1/service-requests/:id/reject) | `RWA_PRESIDENT`, `RWA_VICE_PRESIDENT`, `AGENCY_ADMIN` | Reject a service request |
| `POST` | `/api/v1/service-requests/:id/hold` | [https://bpm-backend-80wo.onrender.com/api/v1/service-requests/:id/hold](https://bpm-backend-80wo.onrender.com/api/v1/service-requests/:id/hold) | `AGENCY_ADMIN`, `AGENCY_SUPERVISOR` | Place a service request on hold |
| `POST` | `/api/v1/service-requests/:id/resume` | [https://bpm-backend-80wo.onrender.com/api/v1/service-requests/:id/resume](https://bpm-backend-80wo.onrender.com/api/v1/service-requests/:id/resume) | `AGENCY_ADMIN`, `AGENCY_SUPERVISOR` | Resume a held service request |
| `POST` | `/api/v1/service-requests/:id/resolve` | [https://bpm-backend-80wo.onrender.com/api/v1/service-requests/:id/resolve](https://bpm-backend-80wo.onrender.com/api/v1/service-requests/:id/resolve) | `AGENCY_ADMIN`, `AGENCY_SUPERVISOR` | Mark service request resolved |
| `POST` | `/api/v1/service-requests/:id/close` | [https://bpm-backend-80wo.onrender.com/api/v1/service-requests/:id/close](https://bpm-backend-80wo.onrender.com/api/v1/service-requests/:id/close) | `AGENCY_ADMIN`, `AGENCY_SUPERVISOR`, `RWA_PRESIDENT` | Finalize and close service request |

---

### 4.5 Agency Operations & Dispatch Queue (`/api/v1/agency`)

| Method | Endpoint | Live Production URL | Roles Allowed | Description |
|---|---|---|---|---|
| `GET` | `/api/v1/agency/service-requests` | [https://bpm-backend-80wo.onrender.com/api/v1/agency/service-requests](https://bpm-backend-80wo.onrender.com/api/v1/agency/service-requests) | `AGENCY_ADMIN`, `AGENCY_SUPERVISOR` | Get agency triage queue |
| `GET` | `/api/v1/agency/service-requests/:id` | [https://bpm-backend-80wo.onrender.com/api/v1/agency/service-requests/:id](https://bpm-backend-80wo.onrender.com/api/v1/agency/service-requests/:id) | `AGENCY_ADMIN`, `AGENCY_SUPERVISOR` | Get service request details for dispatch |
| `POST` | `/api/v1/agency/service-requests/:id/dispatch` | [https://bpm-backend-80wo.onrender.com/api/v1/agency/service-requests/:id/dispatch](https://bpm-backend-80wo.onrender.com/api/v1/agency/service-requests/:id/dispatch) | `AGENCY_ADMIN`, `AGENCY_SUPERVISOR`<br>`Idempotency-Key` | Dispatch work order & assign technicians |
| `GET` | `/api/v1/agency/technicians` | [https://bpm-backend-80wo.onrender.com/api/v1/agency/technicians](https://bpm-backend-80wo.onrender.com/api/v1/agency/technicians) | `AGENCY_ADMIN`, `AGENCY_SUPERVISOR` | List roster of technicians |

---

### 4.6 Work Orders (`/api/v1/work-orders`)

| Method | Endpoint | Live Production URL | Roles Allowed | Description |
|---|---|---|---|---|
| `GET` | `/api/v1/work-orders` | [https://bpm-backend-80wo.onrender.com/api/v1/work-orders](https://bpm-backend-80wo.onrender.com/api/v1/work-orders) | `AGENCY_ADMIN`, `AGENCY_SUPERVISOR`, `RWA_PRESIDENT` | List work orders with filter & pagination |
| `GET` | `/api/v1/work-orders/:id` | [https://bpm-backend-80wo.onrender.com/api/v1/work-orders/:id](https://bpm-backend-80wo.onrender.com/api/v1/work-orders/:id) | `AGENCY_ADMIN`, `AGENCY_SUPERVISOR`, `RWA_PRESIDENT` | Get work order details |
| `POST` | `/api/v1/work-orders/:id/assignments` | [https://bpm-backend-80wo.onrender.com/api/v1/work-orders/:id/assignments](https://bpm-backend-80wo.onrender.com/api/v1/work-orders/:id/assignments) | `AGENCY_ADMIN`, `AGENCY_SUPERVISOR` | Assign or add technician to work order |

---

### 4.7 Technician Field Execution (`/api/v1/technician`)

| Method | Endpoint | Live Production URL | Roles Allowed | Description |
|---|---|---|---|---|
| `GET` | `/api/v1/technician/jobs` | [https://bpm-backend-80wo.onrender.com/api/v1/technician/jobs](https://bpm-backend-80wo.onrender.com/api/v1/technician/jobs) | `TECHNICIAN`, `AGENCY_ADMIN`, `AGENCY_SUPERVISOR` | List jobs assigned to technician |
| `GET` | `/api/v1/technician/jobs/:jobId` | [https://bpm-backend-80wo.onrender.com/api/v1/technician/jobs/:jobId](https://bpm-backend-80wo.onrender.com/api/v1/technician/jobs/:jobId) | `TECHNICIAN`, `AGENCY_ADMIN`, `AGENCY_SUPERVISOR` | Get technician job details |
| `POST` | `/api/v1/technician/jobs/:jobId/check-in` | [https://bpm-backend-80wo.onrender.com/api/v1/technician/jobs/:jobId/check-in](https://bpm-backend-80wo.onrender.com/api/v1/technician/jobs/:jobId/check-in) | `TECHNICIAN`, `AGENCY_ADMIN`, `AGENCY_SUPERVISOR` | Technician on-site check-in / start work |
| `POST` | `/api/v1/technician/jobs/:jobId/notes` | [https://bpm-backend-80wo.onrender.com/api/v1/technician/jobs/:jobId/notes](https://bpm-backend-80wo.onrender.com/api/v1/technician/jobs/:jobId/notes) | `TECHNICIAN`, `AGENCY_ADMIN`, `AGENCY_SUPERVISOR` | Append progress notes to job |
| `POST` | `/api/v1/technician/jobs/:jobId/attachments` | [https://bpm-backend-80wo.onrender.com/api/v1/technician/jobs/:jobId/attachments](https://bpm-backend-80wo.onrender.com/api/v1/technician/jobs/:jobId/attachments) | `TECHNICIAN`, `AGENCY_ADMIN`, `AGENCY_SUPERVISOR` | Attach photo proof / documents |
| `POST` | `/api/v1/technician/jobs/:jobId/hold` | [https://bpm-backend-80wo.onrender.com/api/v1/technician/jobs/:jobId/hold](https://bpm-backend-80wo.onrender.com/api/v1/technician/jobs/:jobId/hold) | `TECHNICIAN`, `AGENCY_ADMIN`, `AGENCY_SUPERVISOR` | Place technician job on hold (e.g., waiting for parts) |
| `POST` | `/api/v1/technician/jobs/:jobId/resume` | [https://bpm-backend-80wo.onrender.com/api/v1/technician/jobs/:jobId/resume](https://bpm-backend-80wo.onrender.com/api/v1/technician/jobs/:jobId/resume) | `TECHNICIAN`, `AGENCY_ADMIN`, `AGENCY_SUPERVISOR` | Resume job execution |
| `POST` | `/api/v1/technician/jobs/:jobId/complete` | [https://bpm-backend-80wo.onrender.com/api/v1/technician/jobs/:jobId/complete](https://bpm-backend-80wo.onrender.com/api/v1/technician/jobs/:jobId/complete) | `TECHNICIAN`, `AGENCY_ADMIN`, `AGENCY_SUPERVISOR` | Mark job complete with summary notes |
| `GET` | `/api/v1/technician/jobs/:jobId/gate-pass` | [https://bpm-backend-80wo.onrender.com/api/v1/technician/jobs/:jobId/gate-pass](https://bpm-backend-80wo.onrender.com/api/v1/technician/jobs/:jobId/gate-pass) | `TECHNICIAN`, `AGENCY_ADMIN`, `AGENCY_SUPERVISOR` | Fetch gate pass issued for technician entry |

---

### 4.8 Gate Passes & Visitor Management (`/api/v1/gate-passes`)

| Method | Endpoint | Live Production URL | Roles Allowed | Description |
|---|---|---|---|---|
| `POST` | `/api/v1/gate-passes/requests` | [https://bpm-backend-80wo.onrender.com/api/v1/gate-passes/requests](https://bpm-backend-80wo.onrender.com/api/v1/gate-passes/requests) | Authenticated | Create visitor / guest / delivery gate pass request |
| `GET` | `/api/v1/gate-passes/requests` | [https://bpm-backend-80wo.onrender.com/api/v1/gate-passes/requests](https://bpm-backend-80wo.onrender.com/api/v1/gate-passes/requests) | Authenticated | List all gate pass requests |
| `GET` | `/api/v1/gate-passes/requests/:id` | [https://bpm-backend-80wo.onrender.com/api/v1/gate-passes/requests/:id](https://bpm-backend-80wo.onrender.com/api/v1/gate-passes/requests/:id) | Authenticated | Get gate pass request by ID |
| `POST` | `/api/v1/gate-passes/requests/:id/approve` | [https://bpm-backend-80wo.onrender.com/api/v1/gate-passes/requests/:id/approve](https://bpm-backend-80wo.onrender.com/api/v1/gate-passes/requests/:id/approve) | `RESIDENT`, `SECURITY_ADMIN`, `AGENCY_ADMIN` | Approve request & generate active gate pass QR/OTP |
| `POST` | `/api/v1/gate-passes/requests/:id/reject` | [https://bpm-backend-80wo.onrender.com/api/v1/gate-passes/requests/:id/reject](https://bpm-backend-80wo.onrender.com/api/v1/gate-passes/requests/:id/reject) | `RESIDENT`, `SECURITY_ADMIN`, `AGENCY_ADMIN` | Reject gate pass request |
| `GET` | `/api/v1/gate-passes` | [https://bpm-backend-80wo.onrender.com/api/v1/gate-passes](https://bpm-backend-80wo.onrender.com/api/v1/gate-passes) | Authenticated | List issued gate passes |
| `GET` | `/api/v1/gate-passes/:id` | [https://bpm-backend-80wo.onrender.com/api/v1/gate-passes/:id](https://bpm-backend-80wo.onrender.com/api/v1/gate-passes/:id) | Authenticated | Get gate pass by ID |
| `POST` | `/api/v1/gate-passes/:id/revoke` | [https://bpm-backend-80wo.onrender.com/api/v1/gate-passes/:id/revoke](https://bpm-backend-80wo.onrender.com/api/v1/gate-passes/:id/revoke) | `RESIDENT`, `SECURITY_ADMIN`, `AGENCY_ADMIN` | Revoke active gate pass |

---

### 4.9 Security & Guard Gate Access (`/api/v1/security`)

| Method | Endpoint | Live Production URL | Roles Allowed | Description |
|---|---|---|---|---|
| `POST` | `/api/v1/security/access-requests` | [https://bpm-backend-80wo.onrender.com/api/v1/security/access-requests](https://bpm-backend-80wo.onrender.com/api/v1/security/access-requests) | `SECURITY_GUARD`, `SECURITY_ADMIN` | Guard registers walk-in visitor arrival |
| `GET` | `/api/v1/security/access-requests/:id` | [https://bpm-backend-80wo.onrender.com/api/v1/security/access-requests/:id](https://bpm-backend-80wo.onrender.com/api/v1/security/access-requests/:id) | Authenticated | Guard checks visitor approval status |
| `POST` | `/api/v1/security/gate-passes/verify` | [https://bpm-backend-80wo.onrender.com/api/v1/security/gate-passes/verify](https://bpm-backend-80wo.onrender.com/api/v1/security/gate-passes/verify) | `SECURITY_GUARD`, `SECURITY_ADMIN` | Guard scans QR token or validates OTP |
| `POST` | `/api/v1/security/gate-passes/:id/check-in` | [https://bpm-backend-80wo.onrender.com/api/v1/security/gate-passes/:id/check-in](https://bpm-backend-80wo.onrender.com/api/v1/security/gate-passes/:id/check-in) | `SECURITY_GUARD`, `SECURITY_ADMIN` | Check-in visitor through security gate |
| `POST` | `/api/v1/security/gate-passes/:id/check-out` | [https://bpm-backend-80wo.onrender.com/api/v1/security/gate-passes/:id/check-out](https://bpm-backend-80wo.onrender.com/api/v1/security/gate-passes/:id/check-out) | `SECURITY_GUARD`, `SECURITY_ADMIN` | Check-out visitor leaving property |
| `POST` | `/api/v1/security/resident/access-requests/:id/decision` | [https://bpm-backend-80wo.onrender.com/api/v1/security/resident/access-requests/:id/decision](https://bpm-backend-80wo.onrender.com/api/v1/security/resident/access-requests/:id/decision) | `RESIDENT`, `AGENCY_ADMIN`, `SECURITY_ADMIN` | Resident approves or denies arrival request |

---

### 4.10 Quick Testing Examples with Live URL

#### Check Service Status & Readiness:
```bash
curl -X GET "https://bpm-backend-80wo.onrender.com/health/ready"
```

#### User Login:
```bash
curl -X POST "https://bpm-backend-80wo.onrender.com/api/v1/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email": "admin@beeproperty.com", "password": "yourPasswordHere"}'
```

#### Verify Gate Pass:
```bash
curl -X POST "https://bpm-backend-80wo.onrender.com/api/v1/security/gate-passes/verify" \
  -H "Authorization: Bearer <GUARD_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"otp": "482910"}'
```
