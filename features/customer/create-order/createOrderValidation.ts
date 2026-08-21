import type { RouteBookingOptionsDto, RouteOptionResponse } from '../../../services/routeApi';
import type { GoongPlaceDetail } from '../../../services/goongPlacesApi';
import {
  isCreateOrderCategory,
  isCreateOrderPackagingType,
  type GoodsType,
} from './createOrderOptions';

export type { GoodsType } from './createOrderOptions';

export const MIN_TEMPERATURE_CELSIUS = -18;
export const MAX_TEMPERATURE_CELSIUS = 5;
export const MAX_CREATE_ORDER_FILE_SIZE_BYTES = 10 * 1024 * 1024;

export type CreateOrderFieldKey =
  | 'itemName'
  | 'category'
  | 'tempCondition'
  | 'expectedWeightKg'
  | 'quantity'
  | 'packageLines'
  | 'packagingType'
  | 'lengthCm'
  | 'widthCm'
  | 'heightCm'
  | 'destAddressText'
  | 'receiverName'
  | 'receiverPhone'
  | 'routeId'
  | 'scheduleId'
  | 'dropoffStopId'
  | 'documentImage'
  | 'legalDocument';

export type CreateOrderValidationErrors = Partial<Record<CreateOrderFieldKey, string>>;
export type CreateOrderStep = 1 | 2 | 3 | 4;
export type CreateOrderValidationMode = 'create' | 'edit';

export const CREATE_ORDER_STEP_FIELDS: Record<Exclude<CreateOrderStep, 4>, CreateOrderFieldKey[]> = {
  1: ['routeId', 'scheduleId', 'dropoffStopId', 'destAddressText', 'receiverName', 'receiverPhone'],
  2: ['itemName', 'category', 'tempCondition', 'packageLines', 'expectedWeightKg', 'quantity'],
  3: ['packagingType', 'lengthCm', 'widthCm', 'heightCm', 'documentImage', 'legalDocument'],
};

export type DocumentImage = {
  uri: string;
  mimeType?: string | null;
  fileName?: string | null;
  size?: number | null;
};

export type OrderPackageLineFormValue = {
  id: string;
  label: string;
  capacityKg: string;
  quantity: string;
};

export type PackageLineValidationErrors = {
  capacityKg?: string;
  quantity?: string;
};

export type CreateOrderFormValues = {
  itemName: string;
  category: GoodsType;
  tempCondition: number;
  expectedWeightKg: string;
  quantity: string;
  packageLines: OrderPackageLineFormValue[];
  packagingType: string[];
  lengthCm: string;
  widthCm: string;
  heightCm: string;
  destAddressText: string;
  destinationLocation: GoongPlaceDetail | null;
  receiverName: string;
  receiverPhone: string;
  routeId: string;
  scheduleId: string;
  dropoffStopId: string;
  documentImage: DocumentImage | null;
  legalDocument: DocumentImage | null;
};

const INITIAL_CREATE_ORDER_VALUES: Omit<
  CreateOrderFormValues,
  | 'routeId'
  | 'scheduleId'
  | 'dropoffStopId'
  | 'documentImage'
  | 'legalDocument'
  | 'packageLines'
  | 'destinationLocation'
> = {
  itemName: '',
  category: 'FROZEN_FRUITS_VEGGIES',
  tempCondition: -6,
  expectedWeightKg: '',
  quantity: '1',
  packagingType: [],
  lengthCm: '',
  widthCm: '',
  heightCm: '',
  destAddressText: '',
  receiverName: '',
  receiverPhone: '',
};

export function createEmptyPackageLine(id: string): OrderPackageLineFormValue {
  return { id, label: '', capacityKg: '', quantity: '' };
}

