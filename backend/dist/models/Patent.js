"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = __importDefault(require("mongoose"));
const patentSchema = new mongoose_1.default.Schema({
    title: {
        type: String,
        required: [true, 'Title is required'],
        trim: true,
    },
    description: {
        type: String,
        required: [true, 'Description is required'],
        trim: true,
    },
    inventors: [{
            type: String,
            required: [true, 'At least one inventor is required'],
            trim: true,
        }],
    jurisdictions: [{
            type: String,
            required: [true, 'At least one jurisdiction is required'],
            trim: true,
        }],
    status: {
        type: String,
        enum: ['draft', 'pending', 'filed', 'granted', 'rejected'],
        default: 'draft',
    },
    owner: {
        type: mongoose_1.default.Schema.Types.ObjectId,
        ref: 'User',
        required: [true, 'Patent must have an owner'],
    },
    uniquenessScore: {
        type: Number,
        min: 0,
        max: 100,
    },
    marketPotential: {
        type: Number,
        min: 0,
        max: 100,
    },
    filingDate: Date,
    grantDate: Date,
    patentNumber: {
        type: String,
        trim: true,
    },
}, {
    timestamps: true,
});
patentSchema.index({ title: 'text', description: 'text' });
patentSchema.index({ owner: 1, status: 1 });
patentSchema.index({ jurisdictions: 1 });
const Patent = mongoose_1.default.model('Patent', patentSchema);
exports.default = Patent;
//# sourceMappingURL=Patent.js.map