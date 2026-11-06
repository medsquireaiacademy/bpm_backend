const ServiceRequest = require('../models/ServiceRequest.model');
const { SERVICE_REQUEST_STATUS, PRIORITY, SOURCES } = require('../config/constants');
const ApprovalPolicyBusinessService = require('../business-services/approval-policy.business-service');
const WorkOrderLifecycleBusinessService = require('../business-services/work-order-lifecycle.business-service');
const AuditService = require('./audit.service');
const OutboxService = require('./outbox.service');
const ApiError = require('../utils/ApiError');
const { getPaginationParams, buildPaginationMeta } = require('../utils/pagination');

class ServiceRequestService {
  /**
   * Helper to generate human-readable Public ID: SR-YYYY-XXXX
   */
  static async generatePublicId() {
    const year = new Date().getFullYear();
    const latest = await ServiceRequest.findOne().sort({ createdAt: -1 }).select('publicId').lean();
    let nextSeq = 1;
    if (latest && latest.publicId) {
      const parts = latest.publicId.split('-');
      const lastNum = parseInt(parts[parts.length - 1], 10);
      if (!isNaN(lastNum)) nextSeq = lastNum + 1;
    }
    let candidate = `SR-${year}-${String(nextSeq).padStart(5, '0')}`;
    while (await ServiceRequest.exists({ publicId: candidate })) {
      nextSeq++;
      candidate = `SR-${year}-${String(nextSeq).padStart(5, '0')}`;
    }
    return candidate;
  }

  /**
   * Normalize priority string
   */
  static normalizePriority(priority) {
    if (!priority) return PRIORITY.NORMAL;
    const p = String(priority).toUpperCase();
    if (p.includes('URGENT')) return PRIORITY.URGENT;
    if (p.includes('HIGH')) return PRIORITY.HIGH;
    if (p.includes('LOW')) return PRIORITY.LOW;
    return PRIORITY.NORMAL;
  }

  /**
   * Ingest a service request from Residence App
   */
  static async createFromResidence(payload, actor = {}) {
    const existing = await ServiceRequest.findOne({
      'source.application': SOURCES.RESIDENCE,
      'source.sourceRequestId': payload.sourceRequestId
    });
    if (existing) {
      return existing;
    }

    const publicId = await this.generatePublicId();
    const priority = this.normalizePriority(payload.urgency || payload.priority);
    const propertyId = payload.location?.propertyId || payload.location?.apartmentId || 'PROP-RESIDENCE-01';

    const serviceRequest = await ServiceRequest.create({
      publicId,
      source: {
        application: SOURCES.RESIDENCE,
        sourceRequestId: payload.sourceRequestId,
        sourceStatus: 'Pending',
        sourceCreatedAt: new Date()
      },
      property: {
        propertyId,
        householdId: payload.householdId,
        apartmentName: payload.location?.apartmentName || 'Bee Hive Residency',
        tower: payload.location?.tower || payload.location?.towerName || 'Tower A',
        floor: String(payload.location?.floor || ''),
        flatNumber: String(payload.location?.flatNumber || ''),
        complaintScope: 'INDIVIDUAL_UNIT'
      },
      requester: {
        userId: payload.requesterId,
        name: payload.requesterName || actor.name || 'Resident',
        phone: payload.requesterPhone || actor.phone || '',
        role: 'RESIDENT'
      },
      classification: {
        category: payload.category,
        serviceType: payload.serviceType || payload.category
      },
      title: payload.title,
      description: payload.description,
      priority,
      status: SERVICE_REQUEST_STATUS.PENDING,
      preferredSchedule: {
        date: payload.preferredDate,
        timeSlot: payload.preferredTimeSlot
      },
      attachments: (payload.attachments || []).map((att, idx) => ({
        attachmentId: att.id || `att_${idx}`,
        kind: att.kind || 'ISSUE',
        url: att.url,
        fileName: att.fileName
      })),
      history: [
        {
          action: 'CREATED_FROM_RESIDENCE',
          toStatus: SERVICE_REQUEST_STATUS.PENDING,
          performedBy: actor.userId || payload.requesterId,
          timestamp: new Date()
        }
      ]
    });

    await AuditService.log({
      aggregateType: 'ServiceRequest',
      aggregateId: serviceRequest.publicId,
      propertyId,
      actorId: actor.userId || payload.requesterId,
      action: 'CREATE_RESIDENCE_REQUEST',
      toStatus: serviceRequest.status
    });

    await OutboxService.publish({
      eventType: 'service-request.created',
      aggregateType: 'ServiceRequest',
      aggregateId: serviceRequest.publicId,
      payload: {
        publicId: serviceRequest.publicId,
        source: serviceRequest.source,
        status: serviceRequest.status,
        title: serviceRequest.title
      },
      destination: 'AGENCY'
    });

    return serviceRequest;
  }

