const crypto = require('crypto');
const logger = require('./logger');

class Encryption {
  constructor() {
    this.algorithm = 'aes-256-gcm';
    this.keyLength = 32; // 256 bits
    this.ivLength = 16; // 128 bits
    this.saltLength = 64; // 512 bits
    this.tagLength = 16; // 128 bits
  }

  /**
   * Generate encryption key from password
   * @param {string} password 
   * @param {Buffer} salt 
   * @returns {Buffer}
   */
  async generateKey(password, salt) {
    return new Promise((resolve, reject) => {
      crypto.pbkdf2(
        password,
        salt,
        100000, // iterations
        this.keyLength,
        'sha512',
        (err, key) => {
          if (err) reject(err);
          else resolve(key);
        }
      );
    });
  }

  /**
   * Encrypt data
   * @param {string} data 
   * @param {string} password Optional password for encryption
   * @returns {Promise<string>}
   */
  async encrypt(data, password = process.env.ENCRYPTION_KEY) {
    try {
      // Generate salt and IV
      const salt = crypto.randomBytes(this.saltLength);
      const iv = crypto.randomBytes(this.ivLength);

      // Generate key from password and salt
      const key = await this.generateKey(password, salt);

      // Create cipher
      const cipher = crypto.createCipheriv(this.algorithm, key, iv);

      // Encrypt data
      let encrypted = cipher.update(data, 'utf8', 'hex');
      encrypted += cipher.final('hex');

      // Get authentication tag
      const tag = cipher.getAuthTag();

      // Combine all components
      const result = {
        encrypted,
        iv: iv.toString('hex'),
        salt: salt.toString('hex'),
        tag: tag.toString('hex')
      };

      return JSON.stringify(result);
    } catch (error) {
      logger.error(`Encryption error: ${error.message}`);
      throw error;
    }
  }

  /**
   * Decrypt data
   * @param {string} encryptedData 
   * @param {string} password Optional password for decryption
   * @returns {Promise<string>}
   */
  async decrypt(encryptedData, password = process.env.ENCRYPTION_KEY) {
    try {
      // Parse encrypted data
      const { encrypted, iv, salt, tag } = JSON.parse(encryptedData);

      // Convert components back to buffers
      const ivBuffer = Buffer.from(iv, 'hex');
      const saltBuffer = Buffer.from(salt, 'hex');
      const tagBuffer = Buffer.from(tag, 'hex');

      // Generate key from password and salt
      const key = await this.generateKey(password, saltBuffer);

      // Create decipher
      const decipher = crypto.createDecipheriv(this.algorithm, key, ivBuffer);
      decipher.setAuthTag(tagBuffer);

      // Decrypt data
      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');

      return decrypted;
    } catch (error) {
      logger.error(`Decryption error: ${error.message}`);
      throw error;
    }
  }

  /**
   * Generate hash for data
   * @param {Object|string} data 
   * @returns {string}
   */
  generateHash(data) {
    try {
      const content = typeof data === 'string' ? data : JSON.stringify(data);
      return crypto
        .createHash('sha256')
        .update(content)
        .digest('hex');
    } catch (error) {
      logger.error(`Hash generation error: ${error.message}`);
      throw error;
    }
  }

  /**
   * Generate random token
   * @param {number} length Token length
   * @returns {string}
   */
  generateToken(length = 32) {
    try {
      return crypto
        .randomBytes(Math.ceil(length / 2))
        .toString('hex')
        .slice(0, length);
    } catch (error) {
      logger.error(`Token generation error: ${error.message}`);
      throw error;
    }
  }

  /**
   * Verify hash
   * @param {Object|string} data 
   * @param {string} hash 
   * @returns {boolean}
   */
  verifyHash(data, hash) {
    try {
      const generatedHash = this.generateHash(data);
      return crypto.timingSafeEqual(
        Buffer.from(generatedHash),
        Buffer.from(hash)
      );
    } catch (error) {
      logger.error(`Hash verification error: ${error.message}`);
      return false;
    }
  }
}

module.exports = new Encryption();