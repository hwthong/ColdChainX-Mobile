import assert from 'node:assert/strict';
import test from 'node:test';

import { normalizeNearestReturnWarehouses } from '../returnWarehouse';

test('normalizes PascalCase warehouse payload so the selected ID is available', () => {
  const result = normalizeNearestReturnWarehouses({
    TotalWarehouses: 1,
    Warehouses: [{
      WarehouseId: 'warehouse-01',
      WarehouseCode: 'WH-01',
      WarehouseName: 'Kho Cần Thơ 01',
      Address: '106 Hai Bà Trưng, Cần Thơ',
      DistanceKm: '1.5 km',
      EstimatedTravelTimeMinutes: 3,
      Status: 'ACTIVE',
    }],
  });

  assert.equal(result.warehouses[0]?.warehouseId, 'warehouse-01');
  assert.equal(result.warehouses[0]?.warehouseName, 'Kho Cần Thơ 01');
});

test('supports generic Id and Name fields and removes warehouses without an ID', () => {
  const result = normalizeNearestReturnWarehouses({
    warehouses: [
      { Id: 'warehouse-02', Name: 'Hub Can Tho', DistanceKm: 2.94 },
      { warehouseName: 'Kho thiếu ID' },
    ],
  });

  assert.equal(result.warehouses.length, 1);
  assert.equal(result.warehouses[0]?.warehouseId, 'warehouse-02');
  assert.equal(result.warehouses[0]?.distanceKm, '2.94');
});
