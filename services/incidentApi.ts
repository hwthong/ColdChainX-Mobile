import { ApiClientError, apiRequest } from './apiClient';
import { ApiResponse } from './trackingApi';
import type { PagedResult } from './pagination';

export type IncidentType =
  | 'ACCIDENT'
  | 'VEHICLE_BREAKDOWN'
  | 'REEFER_BREAKDOWN'
  | 'TEMP_EXCURSION'
  | 'DAMAGE_CARGO'
  | 'DELAY';

export type IncidentSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export type IncidentStatus =
  | 'REPORTED'
  | 'CONTAINMENT_REQUIRED'
  | 'TRIAGED'           // LOW path: sự cố nhẹ, chờ Driver xác nhận tự xử lý
  | 'MONITORING'        // WARNING path: theo dõi nhiệt độ, chờ Dispatcher quyết định
  | 'RESCUE_PLANNING'
  | 'EXTERNAL_REEFER_IN_TRANSIT'
  | 'READY_FOR_REDISPATCH'
  | 'REDISPATCH_PLANNED'
  | 'REDISPATCHED_TO_CUSTOMER'
  | 'RESOLVED'
  | 'RESCUE_DISPATCHED'
  | 'TRANSLOAD_COMPLETED'
  | 'CONTINUED';

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

export interface ExternalReeferPlanRecord {
  rentalProvider: string;
  vehiclePlate: string;
  driverName: string;
  driverPhone?: string | null;
  destinationWarehouseId: string;
  destinationWarehouseName?: string | null;
  destinationWarehouseAddress?: string | null;
  routeDestinationCity?: string | null;
  agreedTemperature: number;
  originalTripId?: string;
  dispatchedAt?: string;
  expectedWarehouseArrivalAt?: string | null;
  arrivedAt?: string | null;
  sealNumber: string;
  lpnIds?: string[];
  dispatchEvidenceUrls?: string[];
  inboundReceiptIds?: string[];
  recordedBy?: string;
  arrivalConfirmedBy?: string | null;
  redispatchTripId?: string | null;
  redispatchPlannedAt?: string | null;
  dispatchNote?: string | null;
  arrivalNote?: string | null;
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
  riskLevel?: string;
  description: string;
  requiresRescue: boolean;
  currentLatitude?: number;
  currentLongitude?: number;
  status: IncidentStatus;
  
  driverPaidAmount?: number;
  approvedAmount?: number;
  reimbursedAmount?: number;
  expenseStatus: IncidentExpenseStatus;

  temperatureSource?: string;
  latestTemperature?: number;
  temperatureMeasuredAt?: string;
  containmentConfirmedAt?: string;
  remainingSafeTimeMinutes?: number;
  safeTimeCalculation?: string;
  directDeliveryLocked?: boolean;
  temperatureThresholdBreached?: boolean;
  
  rescuePlanType?: string;
  rescuePlanDetails?: string;
  externalReeferPlan?: ExternalReeferPlanRecord | null;
  redispatchPlan?: string | null;

