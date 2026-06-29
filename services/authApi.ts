import type { UserRole } from '../store/useAuthStore';
import { apiRequest } from './apiClient';

export enum BackendRole {
  Admin = 1,
  Dispatcher = 2,
  Sales = 3,
  Customer = 4,
  Driver = 5,
}

export const DEFAULT_REGISTER_ROLE = BackendRole.Customer;

export type RegisterPayload = {
  fullName: string;
  email: string;
  password: string;
  phoneNumber?: string | null;
  role: BackendRole;
};

export interface CreateCustomerRequest {
  username?: string;
  fullName: string;
  email: string;
  password: string;
  phone?: string;
  companyName: string;
  taxCode: string;
  address?: string;
  paymentTerm?: number;
}

export type LoginPayload = {
  email: string;
  password: string;
};

export type AuthUserDto = {
  userId: string;
  customerId?: string | null;
  warehouseId?: string | null;
  username?: string | null;
  fullName: string;
  email?: string | null;
  role?: BackendRole | number | string | null;
  status?: string | null;
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresAt: string;
};

export type UpdateProfilePayload = {
  fullName?: string | null;
  phoneNumber?: string | null;
  newPassword?: string | null;
};

export type UserProfileDto = {
  userId: string;
  fullName: string;
  email: string;
  phoneNumber?: string | null;
  role: BackendRole | number | string;
  status: number | string;
  createdAt: string;
  updatedAt?: string | null;
};

export type ApiResponse<T> = {
  success: boolean;
  message?: string | null;
  data?: T | null;
};

export function register(payload: RegisterPayload) {
  return apiRequest<ApiResponse<AuthUserDto>>('/api/auth/register', {
    method: 'POST',
    body: payload,
  });
}

export function registerCustomer(data: CreateCustomerRequest) {
  const formData = new FormData();
  if (data.username) formData.append('username', data.username);
  formData.append('fullName', data.fullName);
  formData.append('email', data.email);
  formData.append('password', data.password);
  if (data.phone) formData.append('phone', data.phone);
  formData.append('companyName', data.companyName);
  formData.append('taxCode', data.taxCode);
  if (data.address) formData.append('address', data.address);
  if (data.paymentTerm !== undefined) formData.append('paymentTerm', String(data.paymentTerm));

  return apiRequest<ApiResponse<AuthUserDto>>('/api/auth/create-customer', {
    method: 'POST',
    body: formData,
  });
}

export function login(payload: LoginPayload) {
  return apiRequest<ApiResponse<AuthUserDto>>('/api/auth/login', {
    method: 'POST',
    body: payload,
  });
}

export function refreshTokens(refreshToken: string) {
  return apiRequest<ApiResponse<AuthUserDto>>('/api/auth/refresh-tokens', {
    method: 'POST',
    body: refreshToken,
  });
}

export function logout(accessToken: string) {
  return apiRequest<ApiResponse<boolean>>('/api/auth/logout', {
    method: 'POST',
    headers: getAuthHeaders(accessToken),
  });
}

export function updateProfile(accessToken: string, payload: UpdateProfilePayload) {
  return apiRequest<ApiResponse<UserProfileDto>>('/api/auth/profile', {
    method: 'PUT',
    headers: getAuthHeaders(accessToken),
    body: payload,
  });
}

// Admin-only endpoint. Regular mobile user/driver flows should not call this.
export function deleteUser(accessToken: string, userId: string) {
  return apiRequest<ApiResponse<boolean>>(`/api/auth/${userId}`, {
    method: 'DELETE',
    headers: getAuthHeaders(accessToken),
  });
}

export function mapBackendRoleToAppRole(role: AuthUserDto['role']): UserRole | null {
  return getMobileRoleFromBackend(role);
}

export function getMobileRoleFromBackend(role: AuthUserDto['role']): UserRole | null {
  const normalizedRole = normalizeBackendRole(role);

  if (normalizedRole === 'DRIVER' || normalizedRole === String(BackendRole.Driver)) {
    return 'DRIVER';
  }

  if (normalizedRole === 'CUSTOMER' || normalizedRole === String(BackendRole.Customer)) {
    return 'CUSTOMER';
  }

  if (
    normalizedRole === 'WAREHOUSE' ||
    normalizedRole === 'WAREHOUSEWORKER' ||
    normalizedRole === 'WAREHOUSESTAFF' ||
    normalizedRole === 'WAREHOUSEMONITOR' ||
    normalizedRole === 'WAREHOUSEMANAGER'
  ) {
    return 'WAREHOUSE';
  }

  return null;
}

function getAuthHeaders(accessToken: string) {
  return {
    Authorization: `Bearer ${accessToken}`,
  };
}

function normalizeBackendRole(role: AuthUserDto['role']) {
  return String(role ?? '').trim().toUpperCase();
}
