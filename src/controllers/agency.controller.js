const ServiceRequestService = require('../services/service-request.service');
const WorkOrderService = require('../services/work-order.service');
const User = require('../models/User.model');
const { ROLES } = require('../config/constants');
const { sendSuccess } = require('../utils/response');

class AgencyController {
  static async getQueue(req, res) {
    const result = await ServiceRequestService.list(req.query, req.query);
    return sendSuccess(res, result.items, 200, { pagination: result.pagination });
  }

  static async getRequestDetails(req, res) {
    const item = await ServiceRequestService.getById(req.params.id);
    return sendSuccess(res, item, 200);
  }

  static async dispatch(req, res) {
    const result = await WorkOrderService.dispatch(req.params.id, req.body, req.user);
    return sendSuccess(res, result, 201);
  }

  static async listTechnicians(req, res) {
    const technicians = await User.find({ role: ROLES.TECHNICIAN, active: true })
      .select('userId name phone role skills propertyId')
      .lean();
    return sendSuccess(res, technicians, 200);
  }
}

module.exports = AgencyController;

