"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Team = void 0;
const mongoose_1 = require("mongoose");
const TeamMemberSchema = new mongoose_1.Schema({
    userId: {
        type: mongoose_1.Schema.Types.ObjectId,
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
}, { _id: false });
const TeamSchema = new mongoose_1.Schema({
    name: {
        type: String,
        required: true,
        trim: true,
    },
    ownerId: {
        type: mongoose_1.Schema.Types.ObjectId,
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
            type: mongoose_1.Schema.Types.ObjectId,
            ref: 'User',
            default: [],
        },
    ],
}, {
    timestamps: true,
});
// Index members array for fast querying of teams a user belongs to
TeamSchema.index({ 'members.userId': 1 });
exports.Team = (0, mongoose_1.model)('Team', TeamSchema);
