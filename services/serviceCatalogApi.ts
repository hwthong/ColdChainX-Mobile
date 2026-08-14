import { apiRequest } from './apiClient';
import { ApiResponse } from './orderApi';

export type ServiceCatalogItem = {
  serviceCatalogId: string;
  serviceCode: string;
  serviceName: string;
  description?: string | null;
  defaultPrice: number;
  isMandatory: boolean;
  isActive: boolean;
};

export function getActiveServiceCatalogs(accessToken: string) {
  return apiRequest<ApiResponse<ServiceCatalogItem[]>>('/api/service-catalogs/active', {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
}
