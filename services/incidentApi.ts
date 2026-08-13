import { ApiClientError, apiRequest } from './apiClient';
import { ApiResponse } from './trackingApi';
import type { PagedResult } from './pagination';

export type IncidentType = 'ACCIDENT' | 'VEHICLE_BREAKDOWN' | 'TEMP_EXCURSION' | 'DAMAGE_CARGO' | 'DELAY';
export type IncidentSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type IncidentStatus = 'REPORTED' | 'RESCUE_DISPATCHED' | 'TRANSLOAD_COMPLETED' | 'CONTINUED' | 'RESOLVED';
export type IncidentExpenseStatus = 'NOT_REQUIRED' | 'PENDING_APPROVAL' | 'APPROVED' | 'REIMBURSED';

export interface IncidentRequestLogContext {
  tripId: string;
  hasEvidence: boolean;
  locationSource: 'DEVICE' | 'IOT';
}

export interface IncidentEvidence {
  evidenceId: string;
  fileUrl: string;
  evidenceType: 'INCIDENT_ATTACHMENT' | 'INCIDENT_PHOTO' | 'DRIVER_RECEIPT' | 'REIMBURSEMENT_RECEIPT' | 'RESOLUTION_PDF';
}

export interface IncidentResponse {
  incidentId: string;
  tripId?: string;
  tripCode?: string;
  reportedBy: string;
  reportedByUsername: string;
  brokenVehicleId?: string;
  replacementVehicleId?: string;
  maintenanceTicketId?: string;
  incidentType: IncidentType;
  severity: IncidentSeverity;
  description: string;
  requiresRescue: boolean;
  currentLatitude?: number;
  currentLongitude?: number;
  status: IncidentStatus;
  
  driverPaidAmount?: number;
  approvedAmount?: number;
  expenseStatus: IncidentExpenseStatus;
  
  reportedAt: string;
  resolvedAt?: string;
  evidences: IncidentEvidence[];
}

// Backend canonical create contract: POST multipart/form-data /api/v1/incidents.
// EvidenceFiles is optional, so the same endpoint handles both create variants.
export async function createIncident(
  token: string,
  formData: FormData,
  context: IncidentRequestLogContext
) {
  const endpoint = '/api/v1/incidents';
  let responseStatus: number | undefined;

  if (__DEV__) {
    console.log('[INCIDENT-V2] REQUEST', {
      endpoint,
      method: 'POST',
      hasFormData: true,
      hasEvidence: context.hasEvidence,
      locationSource: context.locationSource,
      tripId: context.tripId,
      stopId: null,
    });
  }

  try {
    const result = await apiRequest<ApiResponse<IncidentResponse>>(endpoint, {
      method: 'POST',
      body: formData,
      headers: {
        Authorization: `Bearer ${token}`,
      },
      onResponse: (response) => {
        responseStatus = response.status;
      },
    });

    if (__DEV__) {
      console.log('[INCIDENT-V2] RESPONSE', {
        status: responseStatus,
        incidentId: result.data?.incidentId ?? null,
      });
    }

    return result;
  } catch (error) {
    if (__DEV__) {
      console.log('[INCIDENT-V2] RESPONSE', {
        status: responseStatus,
        incidentId: null,
      });
    }
    throw error;
  }
}

export function getIncidentSubmitErrorMessage(error: unknown) {
  if (error instanceof ApiClientError) {
    if (error.status === 400) {
      return 'Thông tin hoặc ảnh minh chứng không hợp lệ. Vui lòng kiểm tra và thử lại.';
    }
    if (error.status === 401) {
      return 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.';
    }
    if (error.status === 403) {
      return 'Bạn không có quyền báo cáo sự cố cho chuyến này.';
    }
  }

  return 'Không thể gửi báo cáo sự cố. Vui lòng thử lại.';
}

// 2. Lấy danh sách sự cố
export async function getIncidents(token: string, tripId?: string, pageNumber = 1, pageSize = 10) {
  const params = new URLSearchParams({
    pageNumber: pageNumber.toString(),
    pageSize: pageSize.toString(),
  });
  if (tripId) params.append('tripId', tripId);
  return apiRequest<ApiResponse<PagedResult<IncidentResponse>>>(
    `/api/v1/incidents?${params.toString()}`,
    { method: 'GET', headers: { Authorization: `Bearer ${token}` } }
  );
}

// 3. Lấy chi tiết sự cố
export async function getIncidentDetail(token: string, incidentId: string) {
  return apiRequest<ApiResponse<IncidentResponse>>(
    `/api/v1/incidents/${incidentId}`,
    { method: 'GET', headers: { Authorization: `Bearer ${token}` } }
  );
}

// 4. Driver tiếp tục chuyến không cần cứu hộ
export async function continueTrip(token: string, incidentId: string, note?: string) {
  return apiRequest<ApiResponse<any>>(
    `/api/v1/incidents/${incidentId}/continue-trip`,
    { method: 'POST', body: { note }, headers: { Authorization: `Bearer ${token}` } }
  );
}

// 5. Upload biên lai phụ trợ
export async function uploadIncidentEvidence(token: string, incidentId: string, formData: FormData) {
  return apiRequest<ApiResponse<IncidentResponse>>(
    `/api/v1/incidents/${incidentId}/evidences`,
    {
      method: 'POST',
      body: formData,
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );
}
