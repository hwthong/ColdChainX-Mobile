import { create } from 'zustand';

type DriverReturnState = {
  selectedWarehouseIds: Record<string, string>;
  selectWarehouse: (tripId: string, warehouseId: string) => void;
  clearWarehouse: (tripId: string) => void;
};

export const useDriverReturnStore = create<DriverReturnState>((set) => ({
  selectedWarehouseIds: {},
  selectWarehouse: (tripId, warehouseId) => set((state) => ({
    selectedWarehouseIds: {
      ...state.selectedWarehouseIds,
      [tripId]: warehouseId,
    },
  })),
  clearWarehouse: (tripId) => set((state) => {
    const selectedWarehouseIds = { ...state.selectedWarehouseIds };
    delete selectedWarehouseIds[tripId];
    return { selectedWarehouseIds };
  }),
}));
