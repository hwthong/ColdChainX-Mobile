import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { colors } from '../../../../constants/colors';
import { customerRadius } from '../../../../constants/customerTheme';
import { CREATE_ORDER_CATEGORY_OPTIONS, getCreateOrderCategoryLabel } from '../createOrderOptions';
import {
  calculatePackageLineSummary,
  getPackageLineValidationErrors,
  MAX_TEMPERATURE_CELSIUS,
  MIN_TEMPERATURE_CELSIUS,
  type CreateOrderFieldKey,
  type CreateOrderValidationErrors,
  type GoodsType,
  type OrderPackageLineFormValue,
} from '../createOrderValidation';
import {
  CreateOrderChoiceCard,
  CreateOrderFormSection,
  CreateOrderTextField,
  type RegisterCreateOrderField,
  type RegisterCreateOrderInput,
} from './CreateOrderUi';

type PackageLineTextField = 'label' | 'capacityKg' | 'quantity';

type CargoInformationStepProps = {
  isEditMode: boolean;
  itemName: string;
  expectedWeightKg: string;
  quantity: string;
  packageLines: OrderPackageLineFormValue[];
  category: GoodsType;
  temperature: number;
  errors: CreateOrderValidationErrors;
  registerField: RegisterCreateOrderField;
  registerInput: RegisterCreateOrderInput;
  onChangeItemName: (value: string) => void;
  onChangeExpectedWeight: (value: string) => void;
  onChangeQuantity: (value: string) => void;
  onChangePackageLine: (id: string, field: PackageLineTextField, value: string) => void;
  onAddPackageLine: () => void;
  onRemovePackageLine: (id: string) => void;
  onChangeCategory: (value: GoodsType) => void;
  onChangeTemperature: (value: number) => void;
  onFocusField?: (field: CreateOrderFieldKey) => void;
  onBlurField: (field: CreateOrderFieldKey) => void;
  onSubmitField: (field: CreateOrderFieldKey) => void;
};

const GOODS_TYPE_DETAILS: Record<
  GoodsType,
  { description: string; example: string; icon: keyof typeof Ionicons.glyphMap }
> = {
  MEAT_SEAFOOD: {
    description: 'Thịt, thủy hải sản tươi hoặc đông lạnh',
    example: 'Ví dụ: Thịt bò, tôm, cá',
    icon: 'fish-outline',
  },
  FRUITS_VEGGIES: {
    description: 'Nông sản tươi cần bảo quản mát',
    example: 'Ví dụ: Rau xanh, trái cây tươi',
    icon: 'leaf-outline',
  },
  FROZEN_FRUITS_VEGGIES: {
    description: 'Rau củ quả cần duy trì nhiệt độ âm',
    example: 'Ví dụ: Khoai tây, xoài đông lạnh',
    icon: 'snow-outline',
  },
  ICE_CREAM_BEVERAGES: {
    description: 'Kem, đồ uống và sản phẩm cần giữ lạnh',
    example: 'Ví dụ: Kem, sữa, nước giải khát',
    icon: 'ice-cream-outline',
  },
  PHARMACEUTICALS: {
    description: 'Thuốc, vaccine và vật tư y tế',
    example: 'Ví dụ: Vaccine, thuốc bảo quản lạnh',
    icon: 'medkit-outline',
  },
  RAW_MATERIALS_OTHERS: {
    description: 'Nguyên liệu và hàng lạnh khác',
    example: 'Ví dụ: Men, phụ gia, nguyên liệu chế biến',
    icon: 'cube-outline',
  },
};

