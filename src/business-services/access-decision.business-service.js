const { ROLES } = require('../config/constants');
const ApiError = require('../utils/ApiError');

class AccessDecisionBusinessService {
  /**
   * Asserts that a security guard cannot self-approve visitor access requests
   */
  static assertGuardCannotSelfApprove(user) {
    if (user.role === ROLES.SECURITY_GUARD) {
      throw ApiError.forbidden('Security guards cannot approve visitor access requests. Resident or admin approval required.');
    }
  }

  /**
   * Validates resident permission to decide on an access request
   */
  static assertResidentDecisionAuthorization(accessRequest, user) {
    if (user.role === ROLES.SYSTEM_CLIENT || user.role === ROLES.SECURITY_ADMIN || user.role === ROLES.AGENCY_ADMIN) {
      return;
    }

    if (user.role === ROLES.RESIDENT) {
      if (accessRequest.flatNumber && user.flatNumber && accessRequest.flatNumber !== user.flatNumber) {
        throw ApiError.forbidden('Residents can only approve or reject access requests for their own flat.');
      }
      return;
    }

    throw ApiError.forbidden('Only the resident of the destination flat or an authorized administrator can decide on this request.');
  }
}

module.exports = AccessDecisionBusinessService;

