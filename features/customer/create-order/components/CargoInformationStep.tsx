import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { customerColors, customerControl, customerRadius } from '../../../../constants/customerTheme';
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
  onBlurField,
  onSubmitField,
}: CargoInformationStepProps) {
  const selectedGoodsType = GOODS_TYPES.find((type) => type.id === category);

  return (
    <View className="gap-4">
      <CreateOrderFormSection
        title="Phân loại hàng hóa"
        icon="grid-outline"
        description="Chọn nhóm phù hợp nhất với lô hàng."
      >
        <View ref={(node) => registerField('category', node)} className="gap-2">
          <View className="gap-2">
            {GOODS_TYPES.map((type) => {
              const selected = category === type.id;
              return (
                <CreateOrderChoiceCard
                  key={type.id}
                  accessibilityLabel={type.label}
                  accessibilityHint={type.description}
                  selected={selected}
                  title={type.label}
                  subtitle={type.description}
                  leading={(
                    <View
                      className="h-9 w-9 items-center justify-center rounded-full"
                      style={{ backgroundColor: selected ? customerColors.primary : customerColors.primarySoft }}
                    >
                      <Ionicons name={type.icon} size={19} color={selected ? '#FFFFFF' : customerColors.primary} />
                    </View>
                  )}
                  trailingContent={<CategorySelectionIndicator selected={selected} />}
                  onPress={() => onChangeCategory(type.id)}
                />
              );
            })}
          </View>
          {errors.category ? <FieldError message={errors.category} /> : null}
        </View>
      </CreateOrderFormSection>

      <CreateOrderFormSection
        title="Thông tin lô hàng"
        icon="cube-outline"
        description="Thông tin dùng để tính tải trọng và xử lý lô hàng."
      >
        <CreateOrderTextField
          field="itemName"
          label="Tên hàng hóa"
          placeholder="Nhập tên hàng hóa"
          value={itemName}
          error={errors.itemName}
          helperText={selectedGoodsType?.example}
          returnKeyType="next"
          onChangeText={onChangeItemName}
          onBlur={() => onBlurField('itemName')}
          onSubmitEditing={() => onSubmitField('itemName')}
          registerField={registerField}
          registerInput={registerInput}
        />

        <View className="flex-row gap-3">
          <View className="flex-1">
            <CreateOrderTextField
              field="expectedWeightKg"
              label="Tổng khối lượng lô hàng (kg)"
              placeholder="Nhập khối lượng"
              value={expectedWeightKg}
              error={errors.expectedWeightKg}
              helperText="Tổng khối lượng của tất cả kiện hàng."
              keyboardType="decimal-pad"
              returnKeyType="next"
              onChangeText={onChangeExpectedWeight}
              onBlur={() => onBlurField('expectedWeightKg')}
              onSubmitEditing={() => onSubmitField('expectedWeightKg')}
              registerField={registerField}
              registerInput={registerInput}
            />
          </View>
          <View style={{ flex: 0.48 }}>
            <CreateOrderTextField
              field="quantity"
              label="Tổng số kiện"
              placeholder="1"
              value={quantity}
              error={errors.quantity}
              helperText="Tổng số kiện trong lô hàng."
              keyboardType="number-pad"
              onChangeText={onChangeQuantity}
              onBlur={() => onBlurField('quantity')}
              onSubmitEditing={() => onSubmitField('quantity')}
              registerField={registerField}
              registerInput={registerInput}
            />
          </View>
        </View>
      </CreateOrderFormSection>

      <CreateOrderFormSection
        title="Điều kiện bảo quản"
        icon="thermometer-outline"
        description="Thiết lập nhiệt độ yêu cầu cho lô hàng."
      >
        <View ref={(node) => registerField('tempCondition', node)} className="gap-3">
          <Text className="text-[13px] font-bold text-[#3A1F04]">
            Nhiệt độ yêu cầu <Text className="text-red-600">*</Text>
          </Text>
          <View
            className="flex-row items-center justify-between p-3"
            style={{
              backgroundColor: customerColors.primarySoft,
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
                className="text-3xl font-bold text-[#8B4513]"
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
          <Text className="text-center text-xs leading-5 text-[#877369]">
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
        backgroundColor: selected ? customerColors.primary : customerColors.surface,
        borderColor: selected ? customerColors.primary : customerColors.borderStrong,
        borderWidth: 1,
      }}
    >
      {selected ? <Ionicons name="checkmark" size={15} color="#FFFFFF" /> : null}
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
        backgroundColor: customerColors.surface,
        borderColor: customerColors.border,
        borderRadius: customerRadius.control,
        borderWidth: 1,
        height: 48,
        opacity: disabled ? 0.4 : 1,
        width: 48,
      }}
    >
      <Ionicons name={icon} size={23} color="#8B4513" />
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
