import React from 'react';
import { Image, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { colors } from '../../../../constants/colors';
import { customerColors } from '../../../../constants/customerTheme';
import { CustomerCard, CustomerSectionHeader } from '../../../../components/customer/ui/CustomerUi';
import type {
  RouteOptionResponse,
  ScheduleOptionDto,
  StopOptionDto,
} from '../../../../services/routeApi';
import type { CreateOrderFormValues, CreateOrderStep } from '../createOrderValidation';
import { getGoodsTypeLabel } from './CargoInformationStep';
import { calculateCbmPreview, getPackagingTypeLabel } from './PackagingImageStep';
import { formatScheduleLabel, getRouteLabel } from './RouteScheduleStep';

type CreateOrderReviewStepProps = {
  values: CreateOrderFormValues;
  selectedRoute: RouteOptionResponse | null;
  selectedSchedule: ScheduleOptionDto | null;
  selectedStop: StopOptionDto | null;
  onEdit: (step: CreateOrderStep) => void;
};

export function CreateOrderReviewStep({
  values,
  selectedRoute,
  selectedSchedule,
  selectedStop,
  onEdit,
}: CreateOrderReviewStepProps) {
  const packagingSummary = values.packagingType.length
    ? values.packagingType.map(getPackagingTypeLabel).join(', ')
    : '—';
  const dimensionsSummary = values.lengthCm && values.widthCm && values.heightCm
    ? `${values.lengthCm} × ${values.widthCm} × ${values.heightCm} cm / kiện`
    : '—';
  const cbmPreview = calculateCbmPreview(values.lengthCm, values.widthCm, values.heightCm, values.quantity);
  const packagingRows: [string, string][] = [
    ['Kích thước mỗi kiện', dimensionsSummary],
  ];
  if (cbmPreview) {
    packagingRows.push(['Tổng thể tích dự kiến', `${cbmPreview.totalLabel} m³`]);
  }
  packagingRows.push(['Ảnh lô hàng', values.documentImage ? '1 ảnh đã chọn' : 'Chưa chọn ảnh']);

  return (
    <View className="gap-4">
      <ReviewSection
        title="Tuyến vận chuyển"
        icon="navigate-outline"
        onEdit={() => onEdit(1)}
        summary={selectedRoute ? getRouteLabel(selectedRoute) : '—'}
        rows={[
          ['Lịch vận chuyển', selectedSchedule ? formatScheduleLabel(selectedSchedule) : '—'],
          ['Điểm giao', selectedStop?.stopName || '—'],
          ['Địa chỉ', values.destAddressText || '—'],
        ]}
      />
      <ReviewSection
        title="Hàng hóa"
        icon="cube-outline"
        onEdit={() => onEdit(2)}
        summary={values.itemName || '—'}
        rows={[
          ['Phân loại', getGoodsTypeLabel(values.category)],
          [
            'Tổng khối lượng & số kiện',
            values.expectedWeightKg && values.quantity
              ? `${values.expectedWeightKg} kg · ${values.quantity} kiện`
              : '—',
          ],
          ['Nhiệt độ bảo quản', `${values.tempCondition}°C`],
        ]}
      />
      <ReviewSection
        title="Đóng gói"
        icon="archive-outline"
        onEdit={() => onEdit(3)}
        summary={packagingSummary}
        rows={packagingRows}
        imageUri={values.documentImage?.uri}
      />
    </View>
  );
}

type ReviewSectionProps = {
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  summary: string;
  rows: [string, string][];
  imageUri?: string;
  onEdit: () => void;
};

function ReviewSection({
  title,
  icon,
  summary,
  rows,
  imageUri,
  onEdit,
}: ReviewSectionProps) {
  return (
    <CustomerCard>
      <CustomerSectionHeader title={title} icon={icon} actionLabel="Sửa" onAction={onEdit} />
      <Text style={{ color: colors.text.primary }} className="mt-4 text-base font-bold leading-6">{summary}</Text>

      <View className="mt-3">
        {rows.map(([label, value]) => (
          <View
            key={label}
            className="flex-row items-start gap-4 py-2.5"
            style={{ borderTopColor: colors.border.default, borderTopWidth: 1 }}
          >
            <Text style={{ color: colors.text.secondary }} className="w-[94px] text-xs font-medium leading-5">{label}</Text>
            <Text style={{ color: colors.text.primary }} className="flex-1 text-right text-sm font-semibold leading-5">{value}</Text>
          </View>
        ))}
        {imageUri ? (
          <Image
            source={{ uri: imageUri }}
            accessibilityLabel="Ảnh lô hàng đã chọn"
            className="mt-1 h-28 w-28 self-end rounded-xl"
            resizeMode="cover"
          />
        ) : null}
      </View>
    </CustomerCard>
  );
}
