import type { CreateOrderPayload } from '../../../services/orderApi';
import { parseCreateOrderDecimal, type CreateOrderFormValues, type DocumentImage } from './createOrderValidation';

export function mapCreateOrderRequest(
  values: CreateOrderFormValues & { documentImage: DocumentImage; legalDocument: DocumentImage }
): CreateOrderPayload {
  return {
    itemName: values.itemName.trim(),
    category: values.category,
    tempCondition: values.tempCondition,
    packagingType: values.packagingType.join(', '),
    destAddressText: values.destAddressText.trim(),
    receiverName: values.receiverName.trim(),
    receiverPhone: values.receiverPhone.trim(),
    scheduleId: values.scheduleId,
    dropoffStopId: values.dropoffStopId,
    hasStrongOdor: false,
    isStackable: true,
    packageLines: values.packageLines.map((line) => ({
      ...(line.label.trim() ? { label: line.label.trim() } : {}),
      capacityKg: parseCreateOrderDecimal(line.capacityKg),
      quantity: Number.parseInt(line.quantity, 10),
    })),
    cargoPhotos: [mapSelectedFile(values.documentImage, 'image/jpeg', 'cargo.jpg')],
    legalDocuments: [mapSelectedFile(values.legalDocument, 'application/octet-stream', 'legal-document')],
  };
}

function mapSelectedFile(file: DocumentImage, fallbackMimeType: string, fallbackFileName: string) {
  return {
    uri: file.uri,
    mimeType: file.mimeType || fallbackMimeType,
    fileName: file.fileName || fallbackFileName,
  };
}
