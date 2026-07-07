import { apiRequest } from './apiClient';

export interface ContractAppendixResponse {
  appendixId: string;
  contractId?: string | null;
  orderId: string;
  appendixNumber: string;
  adjustedPrice: number;
  reason?: string | null;
  status: string;
  draftHtmlContent?: string | null;
  pdfUrl?: string | null;
  createdAt?: string | null;
  sentAt?: string | null;
  resolvedAt?: string | null;
  penaltyBill?: unknown;
  returnSlip?: unknown;
}

interface ApiResponse<T> {
  success: boolean;
  message?: string | null;
  data?: T | null;
}

function getAuthHeaders(accessToken: string) {
  return {
    Authorization: `Bearer ${accessToken}`,
  };
}

export function getAppendixByOrder(accessToken: string, orderId: string) {
  return apiRequest<ApiResponse<ContractAppendixResponse>>(
    `/api/contracts/appendices/by-order/${orderId}`,
    {
      method: 'GET',
      headers: getAuthHeaders(accessToken),
    }
  );
}

export function getAppendixById(accessToken: string, appendixId: string) {
  return apiRequest<ApiResponse<ContractAppendixResponse>>(
    `/api/contracts/appendices/${appendixId}`,
    {
      method: 'GET',
      headers: getAuthHeaders(accessToken),
    }
  );
}

export function getAppendixHtml(accessToken: string, appendixId: string) {
  return apiRequest<ApiResponse<string> | string>(
    `/api/contracts/appendices/${appendixId}/html`,
    {
      method: 'GET',
      headers: getAuthHeaders(accessToken),
    }
  );
}

export function acceptAppendix(accessToken: string, appendixId: string) {
  return apiRequest<ApiResponse<ContractAppendixResponse>>(
    `/api/contracts/appendices/${appendixId}/accept`,
    {
      method: 'POST',
      headers: getAuthHeaders(accessToken),
    }
  );
}

export function rejectAppendix(accessToken: string, appendixId: string) {
  return apiRequest<ApiResponse<ContractAppendixResponse>>(
    `/api/contracts/appendices/${appendixId}/reject`,
    {
      method: 'POST',
      headers: getAuthHeaders(accessToken),
    }
  );
}
