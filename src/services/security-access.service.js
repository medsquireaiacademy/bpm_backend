const GatePass = require('../models/GatePass.model');
const GatePassRequest = require('../models/GatePassRequest.model');
const GateAccessEvent = require('../models/GateAccessEvent.model');
const { GATE_ACCESS_EVENT, GATE_PASS_STATUS, GATE_PASS_REQUEST_STATUS } = require('../config/constants');
const GatePassVerificationBusinessService = require('../business-services/gate-pass-verification.business-service');
const AccessDecisionBusinessService = require('../business-services/access-decision.business-service');
const GatePassService = require('./gate-pass.service');
const AuditService = require('./audit.service');
const OutboxService = require('./outbox.service');
const ApiError = require('../utils/ApiError');
const { sha256 } = require('../utils/crypto');

class SecurityAccessService {
  /**
   * Guard registers visitor arrival at the gate (requires resident approval)
   */
  static async registerVisitorArrival(payload, guardUser) {
    AccessDecisionBusinessService.assertGuardCannotSelfApprove(guardUser);

    const publicId = await GatePassService.generateRequestId();
    const propertyId = payload.propertyId || guardUser.propertyId || 'PROP-SECURITY-01';

    const accessRequest = await GatePassRequest.create({
      publicId,
      source: { application: 'SECURITY' },
      requestType: 'SECURITY_ARRIVAL',
      propertyId,
      flatNumber: payload.flatNumber,
      requestedBy: {
        userId: guardUser.userId,
        name: guardUser.name || 'Guard',
        role: guardUser.role
      },
      visitor: {
        name: payload.visitorName,
        phone: payload.phone,
        vehicleNumber: payload.vehicleNumber,
        purpose: payload.purpose || 'Visitor Arrival',
        category: payload.category || 'VISITOR'
      },
      validFrom: new Date(),
      validUntil: new Date(Date.now() + 4 * 60 * 60 * 1000), // 4 hours window
      accessGate: payload.gateId || 'Main Gate',
      approval: {
        required: true,
        status: 'PENDING'
      },
      status: GATE_PASS_REQUEST_STATUS.PENDING_APPROVAL
    });

    await AuditService.log({
      aggregateType: 'GatePassRequest',
      aggregateId: accessRequest.publicId,
      propertyId,
      actorId: guardUser.userId,
      action: 'GUARD_REGISTER_ARRIVAL',
      toStatus: accessRequest.status
    });

    await OutboxService.publish({
      eventType: 'gate-access.arrival-pending-approval',
      aggregateType: 'GatePassRequest',
      aggregateId: accessRequest.publicId,
      payload: {
        publicId: accessRequest.publicId,
        visitorName: accessRequest.visitor.name,
        flatNumber: accessRequest.flatNumber
      },
      destination: 'RESIDENCE'
    });

    return accessRequest;
  }

  /**
   * Resident approves or rejects visitor arrival
   */
  static async recordResidentDecision(requestId, { decision, reason }, residentUser) {
    const query = requestId.startsWith('GPR-') ? { publicId: requestId } : { _id: requestId };
    const accessRequest = await GatePassRequest.findOne(query);
    if (!accessRequest) {
      throw ApiError.notFound('Arrival access request not found');
    }

    AccessDecisionBusinessService.assertResidentDecisionAuthorization(accessRequest, residentUser);

    if (decision === 'APPROVE') {
      const { request, issuedPass } = await GatePassService.approveRequest(requestId, residentUser);

      await OutboxService.publish({
        eventType: 'gate-access.arrival-approved',
        aggregateType: 'GatePassRequest',
        aggregateId: request.publicId,
        payload: { publicId: request.publicId, passPublicId: issuedPass.publicId, decision: 'APPROVED' },
        destination: 'SECURITY'
      });

      return { decision: 'APPROVED', request, issuedPass };
    } else {
      const request = await GatePassService.rejectRequest(requestId, reason || 'Entry denied by resident', residentUser);

      await OutboxService.publish({
        eventType: 'gate-access.arrival-rejected',
        aggregateType: 'GatePassRequest',
        aggregateId: request.publicId,
        payload: { publicId: request.publicId, decision: 'REJECTED', reason },
        destination: 'SECURITY'
      });

      return { decision: 'REJECTED', request };
    }
  }

