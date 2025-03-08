import mongoose from 'mongoose';

const aiAnalysisSchema = new mongoose.Schema({
  patentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Patent',
    required: true
  },
  similarityScore: {
    type: Number,
    required: true,
    min: 0,
    max: 100
  },
  priorArtReferences: [{
    type: String
  }],
  aiSuggestions: {
    type: String,
    required: true
  },
  bertAnalysis: {
    vectorRepresentation: [Number],
    similarPatents: [{
      patentId: String,
      score: Number
    }]
  },
  gpt4Analysis: {
    claimsSuggestions: String,
    marketAnalysis: String,
    technicalFeedback: String
  },
  languageTranslations: [{
    language: String,
    title: String,
    description: String,
    claims: String
  }]
}, {
  timestamps: true
});

const AIAnalysis = mongoose.model('AIAnalysis', aiAnalysisSchema);

export default AIAnalysis; 