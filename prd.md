# Product Requirements Document (PRD)

## BEE Property Service & Access API

**Document:** `prd.md`  
**Status:** Implementation-ready product specification for Antigravity  
**Backend:** Node.js (Active LTS) + Express.js  
**Database:** MongoDB  
**API version:** `/api/v1`  
**Date:** 6 November 2026

---

## 1. Product overview

Build a secure Node.js/Express backend dedicated to the service-request, agency-dispatch, technician-work-order, and gate-pass workflows shared by the BEE applications.

The organization currently has two backend platforms:

- **.NET backend:** continues to serve the existing .NET-owned application capabilities. The Node service must not duplicate or take over unrelated modules.
- **Node.js/Express backend (this project):** owns the service-management domain described in this document and exposes versioned APIs for Residence, RWA, Agency, Technician, and Security applications.

MongoDB is the persistence layer for the Node service. Applications must call APIs; they must not read or write the Node service's MongoDB collections directly.

### 1.1 Primary outcomes

1. Residence and RWA applications can submit service requests/complaints to the Agency workflow.
2. The Agency application can review, approve where required, dispatch, and allocate one or more technicians to a service request.
3. The Technician application can receive assigned work, update progress, submit notes and inspection evidence, put work on hold, and complete work.
4. Residence and Security applications can create gate-pass/access requests. The system can route approvals, issue time-bounded passes, and let Security verify entry and exit.
5. Every important state change is authenticated, authorized, auditable, idempotent where appropriate, and propagated to the relevant applications.

### 1.2 Explicit domain boundary

The Node service owns:

- Service requests and their lifecycle.
- RWA complaint intake for complaints that enter the Agency service workflow.
- Agency review/approval/dispatch decisions for those service requests.
- Work orders and multi-technician assignments.
- Technician job updates and evidence metadata.
- Gate-pass requests, issued passes, QR/OTP verification, and gate-entry events.
- Notifications/events and integration delivery records for these workflows.

The Node service does **not** become the owner of:

- RWA apartment master data, resident registration, resident directory, RWA elections/roles, dues, accounting, facility bookings, or general announcements.
- Residence household/profile master data, vehicles, general notifications, or unrelated resident features.
- Security shift schedules, patrol plans, guard HR, general vehicle management, or unrelated security operations.
- Agency payments, financial reports, or unrelated agency administration.

For required property, resident, technician, and role data, Node stores stable external IDs and only the minimum immutable snapshot required to preserve a service record. It validates identity and property membership through the agreed trusted integration/master-data API. It must not treat a display name or client-supplied phone number as proof of identity.

---

## 2. Existing application data used as requirements

The following uploaded JSON files were reviewed and are the source vocabulary for this specification:

| Source file | Existing concepts used by this backend |
|---|---|
| `agencies_json.json` | Agency service requests, case/work-order IDs, categories, service types, priorities, stages, multi-technician service-order allocations, issue/IN/OUT evidence, voice-note metadata, audit trail, technician directory |
| `residence_json.json` | Household identity, resident/family users, home service requests, photos/history, pre-approved guest/contractor passes, visitor decisions and notifications |
| `Rwa_json.json` | Apartment/tower/resident references, maintenance complaints, complaint scope, approval requirement, dispatch flag, category, issue type, priority, submitter, assignment and history |
| `Security_json.json` | Property/block/floor/flat references, guard visitor/delivery entries, resident approval, gate/guard information, pending/in/out visit states |
| `Technician_Json.json` | Work-order/job identifiers, complaint linkage, service category, worker role, priority, deadline, property/resident snapshot, technician notes, before/after photos, timeline, and work-order-linked gate passes |

### 2.1 Important source field mappings

**Residence service request** currently contains fields such as `id`, `category`, `title`, `description`, `urgency`, `status`, `preferredDate`, `preferredTimeSlot`, `confirmedDate`, `confirmedTimeSlot`, `technician`, `createdAt`, `createdBy`, `photos`, and `history`.

**RWA complaint** currently contains fields such as `id`, `title`, `category`, `issueType`, `apartment`, `location`, `placeName`, `floor`, `asset`, `description`, `priority`, `status`, `complaintScope`, `requiresApproval`, `dispatchedToAgentApp`, `submittedBy`, `submittedByRole`, `assignedTo`, `assignedDate`, `createdAt`, `updatedAt`, `photoUrl`, and `history`. Some records omit optional fields; the API must support optional values.

**Agency service request** currently contains `id`, `caseOrderId`, `caseTitle`, `workOrderId`, `workOrderTitle`, `category`, `service`, `resident`, `apartment`, `tower`, `flatNo`, `technician`, `technicianId`, `assignedDate`, `targetDate`, `priority`, `status`, `holdReason`, `description`, `issueImage`, `inImage`, `outImage`, `inTime`, `outTime`, `inNotes`, `outNotes`, `assignedTechnicians`, `audio`, and `auditTrail`. `assignedTechnicians` supports multiple allocations and includes `soId`, `technicianId`, `name`, `skill`, `mobile`, `role`, dates, status, and instructions.

**Technician job** currently contains `id`, `displayId`, `complaintId`, `complaintTitle`, `serviceCategory`, `role`, `priority`, `gateEntryOtp`, `whenToGo`, `status`, `reportedAt`, `assignedAt`, `deadline`, `property`, `resident`, `originalDescription`, `technicianNote`, `beforePhotos`, `afterPhotos`, and `timeline`.

