import type { GoodsType } from '../../../components/GoodsTypeSelector';
import type { RouteBookingOptionsDto, RouteOptionResponse } from '../../../services/routeApi';

export const MIN_TEMPERATURE_CELSIUS = -18;
export const MAX_TEMPERATURE_CELSIUS = -5;

export type CreateOrderFieldKey =
  | 'itemName'
  | 'category'
  | 'tempCondition'
  | 'expectedWeightKg'
  | 'quantity'
  | 'packagingType'
  | 'lengthCm'
  | 'widthCm'
  | 'heightCm'
  | 'destAddressText'
  | 'routeId'
  | 'scheduleId'
  | 'dropoffStopId'
  | 'documentImage';

export type CreateOrderValidationErrors = Partial<Record<CreateOrderFieldKey, string>>;
export type CreateOrderStep = 1 | 2 | 3 | 4;

export const CREATE_ORDER_STEP_FIELDS: Record<Exclude<CreateOrderStep, 4>, CreateOrderFieldKey[]> = {
  1: ['routeId', 'scheduleId', 'dropoffStopId', 'destAddressText'],
  2: ['itemName', 'category', 'tempCondition', 'expectedWeightKg', 'quantity'],
  3: ['packagingType', 'lengthCm', 'widthCm', 'heightCm', 'documentImage'],
};

export type DocumentImage = {
  uri: string;
  mimeType?: string | null;
  fileName?: string | null;
};

export type CreateOrderFormValues = {
  itemName: string;
  category: GoodsType;
  tempCondition: number;
  expectedWeightKg: string;
  quantity: string;
  packagingType: string[];
  lengthCm: string;
  widthCm: string;
  heightCm: string;
  destAddressText: string;
  routeId: string;
  scheduleId: string;
  dropoffStopId: string;
  documentImage: DocumentImage | null;
};

const REQUIRED_ERROR = 'Vui lòng nhập thông tin này.';
const SUPPORTED_CATEGORIES: GoodsType[] = [
  'MEAT_SEAFOOD',
  'FROZEN_FRUITS_VEGGIES',
  'PHARMACEUTICALS',
];

export function validateCreateOrderForm(
  values: CreateOrderFormValues,
  activeRoutes: RouteOptionResponse[],
  bookingOptions: RouteBookingOptionsDto | null
): CreateOrderValidationErrors {
  const errors: CreateOrderValidationErrors = {};

  if (!values.itemName.trim()) errors.itemName = REQUIRED_ERROR;
  if (!SUPPORTED_CATEGORIES.includes(values.category)) {
    errors.category = 'Vui lòng chọn phân loại hàng hóa hợp lệ.';
  }
  if (
    !Number.isFinite(values.tempCondition) ||
    values.tempCondition < MIN_TEMPERATURE_CELSIUS ||
    values.tempCondition > MAX_TEMPERATURE_CELSIUS
  ) {
    errors.tempCondition = 'Nhiệt độ phải nằm trong khoảng -18°C đến -5°C.';
  }
  if (!isPositiveNumber(values.expectedWeightKg)) errors.expectedWeightKg = 'Khối lượng phải lớn hơn 0.';
  if (!isPositiveInteger(values.quantity)) errors.quantity = 'Số lượng kiện phải từ 1 trở lên.';
  if (values.packagingType.length === 0) {
    errors.packagingType = 'Vui lòng chọn ít nhất một loại bao bì đóng gói.';
  }
  if (!isPositiveNumber(values.lengthCm)) errors.lengthCm = 'Chiều dài phải lớn hơn 0.';
  if (!isPositiveNumber(values.widthCm)) errors.widthCm = 'Chiều rộng phải lớn hơn 0.';
  if (!isPositiveNumber(values.heightCm)) errors.heightCm = 'Chiều cao phải lớn hơn 0.';
  if (values.destAddressText.trim().length < 5) {
    errors.destAddressText = 'Địa chỉ giao hàng cần ít nhất 5 ký tự.';
  }

  const selectedRouteIsActive = activeRoutes.some((route) => route.routeId === values.routeId);
  if (!values.routeId) {
    errors.routeId = 'Vui lòng chọn tuyến vận chuyển.';
  } else if (!selectedRouteIsActive) {
    errors.routeId = 'Tuyến vận chuyển hiện không khả dụng.';
  }

  const hasCurrentBookingOptions = bookingOptions?.routeId === values.routeId;
  if (!values.scheduleId) {
    errors.scheduleId = 'Vui lòng chọn lịch vận chuyển.';
  } else if (!hasCurrentBookingOptions || !bookingOptions.availableSchedules.some((schedule) => schedule.scheduleId === values.scheduleId)) {
    errors.scheduleId = 'Lịch vận chuyển không còn khả dụng.';
  }

  if (!values.dropoffStopId) {
    errors.dropoffStopId = 'Vui lòng chọn điểm giao hàng.';
  } else if (!hasCurrentBookingOptions || !bookingOptions.availableStops.some((stop) => stop.stopId === values.dropoffStopId)) {
    errors.dropoffStopId = 'Điểm giao hàng không hợp lệ.';
  }

  if (!values.documentImage) errors.documentImage = 'Vui lòng chọn ảnh lô hàng.';

  return errors;
}

export function validateCreateOrderStep(
  step: Exclude<CreateOrderStep, 4>,
  values: CreateOrderFormValues,
  activeRoutes: RouteOptionResponse[],
  bookingOptions: RouteBookingOptionsDto | null
): CreateOrderValidationErrors {
  const allErrors = validateCreateOrderForm(values, activeRoutes, bookingOptions);
  const stepErrors: CreateOrderValidationErrors = {};

  CREATE_ORDER_STEP_FIELDS[step].forEach((field) => {
    if (allErrors[field]) stepErrors[field] = allErrors[field];
  });

  return stepErrors;
}

export function parseCreateOrderDecimal(value: string) {
  return Number(value.trim().replace(',', '.'));
}

function isPositiveNumber(value: string) {
  const parsed = parseCreateOrderDecimal(value);
  return Number.isFinite(parsed) && parsed > 0;
}

function isPositiveInteger(value: string) {
  const parsed = Number(value.trim());
  return Number.isInteger(parsed) && parsed >= 1;
}