export function CargoInformationStep({
  isEditMode,
  itemName,
  expectedWeightKg,
  quantity,
  packageLines,
  category,
  temperature,
  errors,
  registerField,
  registerInput,
  onChangeItemName,
  onChangeExpectedWeight,
  onChangeQuantity,
  onChangePackageLine,
  onAddPackageLine,
  onRemovePackageLine,
  onChangeCategory,
  onChangeTemperature,
  onFocusField,
  onBlurField,
  onSubmitField,
}: CargoInformationStepProps) {
  const packageLineErrors = errors.packageLines ? getPackageLineValidationErrors(packageLines) : [];
  const packageSummary = calculatePackageLineSummary(packageLines);

  return (
    <View className="gap-6">
      <CreateOrderFormSection
        title="Thông tin cơ bản"
        icon="cube-outline"
        description="Khai báo thông tin chi tiết về lô hàng cần vận chuyển."
      >
        <CreateOrderTextField
          fieldKey="itemName"
          label="Tên mặt hàng"
          required
          placeholder="Nhập tên mặt hàng (VD: Thịt bò đông lạnh)"
          value={itemName}
          error={errors.itemName}
          registerField={registerField}
          registerInput={registerInput}
          onChangeText={onChangeItemName}
          onFocus={() => onFocusField?.('itemName')}
          onBlur={() => onBlurField('itemName')}
          onSubmitEditing={() => onSubmitField('itemName')}
        />

        {isEditMode ? (
          <View className="flex-row gap-3">
            <View className="flex-1">
              <CreateOrderTextField
                fieldKey="expectedWeightKg"
                label="Khối lượng (kg)"
                required
                placeholder="VD: 500"
                keyboardType="decimal-pad"
                value={expectedWeightKg}
                error={errors.expectedWeightKg}
                registerField={registerField}
                registerInput={registerInput}
                onChangeText={onChangeExpectedWeight}
                onFocus={() => onFocusField?.('expectedWeightKg')}
                onBlur={() => onBlurField('expectedWeightKg')}
                onSubmitEditing={() => onSubmitField('expectedWeightKg')}
              />
            </View>

            <View className="flex-1">
              <CreateOrderTextField
                fieldKey="quantity"
                label="Số kiện"
                required
                placeholder="VD: 20"
                keyboardType="number-pad"
                value={quantity}
                error={errors.quantity}
                registerField={registerField}
                registerInput={registerInput}
                onChangeText={onChangeQuantity}
                onFocus={() => onFocusField?.('quantity')}
                onBlur={() => onBlurField('quantity')}
                onSubmitEditing={() => onSubmitField('quantity')}
              />
            </View>
          </View>
        ) : null}
      </CreateOrderFormSection>

      {!isEditMode ? (
        <CreateOrderFormSection
          title="Thông tin đóng gói"
          icon="layers-outline"
          description="Thêm từng quy cách kiện để hệ thống tính tổng số kiện và khối lượng."
        >
          <View ref={(node) => registerField('packageLines', node)} className="gap-3">
            {packageLines.map((line, index) => (
              <View key={line.id} style={styles.packageLineCard}>
                <View className="mb-3 flex-row items-center justify-between">
                  <Text style={styles.packageLineTitle}>Quy cách {index + 1}</Text>
                  {packageLines.length > 1 ? (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Xóa quy cách ${index + 1}`}
                      hitSlop={8}
                      onPress={() => onRemovePackageLine(line.id)}
                      style={styles.removeButton}
                    >
                      <Ionicons name="trash-outline" size={18} color="#B42318" />
                    </Pressable>
                  ) : null}
                </View>

                <CompactTextField
                  label="Tên kiện"
                  optional
                  placeholder="VD: Thùng carton 5kg"
                  value={line.label}
                  onChangeText={(value) => onChangePackageLine(line.id, 'label', value)}
                />

                <View className="mt-3 flex-row gap-3">
                  <View className="flex-1">
                    <CompactTextField
                      label="Khối lượng / kiện"
                      suffix="kg"
                      placeholder="5"
                      keyboardType="decimal-pad"
                      value={line.capacityKg}
                      error={packageLineErrors[index]?.capacityKg}
                      onChangeText={(value) => onChangePackageLine(line.id, 'capacityKg', value)}
                      onFocus={() => onFocusField?.('packageLines')}
                      onBlur={() => onBlurField('packageLines')}
                    />
                  </View>
                  <View className="flex-1">
                    <CompactTextField
                      label="Số lượng"
                      placeholder="10"
                      keyboardType="number-pad"
                      value={line.quantity}
                      error={packageLineErrors[index]?.quantity}
                      onChangeText={(value) => onChangePackageLine(line.id, 'quantity', value)}
                      onFocus={() => onFocusField?.('packageLines')}
                      onBlur={() => onBlurField('packageLines')}
                    />
                  </View>
                </View>
              </View>
            ))}

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Thêm quy cách đóng gói"
              onPress={onAddPackageLine}
              style={styles.addPackageLineButton}
            >
              <Ionicons name="add-circle-outline" size={20} color={colors.brand.primary} />
              <Text style={styles.addPackageLineText}>Thêm quy cách</Text>
            </Pressable>

            <View style={styles.packageSummary}>
              <SummaryRow label="Tổng số kiện" value={formatNumber(packageSummary.totalQuantity)} />
              <SummaryRow
                label="Tổng khối lượng"
                value={`${formatNumber(packageSummary.totalWeightKg)} kg`}
              />
            </View>

            {errors.packageLines ? <FieldError message={errors.packageLines} /> : null}
          </View>
        </CreateOrderFormSection>
      ) : null}

      <CreateOrderFormSection
        title="Loại hàng hóa"
        icon="grid-outline"
        description="Chọn loại hàng phù hợp để áp dụng quy chuẩn bảo quản."
      >
        <View ref={(node) => registerField('category', node)} className="gap-3">
          {CREATE_ORDER_CATEGORY_OPTIONS.map((option) => {
            const isSelected = category === option.value;
            const details = GOODS_TYPE_DETAILS[option.value];
            return (
              <CreateOrderChoiceCard
                key={option.value}
                selected={isSelected}
                title={option.label}
                subtitle={details.description}
                helperText={details.example}
                icon={details.icon}
                accessibilityLabel={`Loại hàng ${option.label}`}
                rightElement={<CategorySelectionIndicator selected={isSelected} />}
                onPress={() => onChangeCategory(option.value)}
              />
            );
          })}
          {errors.category ? <FieldError message={errors.category} /> : null}
        </View>
      </CreateOrderFormSection>

      <CreateOrderFormSection
        title="Điều kiện bảo quản"
        icon="thermometer-outline"
        description="Thiết lập nhiệt độ yêu cầu cho lô hàng."
      >
        <View ref={(node) => registerField('tempCondition', node)} className="gap-3">
          <Text style={{ color: colors.text.primary }} className="text-[13px] font-bold">
            Nhiệt độ yêu cầu <Text className="text-red-600">*</Text>
          </Text>
          <View
            className="flex-row items-center justify-between p-3"
            style={{ backgroundColor: colors.surface.selected, borderRadius: customerRadius.control }}
          >
            <TemperatureButton
              icon="remove"
              label="Giảm nhiệt độ"
              disabled={temperature <= MIN_TEMPERATURE_CELSIUS}
              onPress={() => onChangeTemperature(Math.max(MIN_TEMPERATURE_CELSIUS, temperature - 1))}
            />
            <View className="items-center px-3">
              <Text
                accessibilityRole="text"
                accessibilityLabel={`Nhiệt độ yêu cầu ${temperature} độ C`}
                style={{ color: colors.brand.primary }}
                className="text-3xl font-bold"
              >
                {temperature}°C
              </Text>
            </View>
            <TemperatureButton
              icon="add"
              label="Tăng nhiệt độ"
              disabled={temperature >= MAX_TEMPERATURE_CELSIUS}
              onPress={() => onChangeTemperature(Math.min(MAX_TEMPERATURE_CELSIUS, temperature + 1))}
            />
          </View>
          <Text style={{ color: colors.text.secondary }} className="text-center text-xs leading-5">
            Phạm vi cho phép: {MIN_TEMPERATURE_CELSIUS}°C đến {MAX_TEMPERATURE_CELSIUS}°C
          </Text>
          {errors.tempCondition ? <FieldError message={errors.tempCondition} centered /> : null}
        </View>
      </CreateOrderFormSection>
    </View>
  );
}

function CompactTextField({
  label,
  optional,
  suffix,
  error,
  ...inputProps
}: React.ComponentProps<typeof TextInput> & {
  label: string;
  optional?: boolean;
  suffix?: string;
  error?: string;
}) {
  return (
    <View className="gap-1.5">
      <Text style={styles.compactLabel}>
        {label}{optional ? <Text style={styles.optionalLabel}> (không bắt buộc)</Text> : null}
      </Text>
      <View style={[styles.compactInputShell, error ? styles.compactInputShellError : null]}>
        <TextInput
          {...inputProps}
          placeholderTextColor={colors.text.muted}
          style={styles.compactInput}
        />
        {suffix ? <Text style={styles.inputSuffix}>{suffix}</Text> : null}
      </View>
      {error ? <Text style={styles.inlineError}>{error}</Text> : null}
    </View>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row items-center justify-between gap-4">
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={styles.summaryValue}>{value}</Text>
    </View>
  );
}

function CategorySelectionIndicator({ selected }: { selected: boolean }) {
  return (
    <View
      className="h-6 w-6 items-center justify-center rounded-full"
      style={{
        backgroundColor: selected ? colors.brand.primary : colors.surface.card,
        borderColor: selected ? colors.brand.primary : colors.border.default,
        borderWidth: 1,
      }}
    >
      {selected ? <Ionicons name="checkmark" size={15} color={colors.text.onPrimary} /> : null}
    </View>
  );
}

function TemperatureButton({
  icon,
  label,
  disabled,
  onPress,
}: {
  icon: 'add' | 'remove';
  label: string;
  disabled: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      className="items-center justify-center"
      style={{
        backgroundColor: colors.surface.card,
        borderColor: colors.border.default,
        borderRadius: customerRadius.control,
        borderWidth: 1,
        height: 48,
        opacity: disabled ? 0.4 : 1,
        width: 48,
      }}
    >
      <Ionicons name={icon} size={23} color={colors.brand.primary} />
    </Pressable>
  );
}

function FieldError({ message, centered = false }: { message: string; centered?: boolean }) {
  return (
    <Text
      accessibilityLiveRegion="polite"
      className={['text-xs font-medium text-red-600', centered ? 'text-center' : ''].join(' ')}
    >
      {message}
    </Text>
  );
}

function formatNumber(value: number) {
  return value.toLocaleString('vi-VN', { maximumFractionDigits: 2 });
}

export function getGoodsTypeLabel(category: GoodsType) {
  return getCreateOrderCategoryLabel(category);
}

const styles = StyleSheet.create({
  packageLineCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.96)',
    borderColor: colors.border.default,
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
  },
  packageLineTitle: {
    color: colors.text.primary,
    fontSize: 14,
    fontWeight: '700',
  },
  removeButton: {
    alignItems: 'center',
    backgroundColor: '#FEF3F2',
    borderRadius: 10,
    height: 34,
    justifyContent: 'center',
    width: 34,
  },
  compactLabel: {
    color: colors.text.primary,
    fontSize: 12,
    fontWeight: '700',
  },
  optionalLabel: {
    color: colors.text.secondary,
    fontWeight: '500',
  },
  compactInputShell: {
    alignItems: 'center',
    backgroundColor: colors.surface.card,
    borderColor: colors.border.default,
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    minHeight: 46,
    paddingHorizontal: 12,
  },
  compactInputShellError: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FCA5A5',
  },
  compactInput: {
    color: colors.text.primary,
    flex: 1,
    fontSize: 14,
    minWidth: 0,
    paddingVertical: 10,
  },
  inputSuffix: {
    color: colors.text.secondary,
    fontSize: 13,
    fontWeight: '600',
    marginLeft: 6,
  },
  inlineError: {
    color: '#DC2626',
    fontSize: 11,
    lineHeight: 16,
  },
  addPackageLineButton: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    flexDirection: 'row',
    gap: 7,
    minHeight: 42,
    paddingHorizontal: 4,
  },
  addPackageLineText: {
    color: colors.brand.primary,
    fontSize: 14,
    fontWeight: '700',
  },
  packageSummary: {
    backgroundColor: colors.surface.selected,
    borderRadius: customerRadius.control,
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  summaryLabel: {
    color: colors.text.secondary,
    fontSize: 13,
    fontWeight: '600',
  },
  summaryValue: {
    color: colors.text.primary,
    fontSize: 14,
    fontWeight: '800',
  },
});
