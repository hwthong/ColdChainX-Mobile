import { apiRequest } from './apiClient';
import type { ApiResponse } from './trackingApi';
import { useAuthStore } from '../store/useAuthStore';
import { normalizeNearestReturnWarehouses } from './returnWarehouse';

export type { NearestReturnWarehousesResponse, ReturnWarehouse } from './returnWarehouse';

export type DeliveryUploadFile = {
  uri: string;
  name: string;
  type: string;
};

export type DriverCheckinLocation = {
  latitude: number;
  longitude: number;
  locationTimestamp: string;
  accuracyMeters?: number | null;
};

export type CheckinDriverResponse = {
  stopId: string;
  checkinTime: string;
  proofImageUrl: string;
  distanceMeters: number;
  status: 'ARRIVED' | string;
};

export type CutSealResponse = {
  sealId: string;
  tripId: string;
  sealCode: string;
  status: string;
  removedAt: string;
  aiAlertingMuted: boolean;
  aiMutedReason: string;
  mutedDurationHours: number;
};

export type ApplySealResponse = {
  sealId: string;
  tripId: string;
  sealCode: string;
  status: string;
  appliedAt: string;
  aiAlertingRestored: boolean;
  aiMutedBufferMinutes: number;
  aiMonitoringStatus: string;
  message: string;
};

export type HandoverConfirmResponse = {
  epodId: string;
  handoverConfirmedAt: string;
  orderStatus: string;
  paymentAmountDue: number;
  handoverPdfUrl?: string | null;
  nextStep?: string | null;
};

export type EpodResponse = {
  epodId: string;
  orderId?: string | null;
  status?: string | null;
  paymentAmountDue?: number | null;
  paymentAmountPaid?: number | null;
  paymentMethod?: string | null;
  paymentStatus?: string | null;
  paymentEvidenceImageUrl?: string | null;
  handoverConfirmedAt?: string | null;
  handoverPdfUrl?: string | null;
  paymentConfirmedAt?: string | null;
};

export type PaymentQrResponse = {
  epodId: string;
  orderId?: string | null;
  trackingCode?: string | null;
  paymentAmountDue: number;
  paymentStatus?: string | null;
  payosOrderCode?: number | null;
  checkoutUrl?: string | null;
  qrCodeUrl?: string | null;
};

export type VerifyQrPaymentResponse = {
  isConfirmedBySystem: boolean;
  currentPaymentStatus: string;
  paymentEvidenceUrl?: string | null;
  statusSummary?: string | null;
  nextAction?: string | null;
};

export type HandoverRequest = {
  tripId: string;
  customerId: string;
  signatureFile: DeliveryUploadFile;
  handoverPhotoFile?: DeliveryUploadFile | null;
};

export type RejectEntireLpnRequest = {
  tripId: string;
  customerId: string;
  rejectionReason: string;
  isReturnToWarehouse: boolean;
  evidenceImageFile: DeliveryUploadFile;
};

export type RejectEntireLpnResponse = {
  epodId: string;
  handoverProcessedAt: string;
  orderStatus: string;
  lpnCode: string;
  originalQuantity: number;
  rejectedQuantity: number;
  acceptedQuantity: number;
  rejectedRatio: string;
  rejectionReason: string;
  isReturnToWarehouse: boolean;
  paymentSkipped: boolean;
  inboundReturnSlip?: unknown;
};

export type DynamicCodInboundReturnSlip = {
  returnSlipId: string;
  slipCode: string;
  returnedQty: number;
  status: string;
  note?: string | null;
};

export type DynamicCodAutomatedCalculation = {
  originalCodAmount?: number | null;
  estimatedDeduction?: number | null;
  actualCodDue?: number | null;
  actualCodToCollect?: number | null;
};

export type DynamicCodEvidenceCapture = {
  evidenceImageUrl?: string | null;
  capturedAt?: string | null;
  status?: string | null;
};

export type ProcessDynamicCodRequest = {
  tripId: string;
  customerId: string;
  rejectedQuantity: number;
  rejectionReason: string;
  isReturnToWarehouse: boolean;
  evidenceImageFile: DeliveryUploadFile;
};

