import { EVENT_STYLES, MAX_EVENT_STYLES, type CreateTicketTypeInput } from '@noise/shared';
import { useState, type ReactNode } from 'react';
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';

import type { EventWriteApi } from '../../../api/events';
import { toApiError } from '../../../api/errors';
import type { FieldErrors } from '../../../auth/forms';
import { Banner } from '../../../components/Banner';
import { Button } from '../../../components/Button';
import { Screen } from '../../../components/Screen';
import { Text } from '../../../components/Text';
import { TextField } from '../../../components/TextField';
import { colors, radii, spacing } from '../../../theme';
import {
  DEFAULT_CITY,
  formatDateInput,
  formatTimeInput,
  toggleStyle,
  emptyTicketValues,
  formatPrice,
  formatXof,
  organizerFeeLabel,
  organizerNetXof,
  revenueEstimate,
  toCreateEventInput,
  toEventDates,
  toInteger,
  toTicketInput,
  validateCapacity,
  validateInfo,
  validateTicket,
  validateWhenWhere,
  type InfoField,
  type InfoValues,
  type TicketField,
  type TicketValues,
  type WhenWhereField,
  type WhenWhereValues,
} from './draft';
import type { PickedPoster } from './poster';
import { describeSubmitError, emptyProgress, submitEvent, type SubmitProgress } from './submit';

const STEPS = ['Infos', 'Date et lieu', 'Affiche', 'Capacité et billets', 'Récapitulatif'] as const;
const STEP = { info: 0, whenWhere: 1, poster: 2, tickets: 3, summary: 4 } as const;

type Props = {
  api: EventWriteApi;
  /** Ouvre la galerie et compresse l'image (poster.ts) ; injecté pour les tests. */
  pickPoster: () => Promise<PickedPoster | null>;
  /** Quitter l'assistant (retour depuis la première étape, ou après l'envoi). */
  onClose: () => void;
};

/**
 * Création d'un événement en 5 étapes (NOISE-013, CDC 3.3) : infos, date et lieu, affiche
 * (NOISE-012), capacité et types de billets (frais d'organisation DEC-023, commission
 * DEC-024), récapitulatif. L'événement est créé en brouillon puis publié si l'organisateur
 * le demande.
 */
