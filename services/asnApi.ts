import { apiRequest } from './apiClient';

export interface ApiResponse<T> {
  success: boolean;
  message?: string | null;
  data?: T | null;
}

export interface AsnScheduleResponse {
  asnId: string;
  asnCode: string;
  orderId: string;
  trackingCode?: string | null;
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
  fileUrl?: string | null;
  createdAt?: string | null;
}

export interface CreateAsnRequest {
  orderId: string;
  requestedDropoffTime: string;
  phone?: string | null;
  warehouseId?: string | null;
  customerId?: string | null;
}

type ScheduleParams = {
  date?: string;
  status?: string;
};

export function getAsnSchedule(accessToken?: string | null, params: ScheduleParams = {}) {
  const query = new URLSearchParams();
  if (params.date) query.set('date', params.date);
  if (params.status) query.set('status', params.status);

  const suffix = query.toString() ? `?${query.toString()}` : '';

  return apiRequest<ApiResponse<AsnScheduleResponse[]>>(`/api/v1/asns/schedule${suffix}`, {
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
      warehouseId: request.warehouseId || null,
      customerId: request.customerId || null,
    },
  });
}

function getAuthHeaders(accessToken: string) {
  return {
    Authorization: `Bearer ${accessToken}`,
  };
}
