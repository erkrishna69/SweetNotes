import { Schema, model, Document, Types } from 'mongoose';

export interface IAuditLog extends Document {
  teamId: Types.ObjectId | string;
  userId: Types.ObjectId | string;
  action: string;
  details: string;
  createdAt: Date;
}

const AuditLogSchema = new Schema<IAuditLog>(
  {
    teamId: {
      type: Schema.Types.ObjectId,
      ref: 'Team',
      required: true,
      index: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    action: {
      type: String,
      required: true,
    },
    details: {
      type: String,
      required: true,
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false }, // Only createdAt timestamp is needed
  }
);

// Compound index to query logs for a team sorted by creation time
AuditLogSchema.index({ teamId: 1, createdAt: -1 });

export const AuditLog = model<IAuditLog>('AuditLog', AuditLogSchema);
