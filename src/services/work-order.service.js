const WorkOrder = require('../models/WorkOrder.model');
const WorkOrderAssignment = require('../models/WorkOrderAssignment.model');
const ServiceRequest = require('../models/ServiceRequest.model');
const GatePass = require('../models/GatePass.model');
const GatePassService = require('./gate-pass.service');
const { WORK_ORDER_STATUS, SERVICE_REQUEST_STATUS, ASSIGNMENT_STATUS } = require('../config/constants');
const DispatchBusinessService = require('../business-services/dispatch.business-service');
const AuditService = require('./audit.service');
const OutboxService = require('./outbox.service');
const ApiError = require('../utils/ApiError');
const { sha256, generateRandomToken, generateNumericOtp } = require('../utils/crypto');
const { getPaginationParams, buildPaginationMeta } = require('../utils/pagination');

class WorkOrderService {
  /**
   * Helper to generate human-readable Public ID: WO-YYYY-XXXX
   */
  static async generateWorkOrderPublicId() {
    const year = new Date().getFullYear();
    const latest = await WorkOrder.findOne().sort({ createdAt: -1 }).select('publicId').lean();
    let nextSeq = 1;
    if (latest && latest.publicId) {
      const parts = latest.publicId.split('-');
      const lastNum = parseInt(parts[parts.length - 1], 10);
      if (!isNaN(lastNum)) nextSeq = lastNum + 1;
    }
    let candidate = `WO-${year}-${String(nextSeq).padStart(5, '0')}`;
    while (await WorkOrder.exists({ publicId: candidate })) {
      nextSeq++;
      candidate = `WO-${year}-${String(nextSeq).padStart(5, '0')}`;
    }
    return candidate;
  }

  /**
   * Helper to generate human-readable Assignment ID: ASG-YYYY-XXXX & SO-XXXX
   */
  static async generateAssignmentIds() {
    const year = new Date().getFullYear();
    const latest = await WorkOrderAssignment.findOne().sort({ createdAt: -1 }).select('publicId serviceOrderId').lean();
    let nextSeq = 1;
    if (latest && latest.publicId) {
      const parts = latest.publicId.split('-');
      const lastNum = parseInt(parts[parts.length - 1], 10);
      if (!isNaN(lastNum)) nextSeq = lastNum + 1;
    }
    let candidatePublicId = `ASG-${year}-${String(nextSeq).padStart(5, '0')}`;
    let candidateSoId = `SO-${String(nextSeq).padStart(4, '0')}`;
    while (await WorkOrderAssignment.exists({ publicId: candidatePublicId })) {
      nextSeq++;
      candidatePublicId = `ASG-${year}-${String(nextSeq).padStart(5, '0')}`;
      candidateSoId = `SO-${String(nextSeq).padStart(4, '0')}`;
    }
    return { publicId: candidatePublicId, serviceOrderId: candidateSoId };
  }

