import React from 'react';
import { Image, Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

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
        title="Hàng hóa và đóng gói"
        icon="cube-outline"
        onEdit={() => onEdit(2)}
        secondaryEditLabel="Sửa đóng gói"
        onSecondaryEdit={() => onEdit(3)}
        rows={[
          ['Tên hàng', values.itemName || '—'],
          ['Loại hàng', getGoodsTypeLabel(values.category)],
          ['Khối lượng', values.expectedWeightKg ? `${values.expectedWeightKg} kg` : '—'],
          ['Số kiện', values.quantity ? `${values.quantity} kiện` : '—'],
          ['Nhiệt độ', `${values.tempCondition}°C`],
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
  secondaryEditLabel?: string;
  onSecondaryEdit?: () => void;
};

function ReviewSection({
  title,
  icon,
  rows,
  imageUri,
  onEdit,
  secondaryEditLabel,
  onSecondaryEdit,
}: ReviewSectionProps) {
  return (
    <View className="rounded-2xl border border-[#DAC2B6]/50 bg-white p-5">
      <View className="flex-row items-center justify-between gap-3 border-b border-[#DAC2B6]/30 pb-3">
        <View className="flex-1 flex-row items-center gap-2">
          <Ionicons name={icon} size={18} color="#8B4513" />
          <Text className="flex-1 text-base font-bold text-[#3A1F04]">{title}</Text>
        </View>
        <Pressable
          onPress={onEdit}
          accessibilityRole="button"
          accessibilityLabel={`Chỉnh sửa ${title.toLowerCase()}`}
          className="min-h-11 justify-center px-2"
        >
          <Text className="text-sm font-bold text-[#8B4513]">Chỉnh sửa</Text>
        </Pressable>
      </View>

      <View className="mt-4 gap-3">
        {rows.map(([label, value]) => (
          <View key={label} className="flex-row items-start gap-4">
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

      {secondaryEditLabel && onSecondaryEdit ? (
        <Pressable
          onPress={onSecondaryEdit}
          accessibilityRole="button"
          accessibilityLabel="Chỉnh sửa thông tin đóng gói và hình ảnh"
          className="mt-4 min-h-11 items-center justify-center rounded-xl bg-[#F8F3EF] px-4"
        >
          <Text className="text-sm font-bold text-[#8B4513]">{secondaryEditLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}
