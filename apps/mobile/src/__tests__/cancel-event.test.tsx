import type { CancellationResultDto, CancellationSummaryDto } from '@noise/shared';
import { act, fireEvent, render, screen } from '@testing-library/react-native';

import { ApiError } from '../api/errors';
import { CancelEvent } from '../features/organizer/cancel-event/CancelEvent';

// Le premier rendu charge Zod et les écrans : sur une machine chargée, il dépasse 5 s.
jest.setTimeout(30_000);

const event = { id: 'evt-1', title: 'Afro Night' };

const summary: CancellationSummaryDto = {
  eventId: 'evt-1',
  ticketsSold: 40,
  salesXof: 200_000,
  refundTotalXof: 200_000,
  cancellationFeeXof: 20_000,
  alreadyPaidOutXof: 100_000,
  retainedXof: 80_000,
  organizerOwesXof: 120_000,
  returnDueAt: '2026-11-04T10:00:00.000Z',
};

const result: CancellationResultDto = {
  ...summary,
  cancelledAt: '2026-10-25T10:00:00.000Z',
  ticketsCancelled: 40,
  ordersCancelled: 25,
  ordersExpired: 1,
  scannerLinksRevoked: 2,
};

const press = (name: string) => fireEvent.press(screen.getByRole('button', { name }));

async function open(api: Parameters<typeof CancelEvent>[0]['api'], onClose = jest.fn()) {
  await render(<CancelEvent event={event} api={api} onClose={onClose} />);
  await act(async () => {});
  return onClose;
}

describe('Annulation d’un événement', () => {
  it('affiche le calcul de l’API avant toute confirmation', async () => {
    const api = { preview: jest.fn(async () => summary), cancel: jest.fn() };
    await open(api);

    expect(screen.getByText('Annuler l’événement')).toBeTruthy();
    expect(screen.getByText('Afro Night')).toBeTruthy();
    expect(screen.getByText('40')).toBeTruthy();
    expect(screen.getAllByText('200 000 FCFA').length).toBe(2); // ventes et remboursements
    expect(screen.getByText('20 000 FCFA')).toBeTruthy(); // frais
    expect(screen.getByText('120 000 FCFA')).toBeTruthy(); // à régler
    expect(screen.getByText(/avant le 04\/11\/2026/)).toBeTruthy();
    expect(api.cancel).not.toHaveBeenCalled();
  });

  it('dit qu’il n’y a rien à rembourser quand aucun billet n’est vendu', async () => {
    const api = {
      preview: jest.fn(async () => ({ ...summary, ticketsSold: 0, salesXof: 0 })),
      cancel: jest.fn(),
    };
    await open(api);
    expect(screen.getByText(/Aucun billet n’a été vendu/)).toBeTruthy();
    expect(screen.queryByText('Billets vendus')).toBeNull();
  });

  it('propose de réessayer quand le calcul ne se charge pas', async () => {
    const preview = jest
      .fn()
      .mockRejectedValueOnce(new ApiError(null, 'NETWORK', 'Connexion impossible'))
      .mockResolvedValueOnce(summary);
    await open({ preview, cancel: jest.fn() });
    expect(screen.getByText('Connexion impossible')).toBeTruthy();

    await act(async () => press('Réessayer'));
    expect(screen.getByText('Billets vendus')).toBeTruthy();
  });

  it('demande une confirmation avant d’annuler, et n’annule pas si on revient', async () => {
    const api = { preview: jest.fn(async () => summary), cancel: jest.fn() };
    await open(api);

    await act(async () => press('Continuer'));
    expect(screen.getByText(/L’annulation est définitive/)).toBeTruthy();
    expect(api.cancel).not.toHaveBeenCalled();

    await act(async () => press('Non, revenir'));
    expect(screen.getByRole('button', { name: 'Continuer' })).toBeTruthy();
    expect(api.cancel).not.toHaveBeenCalled();
  });

  it('envoie le motif rogné, puis affiche le récapitulatif', async () => {
    const api = { preview: jest.fn(async () => summary), cancel: jest.fn(async () => result) };
    const onClose = await open(api);

    await fireEvent.changeText(
      screen.getByLabelText('Motif (facultatif)'),
      '  Salle indisponible ',
    );
    await act(async () => press('Continuer'));
    await act(async () => press('Oui, annuler l’événement'));

    expect(api.cancel).toHaveBeenCalledWith('evt-1', { reason: 'Salle indisponible' });
    expect(screen.getByText('Événement annulé')).toBeTruthy();
    expect(screen.getByText(/40 billet\(s\) invalidé\(s\), 2 lien\(s\)/)).toBeTruthy();

    await act(async () => press('Retour à mes événements'));
    expect(onClose).toHaveBeenCalled();
  });

  it('envoie un corps vide quand aucun motif n’est saisi', async () => {
    const api = { preview: jest.fn(async () => summary), cancel: jest.fn(async () => result) };
    await open(api);
    await act(async () => press('Continuer'));
    await act(async () => press('Oui, annuler l’événement'));
    expect(api.cancel).toHaveBeenCalledWith('evt-1', {});
  });

  it('refuse un motif trop court sans passer à la confirmation', async () => {
    const api = { preview: jest.fn(async () => summary), cancel: jest.fn() };
    await open(api);
    await fireEvent.changeText(screen.getByLabelText('Motif (facultatif)'), 'ab');
    await act(async () => press('Continuer'));
    expect(screen.getByText(/au moins 3 caractères/)).toBeTruthy();
    expect(screen.queryByText(/L’annulation est définitive/)).toBeNull();
  });

  it('affiche le refus de l’API (déjà annulé) et reste sur la confirmation', async () => {
    const cancel = jest
      .fn()
      .mockRejectedValue(new ApiError(409, 'CONFLICT', 'Cet événement est déjà annulé'));
    await open({ preview: jest.fn(async () => summary), cancel });
    await act(async () => press('Continuer'));
    await act(async () => press('Oui, annuler l’événement'));

    expect(screen.getByText('Cet événement est déjà annulé')).toBeTruthy();
    expect(screen.queryByText('Événement annulé')).toBeNull();
  });

  it('prévient quand la connexion coupe pendant l’annulation', async () => {
    const cancel = jest
      .fn()
      .mockRejectedValue(new ApiError(null, 'NETWORK', 'Connexion impossible'));
    await open({ preview: jest.fn(async () => summary), cancel });
    await act(async () => press('Continuer'));
    await act(async () => press('Oui, annuler l’événement'));
    expect(screen.getByText(/nous ne savons pas si l’annulation a eu lieu/)).toBeTruthy();
  });
});
