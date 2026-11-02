import type {
  CreateOrderInput,
  InitiatePaymentRequest,
  InitiatePaymentResponse,
  OrderDto,
  OrderStatusResponse,
} from '@noise/shared';
import type { AxiosInstance } from 'axios';

/**
 * Achat d'un billet (docs/api.md sections 3 et 5, NOISE-018 et NOISE-019). Le mobile ne décide
 * jamais qu'un paiement a réussi : il lit le statut renvoyé par le serveur (CLAUDE.md section 3).
 */
const idempotency = (key?: string) => (key ? { headers: { 'Idempotency-Key': key } } : {});

export function createOrdersApi(client: AxiosInstance) {
  return {
    /**
     * Réserve les places pour 15 minutes ; une commande gratuite revient déjà PAID.
     * `intentKey` (Idempotency-Key, NOISE-053) : la même clé rejoue la réponse au lieu de
     * créer une seconde commande si la première réponse s'est perdue.
     */
    create: async (input: CreateOrderInput, intentKey?: string) =>
      (await client.post<{ order: OrderDto }>('/orders', input, idempotency(intentKey))).data.order,
    /** Envoie la demande de paiement sur le téléphone du payeur. */
    initiatePayment: async (input: InitiatePaymentRequest, intentKey?: string) =>
      (
        await client.post<InitiatePaymentResponse>(
          '/payments/initiate',
          input,
          idempotency(intentKey),
        )
      ).data,
    /** Statut de la commande ; l'API rattrape un webhook perdu en revérifiant le fournisseur. */
    status: async (orderId: string, signal?: AbortSignal) =>
      (await client.get<OrderStatusResponse>(`/orders/${orderId}/status`, { signal })).data,
  };
}

export type OrdersApi = ReturnType<typeof createOrdersApi>;
