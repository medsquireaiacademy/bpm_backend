const WorkOrderService = require('../services/work-order.service');
const { sendSuccess } = require('../utils/response');

class WorkOrderController {
  static async list(req, res) {
    const result = await WorkOrderService.list(req.query, req.query);
    return sendSuccess(res, result.items, 200, { pagination: result.pagination });
  }

  static async getById(req, res) {
    const item = await WorkOrderService.getById(req.params.id);
    return sendSuccess(res, item, 200);
  }

  static async addAssignment(req, res) {
    const item = await WorkOrderService.addAssignment(req.params.id, req.body, req.user);
    return sendSuccess(res, item, 201);
  }
}

module.exports = WorkOrderController;

