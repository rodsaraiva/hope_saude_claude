export interface SignatureResult {
  signature: string; // O resultado da assinatura (ex: CMS ou PKCS#1 em base64/hex)
  hash: string;      // O hash que foi assinado
  signatureDate: Date;
  signerInfo?: string; // Informações adicionais do signatário (ex: nome, CPF do certificado)
}

export interface SignatureProvider {
  /**
   * Assina o conteúdo fornecido.
   * @param content O conteúdo a ser assinado.
   * @param authData Dados de autenticação necessários pelo provedor (ex: OAuth code).
   */
  sign(content: string, authData: any): Promise<SignatureResult>;
}
