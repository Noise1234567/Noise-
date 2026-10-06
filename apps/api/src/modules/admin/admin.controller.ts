import type { Request, Response } from 'express';
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

export function createAdminController(sales: SalesExportService) {
  const audit = (req: Request, action: string) => {
    // Chaque action d'administration est journalisée (DEC-020, NOISE-037).
    req.log.info(
      { adminId: req.auth?.userId, eventId: req.params.eventId, action },
      'Action admin',
    );
  };

  return {
    salesReport: async (req: Request, res: Response) => {
      const report = await sales.salesReport(String(req.params.eventId));
      audit(req, 'sales-report');
      res.json(report);
    },
    salesCsv: async (req: Request, res: Response) => {
      const report = await sales.salesReport(String(req.params.eventId));
      audit(req, 'sales-export-csv');
      res
        .status(200)
        .type('text/csv; charset=utf-8')
        .attachment(csvFileName(report.eventTitle))
        .send(salesReportToCsv(report));
    },
  };
}
