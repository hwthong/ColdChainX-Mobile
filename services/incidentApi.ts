import { apiRequest } from './apiClient';
import { ApiResponse } from './trackingApi';
import type { PagedResult } from './pagination';

export type IncidentType = 'VEHICLE_BREAKDOWN' | 'CARGO_DAMAGE' | 'TEMPERATURE_FLUCTUATION' | 'ACCIDENT' | 'OTHER';
export type IncidentSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type IncidentStatus = 'REPORTED' | 'RESCUE_DISPATCHED' | 'TRANSLOAD_COMPLETED' | 'CONTINUED' | 'RESOLVED';
export type IncidentExpenseStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'REIMBURSED';

export interface CreateIncidentRequest {
  tripId: string;
  incidentType: IncidentType;
  severity: IncidentSeverity;
  description: string;
  requiresRescue: boolean;
  currentLatitude?: number;
  currentLongitude?: number;
  driverPaidAmount?: number;
}

export interface IncidentEvidence {
  evidenceId: string;
  fileUrl: string;
  evidenceType: 'PHOTO' | 'RECEIPT';
  uploadedAt: string;
}

export interface IncidentResponse {
  incidentId: string;
  incidentCode: string;
  tripId: string;
  reportedBy: string;
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
  
  resolutionPdfUrl?: string;
  reportedAt: string;
  resolvedAt?: string;
  evidences: IncidentEvidence[];
}

// 1. Tạo sự cố không file
export async function createIncident(token: string, payload: CreateIncidentRequest) {
  return apiRequest<ApiResponse<IncidentResponse>>(
    '/api/v1/incidents',
    { method: 'POST', body: payload, headers: { Authorization: `Bearer ${token}` } }
  );
}

// 2. Tạo sự cố có file (multipart/form-data)
export async function createIncidentWithEvidence(token: string, formData: FormData) {
  return apiRequest<ApiResponse<IncidentResponse>>(
    '/api/v1/incidents/with-evidence',
    {
      method: 'POST',
      body: formData,
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );
}

// 3. Lấy danh sách sự cố
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

// 4. Lấy chi tiết sự cố
export async function getIncidentDetail(token: string, incidentId: string) {
  return apiRequest<ApiResponse<IncidentResponse>>(
    `/api/v1/incidents/${incidentId}`,
    { method: 'GET', headers: { Authorization: `Bearer ${token}` } }
  );
}

// 5. Driver tiếp tục chuyến không cần cứu hộ
export async function continueTrip(token: string, incidentId: string, note?: string) {
  return apiRequest<ApiResponse<any>>(
    `/api/v1/incidents/${incidentId}/continue-trip`,
    { method: 'POST', body: { note }, headers: { Authorization: `Bearer ${token}` } }
  );
}

// 6. Driver xác nhận hoàn tất sang hàng
export async function confirmTransload(token: string, incidentId: string, note?: string) {
  return apiRequest<ApiResponse<any>>(
    `/api/v1/incidents/${incidentId}/confirm-transload`,
    { method: 'POST', body: { note }, headers: { Authorization: `Bearer ${token}` } }
  );
}

// 7. Upload biên lai phụ trợ
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
