import type { PublicUser, UserRole } from '@noise/shared';
import { create } from 'zustand';

/** Les deux vues de l'app. ADMIN n'a pas de vue mobile (DEC-020). */
export type AppRole = Extract<UserRole, 'PARTICIPANT' | 'ORGANIZER'>;

export const isAppRole = (value: unknown): value is AppRole =>
  value === 'PARTICIPANT' || value === 'ORGANIZER';

type Status = 'loading' | 'signedOut' | 'signedIn';

type SessionState = {
  status: Status;
  user: PublicUser | null;
  /** Rôle du compte connecté : un compte, un rôle (DEC-029). Il décide de la vue affichée. */
  role: AppRole | null;
  /** Vrai si la session a été fermée par le serveur (écran 4d) : message sur la connexion. */
  sessionExpired: boolean;
  /** Rôle choisi sur l'écran de bienvenue : pré-remplit l'inscription et la connexion. */
  pendingRole: AppRole | null;

  /** Fin du chargement initial sans session (le jeton stocké est lu par hydrateSession). */
  hydrate: () => void;
  setPendingRole: (role: AppRole) => void;
  signIn: (role: AppRole, user?: PublicUser) => void;
  signOut: (expired?: boolean) => void;
};

export const useSession = create<SessionState>((set) => ({
  status: 'loading',
  user: null,
  sessionExpired: false,
  role: null,
  pendingRole: null,

  hydrate: () => set({ status: 'signedOut' }),

  setPendingRole: (role) => set({ pendingRole: role }),

  signIn: (role, user) =>
    set({
      status: 'signedIn',
      user: user ?? null,
      role,
      pendingRole: null,
      sessionExpired: false,
    }),

  signOut: (expired = false) =>
    set({
      status: 'signedOut',
      user: null,
      role: null,
      pendingRole: null,
      sessionExpired: expired,
    }),
}));
