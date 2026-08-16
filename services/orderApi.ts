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
  /** UUID của RouteSchedule — backend tự suy ra routeId từ schedule này */
  scheduleId: string;
  /** UUID của RouteStop thuộc tuyến đã chọn */
  dropoffStopId: string;
  hasStrongOdor?: boolean;
  isStackable?: boolean;
  cargoPhoto: {
    uri: string;
    mimeType?: string;
    fileName?: string;
  };
}

export interface UpdateOrderPayload {
  itemName?: string;
  category?: string;
  tempCondition?: number;
  expectedWeightKg?: number;
  quantity?: number;
  packagingType?: string;
  lengthCm?: number;
  widthCm?: number;
  heightCm?: number;
  destAddressText?: string;
  scheduleId?: string;
  dropoffStopId?: string;
  hasStrongOdor?: boolean;
  isStackable?: boolean;
  cargoPhoto?: {
    uri: string;
    mimeType?: string;
    fileName?: string;
  } | null;
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
  orderId?: string | null;
  trackingCode?: string | null;
  customerId?: string | null;
  customerName?: string | null;
  baseFreight: number;
  lastMileSurcharge?: number | null;
  vasAmount?: number | null;
  vatAmount: number;
  finalAmount: number;
  fileUrl?: string | null;
  status: string;
  createdAt?: string | null;
}

export interface OrderScheduleResponse {
  scheduleId: string;
  scheduleName: string;
  departureDate: string;
  departureTime: string;
  cutOffTime: string;
  status: string;
}

export interface OrderRouteResponse {
  routeId: string;
  routeCode: string;
  originCity: string;
  destCity: string;
  transitTime: string;
  cutOffTime: string;
}

export type QuotationResponse = OrderQuotationResponse;

export interface AcceptQuotationResponse {
  quoteId: string;
  orderId: string;
  trackingCode: string;
  fileUrl?: string | null;
  quoteStatus: string;
  orderStatus: string;
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
  lengthCm?: number | null;
  widthCm?: number | null;
  heightCm?: number | null;
  dropoffStopId?: string | null;
  cargoValue: number;
  status: string;
  masterTripId?: string | null;
  createdAt?: string | null;
  route?: OrderRouteResponse | null;
  schedule?: OrderScheduleResponse | null;
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
  routeId?: string | null;
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

  function appendFormAliases(
    form: FormData,
    legacyName: string,
    propertyName: string,
    value: string | number | boolean
  ) {
    const normalizedValue = String(value);
    form.append(legacyName, normalizedValue);
    form.append(propertyName, normalizedValue);
  }

  appendFormAliases(formData, 'Item_Name', 'ItemName', data.itemName);
  appendFormAliases(formData, 'Category', 'Category', data.category);
  appendFormAliases(formData, 'Temp_Condition', 'TempCondition', data.tempCondition);
  appendFormAliases(formData, 'Expected_Weight_KG', 'ExpectedWeightKg', data.expectedWeightKg);
  appendFormAliases(formData, 'Quantity', 'Quantity', data.quantity);
  appendFormAliases(formData, 'Packaging_Type', 'PackagingType', data.packagingType);
  appendFormAliases(formData, 'Length_CM', 'LengthCm', data.lengthCm);
  appendFormAliases(formData, 'Width_CM', 'WidthCm', data.widthCm);
  appendFormAliases(formData, 'Height_CM', 'HeightCm', data.heightCm);
  appendFormAliases(formData, 'Dest_Address_Text', 'DestAddressText', data.destAddressText);
  appendFormAliases(formData, 'Schedule_ID', 'ScheduleId', data.scheduleId);
  appendFormAliases(formData, 'Dropoff_Stop_ID', 'DropoffStopId', data.dropoffStopId);
  appendFormAliases(formData, 'Has_Strong_Odor', 'HasStrongOdor', data.hasStrongOdor ?? false);
  appendFormAliases(formData, 'Is_Stackable', 'IsStackable', data.isStackable ?? true);

  formData.append('Cargo_Photos', {
    uri: data.cargoPhoto.uri,
    name: data.cargoPhoto.fileName || 'cargo.jpg',
    type: data.cargoPhoto.mimeType || 'image/jpeg',
  } as any);

