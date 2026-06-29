const DEFAULT_API_BASE_URL = 'https://coldchainx.onrender.com';

export const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_BASE_URL?.trim().replace(/\/+$/, '') || DEFAULT_API_BASE_URL;

type ApiRequestOptions = {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  headers?: Record<string, string>;
  signal?: AbortSignal;
};

export class ApiClientError extends Error {
  status?: number;
  data?: unknown;

  constructor(message: string, status?: number, data?: unknown) {
    super(message);
    this.name = 'ApiClientError';
    this.status = status;
    this.data = data;
  }
}

export async function apiRequest<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
  const normalizedPath = normalizePath(path);
  const finalRequestUrl = buildApiUrl(normalizedPath);
  const method = options.method ?? 'GET';

  const isFormData = options.body instanceof FormData;
  const requestHeaders: Record<string, string> = {
    Accept: 'application/json',
    ...options.headers,
  };

  if (!isFormData && !requestHeaders['Content-Type']) {
    requestHeaders['Content-Type'] = 'application/json';
  }

  const requestBody = isFormData
    ? (options.body as BodyInit)
    : options.body === undefined
      ? undefined
      : JSON.stringify(options.body);

  if (__DEV__) {
    console.log('[apiClient] Request details:', {
      baseUrl: API_BASE_URL,
      endpoint: normalizedPath,
      finalRequestUrl,
      method,
    });
  }

  const response = await fetch(finalRequestUrl, {
    method,
    headers: requestHeaders,
    body: requestBody,
    signal: options.signal,
  }).catch((error: unknown) => {
    console.error('[apiClient] Network request failed', {
      finalRequestUrl,
      method,
      baseUrl: API_BASE_URL,
      hint: 'Cannot reach backend. Check EXPO_PUBLIC_API_BASE_URL or wait for the Render server to wake up.',
      error: error instanceof Error ? error.message : error,
    });

    throw new ApiClientError(
      error instanceof Error
        ? `Cannot reach backend. Check EXPO_PUBLIC_API_BASE_URL or wait for the Render server to wake up. (${error.message})`
        : 'Cannot reach backend. Check EXPO_PUBLIC_API_BASE_URL or wait for the Render server to wake up.'
    );
  });

  const data = await parseResponseBody(response);

  if (!response.ok) {
    throw new ApiClientError(getErrorMessage(data, response.status), response.status, data);
  }

  return data as T;
}

export function buildApiUrl(path: string) {
  return `${API_BASE_URL}${normalizePath(path)}`;
}

export function getApiErrorMessage(error: unknown): string {
  if (error instanceof ApiClientError) {
    return error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return 'Đã có lỗi xảy ra. Vui lòng thử lại.';
}

function normalizePath(path: string) {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;

  if (API_BASE_URL.toLowerCase().endsWith('/api') && normalizedPath.toLowerCase().startsWith('/api/')) {
    return normalizedPath.slice(4);
  }

  return normalizedPath;
}

async function parseResponseBody(response: Response): Promise<unknown> {
  const bodyText = await response.text();

  if (!bodyText) {
    return null;
  }

  const contentType = response.headers.get('content-type') ?? '';
  if (contentType.includes('application/json')) {
    try {
      return JSON.parse(bodyText);
    } catch {
      return bodyText;
    }
  }

  try {
    return JSON.parse(bodyText);
  } catch {
    return bodyText;
  }
}

function getErrorMessage(data: unknown, status: number): string {
  if (typeof data === 'string' && data.trim()) {
    return data;
  }

  if (isRecord(data)) {
    const rawMessage = getString(data.message) || getString(data.Message) || getString(data.error) || getString(data.Error);
    if (rawMessage) {
      if (rawMessage.includes('ContractAppendixTemplate.html was not found')) {
        return 'Không thể tạo phụ lục điều chỉnh do thiếu mẫu hợp đồng trên server. Vui lòng báo kỹ thuật kiểm tra ContractAppendixTemplate.html.';
      }
      if (rawMessage.toLowerCase().includes('discrepancy')) {
        return 'Lô hàng có sai lệch so với khai báo ban đầu. Hệ thống đã chuyển sang trạng thái chờ xử lý sai lệch.';
      }
      return rawMessage;
    }

    const title = getString(data.title);
    const validationMessage = getValidationMessage(data.errors);
    if (validationMessage) {
      return validationMessage;
    }

    if (title) {
      return title;
    }
  }

  if (status === 500) {
    return 'Hệ thống đang gặp lỗi khi xử lý yêu cầu. Vui lòng thử lại hoặc báo kỹ thuật.';
  }

  return `Yêu cầu thất bại (${status}). Vui lòng thử lại.`;
}

function getValidationMessage(errors: unknown): string | null {
  if (!isRecord(errors)) {
    return null;
  }

  const messages = Object.values(errors)
    .flatMap((value) => (Array.isArray(value) ? value : [value]))
    .filter((value): value is string => typeof value === 'string' && value.trim().length > 0);

  return messages.length > 0 ? messages.join('\n') : null;
}

function getString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
