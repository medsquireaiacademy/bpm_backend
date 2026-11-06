const { SERVICE_REQUEST_STATUS, ROLES } = require('../config/constants');
const ApiError = require('../utils/ApiError');

class ApprovalPolicyBusinessService {
  /**
   * Evaluates if a service request requires explicit RWA/Admin approval
   */
  static evaluateServiceRequestApproval({ source, complaintScope, requiresApproval, priority }) {
    if (requiresApproval === true) {
      return { required: true, status: 'PENDING' };
    }
    // Common area complaints or urgent infrastructure usually require approval if specified
    if (source === 'RWA' && complaintScope === 'Common Area' && priority === 'URGENT') {
      return { required: true, status: 'PENDING' };
    }
    return { required: false, status: 'NOT_REQUIRED' };
  }

  /**
   * Asserts that the actor is authorized to approve/reject an RWA complaint
   */
  static assertCanApproveServiceRequest(user) {
    const approverRoles = [ROLES.RWA_PRESIDENT, ROLES.RWA_VICE_PRESIDENT, ROLES.AGENCY_ADMIN, ROLES.SYSTEM_CLIENT];
    if (!approverRoles.includes(user.role)) {
      throw ApiError.forbidden(`Role '${user.role}' is not authorized to approve or reject service requests`);
    }
  }

  /**
   * Evaluates if a gate pass request requires resident or security approval
   */
  static evaluateGatePassApproval({ requestType, requestedByRole }) {
    // If security guard registers a visitor arrival at the gate, resident approval is required
    if (requestType === 'SECURITY_ARRIVAL' || requestedByRole === ROLES.SECURITY_GUARD) {
      return { required: true, status: 'PENDING' };
    }
    // Resident-created guest or delivery passes are pre-approved by the resident
    if (requestedByRole === ROLES.RESIDENT) {
      return { required: false, status: 'NOT_REQUIRED' };
    }
    return { required: false, status: 'NOT_REQUIRED' };
  }
}

module.exports = ApprovalPolicyBusinessService;

