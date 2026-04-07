import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosError } from 'axios';
import * as crypto from 'crypto';
import { SignatureProvider, SignatureResult } from './signature.provider';

/**
 * Integração com Lacuna Rest PKI (pki.rest) para assinatura digital
 * ICP-Brasil via provedores em nuvem (BirdID, VidaaS, SafeID, NeoID).
 *
 * Fluxo:
 *   1. Frontend redireciona o médico para o endpoint OAuth do Lacuna com
 *      state contendo recordId/type → médico autentica no provedor PKI
 *   2. Callback volta com `code` → provider recebe em authData
 *   3. sign() calcula SHA-256 e envia para Lacuna completar via
 *      /signatures/complete
 *   4. Retorna { signature, hash, signatureDate, signerInfo } persistido
 *      no MedicalRecord/Prescription
 *
 * Segurança:
 *   - LACUNA_API_KEY é obrigatória — sem ela, o construtor lança
 *   - Timeout de 30s (assinaturas em nuvem podem demorar)
 *   - Erros HTTP da Lacuna são traduzidos em ServiceUnavailableException
 *   - Log estruturado via Pino (contexto=LacunaProvider)
 */
@Injectable()
export class LacunaProvider implements SignatureProvider {
  private readonly logger = new Logger(LacunaProvider.name);
  private readonly apiUrl: string;
  private readonly apiKey: string;
  private readonly timeoutMs = 30_000;

  constructor(private configService: ConfigService) {
    this.apiUrl = this.configService.get<string>('LACUNA_API_URL') || 'https://pki.rest/api';
    const key = this.configService.get<string>('LACUNA_API_KEY');
    if (!key || key.trim() === '') {
      throw new Error(
        'LACUNA_API_KEY não está configurada. Assinatura digital ICP-Brasil indisponível.',
      );
    }
    this.apiKey = key;
  }

  async sign(content: string, authData: { code: string }): Promise<SignatureResult> {
    if (!authData?.code) {
      throw new Error('Código de autorização do Lacuna ausente. Fluxo OAuth incompleto.');
    }

    const hash = crypto.createHash('sha256').update(content).digest('hex');

    try {
      this.logger.log(`Lacuna sign: completando assinatura (hash=${hash.slice(0, 8)}…)`);

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
            'Content-Type': 'application/json',
          },
          timeout: this.timeoutMs,
        },
      );

      const data = response.data as {
        signature?: string;
        signer?: { name?: string };
      };

      if (!data.signature) {
        throw new Error('Lacuna retornou resposta sem campo signature.');
      }

      this.logger.log(`Lacuna sign ok: signer=${data.signer?.name ?? '?'}`);

      return {
        signature: data.signature,
        hash,
        signatureDate: new Date(),
        signerInfo: data.signer?.name || 'Assinado via Lacuna Software',
      };
    } catch (err) {
      if (axios.isAxiosError(err)) {
        const axiosErr = err as AxiosError<{ message?: string; error?: string }>;
        const status = axiosErr.response?.status;
        const msg =
          axiosErr.response?.data?.message || axiosErr.response?.data?.error || axiosErr.message;
        this.logger.error(`Lacuna HTTP ${status ?? 'network'}: ${msg}`);
        throw new ServiceUnavailableException(
          `Provedor de assinatura digital indisponível (${status ?? 'network'}): ${msg}`,
        );
      }
      this.logger.error(`Lacuna sign falhou: ${err instanceof Error ? err.message : String(err)}`);
      throw err;
    }
  }
}