  /**
   * Verify gate pass token or OTP at the gate
   */
  static async verifyPass({ token, otp, gateId = 'Main Gate', propertyId }, guardUser) {
    let pass = null;

    if (token) {
      const hashed = sha256(token);
      pass = await GatePass.findOne({ tokenHash: hashed });
    } else if (otp) {
      const hashed = sha256(otp);
      pass = await GatePass.findOne({ otpHash: hashed, status: GATE_PASS_STATUS.ACTIVE });
    }

    const verification = GatePassVerificationBusinessService.verifyPass(pass, {
      token,
      otp,
      propertyId: propertyId || (guardUser ? guardUser.propertyId : undefined)
    });

    // Record access attempt event
    await GateAccessEvent.create({
      passId: pass ? pass._id : undefined,
      passPublicId: pass ? pass.publicId : undefined,
      propertyId: pass ? pass.propertyId : (propertyId || 'UNKNOWN'),
      gateId,
      guardId: guardUser.userId,
      guardName: guardUser.name,
      eventType: verification.allowed ? GATE_ACCESS_EVENT.VERIFY_ALLOWED : GATE_ACCESS_EVENT.VERIFY_DENIED,
      decisionCode: verification.code,
      metadata: { verificationMessage: verification.message }
    });

    const safePass = pass ? pass.toObject() : null;
    if (safePass) {
      delete safePass.tokenHash;
      delete safePass.otpHash;
    }

    return {
      allowed: verification.allowed,
      code: verification.code,
      message: verification.message,
      pass: safePass
    };
  }

  /**
   * Check in / grant entry at gate
   */
  static async checkIn(passId, { gateId = 'Main Gate', remarks }, guardUser) {
    const query = passId.startsWith('GP-') ? { publicId: passId } : { _id: passId };
    const pass = await GatePass.findOne(query);
    if (!pass) {
      throw ApiError.notFound('Gate pass not found');
    }

    const verification = GatePassVerificationBusinessService.verifyPass(pass);
    if (!verification.allowed) {
      throw ApiError.conflict(`Entry denied: ${verification.message}`);
    }

    pass.entryCount += 1;
    if (pass.usagePolicy === 'SINGLE_ENTRY') {
      pass.status = GATE_PASS_STATUS.USED;
    }
    await pass.save();

    const event = await GateAccessEvent.create({
      passId: pass._id,
      passPublicId: pass.publicId,
      propertyId: pass.propertyId,
      gateId,
      guardId: guardUser.userId,
      guardName: guardUser.name,
      eventType: GATE_ACCESS_EVENT.CHECKED_IN,
      decisionCode: 'CHECKED_IN_ALLOWED',
      metadata: { remarks, entryCount: pass.entryCount }
    });

    await OutboxService.publish({
      eventType: 'gate-access.checked-in',
      aggregateType: 'GatePass',
      aggregateId: pass.publicId,
      payload: { publicId: pass.publicId, entryCount: pass.entryCount },
      destination: 'ALL'
    });

    return { pass, event };
  }

  /**
   * Check out / record departure at gate
   */
  static async checkOut(passId, { gateId = 'Main Gate', remarks }, guardUser) {
    const query = passId.startsWith('GP-') ? { publicId: passId } : { _id: passId };
    const pass = await GatePass.findOne(query);
    if (!pass) {
      throw ApiError.notFound('Gate pass not found');
    }

    const event = await GateAccessEvent.create({
      passId: pass._id,
      passPublicId: pass.publicId,
      propertyId: pass.propertyId,
      gateId,
      guardId: guardUser.userId,
      guardName: guardUser.name,
      eventType: GATE_ACCESS_EVENT.CHECKED_OUT,
      decisionCode: 'CHECKED_OUT',
      metadata: { remarks }
    });

    await OutboxService.publish({
      eventType: 'gate-access.checked-out',
      aggregateType: 'GatePass',
      aggregateId: pass.publicId,
      payload: { publicId: pass.publicId },
      destination: 'ALL'
    });

    return { event };
  }
}

module.exports = SecurityAccessService;