  reportedAt: string;
  handledAt?: string | null;
  handlingNote?: string | null;
  resolvedAt?: string | null;
  resolutionNote?: string | null;
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

export interface ConfirmTransloadRequest {
  confirmationNote: string;
}

export interface IncidentWorkflowResult {
  incidentId: string;
  incidentStatus: string;
  tripId: string;
  tripStatus: string;
  vehicleId: string;
  vehiclePlate: string;
  confirmedAt: string;
  message: string;
}

// 3. Lấy chi tiết sự cố
export async function getIncidentDetail(token: string, incidentId: string) {
  return apiRequest<ApiResponse<IncidentResponse>>(
    `/api/v1/incidents/${incidentId}`,
    { method: 'GET', headers: { Authorization: `Bearer ${token}` } }
  );
}

// 4. Driver tiếp tục chuyến không cần cứu hộ
export async function continueTrip(
  token: string,
  incidentId: string,
  handlingNote?: string,
  expectedDelayMinutes = 0
) {
  return apiRequest<ApiResponse<any>>(
    `/api/v1/incidents/${incidentId}/continue-trip`,
    {
      method: 'POST',
      body: {
        handlingNote: handlingNote?.trim() || 'Đã tự xử lý tại chỗ, tiếp tục hành trình.',
        expectedDelayMinutes,
      },
      headers: { Authorization: `Bearer ${token}` },
    }
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

// 6. Driver xác nhận đã sang hàng cứu hộ
export async function confirmTransload(
  token: string,
  incidentId: string,
  confirmationNote: string
): Promise<ApiResponse<IncidentWorkflowResult>> {
  const payload: ConfirmTransloadRequest = {
    confirmationNote: confirmationNote.trim(),
  };

  return apiRequest<ApiResponse<IncidentWorkflowResult>>(
    `/api/v1/incidents/${encodeURIComponent(incidentId)}/confirm-transload`,
    {
      method: 'POST',
      body: payload,
      headers: { Authorization: `Bearer ${token}` },
    }
  );
}

// 7. Đánh giá rủi ro / Xác nhận containment
export interface AssessIncidentRiskRequest {
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  temperatureSource?: 'NONE' | 'IOT_SENSOR' | 'MANUAL_THERMOMETER';
  measuredTemperature?: number;
  measuredAt?: string;
  temperatureStable: boolean;
  canSafelyRepairOnSite?: boolean;
  containmentConfirmed: boolean;
  note?: string;
}

export interface IncidentRiskAssessmentResponse {
  incidentId: string;
  requestedRiskLevel: string;
  effectiveRiskLevel: string;
  incidentStatus: string;
  escalatedToCritical: boolean;
  decisionReason: string;
  targetTemperature: number;
  temperatureTolerance: number;
  latestTemperature?: number;
  temperatureMeasuredAt?: string;
  temperatureSource: string;
  hasTrustedTemperatureSource: boolean;
  temperatureThresholdBreached: boolean;
  directDeliveryLocked: boolean;
  requiresRescue: boolean;
  remainingSafeTimeMinutes?: number;
  safeTimeCalculation: string;
}

export async function assessIncidentRisk(
  token: string,
  incidentId: string,
  payload: AssessIncidentRiskRequest
): Promise<ApiResponse<IncidentRiskAssessmentResponse>> {
  return apiRequest<ApiResponse<IncidentRiskAssessmentResponse>>(
    `/api/v1/incidents/${encodeURIComponent(incidentId)}/assess-risk`,
    {
      method: 'POST',
      body: payload,
      headers: { Authorization: `Bearer ${token}` },
    }
  );
}

// 8. Lấy phương án cứu hộ (Rescue Options)
export interface RescueCandidateResponse {
  vehicleId: string;
  truckPlate: string;
  vehicleType: string;
  warehouseId?: string;
  warehouseName?: string;
  warehouseAddress?: string;
  distanceKm?: number;
  maxWeight: number;
  maxCbm: number;
  minTemp: number;
  maxTemp: number;
  iotDeviceCount: number;
  onlineIotDeviceCount: number;
  hasOnlineIot: boolean;
  estimatedArrivalMinutes?: number;
  canArriveWithinSafeTime?: boolean;
  remainingSafeTimeMinutes?: number;
  remainingWeightCapacity: number;
  remainingCbmCapacity: number;
  transferCount: number;
  recommended: boolean;
  recommendationReason: string;
  label: string;
}

export interface InternalColdStorageOption {
  warehouseId: string;
  warehouseName: string;
  address?: string;
  distanceKm?: number;
  estimatedArrivalMinutes?: number;
  canArriveWithinSafeTime?: boolean;
  minTemperature?: number;
  maxTemperature?: number;
  availablePalletPositions: number;
  isNearby: boolean;
  isRouteDestinationWarehouse: boolean;
}

export interface IncidentRescuePlanResponse {
  incidentId: string;
  tripId: string;
  targetTemperature: number;
  remainingSafeTimeMinutes?: number;
  temperatureThresholdBreached: boolean;
  directDeliveryLocked: boolean;
  recommendedAction: string;
  recommendationReason: string;
  vehicles: RescueCandidateResponse[];
  internalColdStorages: InternalColdStorageOption[];
  routeDestinationWarehouse?: InternalColdStorageOption | null;
  requiresExternalVehicleRental: boolean;
  requiresManualEscalation: boolean;
}

export async function getRescueOptions(
  token: string,
  incidentId: string
): Promise<ApiResponse<IncidentRescuePlanResponse>> {
  return apiRequest<ApiResponse<IncidentRescuePlanResponse>>(
    `/api/v1/incidents/${encodeURIComponent(incidentId)}/rescue-options`,
    {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` },
    }
  );
}

// 9. Dispatcher thuê xe lạnh ngoài
export interface DispatchExternalReeferRequest {
  rentalProvider: string;
  vehiclePlate: string;
  driverName: string;
  driverPhone?: string;
  destinationWarehouseId: string;
  agreedTemperature: number;
  expectedWarehouseArrivalAt?: string;
  sealNumber: string;
  lpnIds?: string[];
  evidenceUrls?: string[];
  note: string;
}

export interface ExternalReeferWorkflowResult {
  incidentId: string;
  tripId: string;
  incidentStatus: string;
  tripStatus: string;
  destinationWarehouseId: string;
  destinationWarehouseName: string;
  externalVehiclePlate: string;
  lpnCount: number;
  message: string;
}

export async function dispatchExternalReefer(
  token: string,
  incidentId: string,
  payload: DispatchExternalReeferRequest
): Promise<ApiResponse<ExternalReeferWorkflowResult>> {
  return apiRequest<ApiResponse<ExternalReeferWorkflowResult>>(
    `/api/v1/incidents/${encodeURIComponent(incidentId)}/external-reefer-dispatch`,
    {
      method: 'POST',
      body: {
        ...payload,
        lpnIds: payload.lpnIds ?? [],
        evidenceUrls: payload.evidenceUrls ?? [],
      },
      headers: { Authorization: `Bearer ${token}` },
    }
  );
}

// 10. Warehouse Worker Inbound sự cố bằng Seal
export interface InboundRouteWarehouseRequest {
  sealNumber: string;
}

export interface InboundRouteWarehouseResponse {
  incidentId: string;
  receiptId?: string;
  receiptCode?: string;
  lpnCount?: number;
  warehouseId?: string;
  warehouseName?: string;
  message?: string;
}

export async function inboundRouteWarehouse(
  token: string,
  incidentId: string,
  sealNumber: string
): Promise<ApiResponse<InboundRouteWarehouseResponse>> {
  return apiRequest<ApiResponse<InboundRouteWarehouseResponse>>(
    `/api/v1/incidents/${encodeURIComponent(incidentId)}/inbound-route-warehouse`,
    {
      method: 'POST',
      body: { sealNumber: sealNumber.trim() },
      headers: { Authorization: `Bearer ${token}` },
    }
  );
}

// 11. Đóng sự cố (Resolve)
export async function resolveIncident(
  token: string,
  incidentId: string,
  note: string
): Promise<ApiResponse<any>> {
  return apiRequest<ApiResponse<any>>(
    `/api/v1/incidents/${encodeURIComponent(incidentId)}/resolve`,
    {
      method: 'POST',
      body: { resolutionNote: note.trim() },
      headers: { Authorization: `Bearer ${token}` },
    }
  );
}
