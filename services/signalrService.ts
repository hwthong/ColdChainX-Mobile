import * as signalR from '@microsoft/signalr';
import { API_BASE_URL } from './apiClient';
import { NotificationResponse } from './notificationApi';
import { useAuthStore } from '../store/useAuthStore';

export type SignalRConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'reconnecting';

type NotificationEventHandler = (notification: NotificationResponse) => void;
type GenericEventHandler = (data: any) => void;
type StatusChangeHandler = (status: SignalRConnectionStatus) => void;

class SignalRService {
  private connection: signalR.HubConnection | null = null;
  private status: SignalRConnectionStatus = 'disconnected';
  private notificationListeners = new Set<NotificationEventHandler>();
  private genericListeners = new Map<string, Set<GenericEventHandler>>();
  private statusListeners = new Set<StatusChangeHandler>();
  private isExplicitlyStopped = false;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  public getStatus(): SignalRConnectionStatus {
    return this.status;
  }

  private setStatus(newStatus: SignalRConnectionStatus) {
    if (this.status === newStatus) return;
    this.status = newStatus;
    if (__DEV__) {
      console.log(`[SignalR] Connection status: ${newStatus}`);
    }
    this.statusListeners.forEach((listener) => {
      try {
        listener(newStatus);
      } catch (err) {
        console.error('[SignalR] Error in status listener', err);
      }
    });
  }

  public async start(): Promise<void> {
    const token = useAuthStore.getState().token;
    if (!token) {
      if (__DEV__) {
        console.log('[SignalR] Start skipped: No auth token.');
      }
      return;
    }

    this.isExplicitlyStopped = false;

    if (
      this.connection &&
      (this.connection.state === signalR.HubConnectionState.Connected ||
        this.connection.state === signalR.HubConnectionState.Connecting ||
        this.connection.state === signalR.HubConnectionState.Reconnecting)
    ) {
      return;
    }

    try {
      this.setStatus('connecting');

      if (!this.connection) {
        const rootBaseUrl = API_BASE_URL.replace(/\/api\/?$/i, '').replace(/\/+$/, '');
        const hubUrl = `${rootBaseUrl}/hubs/notifications`;

        this.connection = new signalR.HubConnectionBuilder()
          .withUrl(hubUrl, {
            accessTokenFactory: () => {
              const currentToken = useAuthStore.getState().token;
              return currentToken || '';
            },
            transport: signalR.HttpTransportType.WebSockets | signalR.HttpTransportType.LongPolling,
          })
          .withAutomaticReconnect([0, 2000, 5000, 10000, 30000])
          .configureLogging(__DEV__ ? signalR.LogLevel.Information : signalR.LogLevel.None)
          .build();

        this.bindHubEvents();
      }

      await this.connection.start();
      this.setStatus('connected');
      if (__DEV__) {
        console.log('[SignalR] Connected successfully to /hubs/notifications');
      }
    } catch (error) {
      this.setStatus('disconnected');
      if (__DEV__) {
        console.warn('[SignalR] Failed to start SignalR connection:', error);
      }

      // Retry after delay if not explicitly stopped
      if (!this.isExplicitlyStopped && !this.reconnectTimer) {
        this.reconnectTimer = setTimeout(() => {
          this.reconnectTimer = null;
          if (!this.isExplicitlyStopped && useAuthStore.getState().token) {
            this.start().catch(() => {});
          }
        }, 10000);
      }
    }
  }

