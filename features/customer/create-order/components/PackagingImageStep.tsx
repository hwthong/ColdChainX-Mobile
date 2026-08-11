import React from 'react';
import { Image, Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { colors } from '../../../../constants/colors';
import { customerRadius } from '../../../../constants/customerTheme';
import {
  parseCreateOrderDecimal,
  type CreateOrderFieldKey,
  type CreateOrderValidationErrors,
  type DocumentImage,
} from '../createOrderValidation';
import {
  CreateOrderFormSection,
  CreateOrderTextField,
  type RegisterCreateOrderField,
  type RegisterCreateOrderInput,
} from './CreateOrderUi';

export const PACKAGING_OPTIONS = [
  { label: 'Thùng carton', value: 'Carton Box' },
  { label: 'Thùng xốp giữ nhiệt', value: 'Foam Box' },
  { label: 'Thùng nhựa', value: 'Plastic Box' },
  { label: 'Pallet', value: 'Pallet' },
  { label: 'Thùng', value: 'Thùng' },
  { label: 'Bao', value: 'Bao' },
];

export function getPackagingTypeLabel(type: string): string {
  const option = PACKAGING_OPTIONS.find((opt) => opt.value === type);
  return option?.label || type;
}

type PackagingImageStepProps = {
  packagingTypes: string[];
  lengthCm: string;
  widthCm: string;
  heightCm: string;
  quantity: string;
  image: DocumentImage | null;
  capacityWarning: string | null;
  errors: CreateOrderValidationErrors;
  registerField: RegisterCreateOrderField;
  registerInput: RegisterCreateOrderInput;
  onChangePackagingTypes: (value: string[]) => void;
  onChangeLength: (value: string) => void;
  onChangeWidth: (value: string) => void;
  onChangeHeight: (value: string) => void;
  onPickImage: () => void;
  onRemoveImage: () => void;
  onBlurField: (field: CreateOrderFieldKey) => void;
  onSubmitField: (field: CreateOrderFieldKey) => void;
};

export function PackagingImageStep({
  packagingTypes,
  lengthCm,
  widthCm,
  heightCm,
  quantity,
  image,
  capacityWarning,
  errors,
  registerField,
  registerInput,
  onChangePackagingTypes,
  onChangeLength,
  onChangeWidth,
  onChangeHeight,
  onPickImage,
  onRemoveImage,
  onBlurField,
  onSubmitField,
}: PackagingImageStepProps) {
  const cbmPreview = calculateCbmPreview(lengthCm, widthCm, heightCm, quantity);

  const selectPackagingType = (value: string) => {
    if (packagingTypes[0] === value && packagingTypes.length === 1) return;
    onChangePackagingTypes([value]);
  };

  return (
    <View className="gap-4">
      <CreateOrderFormSection
        title="Hình thức đóng gói"
        icon="archive-outline"
        description="Chọn loại bao bì phù hợp với lô hàng."
      >
        <View ref={(node) => registerField('packagingType', node)} className="gap-2">
          <Text style={{ color: colors.text.primary }} className="text-[13px] font-bold">
            Loại bao bì <Text className="text-red-600">*</Text>
          </Text>
          <View className="flex-row flex-wrap gap-2">
            {PACKAGING_OPTIONS.map((option) => {
              const selected = packagingTypes.includes(option.value);
              return (
                <Pressable
                  key={option.value}
                  onPress={() => selectPackagingType(option.value)}
                  accessibilityRole="radio"
                  accessibilityLabel={option.label}
                  accessibilityState={{ selected }}
                  className="max-w-full flex-row items-center justify-center gap-1.5 px-4"
                  style={({ pressed }) => ({
                    backgroundColor: selected ? colors.surface.selected : colors.surface.card,
                    borderColor: selected ? colors.border.selected : colors.border.default,
                    borderRadius: customerRadius.pill,
                    borderWidth: 1,
                    minHeight: 44,
                    opacity: pressed ? 0.76 : 1,
                  })}
                >
                  {selected ? <Ionicons name="checkmark" size={15} color={colors.brand.primary} /> : null}
                  <Text style={{ color: selected ? colors.brand.primary : colors.text.primary }} className="flex-shrink text-[13px] font-bold">
                    {option.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          {errors.packagingType ? <FieldError message={errors.packagingType} /> : null}
        </View>
      </CreateOrderFormSection>

      <CreateOrderFormSection
        title="Kích thước mỗi kiện"
        icon="resize-outline"
        description="Nhập kích thước của một kiện. Hệ thống sẽ tính tổng theo số kiện."
      >
        <View className="gap-3">
          <View className="flex-row gap-2">
            <View className="flex-1">
              <CreateOrderTextField
                field="lengthCm"
                label="Dài (cm)"
                placeholder="Dài"
                value={lengthCm}
                error={errors.lengthCm}
                keyboardType="decimal-pad"
                returnKeyType="next"
                onChangeText={onChangeLength}
                onBlur={() => onBlurField('lengthCm')}
                onSubmitEditing={() => onSubmitField('lengthCm')}
                registerField={registerField}
                registerInput={registerInput}
              />
            </View>
            <View className="flex-1">
              <CreateOrderTextField
                field="widthCm"
                label="Rộng (cm)"
                placeholder="Rộng"
                value={widthCm}
                error={errors.widthCm}
                keyboardType="decimal-pad"
                returnKeyType="next"
                onChangeText={onChangeWidth}
                onBlur={() => onBlurField('widthCm')}
                onSubmitEditing={() => onSubmitField('widthCm')}
                registerField={registerField}
                registerInput={registerInput}
              />
            </View>
            <View className="flex-1">
              <CreateOrderTextField
                field="heightCm"
                label="Cao (cm)"
                placeholder="Cao"
                value={heightCm}
                error={errors.heightCm}
                keyboardType="decimal-pad"
                onChangeText={onChangeHeight}
                onBlur={() => onBlurField('heightCm')}
                onSubmitEditing={() => onSubmitField('heightCm')}
                registerField={registerField}
                registerInput={registerInput}
              />
            </View>
          </View>
          {cbmPreview ? <CbmPreviewStrip preview={cbmPreview} /> : null}
        </View>

        {capacityWarning ? (
          <View className="flex-row items-start gap-2 rounded-2xl bg-[#FFF7ED] p-4">
            <Ionicons name="warning-outline" size={18} color="#B45309" />
            <Text className="flex-1 text-sm font-semibold leading-5 text-amber-800">{capacityWarning}</Text>
          </View>
        ) : null}
      </CreateOrderFormSection>

      <CreateOrderFormSection
        title="Ảnh lô hàng *"
        icon="camera-outline"
        description="Thêm ảnh để hỗ trợ kiểm tra tình trạng và đóng gói."
      >
        <View ref={(node) => registerField('documentImage', node)} className="gap-3">
          {image ? (
            <>
              <Image
                source={{ uri: image.uri }}
                accessibilityLabel="Ảnh lô hàng đã chọn"
                className="h-40 w-full rounded-2xl"
                resizeMode="cover"
              />
              <View className="flex-row gap-3">
                <Pressable
                  onPress={onPickImage}
                  accessibilityRole="button"
                  accessibilityLabel="Thay ảnh lô hàng"
                  style={{ backgroundColor: colors.surface.muted }}
                  className="min-h-11 flex-1 items-center justify-center rounded-2xl"
                >
                  <Text style={{ color: colors.brand.primary }} className="text-sm font-bold">Thay ảnh</Text>
                </Pressable>
                <Pressable
                  onPress={onRemoveImage}
                  accessibilityRole="button"
                  accessibilityLabel="Xóa ảnh lô hàng"
                  style={{
                    backgroundColor: colors.surface.card,
                    borderColor: colors.border.default,
                    borderRadius: customerRadius.control,
                    borderWidth: 1,
                    minHeight: 44,
                  }}
                  className="flex-1 items-center justify-center"
                >
                  <Text style={{ color: colors.text.primary }} className="text-sm font-bold">Xóa ảnh</Text>
                </Pressable>
              </View>
            </>
          ) : (
            <Pressable
              onPress={onPickImage}
              accessibilityRole="button"
              accessibilityLabel="Thêm ảnh lô hàng"
              accessibilityHint="Chụp ảnh hoặc chọn ảnh rõ kiện hàng"
              style={{
                backgroundColor: errors.documentImage ? '#FEF2F2' : colors.surface.page,
                borderColor: errors.documentImage ? '#FCA5A5' : colors.border.default,
                borderRadius: customerRadius.control,
                borderStyle: 'dashed',
                borderWidth: 2,
                minHeight: 132,
              }}
              className="items-center justify-center px-5"
            >
              <View style={{ backgroundColor: colors.surface.muted }} className="h-12 w-12 items-center justify-center rounded-full">
                <Ionicons name="camera-outline" size={25} color={colors.brand.primary} />
              </View>
              <Text style={{ color: colors.text.primary }} className="mt-3 text-center text-sm font-bold">Thêm ảnh lô hàng</Text>
              <Text style={{ color: colors.text.secondary }} className="mt-1 text-center text-xs leading-5">
                Chỉ chọn ảnh rõ kiện hàng, không chọn video.
              </Text>
            </Pressable>
          )}
          {errors.documentImage ? <FieldError message={errors.documentImage} /> : null}
        </View>
      </CreateOrderFormSection>
    </View>
  );
}

export type CbmPreview = {
  packageCount: number;
  perPackageLabel: string;
  totalLabel: string;
};

export function calculateCbmPreview(
  lengthValue: string,
  widthValue: string,
  heightValue: string,
  quantityValue: string
): CbmPreview | null {
  const lengthCm = parseCreateOrderDecimal(lengthValue);
  const widthCm = parseCreateOrderDecimal(widthValue);
  const heightCm = parseCreateOrderDecimal(heightValue);
  const packageCount = Number(quantityValue.trim());

  if (
    !Number.isFinite(lengthCm) || lengthCm <= 0
    || !Number.isFinite(widthCm) || widthCm <= 0
    || !Number.isFinite(heightCm) || heightCm <= 0
    || !Number.isInteger(packageCount) || packageCount < 1
  ) {
    return null;
  }

  const perPackageCbm = (lengthCm * widthCm * heightCm) / 1_000_000;
  return {
    packageCount,
    perPackageLabel: formatCbm(perPackageCbm, 4),
    totalLabel: formatCbm(perPackageCbm * packageCount, 3),
  };
}

function CbmPreviewStrip({ preview }: { preview: CbmPreview }) {
  return (
    <View style={{ backgroundColor: colors.surface.selected, borderRadius: customerRadius.control }} className="gap-1 px-4 py-3">
      <Text style={{ color: colors.text.secondary }} className="text-xs font-medium leading-5">
        {preview.packageCount} kiện · {preview.perPackageLabel} m³/kiện
      </Text>
      <Text style={{ color: colors.text.primary }} className="text-sm font-bold leading-5">
        Tổng thể tích dự kiến: {preview.totalLabel} m³
      </Text>
    </View>
  );
}

function FieldError({ message }: { message: string }) {
  return (
    <Text accessibilityLiveRegion="polite" className="text-xs font-medium text-red-600">
      {message}
    </Text>
  );
}

function formatCbm(value: number, decimalDigits: number) {
  return value.toLocaleString('vi-VN', {
    maximumFractionDigits: decimalDigits,
    minimumFractionDigits: 0,
  });
}
