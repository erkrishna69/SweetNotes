"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Note = void 0;
const mongoose_1 = require("mongoose");
const NoteSchema = new mongoose_1.Schema({
    _id: {
        type: String,
        required: true, // Client UUID is mandatory
    },
    userId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true,
    },
    teamId: {
        type: mongoose_1.Schema.Types.ObjectId,
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
            type: mongoose_1.Schema.Types.ObjectId,
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
}, {
    timestamps: true,
    _id: false, // Prevent mongoose from generating automatic ObjectId for _id
});
// Search text indexing for fast search
NoteSchema.index({ title: 'text', content: 'text' });
exports.Note = (0, mongoose_1.model)('Note', NoteSchema);
