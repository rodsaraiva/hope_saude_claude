import { useState, useRef, useEffect, useCallback } from 'react';
import { PixCheckoutData } from '@/components/PixCheckoutPanel';
import { api } from '@/lib/api-client';

type Tab = 'pix' | 'card';

interface UsePaymentProps {
  open: boolean;
  doctorUserId: number;
  dateIso: string;
  consultationModelId?: number;
  onMissingProfile: () => void;
}

export function usePayment({
  open,
  doctorUserId,
  dateIso,
  consultationModelId,
  onMissingProfile,
}: UsePaymentProps) {
  const [tab, setTab] = useState<Tab>('pix');

  // PIX State
  const [pixChargeLoading, setPixChargeLoading] = useState(false);
  const [pixQrLoading, setPixQrLoading] = useState(false);
  const [pixQrFetchError, setPixQrFetchError] = useState<string | null>(null);
  const [pixError, setPixError] = useState<string | null>(null);
  const [pixData, setPixData] = useState<PixCheckoutData | null>(null);

  // Card State
  const [cardLoading, setCardLoading] = useState(false);
  const [cardError, setCardError] = useState<string | null>(null);
  const [cardDone, setCardDone] = useState(false);
  const [cardPaymentId, setCardPaymentId] = useState<string | null>(null);

  // Manual Confirmation State (Sandbox only)
  const [manualConfirmLoading, setManualConfirmLoading] = useState(false);
  const [manualConfirmSuccess, setManualConfirmSuccess] = useState(false);

  // Card Form Fields
  const [holderName, setHolderName] = useState('');
  const [number, setNumber] = useState('');
  const [expiryMonth, setExpiryMonth] = useState('');
  const [expiryYear, setExpiryYear] = useState('');
  const [ccv, setCcv] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [addressNumber, setAddressNumber] = useState('');
  const [mobilePhone, setMobilePhone] = useState('');

  const pixDoneKeyRef = useRef<string | null>(null);

  // Reset all states when modal closes or switches context
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
      setCardPaymentId(null);
      setManualConfirmSuccess(false);
      setCardError(null);

      // Also reset form
      setHolderName('');
      setNumber('');
      setExpiryMonth('');
      setExpiryYear('');
      setCcv('');
      setPostalCode('');
      setAddressNumber('');
      setMobilePhone('');
      return;
    }
  }, [open]);

  // PIX Logic (POST checkout & GET QR)
  useEffect(() => {
    if (!open || tab !== 'pix') return;

    const sessionKey = `${doctorUserId}:${dateIso}`;
    if (pixDoneKeyRef.current === sessionKey) return;

    const ac = new AbortController();

    setPixChargeLoading(true);
    setPixQrLoading(false);
    setPixError(null);
    setPixQrFetchError(null);

    (async () => {
      try {
        const payload: Record<string, any> = {
          doctorId: doctorUserId,
          date: dateIso,
          paymentMethod: 'PIX',
        };
        if (consultationModelId) payload.consultationModelId = consultationModelId;

        const data = await api.post<any>('/payments/checkout', payload, { signal: ac.signal });

        const paymentId = data.paymentId as string;
        setPixData({
          paymentId,
          value: typeof data.value === 'number' ? data.value : undefined,
          invoiceUrl: data.invoiceUrl,
        });

        setPixChargeLoading(false);
        setPixQrLoading(true);

        const qr = await api.get<any>(`/payments/pix-qr/${encodeURIComponent(paymentId)}`, {
          signal: ac.signal,
        });

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
      } catch (err: any) {
        if (err.name === 'AbortError') return;

        if (err.status === 400 && err.data?.code === 'MISSING_PATIENT_PROFILE') {
          onMissingProfile();
          return;
        }

        const errorMessage = err.status ? err.message || 'Erro na requisição' : 'Falha de conexão.';

        if (!pixData) {
          setPixError(errorMessage);
        } else {
          setPixQrFetchError(errorMessage);
        }
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

  // Card Submit Logic
  const submitCard = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setCardError(null);
      setCardLoading(true);
      try {
        const payload: Record<string, any> = {
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
        };
        if (consultationModelId) payload.consultationModelId = consultationModelId;

        const resp = await api.post<any>('/payments/checkout', payload);
        setCardPaymentId(resp.paymentId);
        setCardDone(true);
      } catch (err: any) {
        if (err.status === 400 && err.data?.code === 'MISSING_PATIENT_PROFILE') {
          onMissingProfile();
          return;
        }
        setCardError(
          err.status
            ? err.message || 'Pagamento não autorizado. Verifique os dados.'
            : 'Falha de conexão.',
        );
      } finally {
        setCardLoading(false);
      }
    },
    [
      doctorUserId,
      dateIso,
      consultationModelId,
      holderName,
      number,
      expiryMonth,
      expiryYear,
      ccv,
      postalCode,
      addressNumber,
      mobilePhone,
      onMissingProfile,
    ],
  );

  const confirmManualPayment = useCallback(async (paymentId: string) => {
    setManualConfirmLoading(true);
    try {
      await api.post(`/payments/${paymentId}/confirm`);
      setManualConfirmSuccess(true);
    } catch (err: any) {
      setCardError(err.message || 'Erro ao confirmar pagamento manual');
    } finally {
      setManualConfirmLoading(false);
    }
  }, []);

  return {
    tab,
    setTab,
    pix: {
      data: pixData,
      chargeLoading: pixChargeLoading,
      qrLoading: pixQrLoading,
      qrFetchError: pixQrFetchError,
      error: pixError,
    },
    card: {
      done: cardDone,
      paymentId: cardPaymentId,
      loading: cardLoading,
      error: cardError,
      submit: submitCard,
      form: {
        holderName,
        setHolderName,
        number,
        setNumber,
        expiryMonth,
        setExpiryMonth,
        expiryYear,
        setExpiryYear,
        ccv,
        setCcv,
        postalCode,
        setPostalCode,
        addressNumber,
        setAddressNumber,
        mobilePhone,
        setMobilePhone,
      },
    },
    manual: {
      confirm: confirmManualPayment,
      loading: manualConfirmLoading,
      success: manualConfirmSuccess,
    },
  };
}
