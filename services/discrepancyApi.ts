import { apiRequest, buildApiUrl } from './apiClient';

export interface ResolveDiscrepancyPayload {
  lpnId: string;
  accept: boolean;
  penaltyAmount: number;
  penaltyReason: string;
}

export interface ResolveDiscrepancyResponse {
  success: boolean;
  message: string;
  penaltyBillId?: string | null;
}

export function resolveDiscrepancy(accessToken: string, payload: ResolveDiscrepancyPayload) {
  return apiRequest<ResolveDiscrepancyResponse>('/api/Discrepancy/resolve', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    body: {
      LpnId: payload.lpnId,
      Accept: payload.accept,
      PenaltyAmount: payload.penaltyAmount,
      PenaltyReason: payload.penaltyReason,
    },
  });
}

export function getDiscrepancyPdf(receiptId: string) {
  return buildApiUrl(`/api/Discrepancy/${receiptId}/pdf`);
}
