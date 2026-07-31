import React from 'react';
import { Image, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { customerColors } from '../../../../constants/customerTheme';
import { CustomerCard, CustomerSectionHeader } from '../../../../components/customer/ui/CustomerUi';
import type {
  RouteOptionResponse,
  ScheduleOptionDto,
  StopOptionDto,
} from '../../../../services/routeApi';
import type { CreateOrderFormValues, CreateOrderStep } from '../createOrderValidation';
import { getGoodsTypeLabel } from './CargoInformationStep';
import { getPackagingTypeLabel } from './PackagingImageStep';
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
  return (
    <View className="gap-4">
      <ReviewSection
        title="Tuyến và lịch"
        icon="navigate-outline"
        onEdit={() => onEdit(1)}
        rows={[
          ['Tuyến', selectedRoute ? getRouteLabel(selectedRoute) : '—'],
          ['Lịch', selectedSchedule ? formatScheduleLabel(selectedSchedule) : '—'],
          ['Điểm giao', selectedStop?.stopName || '—'],
          ['Địa chỉ', values.destAddressText || '—'],
        ]}
      />
      <ReviewSection
        title="Hàng hóa"
        icon="cube-outline"
        onEdit={() => onEdit(2)}
        rows={[
          ['Tên hàng', values.itemName || '—'],
          ['Loại hàng', getGoodsTypeLabel(values.category)],
          ['Khối lượng', values.expectedWeightKg ? `${values.expectedWeightKg} kg` : '—'],
          ['Số kiện', values.quantity ? `${values.quantity} kiện` : '—'],
          ['Nhiệt độ', `${values.tempCondition}°C`],
        ]}
      />
      <ReviewSection
        title="Đóng gói và hình ảnh"
        icon="archive-outline"
        onEdit={() => onEdit(3)}
        rows={[
          [
            'Bao bì',
            values.packagingType.length
              ? values.packagingType.map(getPackagingTypeLabel).join(', ')
              : '—',
          ],
          [
            'Kích thước',
            values.lengthCm && values.widthCm && values.heightCm
              ? `${values.lengthCm} × ${values.widthCm} × ${values.heightCm} cm`
              : '—',
          ],
          ['Ảnh lô hàng', values.documentImage ? 'Đã chọn ảnh' : 'Chưa chọn ảnh'],
        ]}
        imageUri={values.documentImage?.uri}
      />
    </View>
  );
}

type ReviewSectionProps = {
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  rows: [string, string][];
  imageUri?: string;
  onEdit: () => void;
};

function ReviewSection({
  title,
  icon,
  rows,
  imageUri,
  onEdit,
}: ReviewSectionProps) {
  return (
    <CustomerCard>
      <CustomerSectionHeader title={title} icon={icon} actionLabel="Chỉnh sửa" onAction={onEdit} />

      <View className="mt-4">
        {rows.map(([label, value], index) => (
          <View
            key={label}
            className="flex-row items-start gap-4 py-2.5"
            style={index > 0 ? { borderTopColor: customerColors.borderSubtle, borderTopWidth: 1 } : undefined}
          >
            <Text className="w-[94px] text-xs font-medium leading-5 text-[#877369]">{label}</Text>
            <Text className="flex-1 text-right text-sm font-semibold leading-5 text-[#3A1F04]">{value}</Text>
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
