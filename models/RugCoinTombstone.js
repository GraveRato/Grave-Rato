const mongoose = require('mongoose');

const rugCoinTombstoneSchema = new mongoose.Schema({
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
  launchDate: {
    type: Date,
    required: true
  },
  rugPullDate: {
    type: Date,
    required: true
  },
  totalLoss: {
    type: Number,
    required: true,
    min: 0
  },
  affectedUsers: {
    type: Number,
    required: true,
    min: 0
  },
  fraudTactics: [{
    type: String,
    enum: [
      'Liquidity Removal',
      'Team Token Dump',
      'Honeypot',
      'Flash Loan Attack',
      'Team Abandonment',
      'Other'
    ]
  }],
  evidence: [{
    type: String,
    required: true,
    trim: true
  }],
  teamInformation: {
    knownMembers: [{
      name: String,
      role: String,
      socialLinks: [String]
    }],
    anonymous: {
      type: Boolean,
      default: true
    }
  },
  tradingData: {
    initialPrice: Number,
    peakPrice: Number,
    rugPullPrice: Number,
    totalVolume: Number
  },
  verificationStatus: {
    type: String,
    enum: ['Pending', 'Verified', 'Disputed'],
    default: 'Pending'
  },
  verifiedBy: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  submittedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
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

// Index for efficient querying
rugCoinTombstoneSchema.index({ tokenSymbol: 1, blockchainNetwork: 1 }, { unique: true });
rugCoinTombstoneSchema.index({ contractAddress: 1 }, { unique: true });
rugCoinTombstoneSchema.index({ verificationStatus: 1 });
rugCoinTombstoneSchema.index({ rugPullDate: -1 });

// Virtual for calculating time since rug pull
rugCoinTombstoneSchema.virtual('timeSinceRugPull').get(function() {
  return Date.now() - this.rugPullDate;
});

// Method to update verification status
rugCoinTombstoneSchema.methods.updateVerificationStatus = async function(status, userId) {
  this.verificationStatus = status;
  if (!this.verifiedBy.includes(userId)) {
    this.verifiedBy.push(userId);
  }
  await this.save();
};

const RugCoinTombstone = mongoose.model('RugCoinTombstone', rugCoinTombstoneSchema);

module.exports = RugCoinTombstone;