import type {
  InboundExpectedPackageLineItem,
  InboundQcPackageLineItem,
} from '../../../services/inboundApi';

export type QcPackageLineField =
  | 'label'
  | 'quantity'
  | 'actualWeightKg'
  | 'lengthCm'
  | 'widthCm'
  | 'heightCm';

export interface QcPackageLineFormValue {
  id: string;
  label: string;
  quantity: string;
  actualWeightKg: string;
  lengthCm: string;
  widthCm: string;
  heightCm: string;
  expectedQuantity?: number;
  expectedCapacityKg?: number;
}

export type QcPackageLineErrors = Partial<Record<Exclude<QcPackageLineField, 'label'>, string>>;

export interface QcMeasurementSummaryValue {
  totalQuantity: number;
  totalWeightKg: number;
  totalCbm: number;
}

export function createEmptyQcPackageLine(id: string): QcPackageLineFormValue {
  return {
    id,
    label: '',
    quantity: '',
    actualWeightKg: '',
    lengthCm: '',
    widthCm: '',
    heightCm: '',
  };
}

export function createQcPackageLinesFromExpected(
  packageLines: InboundExpectedPackageLineItem[],
  createId: () => string
): QcPackageLineFormValue[] {
  if (packageLines.length === 0) return [createEmptyQcPackageLine(createId())];

  return packageLines.map((line) => ({
    ...createEmptyQcPackageLine(createId()),
    label: line.label,
    quantity: String(line.quantity),
    expectedQuantity: line.quantity,
    expectedCapacityKg: line.capacityKg,
  }));
}

export function createQcPackageLinesFromActual(
  packageLines: InboundQcPackageLineItem[],
  createId: () => string
): QcPackageLineFormValue[] {
  if (packageLines.length === 0) return [createEmptyQcPackageLine(createId())];

  return packageLines.map((line) => ({
    id: createId(),
    label: line.label ?? '',
    quantity: formatMeasurementValue(line.quantity),
    actualWeightKg: formatMeasurementValue(line.actualWeightKg),
    lengthCm: formatMeasurementValue(line.lengthCm),
    widthCm: formatMeasurementValue(line.widthCm),
    heightCm: formatMeasurementValue(line.heightCm),
  }));
}

export function validateQcPackageLines(lines: QcPackageLineFormValue[]): QcPackageLineErrors[] {
  return lines.map((line) => {
    const errors: QcPackageLineErrors = {};
    const quantity = parseQcDecimal(line.quantity);

    if (quantity === null || quantity <= 0) {
      errors.quantity = 'Vui lòng nhập số lượng kiện.';
    } else if (!Number.isInteger(quantity)) {
      errors.quantity = 'Số lượng kiện phải là số nguyên.';
    }

    if (!isPositiveQcDecimal(line.actualWeightKg)) {
      errors.actualWeightKg = 'Tổng khối lượng phải lớn hơn 0.';
    }
    if (!isPositiveQcDecimal(line.lengthCm)) {
      errors.lengthCm = 'Chiều dài phải lớn hơn 0.';
    }
    if (!isPositiveQcDecimal(line.widthCm)) {
      errors.widthCm = 'Chiều rộng phải lớn hơn 0.';
    }
    if (!isPositiveQcDecimal(line.heightCm)) {
      errors.heightCm = 'Chiều cao phải lớn hơn 0.';
    }

    return errors;
  });
}

export function hasQcPackageLineErrors(errors: QcPackageLineErrors[]) {
  return errors.some((lineErrors) => Object.keys(lineErrors).length > 0);
}

export function mapQcPackageLinesToPayload(lines: QcPackageLineFormValue[]): InboundQcPackageLineItem[] {
  return lines.map((line) => ({
    ...(line.label.trim() ? { label: line.label.trim() } : {}),
    quantity: requireParsedValue(line.quantity),
    actualWeightKg: requireParsedValue(line.actualWeightKg),
    lengthCm: requireParsedValue(line.lengthCm),
    widthCm: requireParsedValue(line.widthCm),
    heightCm: requireParsedValue(line.heightCm),
  }));
}

export function calculateQcMeasurementSummary(lines: QcPackageLineFormValue[]): QcMeasurementSummaryValue {
  return lines.reduce<QcMeasurementSummaryValue>(
    (summary, line) => {
      const quantity = parseQcDecimal(line.quantity);
      const actualWeightKg = parseQcDecimal(line.actualWeightKg);
      const lengthCm = parseQcDecimal(line.lengthCm);
      const widthCm = parseQcDecimal(line.widthCm);
      const heightCm = parseQcDecimal(line.heightCm);

      if (quantity !== null && Number.isInteger(quantity) && quantity > 0) {
        summary.totalQuantity += quantity;
      }
      if (actualWeightKg !== null && actualWeightKg > 0) {
        summary.totalWeightKg += actualWeightKg;
      }
      if (
        quantity !== null
        && Number.isInteger(quantity)
        && quantity > 0
        && lengthCm !== null
        && lengthCm > 0
        && widthCm !== null
        && widthCm > 0
        && heightCm !== null
        && heightCm > 0
      ) {
        summary.totalCbm = roundToFourDecimals(
          summary.totalCbm + roundToFourDecimals(
            lengthCm * widthCm * heightCm * quantity / 1_000_000
          )
        );
      }

      return summary;
    },
    { totalQuantity: 0, totalWeightKg: 0, totalCbm: 0 }
  );
}

export function parseQcDecimal(value: string) {
  const normalized = value.trim().replace(',', '.');
  if (!normalized) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

export function formatMeasurementValue(value?: number | null) {
  return value === undefined || value === null || !Number.isFinite(value) ? '' : String(value);
}

function isPositiveQcDecimal(value: string) {
  const parsed = parseQcDecimal(value);
  return parsed !== null && parsed > 0;
}

function requireParsedValue(value: string) {
  const parsed = parseQcDecimal(value);
  if (parsed === null) throw new Error('Invalid QC measurement value.');
  return parsed;
}

function roundToFourDecimals(value: number) {
  const factor = 10_000;
  const scaled = value * factor;
  const lowerInteger = Math.floor(scaled);
  const fraction = scaled - lowerInteger;
  const midpointTolerance = Number.EPSILON * Math.max(1, Math.abs(scaled)) * 4;

  if (Math.abs(fraction - 0.5) <= midpointTolerance) {
    return (lowerInteger % 2 === 0 ? lowerInteger : lowerInteger + 1) / factor;
  }

  return Math.round(scaled) / factor;
}
