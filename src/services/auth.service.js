const jwt = require('jsonwebtoken');
const User = require('../models/User.model');
const { JWT_SECRET, JWT_EXPIRES_IN, JWT_REFRESH_SECRET, JWT_REFRESH_EXPIRES_IN } = require('../config/env');
const { comparePassword } = require('../utils/crypto');
const ApiError = require('../utils/ApiError');
const AuditService = require('./audit.service');

class AuthService {
  /**
   * Authenticate user with email and password
   */
  static async login(email, password) {
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user || !user.active) {
      throw ApiError.unauthorized('Invalid email or password', 'INVALID_CREDENTIALS');
    }

    const isValid = await comparePassword(password, user.passwordHash);
    if (!isValid) {
      throw ApiError.unauthorized('Invalid email or password', 'INVALID_CREDENTIALS');
    }

    const tokenPayload = {
      userId: user.userId,
      email: user.email,
      name: user.name,
      role: user.role,
      propertyId: user.propertyId,
      householdId: user.householdId,
      flatNumber: user.flatNumber
    };

    const accessToken = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
    const refreshToken = jwt.sign({ userId: user.userId }, JWT_REFRESH_SECRET, { expiresIn: JWT_REFRESH_EXPIRES_IN });

    await AuditService.log({
      aggregateType: 'User',
      aggregateId: user.userId,
      actorId: user.userId,
      action: 'LOGIN',
      metadata: { role: user.role }
    });

    return {
      accessToken,
      refreshToken,
      user: {
        userId: user.userId,
        email: user.email,
        name: user.name,
        role: user.role,
        propertyId: user.propertyId,
        householdId: user.householdId,
        apartmentName: user.apartmentName,
        flatNumber: user.flatNumber,
        skills: user.skills
      }
    };
  }

  /**
   * Refresh an access token
   */
  static async refreshAccessToken(refreshToken) {
    try {
      const decoded = jwt.verify(refreshToken, JWT_REFRESH_SECRET);
      const user = await User.findOne({ userId: decoded.userId, active: true });
      if (!user) {
        throw ApiError.unauthorized('User no longer exists or is inactive', 'USER_NOT_FOUND');
      }

      const tokenPayload = {
        userId: user.userId,
        email: user.email,
        name: user.name,
        role: user.role,
        propertyId: user.propertyId,
        householdId: user.householdId,
        flatNumber: user.flatNumber
      };

      const accessToken = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
      return { accessToken };
    } catch (err) {
      throw ApiError.unauthorized('Invalid or expired refresh token', 'INVALID_REFRESH_TOKEN');
    }
  }

  /**
   * Get user profile by userId
   */
  static async getProfile(userId) {
    const user = await User.findOne({ userId }).lean();
    if (!user) {
      throw ApiError.notFound('User not found');
    }
    delete user.passwordHash;
    return user;
  }
}

module.exports = AuthService;

