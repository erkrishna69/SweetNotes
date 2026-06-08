import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import { Team } from '../models/Team';
import { AuditLog } from '../models/AuditLog';
import { User } from '../models/User';
import { Note } from '../models/Note';
import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcryptjs';

// Helper to log audit events
export const logAuditEvent = async (teamId: string, userId: string, action: string, details: string) => {
  try {
    const log = new AuditLog({
      teamId,
      userId,
      action,
      details,
    });
    await log.save();
  } catch (error) {
    console.error('Audit log error:', error);
  }
};

export const createTeam = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    const { name } = req.body;

    if (!name || typeof name !== 'string' || name.trim() === '') {
      return res.status(400).json({ message: 'Team name is required' });
    }

    const inviteCode = uuidv4().substring(0, 8).toUpperCase();

    const team = new Team({
      name: name.trim(),
      ownerId: userId,
      inviteCode,
      members: [
        {
          userId,
          role: 'admin',
          canWriteNotes: true,
          canDeleteNotes: true,
          canViewAuditLogs: true,
        },
      ],
    });

    await team.save();

    await logAuditEvent(team._id.toString(), userId!, 'TEAM_CREATED', `Team "${team.name}" was created.`);

    return res.status(201).json(team);
  } catch (error) {
    console.error('Create team error:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

export const getTeams = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.userId;

    // Fetch teams where user is a member
    const teams = await Team.find({ 'members.userId': userId })
      .populate('ownerId', 'username email avatar')
      .sort({ createdAt: -1 });

    return res.status(200).json(teams);
  } catch (error) {
    console.error('Get teams error:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

export const getTeamDetails = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    const { id } = req.params;

    const team = await Team.findById(id)
      .populate('ownerId', 'username email avatar')
      .populate('members.userId', 'username email avatar');

    if (!team) {
      return res.status(404).json({ message: 'Team not found' });
    }

    // Check membership
    const isMember = team.members.some((m) => m.userId && (m.userId as any)._id.toString() === userId);
    if (!isMember) {
      return res.status(403).json({ message: 'Access denied. You are not a member of this team.' });
    }

    return res.status(200).json(team);
  } catch (error) {
    console.error('Get team details error:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

export const joinTeam = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    const { inviteCode } = req.body;

    if (!inviteCode) {
      return res.status(400).json({ message: 'Invite code or link is required' });
    }

    let code = inviteCode.trim();
    if (code.includes('/')) {
      code = code.substring(code.lastIndexOf('/') + 1);
    }
    code = code.toUpperCase();

    const team = await Team.findOne({ inviteCode: code });
    if (!team) {
      return res.status(404).json({ message: 'Invalid or expired invite code' });
    }

    // Check if user is banned
    if (team.bannedUsers && team.bannedUsers.some((id) => id.toString() === userId)) {
      return res.status(403).json({ message: 'You have been banned from this team.' });
    }

    // Check if already a member
    const existingIndex = team.members.findIndex((m) => m.userId.toString() === userId);
    if (existingIndex !== -1) {
      return res.status(400).json({ message: 'You are already a member of this team' });
    }

    // Add as member with default permissions
    team.members.push({
      userId: userId!,
      role: 'member',
      canWriteNotes: false,
      canDeleteNotes: false,
      canViewAuditLogs: false,
    });

    // Generate a new invite code so the old link/code expires
    const oldCode = team.inviteCode;
    const newCode = uuidv4().substring(0, 8).toUpperCase();
    team.inviteCode = newCode;

    await team.save();

    const user = await User.findById(userId);
    const username = user ? user.username : 'A new user';

    await logAuditEvent(
      team._id.toString(),
      userId!,
      'MEMBER_JOINED',
      `${username} joined the team. Invite link expired, new secure link generated.`
    );

    return res.status(200).json({ message: 'Successfully joined team', team });
  } catch (error) {
    console.error('Join team error:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

export const leaveTeam = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    const { id } = req.params;

    const team = await Team.findById(id);
    if (!team) {
      return res.status(404).json({ message: 'Team not found' });
    }

    if (team.ownerId.toString() === userId) {
      return res.status(400).json({ message: 'As owner, you cannot leave the team. You must delete it instead.' });
    }

    const memberIndex = team.members.findIndex((m) => m.userId.toString() === userId);
    if (memberIndex === -1) {
      return res.status(400).json({ message: 'You are not a member of this team' });
    }

    team.members.splice(memberIndex, 1);
    await team.save();

    const user = await User.findById(userId);
    const username = user ? user.username : 'A user';

    await logAuditEvent(team._id.toString(), userId!, 'MEMBER_LEFT', `${username} left the team.`);

    return res.status(200).json({ message: 'Successfully left the team' });
  } catch (error) {
    console.error('Leave team error:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

export const updateMemberPermission = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    const { id, memberUserId } = req.params;

    const team = await Team.findById(id);
    if (!team) {
      return res.status(404).json({ message: 'Team not found' });
    }

    // Only Owner or Admin can update permissions
    const currentUserMember = team.members.find((m) => m.userId.toString() === userId);
    const isOwner = team.ownerId.toString() === userId;
    const isAdmin = currentUserMember?.role === 'admin';

    if (!isOwner && !isAdmin) {
      return res.status(403).json({ message: 'Access denied. Only owner/admin can change permissions.' });
    }

    // Owner permission cannot be changed
    if (team.ownerId.toString() === memberUserId) {
      return res.status(400).json({ message: 'Cannot change permission of the team owner.' });
    }

    const member = team.members.find((m) => m.userId.toString() === memberUserId);
    if (!member) {
      return res.status(404).json({ message: 'Member not found in team' });
    }

    const { canWriteNotes, canDeleteNotes, canViewAuditLogs, role } = req.body;

    const changes: string[] = [];
    if (role !== undefined && role !== member.role) {
      if (role === 'admin' || role === 'member') {
        member.role = role as any;
        changes.push(`Role: ${role}`);
      }
    }
    if (canWriteNotes !== undefined && canWriteNotes !== member.canWriteNotes) {
      member.canWriteNotes = canWriteNotes;
      changes.push(`WriteNotes: ${canWriteNotes}`);
    }
    if (canDeleteNotes !== undefined && canDeleteNotes !== member.canDeleteNotes) {
      member.canDeleteNotes = canDeleteNotes;
      changes.push(`DeleteNotes: ${canDeleteNotes}`);
    }
    if (canViewAuditLogs !== undefined && canViewAuditLogs !== member.canViewAuditLogs) {
      member.canViewAuditLogs = canViewAuditLogs;
      changes.push(`ViewAuditLogs: ${canViewAuditLogs}`);
    }

    await team.save();

    const changerUser = await User.findById(userId);
    const targetUser = await User.findById(memberUserId);
    const changerName = changerUser ? changerUser.username : 'Admin';
    const targetName = targetUser ? targetUser.username : 'Member';

    if (changes.length > 0) {
      await logAuditEvent(
        team._id.toString(),
        userId!,
        'PERMISSION_CHANGED',
        `${changerName} changed ${targetName}'s permissions: ${changes.join(', ')}.`
      );
    }

    return res.status(200).json({ message: 'Member permissions updated successfully', team });
  } catch (error) {
    console.error('Update member permission error:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

export const getTeamLogs = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    const { id } = req.params;

    const team = await Team.findById(id);
    if (!team) {
      return res.status(404).json({ message: 'Team not found' });
    }

    // Check membership and audit log permission
    const member = team.members.find((m) => m.userId.toString() === userId);
    const isOwner = team.ownerId.toString() === userId;
    if (!isOwner && (!member || !member.canViewAuditLogs)) {
      return res.status(403).json({ message: 'Access denied. You do not have permission to view team logs.' });
    }

    // Retrieve logs sorted by createdAt descending
    const logs = await AuditLog.find({ teamId: id })
      .populate('userId', 'username email avatar')
      .sort({ createdAt: -1 });

    return res.status(200).json(logs);
  } catch (error) {
    console.error('Get team logs error:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

export const kickMember = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    const { id, memberUserId } = req.params;

    const team = await Team.findById(id);
    if (!team) {
      return res.status(404).json({ message: 'Team not found' });
    }

    // Only Owner or Admin can kick
    const currentUserMember = team.members.find((m) => m.userId.toString() === userId);
    const isOwner = team.ownerId.toString() === userId;
    const isAdmin = currentUserMember?.role === 'admin';

    if (!isOwner && !isAdmin) {
      return res.status(403).json({ message: 'Access denied. Only owner/admin can kick members.' });
    }

    // Cannot kick the owner
    if (team.ownerId.toString() === memberUserId) {
      return res.status(400).json({ message: 'Cannot kick the team owner.' });
    }

    const memberIndex = team.members.findIndex((m) => m.userId.toString() === memberUserId);
    if (memberIndex === -1) {
      return res.status(404).json({ message: 'Member not found in team' });
    }

    team.members.splice(memberIndex, 1);
    await team.save();

    const changerUser = await User.findById(userId);
    const targetUser = await User.findById(memberUserId);
    const changerName = changerUser ? changerUser.username : 'Admin';
    const targetName = targetUser ? targetUser.username : 'Member';

    await logAuditEvent(
      team._id.toString(),
      userId!,
      'MEMBER_KICKED',
      `${changerName} kicked ${targetName} from the team.`
    );

    return res.status(200).json({ message: 'Member kicked successfully', team });
  } catch (error) {
    console.error('Kick member error:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

export const banMember = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    const { id, memberUserId } = req.params;

    const team = await Team.findById(id);
    if (!team) {
      return res.status(404).json({ message: 'Team not found' });
    }

    // Only Owner or Admin can ban
    const currentUserMember = team.members.find((m) => m.userId.toString() === userId);
    const isOwner = team.ownerId.toString() === userId;
    const isAdmin = currentUserMember?.role === 'admin';

    if (!isOwner && !isAdmin) {
      return res.status(403).json({ message: 'Access denied. Only owner/admin can ban members.' });
    }

    // Cannot ban the owner
    if (team.ownerId.toString() === memberUserId) {
      return res.status(400).json({ message: 'Cannot ban the team owner.' });
    }

    // Remove from members if present
    const memberIndex = team.members.findIndex((m) => m.userId.toString() === memberUserId);
    if (memberIndex !== -1) {
      team.members.splice(memberIndex, 1);
    }

    // Add to bannedUsers if not already present
    if (!team.bannedUsers) {
      team.bannedUsers = [];
    }
    if (!team.bannedUsers.some((uid) => uid.toString() === memberUserId)) {
      team.bannedUsers.push(memberUserId);
    }

    await team.save();

    const changerUser = await User.findById(userId);
    const targetUser = await User.findById(memberUserId);
    const changerName = changerUser ? changerUser.username : 'Admin';
    const targetName = targetUser ? targetUser.username : 'Member';

    await logAuditEvent(
      team._id.toString(),
      userId!,
      'MEMBER_BANNED',
      `${changerName} banned ${targetName} from the team.`
    );

    return res.status(200).json({ message: 'Member banned successfully', team });
  } catch (error) {
    console.error('Ban member error:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

export const deleteTeam = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    const { id } = req.params;
    const { password } = req.body;

    if (!password) {
      return res.status(400).json({ message: 'Password is required to delete the team.' });
    }

    const team = await Team.findById(id);
    if (!team) {
      return res.status(404).json({ message: 'Team not found' });
    }

    // Only owner can delete the team
    if (team.ownerId.toString() !== userId) {
      return res.status(403).json({ message: 'Access denied. Only the team owner can delete this team.' });
    }

    // Verify password
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      return res.status(400).json({ message: 'Incorrect password.' });
    }

    // Delete all notes associated with this team
    await Note.deleteMany({ teamId: id });

    // Delete the team itself
    await Team.findByIdAndDelete(id);

    // Delete audit logs associated with this team
    await AuditLog.deleteMany({ teamId: id });

    return res.status(200).json({ message: 'Team and all associated notes deleted successfully.' });
  } catch (error) {
    console.error('Delete team error:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};
