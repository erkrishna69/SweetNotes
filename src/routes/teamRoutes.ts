import { Router } from 'express';
import { authenticateToken } from '../middleware/auth';
import {
  createTeam,
  getTeams,
  getTeamDetails,
  joinTeam,
  leaveTeam,
  updateMemberPermission,
  getTeamLogs,
  kickMember,
  banMember,
  deleteTeam,
} from '../controllers/teamController';

const router = Router();

// Apply auth middleware to all team routes
router.use(authenticateToken as any);

router.post('/', createTeam as any);
router.get('/', getTeams as any);
router.post('/join', joinTeam as any);

router.get('/:id', getTeamDetails as any);
router.post('/:id/leave', leaveTeam as any);
router.post('/:id/delete', deleteTeam as any);
router.patch('/:id/members/:memberUserId', updateMemberPermission as any);
router.post('/:id/kick/:memberUserId', kickMember as any);
router.post('/:id/ban/:memberUserId', banMember as any);
router.get('/:id/logs', getTeamLogs as any);

export default router;
