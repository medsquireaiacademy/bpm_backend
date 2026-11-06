const ServiceRequestService = require('../services/service-request.service');
const { sendSuccess } = require('../utils/response');

class ServiceRequestController {
  static async list(req, res) {
    const result = await ServiceRequestService.list(req.query, req.query);
    return sendSuccess(res, result.items, 200, { pagination: result.pagination });
  }

  static async getById(req, res) {
    const item = await ServiceRequestService.getById(req.params.id);
    return sendSuccess(res, item, 200);
  }

  static async approve(req, res) {
    const item = await ServiceRequestService.approve(req.params.id, req.body.reason, req.user);
    return sendSuccess(res, item, 200);
  }

  static async reject(req, res) {
    const item = await ServiceRequestService.reject(req.params.id, req.body.reason, req.user);
    return sendSuccess(res, item, 200);
  }

  static async hold(req, res) {
    const item = await ServiceRequestService.hold(req.params.id, req.body.reason, req.user);
    return sendSuccess(res, item, 200);
  }

  static async resume(req, res) {
    const item = await ServiceRequestService.resume(req.params.id, req.user);
    return sendSuccess(res, item, 200);
  }

  static async resolve(req, res) {
    const item = await ServiceRequestService.resolve(req.params.id, req.user);
    return sendSuccess(res, item, 200);
  }

  static async close(req, res) {
    const item = await ServiceRequestService.close(req.params.id, req.user);
    return sendSuccess(res, item, 200);
  }
}

module.exports = ServiceRequestController;

