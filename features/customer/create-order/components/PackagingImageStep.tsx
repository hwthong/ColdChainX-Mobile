import React from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
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

const PACKAGING_ICON_MAP: Record<string, keyof typeof Ionicons.glyphMap> = {
  'Carton Box': 'cube-outline',
  'Foam Box': 'snow-outline',
  'Plastic Box': 'file-tray-full-outline',
  Pallet: 'grid-outline',
  Thùng: 'archive-outline',
  Bao: 'bag-handle-outline',
};

type PackagingImageStepProps = {
  packagingTypes: string[];
  lengthCm: string;
  widthCm: string;
  heightCm: string;
  quantity: string;
  image: DocumentImage | null;
  capacityWarning: string | null;
  existingCbm?: number | null;
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
  existingCbm,
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
  const [touchedFields, setTouchedFields] = React.useState<Record<string, boolean>>({});
  const cbmPreview = calculateCbmPreview(lengthCm, widthCm, heightCm, quantity);

  const touchField = (field: string) => {
    setTouchedFields((prev) => ({ ...prev, [field]: true }));
  };

  const selectPackagingType = (value: string) => {
    touchField('packagingType');
    if (packagingTypes[0] === value && packagingTypes.length === 1) return;
    onChangePackagingTypes([value]);
  };

  const handleFieldBlur = (field: CreateOrderFieldKey) => {
    touchField(field);
    onBlurField(field);
  };

  return (
    <View className="gap-4">
      <CreateOrderFormSection
        title="Đóng gói *"
        icon="archive-outline"
        description="Chọn cách đóng gói phù hợp với lô hàng."
      >
        <View ref={(node) => registerField('packagingType', node)}>
          <View style={styles.packagingGrid}>
            {PACKAGING_OPTIONS.map((option) => {
              const selected = packagingTypes.includes(option.value);
              const iconName = PACKAGING_ICON_MAP[option.value] || 'cube-outline';
              return (
                <View
                  key={option.value}
                  style={[
                    styles.packagingTile,
                    selected && styles.packagingTileSelected,
                  ]}
                >
                  <Ionicons
                    name={iconName}
                    size={18}
                    color={selected ? colors.brand.primary : colors.text.secondary}
                  />
                  <Text
                    numberOfLines={2}
                    style={[
                      styles.packagingTileText,
                      selected && styles.packagingTileTextSelected,
                    ]}
                  >
                    {option.label}
                  </Text>
                  {selected ? (
                    <Ionicons
                      name="checkmark-circle"
                      size={18}
                      color={colors.brand.primary}
                    />
                  ) : null}
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={option.label}
                    onPress={() => selectPackagingType(option.value)}
                    style={StyleSheet.absoluteFillObject}
                  />
                </View>
              );
            })}
          </View>
          {touchedFields.packagingType && errors.packagingType ? <FieldError message={errors.packagingType} /> : null}
        </View>
      </CreateOrderFormSection>

      <CreateOrderFormSection
        title="Kích thước mỗi kiện"
        icon="resize-outline"
        description="Nhập kích thước của một kiện. Hệ thống sẽ tính tổng theo số kiện."
      >
        <View className="gap-3">
          <View className="flex-row gap-2.5">
            <View className="flex-1">
              <CreateOrderTextField
                field="lengthCm"
                label="Dài (cm)"
                placeholder="0"
                value={lengthCm}
                error={touchedFields.lengthCm ? errors.lengthCm : undefined}
                keyboardType="decimal-pad"
                returnKeyType="next"
                onChangeText={(val) => {
                  touchField('lengthCm');
                  onChangeLength(val);
                }}
                onBlur={() => handleFieldBlur('lengthCm')}
                onSubmitEditing={() => onSubmitField('lengthCm')}
                registerField={registerField}
                registerInput={registerInput}
              />
            </View>
            <View className="flex-1">
              <CreateOrderTextField
                field="widthCm"
                label="Rộng (cm)"
                placeholder="0"
                value={widthCm}
                error={touchedFields.widthCm ? errors.widthCm : undefined}
                keyboardType="decimal-pad"
                returnKeyType="next"
                onChangeText={(val) => {
                  touchField('widthCm');
                  onChangeWidth(val);
                }}
                onBlur={() => handleFieldBlur('widthCm')}
                onSubmitEditing={() => onSubmitField('widthCm')}
                registerField={registerField}
                registerInput={registerInput}
              />
            </View>
            <View className="flex-1">
              <CreateOrderTextField
                field="heightCm"
                label="Cao (cm)"
                placeholder="0"
                value={heightCm}
                error={touchedFields.heightCm ? errors.heightCm : undefined}
                keyboardType="decimal-pad"
                onChangeText={(val) => {
                  touchField('heightCm');
                  onChangeHeight(val);
                }}
                onBlur={() => handleFieldBlur('heightCm')}
                onSubmitEditing={() => onSubmitField('heightCm')}
                registerField={registerField}
                registerInput={registerInput}
              />
            </View>
          </View>
          {cbmPreview ? (
            <CbmPreviewStrip preview={cbmPreview} />
          ) : existingCbm ? (
            <View style={{ backgroundColor: colors.surface.selected, borderRadius: customerRadius.control }} className="gap-1 px-4 py-3">
              <Text style={{ color: colors.text.secondary }} className="text-xs font-medium leading-5">
                Kích thước đã lưu trong đơn hàng
              </Text>
              <Text style={{ color: colors.text.primary }} className="text-sm font-bold leading-5">
                Tổng thể tích: {existingCbm} m³ (Nhập số mới nếu bạn muốn thay đổi)
              </Text>
            </View>
          ) : null}
        </View>

        {capacityWarning ? (
          <View
            style={{
              backgroundColor: 'rgba(255, 247, 237, 0.9)',
              borderColor: 'rgba(251, 191, 36, 0.4)',
              borderWidth: 1,
              borderRadius: 16,
            }}
            className="flex-row items-start gap-2.5 p-4"
          >
            <Ionicons name="warning-outline" size={18} color="#B45309" />
            <Text className="flex-1 text-xs font-semibold leading-5 text-amber-900">{capacityWarning}</Text>
          </View>
        ) : null}
      </CreateOrderFormSection>

      <CreateOrderFormSection
        title="Ảnh lô hàng *"
        icon="camera-outline"
        description="Thêm ảnh để kiểm tra tình trạng và cách đóng gói."
      >
        <View ref={(node) => registerField('documentImage', node)} className="gap-3">
          {image ? (
            <>
              <Image
                source={{ uri: image.uri }}
                accessibilityLabel="Ảnh lô hàng đã chọn"
                className="h-44 w-full rounded-2xl"
                resizeMode="cover"
              />
              <View className="flex-row gap-3">
                <Pressable
                  onPress={onPickImage}
                  accessibilityRole="button"
                  accessibilityLabel="Thay ảnh lô hàng"
                  style={{
                    backgroundColor: colors.brand.primarySoft,
                    borderRadius: 14,
                    minHeight: 46,
                  }}
                  className="flex-1 items-center justify-center"
                >
                  <Text style={{ color: colors.brand.primary }} className="text-sm font-bold">Thay ảnh</Text>
                </Pressable>
                <Pressable
                  onPress={onRemoveImage}
                  accessibilityRole="button"
                  accessibilityLabel="Xóa ảnh lô hàng"
                  style={{
                    backgroundColor: '#FFFFFF',
                    borderColor: 'rgba(189, 214, 231, 0.5)',
                    borderRadius: 14,
                    borderWidth: 1,
                    minHeight: 46,
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
              accessibilityHint="Chụp ảnh hoặc chọn ảnh từ thư viện"
              style={{
                backgroundColor: errors.documentImage ? '#FEF2F2' : 'rgba(238, 246, 252, 0.5)',
                borderColor: errors.documentImage ? '#FCA5A5' : 'rgba(114, 169, 210, 0.45)',
                borderRadius: 18,
                borderStyle: 'dashed',
                borderWidth: 1.5,
                minHeight: 136,
              }}
              className="items-center justify-center px-5 py-6"
            >
              <View
                style={{
                  backgroundColor: '#FFFFFF',
                  shadowColor: '#173b59',
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.05,
                  shadowRadius: 4,
                  elevation: 2,
                }}
                className="h-12 w-12 items-center justify-center rounded-full"
              >
                <Ionicons name="camera-outline" size={24} color={colors.brand.primary} />
              </View>
              <Text style={{ color: colors.text.primary }} className="mt-3 text-center text-sm font-bold">Thêm ảnh lô hàng</Text>
              <Text style={{ color: colors.text.secondary }} className="mt-1 text-center text-xs leading-5">
                Chụp ảnh hoặc chọn từ thư viện.
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

const styles = StyleSheet.create({
  packagingGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 10,
  },
  packagingTile: {
    width: '48.5%',
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 15,
    backgroundColor: 'rgba(255, 255, 255, 0.96)',
    borderWidth: 1,
    borderColor: colors.border.default,
    overflow: 'hidden',
  },
  packagingTileSelected: {
    backgroundColor: colors.brand.primarySoft,
    borderColor: colors.brand.primary,
  },
  packagingTileText: {
    flexShrink: 1,
    flexGrow: 1,
    marginLeft: 8,
    marginRight: 6,
    color: colors.text.primary,
    fontSize: 13,
    fontWeight: '600',
    includeFontPadding: false,
  },
  packagingTileTextSelected: {
    color: colors.brand.primary,
  },
});
