import { apiRequest } from './apiClient';
import { useAuthStore } from '../store/useAuthStore';
import { API_BASE_URL } from './apiClient';

export interface PagedResult<T> {
  totalRecords: number;
  totalPages: number;
  currentPage: number;
  pageSize: number;
  data: T[];
}

export interface ApiResponse<T> {
  success: boolean;
  statusCode: number;
  message?: string;
  data?: T;
  errors?: unknown;
}

export interface DriverTripVehicle {
  vehicleId: string;
  truckPlate: string;
  vehicleType: string;
}

export interface DriverTripStopSummary {
  stopSequence: number;
  address: string;
  plannedArrivalTime?: string;
}

export interface DriverTripSummaryResponse {
  tripId: string;
  status: string;
  plannedStartTime?: string;
  plannedEndTime?: string;
  totalDistanceKm?: number;
  targetTemperature?: number;
  vehicle?: DriverTripVehicle;
  stopCount: number;
  stops: DriverTripStopSummary[];
}

export const driverApi = {
  /**
   * Fetch paginated trips assigned to the currently authenticated driver.
   * Based on GET /api/drivers/me/trips
   */
  getMyTrips: async (
    status?: string
  ): Promise<DriverTripSummaryResponse[]> => {
    const token = useAuthStore.getState().token;
    if (!token) throw new Error('Not authenticated');

    const params = new URLSearchParams();
    if (status) {
      params.append('status', status);
    }

    const endpoint = `/api/drivers/me/trips?${params.toString()}`;

    const response = await apiRequest<ApiResponse<DriverTripSummaryResponse[]>>(
      endpoint,
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    if (!response.success || !response.data) {
      if (response.statusCode === 401) throw new Error('Phiên đăng nhập đã hết hạn.');
      if (response.statusCode === 403) throw new Error('Bạn không có quyền xem dữ liệu này.');
      if (response.statusCode === 404) throw new Error('Không tìm thấy hồ sơ tài xế.');
      throw new Error('Không thể tải danh sách chuyến. Vui lòng thử lại.');
    }

    return response.data;
  },

  /**
   * Fetch E-Waybill URL for a specific trip.
   */
  getWaybillUrl: async (tripId: string): Promise<string> => {
    const token = useAuthStore.getState().token;
    if (!token) throw new Error('Not authenticated');

    const response = await apiRequest<{ success: boolean; waybillPdfUrl?: string; error?: string }>(
      `/api/Dispatch/trip/${tripId}/waybill-url`,
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    if (!response.success || !response.waybillPdfUrl) {
      throw new Error('Không thể tải chứng từ. Vui lòng thử lại.');
    }

    return response.waybillPdfUrl;
  },
};
