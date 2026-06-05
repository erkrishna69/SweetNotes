import { Response } from 'express';
import { Note } from '../models/Note';
import { Team } from '../models/Team';
import { AuthenticatedRequest } from '../middleware/auth';

const verifyMergePermission = async (userId: string, teamId: string | null | undefined, existingNoteOwnerId?: string): Promise<boolean> => {
  if (!teamId) {
    // If personal note, user must own it
    return !existingNoteOwnerId || existingNoteOwnerId.toString() === userId;
  }

  const team = await Team.findById(teamId);
  if (!team) return false;

  const isOwner = team.ownerId.toString() === userId;
  if (isOwner) return true;

  const member = team.members.find((m) => m.userId.toString() === userId);
  if (!member) return false;

  return member.canWriteNotes;
};

export const mergeNotes = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }
    const { localNotes } = req.body; // Array of notes from the client

    if (!Array.isArray(localNotes)) {
      return res.status(400).json({ message: 'localNotes must be an array' });
    }

    const mergedNotes = [];

    for (const localNote of localNotes) {
      const { id, title, content, clientUpdatedAt, isDeleted, isPinned, teamId, folder, sharedWith } = localNote;

      if (!id) continue;

      const localUpdatedAt = clientUpdatedAt ? new Date(clientUpdatedAt) : new Date();

      const dbNote = await Note.findById(id);

      if (dbNote) {
        // Security check
        const hasPerm = await verifyMergePermission(userId, dbNote.teamId?.toString(), dbNote.userId.toString());
        if (!hasPerm) {
          continue; // skip if no permission
        }

        // Conflict Resolution: Keep the one with the latest clientUpdatedAt
        if (localUpdatedAt > dbNote.clientUpdatedAt) {
          dbNote.title = title !== undefined ? title : dbNote.title;
          dbNote.content = content !== undefined ? content : dbNote.content;
          dbNote.isDeleted = isDeleted !== undefined ? isDeleted : dbNote.isDeleted;
          dbNote.isPinned = isPinned !== undefined ? isPinned : dbNote.isPinned;
          dbNote.teamId = teamId !== undefined ? (teamId || null) : dbNote.teamId;
          dbNote.folder = folder !== undefined ? (folder || null) : dbNote.folder;
          dbNote.sharedWith = sharedWith !== undefined ? (sharedWith || null) : dbNote.sharedWith;
          dbNote.clientUpdatedAt = localUpdatedAt;
          await dbNote.save();
          mergedNotes.push(dbNote);
        } else {
          mergedNotes.push(dbNote);
        }
      } else {
        // Create new note in cloud (respecting write permission for the team)
        const hasPerm = await verifyMergePermission(userId, teamId);
        if (!hasPerm) {
          continue;
        }

        const newNote = new Note({
          _id: id,
          userId,
          teamId: teamId || null,
          folder: folder || null,
          sharedWith: sharedWith || [],
          title: title || '',
          content: content || '',
          isDeleted: isDeleted || false,
          isPinned: isPinned || false,
          clientUpdatedAt: localUpdatedAt,
        });
        await newNote.save();
        mergedNotes.push(newNote);
      }
    }

    // Also pull any notes that exist in the DB but were not sent by client (to sync down)
    const clientNoteIds = localNotes.map((n) => n.id);
    
    // Find all teams where user is a member
    const userTeams = await Team.find({ 'members.userId': userId });
    const teamIds = userTeams.map((t) => t._id);

    const serverOnlyNotes = await Note.find({
      _id: { $nin: clientNoteIds },
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
    });

    mergedNotes.push(...serverOnlyNotes);

    // Return the complete list of non-deleted merged notes to the client
    const activeMergedNotes = mergedNotes.filter(note => !note.isDeleted);

    return res.status(200).json(activeMergedNotes);
  } catch (error) {
    console.error('Merge notes error:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};
