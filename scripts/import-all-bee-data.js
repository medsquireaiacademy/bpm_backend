const path = require('path');
const mongoose = require('mongoose');
const { connectDatabase } = require('../src/config/database');
const User = require('../src/models/User.model');
const ServiceRequest = require('../src/models/ServiceRequest.model');
const WorkOrder = require('../src/models/WorkOrder.model');
const WorkOrderAssignment = require('../src/models/WorkOrderAssignment.model');
const GatePass = require('../src/models/GatePass.model');
const GatePassRequest = require('../src/models/GatePassRequest.model');
const GateAccessEvent = require('../src/models/GateAccessEvent.model');
const { ROLES, SERVICE_REQUEST_STATUS, WORK_ORDER_STATUS, ASSIGNMENT_STATUS, GATE_PASS_STATUS, GATE_ACCESS_EVENT } = require('../src/config/constants');
const { hashPassword, sha256 } = require('../src/utils/crypto');

const importAllData = async () => {
  await connectDatabase();
  console.log('[Importer] Starting comprehensive BEE data import...');

  // Load JSON fixtures
  const basePath = 'E:/Bee_applications';
  const residenceData = require(path.join(basePath, 'residence_json.json'));
  const rwaData = require(path.join(basePath, 'Rwa_json.json'));
  const agencyData = require(path.join(basePath, 'agencies_json.json'));
  const technicianData = require(path.join(basePath, 'Technician_Json.json'));
  const securityData = require(path.join(basePath, 'Security_json.json'));

  console.log('[Importer] Cleaning collections for fresh, clean import...');
  await Promise.all([
    User.deleteMany({}),
    ServiceRequest.deleteMany({}),
    WorkOrder.deleteMany({}),
    WorkOrderAssignment.deleteMany({}),
    GatePass.deleteMany({}),
    GatePassRequest.deleteMany({}),
    GateAccessEvent.deleteMany({})
  ]);

  const defaultPassword = await hashPassword('password123');
  const adminPassword = await hashPassword('admin123');

  // ==========================================
  // 1. IMPORT USERS
  // ==========================================
  console.log('[Importer] Importing users across all roles...');
  const usersToInsert = [];
  const userEmails = new Set();

  // Core administrative accounts
  usersToInsert.push({
    userId: 'AGY-ADMIN-01',
    name: 'John Doe (Agency Admin)',
    email: 'admin@beeproperty.com',
    passwordHash: adminPassword,
    phone: '+91 98765 43210',
    role: ROLES.AGENCY_ADMIN,
    propertyId: 'PROP-01'
  });
  userEmails.add('admin@beeproperty.com');

  usersToInsert.push({
    userId: 'RWA-PRES-01',
    name: 'Priya Sharma (RWA President)',
    email: 'rwa@beeproperty.com',
    passwordHash: defaultPassword,
    phone: '+91 98765 11111',
    role: ROLES.RWA_PRESIDENT,
    propertyId: 'PROP-RWA-01',
    apartmentName: 'Golden Apartment'
  });
  userEmails.add('rwa@beeproperty.com');

  usersToInsert.push({
    userId: 'GUARD-001',
    name: 'Ramesh Singh (Main Gate)',
    email: 'guard@beeproperty.com',
    passwordHash: defaultPassword,
    phone: '+91 98765 22222',
    role: ROLES.SECURITY_GUARD,
    propertyId: 'PROP-01'
  });
  userEmails.add('guard@beeproperty.com');

  usersToInsert.push({
    userId: 'USR-RES-01',
    name: 'Rajesh Kumar',
    email: 'resident@beeproperty.com',
    passwordHash: defaultPassword,
    phone: '+91 98765 33333',
    role: ROLES.RESIDENT,
    propertyId: 'PROP-01',
    householdId: 'HH-BLR-1204',
    apartmentName: 'Bee Hive Residency',
    flatNumber: '1204'
  });
  userEmails.add('resident@beeproperty.com');

  usersToInsert.push({
    userId: 'TECH-002',
    name: 'Vikram Sharma',
    email: 'tech@beeproperty.com',
    passwordHash: defaultPassword,
    phone: '+91 98765 33333',
    role: ROLES.TECHNICIAN,
    propertyId: 'PROP-01',
    skills: ['Plumbing & Civil', 'Water Supply', 'General Maintenance']
  });
  userEmails.add('tech@beeproperty.com');
  userEmails.add('TECH-002');

  // Technicians from agencies_json
  const techList = agencyData.techniciansAndSpecialists?.data?.technicians || [];
  for (const t of techList) {
    const email = t.email?.toLowerCase() || `${t.id.toLowerCase()}@agency.bee.com`;
    if (!userEmails.has(email) && !userEmails.has(t.id)) {
      usersToInsert.push({
        userId: t.id,
        name: t.name,
        email,
        passwordHash: defaultPassword,
        phone: t.mobile,
        role: ROLES.TECHNICIAN,
        propertyId: 'PROP-01',
        skills: t.skills || [t.skill]
      });
      userEmails.add(email);
      userEmails.add(t.id);
    }
  }

  // Resident family members from residence_json
  const residentUsers = residenceData.topics?.users?.data || [];
  for (const ru of residentUsers) {
    const email = ru.email?.toLowerCase();
    if (email && !userEmails.has(email)) {
      usersToInsert.push({
        userId: ru.id,
        name: ru.name,
        email,
        passwordHash: defaultPassword,
        phone: ru.phone,
        role: ROLES.RESIDENT,
        propertyId: 'PROP-RES-01',
        householdId: 'HH-BLR-1204',
        apartmentName: 'Bee Hive Residency',
        flatNumber: '1204'
      });
      userEmails.add(email);
    }
  }

  await User.insertMany(usersToInsert);
  console.log(`[Importer] Inserted ${usersToInsert.length} users.`);

  // ==========================================
  // 2. IMPORT SERVICE REQUESTS & COMPLAINTS
  // ==========================================
  console.log('[Importer] Importing Service Requests from Residence...');
  const resRequests = residenceData.topics?.serviceRequests?.data || [];
  let srCounter = 1;

  for (const req of resRequests) {
    const publicId = `SR-2026-${String(srCounter++).padStart(5, '0')}`;
    let status = SERVICE_REQUEST_STATUS.PENDING;
    if (req.status === 'Scheduled' || req.status === 'Assigned') status = SERVICE_REQUEST_STATUS.ASSIGNED;
    if (req.status === 'In Progress') status = SERVICE_REQUEST_STATUS.IN_PROGRESS;
    if (req.status === 'Completed' || req.status === 'Resolved') status = SERVICE_REQUEST_STATUS.RESOLVED;

    await ServiceRequest.create({
      publicId,
      source: {
        application: 'RESIDENCE',
        sourceRequestId: req.id,
        sourceStatus: req.status,
        sourceCreatedAt: new Date()
      },
      property: {
        propertyId: 'PROP-RES-01',
        householdId: 'HH-BLR-1204',
        apartmentName: 'Bee Hive Residency',
        tower: 'Tower A',
        floor: '12',
        flatNumber: '1204',
        complaintScope: 'INDIVIDUAL_UNIT'
      },
      requester: {
        userId: 'USR-001',
        name: req.createdBy || 'Rajesh Kumar',
        role: 'RESIDENT'
      },
      classification: {
        category: req.category || 'General',
        serviceType: req.title
      },
      title: req.title,
      description: req.description,
      priority: req.urgency?.toUpperCase() === 'HIGH' ? 'HIGH' : 'NORMAL',
      status,
      preferredSchedule: {
        date: req.preferredDate,
        timeSlot: req.preferredTimeSlot
      },
      history: (req.history || []).map((h) => ({
        action: h.status || 'STATUS_UPDATE',
        toStatus: h.status,
        performedBy: h.note || 'User',
        timestamp: new Date()
      }))
    });
  }

  console.log('[Importer] Importing Complaints from RWA...');
  const rwaComplaints = rwaData.topics?.[5]?.data || [];
  for (const cmp of rwaComplaints) {
    const publicId = `SR-2026-${String(srCounter++).padStart(5, '0')}`;
    let status = SERVICE_REQUEST_STATUS.PENDING;
    if (cmp.requiresApproval) status = SERVICE_REQUEST_STATUS.PENDING_APPROVAL;
    if (cmp.status === 'In Progress') status = SERVICE_REQUEST_STATUS.IN_PROGRESS;
    if (cmp.status === 'Resolved') status = SERVICE_REQUEST_STATUS.RESOLVED;
    if (cmp.status === 'Closed') status = SERVICE_REQUEST_STATUS.CLOSED;

    await ServiceRequest.create({
      publicId,
      source: {
        application: 'RWA',
        sourceRequestId: cmp.id,
        sourceStatus: cmp.status,
        sourceCreatedAt: new Date(cmp.createdAt || Date.now())
      },
      property: {
        propertyId: 'PROP-RWA-01',
        apartmentName: cmp.apartment || 'Golden Apartment',
        floor: cmp.floor,
        placeName: cmp.placeName,
        asset: cmp.asset,
        complaintScope: cmp.complaintScope || 'Common Area'
      },
      requester: {
        userId: 'RWA-SUBMITTER',
        name: cmp.submittedBy,
        role: cmp.submittedByRole || 'Resident'
      },
      classification: {
        category: cmp.category,
        issueType: cmp.issueType
      },
      title: cmp.title,
      description: cmp.description,
      priority: cmp.priority?.toUpperCase() === 'URGENT' ? 'URGENT' : 'NORMAL',
      status,
      approval: {
        required: cmp.requiresApproval || false,
        status: cmp.requiresApproval ? 'PENDING' : 'NOT_REQUIRED'
      },
      history: (cmp.history || []).map((h) => ({
        action: 'RWA_NOTE',
        performedBy: h.author || 'RWA Staff',
        reason: h.text,
        timestamp: new Date()
      }))
    });
  }

  console.log('[Importer] Importing Agency Requests & Work Orders...');
  const agencyRequests = agencyData.serviceManagement?.data?.requests || [];
  let woCounter = 1;
  let asgCounter = 1;

  for (const ar of agencyRequests) {
    const srPublicId = `SR-2026-${String(srCounter++).padStart(5, '0')}`;
    const woPublicId = `WO-2026-${String(woCounter++).padStart(5, '0')}`;

    const sr = await ServiceRequest.create({
      publicId: srPublicId,
      source: {
        application: 'AGENCY',
        sourceRequestId: ar.id,
        sourceStatus: ar.status,
        sourceCreatedAt: new Date()
      },
      property: {
        propertyId: 'PROP-AGY-01',
        apartmentName: ar.apartment,
        tower: ar.tower,
        flatNumber: ar.flatNo,
        complaintScope: 'INDIVIDUAL_UNIT'
      },
      requester: {
        userId: 'AGY-RESIDENT',
        name: ar.resident,
        role: 'RESIDENT'
      },
      classification: {
        category: ar.category,
        serviceType: ar.service
      },
      title: ar.caseTitle,
      description: ar.description,
      priority: ar.priority?.toUpperCase() === 'URGENT' ? 'URGENT' : 'NORMAL',
      status: ar.status === 'In Progress' ? SERVICE_REQUEST_STATUS.IN_PROGRESS : SERVICE_REQUEST_STATUS.ASSIGNED
    });

    const workOrder = await WorkOrder.create({
      publicId: woPublicId,
      serviceRequestId: sr._id,
      caseOrderId: ar.caseOrderId,
      title: ar.workOrderTitle || ar.caseTitle,
      instructions: ar.description,
      propertyId: 'PROP-AGY-01',
      status: WORK_ORDER_STATUS.IN_PROGRESS,
      priority: sr.priority,
      createdBy: 'AGY-ADMIN-01'
    });

    const assignmentIds = [];
    for (const techAsg of (ar.assignedTechnicians || [])) {
      const asgPublicId = `ASG-2026-${String(asgCounter++).padStart(5, '0')}`;
      const assignment = await WorkOrderAssignment.create({
        publicId: asgPublicId,
        serviceOrderId: techAsg.soId,
        workOrderId: workOrder._id,
        serviceRequestId: sr._id,
        technicianId: techAsg.technicianId,
        technicianName: techAsg.name,
        role: techAsg.role,
        skillSnapshot: techAsg.skill,
        instructions: techAsg.instructions,
        status: ASSIGNMENT_STATUS.IN_PROGRESS
      });
      assignmentIds.push(assignment._id);
    }

    workOrder.assignmentIds = assignmentIds;
    await workOrder.save();

    sr.workOrderIds.push(workOrder._id);
    await sr.save();
  }

  // ==========================================
  // 3. IMPORT TECHNICIAN JOBS
  // ==========================================
  console.log('[Importer] Importing Technician jobs from Technician_Json...');
  const techJobs = technicianData.topics?.workOrders?.entries || [];

  for (const job of techJobs) {
    const srPublicId = `SR-2026-${String(srCounter++).padStart(5, '0')}`;
    const woPublicId = `WO-2026-${String(woCounter++).padStart(5, '0')}`;
    const asgPublicId = `ASG-2026-${String(asgCounter++).padStart(5, '0')}`;

    const sr = await ServiceRequest.create({
      publicId: srPublicId,
      source: {
        application: 'TECHNICIAN',
        sourceRequestId: job.complaintId,
        sourceStatus: job.status,
        sourceCreatedAt: new Date(job.reportedAt || Date.now())
      },
      property: {
        propertyId: job.property?.id || 'PROP-101',
        apartmentName: job.property?.name,
        tower: job.property?.tower,
        placeName: job.property?.exactLocation
      },
      requester: {
        userId: 'TECH-RESIDENT',
        name: job.resident?.name,
        phone: job.resident?.contactNumber,
        role: 'RESIDENT'
      },
      classification: {
        category: job.serviceCategory,
        serviceType: job.complaintTitle
      },
      title: job.complaintTitle,
      description: job.originalDescription,
      priority: job.priority || 'HIGH',
      status: job.status === 'ASSIGNED' ? SERVICE_REQUEST_STATUS.ASSIGNED : SERVICE_REQUEST_STATUS.IN_PROGRESS
    });

    const wo = await WorkOrder.create({
      publicId: woPublicId,
      serviceRequestId: sr._id,
      caseOrderId: job.complaintId,
      title: job.complaintTitle,
      instructions: job.originalDescription,
      propertyId: job.property?.id || 'PROP-101',
      status: WORK_ORDER_STATUS.ASSIGNED,
      priority: sr.priority,
      createdBy: 'SYSTEM'
    });

    const asg = await WorkOrderAssignment.create({
      publicId: asgPublicId,
      serviceOrderId: job.id,
      workOrderId: wo._id,
      serviceRequestId: sr._id,
      technicianId: 'TECH-002',
      technicianName: 'Vikram Sharma',
      role: job.role,
      status: ASSIGNMENT_STATUS.ASSIGNED,
      beforePhotos: (job.beforePhotos || []).map((bp) => ({
        attachmentId: bp.id,
        url: bp.fileUrl,
        caption: bp.caption
      }))
    });

    wo.assignmentIds.push(asg._id);
    await wo.save();

    sr.workOrderIds.push(wo._id);
    await sr.save();

    // Link Gate Pass with job's entry OTP
    if (job.gateEntryOtp) {
      const passPublicId = `GP-2026-${String(asgCounter).padStart(5, '0')}`;
      const rawToken = `TOKEN_${job.id}`;
      await GatePass.create({
        publicId: passPublicId,
        passType: 'TECHNICIAN',
        sourceApplication: 'TECHNICIAN',
        propertyId: job.property?.id || 'PROP-101',
        linkedWorkOrderId: wo._id,
        linkedAssignmentId: asg._id,
        visitor: {
          name: 'Vikram Sharma',
          purpose: job.complaintTitle
        },
        technician: {
          technicianId: 'TECH-002',
          nameSnapshot: 'Vikram Sharma'
        },
        validFrom: new Date(),
        validUntil: new Date(Date.now() + 48 * 60 * 60 * 1000),
        status: GATE_PASS_STATUS.ACTIVE,
        tokenHash: sha256(rawToken),
        otpHash: sha256(job.gateEntryOtp),
        usagePolicy: 'SINGLE_ENTRY',
        maxEntries: 1,
        issuedBy: 'DISPATCHER'
      });
    }
  }

  // ==========================================
  // 4. IMPORT GATE PASSES & SECURITY ENTRIES
  // ==========================================
  console.log('[Importer] Importing Pre-approved Passes from Residence...');
  const preApproved = residenceData.topics?.preApprovedPasses?.data || [];
  let gpCounter = 1;

  for (const pap of preApproved) {
    const passPublicId = `GP-2026-${String(gpCounter++).padStart(5, '0')}`;
    const rawOtp = pap.otp || '1234';
    const rawToken = pap.qrPayload || `QR_${passPublicId}`;

    await GatePass.create({
      publicId: passPublicId,
      passType: pap.category === 'DELIVERY' ? 'DELIVERY' : 'GUEST',
      sourceApplication: 'RESIDENCE',
      propertyId: 'PROP-RES-01',
      householdId: 'HH-BLR-1204',
      apartmentName: 'Bee Hive Residency',
      flatNumber: '1204',
      visitor: {
        name: pap.guestName,
        phoneSnapshot: pap.phone,
        vehicleNumber: pap.vehicleNumber,
        purpose: pap.purpose
      },
      validFrom: new Date(),
      validUntil: new Date(Date.now() + 24 * 60 * 60 * 1000),
      status: pap.status?.toUpperCase() === 'ACTIVE' ? GATE_PASS_STATUS.ACTIVE : GATE_PASS_STATUS.USED,
      tokenHash: sha256(rawToken),
      otpHash: sha256(rawOtp),
      usagePolicy: pap.type === 'ONE_TIME' ? 'SINGLE_ENTRY' : 'MULTI_ENTRY_WITHIN_WINDOW',
      maxEntries: 1,
      issuedBy: 'USR-001'
    });
  }

  console.log('[Importer] Importing Guard Entries from Security_json...');
  const guardEntries = securityData.topics?.guard?.entries?.initialEntries || [];
  for (const ge of guardEntries) {
    const gprPublicId = `GPR-2026-${String(gpCounter++).padStart(5, '0')}`;
    const req = await GatePassRequest.create({
      publicId: gprPublicId,
      source: { application: 'SECURITY', sourceRequestId: ge.id },
      requestType: ge.type === 'delivery' ? 'DELIVERY' : 'SECURITY_ARRIVAL',
      propertyId: 'PROP-SEC-01',
      apartmentName: ge.apartmentName,
      flatNumber: ge.flat,
      requestedBy: {
        userId: 'GUARD-001',
        name: 'Gate Guard',
        role: ROLES.SECURITY_GUARD
      },
      visitor: {
        name: ge.name,
        phone: ge.phone,
        organization: ge.company,
        vehicleNumber: ge.vehicleNo,
        category: ge.type?.toUpperCase()
      },
      validFrom: new Date(),
      validUntil: new Date(Date.now() + 4 * 60 * 60 * 1000),
      approval: {
        required: true,
        status: ge.residentApproved ? 'APPROVED' : 'PENDING'
      },
      status: ge.residentApproved ? 'APPROVED' : 'PENDING_APPROVAL'
    });

    if (ge.residentApproved) {
      const passPublicId = `GP-2026-${String(gpCounter++).padStart(5, '0')}`;
      const rawToken = `SEC_TOKEN_${ge.id}`;
      const rawOtp = '7788';

      const pass = await GatePass.create({
        publicId: passPublicId,
        passType: ge.type === 'delivery' ? 'DELIVERY' : 'GUEST',
        requestId: req._id,
        sourceApplication: 'SECURITY',
        propertyId: 'PROP-SEC-01',
        flatNumber: ge.flat,
        visitor: {
          name: ge.name,
          phoneSnapshot: ge.phone,
          organization: ge.company,
          vehicleNumber: ge.vehicleNo
        },
        validFrom: new Date(),
        validUntil: new Date(Date.now() + 4 * 60 * 60 * 1000),
        status: ge.status === 'in' ? GATE_PASS_STATUS.USED : GATE_PASS_STATUS.ACTIVE,
        tokenHash: sha256(rawToken),
        otpHash: sha256(rawOtp),
        usagePolicy: 'SINGLE_ENTRY',
        maxEntries: 1,
        entryCount: ge.status === 'in' ? 1 : 0,
        issuedBy: 'RESIDENT'
      });

      if (ge.status === 'in') {
        await GateAccessEvent.create({
          passId: pass._id,
          passPublicId: pass.publicId,
          propertyId: pass.propertyId,
          gateId: 'Main Gate',
          guardId: 'GUARD-001',
          guardName: 'Ramesh Singh',
          eventType: GATE_ACCESS_EVENT.CHECKED_IN,
          decisionCode: 'CHECKED_IN_ALLOWED',
          occurredAt: new Date()
        });
      }
    }
  }

  // Summary counts
  const [totalUsers, totalSR, totalWO, totalASG, totalGP] = await Promise.all([
    User.countDocuments(),
    ServiceRequest.countDocuments(),
    WorkOrder.countDocuments(),
    WorkOrderAssignment.countDocuments(),
    GatePass.countDocuments()
  ]);

  console.log('============================================================');
  console.log('🎉 COMPREHENSIVE BEE DATA IMPORT COMPLETED SUCCESSFULLY!');
  console.log('------------------------------------------------------------');
  console.log(`📦 Database:            "${mongoose.connection.name}"`);
  console.log(`👥 Total Users:         ${totalUsers}`);
  console.log(`📋 Service Requests:    ${totalSR}`);
  console.log(`🛠️ Work Orders:         ${totalWO}`);
  console.log(`👷 Tech Assignments:    ${totalASG}`);
  console.log(`🎟️ Gate Passes:         ${totalGP}`);
  console.log('------------------------------------------------------------');
  console.log('Ready to test live APIs!');
  console.log('============================================================');

  await mongoose.connection.close();
  process.exit(0);
};

importAllData().catch((err) => {
  console.error('[Importer] Fatal error importing data:', err);
  process.exit(1);
});
