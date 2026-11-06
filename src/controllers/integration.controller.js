const ServiceRequestService = require('../services/service-request.service');
const GatePassService = require('../services/gate-pass.service');
const SecurityAccessService = require('../services/security-access.service');
const { SOURCES } = require('../config/constants');
const { sendSuccess } = require('../utils/response');

class IntegrationController {
  static async createResidenceServiceRequest(req, res) {
    const sr = await ServiceRequestService.createFromResidence(req.body, req.user || {});
    return sendSuccess(
      res,
      {
        serviceRequestId: sr.publicId,
        sourceApplication: sr.source.application,
        sourceRequestId: sr.source.sourceRequestId,
        status: sr.status,
        createdAt: sr.createdAt
      },
      201
    );
  }

  static async getResidenceServiceRequest(req, res) {
    const sr = await ServiceRequestService.getBySourceId(SOURCES.RESIDENCE, req.params.sourceRequestId);
    return sendSuccess(res, sr, 200);
  }

  static async createRwaComplaint(req, res) {
    const sr = await ServiceRequestService.createFromRwa(req.body, req.user || {});
    return sendSuccess(
      res,
      {
        serviceRequestId: sr.publicId,
        sourceApplication: sr.source.application,
        sourceRequestId: sr.source.sourceRequestId,
        status: sr.status,
        requiresApproval: sr.approval?.required || false,
        createdAt: sr.createdAt
      },
      201
    );
  }

  static async getRwaComplaint(req, res) {
    const sr = await ServiceRequestService.getBySourceId(SOURCES.RWA, req.params.sourceRequestId);
    return sendSuccess(res, sr, 200);
  }

  static async createResidenceGatePass(req, res) {
    const result = await GatePassService.createRequest(
      { ...req.body, sourceApplication: SOURCES.RESIDENCE },
      req.user || { userId: 'residence-client', role: 'RESIDENT' }
    );
    return sendSuccess(res, result, 201);
  }

  static async createSecurityArrival(req, res) {
    const result = await SecurityAccessService.registerVisitorArrival(
      req.body,
      req.user || { userId: 'guard-gate-1', role: 'SECURITY_GUARD' }
    );
    return sendSuccess(res, result, 201);
  }
}

module.exports = IntegrationController;

