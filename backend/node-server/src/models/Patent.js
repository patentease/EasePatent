import mongoose from 'mongoose';

const patentSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    required: true
  },
  inventors: [{
    type: String,
    required: true
  }],
  filingDate: {
    type: Date
  },
  status: {
    type: String,
    enum: ['draft', 'pending', 'filed', 'granted', 'rejected'],
    default: 'draft'
  },
  jurisdictions: [{
    type: String,
    required: true
  }],
  uniquenessScore: {
    type: Number,
    min: 0,
    max: 100
  },
  marketPotential: {
    type: Number,
    min: 0,
    max: 100
  },
  documents: [{
    name: String,
    type: String,
    url: String,
    uploadedAt: {
      type: Date,
      default: Date.now
    }
  }],
  owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  aiAnalysis: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'AIAnalysis'
  },
  blockchainRecord: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'BlockchainRecord'
  }
}, {
  timestamps: true
});

// Index for text search
patentSchema.index({ 
  title: 'text', 
  description: 'text',
  inventors: 'text'
});

const Patent = mongoose.model('Patent', patentSchema);

export default Patent; 