export type ProcessDynamicCodResponse = {
  epodId: string;
  handoverConfirmedAt?: string | null;
  orderStatus: string;
  lpnCode: string;
  originalQuantity: number;
  rejectedQuantity: number;
  acceptedQuantity: number;
  rejectedRatio: string | number;
  rejectionReason: string;
  osdNotes?: string | null;
  isReturnToWarehouse: boolean;
  inboundReturnSlip?: DynamicCodInboundReturnSlip | string | null;
  automatedCodCalculation?: DynamicCodAutomatedCalculation | null;
  step1_EvidenceCapture?: DynamicCodEvidenceCapture | null;
  actualCodDue?: number | null;
  nextStep?: string | null;
};

export type CloseShiftResponse = {
  tripId: string;
  closedAt: string;
  vehicleReleased: boolean;
  driversReleasedCount: number;
  newLocation: string;
  noShowReturnIncidentId?: string | null;
  requiresWarehouseInboundBySeal?: boolean;
  message: string;
};

type HandoverConfirmApiResponse = Omit<HandoverConfirmResponse, 'paymentAmountDue'> & {
  codAmountDue: number;
};

type EpodApiResponse = Omit<EpodResponse, 'paymentAmountDue' | 'paymentAmountPaid'> & {
  codAmount?: number | null;
  codAmountPaid?: number | null;
};

type PaymentQrApiResponse = Omit<PaymentQrResponse, 'paymentAmountDue'> & {
  codAmountDue: number;
  qrCode?: string | null;
};

function getAuthHeaders() {
  const token = useAuthStore.getState().token;
  if (!token) throw new Error('Not authenticated');
  return { Authorization: `Bearer ${token}` };
}

function appendFile(formData: FormData, field: string, file: DeliveryUploadFile) {
  formData.append(field, {
    uri: file.uri,
    name: file.name,
    type: file.type,
  } as unknown as Blob);
}

function unwrap<T>(response: ApiResponse<T>, fallbackMessage: string): T {
  if (!response.success || !response.data) {
    throw new Error(response.message || fallbackMessage);
  }

  return response.data;
}

