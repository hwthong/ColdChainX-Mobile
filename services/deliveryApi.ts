import { apiRequest } from './apiClient';
import { useAuthStore } from '../store/useAuthStore';

// Common interfaces
export interface ApiResponse<T> {
  success: boolean;
  statusCode: number;
  message?: string;
  data?: T;
  errors?: unknown;
}

// ------------------------------------------------------------------
// 1. DTOs
// ------------------------------------------------------------------

export interface LpnDeliveryStatusResponse {
  lpnId: string;
  lpnCode: string;
  state: string;
  outcomeType?: string;
  receiverName?: string;
  receiverPhone?: string;
  rejectReason?: string;
  rejectNote?: string;
  evidenceImageUrl?: string;
  confirmedAt?: string;
  checkinAt?: string;
  signatureImageUrl?: string;
  codAmount: number;
  codPaymentMethod?: string;
  codReceiptImageUrl?: string;
  newSealNumber?: string;
  vietQrUrl?: string;
  isCodVerified: boolean;
  codVerifiedAt?: string;
  recordedTemperature?: number;
}

export interface TripDeliveryProgressResponse {
  tripId: string;
  totalLpns: number;
  deliveredCount: number;
  rejectedCount: number;
  pendingCount: number;
  isComplete: boolean;
  lpnStatuses: LpnDeliveryStatusResponse[];
}

export interface CheckinDriverRequest {
  latitude: number;
  longitude: number;
}

export interface LpnUnloadInfo {
  lpnId: string;
  lpnCode: string;
  itemName: string;
  quantity: number;
  unloadOrder: number;
  tempCondition: string;
}

export interface CheckinDriverResponse {
  stopId: string;
  checkinTime: string;
  removedSealCode?: string;
  lpnsToUnload: LpnUnloadInfo[];
}

export interface HandoverConfirmResponse {
  epodId: string;
  handoverConfirmedAt: string;
  orderStatus: string;
  codAmountDue: number;
  handoverPdfUrl?: string;
  nextStep?: string;
}

export interface RecordCodPaymentRequest {
  paymentMethod: string; // "CASH" | "QR"
  codAmountPaid: number;
  paymentEvidencePhotoFile?: Blob | any;
}

export interface RecordCodPaymentResponse {
  epodId: string;
  paymentStatus: string;
  paymentConfirmedAt?: string;
  epodPdfUrl?: string;
  qrCodeUrl?: string;
  checkoutUrl?: string;
  nextStep?: string;
}

export interface DepartRequest {
  newSealCode?: string;
}

export interface DepartResponse {
  stopId: string;
  departTime: string;
  newSealCode?: string;
  tripCompleted: boolean;
}

// ------------------------------------------------------------------
// 2. API Service
// ------------------------------------------------------------------

function getAuthHeaders() {
  const token = useAuthStore.getState().token;
  if (!token) throw new Error('Not authenticated');
  return { Authorization: `Bearer ${token}` };
}

export const deliveryApi = {
  getTripDeliveryProgress: async (tripId: string): Promise<TripDeliveryProgressResponse> => {
    const response = await apiRequest<ApiResponse<TripDeliveryProgressResponse>>(
      `/api/Delivery/trips/${tripId}/lpns`,
      {
        method: 'GET',
        headers: getAuthHeaders(),
      }
    );
    if (!response.success || !response.data) {
      throw new Error(response.message || 'Lỗi khi tải tiến độ giao hàng.');
    }
    return response.data;
  },

  checkInStop: async (stopId: string, payload: CheckinDriverRequest): Promise<CheckinDriverResponse> => {
    const response = await apiRequest<ApiResponse<CheckinDriverResponse>>(
      `/api/stops/${stopId}/check-ins`,
      {
        method: 'POST',
        headers: getAuthHeaders(),
        body: payload,
      }
    );
    if (!response.success || !response.data) {
      throw new Error(response.message || 'Lỗi khi check-in.');
    }
    return response.data;
  },

  confirmHandover: async (stopId: string, formData: FormData): Promise<HandoverConfirmResponse> => {
    const response = await apiRequest<ApiResponse<HandoverConfirmResponse>>(
      `/api/stops/${stopId}/handover-confirmations`,
      {
        method: 'POST',
        headers: getAuthHeaders(),
        body: formData, // fetch will automatically set boundary for multipart
      }
    );
    if (!response.success || !response.data) {
      throw new Error(response.message || 'Lỗi khi ký nhận bàn giao.');
    }
    return response.data;
  },

  recordCodPayment: async (epodId: string, formData: FormData): Promise<RecordCodPaymentResponse> => {
    const response = await apiRequest<ApiResponse<RecordCodPaymentResponse>>(
      `/api/epods/${epodId}/payments`,
      {
        method: 'POST',
        headers: getAuthHeaders(),
        body: formData,
      }
    );
    if (!response.success || !response.data) {
      throw new Error(response.message || 'Lỗi khi ghi nhận COD.');
    }
    return response.data;
  },

  departStop: async (stopId: string, payload: DepartRequest): Promise<DepartResponse> => {
    const response = await apiRequest<ApiResponse<DepartResponse>>(
      `/api/stops/${stopId}/departures`,
      {
        method: 'POST',
        headers: getAuthHeaders(),
        body: payload,
      }
    );
    if (!response.success || !response.data) {
      throw new Error(response.message || 'Lỗi khi rời điểm giao.');
    }
    return response.data;
  },
};
