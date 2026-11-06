const GatePassRequest = require('../models/GatePassRequest.model');
const GatePass = require('../models/GatePass.model');
const { GATE_PASS_REQUEST_STATUS, GATE_PASS_STATUS } = require('../config/constants');
const ApprovalPolicyBusinessService = require('../business-services/approval-policy.business-service');
const AuditService = require('./audit.service');
const OutboxService = require('./outbox.service');
const ApiError = require('../utils/ApiError');
const { sha256, generateRandomToken, generateNumericOtp } = require('../utils/crypto');
const { getPaginationParams, buildPaginationMeta } = require('../utils/pagination');

class GatePassService {
  /**
   * Helper to generate human-readable Public ID: GPR-YYYY-XXXX
   */
  static async generateRequestId() {
    const year = new Date().getFullYear();
    const latest = await GatePassRequest.findOne().sort({ createdAt: -1 }).select('publicId').lean();
    let nextSeq = 1;
    if (latest && latest.publicId) {
      const parts = latest.publicId.split('-');
      const lastNum = parseInt(parts[parts.length - 1], 10);
      if (!isNaN(lastNum)) nextSeq = lastNum + 1;
    }
    let candidate = `GPR-${year}-${String(nextSeq).padStart(5, '0')}`;
    while (await GatePassRequest.exists({ publicId: candidate })) {
      nextSeq++;
      candidate = `GPR-${year}-${String(nextSeq).padStart(5, '0')}`;
    }
    return candidate;
  }

  /**
   * Helper to generate human-readable Pass ID: GP-YYYY-XXXX
   */
  static async generatePassId() {
    const year = new Date().getFullYear();
    const latest = await GatePass.findOne().sort({ createdAt: -1 }).select('publicId').lean();
    let nextSeq = 1;
    if (latest && latest.publicId) {
      const parts = latest.publicId.split('-');
      const lastNum = parseInt(parts[parts.length - 1], 10);
      if (!isNaN(lastNum)) nextSeq = lastNum + 1;
    }
    let candidate = `GP-${year}-${String(nextSeq).padStart(5, '0')}`;
    while (await GatePass.exists({ publicId: candidate })) {
      nextSeq++;
      candidate = `GP-${year}-${String(nextSeq).padStart(5, '0')}`;
    }
    return candidate;
  }

  /**
   * Create a Gate Pass Request (e.g. Residence Pre-approved pass or Contractor pass)
   */
  static async createRequest(payload, user) {
    const publicId = await this.generateRequestId();
    const approvalPolicy = ApprovalPolicyBusinessService.evaluateGatePassApproval({
      requestType: payload.requestType,
      requestedByRole: user.role
    });

    const gatePassRequest = await GatePassRequest.create({
      publicId,
      source: {
        application: payload.sourceApplication || 'RESIDENCE',
        sourceRequestId: payload.sourceRequestId
      },
      requestType: payload.requestType,
      propertyId: payload.propertyId || user.propertyId || 'PROP-01',
      householdId: payload.householdId || user.householdId,
      apartmentName: payload.apartmentName || user.apartmentName,
      flatNumber: payload.flatNumber || user.flatNumber,
      requestedBy: {
        userId: user.userId,
        name: user.name,
        role: user.role
      },
      visitor: {
        name: payload.visitor.name,
        phone: payload.visitor.phone,
        organization: payload.visitor.organization,
        category: payload.visitor.category,
        vehicleNumber: payload.visitor.vehicleNumber,
        purpose: payload.visitor.purpose
      },
      expectedAt: payload.expectedAt ? new Date(payload.expectedAt) : undefined,
      validFrom: payload.validFrom ? new Date(payload.validFrom) : new Date(),
      validUntil: new Date(payload.validUntil),
      accessGate: payload.accessGate || 'Main Gate',
      accessInstructions: payload.accessInstructions,
      approval: approvalPolicy,
      status: approvalPolicy.required ? GATE_PASS_REQUEST_STATUS.PENDING_APPROVAL : GATE_PASS_REQUEST_STATUS.APPROVED
    });

    await AuditService.log({
      aggregateType: 'GatePassRequest',
      aggregateId: gatePassRequest.publicId,
      propertyId: gatePassRequest.propertyId,
      actorId: user.userId,
      action: 'CREATE_GATE_PASS_REQUEST',
      toStatus: gatePassRequest.status
    });

    // If pre-approved (e.g. Resident guest pass), issue the gate pass immediately!
    let issuedPassData = null;
    if (!approvalPolicy.required) {
      issuedPassData = await this.issuePassFromRequest(gatePassRequest, user);
    }

    return {
      request: gatePassRequest,
      issuedPass: issuedPassData
    };
  }

  /**
   * Approve a gate pass request and issue the pass
   */
  static async approveRequest(requestId, user) {
    const query = requestId.startsWith('GPR-') ? { publicId: requestId } : { _id: requestId };
    const request = await GatePassRequest.findOne(query);
    if (!request) {
      throw ApiError.notFound('Gate pass request not found');
    }

    if (request.status !== GATE_PASS_REQUEST_STATUS.PENDING_APPROVAL) {
      throw ApiError.conflict(`Cannot approve request in ${request.status} status`);
    }

    request.status = GATE_PASS_REQUEST_STATUS.APPROVED;
    request.approval = {
      required: true,
      status: 'APPROVED',
      approverId: user.userId,
      decidedAt: new Date()
    };

    const issuedPass = await this.issuePassFromRequest(request, user);
    return { request, issuedPass };
  }

