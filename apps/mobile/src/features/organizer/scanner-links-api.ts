import { createScannerLinksApi } from '../../api/scanner-links';
import { api } from '../../auth/session-service';

/** Client des liens scanner lié à la session de l'app. */
export const scannerLinksApi = createScannerLinksApi(api);