export function CreateEventWizard({ api, pickPoster, onClose }: Props) {
  const [step, setStep] = useState<number>(STEP.info);
  const [info, setInfo] = useState<InfoValues>({ title: '', styles: [], description: '' });
  const [whenWhere, setWhenWhere] = useState<WhenWhereValues>({
    date: '',
    startTime: '',
    endTime: '',
    venue: '',
    city: DEFAULT_CITY,
  });
  const [poster, setPoster] = useState<PickedPoster | null>(null);
  const [capacity, setCapacity] = useState('');
  const [tickets, setTickets] = useState<CreateTicketTypeInput[]>([]);
  const [progress, setProgress] = useState<SubmitProgress>(emptyProgress);
  const [sending, setSending] = useState<'draft' | 'publish' | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function send(publish: boolean) {
    const event = toCreateEventInput(info, whenWhere, toInteger(capacity));
    if (!event) {
      setError('Certaines informations ne sont plus valides (date passée ?). Vérifiez les étapes.');
      return;
    }
    setError(null);
    setSending(publish ? 'publish' : 'draft');
    try {
      const done = await submitEvent(
        api,
        { event, poster, tickets, publish },
        progress,
        setProgress,
      );
      setProgress(done);
      setStep(STEPS.length);
    } catch (e) {
      setError(describeSubmitError(toApiError(e)));
    } finally {
      setSending(null);
    }
  }

  if (step === STEPS.length) {
    return (
      <Screen>
        <View style={styles.done}>
          <Text variant="title">
            {progress.published ? 'Événement publié' : 'Brouillon enregistré'}
          </Text>
          <Text muted style={styles.center}>
            {progress.published
              ? 'Votre événement est visible par les participants. Les ventes sont ouvertes.'
              : 'Votre événement n’est pas encore visible. Vous pourrez le publier plus tard.'}
          </Text>
          <Button label="Terminer" onPress={onClose} />
        </View>
      </Screen>
    );
  }

  const back = () => (step === STEP.info ? onClose() : setStep(step - 1));

  return (
    <Screen>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
      >
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text variant="caption" muted accessibilityRole="header">
            Étape {step + 1} sur {STEPS.length} · {STEPS[step]}
          </Text>
          <View style={styles.progress}>
            {STEPS.map((label, index) => (
              <View
                key={label}
                style={[styles.segment, index <= step ? styles.segmentDone : null]}
              />
            ))}
          </View>
          <Text variant="title">Créer un événement</Text>

          {step === STEP.info ? (
            <InfoStep
              values={info}
              onChange={setInfo}
              onNext={() => setStep(STEP.whenWhere)}
              onBack={back}
            />
          ) : null}
          {step === STEP.whenWhere ? (
            <WhenWhereStep
              values={whenWhere}
              onChange={setWhenWhere}
              onNext={() => setStep(STEP.poster)}
              onBack={back}
            />
          ) : null}
          {step === STEP.poster ? (
            <PosterStep
              poster={poster}
              pickPoster={pickPoster}
              onChange={setPoster}
              onNext={() => setStep(STEP.tickets)}
              onBack={back}
            />
          ) : null}
          {step === STEP.tickets ? (
            <TicketsStep
              capacity={capacity}
              onCapacityChange={setCapacity}
              eventEndsAt={toEventDates(whenWhere)?.endsAt ?? null}
              tickets={tickets}
              locked={progress.savedTickets}
              capacityLocked={progress.eventId !== null}
              onChange={setTickets}
              onNext={() => setStep(STEP.summary)}
              onBack={back}
            />
          ) : null}
          {step === STEP.summary ? (
            <SummaryStep
              capacity={toInteger(capacity)}
              info={info}
              whenWhere={whenWhere}
              poster={poster}
              tickets={tickets}
              error={error}
              sending={sending}
              onEdit={setStep}
              onSend={send}
              onBack={back}
            />
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

function Actions({ children }: { children: ReactNode }) {
  return <View style={styles.actions}>{children}</View>;
}

/** Affiche facultative : choisie dans la galerie, recadrée en portrait, compressée. */
function PosterStep({
  poster,
  pickPoster,
  onChange,
  onNext,
  onBack,
}: {
  poster: PickedPoster | null;
  pickPoster: () => Promise<PickedPoster | null>;
  onChange: (poster: PickedPoster | null) => void;
  onNext: () => void;
  onBack: () => void;
}) {
  const [picking, setPicking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function choose() {
    setError(null);
    setPicking(true);
    try {
      const picked = await pickPoster();
      if (picked) onChange(picked);
    } catch {
      setError('Impossible d’ouvrir cette image. Essayez-en une autre.');
    } finally {
      setPicking(false);
    }
  }

  return (
    <>
      <View style={styles.form}>
        {poster ? (
          <Image
            source={{ uri: poster.uri }}
            accessibilityLabel="Aperçu de l’affiche"
            style={[styles.poster, { aspectRatio: poster.width / poster.height }]}
          />
        ) : (
          <View style={[styles.poster, styles.posterEmpty]}>
            <Text muted style={styles.center}>
              Une affiche donne envie : les événements avec affiche sont plus visibles.
            </Text>
          </View>
        )}
        <Button
          variant="secondary"
          label={poster ? 'Changer l’affiche' : 'Choisir une affiche'}
          loading={picking}
          onPress={choose}
        />
        {poster ? <Button variant="text" label="Retirer" onPress={() => onChange(null)} /> : null}
        <Text variant="caption" muted>
          Format portrait conseillé. L’image est réduite et compressée avant l’envoi.
        </Text>
        {error ? <Banner kind="error">{error}</Banner> : null}
      </View>
      <Actions>
        <Button label={poster ? 'Continuer' : 'Continuer sans affiche'} onPress={onNext} />
        <Button variant="text" label="Retour" onPress={onBack} />
      </Actions>
    </>
  );
}

function InfoStep({
  values,
  onChange,
  onNext,
  onBack,
}: {
  values: InfoValues;
  onChange: (values: InfoValues) => void;
  onNext: () => void;
  onBack: () => void;
}) {
  const [errors, setErrors] = useState<FieldErrors<InfoField>>({});
  const set = (field: 'title' | 'description') => (value: string) =>
    onChange({ ...values, [field]: value });

  function next() {
    const found = validateInfo(values);
    setErrors(found);
    if (Object.keys(found).length === 0) onNext();
  }

  return (
    <>
      <View style={styles.form}>
        <TextField
          label="Titre"
          value={values.title}
          onChangeText={set('title')}
          error={errors.title}
          placeholder="Afro Night Cadjèhoun"
          maxLength={120}
        />
        <View style={styles.group}>
          <Text variant="caption" muted>
            Styles (1 à {MAX_EVENT_STYLES})
          </Text>
          <View style={styles.chips}>
            {EVENT_STYLES.map((style) => {
              const selected = values.styles.includes(style);
              return (
                <Pressable
                  key={style}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  onPress={() => onChange({ ...values, styles: toggleStyle(values.styles, style) })}
                  style={[styles.chip, selected ? styles.chipSelected : null]}
                >
                  <Text variant="caption">{style}</Text>
                </Pressable>
              );
            })}
          </View>
          {errors.styles ? (
            <Text variant="caption" accessibilityRole="alert" style={{ color: colors.errorText }}>
              {errors.styles}
            </Text>
          ) : null}
        </View>
        <TextField
          label="Description"
          value={values.description}
          onChangeText={set('description')}
          error={errors.description}
          placeholder="Line-up, dress code, infos pratiques…"
          multiline
          maxLength={5000}
        />
      </View>
      <Actions>
        <Button label="Continuer" onPress={next} />
        <Button variant="text" label="Annuler" onPress={onBack} />
      </Actions>
    </>
  );
}

function WhenWhereStep({
  values,
  onChange,
  onNext,
  onBack,
}: {
  values: WhenWhereValues;
  onChange: (values: WhenWhereValues) => void;
  onNext: () => void;
  onBack: () => void;
}) {
  const [errors, setErrors] = useState<FieldErrors<WhenWhereField>>({});
  const set = (field: WhenWhereField, format?: (v: string) => string) => (value: string) =>
    onChange({ ...values, [field]: format ? format(value) : value });

  function next() {
    const found = validateWhenWhere(values);
    setErrors(found);
    if (Object.keys(found).length === 0) onNext();
  }

  return (
    <>
      <View style={styles.form}>
        <TextField
          label="Date"
          value={values.date}
          onChangeText={set('date', formatDateInput)}
          error={errors.date}
          hint="JJ/MM/AAAA, heure de Cotonou"
          placeholder="25/11/2026"
          keyboardType="number-pad"
        />
        <View style={styles.row}>
          <View style={styles.flex}>
            <TextField
              label="Début"
              value={values.startTime}
              onChangeText={set('startTime', formatTimeInput)}
              error={errors.startTime}
              placeholder="22:00"
              keyboardType="number-pad"
            />
          </View>
          <View style={styles.flex}>
            <TextField
              label="Fin"
              value={values.endTime}
              onChangeText={set('endTime', formatTimeInput)}
              error={errors.endTime}
              placeholder="04:00"
              keyboardType="number-pad"
            />
          </View>
        </View>
        <Text variant="caption" muted>
          Une fin plus tôt que le début est comptée le lendemain (22:00 → 04:00).
        </Text>
        <TextField
          label="Lieu"
          value={values.venue}
          onChangeText={set('venue')}
          error={errors.venue}
          placeholder="Le Code Bar, Haie Vive"
          maxLength={120}
        />
        <TextField
          label="Ville"
          value={values.city}
          onChangeText={set('city')}
          error={errors.city}
          maxLength={60}
        />
      </View>
      <Actions>
        <Button label="Continuer" onPress={next} />
        <Button variant="text" label="Retour" onPress={onBack} />
      </Actions>
    </>
  );
}

function TicketsStep({
  capacity,
  onCapacityChange,
  eventEndsAt,
  tickets,
  locked,
  capacityLocked,
  onChange,
  onNext,
  onBack,
}: {
  capacity: string;
  onCapacityChange: (value: string) => void;
  eventEndsAt: string | null;
  tickets: CreateTicketTypeInput[];
  /** Billets déjà enregistrés par le serveur (essai précédent) : non supprimables. */
  locked: string[];
  /** Événement déjà créé : la capacité est enregistrée, on ne la change plus ici. */
  capacityLocked: boolean;
  onChange: (tickets: CreateTicketTypeInput[]) => void;
  onNext: () => void;
  onBack: () => void;
}) {
  const [draft, setDraft] = useState<TicketValues>(emptyTicketValues);
  const [errors, setErrors] = useState<FieldErrors<TicketField>>({});
  const [capacityError, setCapacityError] = useState<string | undefined>();
  const [listError, setListError] = useState<string | null>(null);
  const set = (field: TicketField, format?: (v: string) => string) => (value: string) =>
    setDraft({ ...draft, [field]: format ? format(value) : value });

  const declared = tickets.reduce((sum, t) => sum + t.quantityTotal, 0);
  const seats = toInteger(capacity);
  const price = toInteger(draft.price);

  function add() {
    const capacityProblem = validateCapacity(capacity, declared);
    setCapacityError(capacityProblem);
    if (capacityProblem) return;
    const found = validateTicket(draft, { existing: tickets, capacity: seats, eventEndsAt });
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    onChange([...tickets, toTicketInput(draft)]);
    setDraft(emptyTicketValues);
    setListError(null);
  }

  function next() {
    const capacityProblem = validateCapacity(capacity, declared);
    setCapacityError(capacityProblem);
    if (capacityProblem) return;
    if (tickets.length === 0) {
      setListError('Ajoutez au moins un type de billet.');
      return;
    }
    onNext();
  }

  return (
    <>
      <View style={styles.form}>
        <TextField
          label="Nombre de participants attendus"
          value={capacity}
          onChangeText={(v) => {
            setCapacityError(undefined);
            onCapacityChange(v.replace(/\D/g, ''));
          }}
          error={capacityError}
          hint={organizerFeeLabel(seats) || 'Base des frais d’organisation et plafond des billets'}
          placeholder="300"
          keyboardType="number-pad"
          editable={!capacityLocked}
        />
        {!capacityError && seats > 0 ? (
          <Text variant="caption" muted>
            {Math.max(0, seats - declared)} place(s) restant à répartir entre les billets.
          </Text>
        ) : null}

        {tickets.map((ticket) => (
          <View key={ticket.name} style={styles.card}>
            <View style={styles.flex}>
              <Text variant="button">{ticket.name}</Text>
              <Text variant="caption" muted>
                {formatPrice(ticket.priceXof)} · {ticket.quantityTotal} places
                {ticket.priceXof > 0
                  ? ` · vous recevez ${formatXof(organizerNetXof(ticket.priceXof))} par billet`
                  : ''}
              </Text>
            </View>
            {locked.includes(ticket.name) ? (
              <Text variant="caption" muted>
                Enregistré
              </Text>
            ) : (
              <Text
                variant="caption"
                accessibilityRole="button"
                accessibilityLabel={`Retirer ${ticket.name}`}
                onPress={() => onChange(tickets.filter((t) => t.name !== ticket.name))}
                style={{ color: colors.secondary }}
              >
                Retirer
              </Text>
            )}
          </View>
        ))}

        <Text variant="section">Ajouter un type de billet</Text>
        <TextField
          label="Nom du billet"
          value={draft.name}
          onChangeText={set('name')}
          error={errors.name}
          placeholder="Early bird, Standard, VIP…"
          maxLength={60}
        />
        <View style={styles.row}>
          <View style={styles.flex}>
            <TextField
              label="Prix (FCFA)"
              value={draft.price}
              onChangeText={set('price')}
              error={errors.price}
              hint={
                price > 0
                  ? `Vous recevez ${formatXof(organizerNetXof(price))} (commission Noise 10 %)`
                  : price === 0
                    ? 'Billet gratuit'
                    : undefined
              }
              placeholder="5000"
              keyboardType="number-pad"
            />
          </View>
          <View style={styles.flex}>
            <TextField
              label="Quantité"
              value={draft.quantity}
              onChangeText={set('quantity')}
              error={errors.quantity}
              placeholder="200"
              keyboardType="number-pad"
            />
          </View>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ selected: draft.price === '0' }}
          onPress={() => set('price')('0')}
          style={[styles.chip, styles.chipAlone, draft.price === '0' ? styles.chipSelected : null]}
        >
          <Text variant="caption">Billet gratuit</Text>
        </Pressable>
        <View style={styles.row}>
          <View style={styles.flex}>
            <TextField
              label="Fin des ventes (facultatif)"
              value={draft.salesEndDate}
              onChangeText={set('salesEndDate', formatDateInput)}
              error={errors.salesEndDate}
              placeholder="JJ/MM/AAAA"
              keyboardType="number-pad"
            />
          </View>
          <View style={styles.flex}>
            <TextField
              label="Heure de fin des ventes"
              value={draft.salesEndTime}
              onChangeText={set('salesEndTime', formatTimeInput)}
              placeholder="HH:MM"
              keyboardType="number-pad"
            />
          </View>
        </View>
        <Text variant="caption" muted>
          Les frais Mobile Money sont payés par l’acheteur, en plus du prix du billet.
        </Text>
        <Button variant="secondary" label="Ajouter ce billet" onPress={add} />
        {listError ? <Banner kind="error">{listError}</Banner> : null}
      </View>
      <Actions>
        <Button label="Continuer" onPress={next} />
        <Button variant="text" label="Retour" onPress={onBack} />
      </Actions>
    </>
  );
}

function SummaryStep({
  capacity,
  info,
  whenWhere,
  poster,
  tickets,
  error,
  sending,
  onEdit,
  onSend,
  onBack,
}: {
  capacity: number;
  info: InfoValues;
  whenWhere: WhenWhereValues;
  poster: PickedPoster | null;
  tickets: CreateTicketTypeInput[];
  error: string | null;
  sending: 'draft' | 'publish' | null;
  onEdit: (step: number) => void;
  onSend: (publish: boolean) => void;
  onBack: () => void;
}) {
  const estimate = revenueEstimate(tickets, capacity);
  const declared = tickets.reduce((sum, t) => sum + t.quantityTotal, 0);
  return (
    <>
      <View style={styles.form}>
        <SummaryBlock title="Infos" onEdit={() => onEdit(STEP.info)}>
          <Text variant="button">{info.title.trim()}</Text>
          <Text variant="caption" muted>
            {info.styles.join(' · ')}
          </Text>
        </SummaryBlock>
        <SummaryBlock title="Date et lieu" onEdit={() => onEdit(STEP.whenWhere)}>
          <Text>
            {whenWhere.date} · {whenWhere.startTime} → {whenWhere.endTime}
          </Text>
          <Text variant="caption" muted>
            {whenWhere.venue.trim()}, {whenWhere.city.trim()}
          </Text>
        </SummaryBlock>
        <SummaryBlock title="Affiche" onEdit={() => onEdit(STEP.poster)}>
          {poster ? (
            <Image
              source={{ uri: poster.uri }}
              accessibilityLabel="Affiche choisie"
              style={[styles.posterThumb, { aspectRatio: poster.width / poster.height }]}
            />
          ) : (
            <Text muted>Aucune affiche</Text>
          )}
        </SummaryBlock>
        <SummaryBlock
          title={`Billets · ${declared} sur ${capacity} participants`}
          onEdit={() => onEdit(STEP.tickets)}
        >
          {tickets.map((ticket) => (
            <Text key={ticket.name}>
              {ticket.name} : {formatPrice(ticket.priceXof)} × {ticket.quantityTotal}
            </Text>
          ))}
        </SummaryBlock>
        <SummaryBlock title="Si tout est vendu">
          <Line label="Ventes" value={formatXof(estimate.grossXof)} />
          <Line label="Commission Noise (10 %)" value={`− ${formatXof(estimate.commissionXof)}`} />
          <Line label="Vous recevez" value={formatXof(estimate.organizerXof)} strong />
          <Text variant="caption" muted>
            Reversé sur votre Mobile Money le lendemain de chaque journée de ventes.
          </Text>
        </SummaryBlock>
        <SummaryBlock title="Frais d’organisation">
          <Text>
            {estimate.organizerFeeXof === 0
              ? 'Gratuit (50 participants ou moins)'
              : `${formatXof(estimate.organizerFeeXof)}, à régler avant la publication`}
          </Text>
        </SummaryBlock>
        <Text variant="caption" muted>
          En cas d’annulation, des frais de 10 % des ventes s’appliquent et les acheteurs sont
          remboursés. Une fois un billet vendu, la date ne peut plus être modifiée.
        </Text>
        {error ? <Banner kind="error">{error}</Banner> : null}
      </View>
      <Actions>
        <Button
          label={error ? 'Réessayer la publication' : 'Publier'}
          loading={sending === 'publish'}
          disabled={sending !== null}
          onPress={() => onSend(true)}
        />
        <Button
          variant="secondary"
          label="Enregistrer en brouillon"
          loading={sending === 'draft'}
          disabled={sending !== null}
          onPress={() => onSend(false)}
        />
        <Button variant="text" label="Retour" onPress={onBack} />
      </Actions>
    </>
  );
}

function Line({
  label,
  value,
  strong = false,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <View style={styles.line}>
      <Text variant={strong ? 'button' : 'body'}>{label}</Text>
      <Text variant={strong ? 'button' : 'body'}>{value}</Text>
    </View>
  );
}

function SummaryBlock({
  title,
  onEdit,
  children,
}: {
  title: string;
  onEdit?: () => void;
  children: ReactNode;
}) {
  return (
    <View style={styles.summary}>
      <View style={styles.summaryHeader}>
        <Text variant="caption" muted>
          {title}
        </Text>
        {onEdit ? (
          <Text
            variant="caption"
            accessibilityRole="button"
            accessibilityLabel={`Modifier : ${title}`}
            onPress={onEdit}
            style={{ color: colors.secondary }}
          >
            Modifier
          </Text>
        ) : null}
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { paddingBottom: spacing.xl, gap: spacing.md },
  progress: { flexDirection: 'row', gap: spacing.xs },
  segment: { flex: 1, height: 4, borderRadius: 2, backgroundColor: colors.border },
  segmentDone: { backgroundColor: colors.accent },
  form: { gap: spacing.lg, marginTop: spacing.md },
  group: { gap: spacing.sm },
  row: { flexDirection: 'row', gap: spacing.md },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.chip,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipSelected: { borderColor: colors.secondary },
  chipAlone: { alignSelf: 'flex-start' },
  poster: { width: '100%', borderRadius: radii.card, backgroundColor: colors.surface },
  posterEmpty: {
    aspectRatio: 4 / 5,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  posterThumb: { width: 96, borderRadius: radii.field },
  line: { flexDirection: 'row', justifyContent: 'space-between' },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radii.card,
    backgroundColor: colors.surface,
  },
  summary: {
    gap: spacing.xs,
    padding: spacing.lg,
    borderRadius: radii.card,
    backgroundColor: colors.surface,
  },
  summaryHeader: { flexDirection: 'row', justifyContent: 'space-between' },
  actions: { gap: spacing.md, marginTop: spacing.xl },
  done: { flex: 1, justifyContent: 'center', gap: spacing.lg },
  center: { textAlign: 'center' },
});
