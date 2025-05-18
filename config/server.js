require('dotenv').config();
const express = require('express');
const { ApolloServer } = require('@apollo/server');
const { expressMiddleware } = require('@apollo/server/express4');
const { WebSocketServer } = require('ws');
const http = require('http');
const logger = require('../src/utils/logger');
const connectDB = require('./db');
const typeDefs = require('../api/schema');
const resolvers = require('../api/resolvers');
const { authenticate } = require('../src/utils/auth');
const chatService = require('../src/services/chatService');

// Express app setup
const app = express();
app.use(express.json());

// Create HTTP server
const httpServer = http.createServer(app);

// WebSocket server setup
const wss = new WebSocketServer({ server: httpServer });
chatService.initializeWebSocket(wss);

// Apollo Server setup
const server = new ApolloServer({
  typeDefs,
  resolvers,
  formatError: (error) => {
    logger.error('GraphQL Error:', error);
    return error;
  },
  context: async ({ req }) => {
    // Get the user token from the headers
    const token = req.headers.authorization || '';
    // Try to retrieve a user with the token
    const user = await authenticate(token);
    return { user };
  },
});

// Start function
const startServer = async () => {
  try {
    // Connect to MongoDB
    await connectDB();

    // Start Apollo Server
    await server.start();

    // Apply Apollo middleware
    app.use('/graphql', expressMiddleware(server));

    // Start HTTP server
    const PORT = process.env.PORT || 4000;
    httpServer.listen(PORT, () => {
      logger.info(`🚀 Server ready at http://localhost:${PORT}/graphql`);
      logger.info(`🔌 WebSocket server is running on ws://localhost:${PORT}`);
    });

  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
};

// Handle process termination
process.on('SIGTERM', () => {
  logger.info('SIGTERM received. Shutting down gracefully...');
  httpServer.close(() => {
    logger.info('HTTP server closed');
    process.exit(0);
  });
});

startServer();