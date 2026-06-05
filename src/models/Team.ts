import { Schema, model, Document, Types } from 'mongoose';

export interface ITeamMember {
  userId: Types.ObjectId | string;
  role: 'admin' | 'member';
  canWriteNotes: boolean;
  canDeleteNotes: boolean;
  canViewAuditLogs: boolean;
}

export interface ITeam extends Document {
  name: string;
  ownerId: Types.ObjectId | string;
  inviteCode: string;
  members: ITeamMember[];
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
