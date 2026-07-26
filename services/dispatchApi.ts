import { apiRequest, buildApiUrl } from './apiClient';

export interface DispatchEnvelope<T> {
  success?: boolean;
  Success?: boolean;
  count?: number;
  Count?: number;
  data?: T;
  Data?: T;
  error?: string;
  Error?: string;
  message?: string;
  Message?: string;
}

export interface DispatchPagedResult<T> {
  totalRecords: number;
  totalPages: number;
  currentPage: number;
  pageSize: number;
  data: T[];
}

export interface PlannedDispatchTripDto {
  tripId: string;
  status: string;
  vehicle?: string | null;
  driver?: string | null;
  plannedStartTime?: string | null;
  plannedEndTime?: string | null;
  estimatedDurationHours?: number | null;
  totalLpns?: number | null;
  allocatedLpns?: number | null;
  label?: string | null;
}

export interface StartPickingResult {
  tripId: string;
  status: string;
  lpnCount: number;
}

export interface ReadyToSealTripDto {
  tripId: string;
  status: string;
  vehicle?: string | null;
  driver?: string | null;
  plannedStartTime?: string | null;
  plannedEndTime?: string | null;
  totalLpns?: number | null;
  releasedLpns?: number | null;
  label?: string | null;
}

interface ReadyToSealTripApiDto extends ReadyToSealTripDto {
  allocatedLpns?: number | null;
}

export interface SealAndDispatchResult {
  tripId: string;
  sealCode: string;
  allOrdersLoaded?: boolean;
  totalOrders?: number;
  loadedOrders?: number;
  sealedAt?: string | null;
  sealedBy?: string | null;
  tripStatus?: string | null;
  waybillUrl?: string | null;
}

interface DispatchDocumentUrlResponse {
  success?: boolean;
  Success?: boolean;
  lifoPdfUrl?: string | null;
  LifoPdfUrl?: string | null;
  waybillPdfUrl?: string | null;
  WaybillPdfUrl?: string | null;
  error?: string;
  Error?: string;
  message?: string;
  Message?: string;
}

export function getTripsCanStartPicking(accessToken: string) {
  return getAllDispatchPages<PlannedDispatchTripDto>(
    accessToken,
    '/api/Dispatch/trips/can-start-picking'
  );
}

export function startPickingTrip(accessToken: string, tripId: string) {
  return apiRequest<DispatchEnvelope<StartPickingResult>>(
    `/api/Dispatch/trip/${tripId}/start-picking`,
    {
      method: 'POST',
      headers: getAuthHeaders(accessToken),
    }
  );
}

export async function getTripsReadyToSeal(accessToken: string) {
  const trips = await getAllDispatchPages<ReadyToSealTripApiDto>(
    accessToken,
    '/api/Dispatch/trips/ready-to-seal'
  );

  return trips.map(({ allocatedLpns, ...trip }) => ({
    ...trip,
    releasedLpns: trip.releasedLpns ?? allocatedLpns,
  }));
}

export function sealAndDispatch(accessToken: string, tripId: string, sealCode: string) {
  const formData = new FormData();
  formData.append('SealCode', sealCode);

  return apiRequest<DispatchEnvelope<SealAndDispatchResult>>(
    `/api/Dispatch/seal-and-dispatch/${tripId}`,
    {
      method: 'POST',
      headers: getAuthHeaders(accessToken),
      body: formData,
    }
  );
}

export async function getTripLifoPdfUrl(accessToken: string, tripId: string) {
  const response = await apiRequest<DispatchDocumentUrlResponse>(
    `/api/Dispatch/trip/${tripId}/lifo-url`,
    {
      headers: getAuthHeaders(accessToken),
    }
  );

  if (!isSuccess(response)) {
    throw new Error(getDispatchError(response) || 'Không thể tải sơ đồ LIFO.');
  }

  return response.lifoPdfUrl ?? response.LifoPdfUrl ?? null;
}

export async function getTripWaybillPdfUrl(accessToken: string, tripId: string) {
  const response = await apiRequest<DispatchDocumentUrlResponse>(
    `/api/Dispatch/trip/${tripId}/waybill-url`,
    {
      headers: getAuthHeaders(accessToken),
    }
  );

  if (!isSuccess(response)) {
    throw new Error(getDispatchError(response) || 'Không thể tải giấy đi đường.');
  }

  return response.waybillPdfUrl ?? response.WaybillPdfUrl ?? null;
}

export function buildDispatchDocumentUrl(url: string) {
  return url.startsWith('http://') || url.startsWith('https://') ? url : buildApiUrl(url);
}

function isSuccess(response: Pick<DispatchDocumentUrlResponse, 'success' | 'Success'>) {
  return Boolean(response.success ?? response.Success);
}

function getDispatchError(response: DispatchDocumentUrlResponse) {
  return response.error ?? response.Error ?? response.message ?? response.Message ?? null;
}

const DISPATCH_PAGE_SIZE = 100;

async function getAllDispatchPages<T>(accessToken: string, path: string): Promise<T[]> {
  const firstPage = await getDispatchPage<T>(accessToken, path, 1);
  if (firstPage.totalPages <= 1) {
    return firstPage.data;
  }

  const remainingPages = await Promise.all(
    Array.from({ length: firstPage.totalPages - 1 }, (_, index) =>
      getDispatchPage<T>(accessToken, path, index + 2)
    )
  );

  return [firstPage, ...remainingPages].flatMap((page) => page.data);
}

async function getDispatchPage<T>(
  accessToken: string,
  path: string,
  pageNumber: number
): Promise<DispatchPagedResult<T>> {
  const response = await apiRequest<DispatchPagedResult<T>>(
    `${path}?pageNumber=${pageNumber}&pageSize=${DISPATCH_PAGE_SIZE}`,
    {
      headers: getAuthHeaders(accessToken),
      logResponseBody: true,
    }
  );

  if (
    !response ||
    !Array.isArray(response.data) ||
    typeof response.totalPages !== 'number' ||
    typeof response.totalRecords !== 'number'
  ) {
    throw new Error('Phản hồi danh sách chuyến không đúng định dạng PagedResult.');
  }

  return response;
}

function getAuthHeaders(accessToken: string) {
  return {
    Authorization: `Bearer ${accessToken}`,
  };
}
