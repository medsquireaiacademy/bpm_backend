const test = require('node:test');
const assert = require('node:assert/strict');

const ApprovalPolicyBusinessService = require('../src/business-services/approval-policy.business-service');
const DispatchBusinessService = require('../src/business-services/dispatch.business-service');
const WorkOrderLifecycleBusinessService = require('../src/business-services/work-order-lifecycle.business-service');
const GatePassVerificationBusinessService = require('../src/business-services/gate-pass-verification.business-service');
const AccessDecisionBusinessService = require('../src/business-services/access-decision.business-service');
const { sha256 } = require('../src/utils/crypto');
const { SERVICE_REQUEST_STATUS, WORK_ORDER_STATUS, ASSIGNMENT_STATUS, GATE_PASS_STATUS, ROLES } = require('../src/config/constants');

test('ApprovalPolicyBusinessService: requiresApproval flag', () => {
  const res = ApprovalPolicyBusinessService.evaluateServiceRequestApproval({
    source: 'RWA',
    requiresApproval: true,
    priority: 'HIGH'
  });
  assert.equal(res.required, true);
  assert.equal(res.status, 'PENDING');
});

test('ApprovalPolicyBusinessService: common area urgent complaint requires approval', () => {
  const res = ApprovalPolicyBusinessService.evaluateServiceRequestApproval({
    source: 'RWA',
    complaintScope: 'Common Area',
    requiresApproval: false,
    priority: 'URGENT'
  });
  assert.equal(res.required, true);
});

test('ApprovalPolicyBusinessService: security guard arrival requires approval', () => {
  const res = ApprovalPolicyBusinessService.evaluateGatePassApproval({
    requestType: 'SECURITY_ARRIVAL',
    requestedByRole: ROLES.SECURITY_GUARD
  });
  assert.equal(res.required, true);
  assert.equal(res.status, 'PENDING');
});

test('DispatchBusinessService: rejects dispatch when request is pending approval', () => {
  const pendingSr = { status: SERVICE_REQUEST_STATUS.PENDING_APPROVAL };
  assert.throws(() => {
    DispatchBusinessService.assertDispatchEligibility(pendingSr);
  }, /Pending required approval/);
});

test('DispatchBusinessService: allows dispatch when approved or pending', () => {
  assert.doesNotThrow(() => {
    DispatchBusinessService.assertDispatchEligibility({ status: SERVICE_REQUEST_STATUS.APPROVED });
  });
  assert.doesNotThrow(() => {
    DispatchBusinessService.assertDispatchEligibility({ status: SERVICE_REQUEST_STATUS.PENDING });
  });
});

test('WorkOrderLifecycleBusinessService: computes aggregate status', () => {
  // If one is in progress
  const asg1 = [
    { status: ASSIGNMENT_STATUS.ASSIGNED },
    { status: ASSIGNMENT_STATUS.IN_PROGRESS }
  ];
  assert.equal(WorkOrderLifecycleBusinessService.computeAggregateStatus(asg1), WORK_ORDER_STATUS.IN_PROGRESS);

  // If all completed
  const asg2 = [
    { status: ASSIGNMENT_STATUS.COMPLETED },
    { status: ASSIGNMENT_STATUS.COMPLETED }
  ];
  assert.equal(WorkOrderLifecycleBusinessService.computeAggregateStatus(asg2), WORK_ORDER_STATUS.RESOLVED);

  // If on hold
  const asg3 = [
    { status: ASSIGNMENT_STATUS.ASSIGNED },
    { status: ASSIGNMENT_STATUS.ON_HOLD }
  ];
  assert.equal(WorkOrderLifecycleBusinessService.computeAggregateStatus(asg3), WORK_ORDER_STATUS.ON_HOLD);
});

test('GatePassVerificationBusinessService: verifies valid pass with token and OTP', () => {
  const token = 'SECRET_TOKEN_XYZ';
  const otp = '9999';
  const pass = {
    status: GATE_PASS_STATUS.ACTIVE,
    validFrom: new Date(Date.now() - 1000),
    validUntil: new Date(Date.now() + 60000),
    tokenHash: sha256(token),
    otpHash: sha256(otp),
    usagePolicy: 'SINGLE_ENTRY',
    maxEntries: 1,
    entryCount: 0
  };

  const tokenRes = GatePassVerificationBusinessService.verifyPass(pass, { token });
  assert.equal(tokenRes.allowed, true);
  assert.equal(tokenRes.code, 'ALLOW');

  const otpRes = GatePassVerificationBusinessService.verifyPass(pass, { otp });
  assert.equal(otpRes.allowed, true);
  assert.equal(otpRes.code, 'ALLOW');
});

test('GatePassVerificationBusinessService: rejects expired or already used pass', () => {
  const expiredPass = {
    status: GATE_PASS_STATUS.ACTIVE,
    validFrom: new Date(Date.now() - 60000),
    validUntil: new Date(Date.now() - 1000)
  };
  assert.equal(GatePassVerificationBusinessService.verifyPass(expiredPass).allowed, false);

  const usedPass = {
    status: GATE_PASS_STATUS.USED
  };
  assert.equal(GatePassVerificationBusinessService.verifyPass(usedPass).allowed, false);
});

test('AccessDecisionBusinessService: guard cannot self-approve', () => {
  assert.throws(() => {
    AccessDecisionBusinessService.assertGuardCannotSelfApprove({ role: ROLES.SECURITY_GUARD });
  }, /cannot approve/);
});

