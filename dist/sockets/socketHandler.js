"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.setupSocketHandlers = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const Note_1 = require("../models/Note");
const Device_1 = require("../models/Device");
const Team_1 = require("../models/Team");
const User_1 = require("../models/User");
const teamController_1 = require("../controllers/teamController");
const JWT_SECRET = process.env.JWT_SECRET || 'sweetnotes_jwt_secret_key';
const verifySocketWritePermission = async (userId, teamId, existingNoteOwnerId) => {
    if (!teamId) {
        return !existingNoteOwnerId || existingNoteOwnerId.toString() === userId;
    }
    const team = await Team_1.Team.findById(teamId);
    if (!team)
        return false;
    if (team.ownerId.toString() === userId)
        return true;
    const member = team.members.find((m) => m.userId.toString() === userId);
    if (!member)
        return false;
    return member.canWriteNotes;
};
const verifySocketDeletePermission = async (userId, teamId, existingNoteOwnerId) => {
    if (!teamId) {
        return !existingNoteOwnerId || existingNoteOwnerId.toString() === userId;
    }
    const team = await Team_1.Team.findById(teamId);
    if (!team)
        return false;
    if (team.ownerId.toString() === userId)
        return true;
    const member = team.members.find((m) => m.userId.toString() === userId);
    if (!member)
        return false;
    return member.canDeleteNotes;
};
const setupSocketHandlers = (io) => {
    // Authentication middleware for Socket.IO
    io.use((socket, next) => {
        const token = socket.handshake.auth?.token || socket.handshake.query?.token;
        if (!token) {
            return next(new Error('Authentication error: Token required'));
        }
        try {
            const decoded = jsonwebtoken_1.default.verify(token, JWT_SECRET);
            socket.data.userId = decoded.userId;
            socket.data.email = decoded.email;
            next();
        }
        catch (err) {
            return next(new Error('Authentication error: Invalid token'));
        }
    });
    io.on('connection', async (socket) => {
        const userId = socket.data.userId;
        const deviceName = socket.handshake.query?.deviceName || 'Unknown Device';
        console.log(`User connected via socket: ${socket.data.email} (${deviceName})`);
        // Join a room specific to this user to isolate notifications to their own devices
        socket.join(userId);
        // Join team rooms the user belongs to
        try {
            const userTeams = await Team_1.Team.find({ 'members.userId': userId });
            for (const team of userTeams) {
                socket.join(`team:${team._id.toString()}`);
                console.log(`Socket ${socket.id} joined team room on connect: team:${team._id.toString()}`);
            }
            const ownerTeams = await Team_1.Team.find({ ownerId: userId });
            for (const team of ownerTeams) {
                socket.join(`team:${team._id.toString()}`);
                console.log(`Socket ${socket.id} joined owner team room on connect: team:${team._id.toString()}`);
            }
        }
        catch (err) {
            console.error('Error joining team rooms for socket connection:', err);
        }
        // Track/Update this device's socket relationship
        try {
            await Device_1.Device.findOneAndUpdate({ userId, deviceName }, { socketId: socket.id, lastSeen: new Date() }, { upsert: true, new: true });
        }
        catch (err) {
            console.error('Error tracking device on socket connect:', err);
        }
        // Allow dynamic team room joining
        socket.on('team:join', (payload) => {
            if (payload.teamId) {
                socket.join(`team:${payload.teamId}`);
                console.log(`Socket ${socket.id} joined team room dynamically: team:${payload.teamId}`);
            }
        });
        // Handle note update/sync requests from client
        socket.on('note:update', async (payload) => {
            try {
                const { id, title, content, clientUpdatedAt, isDeleted, isPinned, teamId, folder, sharedWith } = payload;
                if (!id)
                    return;
                const clientDate = new Date(clientUpdatedAt);
                // Find note
                const existingNote = await Note_1.Note.findById(id);
                if (existingNote) {
                    const targetTeamId = teamId !== undefined ? teamId : existingNote.teamId;
                    const targetOwnerId = existingNote.userId.toString();
                    // Check if delete status is being set to true
                    const deleteStatusChanged = isDeleted !== undefined && isDeleted !== existingNote.isDeleted;
                    if (deleteStatusChanged && isDeleted === true) {
                        const hasDeletePerm = await verifySocketDeletePermission(userId, targetTeamId?.toString(), targetOwnerId);
                        if (!hasDeletePerm) {
                            socket.emit('error', { message: 'Access denied: You do not have permission to delete this note' });
                            return;
                        }
                    }
                    // Check write permissions if any content or metadata is changing
                    const isTitleOrContentOrMetaChanged = (title !== undefined && title !== existingNote.title) ||
                        (content !== undefined && content !== existingNote.content) ||
                        (folder !== undefined && folder !== existingNote.folder) ||
                        (sharedWith !== undefined && JSON.stringify(sharedWith) !== JSON.stringify(existingNote.sharedWith)) ||
                        (isPinned !== undefined && isPinned !== existingNote.isPinned) ||
                        (teamId !== undefined && teamId !== (existingNote.teamId?.toString() || null));
                    if (isTitleOrContentOrMetaChanged) {
                        const hasWritePerm = await verifySocketWritePermission(userId, targetTeamId?.toString(), targetOwnerId);
                        if (!hasWritePerm) {
                            socket.emit('error', { message: 'Access denied: You do not have permission to edit this note' });
                            return;
                        }
                    }
                    // Conflict resolution: Last-Write-Wins
                    if (clientDate > existingNote.clientUpdatedAt) {
                        const titleChanged = title !== undefined && title !== existingNote.title;
                        const contentChanged = content !== undefined && content !== existingNote.content;
                        const oldTeamId = existingNote.teamId;
                        existingNote.title = title !== undefined ? title : existingNote.title;
                        existingNote.content = content !== undefined ? content : existingNote.content;
                        existingNote.isDeleted = isDeleted !== undefined ? isDeleted : existingNote.isDeleted;
                        existingNote.isPinned = isPinned !== undefined ? isPinned : existingNote.isPinned;
                        existingNote.teamId = teamId !== undefined ? (teamId || null) : existingNote.teamId;
                        existingNote.folder = folder !== undefined ? (folder || null) : existingNote.folder;
                        existingNote.sharedWith = sharedWith !== undefined ? sharedWith : existingNote.sharedWith;
                        existingNote.clientUpdatedAt = clientDate;
                        await existingNote.save();
                        // Audit Logging
                        if (existingNote.teamId) {
                            const user = await User_1.User.findById(userId);
                            const username = user ? user.username : 'User';
                            if (!oldTeamId) {
                                await (0, teamController_1.logAuditEvent)(existingNote.teamId.toString(), userId, 'NOTE_SHARED', `${username} shared note "${existingNote.title || 'Untitled'}" with the team.`);
                            }
                            else if (deleteStatusChanged && isDeleted) {
                                await (0, teamController_1.logAuditEvent)(existingNote.teamId.toString(), userId, 'NOTE_DELETED', `${username} deleted note "${existingNote.title || 'Untitled'}".`);
                            }
                            else if (titleChanged || contentChanged) {
                                await (0, teamController_1.logAuditEvent)(existingNote.teamId.toString(), userId, 'NOTE_UPDATED', `${username} updated note "${existingNote.title || 'Untitled'}".`);
                            }
                        }
                        // Broadcast changes
                        if (existingNote.teamId) {
                            socket.to(`team:${existingNote.teamId.toString()}`).emit('note:sync', existingNote);
                        }
                        else {
                            socket.to(userId).emit('note:sync', existingNote);
                        }
                    }
                }
                else {
                    // Verify write permission for creating new note
                    const hasWritePerm = await verifySocketWritePermission(userId, teamId);
                    if (!hasWritePerm) {
                        socket.emit('error', { message: 'Access denied: You do not have permission to create notes' });
                        return;
                    }
                    // Create note
                    const newNote = new Note_1.Note({
                        _id: id,
                        userId,
                        title: title || '',
                        content: content || '',
                        isDeleted: isDeleted || false,
                        isPinned: isPinned || false,
                        teamId: teamId || null,
                        folder: folder || null,
                        sharedWith: sharedWith || [],
                        clientUpdatedAt: clientDate,
                    });
                    await newNote.save();
                    // Audit Logging
                    if (teamId) {
                        const user = await User_1.User.findById(userId);
                        const username = user ? user.username : 'User';
                        await (0, teamController_1.logAuditEvent)(teamId, userId, 'NOTE_CREATED', `${username} created note "${title || 'Untitled'}".`);
                    }
                    // Broadcast
                    if (newNote.teamId) {
                        socket.to(`team:${newNote.teamId.toString()}`).emit('note:sync', newNote);
                    }
                    else {
                        socket.to(userId).emit('note:sync', newNote);
                    }
                }
            }
            catch (err) {
                console.error('Error in socket note:update:', err);
                socket.emit('error', { message: 'Failed to process note update' });
            }
        });
        socket.on('disconnect', async () => {
            console.log(`User disconnected socket: ${socket.data.email}`);
            try {
                await Device_1.Device.findOneAndUpdate({ socketId: socket.id }, { socketId: '' });
            }
            catch (err) {
                console.error('Error clearing socket on disconnect:', err);
            }
        });
    });
};
exports.setupSocketHandlers = setupSocketHandlers;
