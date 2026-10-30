import {
  MOBILE_MONEY_OPERATORS,
  type EventDto,
  type MobileMoneyOperator,
  type OrderDto,
  type TicketTypeDto,
} from '@noise/shared';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import type { OrdersApi } from '../../../api/orders';
import { toApiError } from '../../../api/errors';
import { formatLocalPhone, toApiPhone } from '../../../auth/forms';
import { formatClock } from '../../../auth/useCountdown';
import { Banner } from '../../../components/Banner';
import { SupportButton } from '../../../components/SupportButton';
import { Button } from '../../../components/Button';
import { Text } from '../../../components/Text';
import { TextField } from '../../../components/TextField';
import { colors, minTouchTarget, radii, spacing } from '../../../theme';
import { formatEventDate, formatFcfa, purchasableTypes, ticketPriceLabel } from '../format';
import {
  OPERATOR_LABELS,
  createIntentKeys,
  keepsIntentKey,
  maxQuantity,
  validatePayerPhone,
} from './checkout-rules';
import { usePaymentPolling, useSecondsLeft } from './usePaymentPolling';

type Step = 'select' | 'pay' | 'waiting' | 'paid' | 'failed' | 'expired';

type Props = {
  event: EventDto;
  api: Pick<OrdersApi, 'create' | 'initiatePayment' | 'status'>;
  /** Numéro du compte (format local), proposé par défaut comme numéro de paiement. */
  defaultPhone: string;
  onSeeTickets: () => void;
  onClose: () => void;
};

const totalLabel = (amount: number) => (amount === 0 ? 'Gratuit' : formatFcfa(amount));

/**
 * Tunnel d'achat (NOISE-021, CDC 4.2) en trois étapes : billets et quantité, numéro Mobile
 * Money, confirmation. La commande réserve les places 15 minutes ; le succès n'est affiché
 * que lorsque le serveur a confirmé le paiement.
 */
