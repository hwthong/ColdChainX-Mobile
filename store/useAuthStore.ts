import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import {
  logout as logoutApi,
  mapBackendRoleToAppRole,
  refreshTokens as refreshTokensApi,
} from '../services/authApi';
import { getApiErrorMessage } from '../services/apiClient';
import { getCustomerIdFromToken, getUserIdFromToken } from '../services/jwt';

export type UserRole = 'DRIVER' | 'CUSTOMER';

export type AuthUser = {
  userId: string;
  customerId?: string | null;
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
  | 'fullName'
  | 'email'
  | 'role'
  | 'user'
>;

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      token: null,
      refreshToken: null,
      accessTokenExpiresAt: null,
      userId: null,
      customerId: null,
      fullName: null,
      email: null,
      role: null,
      user: null,
      login: ({ token, role, refreshToken = null, accessTokenExpiresAt = null, user = null }) => {
        const customerId = user?.customerId ?? getCustomerIdFromToken(token);
        const userId = user?.userId ?? getUserIdFromToken(token);

        set({
          token,
          role,
          refreshToken,
          accessTokenExpiresAt,
          user: user && userId ? { ...user, userId, customerId } : user,
          userId,
          customerId,
          fullName: user?.fullName ?? null,
          email: user?.email ?? null,
        });
      },
      logout: async () => {
        const { token } = get();

        try {
          if (token) {
            await logoutApi(token);
          }
        } catch (error) {
          console.error('[authStore] Server logout failed', {
            message: getApiErrorMessage(error),
          });
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

          const appRole = mapBackendRoleToAppRole(authData.role);
          const currentUser = get().user;
          const customerId =
            authData.customerId ?? currentUser?.customerId ?? getCustomerIdFromToken(authData.accessToken);
          const userId = authData.userId ?? currentUser?.userId ?? getUserIdFromToken(authData.accessToken);

          set({
            token: authData.accessToken,
            refreshToken: authData.refreshToken,
            accessTokenExpiresAt: authData.accessTokenExpiresAt,
            role: appRole,
            userId,
            customerId,
            fullName: authData.fullName,
            email: authData.email ?? currentUser?.email ?? '',
            user: {
              userId: userId ?? authData.userId,
              customerId,
              fullName: authData.fullName,
              email: authData.email ?? currentUser?.email ?? '',
              backendRole: authData.role ?? appRole,
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
