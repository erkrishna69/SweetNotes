import { Router } from 'express';
import { mergeNotes } from '../controllers/syncController';
import { authenticateToken } from '../middleware/auth';
import { syncLimiter } from '../middleware/rateLimiter';

const router = Router();

router.post('/merge', authenticateToken as any, syncLimiter, mergeNotes as any);

export default router;
