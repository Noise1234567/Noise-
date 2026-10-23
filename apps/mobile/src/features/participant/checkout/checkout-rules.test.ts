import type { OrderStatusResponse } from '@noise/shared';

import {
  createIntentKeys,
  localPhoneFromE164,
  maxQuantity,
  pollDelay,
  readPaymentOutcome,
  secondsUntil,
  validatePayerPhone,
} from './checkout-rules';

const status = (values: Partial<OrderStatusResponse>): OrderStatusResponse => ({
  orderId: 'o',
  status: 'PENDING',
  expiresAt: '2099-01-01T00:00:00.000Z',
  paidAt: null,
  payment: { status: 'PENDING' },
  ...values,
});

describe('règles du tunnel d’achat', () => {
  it('5 billets au maximum par commande, dans la limite des places', () => {
    expect(maxQuantity({ available: 120 })).toBe(5);
    expect(maxQuantity({ available: 2 })).toBe(2);
    expect(maxQuantity({ available: 0 })).toBe(0);
  });

  it('lit le statut du serveur, sans jamais conclure à un succès de lui-même', () => {
    expect(readPaymentOutcome(status({}))).toBe('waiting');
    expect(readPaymentOutcome(status({ payment: null }))).toBe('waiting');
    expect(readPaymentOutcome(status({ payment: { status: 'SUCCEEDED' } }))).toBe('waiting');
    expect(readPaymentOutcome(status({ status: 'PAID' }))).toBe('paid');
    expect(readPaymentOutcome(status({ payment: { status: 'FAILED' } }))).toBe('failed');
    expect(readPaymentOutcome(status({ status: 'EXPIRED' }))).toBe('expired');
  });

  it('interroge toutes les 2 s puis de plus en plus espacé, jusqu’à 5 s', () => {
    expect([0, 1, 2, 3, 4, 5, 20].map(pollDelay)).toEqual([
      2000, 2000, 3000, 3000, 4000, 5000, 5000,
    ]);
  });

  it('numéro de paiement : prérempli depuis le compte, validé comme côté API', () => {
    expect(localPhoneFromE164('+2290197452138')).toBe('01 97 45 21 38');
    expect(localPhoneFromE164(undefined)).toBe('');
    expect(validatePayerPhone('01 97 45 21 38')).toBeUndefined();
    expect(validatePayerPhone('97 45 21')).toBe('10 chiffres, commençant par 01');
  });

  it('secondes restantes avant la fin de la réservation, jamais négatives', () => {
    const now = Date.parse('2026-10-15T12:00:00Z');
    expect(secondsUntil('2026-10-15T12:15:00Z', now)).toBe(900);
    expect(secondsUntil('2026-10-15T11:00:00Z', now)).toBe(0);
  });

  it('une clé par intention : même requête, même clé ; autre requête ou après succès, nouvelle clé', () => {
    let n = 0;
    const keys = createIntentKeys(() => `cle-${++n}`);
    const a = keys.keyFor({ ticketTypeId: 't', quantity: 1 });
    expect(keys.keyFor({ ticketTypeId: 't', quantity: 1 })).toBe(a);
    expect(keys.keyFor({ ticketTypeId: 't', quantity: 2 })).not.toBe(a);
    keys.settle();
    expect(keys.keyFor({ ticketTypeId: 't', quantity: 2 })).toBe('cle-3');
  });
});
