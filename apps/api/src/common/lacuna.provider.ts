import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import * as crypto from 'crypto';
import { SignatureProvider, SignatureResult } from './signature.provider';

@Injectable()
export class LacunaProvider implements SignatureProvider {
  private readonly apiUrl: string;
  private readonly apiKey: string;

  constructor(private configService: ConfigService) {
    this.apiUrl = this.configService.get<string>('LACUNA_API_URL') || 'https://pki.rest/api';
    this.apiKey = this.configService.get<string>('LACUNA_API_KEY') || 'default-lacuna-api-key';
  }

  /**
   * Assina o hash do conteúdo via API do Lacuna Software (Rest PKI / Amplia).
   * Ele encapsula provedores como BirdID, VidaaS, SafeID, NeoID, etc.
   * @param content O conteúdo do prontuário ou receita.
   * @param authData Dados de autorização (ex: código retornado pelo Lacuna Discovery).
   */
  async sign(content: string, authData: { code: string }): Promise<SignatureResult> {
    // 1. Geração do Hash SHA-256 do conteúdo a ser assinado
    const hash = crypto.createHash('sha256').update(content).digest('hex');

    // 2. Chamada à API do Lacuna para completar a assinatura usando o código de autorização em nuvem
    const response = await axios.post(
      `${this.apiUrl}/signatures/complete`,
      {
        code: authData.code,
        hash,
        algorithm: 'SHA256',
      },
      {
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
        },
      },
    );

    // 3. Retorno da assinatura no formato padronizado (SignatureResult)
    return {
      signature: response.data.signature,
      hash,
      signatureDate: new Date(),
      signerInfo: response.data.signer?.name || 'Assinado via Lacuna Software',
    };
  }
}
