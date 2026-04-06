import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

@Injectable()
export class CryptographyService {
  private readonly secret: string;

  constructor(private configService: ConfigService) {
    this.secret = this.configService.get<string>('JWT_SECRET') || 'dev-secret-key';
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
}
