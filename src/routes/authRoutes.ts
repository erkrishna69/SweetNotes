import { Router } from 'express';
import { register, login, getProfile, forgotPassword, renderResetPassword, resetPassword } from '../controllers/authController';
import { authenticateToken } from '../middleware/auth';
import { authLimiter, passwordResetLimiter } from '../middleware/rateLimiter';

const router = Router();

router.post('/register', authLimiter, register);
router.post('/login', authLimiter, login);
router.get('/profile', authenticateToken as any, getProfile as any);
router.post('/forgot-password', passwordResetLimiter, forgotPassword);
router.get('/reset-password', passwordResetLimiter, renderResetPassword);
router.post('/reset-password', passwordResetLimiter, resetPassword);

export default router;
