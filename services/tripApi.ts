import { apiRequest } from './apiClient';
import { useAuthStore } from '../store/useAuthStore';

// Common interfaces
export interface ApiResponse<T> {
  success?: boolean;
  Success?: boolean;
  message?: string;
  Message?: string;
  error?: string;
  Error?: string;
  data?: T;
  Data?: T;
}

export interface TripRoutePointDto {
  locationId: string;
  address: string;
  lat: number;
  lon: number;
}

export interface LpnSummary {
  lpnId: string;
  lpnCode: string;
  quantity: number;
}

export interface TripRouteOrderDto {
  orderId: string;
  trackingCode: string;
  itemName: string;
  category: string;
}

export interface OptimizedTripStopDto {
  stopId: string;
  locationId: string;
  originalStopSequence: number;
  optimizedSequence: number;
  stopType: string;
  address: string;
  lat: number;
  lon: number;
  orders: TripRouteOrderDto[];
  lpns: LpnSummary[];
}

export interface TripRouteResponse {
  tripId: string;
  overviewPolyline?: string;
  totalDistanceMeters: number;
  totalDurationSeconds: number;
  origin: TripRoutePointDto;
  destination: TripRoutePointDto;
  waypointOrder: number[];
  optimizedStops: OptimizedTripStopDto[];
}

function getAuthHeaders() {
  const token = useAuthStore.getState().token;
  if (!token) throw new Error('Not authenticated');
  return { Authorization: `Bearer ${token}` };
}

export const tripApi = {
  getTripRoute: async (tripId: string): Promise<TripRouteResponse> => {
    const response = await apiRequest<ApiResponse<TripRouteResponse>>(
      `/api/Dispatch/trip/${tripId}/route`,
      {
        method: 'GET',
        headers: getAuthHeaders(),
      }
    );
    
    const isSuccess = response.success ?? response.Success;
    const data = response.data ?? response.Data;
    const errorMessage = response.error ?? response.Error ?? response.message ?? response.Message ?? 'Lỗi khi tải chi tiết tuyến đường.';

    if (!isSuccess || !data) {
      throw new Error(errorMessage);
    }
    
    return data;
  },
};