  /**
   * Reject a gate pass request
   */
  static async rejectRequest(requestId, reason, user) {
    const query = requestId.startsWith('GPR-') ? { publicId: requestId } : { _id: requestId };
    const request = await GatePassRequest.findOne(query);
    if (!request) {
      throw ApiError.notFound('Gate pass request not found');
    }

    request.status = GATE_PASS_REQUEST_STATUS.REJECTED;
    request.approval = {
      required: true,
      status: 'REJECTED',
      approverId: user.userId,
      decidedAt: new Date(),
      reason
    };
    await request.save();

    await AuditService.log({
      aggregateType: 'GatePassRequest',
      aggregateId: request.publicId,
      propertyId: request.propertyId,
      actorId: user.userId,
      action: 'REJECT_GATE_PASS_REQUEST',
      reason
    });

    return request;
  }

  /**
   * Issues the actual pass credential from an approved request
   */
  static async issuePassFromRequest(request, user) {
    const passPublicId = await this.generatePassId();
    const rawToken = generateRandomToken(16);
    const rawOtp = generateNumericOtp(4);

    let passType = 'GUEST';
    if (request.requestType === 'DELIVERY') passType = 'DELIVERY';
    if (request.requestType === 'CONTRACTOR') passType = 'CONTRACTOR';
    if (request.requestType === 'TECHNICIAN_WORK_ORDER') passType = 'TECHNICIAN';

    const pass = await GatePass.create({
      publicId: passPublicId,
      passType,
      requestId: request._id,
      sourceApplication: request.source.application,
      propertyId: request.propertyId,
      householdId: request.householdId,
      apartmentName: request.apartmentName,
      flatNumber: request.flatNumber,
      visitor: {
        name: request.visitor.name,
        phoneSnapshot: request.visitor.phone,
        organization: request.visitor.organization,
        vehicleNumber: request.visitor.vehicleNumber,
        purpose: request.visitor.purpose
      },
      validFrom: request.validFrom,
      validUntil: request.validUntil,
      accessGate: request.accessGate,
      accessInstructions: request.accessInstructions,
      status: GATE_PASS_STATUS.ACTIVE,
      tokenHash: sha256(rawToken),
      otpHash: sha256(rawOtp),
      usagePolicy: 'SINGLE_ENTRY',
      maxEntries: 1,
      entryCount: 0,
      issuedBy: user.userId
    });

    request.status = GATE_PASS_REQUEST_STATUS.ISSUED;
    request.issuedPassId = pass._id;
    await request.save();

    await AuditService.log({
      aggregateType: 'GatePass',
      aggregateId: pass.publicId,
      propertyId: pass.propertyId,
      actorId: user.userId,
      action: 'ISSUE_GATE_PASS'
    });

    await OutboxService.publish({
      eventType: 'gate-pass.issued',
      aggregateType: 'GatePass',
      aggregateId: pass.publicId,
      payload: { publicId: pass.publicId, propertyId: pass.propertyId },
      destination: 'SECURITY'
    });

    return {
      publicId: pass.publicId,
      passType: pass.passType,
      visitor: pass.visitor,
      validFrom: pass.validFrom,
      validUntil: pass.validUntil,
      accessGate: pass.accessGate,
      token: rawToken, // Returned once upon issuance
      otp: rawOtp,     // Returned once upon issuance
      status: pass.status
    };
  }

  /**
   * Revoke an active pass
   */
  static async revokePass(passId, reason, user) {
    const query = passId.startsWith('GP-') ? { publicId: passId } : { _id: passId };
    const pass = await GatePass.findOne(query);
    if (!pass) {
      throw ApiError.notFound('Gate pass not found');
    }

    if (pass.status !== GATE_PASS_STATUS.ACTIVE) {
      throw ApiError.conflict(`Cannot revoke gate pass in ${pass.status} status`);
    }

    pass.status = GATE_PASS_STATUS.REVOKED;
    pass.revokedBy = user.userId;
    pass.revokedAt = new Date();
    pass.revokeReason = reason || 'Revoked by authority';
    await pass.save();

    await AuditService.log({
      aggregateType: 'GatePass',
      aggregateId: pass.publicId,
      propertyId: pass.propertyId,
      actorId: user.userId,
      action: 'REVOKE_GATE_PASS',
      reason
    });

    await OutboxService.publish({
      eventType: 'gate-pass.revoked',
      aggregateType: 'GatePass',
      aggregateId: pass.publicId,
      payload: { publicId: pass.publicId },
      destination: 'SECURITY'
    });

    return pass;
  }

  /**
   * Read gate pass by ID (sanitized)
   */
  static async getById(id) {
    const query = id.startsWith('GP-') ? { publicId: id } : { _id: id };
    const pass = await GatePass.findOne(query).lean();
    if (!pass) {
      throw ApiError.notFound(`Gate pass not found: ${id}`);
    }
    delete pass.tokenHash;
    delete pass.otpHash;
    return pass;
  }

  /**
   * List gate passes
   */
  static async list(filters = {}, query = {}) {
    const { page, limit, skip } = getPaginationParams(query);
    const mongoFilter = {};

    if (filters.status) mongoFilter.status = filters.status;
    if (filters.propertyId) mongoFilter.propertyId = filters.propertyId;
    if (filters.householdId) mongoFilter.householdId = filters.householdId;
    if (filters.passType) mongoFilter.passType = filters.passType;

    const [items, total] = await Promise.all([
      GatePass.find(mongoFilter)
        .select('-tokenHash -otpHash')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      GatePass.countDocuments(mongoFilter)
    ]);

    return {
      items,
      pagination: buildPaginationMeta(total, page, limit)
    };
  }
}

module.exports = GatePassService;