export function isCreateOrderFormDirty(values: CreateOrderFormValues) {
  const packageLinesAreDirty = values.packageLines.length !== 1
    || values.packageLines.some((line) => Boolean(line.label || line.capacityKg || line.quantity));

  return (
    values.itemName !== INITIAL_CREATE_ORDER_VALUES.itemName ||
    values.category !== INITIAL_CREATE_ORDER_VALUES.category ||
    values.tempCondition !== INITIAL_CREATE_ORDER_VALUES.tempCondition ||
    values.expectedWeightKg !== INITIAL_CREATE_ORDER_VALUES.expectedWeightKg ||
    values.quantity !== INITIAL_CREATE_ORDER_VALUES.quantity ||
    packageLinesAreDirty ||
    values.packagingType.length > 0 ||
    values.lengthCm !== INITIAL_CREATE_ORDER_VALUES.lengthCm ||
    values.widthCm !== INITIAL_CREATE_ORDER_VALUES.widthCm ||
    values.heightCm !== INITIAL_CREATE_ORDER_VALUES.heightCm ||
    values.destAddressText !== INITIAL_CREATE_ORDER_VALUES.destAddressText ||
    Boolean(values.destinationLocation) ||
    values.receiverName !== INITIAL_CREATE_ORDER_VALUES.receiverName ||
    values.receiverPhone !== INITIAL_CREATE_ORDER_VALUES.receiverPhone ||
    Boolean(
      values.routeId ||
      values.scheduleId ||
      values.dropoffStopId ||
      values.documentImage ||
      values.legalDocument
    )
  );
}

const REQUIRED_ERROR = 'Vui lòng nhập thông tin này.';

export function isValidPhoneNumber(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > 20) return false;
  const digits = trimmed.replace(/\D/g, '');
  if (digits.length < 8 || digits.length > 15) return false;
  return /^[0-9+\-\s()]+$/.test(trimmed);
}

export function getPackageLineValidationErrors(
  packageLines: OrderPackageLineFormValue[]
): PackageLineValidationErrors[] {
  return packageLines.map((line) => {
    const lineErrors: PackageLineValidationErrors = {};
    if (!isPositiveNumber(line.capacityKg)) {
      lineErrors.capacityKg = 'Khối lượng mỗi kiện phải lớn hơn 0.';
    }
    if (!isPositiveInteger(line.quantity)) {
      lineErrors.quantity = 'Số lượng phải là số nguyên từ 1 trở lên.';
    }
    return lineErrors;
  });
}

export function calculatePackageLineSummary(packageLines: OrderPackageLineFormValue[]) {
  return packageLines.reduce(
    (summary, line) => {
      const capacityKg = parseCreateOrderDecimal(line.capacityKg);
      const quantity = Number(line.quantity.trim());
      if (Number.isFinite(capacityKg) && capacityKg > 0 && Number.isInteger(quantity) && quantity > 0) {
        summary.totalQuantity += quantity;
        summary.totalWeightKg += capacityKg * quantity;
      }
      return summary;
    },
    { totalQuantity: 0, totalWeightKg: 0 }
  );
}

