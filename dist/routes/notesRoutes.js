"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const notesController_1 = require("../controllers/notesController");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
// Apply auth middleware to all note routes
router.use(auth_1.authenticateToken);
router.get('/', notesController_1.fetchNotes);
router.post('/', notesController_1.saveNote);
router.delete('/:id', notesController_1.deleteNote);
router.get('/search', notesController_1.searchNotes);
exports.default = router;
