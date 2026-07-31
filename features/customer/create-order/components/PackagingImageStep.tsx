import React from 'react';
import { Image, Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { customerColors, customerRadius } from '../../../../constants/customerTheme';
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
          <Text className="text-[13px] font-bold text-[#3A1F04]">
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
                  className="flex-row items-center justify-center gap-1.5 px-4"
                  style={{
                    backgroundColor: selected ? customerColors.surfaceSoft : customerColors.surface,
                    borderColor: selected ? customerColors.primary : customerColors.border,
                    borderRadius: 999,
                    borderWidth: 1,
                    minHeight: 44,
                  }}
                >
                  {selected ? <Ionicons name="checkmark" size={15} color="#8B4513" /> : null}
                  <Text className={['text-[13px] font-bold', selected ? 'text-[#8B4513]' : 'text-[#3A1F04]'].join(' ')}>
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
        title="Kích thước kiện hàng"
        icon="resize-outline"
        description="Nhập kích thước của mỗi kiện để kiểm tra sức chứa."
      >
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
          <View className="flex-row items-start gap-2 rounded-2xl bg-[#FFF7ED] p-4">
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
                className="h-40 w-full rounded-2xl"
                resizeMode="cover"
              />
              <View className="flex-row gap-3">
                <Pressable
                  onPress={onPickImage}
                  accessibilityRole="button"
                  accessibilityLabel="Thay ảnh lô hàng"
                  className="min-h-11 flex-1 items-center justify-center rounded-2xl bg-[#F8F3EF]"
                >
                  <Text className="text-sm font-bold text-[#8B4513]">Thay ảnh</Text>
                </Pressable>
                <Pressable
                  onPress={onRemoveImage}
                  accessibilityRole="button"
                  accessibilityLabel="Xóa ảnh lô hàng"
                  className="flex-1 items-center justify-center"
                  style={{
                    backgroundColor: customerColors.surface,
                    borderColor: customerColors.border,
                    borderRadius: customerRadius.control,
                    borderWidth: 1,
                    minHeight: 44,
                  }}
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
              className="items-center justify-center px-5"
              style={{
                backgroundColor: errors.documentImage ? '#FEF2F2' : customerColors.surfaceNeutral,
                borderColor: errors.documentImage ? '#FCA5A5' : customerColors.border,
                borderRadius: customerRadius.control,
                borderStyle: 'dashed',
                borderWidth: 2,
                minHeight: 148,
              }}
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
