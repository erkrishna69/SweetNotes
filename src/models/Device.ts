import { Schema, model, Document } from 'mongoose';

export interface IDevice extends Document {
  userId: Schema.Types.ObjectId | string;
  deviceName: string;
  lastSeen: Date;
  socketId?: string;
}

const DeviceSchema = new Schema<IDevice>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    deviceName: {
      type: String,
      required: true,
    },
    lastSeen: {
      type: Date,
      default: Date.now,
    },
    socketId: {
      type: String,
      default: '',
    },
  },
  {
    timestamps: true,
  }
);

export const Device = model<IDevice>('Device', DeviceSchema);
