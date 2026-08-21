import { apiRequest, buildApiUrl } from './apiClient';
import type { PagedResult } from './pagination';
import type { ApiResponse } from './trackingApi';

export type EvidenceImage = {
  uri: string;
  fileName?: string | null;
  mimeType?: string | null;
  type?: string | null;
  fileSize?: number | null;
};

export interface InboundQcPackageLineItem {
  label?: string;
  quantity: number;
  actualWeightKg: number;
  lengthCm: number;
  widthCm: number;
  heightCm: number;
}

export interface InboundExpectedPackageLineItem {
  orderPackageLineId: string;
  label: string;
  capacityKg: number;
  quantity: number;
}

export interface InboundOrderQcReference {
  orderId: string;
  itemName: string;
  quantity: number;
  expectedWeightKg: number;
  expectedCbm: number;
  packageLines: InboundExpectedPackageLineItem[];
}

export interface ProcessInboundQcPayload {
  asnId: string;
  packageLines: InboundQcPackageLineItem[];
  temperature?: number | null;
  evidenceImages?: EvidenceImage[];
}

export interface ReEvaluateInboundQcPayload {
  lpnId: string;
  packageLines: InboundQcPackageLineItem[];
  temperature?: number | null;
  evidenceImages?: EvidenceImage[];
}

export interface InboundQcResponse {
  success: boolean;
  message: string;
  lpnId?: string | null;
  lpnCode?: string | null;
  state?: string | null;
  receiptId?: string | null;
  diffPercent: number;
  pdfUrl?: string | null;
  actualQuantity?: number;
  actualWeightKg?: number;
  actualCbm?: number;
  quoteId?: string | null;
}

export interface GenerateInboundReceiptPayload {
  asnId: string;
  delivererName: string;
  vehiclePlate?: string | null;
  note?: string | null;
}

export interface GenerateInboundReceiptResponse {
  success: boolean;
  message: string;
  receiptId?: string | null;
  pdfUrl?: string | null;
}

export interface PutawayPayload {
  lpnId: string;
  warehouseId: string;
  storageLocation: string;
}

export interface PutawayResponse {
  success: boolean;
  message: string;
}

export interface InboundReceiptDto {
  receiptId: string;
  receiptCode: string;
  orderId: string;
  status?: string | null;
  arrivalTime?: string | null;
  completionTime?: string | null;
  driverName: string;
  truckPlate: string;
}

export interface InboundReceiptDetailDto extends InboundReceiptDto {
  items: InboundReceiptItemDto[];
}

export interface InboundReceiptItemDto {
  receiptItemId: string;
  itemName: string;
  expectedQuantity: number;
  actualQuantity: number;
  conditionStatus: string;
}

export interface PendingReturnSlip {
  slipCode: string;
  returnSlipId: string;
  reason?: string | null;
  lpnCode: string;
  label: string;
  returnedQty?: number | null;
  status?: string | null;
  orderStatus?: string | null;
  lpnState?: string | null;
}

export interface ProcessReverseInboundPayload {
  warehouseId: string;
  lpnCodes: string[];
  driverId?: string | null;
  vehicleId?: string | null;
}

export interface ProcessReverseInboundResponse {
  receiptId: string;
  receiptCode: string;
  orderId: string;
  warehouseId: string;
  receiptType: string;
  createdAt: string;
  lpnCodes: string[];
  returnLines: ProcessReverseInboundReturnLine[];
}

export interface ProcessReverseInboundReturnLine {
  lpnCode: string;
  returnedQuantity: number;
  isPartialReturn: boolean;
  lpnStateAfterReverse: string;
  acceptedLpnQuantityPreserved?: number | null;
}

export interface ProcessInboundDispositionPayload {
  lpnCode: string;
  returnWarehouseId: string;
}

export interface ProcessInboundDispositionResponse {
  slipCode: string;
  lpnCode: string;
  previousReason?: string | null;
  newLpnState: string;
  dispositionAction: string;
  claimCode?: string | null;
  message: string;
}

export function submitInboundQc(accessToken: string, payload: ProcessInboundQcPayload) {
  const formData = new FormData();
  formData.append('Asn_ID', payload.asnId);
  formData.append('Actual_Package_Lines', JSON.stringify(payload.packageLines));
  if (payload.temperature !== undefined && payload.temperature !== null && Number.isFinite(payload.temperature)) {
    formData.append('Temperature', String(payload.temperature));
  }
  appendEvidenceImages(formData, 'Evidence_Images', payload.evidenceImages);

  return apiRequest<InboundQcResponse>('/api/Inbound/qc', {
    method: 'POST',
    headers: getAuthHeaders(accessToken),
    body: formData,
  });
}

export function reEvaluateInboundQc(accessToken: string, payload: ReEvaluateInboundQcPayload) {
  const formData = new FormData();
  formData.append('LpnId', payload.lpnId);
  formData.append('Actual_Package_Lines', JSON.stringify(payload.packageLines));
  if (payload.temperature !== undefined && payload.temperature !== null && Number.isFinite(payload.temperature)) {
    formData.append('Temperature', String(payload.temperature));
  }
  appendEvidenceImages(formData, 'EvidenceImages', payload.evidenceImages);

  return apiRequest<InboundQcResponse>('/api/Inbound/qc/re-evaluate', {
    method: 'PUT',
    headers: getAuthHeaders(accessToken),
    body: formData,
  });
}

