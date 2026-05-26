import crypto from 'crypto';

/**
 * Native, zero-dependency password secure hashing utility
 */
export const CryptoUtils = {
  /**
   * Hashes a plain password using PBKDF2/scrypt.
   */
  hashPassword(password: string): string {
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = crypto.scryptSync(password, salt, 64).toString('hex');
    return `${salt}:${hash}`;
  },

  /**
   * Verifies a password against the stored salt:hash format.
   */
  verifyPassword(password: string, storedValue: string): boolean {
    const [salt, originalHash] = storedValue.split(':');
    if (!salt || !originalHash) return false;
    const verifyHash = crypto.scryptSync(password, salt, 64).toString('hex');
    return verifyHash === originalHash;
  }
};
