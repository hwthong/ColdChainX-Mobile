import React, { useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  Text,
  TextInput,
  View,
  type KeyboardTypeOptions,
  type ReturnKeyTypeOptions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

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
    <View className="gap-4 rounded-2xl border border-[#DAC2B6]/50 bg-white p-5">
      <View className="border-b border-[#DAC2B6]/30 pb-3">
        <View className="flex-row items-center gap-2">
          <Ionicons name={icon} size={18} color="#8B4513" />
          <Text className="text-base font-bold text-[#3A1F04]">{title}</Text>
        </View>
        {description ? <Text className="mt-1.5 text-xs leading-5 text-[#877369]">{description}</Text> : null}
      </View>
      {children}
    </View>
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
        onBlur={() => setIsFocused(false)}
        selectionColor="#8B4513"
        placeholder={placeholder}
        placeholderTextColor="#877369"
        accessibilityLabel={`${label}, bắt buộc`}
        accessibilityHint={error}
        className={[
          'min-h-[52px] rounded-[14px] border bg-[#F8F9FA] px-4 text-[14px] font-medium text-[#3A1F04]',
          error ? 'border-red-300' : isFocused ? 'border-[#8B4513]' : 'border-[#DAC2B6]/60',
        ].join(' ')}
      />
      {error ? (
        <Text accessibilityLiveRegion="polite" className="text-xs font-medium text-red-600">
          {error}
        </Text>
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
  const isReviewStep = currentStep === 4;

  return (
    <View
      className="absolute inset-x-0 bottom-0 z-30 flex-row gap-3 border-t border-[#DAC2B6]/50 bg-[#F5F2F0] px-5 pt-4"
      style={{ paddingBottom: Math.max(bottomInset, 16) }}
    >
      {currentStep > 1 ? (
        <Pressable
          onPress={onBack}
          disabled={isLoading}
          accessibilityRole="button"
          accessibilityLabel="Quay lại bước trước"
          accessibilityState={{ disabled: isLoading }}
          className={[
            'min-h-14 items-center justify-center rounded-2xl border border-[#8B4513] px-5',
            isLoading ? 'opacity-60' : '',
          ].join(' ')}
        >
          <Text className="text-base font-bold text-[#8B4513]">Quay lại</Text>
        </Pressable>
      ) : null}
      <Pressable
        onPress={onContinue}
        disabled={isLoading}
        accessibilityRole="button"
        accessibilityLabel={isReviewStep ? 'Gửi yêu cầu vận chuyển' : 'Tiếp tục'}
        accessibilityState={{ disabled: isLoading }}
        className={[
          'min-h-14 flex-1 flex-row items-center justify-center gap-2 rounded-2xl bg-[#8B4513]',
          isLoading ? 'opacity-70' : '',
        ].join(' ')}
      >
        {isLoading ? <ActivityIndicator color="#FFC29F" /> : null}
        <Text className="text-base font-bold text-white">
          {isLoading ? 'Đang gửi yêu cầu...' : isReviewStep ? 'Gửi yêu cầu vận chuyển' : 'Tiếp tục'}
        </Text>
      </Pressable>
    </View>
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

          <View className="my-6 gap-3 rounded-2xl border border-[#DAC2B6]/40 bg-[#F8F9FA] p-4">
            <InfoRow label="Mã yêu cầu" value={data?.trackingCode || 'Đang cập nhật'} />
            <InfoRow label="Trạng thái" value={translateStatus(data?.status || 'PENDING_REVIEW')} />
          </View>

          <View className="gap-3">
            <Pressable
              onPress={onViewOrder}
              accessibilityRole="button"
              accessibilityLabel={data?.orderId ? 'Xem chi tiết đơn vừa tạo' : 'Xem trạng thái đơn vừa tạo'}
              className="min-h-12 w-full items-center justify-center rounded-xl bg-[#8B4513]"
            >
              <Text className="text-[15px] font-bold text-white">
                {data?.orderId ? 'Xem chi tiết đơn' : 'Xem trạng thái đơn'}
              </Text>
            </Pressable>
            <Pressable
              onPress={onCreateAnother}
              accessibilityRole="button"
              accessibilityLabel="Tạo đơn khác"
              className="min-h-12 w-full items-center justify-center rounded-xl border border-[#8B4513] bg-white"
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
