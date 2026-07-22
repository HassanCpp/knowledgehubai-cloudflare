const crypto = require('crypto');

/**
 * Generates a SHA-256 hash of a buffer.
 * @param {Buffer} buffer 
 * @returns {string} SHA-256 hash string
 */
const generateSHA256 = (buffer) => {
  return crypto.createHash('sha256').update(buffer).digest('hex');
};

module.exports = {
  generateSHA256,
};
