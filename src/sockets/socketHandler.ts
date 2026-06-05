import { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { Note } from '../models/Note';
import { Device } from '../models/Device';
import { Team } from '../models/Team';

const JWT_SECRET = process.env.JWT_SECRET || 'sweetnotes_jwt_secret_key';

interface DecodedToken {
  userId: string;
  email: string;
}

const verifySocketWritePermission = async (userId: string, teamId: string | null | undefined, existingNoteOwnerId?: string): Promise<boolean> => {
  if (!teamId) {
    return !existingNoteOwnerId || existingNoteOwnerId.toString() === userId;
  }
  const team = await Team.findById(teamId);
  if (!team) return false;
  if (team.ownerId.toString() === userId) return true;
  const member = team.members.find((m) => m.userId.toString() === userId);
  if (!member) return false;
  return member.canWriteNotes;
};

const verifySocketDeletePermission = async (userId: string, teamId: string | null | undefined, existingNoteOwnerId?: string): Promise<boolean> => {
  if (!teamId) {
    return !existingNoteOwnerId || existingNoteOwnerId.toString() === userId;
  }
  const team = await Team.findById(teamId);
  if (!team) return false;
  if (team.ownerId.toString() === userId) return true;
  const member = team.members.find((m) => m.userId.toString() === userId);
  if (!member) return false;
  return member.canDeleteNotes;
};

export const setupSocketHandlers = (io: Server) => {
  // Authentication middleware for Socket.IO
  io.use((socket: Socket, next) => {
    const token = socket.handshake.auth?.token || socket.handshake.query?.token;

    if (!token) {
      return next(new Error('Authentication error: Token required'));
    }

    try {
      const decoded = jwt.verify(token, JWT_SECRET) as DecodedToken;
      socket.data.userId = decoded.userId;
      socket.data.email = decoded.email;
      next();
    } catch (err) {
      return next(new Error('Authentication error: Invalid token'));
    }
  });

  io.on('connection', async (socket: Socket) => {
    const userId = socket.data.userId;
    const deviceName = socket.handshake.query?.deviceName as string || 'Unknown Device';

    console.log(`User connected via socket: ${socket.data.email} (${deviceName})`);

    // Join a room specific to this user to isolate notifications to their own devices
    socket.join(userId);

    // Join team rooms the user belongs to
    try {
      const userTeams = await Team.find({ 'members.userId': userId });
      for (const team of userTeams) {
        socket.join(`team:${team._id.toString()}`);
        console.log(`Socket ${socket.id} joined team room on connect: team:${team._id.toString()}`);
      }
      const ownerTeams = await Team.find({ ownerId: userId });
      for (const team of ownerTeams) {
        socket.join(`team:${team._id.toString()}`);
        console.log(`Socket ${socket.id} joined owner team room on connect: team:${team._id.toString()}`);
      }
    } catch (err) {
      console.error('Error joining team rooms for socket connection:', err);
    }

    // Track/Update this device's socket relationship
    try {
      await Device.findOneAndUpdate(
        { userId, deviceName },
        { socketId: socket.id, lastSeen: new Date() },
        { upsert: true, new: true }
      );
    } catch (err) {
      console.error('Error tracking device on socket connect:', err);
    }

    // Allow dynamic team room joining
    socket.on('team:join', (payload: { teamId: string }) => {
      if (payload.teamId) {
        socket.join(`team:${payload.teamId}`);
        console.log(`Socket ${socket.id} joined team room dynamically: team:${payload.teamId}`);
      }
    });

    // Handle note update/sync requests from client
    socket.on('note:update', async (payload: {
      id: string;
      title: string;
      content: string;
      clientUpdatedAt: string;
      isDeleted?: boolean;
      isPinned?: boolean;
      teamId?: string | null;
      folder?: string | null;
      sharedWith?: string[];
    }) => {
      try {
        const { id, title, content, clientUpdatedAt, isDeleted, isPinned, teamId, folder, sharedWith } = payload;
        if (!id) return;

        const clientDate = new Date(clientUpdatedAt);

        // Find note
        const existingNote = await Note.findById(id);

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
          const isTitleOrContentOrMetaChanged = 
            (title !== undefined && title !== existingNote.title) ||
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
            existingNote.title = title !== undefined ? title : existingNote.title;
            existingNote.content = content !== undefined ? content : existingNote.content;
            existingNote.isDeleted = isDeleted !== undefined ? isDeleted : existingNote.isDeleted;
            existingNote.isPinned = isPinned !== undefined ? isPinned : existingNote.isPinned;
            existingNote.teamId = teamId !== undefined ? (teamId || null) : existingNote.teamId;
            existingNote.folder = folder !== undefined ? (folder || null) : existingNote.folder;
            existingNote.sharedWith = sharedWith !== undefined ? sharedWith : existingNote.sharedWith;
            existingNote.clientUpdatedAt = clientDate;
            await existingNote.save();

            // Broadcast changes
            if (existingNote.teamId) {
              socket.to(`team:${existingNote.teamId.toString()}`).emit('note:sync', existingNote);
            } else {
              socket.to(userId).emit('note:sync', existingNote);
            }
          }
        } else {
          // Verify write permission for creating new note
          const hasWritePerm = await verifySocketWritePermission(userId, teamId);
          if (!hasWritePerm) {
            socket.emit('error', { message: 'Access denied: You do not have permission to create notes' });
            return;
          }

          // Create note
          const newNote = new Note({
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

          // Broadcast
          if (newNote.teamId) {
            socket.to(`team:${newNote.teamId.toString()}`).emit('note:sync', newNote);
          } else {
            socket.to(userId).emit('note:sync', newNote);
          }
        }
      } catch (err) {
        console.error('Error in socket note:update:', err);
        socket.emit('error', { message: 'Failed to process note update' });
      }
    });

    socket.on('disconnect', async () => {
      console.log(`User disconnected socket: ${socket.data.email}`);
      try {
        await Device.findOneAndUpdate({ socketId: socket.id }, { socketId: '' });
      } catch (err) {
        console.error('Error clearing socket on disconnect:', err);
      }
    });
  });
};