  if (__DEV__) {
    console.log('[orderApi] create order payload', {
      Schedule_ID: data.scheduleId,
      Dropoff_Stop_ID: data.dropoffStopId,
      Packaging_Type: data.packagingType,
      Quantity: data.quantity,
      HasCargoPhoto: Boolean(data.cargoPhoto.uri),
    });
  }

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

export function updateOrder(accessToken: string, orderId: string, data: UpdateOrderPayload) {
  const formData = new FormData();

  function appendFormAliases(
    form: FormData,
    legacyName: string,
    propertyName: string,
    value: string | number | boolean | undefined | null
  ) {
    if (value === undefined || value === null) return;
    const normalizedValue = String(value);
    form.append(legacyName, normalizedValue);
    form.append(propertyName, normalizedValue);
  }

  if (data.itemName !== undefined && data.itemName !== null) appendFormAliases(formData, 'Item_Name', 'ItemName', data.itemName);
  if (data.category !== undefined && data.category !== null) appendFormAliases(formData, 'Category', 'Category', data.category);
  if (data.tempCondition !== undefined && data.tempCondition !== null) appendFormAliases(formData, 'Temp_Condition', 'TempCondition', data.tempCondition);
  if (data.expectedWeightKg !== undefined && data.expectedWeightKg !== null) appendFormAliases(formData, 'Expected_Weight_KG', 'ExpectedWeightKg', data.expectedWeightKg);
  if (data.quantity !== undefined && data.quantity !== null) appendFormAliases(formData, 'Quantity', 'Quantity', data.quantity);
  if (data.packagingType !== undefined && data.packagingType !== null) appendFormAliases(formData, 'Packaging_Type', 'PackagingType', data.packagingType);
  if (data.lengthCm !== undefined && data.lengthCm !== null) appendFormAliases(formData, 'Length_CM', 'LengthCm', data.lengthCm);
  if (data.widthCm !== undefined && data.widthCm !== null) appendFormAliases(formData, 'Width_CM', 'WidthCm', data.widthCm);
  if (data.heightCm !== undefined && data.heightCm !== null) appendFormAliases(formData, 'Height_CM', 'HeightCm', data.heightCm);
  if (data.destAddressText !== undefined && data.destAddressText !== null) appendFormAliases(formData, 'Dest_Address_Text', 'DestAddressText', data.destAddressText);
  if (data.scheduleId !== undefined && data.scheduleId !== null) appendFormAliases(formData, 'Schedule_ID', 'ScheduleId', data.scheduleId);
  if (data.dropoffStopId !== undefined && data.dropoffStopId !== null) appendFormAliases(formData, 'Dropoff_Stop_ID', 'DropoffStopId', data.dropoffStopId);
  if (data.hasStrongOdor !== undefined && data.hasStrongOdor !== null) appendFormAliases(formData, 'Has_Strong_Odor', 'HasStrongOdor', data.hasStrongOdor);
  if (data.isStackable !== undefined && data.isStackable !== null) appendFormAliases(formData, 'Is_Stackable', 'IsStackable', data.isStackable);

  if (data.cargoPhoto?.uri) {
    formData.append('Cargo_Photos', {
      uri: data.cargoPhoto.uri,
      name: data.cargoPhoto.fileName || 'cargo.jpg',
      type: data.cargoPhoto.mimeType || 'image/jpeg',
    } as any);
  }

  if (__DEV__) {
    console.log('[orderApi] update order payload', {
      orderId,
      Schedule_ID: data.scheduleId,
      Dropoff_Stop_ID: data.dropoffStopId,
      Packaging_Type: data.packagingType,
      Quantity: data.quantity,
      HasCargoPhoto: Boolean(data.cargoPhoto?.uri),
    });
  }

  return apiRequest<ApiResponse<CreateOrderResponse>>(`/api/orders/${orderId}`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    body: formData,
  });
}


export function getMyCustomerOrders(accessToken: string, page = 1, size = 10) {
  return apiRequest<ApiResponse<PagedResult<OrderResponse>>>(
    `/api/customers/my/orders?pageNumber=${page}&pageSize=${size}`,
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

export function getOrderQuotations(accessToken: string, orderId: string, page = 1, size = 10) {
  return apiRequest<ApiResponse<PagedResult<QuotationResponse>>>(
    `/api/orders/${orderId}/quotations?pageNumber=${page}&pageSize=${size}`,
    {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  ).then((response): ApiResponse<QuotationResponse[]> => ({
    ...response,
    data: response.data?.data ?? response.data?.items ?? [],
  }));
}

export function getQuotationById(accessToken: string, quoteId: string) {
  return apiRequest<ApiResponse<QuotationResponse>>(`/api/quotations/${quoteId}`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
}

export function acceptQuotation(
  accessToken: string,
  quoteId: string,
  customerId: string,
  selectedServiceCatalogIds: string[] = []
) {
  return apiRequest<ApiResponse<AcceptQuotationResponse>>(`/api/quotations/${quoteId}/accept`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    body: {
      selectedServiceCatalogIds,
    },
  });
}
