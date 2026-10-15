import type { OrderStatusResponse } from '@noise/shared';
import { useEffect, useRef, useState } from 'react';

import { pollDelay, readPaymentOutcome, secondsUntil, type PaymentOutcome } from './checkout-rules';

export type StatusFetcher = (orderId: string, signal?: AbortSignal) => Promise<OrderStatusResponse>;

/**
 * Attente de la confirmation (NOISE-021) : interroge le statut de la commande tant que le
 * serveur répond « en attente », puis s'arrête sur payé, échoué ou expiré. Une erreur réseau
 * n'arrête rien : la demande suivante part au rythme normal (le paiement peut aboutir
 * pendant une coupure, le serveur fait foi).
 */
export function usePaymentPolling(
  fetcher: StatusFetcher,
  orderId: string | null,
  onOutcome: (outcome: Exclude<PaymentOutcome, 'waiting'>) => void,
) {
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;
  const onOutcomeRef = useRef(onOutcome);
  onOutcomeRef.current = onOutcome;

  useEffect(() => {
    if (!orderId) return;
    let attempt = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let stopped = false;
    const controller = new AbortController();

    const poll = async () => {
      try {
        const outcome = readPaymentOutcome(await fetcherRef.current(orderId, controller.signal));
        if (stopped) return;
        if (outcome !== 'waiting') {
          stopped = true;
          onOutcomeRef.current(outcome);
          return;
        }
      } catch {
        if (stopped) return;
      }
      timer = setTimeout(poll, pollDelay(attempt++));
    };
    timer = setTimeout(poll, pollDelay(attempt++));

    return () => {
      stopped = true;
      controller.abort();
      if (timer) clearTimeout(timer);
    };
  }, [orderId]);
}

/** Secondes restantes avant `expiresAt`, mises à jour chaque seconde ; null sans échéance. */
export function useSecondsLeft(expiresAt: string | null): number | null {
  const [left, setLeft] = useState(() => (expiresAt ? secondsUntil(expiresAt) : null));
  useEffect(() => {
    if (!expiresAt) {
      setLeft(null);
      return;
    }
    const tick = () => setLeft(secondsUntil(expiresAt));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [expiresAt]);
  return left;
}
