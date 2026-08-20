import { ApiClientError, apiRequest } from './apiClient';
import { ensureValidAccessToken, useAuthStore } from '../store/useAuthStore';

// Common structures from backend
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

// ------------------------------------------
// DTOs for Driver APIs
// ------------------------------------------

// Replaces DriverTripSummaryResponse
export interface TripListDto {
  tripId: string;
  tripCode: string;
  status: string;
  vehiclePlate?: string | null;
  routeName?: string | null;
  origin: string;
  destination: string;
  plannedStartTime?: string | null;
  startedAt?: string | null;
  completedAt?: string | null;
  driverRole?: string | null;
  totalOrders: number;
  workHours?: number | null;
  distanceKm?: number | null; // For history
}

export interface TripHistoryPagedPayload {
  items?: TripListDto[];
  data?: TripListDto[];
  totalRecords?: number;
  totalPages?: number;
  pageNumber?: number;
  pageSize?: number;
}

export interface DriverTripVehicleDto {
  vehicleId: string;
  truckPlate: string;
  vehicleType: string;
  maxWeight?: number;
  maxCbm?: number;
}

export interface DriverTripStopDto {
  stopId: string;
  stopSequence: number;
  address: string;
  plannedArrivalTime?: string | null;
  plannedDepartureTime?: string | null;
  status: string;
  stopType: string;
}

export interface DriverTripDetailResponseDto {
  tripId: string;
  status: string;
  plannedStartTime?: string;
  plannedEndTime?: string;
  startedAt?: string;
  completedAt?: string;
  totalDistanceKm?: number;
  estimatedDurationHours?: number;
  targetTemperature?: number;
  encodedPolyline?: string | null;
  vehicle?: DriverTripVehicleDto;
  stopCount: number;
  stops: DriverTripStopDto[];
}

// ------------------------------------------
// API Service
// ------------------------------------------

async function authenticatedDriverRequest<T>(
  request: (token: string) => Promise<T>
): Promise<T> {
  const token = await ensureValidAccessToken();
  if (!token) throw new Error('Not authenticated');

  try {
    return await request(token);
  } catch (error) {
    if (!(error instanceof ApiClientError) || error.status !== 401) {
      throw error;
    }

    // A concurrent refresh may already have replaced the rejected token. Only
    // force another refresh when the store still contains the same token.
    const currentToken = useAuthStore.getState().token;
    const retryToken =
      currentToken && currentToken !== token
        ? await ensureValidAccessToken()
        : await ensureValidAccessToken({ forceRefresh: true });

    if (!retryToken) throw error;
    return request(retryToken);
  }
}

export const driverApi = {
  /**
   * Fetch active trips assigned to the currently authenticated driver.
   * Route: GET /api/drivers/my/trips
   */
  getMyTrips: async (status?: string): Promise<TripListDto[]> => {
    const params = new URLSearchParams();
    if (status) {
      params.append('status', status);
    }

    const endpoint = `/api/drivers/my/trips?${params.toString()}`;

    const response = await authenticatedDriverRequest((token) =>
      apiRequest<{ success: boolean; data: TripListDto[] }>(endpoint, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })
    );

    if (!response.success || !response.data) {
      throw new Error('Không thể tải danh sách chuyến. Vui lòng thử lại.');
    }

    return response.data;
  },

  /**
   * Fetch history of completed trips
   * Route: GET /api/drivers/my/trip-history
   */
  getMyTripHistory: async (pageNumber = 1, pageSize = 20): Promise<TripListDto[]> => {
    const endpoint = `/api/drivers/my/trip-history?pageNumber=${pageNumber}&pageSize=${pageSize}`;

    const response = await authenticatedDriverRequest((token) =>
      apiRequest<ApiResponse<TripHistoryPagedPayload | TripListDto[]>>(endpoint, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })
    );

    if (!response.success || !response.data) {
      throw new Error(response.message || 'Không thể tải lịch sử chuyến.');
    }

    const payload = response.data;
    if (Array.isArray(payload)) return payload;
    if (Array.isArray(payload.items)) return payload.items;
    if (Array.isArray(payload.data)) return payload.data;
    return [];
  },

  /**
   * Fetch trip details by TripId
   * Route: GET /api/drivers/my/trips/{tripId}/detail
   */
  getMyTripDetail: async (tripId: string): Promise<DriverTripDetailResponseDto> => {
    const endpoint = `/api/drivers/my/trips/${tripId}/detail`;

    const response = await authenticatedDriverRequest((token) =>
      apiRequest<{ success: boolean; data: DriverTripDetailResponseDto }>(endpoint, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })
    );

    if (!response.success || !response.data) {
      throw new Error('Không thể tải chi tiết chuyến.');
    }

    return response.data;
  },

  /**
   * Fetch E-Waybill URL for a specific trip.
   */
  getWaybillUrl: async (tripId: string): Promise<string> => {
    const response = await authenticatedDriverRequest((token) =>
      apiRequest<{ success: boolean; waybillPdfUrl?: string; error?: string }>(
        `/api/Dispatch/trip/${tripId}/waybill-url`,
        {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      )
    );

    if (!response.success || !response.waybillPdfUrl) {
      throw new Error('Không thể tải chứng từ. Vui lòng thử lại.');
    }

    return response.waybillPdfUrl;
  },
};
