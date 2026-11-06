const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');
const mongoose = require('mongoose');

const app = require('../src/app');
const { connectDatabase } = require('../src/config/database');

let server;
let baseUrl;
let adminToken;
let residentToken;
let techToken;
let guardToken;

test.before(async () => {
  await connectDatabase();
  server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;
  baseUrl = `http://127.0.0.1:${port}`;
});

test.after(async () => {
  await new Promise((resolve) => server.close(resolve));
  await mongoose.connection.close();
});

// Helper for making JSON HTTP requests
const request = async (method, path, body = null, headers = {}) => {
  const url = `${baseUrl}${path}`;
  const options = {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...headers
    }
  };
  if (body) {
    options.body = JSON.stringify(body);
  }
  const res = await fetch(url, options);
  const json = await res.json().catch(() => null);
  return { status: res.status, body: json };
};

test('GET /health/ready returns 200 and database connected', async () => {
  const { status, body } = await request('GET', '/health/ready');
  assert.equal(status, 200);
  assert.equal(body.status, 'READY');
  assert.equal(body.database, 'CONNECTED');
});

test('POST /api/v1/auth/login logs in users and generates JWT', async () => {
  // Admin login
  const adminRes = await request('POST', '/api/v1/auth/login', {
    email: 'admin@beeproperty.com',
    password: 'admin123'
  });
  assert.equal(adminRes.status, 200);
  assert.ok(adminRes.body.data.accessToken);
  adminToken = adminRes.body.data.accessToken;

  // Resident login
  const residentRes = await request('POST', '/api/v1/auth/login', {
    email: 'resident@beeproperty.com',
    password: 'password123'
  });
  assert.equal(residentRes.status, 200);
  residentToken = residentRes.body.data.accessToken;

  // Tech login
  const techRes = await request('POST', '/api/v1/auth/login', {
    email: 'tech@beeproperty.com',
    password: 'password123'
  });
  assert.equal(techRes.status, 200);
  techToken = techRes.body.data.accessToken;

  // Guard login
  const guardRes = await request('POST', '/api/v1/auth/login', {
    email: 'guard@beeproperty.com',
    password: 'password123'
  });
  assert.equal(guardRes.status, 200);
  guardToken = guardRes.body.data.accessToken;
});

test('POST /api/v1/integrations/residence/service-requests creates request with idempotency', async () => {
  const idempotencyKey = `idemp_${Date.now()}`;
  const payload = {
    sourceRequestId: `TKT-TEST-${Date.now()}`,
    householdId: 'HH-BLR-1204',
    requesterId: 'USR-001',
    category: 'Plumbing',
    title: 'Bathroom tap dripping',
    description: 'Slow continuous drip in the master bathroom tap',
    urgency: 'Normal'
  };

  const headers = {
    'X-Client-Id': 'residence-api-client',
    'X-Client-Secret': 'residence_secret_2026',
    'Idempotency-Key': idempotencyKey
  };

  const res1 = await request('POST', '/api/v1/integrations/residence/service-requests', payload, headers);
  assert.equal(res1.status, 201);
  assert.equal(res1.body.success, true);
  assert.ok(res1.body.data.serviceRequestId);

  // Repeat request with exact same idempotency key
  const res2 = await request('POST', '/api/v1/integrations/residence/service-requests', payload, headers);
  assert.equal(res2.status, 201);
  assert.equal(res2.body.data.serviceRequestId, res1.body.data.serviceRequestId);
});

test('POST /api/v1/integrations/rwa/complaints and RWA approval workflow', async () => {
  const sourceRequestId = `CMP-TEST-${Date.now()}`;
  const payload = {
    sourceRequestId,
    category: 'Electricity and Lighting',
    title: 'Corridor Light Flickering',
    description: '3rd floor corridor light is flickering and causing visibility issues',
    priority: 'Urgent',
    complaintScope: 'Common Area',
    requiresApproval: true
  };

  const headers = {
    'X-Client-Id': 'rwa-api-client',
    'X-Client-Secret': 'rwa_secret_2026'
  };

  const createRes = await request('POST', '/api/v1/integrations/rwa/complaints', payload, headers);
  assert.equal(createRes.status, 201);
  assert.equal(createRes.body.data.status, 'PENDING_APPROVAL');

  const srId = createRes.body.data.serviceRequestId;

  // Approve via Admin/RWA
  const approveRes = await request(
    'POST',
    `/api/v1/service-requests/${srId}/approve`,
    { reason: 'Approved for electrical maintenance dispatch' },
    { Authorization: `Bearer ${adminToken}` }
  );
  assert.equal(approveRes.status, 200);
  assert.equal(approveRes.body.data.status, 'APPROVED');
});

