"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Device = void 0;
const mongoose_1 = require("mongoose");
const DeviceSchema = new mongoose_1.Schema({
    userId: {
        type: mongoose_1.Schema.Types.ObjectId,
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
}, {
    timestamps: true,
});
exports.Device = (0, mongoose_1.model)('Device', DeviceSchema);
