import type { UserRole } from '../store/useAuthStore';
import { apiRequest } from './apiClient';

export enum BackendRole {
  Admin = 0,
  Manager = 1,
  Staff = 2,
  Driver = 3,
}

// Backend currently has no Customer role; RegisterRequest defaults to Staff.
export const DEFAULT_REGISTER_ROLE = BackendRole.Staff;

export type RegisterPayload = {
  fullName: string;
  email: string;
  password: string;
  phoneNumber?: string | null;
  role: BackendRole;
};

export type LoginPayload = {
  email: string;
  password: string;
};

export type AuthUserDto = {
  userId: string;
  fullName: string;
  email: string;
  role: BackendRole | number | string;
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

export function mapBackendRoleToAppRole(role: AuthUserDto['role']): UserRole {
  if (
    role === BackendRole.Driver ||
    Number(role) === BackendRole.Driver ||
    role === 'Driver' ||
    role === 'DRIVER'
  ) {
    return 'DRIVER';
  }

  return 'CUSTOMER';
}

function getAuthHeaders(accessToken: string) {
  return {
    Authorization: `Bearer ${accessToken}`,
  };
}