test('POST /api/v1/agency/service-requests/:id/dispatch and Technician workflow', async () => {
  // Read service requests queue
  const queueRes = await request('GET', '/api/v1/agency/service-requests', null, {
    Authorization: `Bearer ${adminToken}`
  });
  assert.equal(queueRes.status, 200);
  assert.ok(queueRes.body.data.length > 0);

  const targetSr = queueRes.body.data.find(sr => sr.status === 'APPROVED' || sr.status === 'PENDING') || queueRes.body.data[0];

  // Dispatch work order
  const dispatchRes = await request(
    'POST',
    `/api/v1/agency/service-requests/${targetSr.publicId}/dispatch`,
    {
      instructions: 'Please inspect the circuit breaker and replace tube light',
      createTechnicianGatePass: true,
      assignments: [
        {
          technicianId: 'TECH-002',
          technicianName: 'Vikram Sharma',
          role: 'ELECTRICIAN',
          instructions: 'Check fuse box'
        }
      ]
    },
    { Authorization: `Bearer ${adminToken}` }
  );

  assert.equal(dispatchRes.status, 201);
  assert.ok(dispatchRes.body.data.workOrder.publicId);
  const assignment = dispatchRes.body.data.assignments[0];
  assert.ok(assignment.publicId);

  // Technician reads own jobs
  const techJobsRes = await request('GET', '/api/v1/technician/jobs', null, {
    Authorization: `Bearer ${techToken}`
  });
  assert.equal(techJobsRes.status, 200);

  // Technician checks in
  const checkInRes = await request(
    'POST',
    `/api/v1/technician/jobs/${assignment.publicId}/check-in`,
    { latitude: 12.9716, longitude: 77.5946 },
    { Authorization: `Bearer ${techToken}` }
  );
  assert.equal(checkInRes.status, 200);
  assert.equal(checkInRes.body.data.status, 'IN_PROGRESS');

  // Technician adds note
  const noteRes = await request(
    'POST',
    `/api/v1/technician/jobs/${assignment.publicId}/notes`,
    { text: 'Inspected switch panel, replacing 16A breaker' },
    { Authorization: `Bearer ${techToken}` }
  );
  assert.equal(noteRes.status, 201);

  // Technician completes job
  const completeRes = await request(
    'POST',
    `/api/v1/technician/jobs/${assignment.publicId}/complete`,
    { completionNote: 'Replaced breaker and verified voltage stability' },
    { Authorization: `Bearer ${techToken}` }
  );
  assert.equal(completeRes.status, 200);
  assert.equal(completeRes.body.data.status, 'COMPLETED');
});

test('Gate Pass creation, verification by Guard, and check-in', async () => {
  // Resident creates a pre-approved guest pass
  const passReqRes = await request(
    'POST',
    '/api/v1/gate-passes/requests',
    {
      requestType: 'RESIDENT_GUEST',
      propertyId: 'PROP-01',
      validUntil: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
      visitor: {
        name: 'Guest Alice',
        phone: '+91 99999 88888',
        purpose: 'Social Visit'
      }
    },
    { Authorization: `Bearer ${residentToken}` }
  );

  assert.equal(passReqRes.status, 201);
  assert.ok(passReqRes.body.data.issuedPass.token);
  const rawToken = passReqRes.body.data.issuedPass.token;
  const rawOtp = passReqRes.body.data.issuedPass.otp;
  const passPublicId = passReqRes.body.data.issuedPass.publicId;

  // Guard verifies QR token
  const verifyTokenRes = await request(
    'POST',
    '/api/v1/security/gate-passes/verify',
    { token: rawToken },
    { Authorization: `Bearer ${guardToken}` }
  );

  assert.equal(verifyTokenRes.status, 200);
  assert.equal(verifyTokenRes.body.data.allowed, true);
  assert.equal(verifyTokenRes.body.data.code, 'ALLOW');
  assert.equal(verifyTokenRes.body.data.pass.publicId, passPublicId);

  // Guard records check-in
  const checkInRes = await request(
    'POST',
    `/api/v1/security/gate-passes/${passPublicId}/check-in`,
    { gateId: 'North Gate', remarks: 'Visitor ID checked' },
    { Authorization: `Bearer ${guardToken}` }
  );
  assert.equal(checkInRes.status, 200);
  assert.equal(checkInRes.body.data.pass.entryCount, 1);
  assert.equal(checkInRes.body.data.pass.status, 'USED');

  // Verify that subsequent entry is denied (Single Entry Policy)
  const verifyAgainRes = await request(
    'POST',
    '/api/v1/security/gate-passes/verify',
    { token: rawToken },
    { Authorization: `Bearer ${guardToken}` }
  );
  assert.equal(verifyAgainRes.body.data.allowed, false);
  assert.equal(verifyAgainRes.body.data.code, 'PASS_ALREADY_USED');
});
