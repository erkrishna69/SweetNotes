"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.searchNotes = exports.deleteNote = exports.saveNote = exports.fetchNotes = void 0;
const Note_1 = require("../models/Note");
const Team_1 = require("../models/Team");
const User_1 = require("../models/User");
const teamController_1 = require("./teamController");
// Helper to verify user can write/edit note (either owner of note or has write permission in team)
const verifyWritePermission = async (userId, teamId, existingNoteOwnerId) => {
    if (!teamId) {
        // If personal note, user must own it
        return !existingNoteOwnerId || existingNoteOwnerId.toString() === userId;
    }
    const team = await Team_1.Team.findById(teamId);
    if (!team)
        return false;
    const isOwner = team.ownerId.toString() === userId;
    if (isOwner)
        return true;
    const member = team.members.find((m) => m.userId.toString() === userId);
    if (!member)
        return false;
    return member.canWriteNotes;
};
// Helper to verify user can delete note (either owner of note or has delete permission in team)
const verifyDeletePermission = async (userId, teamId, existingNoteOwnerId) => {
    if (!teamId) {
        // If personal note, user must own it
        return !existingNoteOwnerId || existingNoteOwnerId.toString() === userId;
    }
    const team = await Team_1.Team.findById(teamId);
    if (!team)
        return false;
    const isOwner = team.ownerId.toString() === userId;
    if (isOwner)
        return true;
    const member = team.members.find((m) => m.userId.toString() === userId);
    if (!member)
        return false;
    return member.canDeleteNotes;
};
const fetchNotes = async (req, res) => {
    try {
        const userId = req.user?.userId;
        // Find all teams where user is a member
        const userTeams = await Team_1.Team.find({ 'members.userId': userId });
        const teamIds = userTeams.map((t) => t._id);
        // Get all notes: personal notes OR team notes (which are either shared with everyone, creator, or shared with this user)
        const notes = await Note_1.Note.find({
            isDeleted: false,
            $or: [
                { userId, teamId: null },
                {
                    teamId: { $in: teamIds },
                    $or: [
                        { sharedWith: { $exists: true, $size: 0 } },
                        { sharedWith: null },
                        { sharedWith: userId },
                        { userId: userId }
                    ]
                }
            ]
        }).sort({ clientUpdatedAt: -1 });
        return res.status(200).json(notes);
    }
    catch (error) {
        console.error('Fetch notes error:', error);
        return res.status(500).json({ message: 'Internal server error' });
    }
};
exports.fetchNotes = fetchNotes;
const saveNote = async (req, res) => {
    try {
        const userId = req.user?.userId;
        const { id, title, content, clientUpdatedAt, isDeleted, isPinned, teamId, folder, sharedWith } = req.body;
        if (!id) {
            return res.status(400).json({ message: 'Note ID is required' });
        }
        const clientDate = clientUpdatedAt ? new Date(clientUpdatedAt) : new Date();
        // Check if the note already exists
        const existingNote = await Note_1.Note.findById(id);
        const user = await User_1.User.findById(userId);
        const username = user ? user.username : 'User';
        if (existingNote) {
            const isTitleOrContentOrMetaChanged = (title !== undefined && title !== existingNote.title) ||
                (content !== undefined && content !== existingNote.content) ||
                (folder !== undefined && folder !== existingNote.folder) ||
                (sharedWith !== undefined && JSON.stringify(sharedWith) !== JSON.stringify(existingNote.sharedWith)) ||
                (isPinned !== undefined && isPinned !== existingNote.isPinned) ||
                (teamId !== undefined && teamId !== (existingNote.teamId?.toString() || null));
            const deleteStatusChanged = isDeleted !== undefined && isDeleted !== existingNote.isDeleted;
            if (isTitleOrContentOrMetaChanged) {
                const hasPerm = await verifyWritePermission(userId, existingNote.teamId?.toString(), existingNote.userId.toString());
                if (!hasPerm) {
                    return res.status(403).json({ message: 'Access denied. You do not have permission to edit this note.' });
                }
            }
            if (deleteStatusChanged && isDeleted === true) {
                const hasPerm = await verifyDeletePermission(userId, existingNote.teamId?.toString(), existingNote.userId.toString());
                if (!hasPerm) {
                    return res.status(403).json({ message: 'Access denied. You do not have permission to delete this note.' });
                }
            }
            // Conflict Resolution: Last-Write-Wins based on clientUpdatedAt
            if (clientDate > existingNote.clientUpdatedAt) {
                const titleChanged = title !== undefined && title !== existingNote.title;
                const contentChanged = content !== undefined && content !== existingNote.content;
                const oldTeamId = existingNote.teamId;
                existingNote.teamId = teamId !== undefined ? (teamId || null) : existingNote.teamId;
                existingNote.folder = folder !== undefined ? (folder || null) : existingNote.folder;
                existingNote.sharedWith = sharedWith !== undefined ? sharedWith : existingNote.sharedWith;
                existingNote.title = title !== undefined ? title : existingNote.title;
                existingNote.content = content !== undefined ? content : existingNote.content;
                existingNote.isDeleted = isDeleted !== undefined ? isDeleted : existingNote.isDeleted;
                existingNote.isPinned = isPinned !== undefined ? isPinned : existingNote.isPinned;
                existingNote.clientUpdatedAt = clientDate;
                await existingNote.save();
                // Audit Logging
                if (existingNote.teamId) {
                    if (!oldTeamId) {
                        // Note was just shared with the team
                        await (0, teamController_1.logAuditEvent)(existingNote.teamId.toString(), userId, 'NOTE_SHARED', `${username} shared note "${existingNote.title || 'Untitled'}" with the team.`);
                    }
                    else if (deleteStatusChanged && isDeleted) {
                        await (0, teamController_1.logAuditEvent)(existingNote.teamId.toString(), userId, 'NOTE_DELETED', `${username} deleted note "${existingNote.title || 'Untitled'}".`);
                    }
                    else if (titleChanged || contentChanged) {
                        await (0, teamController_1.logAuditEvent)(existingNote.teamId.toString(), userId, 'NOTE_UPDATED', `${username} updated note "${existingNote.title || 'Untitled'}".`);
                    }
                }
            }
            return res.status(200).json(existingNote);
        }
        else {
            // Verify permissions for new note in team
            const hasPerm = await verifyWritePermission(userId, teamId);
            if (!hasPerm) {
                return res.status(403).json({ message: 'Access denied. You do not have permission to create notes in this team.' });
            }
            // Create new note
            const newNote = new Note_1.Note({
                _id: id,
                userId,
                teamId: teamId || null,
                folder: folder || null,
                sharedWith: sharedWith || [],
                title: title || '',
                content: content || '',
                isDeleted: isDeleted || false,
                isPinned: isPinned || false,
                clientUpdatedAt: clientDate,
            });
            await newNote.save();
            // Audit Logging
            if (teamId) {
                await (0, teamController_1.logAuditEvent)(teamId, userId, 'NOTE_CREATED', `${username} created note "${title || 'Untitled'}".`);
            }
            return res.status(201).json(newNote);
        }
    }
    catch (error) {
        console.error('Save note error:', error);
        return res.status(500).json({ message: 'Internal server error' });
    }
};
exports.saveNote = saveNote;
const deleteNote = async (req, res) => {
    try {
        const userId = req.user?.userId;
        const { id } = req.params;
        const note = await Note_1.Note.findById(id);
        if (!note) {
            return res.status(404).json({ message: 'Note not found' });
        }
        // Verify delete permission
        const hasPerm = await verifyDeletePermission(userId, note.teamId?.toString(), note.userId.toString());
        if (!hasPerm) {
            return res.status(403).json({ message: 'Access denied. You do not have permission to delete this note.' });
        }
        // Soft delete
        note.isDeleted = true;
        note.clientUpdatedAt = new Date();
        await note.save();
        const user = await User_1.User.findById(userId);
        const username = user ? user.username : 'User';
        // Audit Logging
        if (note.teamId) {
            await (0, teamController_1.logAuditEvent)(note.teamId.toString(), userId, 'NOTE_DELETED', `${username} deleted note "${note.title || 'Untitled'}".`);
        }
        return res.status(200).json({ message: 'Note soft-deleted successfully', note });
    }
    catch (error) {
        console.error('Delete note error:', error);
        return res.status(500).json({ message: 'Internal server error' });
    }
};
exports.deleteNote = deleteNote;
const searchNotes = async (req, res) => {
    try {
        const userId = req.user?.userId;
        const { q } = req.query;
        if (!q || typeof q !== 'string') {
            return res.status(400).json({ message: 'Search query is required' });
        }
        const userTeams = await Team_1.Team.find({ 'members.userId': userId });
        const teamIds = userTeams.map((t) => t._id);
        // Try text index search first, fall back to regex for partial matching
        let notes = await Note_1.Note.find({
            isDeleted: false,
            $or: [
                { userId, teamId: null },
                {
                    teamId: { $in: teamIds },
                    $or: [
                        { sharedWith: { $exists: true, $size: 0 } },
                        { sharedWith: null },
                        { sharedWith: userId },
                        { userId: userId }
                    ]
                }
            ],
            $text: { $search: q },
        });
        if (notes.length === 0) {
            notes = await Note_1.Note.find({
                isDeleted: false,
                $and: [
                    {
                        $or: [
                            { userId, teamId: null },
                            {
                                teamId: { $in: teamIds },
                                $or: [
                                    { sharedWith: { $exists: true, $size: 0 } },
                                    { sharedWith: null },
                                    { sharedWith: userId },
                                    { userId: userId }
                                ]
                            }
                        ]
                    },
                    {
                        $or: [
                            { title: { $regex: q, $options: 'i' } },
                            { content: { $regex: q, $options: 'i' } }
                        ]
                    }
                ]
            });
        }
        return res.status(200).json(notes);
    }
    catch (error) {
        console.error('Search notes error:', error);
        return res.status(500).json({ message: 'Internal server error' });
    }
};
exports.searchNotes = searchNotes;
