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
  const finalRequestUrl = `${API_BASE_URL}${normalizedPath}`;
  const method = options.method ?? 'GET';

  const response = await fetch(finalRequestUrl, {
    method,
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...options.headers,
    },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    signal: options.signal,
  }).catch((error: unknown) => {
    console.error('[apiClient] Network request failed', {
      finalRequestUrl,
      method,
      baseUrl: API_BASE_URL,
      hint: 'Check EXPO_PUBLIC_API_BASE_URL. Render free services may sleep, so the first request can be slow.',
      error: error instanceof Error ? error.message : error,
    });

    throw new ApiClientError(
      error instanceof Error
        ? `Không thể kết nối tới máy chủ: ${error.message}`
        : 'Không thể kết nối tới máy chủ'
    );
  });

  const data = await parseResponseBody(response);

  if (!response.ok) {
    throw new ApiClientError(getErrorMessage(data, response.status), response.status, data);
  }

  return data as T;
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
  return path.startsWith('/') ? path : `/${path}`;
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
    const message = getString(data.message);
    if (message) {
      return message;
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