export async function getInboundOrderQcReference(accessToken: string, orderId: string) {
  const response = await apiRequest<ApiResponse<InboundOrderQcReference>>(`/api/orders/${orderId}`, {
    headers: getAuthHeaders(accessToken),
  });
  return unwrapApiResponse(response, 'Không thể tải quy cách dự kiến của đơn hàng.');
}

export function generateInboundReceipt(accessToken: string, payload: GenerateInboundReceiptPayload) {
  return apiRequest<GenerateInboundReceiptResponse>('/api/Inbound/receipts/generate', {
    method: 'POST',
    headers: getAuthHeaders(accessToken),
    body: {
      AsnId: payload.asnId,
      DelivererName: payload.delivererName,
      VehiclePlate: payload.vehiclePlate,
      Note: payload.note,
    },
  });
}

export function putaway(accessToken: string, payload: PutawayPayload) {
  return apiRequest<PutawayResponse>('/api/Inbound/putaway', {
    method: 'POST',
    headers: getAuthHeaders(accessToken),
    body: {
      lpnId: payload.lpnId,
      warehouseId: payload.warehouseId,
      storageLocation: payload.storageLocation,
    },
  });
}

export function getInboundReceipts(accessToken?: string | null, pageNumber = 1, pageSize = 10) {
  return apiRequest<PagedResult<InboundReceiptDto>>(
    `/api/Inbound/receipts?pageNumber=${pageNumber}&pageSize=${pageSize}`,
    {
      headers: accessToken ? getAuthHeaders(accessToken) : undefined,
    }
  );
}

export function getInboundReceiptById(accessToken: string | null, id: string) {
  return apiRequest<InboundReceiptDetailDto>(`/api/Inbound/receipts/${id}`, {
    headers: accessToken ? getAuthHeaders(accessToken) : undefined,
  });
}

export function getInboundReceiptPdf(id: string) {
  return buildApiUrl(`/api/Inbound/receipts/${id}/pdf`);
}

export async function getPendingReturnSlips(accessToken: string) {
  const response = await apiRequest<ApiResponse<PendingReturnSlip[]>>(
    '/api/Inbound/lookup/return-slips',
    { method: 'GET', headers: getAuthHeaders(accessToken) }
  );
  return unwrapApiResponse(response, 'Không thể tải danh sách hàng trả về.');
}

export async function processReverseInbound(
  accessToken: string,
  payload: ProcessReverseInboundPayload
) {
  const body: Record<string, unknown> = {
    warehouseId: payload.warehouseId,
    lpnCodes: payload.lpnCodes,
  };
  if (payload.driverId) body.driverId = payload.driverId;
  if (payload.vehicleId) body.vehicleId = payload.vehicleId;

  const response = await apiRequest<ApiResponse<ProcessReverseInboundResponse>>(
    '/api/Inbound/reverse',
    { method: 'POST', headers: getAuthHeaders(accessToken), body }
  );
  return unwrapApiResponse(response, 'Không thể tiếp nhận hàng trả về.');
}

export async function processInboundDisposition(
  accessToken: string,
  payload: ProcessInboundDispositionPayload
) {
  const formData = new FormData();
  formData.append('LpnCode', payload.lpnCode);
  formData.append('ReturnWarehouseId', payload.returnWarehouseId);

  const response = await apiRequest<ApiResponse<ProcessInboundDispositionResponse>>(
    '/api/Inbound/disposition',
    { method: 'POST', headers: getAuthHeaders(accessToken), body: formData }
  );
  return unwrapApiResponse(response, 'Không thể phân loại hàng trả về.');
}

/**
 * Tải file PDF Phiếu nhập kho với Bearer token và chuyển sang base64 data URL.
 */
export async function downloadInboundReceiptPdf(accessToken: string, receiptId: string): Promise<string> {
  const url = buildApiUrl(`/api/Inbound/receipts/${encodeURIComponent(receiptId)}/pdf`);
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/pdf, application/json',
    },
  });

  if (!response.ok) {
    let errorMessage = 'Không thể tải Phiếu nhập kho.';
    try {
      const errorJson = (await response.json()) as { message?: string; Message?: string };
      errorMessage = errorJson.message ?? errorJson.Message ?? errorMessage;
    } catch {
      if (response.status === 401) {
        errorMessage = 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.';
      } else if (response.status === 403) {
        errorMessage = 'Bạn không có quyền xem phiếu nhập kho này.';
      } else if (response.status === 404) {
        errorMessage = 'Không tìm thấy phiếu nhập kho.';
      }
    }
    throw new Error(errorMessage);
  }

  const blob = await response.blob();
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result;
      if (typeof result === 'string') {
        resolve(result);
      } else {
        reject(new Error('Không thể đọc dữ liệu file PDF.'));
      }
    };
    reader.onerror = () => reject(new Error('Lỗi chuyển đổi dữ liệu file PDF.'));
    reader.readAsDataURL(blob);
  });
}

function appendEvidenceImages(
  formData: FormData,
  fieldName: 'Evidence_Images' | 'EvidenceImages',
  images?: EvidenceImage[]
) {
  images?.forEach((image, index) => {
    const filePart = {
      uri: image.uri,
      name: image.fileName || `evidence-${index + 1}.jpg`,
      type: image.mimeType || image.type || 'image/jpeg',
    };
    formData.append(fieldName, filePart as unknown as Blob);
  });
}

function getAuthHeaders(accessToken: string) {
  return {
    Authorization: `Bearer ${accessToken}`,
  };
}

function unwrapApiResponse<T>(response: ApiResponse<T>, fallbackMessage: string): T {
  if (!response.success || response.data === undefined || response.data === null) {
    throw new Error(response.message || fallbackMessage);
  }
  return response.data;
}
