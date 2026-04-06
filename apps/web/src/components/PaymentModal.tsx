'use client';

import { X, CreditCard, QrCode, CheckCircle2 } from 'lucide-react';
import PixCheckoutPanel from '@/components/PixCheckoutPanel';
import { usePayment } from '@/hooks/usePayment';

export type PaymentModalProps = {
  open: boolean;
  onClose: () => void;
  doctorUserId: number;
  dateIso: string;
  consultationModelId?: number;
  onMissingProfile: () => void;
};

export default function PaymentModal({
  open,
  onClose,
  doctorUserId,
  dateIso,
  consultationModelId,
  onMissingProfile,
}: PaymentModalProps) {
  const { tab, setTab, pix, card, manual } = usePayment({
    open,
    doctorUserId,
    dateIso,
    consultationModelId,
    onMissingProfile,
  });

  if (!open) return null;

  const currentPaymentId = tab === 'pix' ? pix.data?.paymentId : card.paymentId;

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
          {manual.success ? (
            <div className="flex flex-col items-center justify-center py-10 text-center animate-in zoom-in-95 duration-300">
              <CheckCircle2 className="h-16 w-16 text-emerald-500 mb-4" />
              <h3 className="text-2xl font-bold text-slate-900">Consulta Confirmada!</h3>
              <p className="mt-2 text-slate-600 max-w-sm">
                Seu pagamento foi confirmado com sucesso e sua consulta já está na agenda.
              </p>
              <button
                onClick={onClose}
                className="mt-8 rounded-xl bg-slate-900 px-8 py-3 text-sm font-bold text-white hover:bg-slate-800 transition-colors"
              >
                Ver minhas consultas
              </button>
            </div>
          ) : (
            <>
              {tab === 'pix' && (
                <div>
                  {pix.chargeLoading && !pix.data && (
                    <p className="text-center text-sm text-slate-600" role="status">
                      Gerando cobrança PIX…
                    </p>
                  )}
                  {pix.error && (
                    <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
                      {pix.error}
                    </div>
                  )}
                  {pix.data && (
                    <PixCheckoutPanel
                      data={pix.data}
                      qrLoading={pix.qrLoading && !pix.qrFetchError}
                      qrFetchError={pix.qrFetchError}
                      className="mb-0 border-0 shadow-none"
                      embedded
                    />
                  )}
                </div>
              )}

              {tab === 'card' && (
                <div>
                  {card.done ? (
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
                    <form onSubmit={card.submit} className="mx-auto max-w-lg space-y-4">
                      <p className="text-sm text-slate-600">
                        Preencha os dados do cartão e o endereço de cobrança exigidos pelo Asaas.
                      </p>
                      <div>
                        <label htmlFor="cc-name" className="block text-xs font-medium text-slate-700">Nome no cartão</label>
                        <input
                          id="cc-name"
                          required
                          value={card.form.holderName}
                          onChange={(e) => card.form.setHolderName(e.target.value)}
                          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                          autoComplete="cc-name"
                        />
                      </div>
                      <div>
                        <label htmlFor="cc-number" className="block text-xs font-medium text-slate-700">Número do cartão</label>
                        <input
                          id="cc-number"
                          required
                          value={card.form.number}
                          onChange={(e) => card.form.setNumber(e.target.value)}
                          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                          inputMode="numeric"
                          autoComplete="cc-number"
                        />
                      </div>
                      <div className="grid grid-cols-3 gap-3">
                        <div>
                          <label htmlFor="cc-exp-month" className="block text-xs font-medium text-slate-700">Mês</label>
                          <input
                            id="cc-exp-month"
                            required
                            placeholder="MM"
                            value={card.form.expiryMonth}
                            onChange={(e) => card.form.setExpiryMonth(e.target.value)}
                            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                            maxLength={2}
                          />
                        </div>
                        <div>
                          <label htmlFor="cc-exp-year" className="block text-xs font-medium text-slate-700">Ano</label>
                          <input
                            id="cc-exp-year"
                            required
                            placeholder="AAAA"
                            value={card.form.expiryYear}
                            onChange={(e) => card.form.setExpiryYear(e.target.value)}
                            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                            maxLength={4}
                          />
                        </div>
                        <div>
                          <label htmlFor="cc-ccv" className="block text-xs font-medium text-slate-700">CVV</label>
                          <input
                            id="cc-ccv"
                            required
                            value={card.form.ccv}
                            onChange={(e) => card.form.setCcv(e.target.value)}
                            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                            maxLength={4}
                            autoComplete="cc-csc"
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label htmlFor="cc-cep" className="block text-xs font-medium text-slate-700">CEP</label>
                          <input
                            id="cc-cep"
                            required
                            value={card.form.postalCode}
                            onChange={(e) => card.form.setPostalCode(e.target.value)}
                            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                          />
                        </div>
                        <div>
                          <label htmlFor="cc-number-addr" className="block text-xs font-medium text-slate-700">Número</label>
                          <input
                            id="cc-number-addr"
                            required
                            value={card.form.addressNumber}
                            onChange={(e) => card.form.setAddressNumber(e.target.value)}
                            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                          />
                        </div>
                      </div>
                      <div>
                        <label htmlFor="cc-phone" className="block text-xs font-medium text-slate-700">Celular (opcional)</label>
                        <input
                          id="cc-phone"
                          value={card.form.mobilePhone}
                          onChange={(e) => card.form.setMobilePhone(e.target.value)}
                          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                        />
                      </div>
                      {card.error && (
                        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
                          {card.error}
                        </div>
                      )}
                      <button
                        type="submit"
                        disabled={card.loading}
                        className="w-full rounded-xl bg-sky-600 py-3 text-sm font-semibold text-white hover:bg-sky-700 disabled:opacity-60"
                      >
                        {card.loading ? 'Processando…' : 'Pagar com cartão'}
                      </button>
                    </form>
                  )}
                </div>
              )}

              {currentPaymentId && (
                <div className="mt-8 border-t border-slate-100 pt-6">
                  <div className="rounded-xl border border-amber-100 bg-amber-50/50 p-4">
                    <p className="text-xs font-bold text-amber-800 uppercase tracking-wider mb-2">
                      Ambiente de Desenvolvimento
                    </p>
                    <p className="text-xs text-amber-700 mb-4">
                      Para agilizar seu teste, você pode marcar esta cobrança como paga manualmente, simulando o retorno do Asaas.
                    </p>
                    <button
                      type="button"
                      disabled={manual.loading}
                      onClick={() => manual.confirm(currentPaymentId)}
                      className="w-full rounded-xl bg-amber-600 py-2.5 text-xs font-bold text-white hover:bg-amber-700 transition-colors disabled:opacity-50"
                    >
                      {manual.loading ? 'Confirmando...' : 'Marcar como Pago (Simular Asaas)'}
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