**Gate-pass examples** include `gatePassNumber`, `linkedJobId`, property and technician details, purpose, `validFrom`, `validUntil`, `accessGate`, `accessInstructions`, `issuingAuthority`, status, barcode and QR payload. Residence pre-approved passes contain guest details, category, purpose, expected time, validity, vehicle number, OTP, QR payload, and status.

### 2.2 Source-data constraints

- Existing Agency service categories include `Technicians`, `Security`, and `Daily Works`; examples of service values include `Electrical Repair`, `Plumbing`, `AC Maintenance`, `Civil Maintenance`, `Permission Request`, `Approval Request`, `Waste & Garbage Collection`, `Daily Housekeeping`, and `Water Supply Operations`. RWA complaint categories include values such as `Civil & Structural`, `Lift / Elevator`, `Water Supply`, `Electricity and Lighting`, `Gym Equipment`, `Plumbing`, `Indoor Sports`, `Cleanliness`, `Security`, and `Function Hall`. Residence uses household service categories such as Plumbing, Air Conditioning and Electrical Repairs. Treat the combined taxonomy as configurable; do not silently reject valid source categories just because they are not in a short hard-coded enum.

- Keep each upstream ID in its own namespace. For example, a Residence ticket ID, RWA complaint ID, Agency request ID, Agency work-order ID, Technician job ID, and gate-pass ID are different identifiers and must be linked explicitly.
- Do not derive a database relationship from a matching name, phone number, flat label, or display ID alone.
- Do not assume every RWA complaint requires approval. Respect `requiresApproval` when it is present; otherwise use a configured approval policy or reject the request as needing clarification. Never silently assume approval.
- The source JSON files contain demo credentials, demo OTPs, sample visitor records, and sample technician gate-entry OTPs. These values are **demo-only**. Do not seed them into production, reuse them as passwords/OTP values, or expose them in logs or generated tokens.
- The source JSONs contain mixed formats and demo inconsistencies. They also use different sample property identities across apps (for example, Residence `Bee Hive Residency`, RWA `Golden Apartment`, Security `Bee Property`, Agency's Hyderabad societies, and Technician sample properties). The files do not prove these are the same properties and do not contain a shared global property ID map. Do not join records by name, address, tower label or flat number. A verified cross-application property mapping from the authoritative .NET/master-data service is a go-live prerequisite.
- Normalize dates to ISO 8601 UTC in Node; preserve the original source payload only as a controlled, redacted integration snapshot where needed. Validate property/tower/unit references against the authoritative master-data service.
- The RWA fixture's top-level apartment totals and its nested tower totals do not reconcile; treat them as illustrative UI data and do not use them as constraints or production seeds until the RWA owner reconciles them.

---

## 3. Users, applications, and permissions

### 3.1 Application clients

Each application/backend integration must have its own registered client identity and credentials:

- `residence-api-client`
- `rwa-api-client`
- `agency-portal-client`
- `technician-app-client`
- `security-api-client`
- `dotnet-backend-client` (only for explicitly approved .NET-to-Node integration)

Never share one client secret across applications. Secrets are stored in a secret manager and rotated.

### 3.2 Human roles

The following role names are canonical suggestions for authorization. Map the real existing user roles to these values in the identity integration; do not trust a role sent in the request body.

| Role | Main allowed actions |
|---|---|
| `RESIDENT` | Create service requests for own verified household; create guest/contractor passes; view own requests and passes; approve/reject a visitor arrival addressed to their household |
| `RWA_PRESIDENT` | Review/approve RWA complaints within assigned apartment/society scope; oversee and view scoped complaints |
| `RWA_VICE_PRESIDENT` | Assign/update complaints and oversee facilities within assigned scope, subject to configured permissions |
| `RWA_MANAGER` | Perform explicitly granted RWA complaint workflow actions within assigned scope |
| `AGENCY_ADMIN` | View and manage service workflow; approve/dispatch; assign technicians; issue/revoke authorized work passes |
| `AGENCY_SUPERVISOR` / `DISPATCHER` | Review, assign, reassign, schedule and monitor requests according to permission matrix |
| `TECHNICIAN` | View only jobs assigned to the authenticated technician; update own job status, notes, check-in/out, and evidence |
| `SECURITY_ADMIN` | Configure or oversee gate access and security pass operations within assigned property scope |
| `SECURITY_SUPERVISOR` | Review guard access requests and supervise gate activity |
| `SECURITY_GUARD` | Create visitor-arrival/access requests; verify valid passes; record allowed entry/exit; cannot approve their own access request |
| `SYSTEM_CLIENT` | Machine-to-machine access limited to explicit client scopes and property scopes |

### 3.3 Authorization model

Use both role-based and attribute-based authorization (RBAC + ABAC).

Every object-level read or write must verify:

1. The authenticated subject/client is allowed to perform the action.
2. The object belongs to a community/society/property scope available to that subject/client.
3. For a resident, the object belongs to the authenticated user's verified household/flat.
4. For a technician, the work order is assigned to that technician (or a specifically authorized supervisor is acting).
5. For a guard, the gate/property is assigned to the guard's active scope.

Never authorize solely because the client supplied an object ID. This applies to service request IDs, work-order IDs, assignment IDs, pass IDs, user IDs, property IDs, and source record IDs.

---

## 4. Core user workflows

### 4.1 Residence service request → Agency → Technician

1. A resident submits a home service request in the Residence app.
2. Residence backend sends the request to Node using its machine client credentials and a unique `Idempotency-Key`.
3. Node authenticates the client, validates the payload, resolves the source request ID, verifies the resident/household/property reference, checks the allowed service category and deduplicates the request.
4. Node creates a canonical service request and returns the Node `serviceRequestId` plus the existing `sourceRequestId`.
5. The Agency portal can see the request in its service-request queue. An authorized Agency user reviews it and approves/rejects or dispatches it according to policy.
6. Dispatch creates an Agency work order and one or more technician assignments/service orders (`soId`).
7. Each technician sees only their assigned job in the Technician app.
8. Technician updates work to `IN_PROGRESS`, adds notes/evidence, may place it `ON_HOLD` with a reason/material requirement, and eventually marks it `COMPLETED`.
9. Node updates the canonical request, records the timeline/audit event, and publishes status updates to Residence and Agency.
10. An authorized Agency user closes the request after required completion/verification. The Residence app sees the current status and history.

### 4.2 RWA complaint → Agency → Technician

1. RWA sends a complaint using its existing complaint ID, category, title, description, location, priority, submitter, apartment/tower/flat references, and approval metadata.
2. Node verifies the RWA client and all referenced scope data, then creates or returns the existing canonical request for that upstream complaint.
3. If `requiresApproval=true`, the complaint enters `PENDING_APPROVAL` and must not be dispatched until an authorized RWA approver approves it.
4. When the RWA complaint is approved or the configured policy says approval is not required, it becomes eligible for Agency review/dispatch.
5. Agency dispatch and multi-technician assignment follow workflow 4.1.
6. Technician progress, evidence, resolution and Agency closure are synced back to the RWA application.
7. The integration must update the RWA dispatch state through a secured callback/API when dispatch succeeds; a client-side `dispatchedToAgentApp` value is not proof that delivery happened.

### 4.3 Residence-created guest/contractor pass

1. An authenticated resident creates a pass request with guest/contractor name, phone, category, purpose, expected date/time, validity end, optional vehicle number, and household reference.
2. Node validates that the resident belongs to that household and is allowed to issue the requested pass type.
3. Node applies the community/property approval policy. The policy may approve automatically or require an authorized approver. The policy must be configurable per property/pass type; do not hard-code a universal auto-approval rule.
4. After approval, Node issues a time-bounded pass with a random, high-entropy, opaque QR token. Store only a hash of the QR token. Do not put private personal data or a reusable plaintext OTP in the QR payload.
5. Residence shows the pass and its validity. Security verifies it online at the gate and records entry/exit events.
6. Passes become invalid on expiry, revocation, use (where single-entry), or policy-defined conditions.

### 4.4 Security-created visitor arrival / resident approval

1. A Security guard records a visitor/delivery/contractor arrival with gate, visitor type, name, phone (where available), vehicle number, destination flat, purpose, and arrival time.
2. Node creates a visitor-access request in `PENDING_RESIDENT_APPROVAL` and sends a real-time/push notification to the target household through the Residence integration.
3. An authorized resident approves or rejects the request. The Security guard cannot approve on behalf of the resident.
4. On approval, Node returns an allow decision to Security and creates a short-lived entry credential if the property policy requires one. On rejection/expiry, entry is denied.
5. Security records `CHECKED_IN` and `CHECKED_OUT` as separate visit events. A visitor's `in`/`out` state must not be confused with the pass lifecycle state.

### 4.5 Technician work-order gate pass

1. Agency assigns a technician to a work order and supplies the planned visit window, property, gate and job purpose.
2. Node creates a technician gate-pass request linked to the work order and exact technician assignment.
3. The relevant approval policy is applied (for example, Agency authorization plus any required property/security approval).
4. Once approved, the Technician app receives pass status and a secure QR/verification reference. Do not expose a plaintext gate OTP in the general job payload.
5. Security validates that the pass is valid, is for this technician/property/work order, and is within its valid time window.
6. Revoked, expired, wrong-property, wrong-technician, wrong-purpose, already-used (single-entry) or invalid passes must be denied and audited.

---

## 5. Functional requirements

### 5.1 Service request intake

- **FR-SR-001:** Accept requests from Residence and RWA only through authenticated, application-specific integration endpoints.
- **FR-SR-002:** Support source identifiers and source application: `RESIDENCE` or `RWA`.
- **FR-SR-003:** Make request creation idempotent using both `Idempotency-Key` and a unique `(sourceApplication, sourceRequestId)` constraint.
- **FR-SR-004:** Preserve source category, title, issue type, description, priority/urgency, location fields, attachments metadata, submitted-by identity, and preferred schedule where supplied.
- **FR-SR-005:** Normalize requests to canonical statuses and priorities while retaining original source status/values for traceability.
- **FR-SR-006:** Validate property membership, resident or RWA submitter, community/society scope, and service category.
- **FR-SR-007:** Support common-area and individual-flat complaints. Use `complaintScope` where supplied.
- **FR-SR-008:** Store every status change and consequential action in an append-only audit timeline.

### 5.2 Approval and Agency dispatch

- **FR-DSP-001:** Expose an Agency queue with filters for source app, property, society, category, priority, status, date range and approval state.
- **FR-DSP-002:** Support approve/reject actions where approval is required.
- **FR-DSP-003:** Prevent dispatch while required approvals are pending or rejected.
- **FR-DSP-004:** Support one work order with multiple technician assignments.
- **FR-DSP-005:** Each assignment must have its own technician ID, role/skill, instructions, target date, assignment status and service-order ID.
- **FR-DSP-006:** Only authorized Agency users can assign/reassign technicians.
- **FR-DSP-007:** Verify that a technician is active, has the required skill, and is allowed to cover the property before assignment.
- **FR-DSP-008:** Reassignment must preserve the prior assignment and its audit events; never silently overwrite history.

### 5.3 Technician execution

- **FR-TECH-001:** Technician can list and read only assigned jobs.
- **FR-TECH-002:** Technician can transition an assigned job to `IN_PROGRESS` and add check-in time/location evidence where policy permits.
- **FR-TECH-003:** Technician can submit progress notes and before/after photo metadata.
- **FR-TECH-004:** Technician can set `ON_HOLD` only with a reason; optional material requirements must support item, quantity and status.
- **FR-TECH-005:** Technician can mark their assignment `COMPLETED`; the work-order/service-request aggregate is resolved only when all required assignments are complete or an authorized supervisor resolves the remainder.
- **FR-TECH-006:** Every technician action records the authenticated technician, timestamp, assignment and old/new status.
- **FR-TECH-007:** Technician receives notifications for assignment, reassignment, schedule change, cancellation, hold decision and gate-pass changes.

### 5.4 Gate-pass and gate events

- **FR-GP-001:** Accept gate-pass requests from Residence and Security clients.
- **FR-GP-002:** Support guest, delivery, contractor and technician/work-order pass types.
- **FR-GP-003:** A Security-created visitor arrival is an access request; it must not be treated as pre-approved just because a guard created it.
- **FR-GP-004:** A technician pass must be linked to a work order and a specific technician assignment.
- **FR-GP-005:** Support approval, rejection, revocation, expiry, verification, check-in and check-out.
- **FR-GP-006:** Verify signed/opaque QR tokens server-side against a stored hash and current pass state. OTP may be a second verification method but must be hashed and rate-limited.
- **FR-GP-007:** Return only the minimum verification response to Security: `ALLOW`, `DENY`, `REQUIRES_APPROVAL`, or `EXPIRED`, plus safe display details.
- **FR-GP-008:** Log every scan and decision with gate, guard, property, timestamp and reason code.
- **FR-GP-009:** Passes must expire automatically and be rejected after their `validUntil` time.

### 5.5 Synchronization and notifications

- **FR-INT-001:** Publish reliable events for request creation, approval/rejection, dispatch, assignment, status change, resolution, closure, pass creation, pass approval/rejection/revocation/expiry, and gate entry/exit.
- **FR-INT-002:** Use the MongoDB transactional outbox pattern. Persist the business change and its outbox event in the same transaction.
- **FR-INT-003:** Deliver events with at-least-once semantics; consumers must deduplicate by `eventId`.
- **FR-INT-004:** Retry temporary delivery failures with bounded exponential backoff and dead-letter handling. Preserve failed event payloads in a restricted store with secrets/PII redacted.
- **FR-INT-005:** Support pull APIs as a fallback for the Technician and Agency dashboards if a webhook is unavailable.
- **FR-INT-006:** Include a correlation ID and aggregate ID in every event.

---

## 6. Canonical states and mapping

### 6.1 Service request lifecycle

Use these canonical Node statuses:

| Canonical status | Meaning |
|---|---|
| `PENDING` | Received and awaiting initial Agency review |
| `PENDING_APPROVAL` | An upstream or configured approval is required |
| `APPROVED` | Required approval has been recorded |
| `ASSIGNED` | A work order has been dispatched and at least one active technician assignment exists |
| `IN_PROGRESS` | At least one required technician assignment is in progress |
| `ON_HOLD` | Work cannot proceed; a reason is recorded |
| `RESOLVED` | Required work is complete and submitted for verification/closure |
| `CLOSED` | Authorized closure completed |
| `REJECTED` | Request/complaint rejected by an authorized actor |
| `CANCELLED` | Request cancelled by an authorized actor under policy |

Status transitions must be enforced by business rules, not accepted as arbitrary client-provided strings. Reopening a closed request requires a dedicated permission and audit reason.

### 6.2 Source status mapping

| Source | Source value | Canonical interpretation |
|---|---|---|
| Residence | `Pending` | `PENDING` |
| Residence | `Scheduled` | `ASSIGNED` only when a real technician assignment/work order exists; otherwise keep `PENDING` and record scheduled window |
| Residence | `Completed` | `RESOLVED`; Agency closure remains separate |
| RWA | `Pending Approval` | `PENDING_APPROVAL` |
| RWA | `Approved` | `APPROVED` |
| RWA | `In Progress` | `IN_PROGRESS` only when supported by a corresponding dispatch/assignment or authorized status event |
| RWA | `Resolved` | `RESOLVED` |
| RWA | `Closed` | `CLOSED` only when the RWA source is authorized to close or receives a Node closure event |
| Agency | `Pending` | `PENDING` |
| Agency | `Assigned` | `ASSIGNED` |
| Agency | `In Progress` | `IN_PROGRESS` |
| Agency | `Hold` | `ON_HOLD` |
| Agency | `Resolved` | `RESOLVED` |
| Agency | `Closed` | `CLOSED` |
| Technician | `ASSIGNED` | `ASSIGNED` |
| Technician | `IN_PROGRESS` | `IN_PROGRESS` |
| Technician | `ON_HOLD` | `ON_HOLD` |
| Technician | `COMPLETED` | Assignment complete; aggregate becomes `RESOLVED` when completion policy is met |

Preserve the original status in `sourceSnapshot.status` and in an integration mapping record. Unknown source statuses must be rejected or quarantined for mapping; never silently coerce them.

### 6.3 Gate-pass and visit status mapping

| Source | Source value | Canonical interpretation |
|---|---|---|
| Residence pass | `Active` | `ACTIVE` |
| Residence pass | `Used` | `USED` |
| Technician pass | `VALID` | `ACTIVE` |
| Technician pass | `EXPIRED` | `EXPIRED` |
| Technician pass | `REVOKED` | `REVOKED` |
| Security entry | `pending` | Access request pending decision; not a pass status |
| Security entry | `in` | `CHECKED_IN` visit event/state |
| Security entry | `out` | `CHECKED_OUT` visit event/state |

Keep source status values for compatibility/audit. A pass state and a visitor's inside/outside state are separate concepts.

### 6.4 Priority mapping

Use canonical priorities `URGENT`, `HIGH`, `NORMAL`, `LOW`.

- Residence `Urgent` → `URGENT`; `High` → `HIGH`; `Normal` → `NORMAL`.
- RWA `Urgent`, `High`, `Medium`, `Low` → `URGENT`, `HIGH`, `NORMAL`, `LOW` respectively.
- Agency `Urgent` → `URGENT`; `Normal` → `NORMAL`.
- Technician sample priority `URGENT` remains `URGENT`.

---

## 7. API requirements and proposed contracts

All endpoints are versioned under `/api/v1`. Use JSON over HTTPS. User-facing APIs use bearer access tokens. Backend-to-backend APIs use a dedicated service client credential, mTLS where available, and narrow scopes.

### 7.1 API conventions

- Header: `Authorization: Bearer <access-token>`.
- Header: `X-Request-Id: <uuid>` (generated by the edge if absent).
- Header: `Idempotency-Key: <unique-client-generated-value>` for create/dispatch/issue operations.
- Header: `If-Match` or a request version for concurrency-sensitive updates where supported.
- Dates/times: ISO 8601 UTC; retain the property's configured time zone for display and scheduling.
- Lists: cursor pagination with bounded `limit` (default 20, maximum 100).
- Responses: consistent envelope and safe error details. Never return stack traces, secrets or password/token hashes.

Successful response example:

```json
{
  "success": true,
  "data": {
    "serviceRequestId": "SR-2026-000123",
    "sourceApplication": "RESIDENCE",
    "sourceRequestId": "TKT-2026-819",
    "status": "PENDING",
    "createdAt": "2026-11-06T06:30:00.000Z"
  },
  "meta": {
    "requestId": "9cce8a33-8e2f-4bdf-8d2f-fd8cbd6f0f27"
  }
}
```

Error response example (Problem Details style):

```json
{
  "type": "https://api.beeproperty.example/problems/validation-error",
  "title": "Validation failed",
  "status": 422,
  "code": "VALIDATION_ERROR",
  "detail": "One or more fields are invalid.",
  "requestId": "9cce8a33-8e2f-4bdf-8d2f-fd8cbd6f0f27",
  "errors": [
    { "field": "description", "message": "Description is required." }
  ]
}
```

### 7.2 Authentication/session endpoints

These endpoints are implemented by the **single designated identity/token issuer**, not independently by every application backend.

| Method | Endpoint | Purpose |
|---|---|---|
| `POST` | `/api/v1/auth/login` | Optional only when Node is explicitly designated as the shared issuer and the approved login method is defined |
| `POST` | `/api/v1/auth/refresh` | Rotate refresh token and issue a new short-lived access token when Node is the issuer; otherwise the client refreshes with the central issuer |
| `POST` | `/api/v1/auth/logout` | Revoke current refresh-token family/session |
| `GET` | `/api/v1/auth/sessions` | List current user's active sessions, only if identity policy supports it |
| `DELETE` | `/api/v1/auth/sessions/:sessionId` | Revoke a selected session, only if identity policy supports it |
| `GET` | `/.well-known/jwks.json` | Publish public signing keys if Node is the shared issuer |

**Identity decision:** the uploaded JSON files do not establish which backend currently owns login/token issuance. Before implementation, inspect the existing .NET authentication setup. There must be exactly one token issuer for these applications. If .NET already issues tokens, Node validates its access tokens using issuer/audience/JWKS and the refresh request goes to .NET. If no central issuer exists and the project assigns that responsibility to Node, Node may implement the endpoints above and .NET must validate the same issuer's tokens. Do not create competing .NET and Node refresh-token families.

### 7.3 Integration intake endpoints

| Method | Endpoint | Client | Purpose |
|---|---|---|---|
| `POST` | `/api/v1/integrations/residence/service-requests` | Residence | Receive resident home-service request |
| `POST` | `/api/v1/integrations/rwa/complaints` | RWA | Receive RWA maintenance complaint |
| `GET` | `/api/v1/integrations/residence/service-requests/:sourceRequestId` | Residence | Read the latest Node status for a Residence source ticket |
| `GET` | `/api/v1/integrations/rwa/complaints/:sourceRequestId` | RWA | Read the latest Node status for an RWA source complaint |
| `POST` | `/api/v1/integrations/residence/gate-pass-requests` | Residence | Receive resident guest/contractor pass request |
| `POST` | `/api/v1/integrations/security/access-requests` | Security | Receive visitor/delivery/contractor arrival or access request |
| `POST` | `/api/v1/integrations/security/gate-pass-requests` | Security | Receive an authorized security-originated pass request; approval policy still applies |
| `POST` | `/api/v1/integrations/:source/events/ack` | Registered source | Optional explicit delivery acknowledgment if event callbacks use acknowledgment semantics |

Residence request payload example:

```json
{
  "sourceRequestId": "TKT-2026-819",
  "householdId": "HH-BLR-1204",
  "requesterId": "USR-002",
  "location": {
    "apartmentId": "<verified-external-id>",
    "apartmentName": "Bee Hive Residency",
    "towerId": "<verified-tower-id>",
    "towerName": "Tower A",
    "flatNumber": "1204",
    "floor": 12
  },
  "category": "Plumbing",
  "title": "Kitchen sink pipe dripping water",
  "description": "The drainage pipe beneath the kitchen sink has a slow leak at the U-joint.",
  "urgency": "High",
  "preferredDate": "2026-11-08",
  "preferredTimeSlot": "Morning (09:00 AM - 12:00 PM)",
  "attachments": []
}
```

RWA complaint payload example:

```json
{
  "sourceRequestId": "CMP-2026-092",
  "apartmentId": "apt-golden",
  "apartmentName": "Golden Apartment",
  "location": {
    "towerId": null,
    "towerName": null,
    "floor": "Pool Deck (Ground Level)",
    "placeName": "Swimming Pool",
    "asset": "Kids Splash Pool Skimmer",
    "description": "Swimming Pool • Pool Deck • Kids Splash Pool Skimmer"
  },
  "title": "Swimming Pool Deck Tiles Cracked & Slipping",
  "category": "Civil & Structural",
  "issueType": "Swimming Pool Deck Tiles Loose",
  "description": "Several border tiles along the kids splash zone have cracked and loosened.",
  "priority": "Urgent",
  "complaintScope": "Common Area",
  "requiresApproval": true,
  "submittedById": "<verified-rwa-user-id>",
  "submittedByRole": "Tenant",
  "attachments": []
}
```

The examples illustrate the API shape; placeholder IDs must be resolved to actual verified identifiers. Never accept a client-supplied `submittedByRole`, `apartmentName`, or property name as an authorization claim.

### 7.4 RWA approval endpoints

| Method | Endpoint | Purpose |
|---|---|---|
| `POST` | `/api/v1/rwa/service-requests/:id/approve` | RWA President/authorized RWA role records required complaint approval |
| `POST` | `/api/v1/rwa/service-requests/:id/reject` | RWA authorized role rejects a complaint with mandatory reason |

These routes are distinct from Agency review/dispatch. The approval authority is determined from verified RWA permissions and property scope, not from the caller's request body.

### 7.5 Agency endpoints

| Method | Endpoint | Purpose |
|---|---|---|
| `GET` | `/api/v1/agency/service-requests` | Search/filter request queue |
| `GET` | `/api/v1/agency/service-requests/:id` | Request detail, source, history and attachments |
| `POST` | `/api/v1/agency/service-requests/:id/approve` | Approve an Agency-owned review stage where authorized |
| `POST` | `/api/v1/agency/service-requests/:id/reject` | Reject with mandatory reason |
| `POST` | `/api/v1/agency/service-requests/:id/dispatch` | Create work order and assignment(s) |
| `POST` | `/api/v1/agency/service-requests/:id/hold` | Put request/work in hold with reason |
| `POST` | `/api/v1/agency/service-requests/:id/resume` | Resume held request |
| `POST` | `/api/v1/agency/service-requests/:id/resolve` | Mark as resolved after policy checks |
| `POST` | `/api/v1/agency/service-requests/:id/close` | Close after authorized verification |
| `POST` | `/api/v1/agency/service-requests/:id/cancel` | Cancel with reason and permission |
| `GET` | `/api/v1/agency/technicians` | Query technician directory/availability snapshot |
| `POST` | `/api/v1/work-orders/:id/assignments` | Add a technician assignment |
| `PATCH` | `/api/v1/work-orders/:id/assignments/:assignmentId` | Update/reassign an assignment with audit |

Dispatch payload example:

```json
{
  "targetDate": "2026-11-08T12:00:00.000Z",
  "instructions": "Inspect the kitchen sink U-joint and replace the damaged connection if required.",
  "assignments": [
    {
      "technicianId": "TECH-002",
      "role": "PLUMBER",
      "skill": "Plumbing & Civil",
      "targetDate": "2026-11-08T12:00:00.000Z"
    }
  ],
  "createTechnicianGatePass": true
}
```

### 7.6 Technician endpoints

| Method | Endpoint | Purpose |
|---|---|---|
| `GET` | `/api/v1/technician/jobs` | List jobs assigned to authenticated technician |
| `GET` | `/api/v1/technician/jobs/:jobId` | Read own assigned job |
| `POST` | `/api/v1/technician/jobs/:jobId/accept` | Accept assignment if acceptance is enabled |
| `POST` | `/api/v1/technician/jobs/:jobId/check-in` | Record arrival/start evidence |
| `POST` | `/api/v1/technician/jobs/:jobId/notes` | Add technician note |
| `POST` | `/api/v1/technician/jobs/:jobId/attachments` | Attach before/after evidence metadata |
| `POST` | `/api/v1/technician/jobs/:jobId/hold` | Hold own assigned work with mandatory reason |
| `POST` | `/api/v1/technician/jobs/:jobId/resume` | Resume own held work when permitted |
| `POST` | `/api/v1/technician/jobs/:jobId/complete` | Complete own assignment with required evidence |
| `GET` | `/api/v1/technician/jobs/:jobId/gate-pass` | Get safe gate-pass display/verification reference |

### 7.7 Gate-pass and Security endpoints

| Method | Endpoint | Purpose |
|---|---|---|
| `GET` | `/api/v1/gate-pass-requests` | List requests visible to the authenticated role/scope |
| `GET` | `/api/v1/gate-pass-requests/:id` | Read a gate-pass request |
| `POST` | `/api/v1/gate-pass-requests/:id/approve` | Approve according to configured authority |
| `POST` | `/api/v1/gate-pass-requests/:id/reject` | Reject with reason |
| `GET` | `/api/v1/gate-passes/:id` | Read an authorized pass |
| `POST` | `/api/v1/gate-passes/:id/revoke` | Revoke an issued pass with reason |
| `POST` | `/api/v1/security/gate-passes/verify` | Verify QR token or permitted OTP at the gate |
| `POST` | `/api/v1/security/gate-passes/:id/check-in` | Record visitor/technician entry |
| `POST` | `/api/v1/security/gate-passes/:id/check-out` | Record exit |
| `POST` | `/api/v1/residence/access-requests/:id/decision` | Resident approves/rejects a guard-originated visitor arrival request |
| `GET` | `/api/v1/security/access-requests/:id` | Security guard reads the current approval/denial decision for the arrival request |

### 7.8 Upload and health endpoints

| Method | Endpoint | Purpose |
|---|---|---|
| `POST` | `/api/v1/uploads/presign` | Request a short-lived private object-storage upload URL after authorization |
| `POST` | `/api/v1/uploads/complete` | Verify/finalize uploaded attachment metadata |
| `GET` | `/health/live` | Process liveness only |
| `GET` | `/health/ready` | Readiness including MongoDB connectivity and essential dependencies |
| `GET` | `/metrics` | Private metrics endpoint; never expose publicly without protection |

---

## 8. Event contracts

Events use a common envelope:

```json
{
  "eventId": "evt_01JEXAMPLE",
  "eventType": "service-request.assigned",
  "eventVersion": 1,
  "occurredAt": "2026-11-06T06:30:00.000Z",
  "producer": "bee-node-service-api",
  "correlationId": "9cce8a33-8e2f-4bdf-8d2f-fd8cbd6f0f27",
  "aggregate": {
    "type": "ServiceRequest",
    "id": "<node-service-request-id>"
  },
  "data": {
    "sourceApplication": "RWA",
    "sourceRequestId": "CMP-2026-092",
    "status": "ASSIGNED",
    "workOrderId": "<node-work-order-id>"
  }
}
```

Initial event types:

- `service-request.created`
- `service-request.approved`
- `service-request.rejected`
- `service-request.assigned`
- `service-request.status-changed`
- `service-request.resolved`
- `service-request.closed`
- `work-order.created`
- `work-order.assignment-created`
- `work-order.assignment-changed`
- `technician-job.status-changed`
- `gate-pass.requested`
- `gate-pass.approved`
- `gate-pass.rejected`
- `gate-pass.issued`
- `gate-pass.revoked`
- `gate-pass.expired`
- `gate-access.checked-in`
- `gate-access.checked-out`
- `gate-access.denied`

Webhooks must be signed (HMAC-SHA-256 over timestamp + raw body, or an equivalent approved signing scheme), include a timestamp and event ID, reject stale timestamps, and be idempotent. Prefer mTLS for high-trust internal service communication. A webhook receiver must not trust an event based only on its JSON `producer` field.

---

## 9. Non-functional and security requirements

### 9.1 Security baseline

- TLS for all external and service-to-service traffic; no public direct MongoDB access.
- Short-lived access tokens, audience restriction, fixed allowed JWT algorithms, issuer/audience/expiry/not-before/key-ID validation, key rotation, and refresh-token rotation/replay detection at the one token issuer.
- Machine clients use client credentials or signed service identities, not resident refresh tokens.
- Least-privilege scopes for each application client.
- RBAC + property/flat/assignment-level ABAC on every request.
- Validation using explicit schemas; reject unknown or unexpected fields on sensitive mutation endpoints.
- Rate limiting for authentication, refresh, pass verification, visitor requests, uploads, and general APIs.
- Security headers, exact CORS allowlist, safe cookie flags where cookies are used, strict body-size limits, and safe error handling.
- Passwords (if this service is the identity issuer) are stored using Argon2id; never store plaintext or reversible password values.
- Refresh tokens, QR tokens and OTPs are generated from a cryptographically secure random source; store only hashes for bearer-style secrets.
- Protect against NoSQL injection, mass assignment, BOLA/IDOR, brute force, replay, request smuggling at the edge, and SSRF through attachment/URL fields.
- Store secrets only in a secret manager/environment injection, not source code, JSON fixtures, logs, or repository `.env` files.
- Audit sensitive operations; redact tokens, OTPs, credentials, and unnecessary PII from logs.

### 9.2 Performance and reliability targets

Initial targets (validate and tune against real traffic):

- 95th percentile response time under 500 ms for normal MongoDB-backed reads/writes, excluding external integration latency and uploads.
- 99.9% monthly API availability objective after production rollout and monitoring are established.
- Outbox event delivery target: normally under 30 seconds; retry on temporary failure.
- No duplicate service request/work order/pass creation when the same idempotency key/source ID is retried.
- Use indexes for property scope, status, priority, source reference, assigned technician, and validity windows.
- All APIs must support bounded pagination and avoid unbounded collection scans.

### 9.3 Audit and retention

- Record actor/client, action, aggregate, old/new status, timestamp, reason, request ID, correlation ID, and relevant property scope.
- Audit entries are append-only at the application level. Corrections add a new event rather than rewriting the past.
- Define retention periods with the business/legal owner before production. The JSON files do not define retention periods; do not invent a legal retention policy.

---

## 10. Acceptance criteria

### Service request intake

- [ ] Residence can submit a service request and receives a canonical Node ID plus the original ticket ID.
- [ ] RWA can submit a complaint and receives a canonical Node ID plus the original complaint ID.
- [ ] A retry with the same idempotency key/source ID returns the original record and does not create a duplicate.
- [ ] A duplicate source ID with a materially conflicting payload is rejected and audited.
- [ ] Invalid property, household, resident or RWA scope is rejected.
- [ ] Unknown category/status values do not silently enter dispatch.

### Approval, dispatch and technician

- [ ] An RWA request marked `requiresApproval=true` cannot be dispatched before approval.
- [ ] Agency users without dispatch permission cannot assign technicians.
- [ ] Multi-technician assignments create separate assignment/task views, all linked to the parent work order and service request.
- [ ] A technician cannot read or update another technician's job by guessing its ID.
- [ ] A technician can add evidence, hold with reason, resume, and complete their own assignment.
- [ ] The service request is not resolved until the configured completion rule is satisfied.
- [ ] Every consequential state change creates an audit record and outbox event.

### Gate pass and Security

- [ ] Residence can request a guest/contractor pass for its verified household.
- [ ] Security can create an arrival/access request for a visitor.
- [ ] Guard-originated requests cannot self-approve.
- [ ] A resident/authorized approver can approve or reject a visitor request.
- [ ] Security can verify a valid pass and record entry/exit.
- [ ] Expired, revoked, reused, wrong-property and wrong-technician passes are denied.
- [ ] QR/OTP secrets are not stored or returned in plaintext after issuance.
- [ ] All gate decisions and scans are auditable.

### Authentication and platform security

- [ ] One canonical token issuer is configured and documented across .NET and Node.
- [ ] Node rejects invalid signature, issuer, audience, expiry, not-before, algorithm, and revoked/disabled subject/session where applicable.
- [ ] Refresh-token replay revokes the token family/session and requires re-authentication.
- [ ] Machine clients cannot call endpoints outside their scopes.
- [ ] CORS only allows explicitly approved origins.
- [ ] Rate limits protect login/refresh and gate-pass verification.
- [ ] Logs contain request/correlation IDs but no bearer tokens, refresh tokens, passwords, QR secrets, or OTPs.

---

## 11. Delivery phases

1. **Foundation:** Node/Express setup, configuration, MongoDB connection, error model, validation, logging, OpenAPI, health checks, auth adapter and permission middleware.
2. **Service intake:** Residence/RWA integration endpoints, source mapping, idempotency, request model, timeline and outbox.
3. **Agency dispatch:** Agency queue, approval policy, work orders, multi-technician assignments and technician notifications.
4. **Technician execution:** technician-scoped jobs, progress, holds, notes, attachment metadata, completion and synchronization.
5. **Gate passes:** Residence pass request, Security arrival/approval workflow, technician pass linkage, verification, entry/exit and expiry/revocation.
6. **Hardening:** automated security tests, integration contract tests, load tests, key rotation, backup/restore, monitoring and production deployment.

---

## 12. Decisions and assumptions for implementation

1. **Single identity issuer:** determine whether .NET already issues tokens. Use that issuer if it exists; otherwise Node can be the one shared issuer only if .NET and all clients are configured to trust it. Do not create two independent issuers.
2. **Property master:** the JSON files contain app-specific property references but no shared global property ID mapping or complete cross-application master-data API. Resolve/map IDs through the authoritative .NET/property service or a formally designated master-data endpoint. Unmapped requests must be quarantined/rejected from dispatch until verified; do not match by names or flat labels.
3. **RWA approvals:** `requiresApproval` controls explicit approval where present. Missing approval fields require a configured per-property policy; they do not imply approval.
4. **Gate-pass policy:** approval requirements, single-entry/re-entry rules, allowed pass types, validity windows and gate restrictions must be configuration-driven per property.
5. **Integration transport:** start with signed REST webhooks plus outbox/retries if there is no existing message broker. If Azure Service Bus or another broker is already available, use it through an adapter without changing domain contracts.
6. **File storage:** store file metadata and storage keys in MongoDB; use private object storage and signed upload/download URLs for media. Do not store raw uploaded binaries or arbitrary public URLs in request documents.
7. **Production data:** JSON records are sample/initial application data, not authorization policy or production credentials. Reconcile property counts and IDs before importing any seed data.

---

## 13. External security references

Use these primary references during implementation and security review:

- IETF RFC 9700, OAuth 2.0 Security Best Current Practice: https://www.rfc-editor.org/rfc/rfc9700.html
- OWASP API Security Top 10 (2023): https://owasp.org/API-Security/editions/2023/en/0x11-t10/
- Express production security best practices: https://expressjs.com/en/advanced/best-practice-security/
- Node.js security best practices: https://nodejs.org/en/learn/getting-started/security-best-practices
- OWASP Password Storage Cheat Sheet: https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html
- MongoDB security checklist: https://www.mongodb.com/docs/manual/administration/security-checklist/
- Node.js release schedule: https://github.com/nodejs/Release
