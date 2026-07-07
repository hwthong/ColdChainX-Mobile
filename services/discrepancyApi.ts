import { buildApiUrl } from './apiClient';

export function getDiscrepancyPdf(receiptId: string) {
  return buildApiUrl(`/api/Discrepancy/${receiptId}/pdf`);
}
