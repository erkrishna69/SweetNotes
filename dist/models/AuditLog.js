"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuditLog = void 0;
const mongoose_1 = require("mongoose");
const AuditLogSchema = new mongoose_1.Schema({
    teamId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'Team',
        required: true,
        index: true,
    },
    userId: {
        type: mongoose_1.Schema.Types.ObjectId,
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
}, {
    timestamps: { createdAt: true, updatedAt: false }, // Only createdAt timestamp is needed
});
// Compound index to query logs for a team sorted by creation time
AuditLogSchema.index({ teamId: 1, createdAt: -1 });
exports.AuditLog = (0, mongoose_1.model)('AuditLog', AuditLogSchema);
