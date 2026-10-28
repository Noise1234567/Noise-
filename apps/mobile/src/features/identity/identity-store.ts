import type { MyIdentityResponse } from '@noise/shared';
import { create } from 'zustand';

type IdentityState = {
  /** Compte auquel appartient `identity` : ne jamais montrer le statut d'un autre compte. */
  userId: string | null;
  identity: MyIdentityResponse | null;
  set: (userId: string, identity: MyIdentityResponse) => void;
};

/**
 * Dernier statut connu, partagé entre le tableau de bord, le profil et l'écran d'envoi :
 * après un envoi, les trois se mettent à jour sans nouvel appel.
 */
export const useIdentityStore = create<IdentityState>((set) => ({
  userId: null,
  identity: null,
  set: (userId, identity) => set({ userId, identity }),
}));
