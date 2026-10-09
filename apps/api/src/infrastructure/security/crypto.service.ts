import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { env } from '../../config/env.js';

export class CryptoService {
  private static readonly ALGORITHM = 'aes-256-gcm';
  private static readonly IV_LENGTH = 12; // 96 bits recomendado para GCM

  // Obtener clave maestra de 32 bytes (256 bits)
  private static getMasterKey(): Buffer {
    return Buffer.from(env.MIKROMANAGER_ENCRYPTION_KEY, 'hex');
  }

  /**
   * Cifra una contraseña de router con AES-256-GCM
   */
  static encryptPassword(plainPassword: string): {
    encryptedText: string;
    iv: string;
    authTag: string;
  } {
    const iv = crypto.randomBytes(this.IV_LENGTH);
    const key = this.getMasterKey();

    const cipher = crypto.createCipheriv(this.ALGORITHM, key, iv);
    let encrypted = cipher.update(plainPassword, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const authTag = cipher.getAuthTag().toString('hex');

    return {
      encryptedText: encrypted,
      iv: iv.toString('hex'),
      authTag,
    };
  }

  /**
   * Descifra una contraseña de router validando el AuthTag
   */
  static decryptPassword(
    encryptedText: string,
    ivHex: string,
    authTagHex: string
  ): string {
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    const key = this.getMasterKey();

    const decipher = crypto.createDecipheriv(this.ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  }

  /**
   * Hash de contraseñas de usuarios con Bcrypt (12 rondas)
   */
  static async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, 12);
  }

  /**
   * Comparación segura de contraseñas de usuarios
   */
  static async verifyPassword(
    plainPassword: string,
    hash: string
  ): Promise<boolean> {
    return bcrypt.compare(plainPassword, hash);
  }
}
