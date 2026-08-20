import * as signalR from '@microsoft/signalr';
import { API_BASE_URL } from './apiClient';
import { ChatMessage } from './chatApi';
import { ensureValidAccessToken, useAuthStore } from '../store/useAuthStore';

export type ChatHubConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'reconnecting';
type MessageEventHandler = (message: ChatMessage) => void;
type StatusChangeHandler = (status: ChatHubConnectionStatus) => void;

class ChatSignalRService {
  private connection: signalR.HubConnection | null = null;
  private status: ChatHubConnectionStatus = 'disconnected';
  private messageListeners = new Set<MessageEventHandler>();
  private statusListeners = new Set<StatusChangeHandler>();
  private isExplicitlyStopped = false;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private startPromise: Promise<void> | null = null;

  public getStatus(): ChatHubConnectionStatus {
    return this.status;
  }

  private setStatus(newStatus: ChatHubConnectionStatus) {
    if (this.status === newStatus) return;
    this.status = newStatus;
    if (__DEV__) {
      console.log(`[ChatSignalR] Connection status: ${newStatus}`);
    }
    this.statusListeners.forEach((listener) => {
      try {
        listener(newStatus);
      } catch (err) {
        console.error('[ChatSignalR] Error in status listener', err);
      }
    });
  }

  public start(): Promise<void> {
    if (this.startPromise) {
      return this.startPromise;
    }

    this.startPromise = this.startInternal(true).finally(() => {
      this.startPromise = null;
    });

    return this.startPromise;
  }

  private async startInternal(allowAuthRetry: boolean): Promise<void> {
    const token = await ensureValidAccessToken();
    if (!token) {
      if (__DEV__) {
        console.log('[ChatSignalR] Start skipped: No auth token.');
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
        const hubUrl = `${rootBaseUrl}/hubs/chat`;

        this.connection = new signalR.HubConnectionBuilder()
          .withUrl(hubUrl, {
            accessTokenFactory: () => {
              const currentToken = useAuthStore.getState().token;
              return currentToken || '';
            },
            transport: signalR.HttpTransportType.WebSockets | signalR.HttpTransportType.LongPolling,
          })
          .withAutomaticReconnect([0, 2000, 5000, 10000, 30000])
          .configureLogging(chatHubLogger)
          .build();

        this.bindHubEvents();
      }

      await this.connection.start();
      this.setStatus('connected');
      if (__DEV__) {
        console.log('[ChatSignalR] Connected successfully to /hubs/chat');
      }
    } catch (error) {
      this.setStatus('disconnected');

      if (allowAuthRetry && isUnauthorizedSignalRError(error)) {
        const refreshedToken = await ensureValidAccessToken({ forceRefresh: true });
        if (refreshedToken) {
          this.connection = null;
          return this.startInternal(false);
        }
        return;
      }

      if (__DEV__) {
        console.warn('[ChatSignalR] Failed to start SignalR connection:', error);
      }

      // Retry after delay if not explicitly stopped
      if (
        !isUnauthorizedSignalRError(error) &&
        !this.isExplicitlyStopped &&
        !this.reconnectTimer
      ) {
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
          console.warn('[ChatSignalR] Error stopping connection:', err);
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

    this.connection.on('ReceiveMessage', (message: ChatMessage) => {
      if (__DEV__) {
        console.log('[ChatSignalR] ReceiveMessage event received:', message);
      }
      this.messageListeners.forEach((listener) => {
        try {
          listener(message);
        } catch (err) {
          console.error('[ChatSignalR] Error in message listener', err);
        }
      });
    });
  }

  public onMessage(handler: MessageEventHandler): () => void {
    this.messageListeners.add(handler);
    return () => this.messageListeners.delete(handler);
  }

  public onStatusChange(handler: StatusChangeHandler): () => void {
    this.statusListeners.add(handler);
    handler(this.status);
    return () => this.statusListeners.delete(handler);
  }

  public async joinOrder(orderId: string): Promise<void> {
    if (!this.connection || this.status !== 'connected') {
      if (__DEV__) {
        console.warn('[ChatSignalR] Cannot JoinOrder: Not connected');
      }
      return;
    }
    try {
      await this.connection.invoke('JoinOrder', orderId);
      if (__DEV__) {
        console.log(`[ChatSignalR] Joined order chat room: ${orderId}`);
      }
    } catch (err) {
      console.error(`[ChatSignalR] Failed to JoinOrder ${orderId}:`, err);
    }
  }

  public async leaveOrder(orderId: string): Promise<void> {
    if (!this.connection || this.status !== 'connected') return;
    try {
      await this.connection.invoke('LeaveOrder', orderId);
      if (__DEV__) {
        console.log(`[ChatSignalR] Left order chat room: ${orderId}`);
      }
    } catch (err) {
      console.error(`[ChatSignalR] Failed to LeaveOrder ${orderId}:`, err);
    }
  }

  public getConnection(): signalR.HubConnection | null {
    return this.connection;
  }
}

export const chatSignalRService = new ChatSignalRService();

const chatHubLogger: signalR.ILogger = {
  log(logLevel, message) {
    if (!__DEV__ || logLevel === signalR.LogLevel.None) return;

    if (isUnauthorizedMessage(message)) {
      console.info('[ChatSignalR] Stored access token was rejected; attempting session refresh.');
      return;
    }

    if (logLevel >= signalR.LogLevel.Warning) {
      console.warn(`[ChatSignalR] ${message}`);
      return;
    }

    console.log(`[ChatSignalR] ${message}`);
  },
};

function isUnauthorizedSignalRError(error: unknown) {
  return (
    (error instanceof signalR.HttpError && error.statusCode === 401) ||
    (error instanceof Error && isUnauthorizedMessage(error.message))
  );
}

function isUnauthorizedMessage(message: string) {
  return /(?:status\s*code\s*['\"]?401|\b401\b|authentication is required|access token is invalid)/i.test(
    message
  );
}
