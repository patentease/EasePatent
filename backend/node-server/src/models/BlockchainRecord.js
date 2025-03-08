import mongoose from 'mongoose';

const blockchainRecordSchema = new mongoose.Schema({
  patentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Patent',
    required: true
  },
  timestamp: {
    type: Date,
    required: true,
    default: Date.now
  },
  transactionHash: {
    type: String,
    required: true,
    unique: true
  },
  network: {
    type: String,
    required: true,
    enum: ['ethereum', 'solana']
  },
  ipfsHash: {
    type: String,
    required: true
  },
  tokenId: {
    type: String
  },
  smartContractAddress: {
    type: String,
    required: true
  },
  ownerAddress: {
    type: String,
    required: true
  },
  metadata: {
    title: String,
    description: String,
    inventors: [String],
    filingDate: Date,
    jurisdictions: [String]
  }
}, {
  timestamps: true
});

const BlockchainRecord = mongoose.model('BlockchainRecord', blockchainRecordSchema);

export default BlockchainRecord; 