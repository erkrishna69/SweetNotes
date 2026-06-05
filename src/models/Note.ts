import { Schema, model, Types } from 'mongoose';

export interface INote {
  _id: string; // client-generated UUID
  userId: Types.ObjectId | string;
  teamId?: Types.ObjectId | string | null;
  folder?: string | null;
  sharedWith?: (Types.ObjectId | string)[] | null;
  title: string;
  content: string;
  isDeleted: boolean;
  isPinned: boolean;
  clientUpdatedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const NoteSchema = new Schema<INote>(
  {
    _id: {
      type: String,
      required: true, // Client UUID is mandatory
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    teamId: {
      type: Schema.Types.ObjectId,
      ref: 'Team',
      default: null,
      index: true,
    },
    folder: {
      type: String,
      default: null,
    },
    sharedWith: [
      {
        type: Schema.Types.ObjectId,
        ref: 'User',
        default: [],
      },
    ],
    title: {
      type: String,
      default: '',
    },
    content: {
      type: String,
      default: '',
    },
    isDeleted: {
      type: Boolean,
      default: false,
      index: true,
    },
    isPinned: {
      type: Boolean,
      default: false,
    },
    clientUpdatedAt: {
      type: Date,
      required: true,
      default: Date.now,
    },
  },
  {
    timestamps: true,
    _id: false, // Prevent mongoose from generating automatic ObjectId for _id
  }
);

// Search text indexing for fast search
NoteSchema.index({ title: 'text', content: 'text' });

export const Note = model<INote>('Note', NoteSchema);
