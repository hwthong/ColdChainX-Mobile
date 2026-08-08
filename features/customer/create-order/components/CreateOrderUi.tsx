import React, { useState, type ReactNode } from 'react';
import {
  Modal,
  Pressable,
  Text,
  TextInput,
  View,
  type KeyboardTypeOptions,
  type ReturnKeyTypeOptions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { customerColors, customerControl, customerRadius } from '../../../../constants/customerTheme';
import {
  CustomerBottomActionBar,
  CustomerCard,
  CustomerChoiceCard,
  CustomerSectionHeader,
} from '../../../../components/customer/ui/CustomerUi';
import type { CreateOrderFieldKey } from '../createOrderValidation';

export type CreateOrderSuccessData = {
  orderId: string;
  trackingCode: string;
  status: string;
  documentUrl?: string | null;
};

export type RegisterCreateOrderField = (field: CreateOrderFieldKey, node: View | null) => void;
export type RegisterCreateOrderInput = (field: CreateOrderFieldKey, node: TextInput | null) => void;

type CreateOrderFormSectionProps = {
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  description?: string;
  children: ReactNode;
};

export function CreateOrderFormSection({
  title,
  icon,
  description,
  children,
}: CreateOrderFormSectionProps) {
  return (
    <CustomerCard>
      <View className="gap-5">
        <CustomerSectionHeader title={title} icon={icon} description={description} />
        {children}
      </View>
    </CustomerCard>
  );
}

type CreateOrderChoiceCardProps = {
  title: string;
  subtitle?: string;
  selected: boolean;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  selectionMode?: 'radio' | 'checkbox';
  leading?: ReactNode;
  trailingContent?: ReactNode;
  onPress: () => void;
};

export function CreateOrderChoiceCard({
  title,
  subtitle,
  selected,
  accessibilityLabel,
  accessibilityHint,
  selectionMode = 'radio',
  leading,
  trailingContent,
  onPress,
}: CreateOrderChoiceCardProps) {
  return (
    <CustomerChoiceCard
      title={title}
      description={subtitle}
      selected={selected}
      leading={leading}
      trailingContent={trailingContent}
      selectionMode={selectionMode}
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      onPress={onPress}
    />
  );
}

type CreateOrderTextFieldProps = {
  field: CreateOrderFieldKey;
  label: string;
  placeholder: string;
  value: string;
  onChangeText: (value: string) => void;
  error?: string;
  keyboardType?: KeyboardTypeOptions;
  returnKeyType?: ReturnKeyTypeOptions;
  onSubmitEditing?: () => void;
  onBlur?: () => void;
  helperText?: string;
  registerField: RegisterCreateOrderField;
  registerInput: RegisterCreateOrderInput;
};

export function CreateOrderTextField({
  field,
  label,
  placeholder,
  value,
  onChangeText,
  error,
  keyboardType = 'default',
  returnKeyType = 'done',
  onSubmitEditing,
  onBlur,
  helperText,
  registerField,
  registerInput,
}: CreateOrderTextFieldProps) {
  const [isFocused, setIsFocused] = useState(false);

  return (
    <View ref={(node) => registerField(field, node)} className="gap-1.5">
      <Text className="text-[13px] font-bold text-[#3A1F04]">
        {label} <Text className="text-red-600">*</Text>
      </Text>
      <TextInput
        ref={(node) => registerInput(field, node)}
        value={value}
        onChangeText={onChangeText}
        keyboardType={keyboardType}
        returnKeyType={returnKeyType}
        blurOnSubmit={returnKeyType !== 'next'}
        onSubmitEditing={onSubmitEditing}
        onFocus={() => setIsFocused(true)}
        onBlur={() => {
          setIsFocused(false);
          onBlur?.();
        }}
        selectionColor="#8B4513"
        placeholder={placeholder}
        placeholderTextColor="#877369"
        accessibilityLabel={`${label}, bắt buộc`}
        accessibilityHint={error}
        className="px-4 text-[14px] font-medium text-[#3A1F04]"
        style={{
          backgroundColor: customerColors.surface,
          borderColor: error ? '#FCA5A5' : isFocused ? customerColors.primary : customerColors.border,
          borderRadius: customerRadius.control,
          borderWidth: 1,
          minHeight: customerControl.height,
        }}
      />
      {error ? (
        <Text accessibilityLiveRegion="polite" className="text-xs font-medium text-red-600">
          {error}
        </Text>
      ) : helperText ? (
        <Text className="text-xs leading-5 text-[#877369]">{helperText}</Text>
      ) : null}
    </View>
  );
}

type CreateOrderBottomActionBarProps = {
  currentStep: number;
  isLoading: boolean;
  bottomInset: number;
  onBack: () => void;
  onContinue: () => void;
};

export function CreateOrderBottomActionBar({
  currentStep,
  isLoading,
  bottomInset,
  onBack,
  onContinue,
}: CreateOrderBottomActionBarProps) {
  return (
    <CustomerBottomActionBar
      primaryLabel={currentStep === 4 ? 'Gửi yêu cầu vận chuyển' : 'Tiếp tục'}
      primaryLoading={isLoading}
      onPrimaryPress={onContinue}
      secondaryLabel={currentStep > 1 ? 'Quay lại' : undefined}
      onSecondaryPress={currentStep > 1 ? onBack : undefined}
      bottomInset={bottomInset}
    />
  );
}

type CreateOrderSuccessModalProps = {
  data: CreateOrderSuccessData | null;
  onViewOrder: () => void;
  onCreateAnother: () => void;
};

export function CreateOrderSuccessModal({
  data,
  onViewOrder,
  onCreateAnother,
}: CreateOrderSuccessModalProps) {
  return (
    <Modal visible={Boolean(data)} transparent animationType="fade">
      <View className="flex-1 items-center justify-center bg-black/60 px-5">
        <View className="w-full rounded-3xl bg-white p-6">
          <View className="items-center">
            <View className="mb-4 h-16 w-16 items-center justify-center rounded-full bg-emerald-50">
              <Ionicons name="checkmark-circle" size={42} color="#15803D" />
            </View>
            <Text className="text-center text-xl font-bold text-[#3A1F04]">Gửi yêu cầu thành công</Text>
            <Text className="mt-2 text-center text-sm leading-6 text-[#877369]">
              Bộ phận Sales sẽ kiểm duyệt yêu cầu và gửi báo giá cho bạn.
            </Text>
          </View>

          <View
            className="my-6 gap-3 p-4"
            style={{
              backgroundColor: customerColors.surfaceNeutral,
              borderColor: customerColors.borderSubtle,
              borderRadius: customerRadius.control,
              borderWidth: 1,
            }}
          >
            <InfoRow label="Mã yêu cầu" value={data?.trackingCode || 'Đang cập nhật'} />
            <InfoRow label="Trạng thái" value={translateStatus(data?.status || 'PENDING_REVIEW')} />
          </View>

          <View className="gap-3">
            <Pressable
              onPress={onViewOrder}
              accessibilityRole="button"
              accessibilityLabel={data?.orderId ? 'Xem chi tiết đơn vừa tạo' : 'Xem trạng thái đơn vừa tạo'}
              className="w-full items-center justify-center"
              style={{ backgroundColor: customerColors.primary, borderRadius: 12, minHeight: 48 }}
            >
              <Text className="text-[15px] font-bold text-white">
                {data?.orderId ? 'Xem chi tiết đơn' : 'Xem trạng thái đơn'}
              </Text>
            </Pressable>
            <Pressable
              onPress={onCreateAnother}
              accessibilityRole="button"
              accessibilityLabel="Tạo đơn khác"
              className="w-full items-center justify-center"
              style={{
                backgroundColor: customerColors.surface,
                borderColor: customerColors.primary,
                borderRadius: 12,
                borderWidth: 1,
                minHeight: 48,
              }}
            >
              <Text className="text-[15px] font-bold text-[#8B4513]">Tạo đơn khác</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row items-center justify-between gap-4">
      <Text className="text-[13px] text-[#877369]">{label}</Text>
      <Text className="flex-1 text-right text-[13px] font-bold text-[#8B4513]">{value}</Text>
    </View>
  );
}

function translateStatus(status: string) {
  switch (status.toUpperCase()) {
    case 'PENDING':
    case 'PENDING_REVIEW':
      return 'Chờ duyệt';
    case 'APPROVED':
      return 'Đã duyệt';
    case 'LOADING':
      return 'Đang chuẩn bị xuất kho';
    case 'IN_TRANSIT':
      return 'Đang giao';
    case 'DELIVERED':
      return 'Đã giao';
    case 'CANCELLED':
      return 'Đã hủy';
    default:
      return status;
  }
}
