const { AuthenticationError, ForbiddenError } = require('apollo-server-express');
const jwt = require('jsonwebtoken');
const User = require('../src/models/User');
const RugCoinTombstone = require('../src/models/RugCoinTombstone');
const InsiderInformation = require('../src/models/InsiderInformation');
const WarningSign = require('../src/models/WarningSign');
const ChatMessage = require('../src/models/ChatMessage');
const { pubsub } = require('../src/config/server');
const logger = require('../src/utils/logger');

// Subscription triggers
const EVENTS = {
  WARNING_SIGN_CREATED: 'WARNING_SIGN_CREATED',
  WARNING_SIGN_UPDATED: 'WARNING_SIGN_UPDATED',
  CHAT_MESSAGE_SENT: 'CHAT_MESSAGE_SENT',
  CHAT_MESSAGE_UPDATED: 'CHAT_MESSAGE_UPDATED'
};

// Helper function to check authentication
const checkAuth = (context) => {
  const user = context.user;
  if (!user) throw new AuthenticationError('You must be logged in');
  return user;
};

// Helper function to check permissions
const checkPermission = (user, requiredRole) => {
  if (user.role !== requiredRole && user.role !== 'admin') {
    throw new ForbiddenError('Insufficient permissions');
  }
};

const resolvers = {
  Query: {
    // User queries
    me: (_, __, context) => {
      return checkAuth(context);
    },
    user: async (_, { id }, context) => {
      checkAuth(context);
      return await User.findById(id);
    },
    users: async (_, { limit = 10, offset = 0 }, context) => {
      checkAuth(context);
      return await User.find().limit(limit).skip(offset);
    },

    // RugCoinTombstone queries
    rugCoinTombstone: async (_, { id }) => {
      return await RugCoinTombstone.findById(id)
        .populate('verifiedBy')
        .populate('submittedBy');
    },
    rugCoinTombstones: async (_, { limit = 10, offset = 0, network, verificationStatus }) => {
      const query = {};
      if (network) query.blockchainNetwork = network;
      if (verificationStatus) query.verificationStatus = verificationStatus;

      return await RugCoinTombstone.find(query)
        .populate('verifiedBy')
        .populate('submittedBy')
        .limit(limit)
        .skip(offset)
        .sort({ createdAt: -1 });
    },
    searchRugCoinTombstones: async (_, { query }) => {
      return await RugCoinTombstone.find({
        $or: [
          { projectName: { $regex: query, $options: 'i' } },
          { tokenSymbol: { $regex: query, $options: 'i' } }
        ]
      }).populate('verifiedBy').populate('submittedBy');
    },

    // InsiderInformation queries
    insiderInformation: async (_, { id }, context) => {
      const info = await InsiderInformation.findById(id);
      if (info) await info.incrementViews();
      return info;
    },
    insiderInformations: async (_, { limit = 10, offset = 0, riskLevel, category }) => {
      const query = {};
      if (riskLevel) query.riskLevel = riskLevel;
      if (category) query.category = category;

      return await InsiderInformation.find(query)
        .limit(limit)
        .skip(offset)
        .sort({ credibilityScore: -1 });
    },
    searchInsiderInformations: async (_, { query }) => {
      return await InsiderInformation.find({
        $or: [
          { title: { $regex: query, $options: 'i' } },
          { projectName: { $regex: query, $options: 'i' } }
        ]
      });
    },

    // WarningSign queries
    warningSign: async (_, { id }) => {
      return await WarningSign.findById(id).populate('verifiedBy');
    },
    warningSigns: async (_, { limit = 10, offset = 0, riskLevel, status }) => {
      const query = {};
      if (riskLevel) query.riskLevel = riskLevel;
      if (status) query.status = status;

      return await WarningSign.find(query)
        .populate('verifiedBy')
        .limit(limit)
        .skip(offset)
        .sort({ 'aiAnalysis.riskScore': -1 });
    },
    activeWarningSigns: async () => {
      return await WarningSign.find({ status: 'Active' })
        .populate('verifiedBy')
        .sort({ 'aiAnalysis.riskScore': -1 });
    },

    // ChatMessage queries
    chatMessage: async (_, { id }) => {
      return await ChatMessage.findById(id);
    },
    chatMessages: async (_, { roomId, limit = 50, offset = 0 }) => {
      return await ChatMessage.find({ roomId, visibility: 'public' })
        .limit(limit)
        .skip(offset)
        .sort({ createdAt: -1 });
    }
  },

  Mutation: {
    // User mutations
    register: async (_, { input }) => {
      const { username, email, password } = input;

      // Check if user already exists
      const existingUser = await User.findOne({ $or: [{ email }, { username }] });
      if (existingUser) {
        throw new Error('User already exists');
      }

      // Create new user
      const user = new User({ username, email, password });
      await user.save();

      // Generate token
      const token = jwt.sign(
        { id: user.id },
        process.env.JWT_SECRET,
        { expiresIn: '24h' }
      );

      return { token, user };
    },

    login: async (_, { email, password }) => {
      // Find user
      const user = await User.findOne({ email });
      if (!user) {
        throw new AuthenticationError('Invalid credentials');
      }

      // Check password
      const valid = await user.comparePassword(password);
      if (!valid) {
        throw new AuthenticationError('Invalid credentials');
      }

      // Update last login
      user.lastLogin = new Date();
      await user.save();

      // Generate token
      const token = jwt.sign(
        { id: user.id },
        process.env.JWT_SECRET,
        { expiresIn: '24h' }
      );

      return { token, user };
    },

    updateUser: async (_, { id, input }, context) => {
      const currentUser = checkAuth(context);
      if (currentUser.id !== id && currentUser.role !== 'admin') {
        throw new ForbiddenError('Not authorized');
      }

      return await User.findByIdAndUpdate(id, input, { new: true });
    },

    deleteUser: async (_, { id }, context) => {
      const currentUser = checkAuth(context);
      checkPermission(currentUser, 'admin');

      await User.findByIdAndDelete(id);
      return true;
    },

    // RugCoinTombstone mutations
    createRugCoinTombstone: async (_, { input }, context) => {
      const user = checkAuth(context);
      
      const tombstone = new RugCoinTombstone({
        ...input,
        submittedBy: user.id
      });

      return await tombstone.save();
    },

    updateRugCoinTombstone: async (_, { id, input }, context) => {
      const user = checkAuth(context);
      checkPermission(user, 'moderator');

      return await RugCoinTombstone.findByIdAndUpdate(id, input, { new: true });
    },

    verifyRugCoinTombstone: async (_, { id, status }, context) => {
      const user = checkAuth(context);
      checkPermission(user, 'moderator');

      const tombstone = await RugCoinTombstone.findById(id);
      await tombstone.updateVerificationStatus(status, user.id);
      return tombstone;
    },

    deleteRugCoinTombstone: async (_, { id }, context) => {
      const user = checkAuth(context);
      checkPermission(user, 'admin');

      await RugCoinTombstone.findByIdAndDelete(id);
      return true;
    },

    // InsiderInformation mutations
    submitInsiderInformation: async (_, { input }, context) => {
      const user = checkAuth(context);
      
      const info = new InsiderInformation({
        ...input,
        submissionHash: Math.random().toString(36).substring(2),
        encryptedSubmitterInfo: 'encrypted_data' // TODO: Implement actual encryption
      });

      return await info.save();
    },

    verifyInsiderInformation: async (_, { id, status, note }, context) => {
      const user = checkAuth(context);
      checkPermission(user, 'moderator');

      const info = await InsiderInformation.findById(id);
      await info.updateVerificationStatus(status, user.id, note);
      return info;
    },

    updateInsiderInformation: async (_, { id, input }, context) => {
      const user = checkAuth(context);
      checkPermission(user, 'moderator');

      return await InsiderInformation.findByIdAndUpdate(id, input, { new: true });
    },

    deleteInsiderInformation: async (_, { id }, context) => {
      const user = checkAuth(context);
      checkPermission(user, 'admin');

      await InsiderInformation.findByIdAndDelete(id);
      return true;
    },

    // WarningSign mutations
    createWarningSign: async (_, { input }, context) => {
      const user = checkAuth(context);
      
      const warning = new WarningSign({
        ...input,
        aiAnalysis: {
          riskScore: 0,
          confidence: 0,
          factors: [],
          timestamp: new Date()
        }
      });

      const savedWarning = await warning.save();
      pubsub.publish(EVENTS.WARNING_SIGN_CREATED, { warningSignCreated: savedWarning });
      return savedWarning;
    },

    updateWarningSign: async (_, { id, input }, context) => {
      const user = checkAuth(context);
      checkPermission(user, 'moderator');

      const warning = await WarningSign.findByIdAndUpdate(id, input, { new: true });
      pubsub.publish(EVENTS.WARNING_SIGN_UPDATED, { warningSignUpdated: warning });
      return warning;
    },

    resolveWarningSign: async (_, { id, resolution }, context) => {
      const user = checkAuth(context);
      checkPermission(user, 'moderator');

      const warning = await WarningSign.findById(id);
      await warning.resolveWarning(user.id, resolution);
      pubsub.publish(EVENTS.WARNING_SIGN_UPDATED, { warningSignUpdated: warning });
      return warning;
    },

    markWarningSignAsFalseAlarm: async (_, { id, explanation }, context) => {
      const user = checkAuth(context);
      checkPermission(user, 'moderator');

      const warning = await WarningSign.findById(id);
      await warning.markAsFalseAlarm(user.id, explanation);
      pubsub.publish(EVENTS.WARNING_SIGN_UPDATED, { warningSignUpdated: warning });
      return warning;
    },

    // ChatMessage mutations
    sendChatMessage: async (_, { input }, context) => {
      const user = checkAuth(context);
      
      const message = new ChatMessage({
        ...input,
        sender: {
          userId: user.id,
          anonymous: input.anonymous || false,
          reputation: user.reputation
        }
      });

      const savedMessage = await message.save();
      pubsub.publish(EVENTS.CHAT_MESSAGE_SENT, {
        chatMessageSent: savedMessage,
        roomId: input.roomId
      });
      return savedMessage;
    },

    reactToChatMessage: async (_, { id, reactionType }, context) => {
      const user = checkAuth(context);
      
      const message = await ChatMessage.findById(id);
      await message.addReaction(user.id, reactionType);
      pubsub.publish(EVENTS.CHAT_MESSAGE_UPDATED, {
        chatMessageUpdated: message,
        roomId: message.roomId
      });
      return message;
    },

    flagChatMessage: async (_, { id, reason }, context) => {
      const user = checkAuth(context);
      
      const message = await ChatMessage.findById(id);
      await message.flagMessage(user.id, reason);
      pubsub.publish(EVENTS.CHAT_MESSAGE_UPDATED, {
        chatMessageUpdated: message,
        roomId: message.roomId
      });
      return message;
    },

    moderateChatMessage: async (_, { id, status, reason }, context) => {
      const user = checkAuth(context);
      checkPermission(user, 'moderator');

      const message = await ChatMessage.findById(id);
      await message.moderateMessage(user.id, status, reason);
      pubsub.publish(EVENTS.CHAT_MESSAGE_UPDATED, {
        chatMessageUpdated: message,
        roomId: message.roomId
      });
      return message;
    }
  },

  Subscription: {
    warningSignCreated: {
      subscribe: () => pubsub.asyncIterator([EVENTS.WARNING_SIGN_CREATED])
    },
    warningSignUpdated: {
      subscribe: () => pubsub.asyncIterator([EVENTS.WARNING_SIGN_UPDATED])
    },
    chatMessageSent: {
      subscribe: (_, { roomId }) =>
        pubsub.asyncIterator([`${EVENTS.CHAT_MESSAGE_SENT}.${roomId}`])
    },
    chatMessageUpdated: {
      subscribe: (_, { roomId }) =>
        pubsub.asyncIterator([`${EVENTS.CHAT_MESSAGE_UPDATED}.${roomId}`])
    }
  }
};

module.exports = resolvers;