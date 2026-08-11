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

import { colors } from '../../../../constants/colors';
import { customerRadius } from '../../../../constants/customerTheme';
import {
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
  helperText?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  selected: boolean;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  rightElement?: ReactNode;
  onPress: () => void;
};

export function CreateOrderChoiceCard({
  title,
  subtitle,
  helperText,
  icon,
  selected,
  accessibilityLabel,
  accessibilityHint,
  rightElement,
  onPress,
}: CreateOrderChoiceCardProps) {
  return (
    <CustomerChoiceCard
      title={title}
      subtitle={subtitle}
      helperText={helperText}
      icon={icon}
      selected={selected}
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      rightElement={rightElement}
      onPress={onPress}
    />
  );
}

type CreateOrderTextFieldProps = {
  fieldKey?: CreateOrderFieldKey;
  field?: CreateOrderFieldKey;
  label: string;
  required?: boolean;
  placeholder?: string;
  value: string;
  error?: string;
  helperText?: string;
  keyboardType?: KeyboardTypeOptions;
  returnKeyType?: ReturnKeyTypeOptions;
  onChangeText: (value: string) => void;
  onBlur?: () => void;
  onSubmitEditing?: () => void;
  registerField: RegisterCreateOrderField;
  registerInput: RegisterCreateOrderInput;
};

