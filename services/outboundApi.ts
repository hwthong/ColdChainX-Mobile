import { apiRequest } from './apiClient';

export interface AvailableLpnDto {
  lpnId: string;
  lpnCode: string;
  tripId?: string | null;
  orderId: string;
  orderCode?: string | null;
  itemName?: string | null;
  storageLocation?: string | null;
  quantity: number;
  state: string;
}

export interface AvailableTripLpnDto {
  lpnId: string;
  lpnCode: string;
  orderId: string;
  orderCode?: string | null;
  itemName?: string | null;
  quantity: number;
  state: string;
}

export interface AvailableTripDto {
  tripId: string;
  status?: string | null;
  totalLpns: number;
  loadingCompletedLpns: number;
  readyToLoad: boolean;
  lpns: AvailableTripLpnDto[];
}

export interface PickLpnPayload {
  lpnId: string;
}

export interface PickLpnResponse {
  success: boolean;
  message: string;
}

export interface CompleteTripLoadingPayload {
  tripId: string;
  loadedLpnIds?: string[];
}

export interface CompleteTripLoadingResponse {
  success: boolean;
  message: string;
  manifestPdfUrl?: string | null;
  handoverPdfUrl?: string | null;
  outboundTicketPdfUrl?: string | null;
}

export function getAvailableOutboundTrips(accessToken: string, tripId?: string | null) {
  const query = tripId ? `?tripId=${encodeURIComponent(tripId)}` : '';

  return apiRequest<AvailableTripDto[]>(`/api/Outbound/available-trips${query}`, {
    headers: getAuthHeaders(accessToken),
  });
}

export function getAvailableOutboundLpns(accessToken: string, tripId?: string | null) {
  const query = tripId ? `?tripId=${encodeURIComponent(tripId)}` : '';

  return apiRequest<AvailableLpnDto[]>(`/api/Outbound/available-lpns${query}`, {
    headers: getAuthHeaders(accessToken),
  });
}

export function pickOutboundLpn(accessToken: string, payload: PickLpnPayload) {
  return apiRequest<PickLpnResponse>('/api/Outbound/pick', {
    method: 'POST',
    headers: getAuthHeaders(accessToken),
    body: {
      lpnId: payload.lpnId,
    },
  });
}

export function completeTripLoading(accessToken: string, payload: CompleteTripLoadingPayload) {
  return apiRequest<CompleteTripLoadingResponse>('/api/Outbound/load-trip', {
    method: 'POST',
    headers: getAuthHeaders(accessToken),
    body: {
      tripId: payload.tripId,
      loadedLpnIds: payload.loadedLpnIds ?? [],
    },
  });
}

function getAuthHeaders(accessToken: string) {
  return {
    Authorization: `Bearer ${accessToken}`,
  };
}
