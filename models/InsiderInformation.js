const mongoose = require('mongoose');

const insiderInformationSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true,
    minlength: 5,
    maxlength: 200
  },
  content: {
    type: String,
    required: true,
    trim: true,
    minlength: 20
  },
  projectName: {
    type: String,
    required: true,
    trim: true
  },
  blockchainNetwork: {
    type: String,
    required: true,
    enum: ['Ethereum', 'BSC', 'Solana', 'Polygon', 'Other']
  },
  contractAddress: {
    type: String,
    trim: true
  },
  riskLevel: {
    type: String,
    required: true,
    enum: ['Low', 'Medium', 'High', 'Critical'],
    default: 'Medium'
  },
  category: [{
    type: String,
    required: true,
    enum: [
      'Team Background',
      'Token Distribution',
      'Contract Vulnerability',
      'Market Manipulation',
      'Insider Trading',
      'Other'
    ]
  }],
  evidence: [{
    type: String,
    trim: true
  }],
  verificationStatus: {
    type: String,
    enum: ['Pending', 'Verified', 'Rejected'],
    default: 'Pending'
  },
  credibilityScore: {
    type: Number,
    default: 0,
    min: 0,
    max: 100
  },
  submissionHash: {
    type: String,
    required: true,
    unique: true
  },
  encryptedSubmitterInfo: {
    type: String,
    required: true
  },
  views: {
    type: Number,
    default: 0
  },
  likes: {
    type: Number,
    default: 0
  },
  reports: [{
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    reason: String,
    timestamp: {
      type: Date,
      default: Date.now
    }
  }],
  moderatorNotes: [{
    note: String,
    moderatorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    timestamp: {
      type: Date,
      default: Date.now
    }
  }],
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
insiderInformationSchema.index({ projectName: 1, blockchainNetwork: 1 });
insiderInformationSchema.index({ verificationStatus: 1 });
insiderInformationSchema.index({ credibilityScore: -1 });
insiderInformationSchema.index({ submissionHash: 1 }, { unique: true });

// Method to update verification status
insiderInformationSchema.methods.updateVerificationStatus = async function(status, moderatorId, note) {
  this.verificationStatus = status;
  if (note) {
    this.moderatorNotes.push({
      note,
      moderatorId
    });
  }
  await this.save();
};

// Method to update credibility score
insiderInformationSchema.methods.updateCredibilityScore = async function(score) {
  this.credibilityScore = Math.min(Math.max(score, 0), 100);
  await this.save();
};

// Method to increment view count
insiderInformationSchema.methods.incrementViews = async function() {
  this.views += 1;
  await this.save();
};

const InsiderInformation = mongoose.model('InsiderInformation', insiderInformationSchema);

module.exports = InsiderInformation;