import { API_BASE_URL, apiRequest } from './apiClient';
import { useAuthStore } from '../store/useAuthStore';

export interface ContractInfoResponse {
  contractId: string;
  orderId: string;
  contractNumber: string;
  fileUrl?: string | null;
  signedFileUrl?: string | null;
  sentAt?: string | null;
  uploadedSignedAt?: string | null;
  verifiedAt?: string | null;
  status: string;
}

export interface UploadSignedContractResponse {
  contractId: string;
  orderId: string;
  contractNumber: string;
  signedFileUrl?: string | null;
  uploadedSignedAt?: string | null;
  status: string;
}

export interface SignedContractFile {
  uri: string;
  name?: string;
  type?: string;
  mimeType?: string;
}

interface ApiResponse<T> {
  success: boolean;
  message?: string | null;
  data?: T | null;
}

export function getContractByOrder(accessToken: string, orderId: string) {
  return apiRequest<ApiResponse<ContractInfoResponse>>(`/api/contracts/by-order/${orderId}`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
}

export async function uploadSignedContract(contractId: string, file: SignedContractFile) {
  const token = useAuthStore.getState().token;

  if (!token) {
    throw new Error('Missing authentication token. Please login again.');
  }

  const formData = new FormData();

  formData.append('SignedFile', {
    uri: file.uri,
    name: file.name || 'signed-contract.pdf',
    type: file.mimeType || file.type || 'application/pdf',
  } as any);

  const uploadUrl = buildApiUrl(`/api/contracts/${contractId}/upload-signed`);

  if (__DEV__) {
    console.log('Upload contractId:', contractId);
    console.log('Has token:', !!token);
    console.log('File:', file);
    console.log('Upload URL:', uploadUrl);
  }

  const response = await fetch(uploadUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: formData,
  });

  const text = await response.text();

  if (!response.ok) {
    throw new Error(`Upload signed contract failed (${response.status}): ${text || response.statusText}`);
  }

  return (text ? JSON.parse(text) : null) as ApiResponse<UploadSignedContractResponse>;
}

function buildApiUrl(path: string) {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;

  if (API_BASE_URL.toLowerCase().endsWith('/api') && normalizedPath.toLowerCase().startsWith('/api/')) {
    return `${API_BASE_URL}${normalizedPath.slice(4)}`;
  }

  return `${API_BASE_URL}${normalizedPath}`;
}
