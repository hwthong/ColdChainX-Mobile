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

export function getAllClaims(accessToken: string, pageNumber = 1, pageSize = 100) {
  const params = new URLSearchParams();
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
  }).then((response): ApiResponse<ClaimResponse> => ({
    ...response,
    data: response.data ? normalizeClaimResponse(response.data) : null,
  }));
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
  }).then((response): ApiResponse<ClaimResponse> => ({
    ...response,
    data: response.data ? normalizeClaimResponse(response.data) : null,
  }));
}

export function normalizeClaimResponse(raw: any): ClaimResponse {
  if (!raw) return raw;
  const evidencesRaw = raw.evidences ?? raw.Evidences ?? raw.claimEvidences ?? raw.ClaimEvidences ?? [];
  return {
    claimId: raw.claimId ?? raw.ClaimId ?? '',
    claimCode: raw.claimCode ?? raw.ClaimCode ?? '',
    orderId: raw.orderId ?? raw.OrderId ?? null,
    orderTrackingCode: raw.orderTrackingCode ?? raw.OrderTrackingCode ?? null,
    claimType: raw.claimType ?? raw.ClaimType ?? '',
    description: raw.description ?? raw.Description ?? '',
    faultOwner: raw.faultOwner ?? raw.FaultOwner ?? null,
    status: raw.status ?? raw.Status ?? 'OPEN',
    resolutionNote: raw.resolutionNote ?? raw.ResolutionNote ?? null,
    createdAt: raw.createdAt ?? raw.CreatedAt ?? null,
    resolvedAt: raw.resolvedAt ?? raw.ResolvedAt ?? null,
    evidences: Array.isArray(evidencesRaw)
      ? evidencesRaw.map((e: any) => ({
          evidenceId: e.evidenceId ?? e.EvidenceId ?? '',
          evidenceType: e.evidenceType ?? e.EvidenceType ?? '',
          imageUrl: e.imageUrl ?? e.ImageUrl ?? null,
          uploadedBy: e.uploadedBy ?? e.UploadedBy ?? null,
          uploadedByUsername: e.uploadedByUsername ?? e.UploadedByUsername ?? null,
          createdAt: e.createdAt ?? e.CreatedAt ?? null,
          uploadedAt: e.uploadedAt ?? e.UploadedAt ?? null,
        }))
      : [],
  };
}

function normalizeClaimPage(page?: any): ClaimPage | null {
  if (!page) return null;
  const rawList = Array.isArray(page)
    ? page
    : page.data ?? page.Data ?? page.items ?? page.Items ?? [];
  const list = Array.isArray(rawList) ? rawList.map(normalizeClaimResponse) : [];

  return {
    data: list,
    totalRecords: page.totalRecords ?? page.TotalRecords ?? list.length,
    totalPages: page.totalPages ?? page.TotalPages ?? 1,
    currentPage: page.currentPage ?? page.CurrentPage ?? page.pageNumber ?? page.PageNumber ?? 1,
    pageSize: page.pageSize ?? page.PageSize ?? list.length,
  };
}
