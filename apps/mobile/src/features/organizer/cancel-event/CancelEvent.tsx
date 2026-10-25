import type { CancellationResultDto, CancellationSummaryDto, EventDto } from '@noise/shared';
import { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { toApiError } from '../../../api/errors';
import type { CancellationApi } from '../../../api/cancellation';
import { Banner } from '../../../components/Banner';
import { Button } from '../../../components/Button';
import { StateView } from '../../../components/StateView';
import { Text } from '../../../components/Text';
import { TextField } from '../../../components/TextField';
import { colors, radii, spacing } from '../../../theme';
import { formatFcfa } from '../../participant/format';
import { REASON_MAX, checkReason, formatDueDate } from './cancel-rules';

type Props = {
  event: Pick<EventDto, 'id' | 'title'>;
  api: Pick<CancellationApi, 'preview' | 'cancel'>;
  /** Ferme l'écran (retour à « Mes événements »). */
  onClose: () => void;
};

type Load =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'ready'; summary: CancellationSummaryDto };

/** Étape en cours : relire le calcul, confirmer, puis voir le résultat. */
type Step = 'review' | 'confirm' | 'done';

/**
 * Annulation d'un événement (NOISE-029). Trois temps : le calcul des montants (DEC-025), une
 * confirmation explicite car l'annulation est irréversible, puis le récapitulatif. Les montants
 * viennent de l'API ; l'écran ne calcule rien.
 */
export function CancelEvent({ event, api, onClose }: Props) {
  const [load, setLoad] = useState<Load>({ kind: 'loading' });
  const [step, setStep] = useState<Step>('review');
  const [reason, setReason] = useState('');
  const [reasonError, setReasonError] = useState<string | undefined>();
  const [submitting, setSubmitting] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [result, setResult] = useState<CancellationResultDto | null>(null);

  const fetchPreview = useCallback(async () => {
    setLoad({ kind: 'loading' });
    try {
      setLoad({ kind: 'ready', summary: await api.preview(event.id) });
    } catch (e) {
      setLoad({ kind: 'error', message: toApiError(e).message });
    }
  }, [api, event.id]);

  useEffect(() => {
    void fetchPreview();
  }, [fetchPreview]);

  function goToConfirm() {
    const check = checkReason(reason);
    if (!check.ok) {
      setReasonError(check.message);
      return;
    }
    setReasonError(undefined);
    setFailure(null);
    setStep('confirm');
  }

  async function confirm() {
    const check = checkReason(reason);
    if (!check.ok) return;
    setSubmitting(true);
    setFailure(null);
    try {
      setResult(await api.cancel(event.id, check.input));
      setStep('done');
    } catch (e) {
      const error = toApiError(e);
      setFailure(
        error.isNetwork
          ? 'La connexion a été interrompue : nous ne savons pas si l’annulation a eu lieu. Réessayez : si l’événement est déjà annulé, vous en serez informé.'
          : error.message,
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (load.kind === 'loading') return <StateView kind="loading" />;
  if (load.kind === 'error') {
    return <StateView kind="error" message={load.message} onRetry={fetchPreview} />;
  }

  if (step === 'done' && result) return <Done event={event} result={result} onClose={onClose} />;

  const { summary } = load;
  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Text variant="title">Annuler l’événement</Text>
      <Text muted>{event.title}</Text>

      <Summary summary={summary} />

      {step === 'review' ? (
        <>
          <TextField
            label="Motif (facultatif)"
            hint="Il sera transmis aux acheteurs."
            value={reason}
            onChangeText={(value) => {
              setReason(value);
              setReasonError(undefined);
            }}
            error={reasonError}
            multiline
            maxLength={REASON_MAX}
          />
          <Button label="Continuer" onPress={goToConfirm} />
          <Button variant="text" label="Retour" onPress={onClose} />
        </>
      ) : (
        <>
          <Banner kind="warning">
            L’annulation est définitive : les billets seront invalidés, les liens du scanner
            révoqués et les acheteurs devront être remboursés. Vous ne pourrez pas revenir en
            arrière.
          </Banner>
          {failure ? <Banner kind="error">{failure}</Banner> : null}
          <Button label="Oui, annuler l’événement" loading={submitting} onPress={confirm} />
          <Button
            variant="secondary"
            label="Non, revenir"
            disabled={submitting}
            onPress={() => setStep('review')}
          />
        </>
      )}
    </ScrollView>
  );
}

function Row({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <View style={styles.row}>
      <Text variant={strong ? 'button' : 'body'} style={styles.rowLabel}>
        {label}
      </Text>
      <Text variant={strong ? 'button' : 'body'}>{value}</Text>
    </View>
  );
}

/** Le calcul de DEC-025, tel que renvoyé par l'API. */
function Summary({ summary }: { summary: CancellationSummaryDto }) {
  if (summary.ticketsSold === 0) {
    return (
      <View style={styles.card}>
        <Text>
          Aucun billet n’a été vendu : il n’y a rien à rembourser et aucun frais d’annulation.
        </Text>
      </View>
    );
  }
  return (
    <View style={styles.card} accessibilityLabel="Détail financier de l’annulation">
      <Row label="Billets vendus" value={String(summary.ticketsSold)} />
      <Row label="Ventes" value={formatFcfa(summary.salesXof)} />
      <Row label="Remboursement des acheteurs" value={formatFcfa(summary.refundTotalXof)} />
      <Text variant="caption" muted>
        Les acheteurs sont remboursés à 100 % du prix des billets, hors frais de paiement.
      </Text>
      <View style={styles.separator} />
      <Row
        label="Frais d’annulation (10 % des ventes)"
        value={formatFcfa(summary.cancellationFeeXof)}
      />
      <Row label="Déjà reversé à vous" value={formatFcfa(summary.alreadyPaidOutXof)} />
      <Row label="Part retenue par Noise" value={formatFcfa(summary.retainedXof)} />
      <View style={styles.separator} />
      <Row label="Somme à régler à Noise" value={formatFcfa(summary.organizerOwesXof)} strong />
      <Text variant="caption" muted>
        {`À régler avant le ${formatDueDate(summary.returnDueAt)} (10 jours après l’annulation).`}
      </Text>
    </View>
  );
}

function Done({
  event,
  result,
  onClose,
}: {
  event: Pick<EventDto, 'title'>;
  result: CancellationResultDto;
  onClose: () => void;
}) {
  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Text variant="title">Événement annulé</Text>
      <Text muted>{event.title}</Text>
      <Banner kind="info">
        {`${result.ticketsCancelled} billet(s) invalidé(s), ${result.scannerLinksRevoked} lien(s) du scanner révoqué(s).`}
      </Banner>
      <Summary summary={result} />
      <Button label="Retour à mes événements" onPress={onClose} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.lg, paddingVertical: spacing.lg },
  card: {
    gap: spacing.sm,
    padding: spacing.lg,
    borderRadius: radii.card,
    backgroundColor: colors.surface,
  },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md },
  rowLabel: { flex: 1 },
  separator: { height: 1, backgroundColor: colors.border, marginVertical: spacing.xs },
});