export function validateCreateOrderForm(
  values: CreateOrderFormValues,
  activeRoutes: RouteOptionResponse[],
  bookingOptions: RouteBookingOptionsDto | null,
  mode: CreateOrderValidationMode = 'create'
): CreateOrderValidationErrors {
  const errors: CreateOrderValidationErrors = {};

  if (!values.itemName.trim()) {
    errors.itemName = REQUIRED_ERROR;
  } else if (values.itemName.trim().length > 255) {
    errors.itemName = 'Tên mặt hàng không được vượt quá 255 ký tự.';
  }
  if (!isCreateOrderCategory(values.category)) {
    errors.category = 'Vui lòng chọn phân loại hàng hóa hợp lệ.';
  }
  if (
    !Number.isFinite(values.tempCondition) ||
    values.tempCondition < MIN_TEMPERATURE_CELSIUS ||
    values.tempCondition > MAX_TEMPERATURE_CELSIUS
  ) {
    errors.tempCondition = 'Nhiệt độ phải nằm trong khoảng -18°C đến 5°C.';
  }

  if (mode === 'create') {
    const packageLineErrors = getPackageLineValidationErrors(values.packageLines);
    if (
      values.packageLines.length === 0 ||
      packageLineErrors.some((lineErrors) => Boolean(lineErrors.capacityKg || lineErrors.quantity))
    ) {
      errors.packageLines = 'Vui lòng kiểm tra lại quy cách đóng gói.';
    }
  } else {
    if (!isPositiveNumber(values.expectedWeightKg)) {
      errors.expectedWeightKg = 'Khối lượng phải lớn hơn 0.';
    }
    if (!isPositiveInteger(values.quantity)) {
      errors.quantity = 'Số lượng kiện phải từ 1 trở lên.';
    }
  }

  if (
    values.packagingType.length === 0 ||
    values.packagingType.some((packagingType) => !isCreateOrderPackagingType(packagingType))
  ) {
    errors.packagingType = 'Vui lòng chọn loại bao bì đóng gói hợp lệ.';
  }

  if (mode === 'edit' && (values.lengthCm || values.widthCm || values.heightCm)) {
    if (!isPositiveNumber(values.lengthCm)) errors.lengthCm = 'Chiều dài phải lớn hơn 0.';
    if (!isPositiveNumber(values.widthCm)) errors.widthCm = 'Chiều rộng phải lớn hơn 0.';
    if (!isPositiveNumber(values.heightCm)) errors.heightCm = 'Chiều cao phải lớn hơn 0.';
  }

  const destinationAddress = values.destAddressText.trim();
  if (!values.destinationLocation || !hasValidCoordinates(values.destinationLocation)) {
    errors.destAddressText = 'Vui lòng chọn và xác nhận điểm giao hàng.';
  } else if (destinationAddress.length < 5) {
    errors.destAddressText = 'Địa chỉ giao hàng cần ít nhất 5 ký tự.';
  } else if (destinationAddress.length > 500) {
    errors.destAddressText = 'Địa chỉ giao hàng không được vượt quá 500 ký tự.';
  }

  if (!values.receiverName.trim()) {
    errors.receiverName = 'Vui lòng nhập họ tên người nhận.';
  } else if (values.receiverName.trim().length > 100) {
    errors.receiverName = 'Họ tên người nhận không được vượt quá 100 ký tự.';
  }

  if (!values.receiverPhone.trim()) {
    errors.receiverPhone = 'Vui lòng nhập số điện thoại người nhận.';
  } else if (!isValidPhoneNumber(values.receiverPhone)) {
    errors.receiverPhone = 'Vui lòng nhập số điện thoại từ 8–15 chữ số.';
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
  } else if (
    !hasCurrentBookingOptions ||
    !bookingOptions.availableSchedules.some((schedule) => schedule.scheduleId === values.scheduleId)
  ) {
    errors.scheduleId = 'Lịch vận chuyển không còn khả dụng.';
  }

  if (!values.dropoffStopId) {
    errors.dropoffStopId = 'Vui lòng chọn điểm giao hàng.';
  } else if (
    !hasCurrentBookingOptions ||
    !bookingOptions.availableStops.some((stop) => stop.stopId === values.dropoffStopId)
  ) {
    errors.dropoffStopId = 'Điểm giao hàng không hợp lệ.';
  }

  if (mode === 'create' && !values.documentImage) {
    errors.documentImage = 'Vui lòng chọn ảnh lô hàng.';
  } else if (values.documentImage && !isValidSelectedFile(values.documentImage)) {
    errors.documentImage = 'Ảnh lô hàng phải có dung lượng từ 1 byte đến 10 MB.';
  }

  if (mode === 'create' && !values.legalDocument) {
    errors.legalDocument = 'Vui lòng chọn chứng từ hàng hóa.';
  } else if (values.legalDocument && !isValidSelectedFile(values.legalDocument)) {
    errors.legalDocument = 'Chứng từ phải có dung lượng từ 1 byte đến 10 MB.';
  }

  return errors;
}

export function validateCreateOrderStep(
  step: Exclude<CreateOrderStep, 4>,
  values: CreateOrderFormValues,
  activeRoutes: RouteOptionResponse[],
  bookingOptions: RouteBookingOptionsDto | null,
  mode: CreateOrderValidationMode = 'create'
): CreateOrderValidationErrors {
  const allErrors = validateCreateOrderForm(values, activeRoutes, bookingOptions, mode);
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

function isValidSelectedFile(file: DocumentImage) {
  if (!file.uri) return false;
  if (file.size === undefined || file.size === null) return true;
  return file.size > 0 && file.size <= MAX_CREATE_ORDER_FILE_SIZE_BYTES;
}

function hasValidCoordinates(location: GoongPlaceDetail) {
  return Number.isFinite(location.latitude)
    && location.latitude >= -90
    && location.latitude <= 90
    && Number.isFinite(location.longitude)
    && location.longitude >= -180
    && location.longitude <= 180
    && !(location.latitude === 0 && location.longitude === 0);
}
