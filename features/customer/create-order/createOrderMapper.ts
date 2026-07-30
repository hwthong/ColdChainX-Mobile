import type { CreateOrderPayload } from '../../../services/orderApi';
import { parseCreateOrderDecimal, type CreateOrderFormValues, type DocumentImage } from './createOrderValidation';

export function mapCreateOrderRequest(
  values: CreateOrderFormValues & { documentImage: DocumentImage }
): CreateOrderPayload {
  return {
    itemName: values.itemName.trim(),
    category: values.category,
    tempCondition: values.tempCondition,
    expectedWeightKg: parseCreateOrderDecimal(values.expectedWeightKg),
    quantity: Number.parseInt(values.quantity, 10),
    packagingType: values.packagingType.join(', '),
    lengthCm: parseCreateOrderDecimal(values.lengthCm),
    widthCm: parseCreateOrderDecimal(values.widthCm),
    heightCm: parseCreateOrderDecimal(values.heightCm),
    destAddressText: values.destAddressText.trim(),
    scheduleId: values.scheduleId,
    dropoffStopId: values.dropoffStopId,
    cargoPhoto: {
      uri: values.documentImage.uri,
      mimeType: values.documentImage.mimeType || 'image/jpeg',
      fileName: values.documentImage.fileName || 'cargo.jpg',
    },
  };
}
