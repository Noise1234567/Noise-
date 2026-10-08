import type { PublicUser, UserRole } from '@noise/shared';
import { create } from 'zustand';

/** Les deux vues de l'app. ADMIN n'a pas de vue mobile (DEC-020). */
export type AppRole = Extract<UserRole, 'PARTICIPANT' | 'ORGANIZER'>;

type Status = 'loading' | 'signedOut' | 'signedIn';

type SessionState = {
  status: Status;
  user: PublicUser | null;
  /** Rôles activés sur le compte connecté. */
  roles: AppRole[];
  /** Vue affichée. Seule la pile racine change quand on bascule, le jeton reste le même. */
  activeRole: AppRole | null;
  /** Vrai si la session a été fermée par le serveur (écran 4d) : message sur la connexion. */
  sessionExpired: boolean;
  /** Rôle choisi sur l'écran de bienvenue, avant l'inscription. */
  pendingRole: AppRole | null;

  /** Fin du chargement initial sans session (le jeton stocké est lu par hydrateSession). */
  hydrate: () => void;
  setPendingRole: (role: AppRole) => void;
  signIn: (roles: AppRole[], preferredRole?: AppRole, user?: PublicUser) => void;
  signOut: (expired?: boolean) => void;
  /**
   * Bascule de vue sans reconnexion. Renvoie false si le rôle n'est pas activé :
   * l'écran doit alors proposer la feuille d'activation (une requête API, pas de reconnexion).
   */
  switchRole: (role: AppRole) => boolean;
};

export const useSession = create<SessionState>((set, get) => ({
  status: 'loading',
  user: null,
  sessionExpired: false,
  roles: [],
  activeRole: null,
  pendingRole: null,

  hydrate: () => set({ status: 'signedOut' }),

  setPendingRole: (role) => set({ pendingRole: role }),

  signIn: (roles, preferredRole, user) => {
    const activeRole =
      preferredRole && roles.includes(preferredRole) ? preferredRole : (roles[0] ?? null);
    if (!activeRole) return;
    set({
      status: 'signedIn',
      user: user ?? null,
      roles,
      activeRole,
      pendingRole: null,
      sessionExpired: false,
    });
  },

  signOut: (expired = false) =>
    set({
      status: 'signedOut',
      user: null,
      roles: [],
      activeRole: null,
      pendingRole: null,
      sessionExpired: expired,
    }),

  switchRole: (role) => {
    if (!get().roles.includes(role)) return false;
    set({ activeRole: role });
    return true;
  },
}));
