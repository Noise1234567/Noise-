import { useSession } from './session';

beforeEach(() => {
  useSession.setState({ status: 'loading', roles: [], activeRole: null, pendingRole: null });
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

  it('connecte sur le rôle préféré, sinon sur le premier rôle', () => {
    useSession.getState().signIn(['PARTICIPANT', 'ORGANIZER'], 'ORGANIZER');
    expect(useSession.getState()).toMatchObject({
      status: 'signedIn',
      activeRole: 'ORGANIZER',
      pendingRole: null,
    });

    useSession.getState().signOut();
    useSession.getState().signIn(['PARTICIPANT'], 'ORGANIZER');
    expect(useSession.getState().activeRole).toBe('PARTICIPANT');
  });

  it('ne connecte pas un compte sans rôle', () => {
    useSession.getState().signIn([]);
    expect(useSession.getState().status).toBe('loading');
  });

  it('bascule entre deux rôles activés sans changer de session', () => {
    useSession.getState().signIn(['PARTICIPANT', 'ORGANIZER'], 'PARTICIPANT');
    expect(useSession.getState().switchRole('ORGANIZER')).toBe(true);
    expect(useSession.getState()).toMatchObject({ status: 'signedIn', activeRole: 'ORGANIZER' });
  });

  it('refuse de basculer vers un rôle non activé', () => {
    useSession.getState().signIn(['PARTICIPANT']);
    expect(useSession.getState().switchRole('ORGANIZER')).toBe(false);
    expect(useSession.getState().activeRole).toBe('PARTICIPANT');
  });

  it('la déconnexion efface les rôles', () => {
    useSession.getState().signIn(['PARTICIPANT', 'ORGANIZER']);
    useSession.getState().signOut();
    expect(useSession.getState()).toMatchObject({
      status: 'signedOut',
      roles: [],
      activeRole: null,
    });
  });
});
