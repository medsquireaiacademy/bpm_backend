const crypto = require('crypto');
const WorkOrderAssignment = require('../models/WorkOrderAssignment.model');
const WorkOrder = require('../models/WorkOrder.model');
const ServiceRequest = require('../models/ServiceRequest.model');
const GatePass = require('../models/GatePass.model');
const { ASSIGNMENT_STATUS, WORK_ORDER_STATUS, SERVICE_REQUEST_STATUS } = require('../config/constants');
const WorkOrderLifecycleBusinessService = require('../business-services/work-order-lifecycle.business-service');
const AuditService = require('./audit.service');
const OutboxService = require('./outbox.service');
const ApiError = require('../utils/ApiError');
const { getPaginationParams, buildPaginationMeta } = require('../utils/pagination');

class TechnicianService {
  /**
   * Find an assignment by publicId, serviceOrderId, or ObjectId and verify ownership
   */
  static async getAssignment(jobId, user) {
    let query = {};
    if (jobId.startsWith('ASG-')) {
      query.publicId = jobId;
    } else if (jobId.startsWith('SO-')) {
      query.serviceOrderId = jobId;
    } else {
      query._id = jobId;
    }

    const assignment = await WorkOrderAssignment.findOne(query)
      .populate('workOrderId')
      .populate('serviceRequestId');

    if (!assignment) {
      throw ApiError.notFound(`Technician job not found: ${jobId}`);
    }

    // Authorization: Must be assigned technician, agency admin, or supervisor
    if (user.role === 'TECHNICIAN' && assignment.technicianId !== user.userId) {
      throw ApiError.forbidden('You are not authorized to view or update this assignment');
    }

    return assignment;
  }

