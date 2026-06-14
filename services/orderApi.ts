import { apiRequest } from './apiClient';

export interface CreateOrderPayload {
  ItemName: string;
  Category: string;
  TempCondition: number;
  ExpectedWeightKg: number;
  Quantity: number;
  PackagingType: string;
  LengthCm: number;
  WidthCm: number;
  HeightCm: number;
  DestAddressText: string;
  DocumentImageUri: string;
  DocumentImageMimeType?: string;
  DocumentImageFileName?: string;
}

export interface OrderLocationResponse {
  locationId: string;
  address: string;
  latitude: number;
  longitude: number;
}

export interface OrderDocumentResponse {
  docId: string;
  docType: string;
  imageUrl: string;
  status?: string | null;
  createdAt?: string | null;
}

export interface OrderQuotationResponse {
  quoteId: string;
  baseFreight: number;
  lastMileSurcharge?: number | null;
  vasAmount?: number | null;
  vatAmount: number;
  finalAmount: number;
  fileUrl?: string | null;
  status: string;
  createdAt?: string | null;
}

export interface OrderResponse {
  orderId: string;
  trackingCode: string;
  customerId?: string | null;
  customerName?: string | null;
  itemName: string;
  category: string;
  quantity: number;
  packingType: string;
  tempCondition: string;
  expectedWeightKg: number;
  actualWeightKg: number;
  expectedCbm: number;
  actualCbm?: number | null;
  cargoValue: number;
  status: string;
  createdAt?: string | null;
  destination?: OrderLocationResponse | null;
  documents: OrderDocumentResponse[];
  quotations: OrderQuotationResponse[];
}

export interface CreateOrderResponse {
  orderId: string;
  trackingCode: string;
  destLocationId: string;
  expectedCbm: number;
  documentUrl: string;
  status: string;
}

export interface PagedResult<T> {
  items: T[];
  totalCount: number;
  pageNumber: number;
  pageSize: number;
  totalPages: number;
}

export interface ApiResponse<T> {
  success: boolean;
  message?: string | null;
  data?: T | null;
}

export function createOrder(accessToken: string, payload: CreateOrderPayload) {
  const formData = new FormData();
  formData.append('Item_Name', payload.ItemName);
  formData.append('Category', payload.Category);
  formData.append('Temp_Condition', String(payload.TempCondition));
  formData.append('Expected_Weight_KG', String(payload.ExpectedWeightKg));
  formData.append('Quantity', String(payload.Quantity));
  formData.append('Packaging_Type', payload.PackagingType);
  formData.append('Length_CM', String(payload.LengthCm));
  formData.append('Width_CM', String(payload.WidthCm));
  formData.append('Height_CM', String(payload.HeightCm));
  formData.append('Dest_Address_Text', payload.DestAddressText);

  // Append image
  // In React Native FormData, files look like this object
  const fileToUpload = {
    uri: payload.DocumentImageUri,
    type: payload.DocumentImageMimeType || 'image/jpeg',
    name: payload.DocumentImageFileName || 'document.jpg',
  } as any;
  
  formData.append('DocumentImage', fileToUpload);

  return apiRequest<ApiResponse<CreateOrderResponse>>('/api/orders', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      // Do not manually set Content-Type to multipart/form-data. 
      // fetch will do it automatically and add the boundary.
    },
    body: formData,
  });
}

export function getCustomerOrders(accessToken: string, customerId: string, page = 1, size = 10) {
  return apiRequest<ApiResponse<PagedResult<OrderResponse>>>(`/api/customers/${customerId}/orders?pageNumber=${page}&pageSize=${size}`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
}

export function getOrderById(accessToken: string, orderId: string) {
  return apiRequest<ApiResponse<OrderResponse>>(`/api/orders/${orderId}`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
}
