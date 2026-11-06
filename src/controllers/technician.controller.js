const TechnicianService = require('../services/technician.service');
const { sendSuccess } = require('../utils/response');

class TechnicianController {
  static async listJobs(req, res) {
    const result = await TechnicianService.listJobs(req.user.userId, req.query, req.query);
    return sendSuccess(res, result.items, 200, { pagination: result.pagination });
  }

  static async getJobById(req, res) {
    const item = await TechnicianService.getAssignment(req.params.jobId, req.user);
    return sendSuccess(res, item, 200);
  }

  static async checkIn(req, res) {
    const item = await TechnicianService.checkIn(req.params.jobId, req.body, req.user);
    return sendSuccess(res, item, 200);
  }

  static async addNote(req, res) {
    const item = await TechnicianService.addNote(req.params.jobId, req.body.text, req.user);
    return sendSuccess(res, item, 201);
  }

  static async addAttachment(req, res) {
    const item = await TechnicianService.addAttachment(req.params.jobId, req.body, req.user);
    return sendSuccess(res, item, 201);
  }

  static async hold(req, res) {
    const item = await TechnicianService.hold(req.params.jobId, req.body, req.user);
    return sendSuccess(res, item, 200);
  }

  static async resume(req, res) {
    const item = await TechnicianService.resume(req.params.jobId, req.user);
    return sendSuccess(res, item, 200);
  }

  static async complete(req, res) {
    const item = await TechnicianService.complete(req.params.jobId, req.body, req.user);
    return sendSuccess(res, item, 200);
  }

  static async getGatePass(req, res) {
    const item = await TechnicianService.getGatePass(req.params.jobId, req.user);
    return sendSuccess(res, item, 200);
  }
}

module.exports = TechnicianController;

