const mongoose = require('mongoose');

const warningSignSchema = new mongoose.Schema({
  projectName: {
    type: String,
    required: true,
    trim: true
  },
  tokenSymbol: {
    type: String,
    required: true,
    trim: true,
    uppercase: true
  },
  blockchainNetwork: {
    type: String,
    required: true,
    enum: ['Ethereum', 'BSC', 'Solana', 'Polygon', 'Other']
  },
  contractAddress: {
    type: String,
    required: true,
    trim: true
  },
  riskType: [{
    type: String,
    required: true,
    enum: [
      'Large Token Transfer',
      'Liquidity Reduction',
      'Contract Risk',
      'Team Wallet Activity',
      'Market Manipulation',
      'Social Sentiment',
      'Other'
    ]
  }],
  riskLevel: {
    type: String,
    required: true,
    enum: ['Low', 'Medium', 'High', 'Critical'],
    default: 'Medium'
  },
  description: {
    type: String,
    required: true,
    trim: true
  },
  evidence: {
    onChainData: {
      transactionHash: String,
      blockNumber: Number,
      timestamp: Date,
      details: mongoose.Schema.Types.Mixed
    },
    marketData: {
      priceChange: Number,
      volumeChange: Number,
      liquidityChange: Number,
      timestamp: Date
    },
    socialData: {
      sentiment: Number,
      volume: Number,
      platform: String,
      timestamp: Date
    }
  },
  aiAnalysis: {
    riskScore: {
      type: Number,
      required: true,
      min: 0,
      max: 100
    },
    confidence: {
      type: Number,
      required: true,
      min: 0,
      max: 100
    },
    factors: [String],
    timestamp: {
      type: Date,
      default: Date.now
    }
  },
  status: {
    type: String,
    enum: ['Active', 'Resolved', 'False Alarm'],
    default: 'Active'
  },
  notificationsSent: [{
    type: {
      type: String,
      enum: ['Push', 'Email', 'In-App']
    },
    timestamp: Date,
    recipients: Number
  }],
  verifiedBy: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  resolutionDetails: {
    resolvedAt: Date,
    resolvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    resolution: String
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Indexes for efficient querying
warningSignSchema.index({ projectName: 1, blockchainNetwork: 1 });
warningSignSchema.index({ contractAddress: 1 });
warningSignSchema.index({ riskLevel: 1 });
warningSignSchema.index({ status: 1 });
warningSignSchema.index({ 'aiAnalysis.riskScore': -1 });

// Method to update risk level based on new evidence
warningSignSchema.methods.updateRiskLevel = async function(newEvidence) {
  // Update evidence
  if (newEvidence.onChainData) {
    this.evidence.onChainData = { ...this.evidence.onChainData, ...newEvidence.onChainData };
  }
  if (newEvidence.marketData) {
    this.evidence.marketData = { ...this.evidence.marketData, ...newEvidence.marketData };
  }
  if (newEvidence.socialData) {
    this.evidence.socialData = { ...this.evidence.socialData, ...newEvidence.socialData };
  }

  // Recalculate risk level based on combined evidence
  const totalRiskScore = this.aiAnalysis.riskScore;
  if (totalRiskScore >= 80) this.riskLevel = 'Critical';
  else if (totalRiskScore >= 60) this.riskLevel = 'High';
  else if (totalRiskScore >= 40) this.riskLevel = 'Medium';
  else this.riskLevel = 'Low';

  await this.save();
};

// Method to resolve warning
warningSignSchema.methods.resolveWarning = async function(userId, resolution) {
  this.status = 'Resolved';
  this.resolutionDetails = {
    resolvedAt: new Date(),
    resolvedBy: userId,
    resolution
  };
  await this.save();
};

// Method to mark as false alarm
warningSignSchema.methods.markAsFalseAlarm = async function(userId, explanation) {
  this.status = 'False Alarm';
  this.resolutionDetails = {
    resolvedAt: new Date(),
    resolvedBy: userId,
    resolution: `False Alarm: ${explanation}`
  };
  await this.save();
};

const WarningSign = mongoose.model('WarningSign', warningSignSchema);

module.exports = WarningSign;