  /**
   * Ingest a complaint from RWA App
   */
  static async createFromRwa(payload, actor = {}) {
    const existing = await ServiceRequest.findOne({
      'source.application': SOURCES.RWA,
      'source.sourceRequestId': payload.sourceRequestId
    });
    if (existing) {
      return existing;
    }

    const publicId = await this.generatePublicId();
    const priority = this.normalizePriority(payload.priority);
    const propertyId = payload.propertyId || payload.apartmentId || 'PROP-RWA-01';

    const approvalPolicy = ApprovalPolicyBusinessService.evaluateServiceRequestApproval({
      source: SOURCES.RWA,
      complaintScope: payload.complaintScope,
      requiresApproval: payload.requiresApproval,
      priority
    });

    const initialStatus = approvalPolicy.required
      ? SERVICE_REQUEST_STATUS.PENDING_APPROVAL
      : SERVICE_REQUEST_STATUS.PENDING;

    const serviceRequest = await ServiceRequest.create({
      publicId,
      source: {
        application: SOURCES.RWA,
        sourceRequestId: payload.sourceRequestId,
        sourceStatus: payload.requiresApproval ? 'Pending Approval' : 'Approved',
        sourceCreatedAt: new Date()
      },
      property: {
        propertyId,
        apartmentName: payload.apartmentName || 'Golden Apartment',
        tower: payload.location?.towerName || payload.location?.towerId || '',
        floor: String(payload.location?.floor || ''),
        placeName: payload.location?.placeName || '',
        asset: payload.location?.asset || '',
        complaintScope: payload.complaintScope || 'Common Area'
      },
      requester: {
        userId: payload.submittedById || actor.userId || 'RWA-USER',
        role: payload.submittedByRole || 'Tenant'
      },
      classification: {
        category: payload.category,
        issueType: payload.issueType
      },
      title: payload.title,
      description: payload.description,
      priority,
      status: initialStatus,
      approval: approvalPolicy,
      attachments: (payload.attachments || []).map((att, idx) => ({
        attachmentId: att.id || `att_${idx}`,
        url: att.url || att.photoUrl,
        fileName: att.fileName
      })),
      history: [
        {
          action: 'CREATED_FROM_RWA',
          toStatus: initialStatus,
          performedBy: actor.userId || payload.submittedById || 'RWA',
          reason: approvalPolicy.required ? 'Pending RWA administrative approval' : 'Intake accepted',
          timestamp: new Date()
        }
      ]
    });

    await AuditService.log({
      aggregateType: 'ServiceRequest',
      aggregateId: serviceRequest.publicId,
      propertyId,
      actorId: actor.userId || payload.submittedById || 'RWA',
      action: 'CREATE_RWA_COMPLAINT',
      toStatus: initialStatus
    });

    await OutboxService.publish({
      eventType: 'service-request.created',
      aggregateType: 'ServiceRequest',
      aggregateId: serviceRequest.publicId,
      payload: {
        publicId: serviceRequest.publicId,
        source: serviceRequest.source,
        status: serviceRequest.status,
        requiresApproval: approvalPolicy.required
      },
      destination: 'AGENCY'
    });

    return serviceRequest;
  }

  /**
   * Find request by source application and sourceRequestId
   */
  static async getBySourceId(application, sourceRequestId) {
    const request = await ServiceRequest.findOne({
      'source.application': application,
      'source.sourceRequestId': sourceRequestId
    }).populate('workOrderIds');

    if (!request) {
      throw ApiError.notFound(`Service request not found for source ${application}: ${sourceRequestId}`);
    }
    return request;
  }