  /**
   * List jobs for a technician
   */
  static async listJobs(technicianId, filters = {}, query = {}) {
    const { page, limit, skip } = getPaginationParams(query);
    const mongoFilter = { technicianId };

    if (filters.status) mongoFilter.status = filters.status;

    const [items, total] = await Promise.all([
      WorkOrderAssignment.find(mongoFilter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('workOrderId')
        .populate('serviceRequestId')
        .lean(),
      WorkOrderAssignment.countDocuments(mongoFilter)
    ]);

    return {
      items,
      pagination: buildPaginationMeta(total, page, limit)
    };
  }

  /**
   * Check in / start assignment
   */
  static async checkIn(jobId, checkInData, user) {
    const assignment = await this.getAssignment(jobId, user);
    WorkOrderLifecycleBusinessService.assertValidAssignmentTransition(
      assignment.status,
      ASSIGNMENT_STATUS.IN_PROGRESS
    );

    const oldStatus = assignment.status;
    assignment.status = ASSIGNMENT_STATUS.IN_PROGRESS;
    assignment.startedAt = assignment.startedAt || new Date();
    assignment.checkIn = {
      at: new Date(),
      latitude: checkInData.latitude,
      longitude: checkInData.longitude,
      evidenceKey: checkInData.evidenceKey
    };

    await assignment.save();

    // Sync parent WorkOrder & ServiceRequest
    await this.syncParentStates(assignment.workOrderId._id || assignment.workOrderId, user.userId);

    await AuditService.log({
      aggregateType: 'WorkOrderAssignment',
      aggregateId: assignment.publicId,
      actorId: user.userId,
      action: 'TECHNICIAN_CHECK_IN',
      fromStatus: oldStatus,
      toStatus: assignment.status
    });

    return assignment;
  }

  /**
   * Add a note to the assignment
   */
  static async addNote(jobId, text, user) {
    const assignment = await this.getAssignment(jobId, user);
    const note = {
      noteId: `note_${crypto.randomUUID()}`,
      text,
      createdAt: new Date(),
      createdBy: user.name || user.userId
    };

    assignment.notes.push(note);
    await assignment.save();

    await AuditService.log({
      aggregateType: 'WorkOrderAssignment',
      aggregateId: assignment.publicId,
      actorId: user.userId,
      action: 'ADD_TECHNICIAN_NOTE'
    });

    return assignment;
  }

  /**
   * Add photo attachment
   */
  static async addAttachment(jobId, attachmentData, user) {
    const assignment = await this.getAssignment(jobId, user);
    const photo = {
      attachmentId: `att_${crypto.randomUUID()}`,
      url: attachmentData.url,
      caption: attachmentData.caption,
      createdAt: new Date()
    };

    if (attachmentData.type === 'before') {
      assignment.beforePhotos.push(photo);
    } else {
      assignment.afterPhotos.push(photo);
    }

    await assignment.save();

    await AuditService.log({
      aggregateType: 'WorkOrderAssignment',
      aggregateId: assignment.publicId,
      actorId: user.userId,
      action: 'ADD_PHOTO_ATTACHMENT',
      metadata: { type: attachmentData.type }
    });

    return assignment;
  }

  /**
   * Put assignment on hold
   */
  static async hold(jobId, holdData, user) {
    const assignment = await this.getAssignment(jobId, user);
    WorkOrderLifecycleBusinessService.assertValidAssignmentTransition(
      assignment.status,
      ASSIGNMENT_STATUS.ON_HOLD
    );

    const oldStatus = assignment.status;
    assignment.status = ASSIGNMENT_STATUS.ON_HOLD;
    assignment.hold = {
      reason: holdData.reason,
      createdAt: new Date(),
      createdBy: user.userId
    };

    if (holdData.materialRequests && holdData.materialRequests.length > 0) {
      assignment.materialRequests = holdData.materialRequests.map((m, idx) => ({
        itemId: m.itemId || `mat_${idx + 1}`,
        name: m.name,
        quantity: m.quantity || 1,
        status: 'PENDING'
      }));
    }

    await assignment.save();
    await this.syncParentStates(assignment.workOrderId._id || assignment.workOrderId, user.userId);

    await AuditService.log({
      aggregateType: 'WorkOrderAssignment',
      aggregateId: assignment.publicId,
      actorId: user.userId,
      action: 'TECHNICIAN_HOLD',
      fromStatus: oldStatus,
      toStatus: assignment.status,
      reason: holdData.reason
    });

    return assignment;
  }

  /**
   * Resume assignment from hold
   */
  static async resume(jobId, user) {
    const assignment = await this.getAssignment(jobId, user);
    WorkOrderLifecycleBusinessService.assertValidAssignmentTransition(
      assignment.status,
      ASSIGNMENT_STATUS.IN_PROGRESS
    );

    const oldStatus = assignment.status;
    assignment.status = ASSIGNMENT_STATUS.IN_PROGRESS;
    assignment.hold = undefined;

    await assignment.save();
    await this.syncParentStates(assignment.workOrderId._id || assignment.workOrderId, user.userId);

    await AuditService.log({
      aggregateType: 'WorkOrderAssignment',
      aggregateId: assignment.publicId,
      actorId: user.userId,
      action: 'TECHNICIAN_RESUME',
      fromStatus: oldStatus,
      toStatus: assignment.status
    });

    return assignment;
  }

  /**
   * Complete assignment
   */
  static async complete(jobId, completeData = {}, user) {
    const assignment = await this.getAssignment(jobId, user);
    WorkOrderLifecycleBusinessService.assertValidAssignmentTransition(
      assignment.status,
      ASSIGNMENT_STATUS.COMPLETED
    );

    const oldStatus = assignment.status;
    assignment.status = ASSIGNMENT_STATUS.COMPLETED;
    assignment.completedAt = new Date();

    if (completeData.completionNote) {
      assignment.notes.push({
        noteId: `note_${crypto.randomUUID()}`,
        text: `Completion Note: ${completeData.completionNote}`,
        createdAt: new Date(),
        createdBy: user.name || user.userId
      });
    }

    if (completeData.afterPhotos && completeData.afterPhotos.length > 0) {
      for (const p of completeData.afterPhotos) {
        assignment.afterPhotos.push({
          attachmentId: `att_${crypto.randomUUID()}`,
          url: p.url,
          caption: p.caption,
          createdAt: new Date()
        });
      }
    }

    await assignment.save();
    await this.syncParentStates(assignment.workOrderId._id || assignment.workOrderId, user.userId);

    await AuditService.log({
      aggregateType: 'WorkOrderAssignment',
      aggregateId: assignment.publicId,
      actorId: user.userId,
      action: 'TECHNICIAN_COMPLETE',
      fromStatus: oldStatus,
      toStatus: assignment.status
    });

    await OutboxService.publish({
      eventType: 'technician-job.status-changed',
      aggregateType: 'WorkOrderAssignment',
      aggregateId: assignment.publicId,
      payload: { publicId: assignment.publicId, status: assignment.status },
      destination: 'AGENCY'
    });

    return assignment;
  }

  /**
   * Helper to recalculate parent WorkOrder and ServiceRequest statuses based on assignments
   */
  static async syncParentStates(workOrderId, actorId) {
    const assignments = await WorkOrderAssignment.find({ workOrderId });
    const aggregateStatus = WorkOrderLifecycleBusinessService.computeAggregateStatus(assignments);

    const workOrder = await WorkOrder.findById(workOrderId);
    if (!workOrder) return;

    if (workOrder.status !== aggregateStatus) {
      workOrder.status = aggregateStatus;
      await workOrder.save();

      // If workOrder resolved, update parent ServiceRequest
      if (aggregateStatus === WORK_ORDER_STATUS.RESOLVED) {
        const sr = await ServiceRequest.findById(workOrder.serviceRequestId);
        if (sr && sr.status !== SERVICE_REQUEST_STATUS.RESOLVED) {
          sr.status = SERVICE_REQUEST_STATUS.RESOLVED;
          sr.history.push({
            action: 'AUTO_RESOLVED',
            toStatus: SERVICE_REQUEST_STATUS.RESOLVED,
            performedBy: actorId,
            reason: 'All technician assignments have completed successfully.'
          });
          await sr.save();
        }
      } else if (aggregateStatus === WORK_ORDER_STATUS.IN_PROGRESS) {
        const sr = await ServiceRequest.findById(workOrder.serviceRequestId);
        if (sr && sr.status === SERVICE_REQUEST_STATUS.ASSIGNED) {
          sr.status = SERVICE_REQUEST_STATUS.IN_PROGRESS;
          await sr.save();
        }
      }
    }
  }

  /**
   * Get safe gate pass details for technician job
   */
  static async getGatePass(jobId, user) {
    const assignment = await this.getAssignment(jobId, user);
    const pass = await GatePass.findOne({ linkedAssignmentId: assignment._id }).lean();
    if (!pass) {
      throw ApiError.notFound('No gate pass linked to this assignment');
    }

    // Do not leak secret hashes
    delete pass.tokenHash;
    delete pass.otpHash;
    return pass;
  }
}

module.exports = TechnicianService;

