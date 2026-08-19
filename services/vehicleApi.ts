import { apiRequest } from './apiClient';

export interface VehicleDetailResponse {
  vehicleId: string;
  truckPlate: string;
  brand?: string | null;
  vehicleType?: string | null;
  model?: string | null;
  manufactureYear?: number | null;
  maxWeight?: number | null;
  maxCbm?: number | null;
  minTemp?: number | null;
  maxTemp?: number | null;
  status?: string | null;
  isAvailable?: boolean;
}

export interface ApiResponse<T> {
  success: boolean;
  message?: string | null;
  data?: T | null;
}

/**
 * Fetch vehicle details by vehicle UUID
 * Route: GET /api/vehicles/{vehicleId}
 */
export async function getVehicleDetail(
  token: string,
  vehicleId: string
): Promise<ApiResponse<VehicleDetailResponse>> {
  try {
    return await apiRequest<ApiResponse<VehicleDetailResponse>>(
      `/api/vehicles/${encodeURIComponent(vehicleId)}`,
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Không thể tải thông tin xe.',
      data: null,
    };
  }
}
