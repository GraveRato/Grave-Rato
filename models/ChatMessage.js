const mongoose = require('mongoose');

const chatMessageSchema = new mongoose.Schema({
  roomId: {
    type: String,
    required: true,
    trim: true
  },
  content: {
    type: String,
    required: true,
    trim: true,
    maxlength: 2000
  },
  messageType: {
    type: String,
    enum: ['text', 'image', 'link', 'evidence'],
    default: 'text'
  },
  metadata: {
    projectName: String,
    contractAddress: String,
    blockchainNetwork: String,
    evidenceType: {
      type: String,
      enum: ['contract_code', 'transaction', 'team_info', 'social_media', 'other']
    },
    evidenceUrl: String
  },
  sender: {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    anonymous: {
      type: Boolean,
      default: false
    },
    reputation: Number
  },
  reactions: {
    likes: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }],
    dislikes: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }],
    flags: [{
      userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      },
      reason: String,
      timestamp: Date
    }]
  },
  aiAnalysis: {
    keywords: [String],
    riskIndicators: [String],
    credibilityScore: {
      type: Number,
      min: 0,
      max: 100
    }
  },
  visibility: {
    type: String,
    enum: ['public', 'premium', 'deleted', 'moderated'],
    default: 'public'
  },
  moderationStatus: {
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending'
    },
    moderatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    moderationTime: Date,
    reason: String
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
chatMessageSchema.index({ roomId: 1, createdAt: -1 });
chatMessageSchema.index({ 'sender.userId': 1 });
chatMessageSchema.index({ visibility: 1 });
chatMessageSchema.index({ 'moderationStatus.status': 1 });

// Virtual for calculating reaction counts
chatMessageSchema.virtual('reactionCounts').get(function() {
  return {
    likes: this.reactions.likes.length,
    dislikes: this.reactions.dislikes.length,
    flags: this.reactions.flags.length
  };
});

// Method to add reaction
chatMessageSchema.methods.addReaction = async function(userId, reactionType) {
  const validReactions = ['likes', 'dislikes'];
  if (!validReactions.includes(reactionType)) throw new Error('Invalid reaction type');

  // Remove any existing reactions from this user
  this.reactions.likes = this.reactions.likes.filter(id => !id.equals(userId));
  this.reactions.dislikes = this.reactions.dislikes.filter(id => !id.equals(userId));

  // Add new reaction
  this.reactions[reactionType].push(userId);
  await this.save();
};

// Method to flag message
chatMessageSchema.methods.flagMessage = async function(userId, reason) {
  const existingFlag = this.reactions.flags.find(flag => flag.userId.equals(userId));
  if (existingFlag) throw new Error('Message already flagged by this user');

  this.reactions.flags.push({
    userId,
    reason,
    timestamp: new Date()
  });

  // Auto-moderate if flag count exceeds threshold
  if (this.reactions.flags.length >= 5) {
    this.visibility = 'moderated';
    this.moderationStatus.status = 'pending';
  }

  await this.save();
};

// Method to moderate message
chatMessageSchema.methods.moderateMessage = async function(moderatorId, status, reason) {
  this.moderationStatus = {
    status,
    moderatedBy: moderatorId,
    moderationTime: new Date(),
    reason
  };

  if (status === 'rejected') {
    this.visibility = 'moderated';
  }

  await this.save();
};

const ChatMessage = mongoose.model('ChatMessage', chatMessageSchema);

module.exports = ChatMessage;