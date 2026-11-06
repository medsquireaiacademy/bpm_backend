const GatePassService = require('../services/gate-pass.service');
const GatePassRequest = require('../models/GatePassRequest.model');
const { sendSuccess } = require('../utils/response');
const { getPaginationParams, buildPaginationMeta } = require('../utils/pagination');

class GatePassController {
  static async createRequest(req, res) {
    const result = await GatePassService.createRequest(req.body, req.user);
    return sendSuccess(res, result, 201);
  }

  static async listRequests(req, res) {
    const { page, limit, skip } = getPaginationParams(req.query);
    const filter = {};
    if (req.query.status) filter.status = req.query.status;
    if (req.query.propertyId) filter.propertyId = req.query.propertyId;

    const [items, total] = await Promise.all([
      GatePassRequest.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('issuedPassId')
        .lean(),
      GatePassRequest.countDocuments(filter)
    ]);

    return sendSuccess(res, items, 200, { pagination: buildPaginationMeta(total, page, limit) });
  }

  static async getRequestById(req, res) {
    const query = req.params.id.startsWith('GPR-') ? { publicId: req.params.id } : { _id: req.params.id };
    const item = await GatePassRequest.findOne(query).populate('issuedPassId');
    return sendSuccess(res, item, 200);
  }

  static async approveRequest(req, res) {
    const result = await GatePassService.approveRequest(req.params.id, req.user);
    return sendSuccess(res, result, 200);
  }

  static async rejectRequest(req, res) {
    const result = await GatePassService.rejectRequest(req.params.id, req.body.reason, req.user);
    return sendSuccess(res, result, 200);
  }

  static async listPasses(req, res) {
    const result = await GatePassService.list(req.query, req.query);
    return sendSuccess(res, result.items, 200, { pagination: result.pagination });
  }

  static async getPassById(req, res) {
    const item = await GatePassService.getById(req.params.id);
    return sendSuccess(res, item, 200);
  }

  static async revokePass(req, res) {
    const item = await GatePassService.revokePass(req.params.id, req.body.reason, req.user);
    return sendSuccess(res, item, 200);
  }
}

module.exports = GatePassController;

