const { SERVICE_REQUEST_STATUS, ROLES } = require('../config/constants');
const ApiError = require('../utils/ApiError');

class DispatchBusinessService {
  /**
   * Asserts that a service request is in an eligible state for dispatch
   */
  static assertDispatchEligibility(serviceRequest) {
    if (!serviceRequest) {
      throw ApiError.notFound('Service request not found');
    }

    if (serviceRequest.status === SERVICE_REQUEST_STATUS.PENDING_APPROVAL) {
      throw ApiError.conflict('Cannot dispatch service request: Pending required approval');
    }

    if ([SERVICE_REQUEST_STATUS.REJECTED, SERVICE_REQUEST_STATUS.CANCELLED, SERVICE_REQUEST_STATUS.CLOSED].includes(serviceRequest.status)) {
      throw ApiError.conflict(`Cannot dispatch service request in ${serviceRequest.status} state`);
    }
  }

  /**
   * Asserts that the actor is authorized to dispatch work
   */
  static assertCanDispatch(user) {
    const dispatchRoles = [ROLES.AGENCY_ADMIN, ROLES.AGENCY_SUPERVISOR, ROLES.SYSTEM_CLIENT];
    if (!dispatchRoles.includes(user.role)) {
      throw ApiError.forbidden(`Role '${user.role}' is not authorized to dispatch work orders`);
    }
  }

  /**
   * Validates technician assignment eligibility
   */
  static validateAssignments(assignments) {
    if (!Array.isArray(assignments) || assignments.length === 0) {
      throw ApiError.badRequest('Dispatch must include at least one technician assignment');
    }
    for (const asg of assignments) {
      if (!asg.technicianId || !asg.role) {
        throw ApiError.badRequest('Each assignment must specify technicianId and role');
      }
    }
  }
}

module.exports = DispatchBusinessService;

