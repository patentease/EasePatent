import mongoose, { Document, Schema } from 'mongoose';
import { IUser } from './User';

interface Document {
  id: string;
  name: string;
  url: string;
  type: string;
  uploadedAt: string;
}

export interface IPatent extends Document {
  title: string;
  description: string;
  claims: string[];
  technicalField?: string;
  jurisdictions?: string[];
  status: 'draft' | 'pending' | 'granted' | 'rejected';
  owner: mongoose.Types.ObjectId;
  files?: string[];
  createdAt: Date;
  updatedAt: Date;
  documents?: Document[];
  uniquenessScore?: number;
  marketPotential?: number;
  filingDate?: Date;
  grantDate?: Date;
  patentNumber?: string;
  searchReport?: {
    similarityScore: number;
    priorArtReferences: Array<{
      patentNumber: string;
      title: string;
      relevanceScore: number;
      matchingClaims: string[];
      publicationDate: string;
    }>;
    aiAnalysis?: {
      technicalComplexity: number;
      marketSizeEstimate: number;
      competitiveLandscape: string[];
      innovationScore: number;
      riskFactors: string[];
    };
    recommendations?: string[];
  };
}

const patentSchema = new Schema<IPatent>(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      required: true,
    },
    claims: {
      type: [String],
      required: true,
      default: [],
    },
    technicalField: {
      type: String,
      trim: true,
    },
    jurisdictions: {
      type: [String],
      default: [],
    },
    status: {
      type: String,
      enum: ['draft', 'pending', 'granted', 'rejected'],
      default: 'draft',
    },
    owner: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    files: {
      type: [String],
      default: [],
    },
    documents: [{
      id: String,
      name: String,
      url: String,
      type: String,
      uploadedAt: String,
    }],
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
    searchReport: {
      similarityScore: Number,
      priorArtReferences: [{
        patentNumber: String,
        title: String,
        relevanceScore: Number,
        matchingClaims: [String],
        publicationDate: String,
      }],
      aiAnalysis: {
        technicalComplexity: Number,
        marketSizeEstimate: Number,
        competitiveLandscape: [String],
        innovationScore: Number,
        riskFactors: [String],
      },
      recommendations: [String],
    },
  },
  {
    timestamps: true,
  }
);

// Add text index for search
patentSchema.index({
  title: 'text',
  description: 'text',
  claims: 'text',
  technicalField: 'text',
});

// Add more indexes as needed
patentSchema.index({ owner: 1, status: 1 });
patentSchema.index({ jurisdictions: 1 });
patentSchema.index({ 'searchReport.similarityScore': 1 });
patentSchema.index({ createdAt: 1 });

const Patent = mongoose.model<IPatent>('Patent', patentSchema);

export default Patent; 