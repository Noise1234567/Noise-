import type {
  AdminIdentityListQuery,
  AdminOrdersQuery,
  AdminPaymentsQuery,
  RefuseIdentityInput,
  SuspensionInput,
} from '@noise/shared';
import type { Request, Response } from 'express';
import type { PrismaClient } from '../../lib/prisma.js';
import type { AdminListsService } from './admin-lists.service.js';
import { writeAuditLog } from './admin-audit.js';
import type { IdentityReviewService } from './identity-review.service.js';
import type { ModerationService } from './moderation.service.js';
import { salesReportToCsv } from './sales-csv.js';
import type { SalesExportService } from './sales-export.service.js';

/** Nom de fichier lisible et sûr : « ventes-afro-night-cadjehoun-2026-10-07.csv ». */
function csvFileName(eventTitle: string, now = new Date()): string {
  const slug = eventTitle
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60);
  return `ventes-${slug || 'evenement'}-${now.toISOString().slice(0, 10)}.csv`;
}

interface AdminControllerDeps {
  prisma: PrismaClient;
  sales: SalesExportService;
  moderation: ModerationService;
  lists: AdminListsService;
  identity: IdentityReviewService;
}

export function createAdminController({
  prisma,
  sales,
  moderation,
  lists,
  identity,
}: AdminControllerDeps) {
  // L'identité de l'admin vient du jeton validé par requireAuth + requireRole('ADMIN').
  const adminId = (req: Request) => req.auth!.userId;
  const reason = (req: Request) => (req.body as SuspensionInput).reason;
  const param = (res: Response, name: string) => String(res.locals.params[name]);

  /** Un export de ventes est une donnée sensible : chaque lecture laisse une trace. */
  const auditSales = (req: Request, eventId: string, format: 'json' | 'csv') =>
    writeAuditLog(prisma, {
      adminId: adminId(req),
      action: 'SALES_EXPORTED',
      targetType: 'EVENT',
      targetId: eventId,
      metadata: { format },
    });

  return {
    salesReport: async (req: Request, res: Response) => {
      const eventId = String(req.params.eventId);
      const report = await sales.salesReport(eventId);
      await auditSales(req, eventId, 'json');
      res.json(report);
    },
    salesCsv: async (req: Request, res: Response) => {
      const eventId = String(req.params.eventId);
      const report = await sales.salesReport(eventId);
      await auditSales(req, eventId, 'csv');
      res
        .status(200)
        .type('text/csv; charset=utf-8')
        .attachment(csvFileName(report.eventTitle))
        .send(salesReportToCsv(report));
    },
    suspendUser: async (req: Request, res: Response) => {
      res.json(await moderation.suspendOrganizer(adminId(req), param(res, 'userId'), reason(req)));
    },
    reactivateUser: async (req: Request, res: Response) => {
      res.json(
        await moderation.reactivateOrganizer(adminId(req), param(res, 'userId'), reason(req)),
      );
    },
    suspendEvent: async (req: Request, res: Response) => {
      res.json(await moderation.suspendEvent(adminId(req), param(res, 'eventId'), reason(req)));
    },
    reactivateEvent: async (req: Request, res: Response) => {
      res.json(await moderation.reactivateEvent(adminId(req), param(res, 'eventId'), reason(req)));
    },
    listIdentities: async (_req: Request, res: Response) => {
      res.json(await identity.list(res.locals.query as AdminIdentityListQuery));
    },
    identityDocument: async (req: Request, res: Response) => {
      res.json(await identity.documentLink(adminId(req), param(res, 'userId')));
    },
    approveIdentity: async (req: Request, res: Response) => {
      res.json(await identity.approve(adminId(req), param(res, 'userId')));
    },
    refuseIdentity: async (req: Request, res: Response) => {
      const { reason, immediate } = req.body as RefuseIdentityInput;
      res.json(await identity.refuse(adminId(req), param(res, 'userId'), { reason, immediate }));
    },
    listOrders: async (_req: Request, res: Response) => {
      res.json(await lists.listOrders(res.locals.query as AdminOrdersQuery));
    },
    listPayments: async (_req: Request, res: Response) => {
      res.json(await lists.listPayments(res.locals.query as AdminPaymentsQuery));
    },
  };
}
