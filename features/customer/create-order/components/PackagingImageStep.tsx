import React from 'react';
import { Image, Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import type {
  CreateOrderFieldKey,
  CreateOrderValidationErrors,
  DocumentImage,
} from '../createOrderValidation';
import {
  CreateOrderFormSection,
  CreateOrderTextField,
  type RegisterCreateOrderField,
  type RegisterCreateOrderInput,
} from './CreateOrderUi';

const PACKAGING_OPTIONS = [
  { label: 'Thùng carton', value: 'Carton Box' },
  { label: 'Thùng xốp giữ nhiệt', value: 'Foam Box' },
  { label: 'Thùng nhựa', value: 'Plastic Box' },
  { label: 'Pallet', value: 'Pallet' },
  { label: 'Thùng', value: 'Thùng' },
  { label: 'Bao', value: 'Bao' },
];

type PackagingImageStepProps = {
  packagingTypes: string[];
  lengthCm: string;
  widthCm: string;
  heightCm: string;
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
  onSubmitField: (field: CreateOrderFieldKey) => void;
};

export function PackagingImageStep({
  packagingTypes,
  lengthCm,
  widthCm,
  heightCm,
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
  onSubmitField,
}: PackagingImageStepProps) {
  const togglePackagingType = (value: string) => {
    onChangePackagingTypes(
      packagingTypes.includes(value)
        ? packagingTypes.filter((type) => type !== value)
        : [...packagingTypes, value]
    );
  };

  return (
    <View className="gap-4">
      <CreateOrderFormSection
        title="Quy cách đóng gói"
        icon="archive-outline"
        description="Chọn bao bì và nhập kích thước của mỗi kiện hàng."
      >
        <View ref={(node) => registerField('packagingType', node)} className="gap-2">
          <Text className="text-[13px] font-bold text-[#3A1F04]">
            Loại bao bì <Text className="text-red-600">*</Text>
          </Text>
          <Text className="text-xs leading-5 text-[#877369]">Có thể chọn nhiều loại phù hợp với lô hàng.</Text>
          <View className="flex-row flex-wrap gap-2">
            {PACKAGING_OPTIONS.map((option) => {
              const selected = packagingTypes.includes(option.value);
              return (
                <Pressable
                  key={option.value}
                  onPress={() => togglePackagingType(option.value)}
                  accessibilityRole="checkbox"
                  accessibilityLabel={option.label}
                  accessibilityState={{ checked: selected }}
                  className={[
                    'min-h-11 flex-row items-center justify-center gap-1.5 rounded-full border px-4',
                    selected ? 'border-[#8B4513] bg-[#8B4513]' : 'border-[#DAC2B6]/60 bg-[#F8F9FA]',
                  ].join(' ')}
                >
                  {selected ? <Ionicons name="checkmark" size={15} color="#FFC29F" /> : null}
                  <Text className={['text-[13px] font-bold', selected ? 'text-white' : 'text-[#3A1F04]'].join(' ')}>
                    {option.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          {errors.packagingType ? <FieldError message={errors.packagingType} /> : null}
        </View>

        <View className="gap-2">
          <Text className="text-[13px] font-bold text-[#3A1F04]">
            Kích thước kiện hàng <Text className="text-red-600">*</Text>
          </Text>
          <View className="flex-row gap-2">
            <View className="flex-1">
              <CreateOrderTextField
                field="lengthCm"
                label="Dài (cm)"
                placeholder="Dài"
                value={lengthCm}
                error={errors.lengthCm}
                keyboardType="numeric"
                returnKeyType="next"
                onChangeText={onChangeLength}
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
                keyboardType="numeric"
                returnKeyType="next"
                onChangeText={onChangeWidth}
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
                keyboardType="numeric"
                onChangeText={onChangeHeight}
                onSubmitEditing={() => onSubmitField('heightCm')}
                registerField={registerField}
                registerInput={registerInput}
              />
            </View>
          </View>
        </View>

        {capacityWarning ? (
          <View className="flex-row items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-4">
            <Ionicons name="warning-outline" size={18} color="#B45309" />
            <Text className="flex-1 text-sm font-semibold leading-5 text-amber-800">{capacityWarning}</Text>
          </View>
        ) : null}
      </CreateOrderFormSection>

      <CreateOrderFormSection
        title="Ảnh lô hàng"
        icon="camera-outline"
        description="Dùng ảnh rõ kiện hàng để hỗ trợ bước kiểm duyệt."
      >
        <View ref={(node) => registerField('documentImage', node)} className="gap-3">
          {image ? (
            <>
              <Image
                source={{ uri: image.uri }}
                accessibilityLabel="Ảnh lô hàng đã chọn"
                className="h-44 w-full rounded-xl"
                resizeMode="cover"
              />
              <View className="flex-row gap-3">
                <Pressable
                  onPress={onPickImage}
                  accessibilityRole="button"
                  accessibilityLabel="Thay ảnh lô hàng"
                  className="min-h-11 flex-1 items-center justify-center rounded-xl bg-[#F8F3EF]"
                >
                  <Text className="text-sm font-bold text-[#8B4513]">Thay ảnh</Text>
                </Pressable>
                <Pressable
                  onPress={onRemoveImage}
                  accessibilityRole="button"
                  accessibilityLabel="Xóa ảnh lô hàng"
                  className="min-h-11 flex-1 items-center justify-center rounded-xl border border-[#DAC2B6]"
                >
                  <Text className="text-sm font-bold text-[#3A1F04]">Xóa ảnh</Text>
                </Pressable>
              </View>
            </>
          ) : (
            <Pressable
              onPress={onPickImage}
              accessibilityRole="button"
              accessibilityLabel="Thêm ảnh lô hàng"
              accessibilityHint="Chụp ảnh hoặc chọn ảnh rõ kiện hàng"
              className={[
                'min-h-[148px] items-center justify-center rounded-xl border-2 border-dashed px-5',
                errors.documentImage ? 'border-red-300 bg-red-50' : 'border-[#DAC2B6] bg-[#F8F9FA]',
              ].join(' ')}
            >
              <View className="h-12 w-12 items-center justify-center rounded-full bg-[#8B4513]/10">
                <Ionicons name="camera-outline" size={25} color="#8B4513" />
              </View>
              <Text className="mt-3 text-center text-sm font-bold text-[#3A1F04]">Thêm ảnh lô hàng</Text>
              <Text className="mt-1 text-center text-xs leading-5 text-[#877369]">
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

function FieldError({ message }: { message: string }) {
  return (
    <Text accessibilityLiveRegion="polite" className="text-xs font-medium text-red-600">
      {message}
    </Text>
  );
}

export function getPackagingTypeLabel(value: string) {
  return PACKAGING_OPTIONS.find((option) => option.value === value)?.label ?? value;
}
