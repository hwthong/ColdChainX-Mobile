import { apiRequest } from './apiClient';
import type { PagedResult } from './pagination';

export interface ApiResponse<T> {
  success: boolean;
  statusCode?: number;
  message?: string | null;
  data?: T | null;
  errors?: unknown;
  meta?: unknown;
}

export interface AsnScheduleResponse {
  asnId: string;
  asnCode: string;
  orderId: string;
  trackingCode?: string | null;
  itemName?: string | null;
  customerId?: string | null;
  customerName?: string | null;
  customerEmail?: string | null;
  customerUserId?: string | null;
  routeId?: string | null;
  routeCode?: string | null;
  requestedDropoffTime: string;
  cutOffTime?: string | null;
  status: string;
  qrCodeValue: string;
  warehouseId?: string | null;
}

export interface InboundScheduleResponse {
  asnId: string;
  asnCode: string;
  orderId: string;
  trackingCode?: string | null;
  customerId?: string | null;
  customerName?: string | null;
  itemName?: string | null;
  category?: string | null;
  quantity?: number;
  tempCondition?: string | null;
  expectedWeightKg?: number;
  expectedCbm?: number;
  destAddress?: string | null;
  requestedDropoffTime: string;
  status: string;
  qrCodeValue?: string | null;
  createdAt?: string | null;
  warehouseId?: string | null;
  warehouseName?: string | null;
}

export interface AsnResponse {
  asnId: string;
  asnCode: string;
  orderId: string;
  routeId: string;
  routeCode: string;
  requestedDropoffTime: string;
  cutOffTime: string;
  qrCodeValue: string;
  status: string;
  phone?: string | null;
  warehouseId?: string | null;
  customerId?: string | null;
  warehouseName?: string | null;
  warehouseAddress?: string | null;
  fileUrl?: string | null;
  createdAt?: string | null;
}

export interface CreateAsnRequest {
  orderId: string;
  requestedDropoffTime: string;
  phone?: string | null;
  warehouseId: string;
}

type ScheduleParams = {
  date?: string;
  status?: string;
  warehouseId?: string;
};

export interface InboundAsnParams {
  status?: string;
  dateFrom?: string;
  dateTo?: string;
  searchQuery?: string;
  warehouseId?: string;
  orderId?: string;
  customerId?: string;
  pageNumber?: number;
  pageSize?: number;
}

export function getAsnSchedule(accessToken?: string | null, params: ScheduleParams = {}) {
  const query = new URLSearchParams();
  if (params.date) query.set('date', params.date);
  if (params.status) query.set('status', params.status);
  if (params.warehouseId) query.set('warehouseId', params.warehouseId);

  const suffix = query.toString() ? `?${query.toString()}` : '';

  return apiRequest<ApiResponse<AsnScheduleResponse[]>>(`/api/v1/asns/schedule${suffix}`, {
    headers: accessToken ? getAuthHeaders(accessToken) : undefined,
  });
}

export function getInboundAsns(accessToken?: string | null, params: InboundAsnParams = {}) {
  const query = new URLSearchParams();
  if (params.status) query.set('status', params.status);
  if (params.dateFrom) query.set('dateFrom', params.dateFrom);
  if (params.dateTo) query.set('dateTo', params.dateTo);
  if (params.searchQuery) query.set('searchQuery', params.searchQuery);
  if (params.warehouseId) query.set('warehouseId', params.warehouseId);
  if (params.orderId) query.set('orderId', params.orderId);
  if (params.customerId) query.set('customerId', params.customerId);
  if (params.pageNumber) query.set('pageNumber', String(params.pageNumber));
  if (params.pageSize) query.set('pageSize', String(params.pageSize));

  const suffix = query.toString() ? `?${query.toString()}` : '';

  return apiRequest<ApiResponse<PagedResult<InboundScheduleResponse>>>(`/api/v1/asns${suffix}`, {
    headers: accessToken ? getAuthHeaders(accessToken) : undefined,
  });
}

export function getCustomerAsns(accessToken: string, customerId: string) {
  return apiRequest<ApiResponse<AsnResponse[]>>(`/api/v1/asns/customer/${customerId}`, {
    headers: getAuthHeaders(accessToken),
  });
}

export function createAsn(accessToken: string, request: CreateAsnRequest) {
  return apiRequest<ApiResponse<AsnResponse>>('/api/v1/asns', {
    method: 'POST',
    headers: getAuthHeaders(accessToken),
    body: {
      orderId: request.orderId,
      requestedDropoffTime: request.requestedDropoffTime,
      phone: request.phone || null,
      warehouseId: request.warehouseId,
    },
  });
}

function getAuthHeaders(accessToken: string) {
  return {
    Authorization: `Bearer ${accessToken}`,
  };
}
