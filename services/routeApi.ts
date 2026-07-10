import { apiRequest } from './apiClient';
import type { ApiResponse } from './orderApi';

export interface RouteOptionResponse {
  routeId: string;
  routeCode: string;
  originCity: string;
  destCity: string;
  transitTime: string;
  cutOffTime: string;
  status: string;
}

export interface RouteOptionsQuery {
  originCity?: string;
  destCity?: string;
}

/** Một lịch khởi hành trong tuần, trả về từ GET /api/routes/{routeId}/booking-options */
export interface ScheduleOptionDto {
  scheduleId: string;
  scheduleName: string;
  /** 1 = Thứ 2, ..., 7 = CN */
  dayOfWeek: number;
  departureTime: string;
  cutOffTime: string;
}

/** Một điểm giao hàng thuộc tuyến, trả về từ GET /api/routes/{routeId}/booking-options */
export interface StopOptionDto {
  stopId: string;
  stopName: string;
}

/** Toàn bộ options cần thiết để Customer tạo đơn cho 1 tuyến */
export interface RouteBookingOptionsDto {
  routeId: string;
  availableSchedules: ScheduleOptionDto[];
  availableStops: StopOptionDto[];
}

export function getRouteOptions(query: RouteOptionsQuery = {}) {
  const params = new URLSearchParams();

  if (query.originCity?.trim()) {
    params.append('originCity', query.originCity.trim());
  }

  if (query.destCity?.trim()) {
    params.append('destCity', query.destCity.trim());
  }

  const queryString = params.toString();

  return apiRequest<ApiResponse<RouteOptionResponse[]>>(
    `/api/routes/options${queryString ? `?${queryString}` : ''}`,
    {
      method: 'GET',
    }
  );
}

/**
 * Lấy schedules và stops của 1 tuyến — dùng để hiện dropdown chọn lịch & điểm giao.
 * Customer phải chọn scheduleId + stopId từ kết quả này trước khi tạo đơn.
 */
export function getRouteBookingOptions(routeId: string) {
  return apiRequest<ApiResponse<RouteBookingOptionsDto>>(
    `/api/routes/${encodeURIComponent(routeId)}/booking-options`,
    { method: 'GET' }
  );
}
