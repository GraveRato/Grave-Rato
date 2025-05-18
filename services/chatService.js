const WebSocket = require('ws');
const ChatMessage = require('../models/ChatMessage');
const aiService = require('./aiService');
const logger = require('../src/utils/logger');

class ChatService {
  constructor() {
    this.wss = null;
    this.rooms = new Map(); // roomId -> Set of WebSocket connections
  }

  /**
   * Initialize WebSocket server
   * @param {WebSocket.Server} wss 
   */
  initializeWebSocket(wss) {
    this.wss = wss;

    this.wss.on('connection', (ws) => {
      ws.isAlive = true;

      // Handle ping-pong for connection health check
      ws.on('pong', () => {
        ws.isAlive = true;
      });

      // Handle incoming messages
      ws.on('message', async (data) => {
        try {
          const message = JSON.parse(data);
          await this.handleMessage(ws, message);
        } catch (error) {
          logger.error(`Error handling WebSocket message: ${error.message}`);
          ws.send(JSON.stringify({
            type: 'error',
            error: 'Invalid message format'
          }));
        }
      });

      // Handle client disconnection
      ws.on('close', () => {
        this.handleDisconnection(ws);
      });
    });

    // Setup periodic health checks
    this.setupHealthCheck();
  }

  /**
   * Handle incoming messages
   * @param {WebSocket} ws 
   * @param {Object} message 
   */
  async handleMessage(ws, message) {
    switch (message.type) {
      case 'join':
        await this.handleJoinRoom(ws, message);
        break;
      case 'leave':
        await this.handleLeaveRoom(ws, message);
        break;
      case 'chat':
        await this.handleChatMessage(ws, message);
        break;
      default:
        ws.send(JSON.stringify({
          type: 'error',
          error: 'Unknown message type'
        }));
    }
  }

  /**
   * Handle room join requests
   * @param {WebSocket} ws 
   * @param {Object} message 
   */
  async handleJoinRoom(ws, message) {
    const { roomId, userId } = message;

    // Create room if it doesn't exist
    if (!this.rooms.has(roomId)) {
      this.rooms.set(roomId, new Set());
    }

    // Add connection to room
    const room = this.rooms.get(roomId);
    room.add(ws);

    // Store room and user info in connection
    ws.roomId = roomId;
    ws.userId = userId;

    // Send recent messages
    const recentMessages = await this.getRecentMessages(roomId);
    ws.send(JSON.stringify({
      type: 'history',
      messages: recentMessages
    }));

    // Notify room about new user
    this.broadcastToRoom(roomId, {
      type: 'system',
      content: `User ${userId} joined the room`
    }, ws);

    logger.info(`User ${userId} joined room ${roomId}`);
  }

  /**
   * Handle room leave requests
   * @param {WebSocket} ws 
   * @param {Object} message 
   */
  async handleLeaveRoom(ws, message) {
    const { roomId } = message;
    
    if (this.rooms.has(roomId)) {
      const room = this.rooms.get(roomId);
      room.delete(ws);

      // Remove room if empty
      if (room.size === 0) {
        this.rooms.delete(roomId);
      } else {
        // Notify room about user leaving
        this.broadcastToRoom(roomId, {
          type: 'system',
          content: `User ${ws.userId} left the room`
        }, ws);
      }
    }

    delete ws.roomId;
    delete ws.userId;

    logger.info(`User ${ws.userId} left room ${roomId}`);
  }

  /**
   * Handle chat messages
   * @param {WebSocket} ws 
   * @param {Object} message 
   */
  async handleChatMessage(ws, message) {
    const { content, metadata, anonymous } = message;
    const roomId = ws.roomId;
    const userId = ws.userId;

    if (!roomId || !userId) {
      ws.send(JSON.stringify({
        type: 'error',
        error: 'Not joined to a room'
      }));
      return;
    }

    try {
      // Analyze message with AI
      const analysis = await aiService.analyzeChatMessage(content);

      // Create and save message
      const chatMessage = new ChatMessage({
        roomId,
        content,
        messageType: 'text',
        metadata,
        sender: {
          userId,
          anonymous: anonymous || false
        },
        aiAnalysis: analysis
      });

      const savedMessage = await chatMessage.save();

      // Broadcast message to room
      this.broadcastToRoom(roomId, {
        type: 'chat',
        message: savedMessage
      });

      // Check for high-risk indicators
      if (analysis.riskIndicators.length > 0) {
        this.notifyModerators(savedMessage);
      }

      logger.info(`New message in room ${roomId} from user ${userId}`);
    } catch (error) {
      logger.error(`Error handling chat message: ${error.message}`);
      ws.send(JSON.stringify({
        type: 'error',
        error: 'Failed to process message'
      }));
    }
  }

  /**
   * Handle client disconnection
   * @param {WebSocket} ws 
   */
  handleDisconnection(ws) {
    if (ws.roomId) {
      this.handleLeaveRoom(ws, { roomId: ws.roomId });
    }
    ws.terminate();
  }

  /**
   * Setup periodic health checks
   */
  setupHealthCheck() {
    const interval = setInterval(() => {
      this.wss.clients.forEach((ws) => {
        if (ws.isAlive === false) {
          this.handleDisconnection(ws);
          return;
        }

        ws.isAlive = false;
        ws.ping();
      });
    }, 30000);

    this.wss.on('close', () => {
      clearInterval(interval);
    });
  }

  /**
   * Broadcast message to all clients in a room
   * @param {string} roomId 
   * @param {Object} message 
   * @param {WebSocket} exclude Client to exclude from broadcast
   */
  broadcastToRoom(roomId, message, exclude = null) {
    const room = this.rooms.get(roomId);
    if (!room) return;

    const messageStr = JSON.stringify(message);
    room.forEach((client) => {
      if (client !== exclude && client.readyState === WebSocket.OPEN) {
        client.send(messageStr);
      }
    });
  }

  /**
   * Get recent messages for a room
   * @param {string} roomId 
   * @param {number} limit 
   * @returns {Promise<Array>}
   */
  async getRecentMessages(roomId, limit = 50) {
    try {
      return await ChatMessage.find({
        roomId,
        visibility: 'public'
      })
        .sort({ createdAt: -1 })
        .limit(limit);
    } catch (error) {
      logger.error(`Error fetching recent messages: ${error.message}`);
      return [];
    }
  }

  /**
   * Notify moderators about high-risk messages
   * @param {Object} message 
   */
  async notifyModerators(message) {
    // TODO: Implement moderator notification system
    logger.warn(`High-risk message detected in room ${message.roomId}`);
  }

  /**
   * Get room statistics
   * @param {string} roomId 
   * @returns {Promise<Object>}
   */
  async getRoomStats(roomId) {
    try {
      const stats = {
        activeUsers: this.rooms.get(roomId)?.size || 0,
        messageCount: await ChatMessage.countDocuments({ roomId }),
        lastActivity: await ChatMessage.findOne({ roomId }).sort({ createdAt: -1 }).select('createdAt')
      };

      return stats;
    } catch (error) {
      logger.error(`Error getting room stats: ${error.message}`);
      throw error;
    }
  }
}

module.exports = new ChatService();