  public async stop(): Promise<void> {
    this.isExplicitlyStopped = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.connection) {
      try {
        await this.connection.stop();
      } catch (err) {
        if (__DEV__) {
          console.warn('[SignalR] Error stopping connection:', err);
        }
      } finally {
        this.connection = null;
        this.setStatus('disconnected');
      }
    }
  }

  private bindHubEvents() {
    if (!this.connection) return;

    this.connection.onreconnecting(() => {
      this.setStatus('reconnecting');
    });

    this.connection.onreconnected(() => {
      this.setStatus('connected');
    });

    this.connection.onclose(() => {
      this.setStatus('disconnected');
      if (!this.isExplicitlyStopped && useAuthStore.getState().token) {
        setTimeout(() => {
          if (!this.isExplicitlyStopped) {
            this.start().catch(() => {});
          }
        }, 5000);
      }
    });

    // 1. Generic ReceiveNotification
    this.connection.on('ReceiveNotification', (data: any) => {
      const normalized = this.normalizeNotification(data, 'GENERIC');
      this.dispatchNotification(normalized);
      this.dispatchGenericEvent('ReceiveNotification', data);
    });

    // 2. Cold Chain Alert (Nhiệt độ, cảnh báo IoT)
    this.connection.on('ReceiveColdChainAlert', (data: any) => {
      const normalized: NotificationResponse = {
        id: data?.alertId || String(Date.now()),
        notificationId: data?.alertId || String(Date.now()),
        title: data?.title || 'Cảnh báo nhiệt độ & chuỗi lạnh',
        body: data?.message || data?.body || `Nhiệt độ hiện tại: ${data?.currentTemp ?? 'N/A'}°C`,
        type: 'COLD_CHAIN_ALERT',
        category: 'ALERT',
        isRead: false,
        createdAt: new Date().toISOString(),
        data,
        payload: data,
      };
      this.dispatchNotification(normalized);
      this.dispatchGenericEvent('ReceiveColdChainAlert', data);
    });

    // 3. Trip Status Events (Cứu hộ, hoãn chuyến, tiếp tục)
    this.connection.on('TripDelayed', (data: any) => {
      const normalized: NotificationResponse = {
        id: String(Date.now()),
        title: 'Chuyến xe bị hoãn / gặp sự cố',
        body: data?.reason || data?.message || 'Chuyến xe đang được điều phối cứu hộ.',
        type: 'TRIP_DELAYED',
        category: 'TRIP',
        isRead: false,
        createdAt: new Date().toISOString(),
        data,
        payload: data,
      };
      this.dispatchNotification(normalized);
      this.dispatchGenericEvent('TripDelayed', data);
    });

    this.connection.on('TripResumed', (data: any) => {
      const normalized: NotificationResponse = {
        id: String(Date.now()),
        title: 'Chuyến xe tiếp tục hành trình',
        body: data?.message || 'Sự cố đã được giải quyết hoặc đã hoàn thành sang hàng cứu hộ.',
        type: 'TRIP_RESUMED',
        category: 'TRIP',
        isRead: false,
        createdAt: new Date().toISOString(),
        data,
        payload: data,
      };
      this.dispatchNotification(normalized);
      this.dispatchGenericEvent('TripResumed', data);
    });

    // 4. Incident Workflow Notifications
    const incidentEvents = [
      'IncidentWorkflowNotification',
      'IncidentExpenseApproved',
      'IncidentExpenseReimbursed',
      'IncidentResolved',
      'IncidentFallbackRecorded',
      'ExternalReeferDispatched',
      'IncidentRescueDispatched',
    ];

    incidentEvents.forEach((eventName) => {
      this.connection?.on(eventName, (data: any) => {
        const titleMap: Record<string, string> = {
          IncidentExpenseApproved: 'Khoản chi sự cố đã được duyệt',
          IncidentExpenseReimbursed: 'Đã hoàn tiền tạm ứng sự cố',
          IncidentResolved: 'Sự cố đã được xử lý hoàn tất',
          IncidentRescueDispatched: 'Xe cứu hộ đang di chuyển đến vị trí của bạn',
          IncidentWorkflowNotification: 'Cập nhật tiến trình xử lý sự cố',
        };

        const normalized: NotificationResponse = {
          id: String(Date.now()),
          title: titleMap[eventName] || data?.title || 'Cập nhật sự cố',
          body: data?.message || data?.note || data?.resolutionNote || 'Có cập nhật mới về sự cố của bạn.',
          type: 'INCIDENT_WORKFLOW',
          category: 'INCIDENT',
          isRead: false,
          createdAt: new Date().toISOString(),
          data,
          payload: data,
        };
        this.dispatchNotification(normalized);
        this.dispatchGenericEvent(eventName, data);
      });
    });

    // 5. Driver License & Vehicle Document Alerts
    this.connection.on('DriverLicenseExpiring', (data: any) => {
      const normalized: NotificationResponse = {
        id: String(Date.now()),
        title: 'GPLX sắp hết hạn',
        body: `Giấy phép lái xe hạng ${data?.licenseClass ?? ''} còn ${data?.days ?? ''} ngày nữa sẽ hết hạn.`,
        type: 'LICENSE_EXPIRING',
        isRead: false,
        createdAt: new Date().toISOString(),
        data,
      };
      this.dispatchNotification(normalized);
      this.dispatchGenericEvent('DriverLicenseExpiring', data);
    });

    this.connection.on('DriverLicenseExpired', (data: any) => {
      const normalized: NotificationResponse = {
        id: String(Date.now()),
        title: 'GPLX đã hết hạn',
        body: `Giấy phép lái xe của bạn đã hết hạn vào ngày ${data?.expiryDate ?? ''}. Vui lòng cập nhật.`,
        type: 'LICENSE_EXPIRED',
        isRead: false,
        createdAt: new Date().toISOString(),
        data,
      };
      this.dispatchNotification(normalized);
      this.dispatchGenericEvent('DriverLicenseExpired', data);
    });

    this.connection.on('VehicleDocumentExpiring', (data: any) => {
      const normalized: NotificationResponse = {
        id: String(Date.now()),
        title: 'Giấy tờ xe sắp hết hạn',
        body: `Giấy tờ ${data?.documentType ?? ''} của xe ${data?.truckPlate ?? ''} còn ${data?.days ?? ''} ngày nữa sẽ hết hạn.`,
        type: 'VEHICLE_DOC_EXPIRING',
        isRead: false,
        createdAt: new Date().toISOString(),
        data,
      };
      this.dispatchNotification(normalized);
      this.dispatchGenericEvent('VehicleDocumentExpiring', data);
    });

    this.connection.on('VehicleDocumentExpired', (data: any) => {
      const normalized: NotificationResponse = {
        id: String(Date.now()),
        title: 'Giấy tờ xe đã hết hạn',
        body: `Giấy tờ ${data?.documentType ?? ''} của xe ${data?.truckPlate ?? ''} đã hết hạn.`,
        type: 'VEHICLE_DOC_EXPIRED',
        isRead: false,
        createdAt: new Date().toISOString(),
        data,
      };
      this.dispatchNotification(normalized);
      this.dispatchGenericEvent('VehicleDocumentExpired', data);
    });

    // 6. Generic IoT Warning & Alert
    this.connection.on('ReceiveAlert', (data: any) => {
      const normalized: NotificationResponse = {
        id: data?.alertId || String(Date.now()),
        notificationId: data?.alertId || String(Date.now()),
        title: data?.title || 'Cảnh báo vận hành',
        body: data?.message || data?.body || 'Có cảnh báo mới về thiết bị/chuyến xe.',
        type: 'ALERT',
        isRead: false,
        createdAt: new Date().toISOString(),
        data,
      };
      this.dispatchNotification(normalized);
      this.dispatchGenericEvent('ReceiveAlert', data);
    });

    this.connection.on('IotWarning', (message: string) => {
      const normalized: NotificationResponse = {
        id: String(Date.now()),
        title: 'Cảnh báo thiết bị IoT',
        body: typeof message === 'string' ? message : 'Thiết bị IoT gặp sự cố kết nối.',
        type: 'IOT_WARNING',
        isRead: false,
        createdAt: new Date().toISOString(),
      };
      this.dispatchNotification(normalized);
      this.dispatchGenericEvent('IotWarning', message);
    });

    // 7. Customer Events
    const customerEvents: Record<string, string> = {
      ReceiveQuotation: 'Báo giá mới đã được tạo',
      OrderNeedsUpdate: 'Đơn hàng cần cập nhật thông tin',
      OrderRejected: 'Đơn hàng đã bị từ chối',
      ContractPendingSignature: 'Hợp đồng chờ bạn ký xác nhận',
      TrackingIssued: 'Đơn hàng đã được cấp mã vận đơn',
      AppendixPendingSignature: 'Phụ lục hợp đồng chờ bạn ký',
    };

    Object.entries(customerEvents).forEach(([eventName, defaultTitle]) => {
      this.connection?.on(eventName, (data: any) => {
        const normalized: NotificationResponse = {
          id: String(Date.now()),
          title: data?.title || defaultTitle,
          body: data?.message || data?.body || data?.note || 'Có cập nhật mới về đơn hàng của bạn.',
          type: eventName,
          category: 'ORDER',
          isRead: false,
          createdAt: new Date().toISOString(),
          data,
          payload: data,
          orderId: data?.orderId,
        };
        this.dispatchNotification(normalized);
        this.dispatchGenericEvent(eventName, data);
      });
    });
  }

  private normalizeNotification(raw: any, fallbackType: string): NotificationResponse {
    if (typeof raw === 'object' && raw !== null) {
      return {
        id: raw.notificationId || raw.notiId || raw.id || String(Date.now()),
        notificationId: raw.notificationId || raw.notiId || raw.id || String(Date.now()),
        title: raw.title || raw.message || 'Thông báo mới',
        body: raw.body || raw.content || raw.message || '',
        message: raw.message || raw.body || raw.content || '',
        type: raw.type || raw.templateId || fallbackType,
        category: raw.category || raw.type || fallbackType,
        isRead: Boolean(raw.isRead || raw.readAt),
        createdAt: raw.createdAt || new Date().toISOString(),
        data: raw.data || raw.payload || raw.params,
        payload: raw.payload || raw.data || raw.params,
        orderId: raw.orderId,
      };
    }

    return {
      id: String(Date.now()),
      title: 'Thông báo',
      body: String(raw),
      type: fallbackType,
      isRead: false,
      createdAt: new Date().toISOString(),
    };
  }

  private dispatchNotification(notification: NotificationResponse) {
    this.notificationListeners.forEach((listener) => {
      try {
        listener(notification);
      } catch (err) {
        console.error('[SignalR] Error in notification listener', err);
      }
    });
  }

  private dispatchGenericEvent(eventName: string, data: any) {
    const listeners = this.genericListeners.get(eventName);
    if (listeners) {
      listeners.forEach((listener) => {
        try {
          listener(data);
        } catch (err) {
          console.error(`[SignalR] Error in listener for ${eventName}`, err);
        }
      });
    }
  }

  // Public subscription APIs
  public onNotification(handler: NotificationEventHandler): () => void {
    this.notificationListeners.add(handler);
    return () => this.notificationListeners.delete(handler);
  }

  public onStatusChange(handler: StatusChangeHandler): () => void {
    this.statusListeners.add(handler);
    handler(this.status);
    return () => this.statusListeners.delete(handler);
  }

  public on(eventName: string, handler: GenericEventHandler): () => void {
    if (!this.genericListeners.has(eventName)) {
      this.genericListeners.set(eventName, new Set());
    }
    this.genericListeners.get(eventName)!.add(handler);
    return () => {
      this.genericListeners.get(eventName)?.delete(handler);
    };
  }

  public getConnection(): signalR.HubConnection | null {
    return this.connection;
  }
}

export const signalRService = new SignalRService();

export function startSignalR() {
  return signalRService.start();
}

export function stopSignalR() {
  return signalRService.stop();
}
