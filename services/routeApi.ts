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
