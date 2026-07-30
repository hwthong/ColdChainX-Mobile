import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import {
  MAX_TEMPERATURE_CELSIUS,
  MIN_TEMPERATURE_CELSIUS,
  type CreateOrderFieldKey,
  type CreateOrderValidationErrors,
  type GoodsType,
} from '../createOrderValidation';
import {
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
  onSubmitField: (field: CreateOrderFieldKey) => void;
};

const GOODS_TYPES: {
  id: GoodsType;
  label: string;
  description: string;
  icon: keyof typeof Ionicons.glyphMap;
}[] = [
  {
    id: 'FROZEN_FRUITS_VEGGIES',
    label: 'Thực phẩm đông lạnh',
    description: 'Rau củ, trái cây và thực phẩm cấp đông',
    icon: 'restaurant-outline',
  },
  {
    id: 'PHARMACEUTICALS',
    label: 'Dược phẩm',
    description: 'Thuốc, vaccine và vật tư y tế',
    icon: 'medkit-outline',
  },
  {
    id: 'MEAT_SEAFOOD',
    label: 'Thịt / Hải sản',
    description: 'Thịt, cá và thủy hải sản đông lạnh',
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
  onSubmitField,
}: CargoInformationStepProps) {
  return (
    <View className="gap-4">
      <CreateOrderFormSection
        title="Thông tin hàng hóa"
        icon="cube-outline"
        description="Mô tả lô hàng để hệ thống kiểm tra điều kiện vận chuyển."
      >
        <CreateOrderTextField
          field="itemName"
          label="Tên hàng hóa"
          placeholder="Ví dụ: Nho Mỹ, vaccine, cá hồi..."
          value={itemName}
          error={errors.itemName}
          returnKeyType="next"
          onChangeText={onChangeItemName}
          onSubmitEditing={() => onSubmitField('itemName')}
          registerField={registerField}
          registerInput={registerInput}
        />

        <View className="flex-row gap-3">
          <View className="flex-1">
            <CreateOrderTextField
              field="expectedWeightKg"
              label="Khối lượng (kg)"
              placeholder="Ví dụ: 12.5"
              value={expectedWeightKg}
              error={errors.expectedWeightKg}
              keyboardType="numeric"
              returnKeyType="next"
              onChangeText={onChangeExpectedWeight}
              onSubmitEditing={() => onSubmitField('expectedWeightKg')}
              registerField={registerField}
              registerInput={registerInput}
            />
          </View>
          <View className="w-[112px]">
            <CreateOrderTextField
              field="quantity"
              label="Số kiện"
              placeholder="Ví dụ: 1"
              value={quantity}
              error={errors.quantity}
              keyboardType="numeric"
              onChangeText={onChangeQuantity}
              onSubmitEditing={() => onSubmitField('quantity')}
              registerField={registerField}
              registerInput={registerInput}
            />
          </View>
        </View>

        <View ref={(node) => registerField('category', node)} className="gap-2">
          <Text className="text-[13px] font-bold text-[#3A1F04]">
            Phân loại hàng hóa <Text className="text-red-600">*</Text>
          </Text>
          <View className="gap-2">
            {GOODS_TYPES.map((type) => {
              const selected = category === type.id;
              return (
                <Pressable
                  key={type.id}
                  onPress={() => onChangeCategory(type.id)}
                  accessibilityRole="radio"
                  accessibilityLabel={type.label}
                  accessibilityHint={type.description}
                  accessibilityState={{ selected }}
                  className={[
                    'min-h-[62px] flex-row items-center gap-3 rounded-[14px] border px-4 py-3',
                    selected ? 'border-[#8B4513] bg-[#8B4513]' : 'border-[#DAC2B6]/60 bg-[#F8F9FA]',
                  ].join(' ')}
                >
                  <View className={['h-9 w-9 items-center justify-center rounded-full', selected ? 'bg-white/15' : 'bg-[#F8F3EF]'].join(' ')}>
                    <Ionicons name={type.icon} size={19} color={selected ? '#FFC29F' : '#8B4513'} />
                  </View>
                  <View className="flex-1">
                    <Text className={['text-sm font-bold', selected ? 'text-white' : 'text-[#3A1F04]'].join(' ')}>
                      {type.label}
                    </Text>
                    <Text className={['mt-0.5 text-xs leading-5', selected ? 'text-white/75' : 'text-[#877369]'].join(' ')}>
                      {type.description}
                    </Text>
                  </View>
                  {selected ? <Ionicons name="checkmark-circle" size={20} color="#FFC29F" /> : null}
                </Pressable>
              );
            })}
          </View>
          {errors.category ? <FieldError message={errors.category} /> : null}
        </View>
      </CreateOrderFormSection>

      <CreateOrderFormSection
        title="Điều kiện bảo quản"
        icon="thermometer-outline"
        description="Chọn nhiệt độ yêu cầu trong phạm vi hệ thống hỗ trợ."
      >
        <View ref={(node) => registerField('tempCondition', node)} className="gap-3">
          <View className="flex-row items-center justify-between rounded-[14px] border border-[#DAC2B6]/60 bg-[#F8F9FA] p-3">
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
              <Text className="mt-1 text-[11px] font-semibold text-[#877369]">Nhiệt độ yêu cầu</Text>
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
      className={[
        'h-12 w-12 items-center justify-center rounded-xl border border-[#DAC2B6]/60 bg-white',
        disabled ? 'opacity-40' : '',
      ].join(' ')}
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
