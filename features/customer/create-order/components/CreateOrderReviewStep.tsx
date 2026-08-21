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
import {
  calculatePackageLineSummary,
  type CreateOrderFormValues,
  type CreateOrderStep,
} from '../createOrderValidation';
import { getGoodsTypeLabel } from './CargoInformationStep';
import { getPackagingTypeLabel } from './PackagingImageStep';
import { formatScheduleLabel, getRouteLabel } from './RouteScheduleStep';

type CreateOrderReviewStepProps = {
  isEditMode: boolean;
  values: CreateOrderFormValues;
  selectedRoute: RouteOptionResponse | null;
  selectedSchedule: ScheduleOptionDto | null;
  selectedStop: StopOptionDto | null;
  onEdit: (step: CreateOrderStep) => void;
};

export function CreateOrderReviewStep({
  isEditMode,
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
  const packageSummary = calculatePackageLineSummary(values.packageLines);
  const packageLineDetails = values.packageLines
    .map((line, index) => {
      const label = line.label.trim() || `Quy cách ${index + 1}`;
      return `${label}: ${line.capacityKg || '—'} kg × ${line.quantity || '—'}`;
    })
    .join('\n');
  const packagingRows: [string, string][] = [];
  if (isEditMode) packagingRows.push(['Kích thước mỗi kiện', dimensionsSummary]);
  packagingRows.push(['Ảnh lô hàng', values.documentImage ? '1 ảnh đã chọn' : 'Chưa chọn ảnh']);
  packagingRows.push([
    'Chứng từ',
    values.legalDocument?.fileName || (values.legalDocument ? '1 tệp đã chọn' : isEditMode ? 'Không thay đổi' : 'Chưa chọn'),
  ]);

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
          ['Người nhận', values.receiverName && values.receiverPhone ? `${values.receiverName} · ${values.receiverPhone}` : values.receiverName || values.receiverPhone || '—'],
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
            isEditMode ? 'Tổng khối lượng & số kiện' : 'Tổng lô hàng',
            isEditMode
              ? values.expectedWeightKg && values.quantity
                ? `${values.expectedWeightKg} kg · ${values.quantity} kiện`
                : '—'
              : `${formatNumber(packageSummary.totalWeightKg)} kg · ${formatNumber(packageSummary.totalQuantity)} kiện`,
          ],
          ...(!isEditMode ? [['Quy cách kiện', packageLineDetails || '—'] as [string, string]] : []),
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

function formatNumber(value: number) {
  return value.toLocaleString('vi-VN', { maximumFractionDigits: 2 });
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
      <Text style={{ color: colors.text.primary }} className="mt-4 text-base font-bold leading-6">
        {summary}
      </Text>

      <View className="mt-3">
        {rows.map(([label, value]) => {
          const isImageRow = label === 'Ảnh lô hàng';
          const hasImage = isImageRow && Boolean(imageUri);

          return (
            <View
              key={label}
              className="flex-row items-center justify-between gap-4 py-2.5"
              style={{ borderTopColor: colors.border.default, borderTopWidth: 1 }}
            >
              <Text style={{ color: colors.text.secondary }} className="w-[94px] text-xs font-medium leading-5">
                {label}
              </Text>

              {hasImage && imageUri ? (
                <View className="flex-row items-center gap-3">
                  <Text style={{ color: colors.text.primary }} className="text-sm font-semibold leading-5">
                    1 ảnh đã chọn
                  </Text>
                  <View
                    style={{
                      width: 56,
                      height: 56,
                      borderRadius: 12,
                      borderWidth: 1,
                      borderColor: 'rgba(189, 214, 231, 0.6)',
                      overflow: 'hidden',
                      backgroundColor: colors.surface.page,
                      shadowColor: '#173b59',
                      shadowOffset: { width: 0, height: 1 },
                      shadowOpacity: 0.05,
                      shadowRadius: 2,
                      elevation: 1,
                    }}
                  >
                    <Image
                      source={{ uri: imageUri }}
                      accessibilityLabel="Ảnh lô hàng đã chọn"
                      style={{ width: '100%', height: '100%' }}
                      resizeMode="cover"
                    />
                  </View>
                </View>
              ) : (
                <Text style={{ color: colors.text.primary }} className="flex-1 text-right text-sm font-semibold leading-5">
                  {value}
                </Text>
              )}
            </View>
          );
        })}
      </View>
    </CustomerCard>
  );
}
