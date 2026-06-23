import { apiRequest } from './apiClient';

export interface ApiResponse<T> {
  success: boolean;
  message?: string | null;
  data?: T | null;
}

export interface PagedResult<T> {
  totalRecords: number;
  totalPages: number;
  currentPage: number;
  pageSize: number;
  data: T[];
}

export interface WarehouseResponse {
  warehouseId: string;
  warehouseCode: string;
  warehouseName: string;
  warehouseType: string;
  address?: string | null;
  maxPallets: number;
  currentPallets?: number | null;
  defaultMinTemp?: number | null;
  defaultMaxTemp?: number | null;
  status: string;
  createdAt?: string | null;
  createdBy?: string | null;
  updatedAt?: string | null;
  updatedBy?: string | null;
}

type GetWarehousesParams = {
  pageNumber?: number;
  pageSize?: number;
  search?: string | null;
};

export function getWarehouses(accessToken: string, params: GetWarehousesParams = {}) {
  const query = new URLSearchParams();
  query.set('pageNumber', String(params.pageNumber ?? 1));
  query.set('pageSize', String(params.pageSize ?? 20));

  if (params.search?.trim()) {
    query.set('search', params.search.trim());
  }

  return apiRequest<ApiResponse<PagedResult<WarehouseResponse>>>(`/api/v1/warehouses?${query.toString()}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
}

export async function searchWarehousesByOrigin(accessToken: string, originCity: string) {
  const terms = getOriginSearchTerms(originCity);
  const byId = new Map<string, WarehouseResponse>();
  let lastMessage: string | null | undefined = null;

  for (const term of terms) {
    const response = await getWarehouses(accessToken, {
      pageNumber: 1,
      pageSize: 50,
      search: term,
    });

    lastMessage = response.message;

    if (response.success) {
      for (const warehouse of response.data?.data ?? []) {
        byId.set(warehouse.warehouseId, warehouse);
      }
    }
  }

  const warehouses = Array.from(byId.values());

  return {
    success: true,
    message: lastMessage || 'Warehouses retrieved successfully.',
    data: {
      totalRecords: warehouses.length,
      totalPages: 1,
      currentPage: 1,
      pageSize: warehouses.length,
      data: warehouses,
    },
  } satisfies ApiResponse<PagedResult<WarehouseResponse>>;
}

function getOriginSearchTerms(originCity: string) {
  const normalized = normalizeCity(originCity);
  const terms = new Set<string>();

  if (originCity.trim()) {
    terms.add(originCity.trim());
  }

  if (normalized.includes('hochiminh') || normalized === 'hcm' || normalized.includes('saigon')) {
    terms.add('Ho Chi Minh');
    terms.add('HCM');
    terms.add('Sai Gon');
    terms.add('Sài Gòn');
  }

  if (normalized.includes('hanoi') || normalized === 'hn') {
    terms.add('Ha Noi');
    terms.add('Hanoi');
    terms.add('HN');
    terms.add('Hà Nội');
  }

  return Array.from(terms);
}

function normalizeCity(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s|\./g, '');
}
