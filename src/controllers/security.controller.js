const SecurityAccessService = require('../services/security-access.service');
const { sendSuccess } = require('../utils/response');

class SecurityController {
  static async registerArrival(req, res) {
    const result = await SecurityAccessService.registerVisitorArrival(req.body, req.user);
    return sendSuccess(res, result, 201);
  }

  static async recordResidentDecision(req, res) {
    const result = await SecurityAccessService.recordResidentDecision(req.params.id, req.body, req.user);
    return sendSuccess(res, result, 200);
  }

  static async verifyPass(req, res) {
    const result = await SecurityAccessService.verifyPass(req.body, req.user);
    return sendSuccess(res, result, 200);
  }

  static async checkIn(req, res) {
    const result = await SecurityAccessService.checkIn(req.params.id, req.body, req.user);
    return sendSuccess(res, result, 200);
  }

  static async checkOut(req, res) {
    const result = await SecurityAccessService.checkOut(req.params.id, req.body, req.user);
    return sendSuccess(res, result, 200);
  }
}

module.exports = SecurityController;

