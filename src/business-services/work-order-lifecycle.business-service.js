const { SERVICE_REQUEST_STATUS, WORK_ORDER_STATUS, ASSIGNMENT_STATUS } = require('../config/constants');
const ApiError = require('../utils/ApiError');

class WorkOrderLifecycleBusinessService {
  /**
   * Determine the aggregate work order status based on all its assignments
   */
  static computeAggregateStatus(assignments) {
    if (!assignments || assignments.length === 0) {
      return WORK_ORDER_STATUS.OPEN;
    }

    const statuses = assignments.map((a) => a.status);

    const allCompleted = statuses.every((s) => s === ASSIGNMENT_STATUS.COMPLETED);
    if (allCompleted) {
      return WORK_ORDER_STATUS.RESOLVED;
    }

    const anyInProgress = statuses.some((s) => s === ASSIGNMENT_STATUS.IN_PROGRESS);
    if (anyInProgress) {
      return WORK_ORDER_STATUS.IN_PROGRESS;
    }

    const anyOnHold = statuses.some((s) => s === ASSIGNMENT_STATUS.ON_HOLD);
    if (anyOnHold) {
      return WORK_ORDER_STATUS.ON_HOLD;
    }

    const anyAssigned = statuses.some((s) => s === ASSIGNMENT_STATUS.ASSIGNED);
    if (anyAssigned) {
      return WORK_ORDER_STATUS.ASSIGNED;
    }

    return WORK_ORDER_STATUS.OPEN;
  }

  /**
   * Asserts valid assignment status transition
   */
  static assertValidAssignmentTransition(currentStatus, nextStatus) {
    const validTransitions = {
      [ASSIGNMENT_STATUS.ASSIGNED]: [ASSIGNMENT_STATUS.IN_PROGRESS, ASSIGNMENT_STATUS.CANCELLED],
      [ASSIGNMENT_STATUS.IN_PROGRESS]: [ASSIGNMENT_STATUS.ON_HOLD, ASSIGNMENT_STATUS.COMPLETED, ASSIGNMENT_STATUS.CANCELLED],
      [ASSIGNMENT_STATUS.ON_HOLD]: [ASSIGNMENT_STATUS.IN_PROGRESS, ASSIGNMENT_STATUS.CANCELLED],
      [ASSIGNMENT_STATUS.COMPLETED]: [],
      [ASSIGNMENT_STATUS.CANCELLED]: []
    };

    const allowed = validTransitions[currentStatus] || [];
    if (!allowed.includes(nextStatus)) {
      throw ApiError.conflict(`Invalid status transition from ${currentStatus} to ${nextStatus}`);
    }
  }

  /**
   * Asserts valid service request status transition
   */
  static assertValidServiceRequestTransition(currentStatus, nextStatus) {
    const validTransitions = {
      [SERVICE_REQUEST_STATUS.PENDING]: [SERVICE_REQUEST_STATUS.PENDING_APPROVAL, SERVICE_REQUEST_STATUS.APPROVED, SERVICE_REQUEST_STATUS.ASSIGNED, SERVICE_REQUEST_STATUS.REJECTED, SERVICE_REQUEST_STATUS.CANCELLED],
      [SERVICE_REQUEST_STATUS.PENDING_APPROVAL]: [SERVICE_REQUEST_STATUS.APPROVED, SERVICE_REQUEST_STATUS.REJECTED, SERVICE_REQUEST_STATUS.CANCELLED],
      [SERVICE_REQUEST_STATUS.APPROVED]: [SERVICE_REQUEST_STATUS.ASSIGNED, SERVICE_REQUEST_STATUS.CANCELLED],
      [SERVICE_REQUEST_STATUS.ASSIGNED]: [SERVICE_REQUEST_STATUS.IN_PROGRESS, SERVICE_REQUEST_STATUS.RESOLVED, SERVICE_REQUEST_STATUS.CANCELLED],
      [SERVICE_REQUEST_STATUS.IN_PROGRESS]: [SERVICE_REQUEST_STATUS.ON_HOLD, SERVICE_REQUEST_STATUS.RESOLVED, SERVICE_REQUEST_STATUS.CANCELLED],
      [SERVICE_REQUEST_STATUS.ON_HOLD]: [SERVICE_REQUEST_STATUS.IN_PROGRESS, SERVICE_REQUEST_STATUS.CANCELLED],
      [SERVICE_REQUEST_STATUS.RESOLVED]: [SERVICE_REQUEST_STATUS.CLOSED],
      [SERVICE_REQUEST_STATUS.CLOSED]: [],
      [SERVICE_REQUEST_STATUS.REJECTED]: [],
      [SERVICE_REQUEST_STATUS.CANCELLED]: []
    };

    const allowed = validTransitions[currentStatus] || [];
    if (!allowed.includes(nextStatus)) {
      throw ApiError.conflict(`Invalid service request transition from ${currentStatus} to ${nextStatus}`);
    }
  }
}

module.exports = WorkOrderLifecycleBusinessService;

