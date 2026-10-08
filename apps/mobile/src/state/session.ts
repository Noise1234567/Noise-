import type { UserRole } from '@noise/shared';
import { create } from 'zustand';

/** Les deux vues de l'app. ADMIN n'a pas de vue mobile (DEC-020). */
export type AppRole = Extract<UserRole, 'PARTICIPANT' | 'ORGANIZER'>;

type Status = 'loading' | 'signedOut' | 'signedIn';

type SessionState = {
  status: Status;
  /** Rôles activés sur le compte connecté. */
  roles: AppRole[];
  /** Vue affichée. Seule la pile racine change quand on bascule, le jeton reste le même. */
  activeRole: AppRole | null;
  /** Rôle choisi sur l'écran de bienvenue, avant l'inscription. */
  pendingRole: AppRole | null;

  /** Fin du chargement initial. NOISE-008 (PR 2) y lira le jeton stocké. */
  hydrate: () => void;
  setPendingRole: (role: AppRole) => void;
  signIn: (roles: AppRole[], preferredRole?: AppRole) => void;
  signOut: () => void;
  /**
   * Bascule de vue sans reconnexion. Renvoie false si le rôle n'est pas activé :
   * l'écran doit alors proposer la feuille d'activation (une requête API, pas de reconnexion).
   */
  switchRole: (role: AppRole) => boolean;
};

export const useSession = create<SessionState>((set, get) => ({
  status: 'loading',
  roles: [],
  activeRole: null,
  pendingRole: null,

  hydrate: () => set({ status: 'signedOut' }),

  setPendingRole: (role) => set({ pendingRole: role }),

  signIn: (roles, preferredRole) => {
    const activeRole =
      preferredRole && roles.includes(preferredRole) ? preferredRole : (roles[0] ?? null);
    if (!activeRole) return;
    set({ status: 'signedIn', roles, activeRole, pendingRole: null });
  },

  signOut: () => set({ status: 'signedOut', roles: [], activeRole: null, pendingRole: null }),

  switchRole: (role) => {
    if (!get().roles.includes(role)) return false;
    set({ activeRole: role });
    return true;
  },
}));
