const encryption = require('../../src/utils/encryption');
const { expect } = require('chai');

describe('Encryption Module Tests', () => {
  const testData = 'Hello, World!';
  const testPassword = 'test-password-123';
  let encryptedData;

  describe('encrypt()', () => {
    it('should encrypt data successfully', async () => {
      encryptedData = await encryption.encrypt(testData, testPassword);
      expect(encryptedData).to.be.a('string');
      const parsed = JSON.parse(encryptedData);
      expect(parsed).to.have.all.keys('encrypted', 'iv', 'salt', 'tag');
    });

    it('should encrypt data with default password', async () => {
      const result = await encryption.encrypt(testData);
      expect(result).to.be.a('string');
      const parsed = JSON.parse(result);
      expect(parsed).to.have.all.keys('encrypted', 'iv', 'salt', 'tag');
    });
  });

  describe('decrypt()', () => {
    it('should decrypt data successfully', async () => {
      const decrypted = await encryption.decrypt(encryptedData, testPassword);
      expect(decrypted).to.equal(testData);
    });

    it('should throw error for invalid encrypted data', async () => {
      try {
        await encryption.decrypt('invalid-data', testPassword);
        throw new Error('Should have thrown an error');
      } catch (error) {
        expect(error.message).to.include('Unexpected token');
      }
    });
  });

  describe('generateHash()', () => {
    it('should generate hash for string data', () => {
      const hash = encryption.generateHash(testData);
      expect(hash).to.be.a('string');
      expect(hash).to.have.lengthOf(64); // SHA-256 produces 64 character hex string
    });

    it('should generate hash for object data', () => {
      const objData = { test: 'data' };
      const hash = encryption.generateHash(objData);
      expect(hash).to.be.a('string');
      expect(hash).to.have.lengthOf(64);
    });
  });

  describe('generateToken()', () => {
    it('should generate token with default length', () => {
      const token = encryption.generateToken();
      expect(token).to.be.a('string');
      expect(token).to.have.lengthOf(32);
    });

    it('should generate token with custom length', () => {
      const length = 16;
      const token = encryption.generateToken(length);
      expect(token).to.be.a('string');
      expect(token).to.have.lengthOf(length);
    });
  });

  describe('verifyHash()', () => {
    it('should verify correct hash', () => {
      const hash = encryption.generateHash(testData);
      const result = encryption.verifyHash(testData, hash);
      expect(result).to.be.true;
    });

    it('should reject incorrect hash', () => {
      const hash = encryption.generateHash(testData);
      const result = encryption.verifyHash('wrong-data', hash);
      expect(result).to.be.false;
    });
  });
});