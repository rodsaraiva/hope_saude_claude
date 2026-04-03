'use client';

import { useEffect, useState, useRef } from 'react';
import { X, CreditCard, QrCode } from 'lucide-react';
import PixCheckoutPanel, { type PixCheckoutData } from '@/components/PixCheckoutPanel';

type Tab = 'pix' | 'card';

export type PaymentModalProps = {
  open: boolean;
  onClose: () => void;
  doctorUserId: number;
  dateIso: string;
  onMissingProfile: () => void;
};

export default function PaymentModal({
  open,
  onClose,
  doctorUserId,
  dateIso,
  onMissingProfile,
}: PaymentModalProps) {
  const [tab, setTab] = useState<Tab>('pix');
  /** POST /payments/checkout (criar cobrança) */
  const [pixChargeLoading, setPixChargeLoading] = useState(false);
  /** GET /payments/pix-qr/:id */
  const [pixQrLoading, setPixQrLoading] = useState(false);
  /** Erro só na etapa do QR (cobrança já criada) */
  const [pixQrFetchError, setPixQrFetchError] = useState<string | null>(null);
  const [pixError, setPixError] = useState<string | null>(null);
  const [pixData, setPixData] = useState<PixCheckoutData | null>(null);

  const [cardLoading, setCardLoading] = useState(false);
  const [cardError, setCardError] = useState<string | null>(null);
  const [cardDone, setCardDone] = useState(false);

  const [holderName, setHolderName] = useState('');
  const [number, setNumber] = useState('');
  const [expiryMonth, setExpiryMonth] = useState('');
  const [expiryYear, setExpiryYear] = useState('');
  const [ccv, setCcv] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [addressNumber, setAddressNumber] = useState('');
  const [mobilePhone, setMobilePhone] = useState('');

  /** Evita novo POST ao reabrir a aba PIX depois que cobrança+QR já foram carregados para o mesmo agendamento. */
  const pixDoneKeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (!open) {
      setTab('pix');
      setPixData(null);
      setPixError(null);
      setPixQrFetchError(null);
      setPixChargeLoading(false);
      setPixQrLoading(false);
      pixDoneKeyRef.current = null;
      setCardDone(false);
      setCardError(null);
      return;
    }
    if (tab !== 'pix') return;

    const sessionKey = `${doctorUserId}:${dateIso}`;
    if (pixDoneKeyRef.current === sessionKey) {
      return;
    }

    const token = localStorage.getItem('token');
    if (!token) return;

    const ac = new AbortController();

    setPixChargeLoading(true);
    setPixQrLoading(false);
    setPixError(null);
    setPixQrFetchError(null);

    (async () => {
      try {
        const res = await fetch('http://localhost:3000/payments/checkout', {
          method: 'POST',
          signal: ac.signal,
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            doctorId: doctorUserId,
            date: dateIso,
            paymentMethod: 'PIX',
          }),
        });
        const data = await res.json().catch(() => null);
        if (res.status === 400 && data?.code === 'MISSING_PATIENT_PROFILE') {
          onMissingProfile();
          return;
        }
        if (!res.ok) {
          setPixError(data?.message || 'Não foi possível gerar o PIX.');
          return;
        }

        const paymentId = data.paymentId as string;
        setPixData({
          paymentId,
          value: typeof data.value === 'number' ? data.value : undefined,
          invoiceUrl: data.invoiceUrl,
        });

        setPixChargeLoading(false);
        setPixQrLoading(true);

        const qrRes = await fetch(
          `http://localhost:3000/payments/pix-qr/${encodeURIComponent(paymentId)}`,
          {
            signal: ac.signal,
            headers: { Authorization: `Bearer ${token}` },
          },
        );
        const qr = await qrRes.json().catch(() => null);
        if (!qrRes.ok) {
          const msg = qr?.message || 'Não foi possível obter o QR Code. Tente fechar e abrir de novo.';
          setPixQrFetchError(msg);
          return;
        }
        setPixData((prev) =>
          prev
            ? {
                ...prev,
                pixQrCode: qr.pixQrCode,
                pixCode: qr.pixCode,
                pixExpiresAt: qr.pixExpiresAt,
              }
            : null,
        );
        pixDoneKeyRef.current = sessionKey;
      } catch (e: unknown) {
        if ((e as Error)?.name === 'AbortError') return;
        setPixError('Falha de conexão.');
      } finally {
        if (!ac.signal.aborted) {
          setPixChargeLoading(false);
          setPixQrLoading(false);
        }
      }
    })();

    return () => {
      ac.abort();
    };
  }, [open, tab, doctorUserId, dateIso, onMissingProfile]);

  const submitCard = async (e: React.FormEvent) => {
    e.preventDefault();
    setCardError(null);
    setCardLoading(true);
    const token = localStorage.getItem('token');
    try {
      const res = await fetch('http://localhost:3000/payments/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          doctorId: doctorUserId,
          date: dateIso,
          paymentMethod: 'CREDIT_CARD',
          creditCard: {
            holderName,
            number,
            expiryMonth,
            expiryYear,
            ccv,
          },
          creditCardHolderInfo: {
            postalCode,
            addressNumber,
            mobilePhone: mobilePhone || undefined,
          },
        }),
      });
      const data = await res.json().catch(() => null);
      if (res.status === 400 && data?.code === 'MISSING_PATIENT_PROFILE') {
        onMissingProfile();
        return;
      }
      if (!res.ok) {
        setCardError(data?.message || 'Pagamento não autorizado. Verifique os dados.');
        return;
      }
      setCardDone(true);
    } catch {
      setCardError('Falha de conexão.');
    } finally {
      setCardLoading(false);
    }
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="payment-modal-title"
    >
      <div className="relative flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex shrink-0 items-center justify-between border-b border-slate-200 px-6 py-4">
          <h2 id="payment-modal-title" className="text-xl font-bold text-slate-900">
            Pagamento da consulta
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
            aria-label="Fechar"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        <div className="flex shrink-0 gap-2 border-b border-slate-100 px-4 pt-4 sm:px-6">
          <button
            type="button"
            onClick={() => setTab('pix')}
            className={`flex items-center gap-2 rounded-t-lg px-4 py-3 text-sm font-semibold transition-colors ${
              tab === 'pix'
                ? 'bg-emerald-50 text-emerald-900 ring-1 ring-emerald-200 ring-b-0'
                : 'text-slate-600 hover:bg-slate-50'
            }`}
          >
            <QrCode className="h-4 w-4" aria-hidden />
            PIX
          </button>
          <button
            type="button"
            onClick={() => setTab('card')}
            className={`flex items-center gap-2 rounded-t-lg px-4 py-3 text-sm font-semibold transition-colors ${
              tab === 'card'
                ? 'bg-sky-50 text-sky-900 ring-1 ring-sky-200 ring-b-0'
                : 'text-slate-600 hover:bg-slate-50'
            }`}
          >
            <CreditCard className="h-4 w-4" aria-hidden />
            Cartão de crédito
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-6 sm:px-6">
          {tab === 'pix' && (
            <div>
              {pixChargeLoading && !pixData && (
                <p className="text-center text-sm text-slate-600" role="status">
                  Gerando cobrança PIX…
                </p>
              )}
              {pixError && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
                  {pixError}
                </div>
              )}
              {pixData && (
                <PixCheckoutPanel
                  data={pixData}
                  qrLoading={pixQrLoading && !pixQrFetchError}
                  qrFetchError={pixQrFetchError}
                  className="mb-0 border-0 shadow-none"
                  embedded
                />
              )}
            </div>
          )}

          {tab === 'card' && (
            <div>
              {cardDone ? (
                <div
                  className="rounded-xl border border-emerald-200 bg-emerald-50 px-6 py-8 text-center"
                  role="status"
                >
                  <p className="text-lg font-semibold text-emerald-900">Pagamento processado</p>
                  <p className="mt-2 text-sm text-emerald-800">
                    Quando o Asaas confirmar, sua consulta será agendada automaticamente.
                  </p>
                </div>
              ) : (
                <form onSubmit={submitCard} className="mx-auto max-w-lg space-y-4">
                  <p className="text-sm text-slate-600">
                    Preencha os dados do cartão e o endereço de cobrança exigidos pelo Asaas.
                  </p>
                  <div>
                    <label className="block text-xs font-medium text-slate-700">Nome no cartão</label>
                    <input
                      required
                      value={holderName}
                      onChange={(e) => setHolderName(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                      autoComplete="cc-name"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700">Número do cartão</label>
                    <input
                      required
                      value={number}
                      onChange={(e) => setNumber(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                      inputMode="numeric"
                      autoComplete="cc-number"
                    />
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-700">Mês</label>
                      <input
                        required
                        placeholder="MM"
                        value={expiryMonth}
                        onChange={(e) => setExpiryMonth(e.target.value)}
                        className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                        maxLength={2}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-700">Ano</label>
                      <input
                        required
                        placeholder="AAAA"
                        value={expiryYear}
                        onChange={(e) => setExpiryYear(e.target.value)}
                        className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                        maxLength={4}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-700">CVV</label>
                      <input
                        required
                        value={ccv}
                        onChange={(e) => setCcv(e.target.value)}
                        className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                        maxLength={4}
                        autoComplete="cc-csc"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-700">CEP</label>
                      <input
                        required
                        value={postalCode}
                        onChange={(e) => setPostalCode(e.target.value)}
                        className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-700">Número</label>
                      <input
                        required
                        value={addressNumber}
                        onChange={(e) => setAddressNumber(e.target.value)}
                        className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700">Celular (opcional)</label>
                    <input
                      value={mobilePhone}
                      onChange={(e) => setMobilePhone(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    />
                  </div>
                  {cardError && (
                    <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
                      {cardError}
                    </div>
                  )}
                  <button
                    type="submit"
                    disabled={cardLoading}
                    className="w-full rounded-xl bg-sky-600 py-3 text-sm font-semibold text-white hover:bg-sky-700 disabled:opacity-60"
                  >
                    {cardLoading ? 'Processando…' : 'Pagar com cartão'}
                  </button>
                </form>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
