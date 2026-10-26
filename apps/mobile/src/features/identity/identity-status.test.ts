import type { MyIdentityResponse } from '@noise/shared';

import { ApiError } from '../../api/errors';
import { canSubmitIdentity, identityView, submitErrorMessage } from './identity-status';

const base: MyIdentityResponse = {
  status: 'NOT_SUBMITTED',
  canOrganize: false,
  submittedAt: null,
  refusalReason: null,
  resubmitDeadline: null,
  eventsPulled: false,
};
const make = (patch: Partial<MyIdentityResponse>): MyIdentityResponse => ({ ...base, ...patch });

describe('identityView', () => {
  it('aucune pièce : invite à l’envoyer', () => {
    const view = identityView(base);
    expect(view.tone).toBe('warning');
    expect(view.action).toBe('Envoyer ma pièce');
  });

  it('en attente : on peut déjà créer, aucun bouton', () => {
    const view = identityView(make({ status: 'PENDING', canOrganize: true }));
    expect(view.tone).toBe('warning');
    expect(view.message).toContain('Vous pouvez déjà créer');
    expect(view.action).toBeUndefined();
  });

  it('vérifiée : bandeau d’information, aucun bouton', () => {
    const view = identityView(make({ status: 'VERIFIED', canOrganize: true }));
    expect(view.tone).toBe('info');
    expect(view.title).toBe('Identité vérifiée');
    expect(view.action).toBeUndefined();
  });

  it('refusée avec délai : motif et date limite en heure du Bénin', () => {
    const view = identityView(
      make({
        status: 'REFUSED',
        refusalReason: 'Photo floue',
        resubmitDeadline: '2026-10-19T13:00:00.000Z',
      }),
    );
    expect(view.tone).toBe('error');
    expect(view.message).toContain('Motif : Photo floue.');
    expect(view.message).toContain('avant le lundi 19 octobre à 14:00');
    expect(view.action).toBe('Renvoyer une pièce');
  });

  it('refusée, événements retirés : le dit clairement', () => {
    const view = identityView(
      make({ status: 'REFUSED', refusalReason: 'Pièce illisible', eventsPulled: true }),
    );
    expect(view.message).toContain('retirés de la vente');
    expect(view.message).not.toContain('avant le');
  });

  it('refusée sans délai ni retrait', () => {
    const view = identityView(make({ status: 'REFUSED' }));
    expect(view.message).toBe('Renvoyez une pièce pour pouvoir créer et publier vos soirées.');
  });
});

describe('canSubmitIdentity', () => {
  it('seulement sans pièce ou après un refus', () => {
    expect(canSubmitIdentity(base)).toBe(true);
    expect(canSubmitIdentity(make({ status: 'REFUSED' }))).toBe(true);
    expect(canSubmitIdentity(make({ status: 'PENDING' }))).toBe(false);
    expect(canSubmitIdentity(make({ status: 'VERIFIED' }))).toBe(false);
  });
});

describe('submitErrorMessage', () => {
  it('réseau coupé', () => {
    expect(submitErrorMessage(new ApiError(null, 'NETWORK', 'x'))).toContain(
      'Connexion impossible',
    );
  });

  it('429 avec délai en minutes, arrondi au-dessus', () => {
    expect(
      submitErrorMessage(new ApiError(429, 'RATE_LIMITED', 'x', undefined, undefined, 90)),
    ).toBe('Trop d’envois. Réessayez dans 2 min.');
  });

  it('429 sans délai', () => {
    expect(submitErrorMessage(new ApiError(429, 'RATE_LIMITED', 'x'))).toBe(
      'Trop d’envois. Réessayez un peu plus tard.',
    );
  });

  it('400 : message du serveur (photo trop lourde, format refusé)', () => {
    expect(
      submitErrorMessage(new ApiError(400, 'VALIDATION_ERROR', 'Photo trop lourde (5 Mo maximum)')),
    ).toBe('Photo trop lourde (5 Mo maximum)');
  });

  it('erreur serveur : message générique', () => {
    expect(submitErrorMessage(new ApiError(500, 'INTERNAL', 'boom'))).toBe(
      'Envoi impossible pour le moment. Réessayez.',
    );
  });
});