export function CreateOrderTextField({
  fieldKey,
  field = fieldKey!,
  label,
  required = false,
  placeholder,
  value,
  error,
  helperText,
  registerField,
  registerInput,
  onChangeText,
  onBlur,
  onSubmitEditing,
  keyboardType = 'default',
  returnKeyType = 'next',
}: CreateOrderTextFieldProps) {
  const [isFocused, setIsFocused] = useState(false);

  return (
    <View ref={(node) => registerField(field, node)} className="gap-1.5">
      <Text style={{ color: colors.text.primary }} className="text-[13px] font-bold">
        {label} {required ? <Text className="text-red-600">*</Text> : null}
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
        selectionColor={colors.brand.primary}
        placeholder={placeholder}
        placeholderTextColor={colors.text.muted}
        accessibilityLabel={`${label}${required ? ', bắt buộc' : ''}`}
        accessibilityHint={error}
        style={{
          color: colors.text.primary,
          backgroundColor: colors.surface.card,
          borderColor: error ? '#FCA5A5' : isFocused ? colors.border.focus : colors.border.default,
          borderRadius: customerRadius.control,
          borderWidth: 1,
          minHeight: 48,
        }}
        className="px-4 text-[14px] font-medium"
      />
      {error ? (
        <Text accessibilityLiveRegion="polite" className="text-xs font-medium text-red-600">
          {error}
        </Text>
      ) : helperText ? (
        <Text style={{ color: colors.text.secondary }} className="text-xs leading-5">{helperText}</Text>
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
  isStepValid?: boolean;
};

export function CreateOrderBottomActionBar({
  currentStep,
  isLoading,
  bottomInset,
  onBack,
  onContinue,
  isStepValid = true,
}: CreateOrderBottomActionBarProps) {
  const isNextDisabled = !isStepValid || isLoading;
  const primaryLabel = currentStep === 4 ? 'Gửi đơn hàng' : 'Tiếp tục';
  const secondaryLabel = currentStep > 1 ? 'Quay lại' : undefined;

  return (
    <View
      style={{
        width: '100%',
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.surface.card,
        borderTopWidth: 1,
        borderTopColor: colors.border.default,
        paddingHorizontal: 20,
        paddingTop: 12,
        paddingBottom: Math.max(bottomInset, 12),
      }}
    >
      {secondaryLabel && onBack ? (
        <View style={{ flexBasis: '36%', flexGrow: 0, flexShrink: 0, marginRight: 12 }}>
          <Pressable
            disabled={isLoading}
            onPress={onBack}
            accessibilityRole="button"
            accessibilityLabel={secondaryLabel}
            style={({ pressed }) => ({
              width: '100%',
              height: 54,
              borderRadius: 14,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: pressed ? colors.brand.primarySoft : colors.surface.card,
              borderWidth: 1,
              borderColor: colors.brand.primary,
              opacity: isLoading ? 0.6 : 1,
            })}
          >
            <Text
              style={{
                color: colors.brand.primary,
                fontSize: 16,
                fontWeight: '700',
                includeFontPadding: false,
              }}
            >
              {secondaryLabel}
            </Text>
          </Pressable>
        </View>
      ) : null}

      <View style={{ flex: 1, minWidth: 0 }}>
        <Pressable
          disabled={isNextDisabled}
          onPress={onContinue}
          accessibilityRole="button"
          accessibilityLabel={primaryLabel}
          accessibilityState={{ disabled: isNextDisabled }}
          style={({ pressed }) => ({
            width: '100%',
            height: 54,
            borderRadius: 14,
            alignItems: 'center',
            justifyContent: 'center',
            flexDirection: 'row',
            gap: 8,
            backgroundColor: isNextDisabled
              ? colors.brand.primarySoft
              : pressed
              ? colors.brand.primaryPressed
              : colors.brand.primary,
            borderWidth: 1,
            borderColor: isNextDisabled
              ? colors.border.default
              : colors.brand.primary,
            opacity: 1,
          })}
        >
          <Text
            style={{
              color: isNextDisabled ? colors.text.secondary : '#FFFFFF',
              fontSize: 16,
              fontWeight: '700',
              opacity: 1,
              includeFontPadding: false,
            }}
          >
            {primaryLabel}
          </Text>
        </Pressable>
      </View>
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
        <View style={{ backgroundColor: colors.surface.card }} className="w-full rounded-3xl p-6 shadow-xl">
          <View className="items-center">
            <View className="mb-4 h-16 w-16 items-center justify-center rounded-full bg-emerald-50">
              <Ionicons name="checkmark-circle" size={42} color={colors.status.success.main} />
            </View>
            <Text style={{ color: colors.text.primary }} className="text-center text-xl font-bold">Gửi đơn hàng thành công</Text>
            <Text style={{ color: colors.text.secondary }} className="mt-2 text-center text-sm leading-6">
              Bộ phận Sales sẽ kiểm duyệt đơn hàng và gửi báo giá cho bạn.
            </Text>
          </View>

          <View
            style={{
              backgroundColor: colors.surface.selected,
              borderColor: colors.border.default,
              borderRadius: customerRadius.control,
              borderWidth: 1,
            }}
            className="my-6 gap-3 p-4"
          >
            <InfoRow label="Mã đơn hàng" value={data?.trackingCode || 'Đang cập nhật'} />
            <InfoRow label="Trạng thái" value={translateStatus(data?.status || 'PENDING_REVIEW')} />
          </View>

          <View className="gap-3">
            <Pressable
              onPress={onViewOrder}
              accessibilityRole="button"
              accessibilityLabel={data?.orderId ? 'Xem chi tiết đơn vừa tạo' : 'Xem trạng thái đơn vừa tạo'}
              style={{ backgroundColor: colors.brand.primary, borderRadius: 12, minHeight: 48 }}
              className="w-full items-center justify-center"
            >
              <Text style={{ color: colors.text.onPrimary }} className="text-[15px] font-bold">
                {data?.orderId ? 'Xem chi tiết đơn' : 'Xem trạng thái đơn'}
              </Text>
            </Pressable>
            <Pressable
              onPress={onCreateAnother}
              accessibilityRole="button"
              accessibilityLabel="Tạo đơn khác"
              style={{
                backgroundColor: colors.surface.card,
                borderColor: colors.brand.primary,
                borderRadius: 12,
                borderWidth: 1,
                minHeight: 48,
              }}
              className="w-full items-center justify-center"
            >
              <Text style={{ color: colors.brand.primary }} className="text-[15px] font-bold">Tạo đơn khác</Text>
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
      <Text style={{ color: colors.text.secondary }} className="text-[13px]">{label}</Text>
      <Text style={{ color: colors.brand.primary }} className="flex-1 text-right text-[13px] font-bold">{value}</Text>
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
