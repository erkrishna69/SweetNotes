import { Schema, model, Document, Types } from 'mongoose';

export interface ITeamMember {
  userId: Types.ObjectId | string;
  role: 'admin' | 'member';
  canWriteNotes: boolean;
  canDeleteNotes: boolean;
  canViewAuditLogs: boolean;
}

export interface ITeamInvite {
  code: string;
  createdBy: Types.ObjectId | string;
  maxUses: number;
  uses: number;
  createdAt: Date;
}

export interface ITeam extends Document {
  name: string;
  ownerId: Types.ObjectId | string;
  inviteCode: string;
  members: ITeamMember[];
  invites: ITeamInvite[];
  bannedUsers: (Types.ObjectId | string)[];
  createdAt: Date;
  updatedAt: Date;
}

const TeamMemberSchema = new Schema<ITeamMember>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    role: {
      type: String,
      enum: ['admin', 'member'],
      default: 'member',
    },
    canWriteNotes: {
      type: Boolean,
      default: false,
    },
    canDeleteNotes: {
      type: Boolean,
      default: false,
    },
    canViewAuditLogs: {
      type: Boolean,
      default: false,
    },
  },
  { _id: false }
);

const TeamInviteSchema = new Schema<ITeamInvite>(
  {
    code: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    maxUses: {
      type: Number,
      default: 1,
    },
    uses: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

const TeamSchema = new Schema<ITeam>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    ownerId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    inviteCode: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    members: [TeamMemberSchema],
    invites: [TeamInviteSchema],
    bannedUsers: [
      {
        type: Schema.Types.ObjectId,
        ref: 'User',
        default: [],
      },
    ],
  },
  {
    timestamps: true,
  }
);

// Index members array for fast querying of teams a user belongs to
TeamSchema.index({ 'members.userId': 1 });

export const Team = model<ITeam>('Team', TeamSchema);
