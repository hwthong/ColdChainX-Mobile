import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import {
  logout as logoutApi,
  mapBackendRoleToAppRole,
  refreshTokens as refreshTokensApi,
} from '../services/authApi';
import { ApiClientError, getApiErrorMessage } from '../services/apiClient';
import { getCustomerIdFromToken, getRoleFromToken, getUserIdFromToken, getWarehouseIdFromToken } from '../services/jwt';

export type UserRole = 'DRIVER' | 'CUSTOMER' | 'WAREHOUSE';

export type AuthUser = {
  userId: string;
  customerId?: string | null;
  warehouseId?: string | null;
  fullName: string;
  email: string;
  backendRole: number | string;
};

type LoginPayload = {
  token: string;
  role: UserRole;
  refreshToken?: string | null;
  accessTokenExpiresAt?: string | null;
  user?: AuthUser | null;
};

type AuthState = {
  token: string | null;
  refreshToken: string | null;
  accessTokenExpiresAt: string | null;
  userId: string | null;
  customerId: string | null;
  warehouseId: string | null;
  fullName: string | null;
  email: string | null;
  role: UserRole | null;
  user: AuthUser | null;
  login: (payload: LoginPayload) => void;
  logout: () => Promise<void>;
  refreshSession: () => Promise<string | null>;
};

const emptyAuthState = {
  token: null,
  refreshToken: null,
  accessTokenExpiresAt: null,
  userId: null,
  customerId: null,
  warehouseId: null,
  fullName: null,
  email: null,
  role: null,
  user: null,
} satisfies Pick<
  AuthState,
  | 'token'
  | 'refreshToken'
  | 'accessTokenExpiresAt'
  | 'userId'
  | 'customerId'
  | 'warehouseId'
  | 'fullName'
  | 'email'
  | 'role'
  | 'user'
>;

const LOGOUT_REFRESH_SKEW_MS = 30 * 1000;

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      token: null,
      refreshToken: null,
      accessTokenExpiresAt: null,
      userId: null,
      customerId: null,
      warehouseId: null,
      fullName: null,
      email: null,
      role: null,
      user: null,
      login: ({ token, role, refreshToken = null, accessTokenExpiresAt = null, user = null }) => {
        const customerId = user?.customerId ?? getCustomerIdFromToken(token);
        const userId = user?.userId ?? getUserIdFromToken(token);
        const warehouseId = user?.warehouseId ?? getWarehouseIdFromToken(token);

        set({
          token,
          role,
          refreshToken,
          accessTokenExpiresAt,
          user: user && userId ? { ...user, userId, customerId, warehouseId } : user,
          userId,
          customerId,
          warehouseId,
          fullName: user?.fullName ?? null,
          email: user?.email ?? null,
        });
      },
      logout: async () => {
        const { token, refreshToken, accessTokenExpiresAt } = get();

        try {
          const logoutToken = await getLogoutToken({
            token,
            refreshToken,
            accessTokenExpiresAt,
          });

          if (logoutToken) {
            await logoutApi(logoutToken);
          }
        } catch (error) {
          logLogoutFailure(error);
        } finally {
          set(emptyAuthState);
        }
      },
      refreshSession: async () => {
        const { refreshToken } = get();

        if (!refreshToken) {
          set(emptyAuthState);
          return null;
        }

        try {
          const response = await refreshTokensApi(refreshToken);

          if (!response.success) {
            throw new Error(response.message ?? 'Refresh token failed.');
          }

          const authData = response.data;
          if (!authData?.accessToken) {
            throw new Error('Refresh response is missing accessToken.');
          }

          const backendRole = authData.role ?? getRoleFromToken(authData.accessToken);
          const appRole = mapBackendRoleToAppRole(backendRole);
          if (!appRole) {
            throw new Error('This account role is not supported on mobile.');
          }
          const currentUser = get().user;
          const customerId =
            authData.customerId ?? currentUser?.customerId ?? getCustomerIdFromToken(authData.accessToken);
          const userId = authData.userId ?? currentUser?.userId ?? getUserIdFromToken(authData.accessToken);
          const warehouseId =
            authData.warehouseId ?? currentUser?.warehouseId ?? getWarehouseIdFromToken(authData.accessToken);

          set({
            token: authData.accessToken,
            refreshToken: authData.refreshToken,
            accessTokenExpiresAt: authData.accessTokenExpiresAt,
            role: appRole,
            userId,
            customerId,
            warehouseId,
            fullName: authData.fullName,
            email: authData.email ?? currentUser?.email ?? '',
            user: {
              userId: userId ?? authData.userId,
              customerId,
              warehouseId,
              fullName: authData.fullName,
              email: authData.email ?? currentUser?.email ?? '',
              backendRole: backendRole ?? appRole,
            },
          });

          return authData.accessToken;
        } catch (error) {
          console.error('[authStore] Refresh session failed', {
            message: getApiErrorMessage(error),
          });
          set(emptyAuthState);
          return null;
        }
      },
    }),
    {
      name: 'coldchainx-auth',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);

async function getLogoutToken({
  token,
  refreshToken,
  accessTokenExpiresAt,
}: Pick<AuthState, 'token' | 'refreshToken' | 'accessTokenExpiresAt'>) {
  if (!token) {
    return null;
  }

  if (!refreshToken || !shouldRefreshBeforeLogout(accessTokenExpiresAt)) {
    return token;
  }

  try {
    const response = await refreshTokensApi(refreshToken);
    return response.success && response.data?.accessToken ? response.data.accessToken : token;
  } catch (error) {
    if (__DEV__ && !isAuthRejection(error)) {
      console.warn('[authStore] Refresh before logout failed', {
        message: getApiErrorMessage(error),
      });
    }

    return token;
  }
}

function shouldRefreshBeforeLogout(accessTokenExpiresAt: string | null) {
  if (!accessTokenExpiresAt) {
    return false;
  }

  const expiresAt = Date.parse(accessTokenExpiresAt);
  return Number.isFinite(expiresAt) && expiresAt <= Date.now() + LOGOUT_REFRESH_SKEW_MS;
}

function logLogoutFailure(error: unknown) {
  if (isAuthRejection(error)) {
    if (__DEV__) {
      console.info('[authStore] Server session was already expired during logout', {
        message: getApiErrorMessage(error),
      });
    }
    return;
  }

  console.warn('[authStore] Server logout failed; local session was cleared', {
    message: getApiErrorMessage(error),
  });
}

function isAuthRejection(error: unknown) {
  return error instanceof ApiClientError && (error.status === 401 || error.status === 403);
}
