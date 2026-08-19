import '../global.css';

import { Slot, useRootNavigationState, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useSyncExternalStore } from 'react';
import { AppState } from 'react-native';

import { startSignalR, stopSignalR } from '../services/signalrService';
import { useAuthStore } from '../store/useAuthStore';
import { useNotificationStore } from '../store/useNotificationStore';

const loginRoute = '/(auth)/login';
const driverHomeRoute = '/(driver)/home';
const customerHomeRoute = '/(customer)/home';
const warehouseHomeRoute = '/(warehouse)/home';
const subscribeToAuthHydration = (onStoreChange: () => void) =>
  useAuthStore.persist.onFinishHydration(onStoreChange);
const getAuthHydrationSnapshot = () => useAuthStore.persist.hasHydrated();

export default function RootLayout() {
  const router = useRouter();
  const rootNavigationState = useRootNavigationState();
  const segments = useSegments();
  const currentGroup = segments[0] as string | undefined;
  const token = useAuthStore((state) => state.token);
  const role = useAuthStore((state) => state.role);
  const hasHydrated = useSyncExternalStore(
    subscribeToAuthHydration,
    getAuthHydrationSnapshot,
    getAuthHydrationSnapshot
  );

  // Manage SignalR real-time connection lifecycle
  useEffect(() => {
    if (!hasHydrated) return;

    if (token) {
      const cleanupListeners = useNotificationStore.getState().initSignalRListeners();
      startSignalR().catch(() => {});
      useNotificationStore.getState().fetchUnreadCount(token);

      const appStateSub = AppState.addEventListener('change', (nextState) => {
        if (nextState === 'active') {
          const currentToken = useAuthStore.getState().token;
          if (currentToken) {
            startSignalR().catch(() => {});
            useNotificationStore.getState().fetchUnreadCount(currentToken);
          }
        }
      });

      return () => {
        appStateSub.remove();
        cleanupListeners();
      };
    } else {
      stopSignalR().catch(() => {});
      useNotificationStore.getState().reset();
    }
  }, [hasHydrated, token]);

  useEffect(() => {
    if (!hasHydrated || !rootNavigationState?.key) {
      return;
    }

    if (!token) {
      if (currentGroup !== '(auth)') {
        setTimeout(() => {
          router.replace(loginRoute);
        }, 0);
      }
      return;
    }

    if (role === 'DRIVER') {
      if (currentGroup !== '(driver)') {
        setTimeout(() => {
          router.replace(driverHomeRoute);
        }, 0);
      }
      return;
    }

    if (role === 'CUSTOMER') {
      if (currentGroup !== '(customer)') {
        setTimeout(() => {
          router.replace(customerHomeRoute);
        }, 0);
      }
      return;
    }

    if (role === 'WAREHOUSE') {
      if (currentGroup !== '(warehouse)') {
        setTimeout(() => {
          router.replace(warehouseHomeRoute as never);
        }, 0);
      }
      return;
    }

    if (currentGroup !== '(auth)') {
      setTimeout(() => {
        router.replace(loginRoute);
      }, 0);
    }
  }, [currentGroup, hasHydrated, role, rootNavigationState?.key, router, token]);

  return (
    <>
      <StatusBar style="dark" />
      <Slot />
    </>
  );
}
