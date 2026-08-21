export const CREATE_ORDER_CATEGORY_OPTIONS = [
  { label: 'Thịt & Hải sản', value: 'MEAT_SEAFOOD' },
  { label: 'Trái cây & Rau củ', value: 'FRUITS_VEGGIES' },
  { label: 'Rau củ quả đông lạnh', value: 'FROZEN_FRUITS_VEGGIES' },
  { label: 'Kem & Đồ uống', value: 'ICE_CREAM_BEVERAGES' },
  { label: 'Dược phẩm', value: 'PHARMACEUTICALS' },
  { label: 'Nguyên liệu & Hàng khác', value: 'RAW_MATERIALS_OTHERS' },
] as const;

export type GoodsType = (typeof CREATE_ORDER_CATEGORY_OPTIONS)[number]['value'];

export const CREATE_ORDER_PACKAGING_OPTIONS = [
  { label: 'Thùng carton', value: 'Carton Box' },
  { label: 'Thùng xốp giữ nhiệt', value: 'Foam Box' },
  { label: 'Thùng nhựa', value: 'Plastic Box' },
  { label: 'Pallet', value: 'Pallet' },
  { label: 'Thùng', value: 'Thùng' },
  { label: 'Bao', value: 'Bao' },
] as const;

export type CreateOrderPackagingType = (typeof CREATE_ORDER_PACKAGING_OPTIONS)[number]['value'];

export function isCreateOrderCategory(value: string): value is GoodsType {
  return CREATE_ORDER_CATEGORY_OPTIONS.some((option) => option.value === value);
}

export function isCreateOrderPackagingType(value: string): value is CreateOrderPackagingType {
  return CREATE_ORDER_PACKAGING_OPTIONS.some((option) => option.value === value);
}

export function getCreateOrderCategoryLabel(value: GoodsType): string {
  return CREATE_ORDER_CATEGORY_OPTIONS.find((option) => option.value === value)?.label ?? value;
}

export function getCreateOrderPackagingLabel(value: string): string {
  return CREATE_ORDER_PACKAGING_OPTIONS.find((option) => option.value === value)?.label ?? value;
}
