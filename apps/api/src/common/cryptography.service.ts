import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

/**
 * AES-256-GCM: IV de 12 bytes, tag de 16 bytes.
 * Formato armazenado: base64(iv) + ':' + base64(authTag) + ':' + base64(ciphertext)
 * Não determinístico por design (IV aleatório) — queries `where: { cpf }` não funcionam.
 */
const AES_ALGO = 'aes-256-gcm';
const IV_BYTES = 12;

@Injectable()
export class CryptographyService {
  private readonly secret: string;

  constructor(private configService: ConfigService) {
    const secret = this.configService.get<string>('JWT_SECRET');
    if (!secret || secret.trim() === '') {
      throw new Error('JWT_SECRET não está configurada. Assinatura HMAC indisponível.');
    }
    this.secret = secret;
  }

  /**
   * Gera um hash SHA-256 de um conteúdo.
   */
  hashContent(content: string): string {
    return crypto.createHash('sha256').update(content).digest('hex');
  }

  /**
   * Assina um conteúdo gerando um HMAC-SHA256.
   * Em uma implementação mais avançada, isso poderia usar chaves RSA/ECDSA por médico.
   */
  sign(content: string, metadata: string): string {
    const dataToSign = `${content}|${metadata}`;
    return crypto.createHmac('sha256', this.secret).update(dataToSign).digest('hex');
  }

  /**
   * Verifica se uma assinatura é válida para um determinado conteúdo e metadados.
   */
  verify(content: string, metadata: string, signature: string): boolean {
    const expectedSignature = this.sign(content, metadata);
    try {
      const a = Buffer.from(signature, 'hex');
      const b = Buffer.from(expectedSignature, 'hex');
      if (a.length !== b.length) return false;
      return crypto.timingSafeEqual(new Uint8Array(a), new Uint8Array(b));
    } catch {
      return false;
    }
  }

  /**
   * Carrega a chave de criptografia simétrica (32 bytes) do env DATA_ENCRYPTION_KEY.
   * Suporta hex (64 chars) ou base64 (44 chars).
   */
  private getEncryptionKey(): Buffer {
    const raw = this.configService.get<string>('DATA_ENCRYPTION_KEY');
    if (!raw) {
      throw new Error(
        "DATA_ENCRYPTION_KEY não está definida. Gere com: node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\"",
      );
    }
    // Aceita hex (64) ou base64
    const buf =
      raw.length === 64 && /^[0-9a-fA-F]+$/.test(raw)
        ? Buffer.from(raw, 'hex')
        : Buffer.from(raw, 'base64');
    if (buf.length !== 32) {
      throw new Error(
        `DATA_ENCRYPTION_KEY deve ter 32 bytes (hex ou base64). Tamanho atual: ${buf.length}`,
      );
    }
    return buf;
  }

  /**
   * Encripta uma string via AES-256-GCM com IV aleatório.
   */
  encrypt(plaintext: string): string {
    const key = this.getEncryptionKey();
    const iv = crypto.randomBytes(IV_BYTES);
    const cipher = crypto.createCipheriv(AES_ALGO, new Uint8Array(key), new Uint8Array(iv));
    const enc = Buffer.concat([
      new Uint8Array(cipher.update(plaintext, 'utf8')),
      new Uint8Array(cipher.final()),
    ]);
    const authTag = cipher.getAuthTag();
    return `${iv.toString('base64')}:${authTag.toString('base64')}:${enc.toString('base64')}`;
  }

  /**
   * Decripta um payload produzido por `encrypt`. Lança erro se corrompido ou sem autenticação.
   */
  decrypt(payload: string): string {
    const parts = payload.split(':');
    if (parts.length !== 3) {
      throw new Error('Payload cifrado inválido: formato esperado iv:tag:ciphertext');
    }
    const key = this.getEncryptionKey();
    const [ivB64, tagB64, dataB64] = parts;
    const iv = Buffer.from(ivB64, 'base64');
    const authTag = Buffer.from(tagB64, 'base64');
    const data = Buffer.from(dataB64, 'base64');
    const decipher = crypto.createDecipheriv(AES_ALGO, new Uint8Array(key), new Uint8Array(iv));
    decipher.setAuthTag(new Uint8Array(authTag));
    const dec = Buffer.concat([
      new Uint8Array(decipher.update(new Uint8Array(data))),
      new Uint8Array(decipher.final()),
    ]);
    return dec.toString('utf8');
  }

  /** Versão que preserva null/undefined — útil para campos opcionais. */
  encryptNullable(value: string | null | undefined): string | null {
    if (value === null || value === undefined) return null;
    return this.encrypt(value);
  }

  /** Versão que preserva null/undefined — útil para campos opcionais. */
  decryptNullable(value: string | null | undefined): string | null {
    if (value === null || value === undefined) return null;
    return this.decrypt(value);
  }
}
