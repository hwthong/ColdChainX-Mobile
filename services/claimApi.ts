import { apiRequest } from './apiClient';

export type ClaimCategory = 'DAMAGE' | 'QUALITY_VIOLATION' | 'LOSS' | 'DELAY' | 'WRONG_ITEM';

export type ClaimEvidenceImage = {
  uri: string;
  fileName?: string | null;
  mimeType?: string | null;
  type?: string | null;
};

export interface CreateClaimPayload {
  orderId: string;
  claimType: ClaimCategory;
  description: string;
  evidenceImages?: ClaimEvidenceImage[];
}

export interface ClaimEvidenceResponse {
  evidenceId: string;
  evidenceType: string;
  imageUrl?: string | null;
  uploadedBy?: string | null;
  uploadedByUsername?: string | null;
  createdAt?: string | null;
  uploadedAt?: string | null;
}

export interface ClaimResponse {
  claimId: string;
  claimCode: string;
  orderId?: string | null;
  orderTrackingCode?: string | null;
  claimType: string;
  description: string;
  faultOwner?: string | null;
  status?: string | null;
  resolutionNote?: string | null;
  createdAt?: string | null;
  resolvedAt?: string | null;
  evidences?: ClaimEvidenceResponse[] | null;
}

export interface ClaimPage {
  totalRecords: number;
  totalPages: number;
  currentPage: number;
  pageNumber?: number;
  pageSize: number;
  data: ClaimResponse[];
  items?: ClaimResponse[];
}

export interface ApiResponse<T> {
  success: boolean;
  message?: string | null;
  data?: T | null;
}

export function getClaimsByOrder(accessToken: string, orderId: string, pageNumber = 1, pageSize = 20) {
  const params = new URLSearchParams();
  params.append('orderId', orderId);
  params.append('pageNumber', String(pageNumber));
  params.append('pageSize', String(pageSize));

  return apiRequest<ApiResponse<ClaimPage>>(`/api/v1/claims?${params.toString()}`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  }).then((response): ApiResponse<ClaimPage> => ({
    ...response,
    data: normalizeClaimPage(response.data),
  }));
}

export function getClaimById(accessToken: string, claimId: string) {
  return apiRequest<ApiResponse<ClaimResponse>>(`/api/v1/claims/${claimId}`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
}

export function createClaim(accessToken: string, payload: CreateClaimPayload) {
  const formData = new FormData();
  formData.append('OrderId', payload.orderId);
  formData.append('ClaimType', payload.claimType);
  formData.append('Description', payload.description.trim());

  payload.evidenceImages?.forEach((image, index) => {
    formData.append('EvidenceImages', {
      uri: image.uri,
      name: image.fileName || `claim-evidence-${index + 1}.jpg`,
      type: image.mimeType || image.type || 'image/jpeg',
    } as any);
  });

  return apiRequest<ApiResponse<ClaimResponse>>('/api/v1/claims', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    body: formData,
  });
}

function normalizeClaimPage(page?: ClaimPage | null): ClaimPage | null {
  if (!page) return null;
  const data = page.data ?? page.items ?? [];

  return {
    ...page,
    data,
    totalRecords: page.totalRecords ?? data.length,
    totalPages: page.totalPages ?? 1,
    currentPage: page.currentPage ?? page.pageNumber ?? 1,
    pageSize: page.pageSize ?? data.length,
  };
}
