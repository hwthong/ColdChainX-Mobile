import { apiRequest } from './apiClient';

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

export interface ApiResponse<T> {
  success: boolean;
  message?: string | null;
  data?: T | null;
}

export function getCustomerById(accessToken: string, customerId: string) {
  return apiRequest<ApiResponse<CustomerResponse>>(`/api/customers/${customerId}`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
}
