import { apiRequest, buildApiUrl } from './apiClient';

export type LpnState =
  | 'EXPECTED'
  | 'RECEIVING'
  | 'DISCREPANCY_HOLD'
  | 'RETURN_PENDING'
  | 'IN_STOCK'
  | 'ALLOCATED'
  | 'PICKED'
  | 'SHIPPED';

export interface LpnDto {
  lpnId: string;
  lpnCode: string;
  itemName: string;
  batchNumber?: string | null;
  receiptId?: string | null;
  hasWarehouseReceipt?: boolean | null;
  warehouseReceiptPdfUrl?: string | null;
  warehouseId?: string | null;
  storageLocation?: string | null;
  quantity: number;
  expectedWeightKg: number;
  actualWeightKg: number;
  state: string;
  condition?: string | null;
  inboundTime?: string | null;
  slaDeadline?: string | null;
}

export interface LpnDocumentDto {
  documentType: string;
  documentName: string;
  url: string;
}

export interface LpnDocumentsResponse {
  success: boolean;
  message?: string | null;
  data?: LpnDocumentDto[] | null;
}

type LpnListParams = {
  status?: LpnState | '';
  keyword?: string;
};

export function getInventoryLpns(accessToken: string | null, params: LpnListParams = {}) {
  const query = new URLSearchParams();
  if (params.status) query.set('status', params.status);
  if (params.keyword) query.set('keyword', params.keyword);
  const suffix = query.toString() ? `?${query.toString()}` : '';

  return apiRequest<LpnDto[]>(`/api/Inventory/lpns${suffix}`, {
    headers: accessToken ? getAuthHeaders(accessToken) : undefined,
  });
}

export function getInventoryLpnById(accessToken: string | null, id: string) {
  return apiRequest<LpnDto>(`/api/Inventory/lpns/${id}`, {
    headers: accessToken ? getAuthHeaders(accessToken) : undefined,
  });
}

export function getLpnDocuments(accessToken: string | null, id: string) {
  return apiRequest<LpnDocumentsResponse>(`/api/Inventory/lpns/${id}/documents`, {
    headers: accessToken ? getAuthHeaders(accessToken) : undefined,
  });
}

export function buildInventoryDocumentUrl(url: string) {
  return url.startsWith('http://') || url.startsWith('https://') ? url : buildApiUrl(url);
}

export function hasGeneratedWarehouseReceipt(lpn?: Pick<LpnDto, 'hasWarehouseReceipt' | 'warehouseReceiptPdfUrl'> | null) {
  return Boolean(lpn?.hasWarehouseReceipt || lpn?.warehouseReceiptPdfUrl?.trim());
}

function getAuthHeaders(accessToken: string) {
  return {
    Authorization: `Bearer ${accessToken}`,
  };
}