export function Checkout({ event, api, defaultPhone, onSeeTickets, onClose }: Props) {
  const types = purchasableTypes(event.ticketTypes);
  const [step, setStep] = useState<Step>('select');
  const [typeId, setTypeId] = useState<string | null>(
    types.length === 1 ? (types[0]?.id ?? null) : null,
  );
  const [quantity, setQuantity] = useState(1);
  const [order, setOrder] = useState<OrderDto | null>(null);
  const [operator, setOperator] = useState<MobileMoneyOperator | null>(null);
  const [phone, setPhone] = useState(defaultPhone);
  const [phoneError, setPhoneError] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Une clé par intention (commande, puis paiement) : un nouvel essai après une coupure ne
  // crée rien en double (NOISE-053).
  const orderKeys = useRef(createIntentKeys()).current;
  const paymentKeys = useRef(createIntentKeys()).current;

  const selected = types.find((t) => t.id === typeId) ?? null;
  const secondsLeft = useSecondsLeft(
    step === 'pay' || step === 'waiting' ? (order?.expiresAt ?? null) : null,
  );

  usePaymentPolling(api.status, step === 'waiting' ? (order?.id ?? null) : null, (outcome) => {
    setError(null);
    setStep(outcome);
  });

  // Réservation écoulée avant le paiement : les places sont libérées côté serveur.
  useEffect(() => {
    if (step === 'pay' && secondsLeft === 0) setStep('expired');
  }, [step, secondsLeft]);

  async function reserve() {
    if (!selected) {
      setError('Choisissez un billet.');
      return;
    }
    setError(null);
    setBusy(true);
    try {
      const body = { ticketTypeId: selected.id, quantity };
      const created = await api.create(body, orderKeys.keyFor(body));
      orderKeys.settle();
      setOrder(created);
      setStep(created.status === 'PAID' ? 'paid' : 'pay');
    } catch (e) {
      const apiError = toApiError(e);
      if (!keepsIntentKey(apiError.status)) orderKeys.settle();
      setError(apiError.message);
    } finally {
      setBusy(false);
    }
  }

  async function pay() {
    if (!order) return;
    const problem = validatePayerPhone(phone);
    setPhoneError(problem);
    if (!operator) {
      setError('Choisissez votre opérateur Mobile Money.');
      return;
    }
    if (problem) return;
    setError(null);
    setBusy(true);
    try {
      const body = { orderId: order.id, operator, phone: toApiPhone(phone) };
      await api.initiatePayment(body, paymentKeys.keyFor(body));
      paymentKeys.settle();
      setStep('waiting');
    } catch (e) {
      const apiError = toApiError(e);
      if (!keepsIntentKey(apiError.status)) paymentKeys.settle();
      // Une demande est déjà en cours pour cette commande : on attend son résultat.
      if (apiError.status === 409 && /en cours/i.test(apiError.message)) setStep('waiting');
      else setError(apiError.message);
    } finally {
      setBusy(false);
    }
  }

  function restart() {
    setOrder(null);
    setError(null);
    setStep('select');
  }

  const header = (
    <View style={styles.header}>
      <Text variant="caption" muted>
        {formatEventDate(event.startsAt)} · {event.venue}
      </Text>
      <Text variant="title">{event.title}</Text>
    </View>
  );

  if (step === 'paid') {
    return (
      <Outcome
        title={order?.totalXof === 0 ? 'Réservation confirmée' : 'Paiement confirmé'}
        message="Vos billets sont dans « Mes billets », avec leur QR code disponible même sans réseau."
        primary={{ label: 'Voir mes billets', onPress: onSeeTickets }}
      />
    );
  }
  if (step === 'expired') {
    return (
      <Outcome
        title="Réservation expirée"
        message="Le délai de 15 minutes est dépassé : les places ont été libérées. Si votre compte a été débité, le montant vous sera remboursé."
        primary={{ label: 'Recommencer', onPress: restart }}
        secondary={{ label: 'Fermer', onPress: onClose }}
        supportReference={order ? `commande ${order.id}` : undefined}
      />
    );
  }
  if (step === 'failed') {
    return (
      <Outcome
        title="Paiement non abouti"
        message="La demande a été refusée ou n'a pas été validée. Vérifiez votre solde Mobile Money, puis réessayez : vos places restent réservées."
        primary={{ label: 'Réessayer', onPress: () => setStep('pay') }}
        secondary={{ label: 'Annuler', onPress: onClose }}
        supportReference={order ? `commande ${order.id}` : undefined}
      />
    );
  }

  if (step === 'waiting' && order) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.secondary} size="large" accessibilityLabel="En attente" />
        <Text variant="section" style={styles.textCenter}>
          Validez le paiement sur votre téléphone
        </Text>
        <Text muted style={styles.textCenter}>
          Une demande de {formatFcfa(order.totalXof)} a été envoyée au {phone}. Confirmez-la avec
          votre code secret {operator ? OPERATOR_LABELS[operator] : 'Mobile Money'}.
        </Text>
        {secondsLeft !== null ? (
          <Text variant="caption" muted>
            Places réservées encore {formatClock(secondsLeft)}
          </Text>
        ) : null}
        <Button variant="text" label="Fermer" onPress={onClose} />
      </View>
    );
  }

  if (step === 'pay' && order) {
    return (
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {header}
        <Text variant="caption" muted accessibilityRole="header">
          Étape 2 sur 2 · Paiement
        </Text>
        <View style={styles.card}>
          <Text variant="button">
            {order.quantity} × {order.ticketTypeName}
          </Text>
          <Text variant="amount">{formatFcfa(order.totalXof)}</Text>
          {secondsLeft !== null ? (
            <Text variant="caption" style={{ color: colors.warning }}>
              Places réservées pendant {formatClock(secondsLeft)}
            </Text>
          ) : null}
        </View>
        <Text variant="caption" muted>
          Opérateur
        </Text>
        <View style={styles.row}>
          {MOBILE_MONEY_OPERATORS.map((op) => (
            <Pressable
              key={op}
              accessibilityRole="button"
              accessibilityState={{ selected: operator === op }}
              onPress={() => setOperator(op)}
              style={[styles.choice, operator === op ? styles.choiceSelected : null]}
            >
              <Text variant="button">{OPERATOR_LABELS[op]}</Text>
            </Pressable>
          ))}
        </View>
        <TextField
          label="Numéro Mobile Money"
          prefix="+229"
          value={phone}
          onChangeText={(value) => setPhone(formatLocalPhone(value))}
          error={phoneError}
          hint="Le numéro qui recevra la demande de paiement"
          keyboardType="phone-pad"
          placeholder="01 97 45 21 38"
        />
        <Text variant="caption" muted>
          Les frais de l'opérateur s'ajoutent au montant et sont indiqués sur votre téléphone avant
          validation.
        </Text>
        {error ? <Banner kind="error">{error}</Banner> : null}
        <View style={styles.actions}>
          <Button
            label={`Payer ${formatFcfa(order.totalXof)}`}
            loading={busy}
            onPress={() => void pay()}
          />
          <Button variant="text" label="Annuler" onPress={onClose} />
        </View>
      </ScrollView>
    );
  }

  const total = selected ? selected.priceXof * quantity : 0;
  return (
    <ScrollView contentContainerStyle={styles.content}>
      {header}
      <Text variant="caption" muted accessibilityRole="header">
        Étape 1 sur 2 · Billets
      </Text>
      {types.map((type) => (
        <TypeChoice
          key={type.id}
          type={type}
          selected={type.id === typeId}
          onPress={() => {
            setTypeId(type.id);
            setQuantity((q) => Math.min(q, maxQuantity(type)) || 1);
          }}
        />
      ))}
      {selected ? (
        <View style={styles.quantity}>
          <Text variant="button">Quantité</Text>
          <Stepper value={quantity} max={maxQuantity(selected)} onChange={setQuantity} />
        </View>
      ) : null}
      {error ? <Banner kind="error">{error}</Banner> : null}
      <View style={styles.actions}>
        <Button
          label={selected ? `Continuer · ${totalLabel(total)}` : 'Choisissez un billet'}
          disabled={!selected}
          loading={busy}
          onPress={() => void reserve()}
        />
        <Button variant="text" label="Annuler" onPress={onClose} />
      </View>
    </ScrollView>
  );
}

