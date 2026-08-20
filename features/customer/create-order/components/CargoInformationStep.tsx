import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { colors } from '../../../../constants/colors';
import { customerRadius } from '../../../../constants/customerTheme';
import {
  MAX_TEMPERATURE_CELSIUS,
  MIN_TEMPERATURE_CELSIUS,
  type CreateOrderFieldKey,
  type CreateOrderValidationErrors,
  type GoodsType,
} from '../createOrderValidation';
import {
  CreateOrderChoiceCard,
  CreateOrderFormSection,
  CreateOrderTextField,
  type RegisterCreateOrderField,
  type RegisterCreateOrderInput,
} from './CreateOrderUi';

type CargoInformationStepProps = {
  itemName: string;
  expectedWeightKg: string;
  quantity: string;
  category: GoodsType;
  temperature: number;
  errors: CreateOrderValidationErrors;
  registerField: RegisterCreateOrderField;
  registerInput: RegisterCreateOrderInput;
  onChangeItemName: (value: string) => void;
  onChangeExpectedWeight: (value: string) => void;
  onChangeQuantity: (value: string) => void;
  onChangeCategory: (value: GoodsType) => void;
  onChangeTemperature: (value: number) => void;
  onFocusField?: (field: CreateOrderFieldKey) => void;
  onBlurField: (field: CreateOrderFieldKey) => void;
  onSubmitField: (field: CreateOrderFieldKey) => void;
};

const GOODS_TYPES: {
  id: GoodsType;
  label: string;
  description: string;
  example: string;
  icon: keyof typeof Ionicons.glyphMap;
}[] = [
  {
    id: 'FROZEN_FRUITS_VEGGIES',
    label: 'Thực phẩm đông lạnh',
    description: 'Thực phẩm cần duy trì nhiệt độ âm',
    example: 'Ví dụ: Tôm sú đông lạnh, cá hồi đông lạnh',
    icon: 'restaurant-outline',
  },
  {
    id: 'PHARMACEUTICALS',
    label: 'Dược phẩm',
    description: 'Thuốc, vaccine và vật tư y tế',
    example: 'Ví dụ: Vaccine, thuốc bảo quản lạnh',
    icon: 'medkit-outline',
  },
  {
    id: 'MEAT_SEAFOOD',
    label: 'Thịt / Hải sản',
    description: 'Hàng tươi hoặc đông lạnh',
    example: 'Ví dụ: Thịt bò đông lạnh, tôm, cá',
    icon: 'fish-outline',
  },
];

export function CargoInformationStep({
  itemName,
  expectedWeightKg,
  quantity,
  category,
  temperature,
  errors,
  registerField,
  registerInput,
  onChangeItemName,
  onChangeExpectedWeight,
  onChangeQuantity,
  onChangeCategory,
  onChangeTemperature,
  onFocusField,
  onBlurField,
  onSubmitField,
}: CargoInformationStepProps) {
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
      </CreateOrderFormSection>

      <CreateOrderFormSection
        title="Loại hàng hóa"
        icon="grid-outline"
        description="Chọn loại hàng phù hợp để áp dụng quy chuẩn bảo quản."
      >
        <View ref={(node) => registerField('category', node)} className="gap-3">
          {GOODS_TYPES.map((type) => {
            const isSelected = category === type.id;
            return (
              <CreateOrderChoiceCard
                key={type.id}
                selected={isSelected}
                title={type.label}
                subtitle={type.description}
                helperText={type.example}
                icon={type.icon}
                accessibilityLabel={`Loại hàng ${type.label}`}
                rightElement={<CategorySelectionIndicator selected={isSelected} />}
                onPress={() => onChangeCategory(type.id)}
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
            style={{
              backgroundColor: colors.surface.selected,
              borderRadius: customerRadius.control,
            }}
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

export function getGoodsTypeLabel(category: GoodsType) {
  return GOODS_TYPES.find((type) => type.id === category)?.label ?? category;
}
