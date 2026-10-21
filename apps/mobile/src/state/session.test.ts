import { isAppRole, useSession } from './session';

beforeEach(() => {
  useSession.setState({ status: 'loading', role: null, pendingRole: null });
});

describe('session', () => {
  it('démarre en chargement, puis déconnecté après hydratation', () => {
    expect(useSession.getState().status).toBe('loading');
    useSession.getState().hydrate();
    expect(useSession.getState().status).toBe('signedOut');
  });

  it('mémorise le rôle choisi à la bienvenue', () => {
    useSession.getState().setPendingRole('ORGANIZER');
    expect(useSession.getState().pendingRole).toBe('ORGANIZER');
  });

  it('connecte dans le rôle du compte (un compte, un rôle : DEC-028)', () => {
    useSession.getState().setPendingRole('PARTICIPANT');
    useSession.getState().signIn('ORGANIZER');
    expect(useSession.getState()).toMatchObject({
      status: 'signedIn',
      role: 'ORGANIZER',
      pendingRole: null,
    });
  });

  it('la déconnexion efface le rôle', () => {
    useSession.getState().signIn('PARTICIPANT');
    useSession.getState().signOut();
    expect(useSession.getState()).toMatchObject({ status: 'signedOut', role: null });
  });

  it('seuls participant et organisateur ont une vue mobile', () => {
    expect(isAppRole('PARTICIPANT')).toBe(true);
    expect(isAppRole('ORGANIZER')).toBe(true);
    expect(isAppRole('ADMIN')).toBe(false);
    expect(isAppRole(undefined)).toBe(false);
  });
});