  /**
   * Find request by publicId or ObjectId
   */
  static async getById(id) {
    const query = id.startsWith('SR-') ? { publicId: id } : { _id: id };
    const request = await ServiceRequest.findOne(query).populate({
      path: 'workOrderIds',
      populate: { path: 'assignmentIds' }
    });

    if (!request) {
      throw ApiError.notFound(`Service request not found: ${id}`);
    }
    return request;
  }

  /**
   * List and filter service requests
   */
  static async list(filters = {}, query = {}) {
    const { page, limit, skip } = getPaginationParams(query);
    const mongoFilter = {};

    if (filters.status) mongoFilter.status = filters.status;
    if (filters.priority) mongoFilter.priority = filters.priority;
    if (filters.category) mongoFilter['classification.category'] = filters.category;
    if (filters.propertyId) mongoFilter['property.propertyId'] = filters.propertyId;
    if (filters.sourceApplication) mongoFilter['source.application'] = filters.sourceApplication;
    if (filters.householdId) mongoFilter['property.householdId'] = filters.householdId;

    const [items, total] = await Promise.all([
      ServiceRequest.find(mongoFilter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('workOrderIds')
        .lean(),
      ServiceRequest.countDocuments(mongoFilter)
    ]);

    return {
      items,
      pagination: buildPaginationMeta(total, page, limit)
    };
  }

  /**
   * Approve a service request (RWA or Agency)
   */
  static async approve(id, reason, user) {
    ApprovalPolicyBusinessService.assertCanApproveServiceRequest(user);
    const request = await this.getById(id);

    WorkOrderLifecycleBusinessService.assertValidServiceRequestTransition(
      request.status,
      SERVICE_REQUEST_STATUS.APPROVED
    );

    const oldStatus = request.status;
    request.status = SERVICE_REQUEST_STATUS.APPROVED;
    request.approval = {
      required: true,
      status: 'APPROVED',
      approvedBy: user.userId,
      approvedAt: new Date(),
      reason: reason || 'Approved by authority'
    };
    request.history.push({
      action: 'APPROVED',
      fromStatus: oldStatus,
      toStatus: request.status,
      performedBy: user.userId,
      reason
    });

    await request.save();

    await AuditService.log({
      aggregateType: 'ServiceRequest',
      aggregateId: request.publicId,
      propertyId: request.property.propertyId,
      actorId: user.userId,
      action: 'APPROVE',
      fromStatus: oldStatus,
      toStatus: request.status,
      reason
    });

    await OutboxService.publish({
      eventType: 'service-request.approved',
      aggregateType: 'ServiceRequest',
      aggregateId: request.publicId,
      payload: { publicId: request.publicId, status: request.status }
    });

    return request;
  }

  /**
   * Reject a service request
   */
  static async reject(id, reason, user) {
    ApprovalPolicyBusinessService.assertCanApproveServiceRequest(user);
    const request = await this.getById(id);

    WorkOrderLifecycleBusinessService.assertValidServiceRequestTransition(
      request.status,
      SERVICE_REQUEST_STATUS.REJECTED
    );

    const oldStatus = request.status;
    request.status = SERVICE_REQUEST_STATUS.REJECTED;
    request.approval = {
      required: true,
      status: 'REJECTED',
      approvedBy: user.userId,
      approvedAt: new Date(),
      reason: reason || 'Rejected'
    };
    request.history.push({
      action: 'REJECTED',
      fromStatus: oldStatus,
      toStatus: request.status,
      performedBy: user.userId,
      reason
    });

    await request.save();

    await AuditService.log({
      aggregateType: 'ServiceRequest',
      aggregateId: request.publicId,
      propertyId: request.property.propertyId,
      actorId: user.userId,
      action: 'REJECT',
      fromStatus: oldStatus,
      toStatus: request.status,
      reason
    });

    await OutboxService.publish({
      eventType: 'service-request.rejected',
      aggregateType: 'ServiceRequest',
      aggregateId: request.publicId,
      payload: { publicId: request.publicId, status: request.status, reason }
    });

    return request;
  }

  /**
   * Put service request on hold
   */
  static async hold(id, reason, user) {
    const request = await this.getById(id);
    WorkOrderLifecycleBusinessService.assertValidServiceRequestTransition(
      request.status,
      SERVICE_REQUEST_STATUS.ON_HOLD
    );

    const oldStatus = request.status;
    request.status = SERVICE_REQUEST_STATUS.ON_HOLD;
    request.history.push({
      action: 'PUT_ON_HOLD',
      fromStatus: oldStatus,
      toStatus: request.status,
      performedBy: user.userId,
      reason
    });

    await request.save();

    await AuditService.log({
      aggregateType: 'ServiceRequest',
      aggregateId: request.publicId,
      propertyId: request.property.propertyId,
      actorId: user.userId,
      action: 'HOLD',
      fromStatus: oldStatus,
      toStatus: request.status,
      reason
    });

    return request;
  }

  /**
   * Resume service request from hold
   */
  static async resume(id, user) {
    const request = await this.getById(id);
    if (request.status !== SERVICE_REQUEST_STATUS.ON_HOLD) {
      throw ApiError.badRequest('Service request is not currently on hold');
    }

    const nextStatus = request.workOrderIds.length > 0
      ? SERVICE_REQUEST_STATUS.IN_PROGRESS
      : SERVICE_REQUEST_STATUS.ASSIGNED;

    const oldStatus = request.status;
    request.status = nextStatus;
    request.history.push({
      action: 'RESUMED',
      fromStatus: oldStatus,
      toStatus: request.status,
      performedBy: user.userId
    });

    await request.save();

    await AuditService.log({
      aggregateType: 'ServiceRequest',
      aggregateId: request.publicId,
      propertyId: request.property.propertyId,
      actorId: user.userId,
      action: 'RESUME',
      fromStatus: oldStatus,
      toStatus: request.status
    });

    return request;
  }

  /**
   * Resolve service request
   */
  static async resolve(id, user) {
    const request = await this.getById(id);
    WorkOrderLifecycleBusinessService.assertValidServiceRequestTransition(
      request.status,
      SERVICE_REQUEST_STATUS.RESOLVED
    );

    const oldStatus = request.status;
    request.status = SERVICE_REQUEST_STATUS.RESOLVED;
    request.history.push({
      action: 'RESOLVED',
      fromStatus: oldStatus,
      toStatus: request.status,
      performedBy: user.userId
    });

    await request.save();

    await AuditService.log({
      aggregateType: 'ServiceRequest',
      aggregateId: request.publicId,
      propertyId: request.property.propertyId,
      actorId: user.userId,
      action: 'RESOLVE',
      fromStatus: oldStatus,
      toStatus: request.status
    });

    await OutboxService.publish({
      eventType: 'service-request.resolved',
      aggregateType: 'ServiceRequest',
      aggregateId: request.publicId,
      payload: { publicId: request.publicId, status: request.status }
    });

    return request;
  }

  /**
   * Close service request
   */
  static async close(id, user) {
    const request = await this.getById(id);
    WorkOrderLifecycleBusinessService.assertValidServiceRequestTransition(
      request.status,
      SERVICE_REQUEST_STATUS.CLOSED
    );

    const oldStatus = request.status;
    request.status = SERVICE_REQUEST_STATUS.CLOSED;
    request.history.push({
      action: 'CLOSED',
      fromStatus: oldStatus,
      toStatus: request.status,
      performedBy: user.userId
    });

    await request.save();

    await AuditService.log({
      aggregateType: 'ServiceRequest',
      aggregateId: request.publicId,
      propertyId: request.property.propertyId,
      actorId: user.userId,
      action: 'CLOSE',
      fromStatus: oldStatus,
      toStatus: request.status
    });

    await OutboxService.publish({
      eventType: 'service-request.closed',
      aggregateType: 'ServiceRequest',
      aggregateId: request.publicId,
      payload: { publicId: request.publicId, status: request.status }
    });

    return request;
  }
}

module.exports = ServiceRequestService;

