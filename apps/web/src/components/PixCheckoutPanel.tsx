'use client';

import { useMemo, useState } from 'react';
import { Copy, Check, Loader2 } from 'lucide-react';

export type PixCheckoutData = {
  paymentId?: string;
  /** Valor em reais (número), ex.: 150 */
  value?: number;
  invoiceUrl?: string;
  pixExpiresAt?: string;
  pixQrCode?: string;
  pixCode?: string;
};

function qrSrc(encodedImage: string): string {
  if (encodedImage.startsWith('data:')) return encodedImage;
  return `data:image/png;base64,${encodedImage}`;
}

function formatBrl(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export default function PixCheckoutPanel({
  data,
  className = '',
  embedded = false,
  /** Enquanto o backend gera o QR / copia-e-cola */
  qrLoading = false,
  qrFetchError = null,
}: {
  data: PixCheckoutData;
  className?: string;
  embedded?: boolean;
  qrLoading?: boolean;
  qrFetchError?: string | null;
}) {
  const [copied, setCopied] = useState(false);
  const hasQr = Boolean(data.pixQrCode && data.pixCode);
  const showQrSkeleton = (qrLoading || !hasQr) && !qrFetchError;

  const src = useMemo(() => (data.pixQrCode ? qrSrc(data.pixQrCode) : ''), [data.pixQrCode]);

  const copy = async () => {
    if (!data.pixCode) return;
    try {
      await navigator.clipboard.writeText(data.pixCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  };

  const shell =
    embedded
      ? 'rounded-xl border border-emerald-100 bg-emerald-50/40 p-5'
      : 'mb-6 rounded-2xl border border-emerald-200 bg-white p-6 shadow-sm';

  return (
    <section
      className={`${shell} ${className}`.trim()}
      aria-labelledby="pix-checkout-heading"
      role="region"
    >
      <h3 id="pix-checkout-heading" className="text-lg font-bold text-emerald-900">
        Pagamento PIX
      </h3>
      <p className="mt-1 text-sm text-slate-600">
        Escaneie o QR Code ou copie o código abaixo. A consulta será confirmada após o pagamento.
      </p>
      {data.value != null && (
        <p className="mt-3 text-base font-semibold text-slate-900">
          Valor: {formatBrl(data.value)}
        </p>
      )}
      {!showQrSkeleton && data.pixExpiresAt && (
        <p className="mt-2 text-xs text-slate-500">
          Válido até {new Date(data.pixExpiresAt).toLocaleString('pt-BR')}
        </p>
      )}

      <div className="mt-6 flex flex-col items-center gap-6 sm:flex-row sm:items-start sm:justify-center">
        <div
          className="relative flex h-48 w-48 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white p-3 shadow-inner"
          aria-busy={showQrSkeleton}
          aria-label={showQrSkeleton ? 'Gerando QR Code PIX' : 'QR Code PIX'}
        >
          {qrFetchError ? (
            <div className="flex h-full w-full flex-col items-center justify-center gap-2 rounded-lg bg-red-50 p-3 text-center">
              <p className="text-xs font-medium text-red-800">{qrFetchError}</p>
            </div>
          ) : showQrSkeleton ? (
            <div className="flex h-full w-full flex-col items-center justify-center gap-3 rounded-lg bg-slate-50">
              <div className="absolute inset-2 animate-pulse rounded-md bg-gradient-to-br from-slate-200/80 via-emerald-100/50 to-slate-200/80" />
              <Loader2
                className="relative z-10 h-10 w-10 animate-spin text-emerald-600"
                aria-hidden
              />
              <span className="relative z-10 px-2 text-center text-xs font-medium text-slate-600">
                Gerando QR…
              </span>
            </div>
          ) : (
            <img
              src={src}
              alt="QR Code PIX"
              className="h-full w-full object-contain"
              width={192}
              height={192}
            />
          )}
        </div>
        <div className="w-full max-w-md space-y-3">
          <label className="block text-xs font-medium uppercase tracking-wide text-slate-500">
            Código copia e cola
          </label>
          <div className="flex gap-2">
            <output
              className={`min-h-[2.75rem] flex-1 break-all rounded-lg border px-3 py-2 font-mono text-xs ${
                showQrSkeleton
                  ? 'border-slate-200 bg-slate-100 text-slate-400'
                  : 'border-slate-200 bg-slate-50 text-slate-800'
              }`}
              aria-live="polite"
            >
              {qrFetchError
                ? '—'
                : showQrSkeleton
                  ? 'Aguardando código PIX…'
                  : data.pixCode}
            </output>
            <button
              type="button"
              onClick={copy}
              disabled={!data.pixCode || qrLoading || !!qrFetchError}
              className="inline-flex shrink-0 items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {copied ? <Check className="h-4 w-4" aria-hidden /> : <Copy className="h-4 w-4" aria-hidden />}
              {copied ? 'Copiado' : 'Copiar'}
            </button>
          </div>
          {data.invoiceUrl && (
            <p className="text-center text-xs text-slate-500 sm:text-left">
              <a
                href={data.invoiceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sky-600 underline hover:text-sky-800"
              >
                Abrir fatura no Asaas (opcional)
              </a>
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
