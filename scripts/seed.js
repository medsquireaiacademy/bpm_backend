const mongoose = require('mongoose');
const { connectDatabase } = require('../src/config/database');
const User = require('../src/models/User.model');
const ServiceRequest = require('../src/models/ServiceRequest.model');
const WorkOrder = require('../src/models/WorkOrder.model');
const WorkOrderAssignment = require('../src/models/WorkOrderAssignment.model');
const GatePass = require('../src/models/GatePass.model');
const GatePassRequest = require('../src/models/GatePassRequest.model');
const { ROLES, SERVICE_REQUEST_STATUS, WORK_ORDER_STATUS, ASSIGNMENT_STATUS, GATE_PASS_STATUS } = require('../src/config/constants');
const { hashPassword, sha256 } = require('../src/utils/crypto');

const seedData = async () => {
  await connectDatabase();
  console.log('[Seed] Cleaning existing data...');

  await Promise.all([
    User.deleteMany({}),
    ServiceRequest.deleteMany({}),
    WorkOrder.deleteMany({}),
    WorkOrderAssignment.deleteMany({}),
    GatePass.deleteMany({}),
    GatePassRequest.deleteMany({})
  ]);

  console.log('[Seed] Seeding sample users...');
  const commonPassword = await hashPassword('password123');
  const adminPassword = await hashPassword('admin123');

  const users = await User.create([
    {
      userId: 'USR-001',
      name: 'Rajesh Kumar',
      email: 'resident@beeproperty.com',
      passwordHash: commonPassword,
      phone: '+91 98765 43210',
      role: ROLES.RESIDENT,
      propertyId: 'PROP-01',
      householdId: 'HH-BLR-1204',
      apartmentName: 'Bee Hive Residency',
      flatNumber: '1204'
    },
    {
      userId: 'RWA-001',
      name: 'Priya Sharma (RWA President)',
      email: 'rwa@beeproperty.com',
      passwordHash: commonPassword,
      phone: '+91 98765 11111',
      role: ROLES.RWA_PRESIDENT,
      propertyId: 'PROP-01',
      apartmentName: 'Golden Apartment'
    },
    {
      userId: 'AGY-ADMIN-01',
      name: 'John Doe (Agency Admin)',
      email: 'admin@beeproperty.com',
      passwordHash: adminPassword,
      phone: '+91 98765 22222',
      role: ROLES.AGENCY_ADMIN,
      propertyId: 'PROP-01'
    },
    {
      userId: 'TECH-002',
      name: 'Vikram Sharma',
      email: 'tech@beeproperty.com',
      passwordHash: commonPassword,
      phone: '+91 98765 33333',
      role: ROLES.TECHNICIAN,
      propertyId: 'PROP-01',
      skills: ['Plumbing', 'Civil Maintenance', 'Water Supply']
    },
    {
      userId: 'GUARD-001',
      name: 'Ramesh Guard',
      email: 'guard@beeproperty.com',
      passwordHash: commonPassword,
      phone: '+91 98765 44444',
      role: ROLES.SECURITY_GUARD,
      propertyId: 'PROP-01'
    }
  ]);

  console.log(`[Seed] Seeded ${users.length} users successfully.`);

  console.log('[Seed] Seeding initial service request...');
  const sr = await ServiceRequest.create({
    publicId: 'SR-2026-00001',
    source: {
      application: 'RESIDENCE',
      sourceRequestId: 'TKT-2026-819',
      sourceStatus: 'Pending',
      sourceCreatedAt: new Date()
    },
    property: {
      propertyId: 'PROP-01',
      householdId: 'HH-BLR-1204',
      apartmentName: 'Bee Hive Residency',
      tower: 'Tower A',
      floor: '12',
      flatNumber: '1204',
      complaintScope: 'INDIVIDUAL_UNIT'
    },
    requester: {
      userId: 'USR-001',
      name: 'Rajesh Kumar',
      phone: '+91 98765 43210',
      role: 'RESIDENT'
    },
    classification: {
      category: 'Plumbing',
      serviceType: 'Pipe Repair'
    },
    title: 'Kitchen sink pipe dripping water',
    description: 'The drainage pipe beneath the kitchen sink has a slow leak at the U-joint.',
    priority: 'HIGH',
    status: SERVICE_REQUEST_STATUS.ASSIGNED,
    history: [
      {
        action: 'CREATED_FROM_RESIDENCE',
        toStatus: SERVICE_REQUEST_STATUS.PENDING,
        performedBy: 'USR-001',
        timestamp: new Date()
      }
    ]
  });

  console.log('[Seed] Seeding work order and technician assignment...');
  const wo = await WorkOrder.create({
    publicId: 'WO-2026-00001',
    serviceRequestId: sr._id,
    caseOrderId: 'CASE-1001',
    title: 'Fix Kitchen Sink U-joint Leak',
    instructions: 'Inspect kitchen sink drain line and replace worn gasket if damaged.',
    agencyId: 'AGENCY-01',
    propertyId: 'PROP-01',
    status: WORK_ORDER_STATUS.ASSIGNED,
    priority: 'HIGH',
    createdBy: 'AGY-ADMIN-01'
  });

  const assignment = await WorkOrderAssignment.create({
    publicId: 'ASG-2026-00001',
    serviceOrderId: 'SO-0001',
    workOrderId: wo._id,
    serviceRequestId: sr._id,
    technicianId: 'TECH-002',
    technicianName: 'Vikram Sharma',
    role: 'PLUMBER',
    skillSnapshot: 'Plumbing & Drainage',
    instructions: 'Bring standard 1.5 inch sink pipe seals.',
    status: ASSIGNMENT_STATUS.ASSIGNED
  });

  wo.assignmentIds.push(assignment._id);
  await wo.save();

  sr.workOrderIds.push(wo._id);
  await sr.save();

  console.log('[Seed] Seeding sample Gate Pass...');
  const rawQrToken = 'TEST_QR_TOKEN_123456';
  const rawOtp = '4892';

  await GatePass.create({
    publicId: 'GP-2026-00001',
    passType: 'TECHNICIAN',
    sourceApplication: 'AGENCY',
    propertyId: 'PROP-01',
    householdId: 'HH-BLR-1204',
    apartmentName: 'Bee Hive Residency',
    flatNumber: '1204',
    linkedWorkOrderId: wo._id,
    linkedAssignmentId: assignment._id,
    visitor: {
      name: 'Vikram Sharma',
      phoneSnapshot: '+91 98765 33333',
      purpose: 'Plumbing Repair'
    },
    technician: {
      technicianId: 'TECH-002',
      nameSnapshot: 'Vikram Sharma'
    },
    validFrom: new Date(),
    validUntil: new Date(Date.now() + 24 * 60 * 60 * 1000),
    status: GATE_PASS_STATUS.ACTIVE,
    tokenHash: sha256(rawQrToken),
    otpHash: sha256(rawOtp),
    usagePolicy: 'SINGLE_ENTRY',
    maxEntries: 1,
    issuedBy: 'AGY-ADMIN-01'
  });

  console.log('------------------------------------------------------------');
  console.log('✅ Seed completed successfully!');
  console.log('Sample Accounts:');
  console.log('  Admin:       admin@beeproperty.com     / admin123');
  console.log('  RWA:         rwa@beeproperty.com       / password123');
  console.log('  Resident:    resident@beeproperty.com  / password123');
  console.log('  Technician:  tech@beeproperty.com      / password123');
  console.log('  Security:    guard@beeproperty.com     / password123');
  console.log('Sample Gate Pass OTP: 4892 (Token: TEST_QR_TOKEN_123456)');
  console.log('------------------------------------------------------------');

  await mongoose.connection.close();
  process.exit(0);
};

seedData().catch((err) => {
  console.error('[Seed] Error during seeding:', err);
  process.exit(1);
});

