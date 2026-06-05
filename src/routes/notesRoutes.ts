import { Router } from 'express';
import { fetchNotes, saveNote, deleteNote, searchNotes } from '../controllers/notesController';
import { authenticateToken } from '../middleware/auth';

const router = Router();

// Apply auth middleware to all note routes
router.use(authenticateToken as any);

router.get('/', fetchNotes as any);
router.post('/', saveNote as any);
router.delete('/:id', deleteNote as any);
router.get('/search', searchNotes as any);

export default router;
