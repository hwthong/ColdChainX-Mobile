export type ReturnWarehouse = {
  warehouseId: string;
  warehouseCode: string;
  warehouseName: string;
  address: string;
  distanceKm: string;
  estimatedTravelTimeMinutes: number;
  status: string;
};

export type NearestReturnWarehousesResponse = {
  totalWarehouses: number;
  warehouses: ReturnWarehouse[];
  message?: string;
};

type UnknownRecord = Record<string, unknown>;

function asRecord(value: unknown): UnknownRecord {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as UnknownRecord
    : {};
}

function firstValue(record: UnknownRecord, keys: string[]): unknown {
  for (const key of keys) {
    const value = record[key];
    if (value !== undefined && value !== null) return value;
  }
  return undefined;
}

function asText(value: unknown): string {
  return value === undefined || value === null ? '' : String(value).trim();
}

function asFiniteNumber(value: unknown): number {
  const numberValue = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(numberValue) ? numberValue : 0;
}

export function normalizeReturnWarehouse(value: unknown): ReturnWarehouse | null {
  const record = asRecord(value);
  const warehouseId = asText(firstValue(record, [
    'warehouseId',
    'WarehouseId',
    'id',
    'Id',
  ]));

  // Kho không có ID không thể dùng cho POST /api/Delivery/depart.
  if (!warehouseId) return null;

  return {
    warehouseId,
    warehouseCode: asText(firstValue(record, ['warehouseCode', 'WarehouseCode', 'code', 'Code'])),
    warehouseName: asText(firstValue(record, ['warehouseName', 'WarehouseName', 'name', 'Name'])) || 'Kho trả hàng',
    address: asText(firstValue(record, ['address', 'Address'])) || 'Chưa cập nhật địa chỉ',
    distanceKm: asText(firstValue(record, ['distanceKm', 'DistanceKm'])) || '0 km',
    estimatedTravelTimeMinutes: asFiniteNumber(firstValue(record, [
      'estimatedTravelTimeMinutes',
      'EstimatedTravelTimeMinutes',
    ])),
    status: asText(firstValue(record, ['status', 'Status'])) || 'ACTIVE',
  };
}

export function normalizeNearestReturnWarehouses(value: unknown): NearestReturnWarehousesResponse {
  const record = asRecord(value);
  const rawWarehouses = firstValue(record, ['warehouses', 'Warehouses']);
  const warehouses = (Array.isArray(rawWarehouses) ? rawWarehouses : [])
    .map(normalizeReturnWarehouse)
    .filter((warehouse): warehouse is ReturnWarehouse => warehouse !== null);
  const totalValue = firstValue(record, ['totalWarehouses', 'TotalWarehouses']);

  return {
    totalWarehouses: Math.max(asFiniteNumber(totalValue), warehouses.length),
    warehouses,
    message: asText(firstValue(record, ['message', 'Message'])) || undefined,
  };
}
