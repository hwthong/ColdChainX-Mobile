import { apiRequest } from './apiClient';
import { useAuthStore } from '../store/useAuthStore';

// Common structures
export interface PagedResult<T> {
  totalRecords: number;
  totalPages: number;
  currentPage: number;
  pageSize: number;
  data: T[];
}

export interface ApiResponse<T> {
  success: boolean;
  message?: string | null;
  data?: T | null;
}

export interface CustomerResponse {
  customerId: string;
  companyName: string;
  taxCode: string;
  address?: string | null;
  email?: string | null;
  paymentTerm: number;
  status: string;
  createdAt?: string | null;
  orderCount: number;
  contractCount: number;
}

export interface CustomerOrderSummaryResponse {
  orderId: string;
  trackingCode: string;
  itemName: string;
  category: string;
  status: string;
  createdAt: string;
  routeCode?: string;
  destinationAddress?: string;
}

// ------------------------------------------
// API Service
// ------------------------------------------

export const customerApi = {
  /**
   * Fetch customer profile by ID
   */
  getCustomerById: async (customerId: string): Promise<CustomerResponse> => {
    const token = useAuthStore.getState().token;
    if (!token) throw new Error('Not authenticated');

    const response = await apiRequest<ApiResponse<CustomerResponse>>(`/api/customers/${customerId}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.success || !response.data) {
      throw new Error('Không thể tải thông tin khách hàng.');
    }

    return response.data;
  },

  /**
   * Fetch paginated orders for the current customer
   * Route: GET /api/customers/my/orders
   */
  getMyOrders: async (pageNumber = 1, pageSize = 10, status?: string): Promise<PagedResult<CustomerOrderSummaryResponse>> => {
    const token = useAuthStore.getState().token;
    if (!token) throw new Error('Not authenticated');

    const params = new URLSearchParams();
    params.append('pageNumber', pageNumber.toString());
    params.append('pageSize', pageSize.toString());
    if (status) {
      params.append('status', status);
    }

    const endpoint = `/api/customers/my/orders?${params.toString()}`;
    const response = await apiRequest<ApiResponse<PagedResult<CustomerOrderSummaryResponse>>>(endpoint, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.success || !response.data) {
      throw new Error(response.message || 'Không thể tải danh sách đơn hàng.');
    }

    return response.data;
  },

  /**
   * Fetch orders grouped by category for the current customer (No pagination)
   * Route: GET /api/customers/my/orders/by-category?category={cat}
   * Categories: "IN_STOCK", "WAITING", "TRANSIT", "DELIVERED", "RETURNED", "CANCELLED"
   */
  getMyOrdersByCategory: async (category: string): Promise<CustomerOrderSummaryResponse[]> => {
    const token = useAuthStore.getState().token;
    if (!token) throw new Error('Not authenticated');

    const endpoint = `/api/customers/my/orders/by-category?category=${category}`;
    const response = await apiRequest<{ success: boolean; data: CustomerOrderSummaryResponse[] }>(endpoint, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.success || !response.data) {
      throw new Error('Không thể tải danh sách đơn hàng theo danh mục.');
    }

    return response.data;
  },

  /**
   * Fetch detailed tracking info for an order
   * Route: GET /api/customers/my/orders/{orderId}/tracking-detail
   */
  getMyOrderTrackingDetail: async (orderId: string): Promise<any> => {
    const token = useAuthStore.getState().token;
    if (!token) throw new Error('Not authenticated');

    const endpoint = `/api/customers/my/orders/${orderId}/tracking-detail`;
    const response = await apiRequest<{ success: boolean; data: any }>(endpoint, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.success || !response.data) {
      throw new Error('Không thể tải chi tiết theo dõi đơn hàng.');
    }

    return response.data;
  }
};
