const jwt = require('jsonwebtoken');
const User = require('../../models/User');
const logger = require('./logger');

/**
 * Authenticate user from token
 * @param {string} token JWT token
 * @returns {Promise<Object|null>}
 */
const authenticate = async (token) => {
  try {
    if (!token) return null;

    // Remove Bearer prefix if present
    const tokenString = token.startsWith('Bearer ') ? token.slice(7) : token;

    // Verify token
    const decoded = jwt.verify(tokenString, process.env.JWT_SECRET);

    // Get user
    const user = await User.findById(decoded.id);
    if (!user) return null;

    return user;
  } catch (error) {
    logger.error(`Authentication error: ${error.message}`);
    return null;
  }
};

/**
 * Generate JWT token
 * @param {Object} user User object
 * @returns {string} JWT token
 */
const generateToken = (user) => {
  return jwt.sign(
    { id: user.id },
    process.env.JWT_SECRET,
    { expiresIn: '24h' }
  );
};

/**
 * Check if user has required role
 * @param {Object} user User object
 * @param {string} requiredRole Required role
 * @returns {boolean}
 */
const checkRole = (user, requiredRole) => {
  return user.role === requiredRole || user.role === 'admin';
};

/**
 * Check if user has premium access
 * @param {Object} user User object
 * @returns {boolean}
 */
const checkPremiumAccess = (user) => {
  return user.isPremium || user.role === 'admin';
};

/**
 * Generate password reset token
 * @param {Object} user User object
 * @returns {string} Reset token
 */
const generateResetToken = (user) => {
  return jwt.sign(
    { id: user.id, type: 'reset' },
    process.env.JWT_SECRET,
    { expiresIn: '1h' }
  );
};

/**
 * Verify password reset token
 * @param {string} token Reset token
 * @returns {Promise<Object|null>}
 */
const verifyResetToken = async (token) => {
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.type !== 'reset') return null;

    const user = await User.findById(decoded.id);
    return user;
  } catch (error) {
    logger.error(`Reset token verification error: ${error.message}`);
    return null;
  }
};

module.exports = {
  authenticate,
  generateToken,
  checkRole,
  checkPremiumAccess,
  generateResetToken,
  verifyResetToken
};