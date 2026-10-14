import { Router } from 'express';
import {
  register,
  login,
  logout,
  refresh,
  getMe,
  forgotPassword,
  resetPassword,
  verifyEmail,
  resendVerificationEmail,
  instantVerify,
} from '../controllers/authController.js';
import { requireAuth } from '../middleware/auth.js';
import { validateRequest } from '../middleware/validate.js';
import { authLimiter } from '../middleware/rateLimiter.js';
import {
  registerSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} from '../schemas/authSchemas.js';

const router = Router();

router.post('/register', authLimiter, validateRequest({ body: registerSchema }), register);
router.post('/login', authLimiter, validateRequest({ body: loginSchema }), login);
router.post('/logout', logout);
router.post('/refresh', refresh);
router.get('/me', requireAuth, getMe);
router.post('/verify-email', authLimiter, verifyEmail);
router.post('/instant-verify', instantVerify);
router.post('/resend-verification', authLimiter, resendVerificationEmail);
router.post(
  '/forgot-password',
  authLimiter,
  validateRequest({ body: forgotPasswordSchema }),
  forgotPassword
);
router.post(
  '/reset-password',
  authLimiter,
  validateRequest({ body: resetPasswordSchema }),
  resetPassword
);

export default router;