export const deliveryApi = {
  checkInStop: async (
    stopId: string,
    proofImageFile: DeliveryUploadFile,
    location?: DriverCheckinLocation | null
  ) => {
    const formData = new FormData();
    appendFile(formData, 'ProofImageFile', proofImageFile);
    if (location) {
      formData.append('Latitude', String(location.latitude));
      formData.append('Longitude', String(location.longitude));
      formData.append('LocationTimestamp', location.locationTimestamp);
      if (location.accuracyMeters !== null && location.accuracyMeters !== undefined) {
        formData.append('AccuracyMeters', String(location.accuracyMeters));
      }
    }

    const response = await apiRequest<ApiResponse<CheckinDriverResponse>>(
      `/api/stops/${stopId}/check-ins`,
      { method: 'POST', headers: getAuthHeaders(), body: formData }
    );
    return unwrap(response, 'Không thể xác nhận đã đến điểm giao.');
  },

  cutSeal: async (tripId: string, stopId: string) => {
    const response = await apiRequest<ApiResponse<CutSealResponse>>(
      `/api/Delivery/trips/${tripId}/seals/cut`,
      { method: 'POST', headers: getAuthHeaders(), body: { stopId } }
    );
    return unwrap(response, 'Không thể cắt seal.');
  },

  applySeal: async (tripId: string, sealCode: string) => {
    const response = await apiRequest<ApiResponse<ApplySealResponse>>(
      `/api/Delivery/trips/${tripId}/seals/apply`,
      { method: 'POST', headers: getAuthHeaders(), body: { sealCode } }
    );
    return unwrap(response, 'Không thể đóng seal mới.');
  },

  confirmHandover: async (stopId: string, request: HandoverRequest) => {
    const formData = new FormData();
    formData.append('TripId', request.tripId);
    formData.append('CustomerId', request.customerId);
    appendFile(formData, 'SignatureFile', request.signatureFile);
    if (request.handoverPhotoFile) {
      appendFile(formData, 'HandoverPhotoFile', request.handoverPhotoFile);
    }

    const response = await apiRequest<ApiResponse<HandoverConfirmApiResponse>>(
      `/api/Delivery/stops/${stopId}/confirm-handover`,
      { method: 'POST', headers: getAuthHeaders(), body: formData }
    );
    const { codAmountDue, ...handover } = unwrap(response, 'Không thể xác nhận bàn giao.');
    return { ...handover, paymentAmountDue: codAmountDue };
  },

  getEpodByOrderId: async (orderId: string) => {
    const response = await apiRequest<ApiResponse<EpodApiResponse>>(
      `/api/Delivery/orders/${orderId}/epod`,
      { method: 'GET', headers: getAuthHeaders() }
    );
    const { codAmount, codAmountPaid, ...epod } = unwrap(response, 'Không thể tải ePOD.');
    return {
      ...epod,
      paymentAmountDue: codAmount,
      paymentAmountPaid: codAmountPaid,
    };
  },

  getPaymentQr: async (epodId: string) => {
    const response = await apiRequest<ApiResponse<PaymentQrApiResponse>>(
      `/api/Delivery/epods/${epodId}/payment-qr`,
      { method: 'GET', headers: getAuthHeaders() }
    );
    const { codAmountDue, ...paymentQr } = unwrap(response, 'Không thể tạo mã thanh toán.');
    return {
      ...paymentQr,
      paymentAmountDue: codAmountDue ?? 0,
      qrCodeUrl: paymentQr.qrCodeUrl ?? paymentQr.qrCode ?? null,
    };
  },

  rejectEntireLpn: async (stopId: string, request: RejectEntireLpnRequest) => {
    const formData = new FormData();
    formData.append('TripId', request.tripId);
    formData.append('CustomerId', request.customerId);
    formData.append('RejectionReason', request.rejectionReason);
    formData.append('IsReturnToWarehouse', String(request.isReturnToWarehouse));
    appendFile(formData, 'EvidenceImageFile', request.evidenceImageFile);

    const response = await apiRequest<ApiResponse<RejectEntireLpnResponse>>(
      `/api/Delivery/stops/${stopId}/reject-entire-lpn`,
      { method: 'POST', headers: getAuthHeaders(), body: formData }
    );
    return unwrap(response, 'Không thể ghi nhận từ chối kiện hàng.');
  },

  processDynamicCod: async (stopId: string, request: ProcessDynamicCodRequest) => {
    const formData = new FormData();
    formData.append('TripId', request.tripId);
    formData.append('CustomerId', request.customerId);
    formData.append('RejectedQuantity', String(request.rejectedQuantity));
    formData.append('RejectionReason', request.rejectionReason);
    formData.append('IsReturnToWarehouse', String(request.isReturnToWarehouse));
    appendFile(formData, 'EvidenceImageFile', request.evidenceImageFile);

    const response = await apiRequest<ApiResponse<ProcessDynamicCodResponse>>(
      `/api/Delivery/stops/${stopId}/dynamic-cod`,
      { method: 'POST', headers: getAuthHeaders(), body: formData }
    );
    return unwrap(response, 'Không thể xác nhận bàn giao một phần.');
  },

  reportNoShow: async (stopId: string, evidenceImageFile: DeliveryUploadFile) => {
    const formData = new FormData();
    appendFile(formData, 'EvidenceImageFile', evidenceImageFile);

    const response = await apiRequest<ApiResponse<string>>(
      `/api/Delivery/${stopId}/report-no-show`,
      { method: 'POST', headers: getAuthHeaders(), body: formData }
    );
    return unwrap(response, 'Không thể báo khách hàng không có mặt.');
  },

  getNearestReturnWarehouses: async (tripId: string) => {
    const response = await apiRequest<ApiResponse<unknown>>(
      `/api/Delivery/nearest-return-warehouses?tripId=${encodeURIComponent(tripId)}`,
      { method: 'GET', headers: getAuthHeaders() }
    );
    return normalizeNearestReturnWarehouses(
      unwrap(response, 'Không thể tải danh sách kho trả hàng.')
    );
  },

  closeShift: async (tripId: string, warehouseId: string) => {
    const response = await apiRequest<ApiResponse<CloseShiftResponse>>(
      '/api/Delivery/depart',
      {
        method: 'POST',
        headers: getAuthHeaders(),
        body: { tripId, warehouseId },
      }
    );
    return unwrap(response, 'Không thể đóng ca.');
  },

  verifyQrPayment: async (epodId: string, paymentEvidenceFile?: DeliveryUploadFile | null) => {
    const formData = new FormData();
    if (paymentEvidenceFile) {
      appendFile(formData, 'PaymentEvidenceFile', paymentEvidenceFile);
    } else {
      formData.append('CheckOnly', 'true');
    }

    const response = await apiRequest<ApiResponse<VerifyQrPaymentResponse>>(
      `/api/epods/${epodId}/verify-qr-payment`,
      { method: 'POST', headers: getAuthHeaders(), body: formData }
    );
    return unwrap(response, 'Không thể xác minh thanh toán.');
  },
};
