const { GATE_PASS_STATUS } = require('../config/constants');
const { sha256 } = require('../utils/crypto');

class GatePassVerificationBusinessService {
  /**
   * Verifies pass validity and returns { allowed: boolean, code: string, message: string }
   */
  static verifyPass(pass, { token, otp, propertyId } = {}) {
    if (!pass) {
      return { allowed: false, code: 'PASS_NOT_FOUND', message: 'Gate pass was not found.' };
    }

    if (pass.status === GATE_PASS_STATUS.REVOKED) {
      return { allowed: false, code: 'PASS_REVOKED', message: `Gate pass was revoked: ${pass.revokeReason || 'No reason provided'}` };
    }

    if (pass.status === GATE_PASS_STATUS.EXPIRED) {
      return { allowed: false, code: 'PASS_EXPIRED', message: 'Gate pass has expired.' };
    }

    if (pass.status === GATE_PASS_STATUS.USED) {
      return { allowed: false, code: 'PASS_ALREADY_USED', message: 'Single-entry gate pass has already been used.' };
    }

    const now = new Date();
    if (now > pass.validUntil) {
      return { allowed: false, code: 'PASS_EXPIRED', message: 'Gate pass validity window has lapsed.' };
    }

    if (now < pass.validFrom) {
      return { allowed: false, code: 'PASS_NOT_YET_VALID', message: 'Gate pass is not valid yet.' };
    }

    // Property check if specified
    if (propertyId && pass.propertyId !== propertyId) {
      return { allowed: false, code: 'PROPERTY_MISMATCH', message: 'Pass does not belong to this property.' };
    }

    // Token verification
    if (token) {
      const hashedToken = sha256(token);
      if (hashedToken !== pass.tokenHash) {
        return { allowed: false, code: 'INVALID_TOKEN', message: 'Presented QR token is invalid.' };
      }
    } else if (otp) {
      const hashedOtp = sha256(otp);
      if (hashedOtp !== pass.otpHash) {
        return { allowed: false, code: 'INVALID_OTP', message: 'Presented entry OTP is incorrect.' };
      }
    }

    // Entry count check
    if (pass.usagePolicy === 'SINGLE_ENTRY' && pass.entryCount >= pass.maxEntries) {
      return { allowed: false, code: 'ENTRY_LIMIT_EXCEEDED', message: 'Maximum entries allowed for this pass reached.' };
    }

    return { allowed: true, code: 'ALLOW', message: 'Gate pass is valid.' };
  }
}

module.exports = GatePassVerificationBusinessService;

