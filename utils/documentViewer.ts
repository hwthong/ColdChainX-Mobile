import { API_BASE_URL } from '../services/apiClient';

/**
 * Resolves relative API paths to full absolute asset URLs.
 */
export function getFullDocumentUrl(url?: string | null): string | null {
  if (!url) return null;
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  const assetBaseUrl = API_BASE_URL.replace(/\/api$/i, '');
  return `${assetBaseUrl}${url.startsWith('/') ? '' : '/'}${url}`;
}

/**
 * Fetches an authenticated or public document binary and converts it to a Base64 string.
 */
export async function downloadDocumentAsBase64(
  url: string,
  accessToken?: string | null
): Promise<string> {
  const targetUrl = getFullDocumentUrl(url) || url;
  const headers: Record<string, string> = {
    Accept: 'application/pdf, application/json, */*',
  };

  if (accessToken && !targetUrl.includes('res.cloudinary.com')) {
    headers.Authorization = `Bearer ${accessToken}`;
  }

  const response = await fetch(targetUrl, {
    method: 'GET',
    headers,
  });

  if (!response.ok) {
    let errorMessage = 'Không thể tải file tài liệu.';
    try {
      const errorJson = (await response.json()) as { message?: string; Message?: string };
      errorMessage = errorJson.message ?? errorJson.Message ?? errorMessage;
    } catch {
      if (response.status === 401) {
        errorMessage = 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.';
      } else if (response.status === 403) {
        errorMessage = 'Bạn không có quyền xem tài liệu này.';
      } else if (response.status === 404) {
        errorMessage = 'Không tìm thấy file tài liệu.';
      }
    }
    throw new Error(errorMessage);
  }

  const blob = await response.blob();
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result;
      if (typeof result === 'string') {
        resolve(result);
      } else {
        reject(new Error('Không thể đọc dữ liệu file.'));
      }
    };
    reader.onerror = () => reject(new Error('Lỗi chuyển đổi dữ liệu file.'));
    reader.readAsDataURL(blob);
  });
}