function TypeChoice({
  type,
  selected,
  onPress,
}: {
  type: TicketTypeDto;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={`${type.name}, ${ticketPriceLabel(type)}`}
      onPress={onPress}
      style={[styles.card, styles.typeRow, selected ? styles.choiceSelected : null]}
    >
      <View style={styles.flex}>
        <Text variant="button">{type.name}</Text>
        <Text variant="caption" muted>
          {type.lowStock ? `Dernières places · ${type.available}` : `${type.available} disponibles`}
        </Text>
      </View>
      <Text variant="amount">{ticketPriceLabel(type)}</Text>
    </Pressable>
  );
}

function Stepper({
  value,
  max,
  onChange,
}: {
  value: number;
  max: number;
  onChange: (value: number) => void;
}) {
  return (
    <View style={styles.stepper}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Un billet de moins"
        disabled={value <= 1}
        onPress={() => onChange(value - 1)}
        style={[styles.stepButton, value <= 1 ? styles.disabled : null]}
      >
        <Text variant="section">−</Text>
      </Pressable>
      <Text variant="section" accessibilityLabel={`${value} billet${value > 1 ? 's' : ''}`}>
        {value}
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Un billet de plus"
        disabled={value >= max}
        onPress={() => onChange(value + 1)}
        style={[styles.stepButton, value >= max ? styles.disabled : null]}
      >
        <Text variant="section">+</Text>
      </Pressable>
    </View>
  );
}

function Outcome({
  title,
  message,
  primary,
  secondary,
  supportReference,
}: {
  title: string;
  message: string;
  primary: { label: string; onPress: () => void };
  secondary?: { label: string; onPress: () => void };
  /** Affiche « Contacter le support » avec cette référence (NOISE-057). */
  supportReference?: string;
}) {
  return (
    <View style={styles.center} accessibilityLiveRegion="polite">
      <Text variant="title" style={styles.textCenter}>
        {title}
      </Text>
      <Text muted style={styles.textCenter}>
        {message}
      </Text>
      <View style={styles.actions}>
        <Button label={primary.label} onPress={primary.onPress} />
        {secondary ? (
          <Button variant="text" label={secondary.label} onPress={secondary.onPress} />
        ) : null}
        {supportReference ? <SupportButton reference={supportReference} /> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { gap: spacing.md, paddingBottom: spacing.xl },
  header: { gap: spacing.xs, marginBottom: spacing.sm },
  center: { flex: 1, justifyContent: 'center', alignItems: 'stretch', gap: spacing.lg },
  textCenter: { textAlign: 'center' },
  card: {
    gap: spacing.xs,
    padding: spacing.lg,
    borderRadius: radii.card,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.surface,
  },
  typeRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  row: { flexDirection: 'row', gap: spacing.md },
  choice: {
    flex: 1,
    alignItems: 'center',
    padding: spacing.lg,
    borderRadius: radii.field,
    borderWidth: 1,
    borderColor: colors.border,
  },
  choiceSelected: { borderColor: colors.secondary },
  quantity: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  stepButton: {
    width: minTouchTarget,
    height: minTouchTarget,
    borderRadius: radii.field,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  disabled: { opacity: 0.4 },
  actions: { gap: spacing.md, marginTop: spacing.lg },
});
