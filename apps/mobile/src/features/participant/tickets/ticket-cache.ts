import AsyncStorage from '@react-native-async-storage/async-storage';
import type { TicketDto } from '@noise/shared';

/**
 * Billets enregistrés sur le téléphone (NOISE-022) : le QR reste affichable sans réseau, à
 * l'entrée d'une soirée où la 3G ne passe pas. Un cache par compte, effacé à la déconnexion
 * (un téléphone prêté ne montre pas les billets du précédent utilisateur).
 */

export type TicketStorage = {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
  removeItem: (key: string) => Promise<void>;
  getAllKeys: () => Promise<readonly string[]>;
};

export type CachedTickets = { tickets: TicketDto[]; syncedAt: string };

const PREFIX = 'noise.tickets.v1.';
const keyFor = (userId: string) => `${PREFIX}${userId}`;

const isTicket = (value: unknown): value is TicketDto => {
  const t = value as Partial<TicketDto> | null;
  return (
    typeof t === 'object' &&
    t !== null &&
    typeof t.id === 'string' &&
    typeof t.qrPayload === 'string' &&
    typeof t.eventTitle === 'string' &&
    typeof t.eventStartsAt === 'string' &&
    typeof t.status === 'string'
  );
};

export function createTicketCache(storage: TicketStorage = AsyncStorage) {
  return {
    async save(userId: string, tickets: TicketDto[], syncedAt: Date): Promise<void> {
      const value: CachedTickets = { tickets, syncedAt: syncedAt.toISOString() };
      await storage.setItem(keyFor(userId), JSON.stringify(value));
    },

    /** null si rien n'est enregistré ou si le contenu est illisible (jamais d'exception). */
    async load(userId: string): Promise<CachedTickets | null> {
      try {
        const raw = await storage.getItem(keyFor(userId));
        if (!raw) return null;
        const parsed = JSON.parse(raw) as Partial<CachedTickets>;
        if (!Array.isArray(parsed.tickets) || typeof parsed.syncedAt !== 'string') return null;
        return { tickets: parsed.tickets.filter(isTicket), syncedAt: parsed.syncedAt };
      } catch {
        return null;
      }
    },

    /** Efface les billets de tous les comptes (déconnexion). */
    async clearAll(): Promise<void> {
      const keys = (await storage.getAllKeys()).filter((key) => key.startsWith(PREFIX));
      await Promise.all(keys.map((key) => storage.removeItem(key)));
    },
  };
}

export type TicketCache = ReturnType<typeof createTicketCache>;

export const ticketCache = createTicketCache();
