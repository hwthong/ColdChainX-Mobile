import { apiRequest } from './apiClient';

export interface CreateOrderPayload {
  itemName: string;
  category: string;
  tempCondition: number;
  expectedWeightKg: number;
  quantity: number;
  packagingType: string;
  lengthCm: number;
  widthCm: number;
  heightCm: number;
  destAddressText: string;
  image: {
    uri: string;
    mimeType?: string;
    fileName?: string;
  };
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
  documentUrl?: string | null;
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
  totalRecords?: number;
  currentPage?: number;
  pageNumber: number;
  pageSize: number;
  totalPages: number;
  data?: T[];
}

export interface ApiResponse<T> {
  success: boolean;
  message?: string | null;
  data?: T | null;
}

export function createOrder(accessToken: string, data: CreateOrderPayload) {
  const formData = new FormData();
  formData.append('Item_Name', data.itemName);
  formData.append('Category', data.category);
  formData.append('Temp_Condition', String(data.tempCondition));
  formData.append('Expected_Weight_KG', String(data.expectedWeightKg));
  formData.append('Quantity', String(data.quantity));
  formData.append('Packaging_Type', data.packagingType);
  formData.append('Length_CM', String(data.lengthCm));
  formData.append('Width_CM', String(data.widthCm));
  formData.append('Height_CM', String(data.heightCm));
  formData.append('Dest_Address_Text', data.destAddressText);

  formData.append('DocumentImage', {
    uri: data.image.uri,
    name: data.image.fileName || 'cargo.jpg',
    type: data.image.mimeType || 'image/jpeg',
  } as any);

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
  return apiRequest<ApiResponse<PagedResult<OrderResponse>>>(
    `/api/customers/${customerId}/orders?pageNumber=${page}&pageSize=${size}`,
    {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  ).then((response): ApiResponse<OrderResponse[]> => {
    const pagedData = response.data;

    return {
      ...response,
      data: pagedData?.data ?? pagedData?.items ?? [],
    };
  });
}

export function getOrders(accessToken: string, page = 1, size = 10) {
  return apiRequest<ApiResponse<PagedResult<OrderResponse>>>(`/api/orders?pageNumber=${page}&pageSize=${size}`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  }).then((response): ApiResponse<OrderResponse[]> => ({
    ...response,
    data: response.data?.data ?? response.data?.items ?? [],
  }));
}

export function getOrderById(accessToken: string, orderId: string) {
  return apiRequest<ApiResponse<OrderResponse>>(`/api/orders/${orderId}`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
}
