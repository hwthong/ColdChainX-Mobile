import { create } from 'zustand';
import { getUnreadNotificationCount, NotificationResponse } from '../services/notificationApi';
import { signalRService, SignalRConnectionStatus } from '../services/signalrService';

interface NotificationStoreState {
  unreadCount: number;
  connectionStatus: SignalRConnectionStatus;
  realtimeItems: NotificationResponse[];
  isInitialized: boolean;
  isLoadingUnreadCount: boolean;

  // Actions
  fetchUnreadCount: (token: string) => Promise<number>;
  setUnreadCount: (count: number) => void;
  incrementUnreadCount: () => void;
  decrementUnreadCount: (amount?: number) => void;
  setConnectionStatus: (status: SignalRConnectionStatus) => void;
  addRealtimeNotification: (notification: NotificationResponse) => void;
  initSignalRListeners: () => () => void;
  clearRealtimeItems: () => void;
  reset: () => void;
}

let inFlightUnreadPromise: Promise<number> | null = null;
let lastUnreadFetchedAt = 0;

export const useNotificationStore = create<NotificationStoreState>((set, get) => ({
  unreadCount: 0,
  connectionStatus: 'disconnected',
  realtimeItems: [],
  isInitialized: false,
  isLoadingUnreadCount: false,

  fetchUnreadCount: async (token: string) => {
    if (!token) {
      set({ unreadCount: 0 });
      return 0;
    }

    const now = Date.now();
    if (inFlightUnreadPromise) {
      return inFlightUnreadPromise;
    }
    if (now - lastUnreadFetchedAt < 10_000) {
      return get().unreadCount;
    }

    inFlightUnreadPromise = (async () => {
      try {
        set({ isLoadingUnreadCount: true });
        const res = await getUnreadNotificationCount(token);
        lastUnreadFetchedAt = Date.now();
        if (res.success && res.data) {
          const count = res.data.unreadCount ?? 0;
          set({ unreadCount: count });
          return count;
        }
      } catch (err) {
        if (__DEV__) {
          console.warn('[useNotificationStore] fetchUnreadCount failed:', err);
        }
      } finally {
        set({ isLoadingUnreadCount: false });
        inFlightUnreadPromise = null;
      }
      return get().unreadCount;
    })();

    return inFlightUnreadPromise;
  },

  setUnreadCount: (count: number) => {
    set({ unreadCount: Math.max(0, count) });
  },

  incrementUnreadCount: () => {
    set((state) => ({ unreadCount: state.unreadCount + 1 }));
  },

  decrementUnreadCount: (amount = 1) => {
    set((state) => ({ unreadCount: Math.max(0, state.unreadCount - amount) }));
  },

  setConnectionStatus: (connectionStatus: SignalRConnectionStatus) => {
    set({ connectionStatus });
  },

  addRealtimeNotification: (notification: NotificationResponse) => {
    set((state) => {
      // Check if already in list to prevent duplicate
      const notifId = notification.notificationId || notification.id;
      const exists = state.realtimeItems.some(
        (item) => (item.notificationId || item.id) === notifId
      );
      if (exists) return state;

      return {
        realtimeItems: [notification, ...state.realtimeItems],
        unreadCount: notification.isRead ? state.unreadCount : state.unreadCount + 1,
      };
    });
  },

  clearRealtimeItems: () => {
    set({ realtimeItems: [] });
  },

  initSignalRListeners: () => {
    if (get().isInitialized) {
      return () => {};
    }

    const unsubNotification = signalRService.onNotification((notification) => {
      get().addRealtimeNotification(notification);
    });

    const unsubStatus = signalRService.onStatusChange((status) => {
      get().setConnectionStatus(status);
    });

    set({ isInitialized: true });

    return () => {
      unsubNotification();
      unsubStatus();
      set({ isInitialized: false });
    };
  },

  reset: () => {
    set({
      unreadCount: 0,
      connectionStatus: 'disconnected',
      realtimeItems: [],
      isInitialized: false,
      isLoadingUnreadCount: false,
    });
  },
}));