  /**
   * Dispatch a service request into a Work Order with multi-technician assignments
   */
  static async dispatch(serviceRequestId, payload, user) {
    DispatchBusinessService.assertCanDispatch(user);
    DispatchBusinessService.validateAssignments(payload.assignments);

    const query = serviceRequestId.startsWith('SR-')
      ? { publicId: serviceRequestId }
      : { _id: serviceRequestId };

    const serviceRequest = await ServiceRequest.findOne(query);
    DispatchBusinessService.assertDispatchEligibility(serviceRequest);

    const woPublicId = await this.generateWorkOrderPublicId();
    const caseOrderId = payload.caseOrderId || `CASE-${Date.now().toString().slice(-6)}`;
    const propertyId = serviceRequest.property.propertyId;

    const workOrder = await WorkOrder.create({
      publicId: woPublicId,
      serviceRequestId: serviceRequest._id,
      caseOrderId,
      title: payload.instructions || serviceRequest.title,
      instructions: payload.instructions || serviceRequest.description,
      agencyId: user.agencyId || 'AGENCY-01',
      propertyId,
      status: WORK_ORDER_STATUS.ASSIGNED,
      priority: serviceRequest.priority,
      targetDate: payload.targetDate ? new Date(payload.targetDate) : undefined,
      createdBy: user.userId
    });

    const createdAssignments = [];

    for (const asg of payload.assignments) {
      const { publicId: asgPublicId, serviceOrderId } = await this.generateAssignmentIds();
      const assignment = await WorkOrderAssignment.create({
        publicId: asgPublicId,
        serviceOrderId,
        workOrderId: workOrder._id,
        serviceRequestId: serviceRequest._id,
        technicianId: asg.technicianId,
        technicianName: asg.technicianName,
        role: asg.role,
        skillSnapshot: asg.skill,
        instructions: asg.instructions || payload.instructions,
        status: ASSIGNMENT_STATUS.ASSIGNED,
        targetDate: asg.targetDate ? new Date(asg.targetDate) : workOrder.targetDate
      });

      workOrder.assignmentIds.push(assignment._id);
      createdAssignments.push(assignment);

      // Create technician gate pass if requested
      if (payload.createTechnicianGatePass) {
        const rawToken = generateRandomToken(16);
        const rawOtp = generateNumericOtp(4);
        const passPublicId = await GatePassService.generatePassId();

        await GatePass.create({
          publicId: passPublicId,
          passType: 'TECHNICIAN',
          sourceApplication: 'AGENCY',
          propertyId,
          linkedWorkOrderId: workOrder._id,
          linkedAssignmentId: assignment._id,
          visitor: {
            name: asg.technicianName || asg.technicianId,
            purpose: `Work Order ${workOrder.publicId} - ${asg.role}`
          },
          technician: {
            technicianId: asg.technicianId,
            nameSnapshot: asg.technicianName
          },
          validFrom: new Date(),
          validUntil: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hour pass
          status: 'ACTIVE',
          tokenHash: sha256(rawToken),
          otpHash: sha256(rawOtp),
          usagePolicy: 'SINGLE_ENTRY',
          maxEntries: 1,
          issuedBy: user.userId
        });
      }
    }

    await workOrder.save();

    // Update parent Service Request
    serviceRequest.workOrderIds.push(workOrder._id);
    serviceRequest.status = SERVICE_REQUEST_STATUS.ASSIGNED;
    serviceRequest.history.push({
      action: 'DISPATCHED',
      toStatus: SERVICE_REQUEST_STATUS.ASSIGNED,
      performedBy: user.userId,
      reason: `Dispatched under work order ${workOrder.publicId} with ${createdAssignments.length} assignment(s)`
    });
    await serviceRequest.save();

    await AuditService.log({
      aggregateType: 'WorkOrder',
      aggregateId: workOrder.publicId,
      propertyId,
      actorId: user.userId,
      action: 'DISPATCH_WORK_ORDER',
      toStatus: workOrder.status,
      metadata: { serviceRequestId: serviceRequest.publicId, assignmentsCount: createdAssignments.length }
    });

    await OutboxService.publish({
      eventType: 'work-order.created',
      aggregateType: 'WorkOrder',
      aggregateId: workOrder.publicId,
      payload: {
        publicId: workOrder.publicId,
        serviceRequestId: serviceRequest.publicId,
        assignments: createdAssignments.map((a) => ({
          publicId: a.publicId,
          serviceOrderId: a.serviceOrderId,
          technicianId: a.technicianId
        }))
      },
      destination: 'TECHNICIAN'
    });

    return {
      workOrder,
      assignments: createdAssignments
    };
  }

  /**
   * Get work order by ID
   */
  static async getById(id) {
    const query = id.startsWith('WO-') ? { publicId: id } : { _id: id };
    const workOrder = await WorkOrder.findOne(query)
      .populate('assignmentIds')
      .populate('serviceRequestId');

    if (!workOrder) {
      throw ApiError.notFound(`Work order not found: ${id}`);
    }
    return workOrder;
  }

  /**
   * List work orders
   */
  static async list(filters = {}, query = {}) {
    const { page, limit, skip } = getPaginationParams(query);
    const mongoFilter = {};

    if (filters.status) mongoFilter.status = filters.status;
    if (filters.propertyId) mongoFilter.propertyId = filters.propertyId;
    if (filters.agencyId) mongoFilter.agencyId = filters.agencyId;

    const [items, total] = await Promise.all([
      WorkOrder.find(mongoFilter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('assignmentIds')
        .lean(),
      WorkOrder.countDocuments(mongoFilter)
    ]);

    return {
      items,
      pagination: buildPaginationMeta(total, page, limit)
    };
  }

  /**
   * Add a technician assignment to an existing work order
   */
  static async addAssignment(workOrderId, assignmentData, user) {
    const workOrder = await this.getById(workOrderId);
    const { publicId, serviceOrderId } = await this.generateAssignmentIds();

    const assignment = await WorkOrderAssignment.create({
      publicId,
      serviceOrderId,
      workOrderId: workOrder._id,
      serviceRequestId: workOrder.serviceRequestId._id || workOrder.serviceRequestId,
      technicianId: assignmentData.technicianId,
      technicianName: assignmentData.technicianName,
      role: assignmentData.role,
      skillSnapshot: assignmentData.skill,
      instructions: assignmentData.instructions || workOrder.instructions,
      status: ASSIGNMENT_STATUS.ASSIGNED,
      targetDate: assignmentData.targetDate ? new Date(assignmentData.targetDate) : workOrder.targetDate
    });

    workOrder.assignmentIds.push(assignment._id);
    await workOrder.save();

    await AuditService.log({
      aggregateType: 'WorkOrder',
      aggregateId: workOrder.publicId,
      propertyId: workOrder.propertyId,
      actorId: user.userId,
      action: 'ADD_ASSIGNMENT',
      metadata: { assignmentId: assignment.publicId, technicianId: assignment.technicianId }
    });

    return assignment;
  }
}

module.exports = WorkOrderService;

