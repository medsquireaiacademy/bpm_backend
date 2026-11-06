const express = require('express');
const router = express.Router();
const AuthController = require('../../controllers/auth.controller');
const validate = require('../../middleware/validate.middleware');
const authenticate = require('../../middleware/authenticate.middleware');
const createRateLimiter = require('../../middleware/rate-limit.middleware');
const asyncHandler = require('../../utils/async-handler');
const { loginSchema, refreshTokenSchema } = require('../../validators/auth.schemas');

const authLimiter = createRateLimiter({ windowMs: 15 * 60 * 1000, max: 20 });

router.post('/login', authLimiter, validate(loginSchema), asyncHandler(AuthController.login));
router.post('/refresh', authLimiter, validate(refreshTokenSchema), asyncHandler(AuthController.refresh));
router.post('/logout', authenticate, asyncHandler(AuthController.logout));
router.get('/me', authenticate, asyncHandler(AuthController.me));

module.exports = router;

