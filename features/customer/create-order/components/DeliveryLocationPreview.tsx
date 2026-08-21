import { Ionicons } from '@expo/vector-icons';
import React, { useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { GoongRouteMap } from '../../../../components/customer/GoongRouteMap';
import { colors } from '../../../../constants/colors';
import type { GoongPlaceDetail } from '../../../../services/goongPlacesApi';
import type { TripRouteResponse } from '../../../../services/trackingApi';
import { isValidPhoneNumber } from '../createOrderValidation';

type DeliveryLocationPreviewProps = {
  location: GoongPlaceDetail;
  initialReceiverName?: string;
  initialReceiverPhone?: string;
  onConfirm: (payload: { receiverName: string; receiverPhone: string }) => void;
};

export function DeliveryLocationPreview({
  location,
  initialReceiverName = '',
  initialReceiverPhone = '',
  onConfirm,
}: DeliveryLocationPreviewProps) {
  const insets = useSafeAreaInsets();
  const [receiverName, setReceiverName] = useState(initialReceiverName);
  const [receiverPhone, setReceiverPhone] = useState(initialReceiverPhone);
  const [touched, setTouched] = useState<{ name?: boolean; phone?: boolean }>({});
  const [hasAttemptedSubmit, setHasAttemptedSubmit] = useState(false);

  const mapRoute = useMemo<TripRouteResponse>(() => ({
    tripId: `delivery-${location.placeId}`,
    overviewPolyline: null,
    totalDistanceMeters: 0,
    totalDurationSeconds: 0,
    origin: null,
    destination: {
      locationId: location.placeId,
      address: location.address,
      lat: location.latitude,
      lon: location.longitude,
    },
    waypointOrder: [],
    optimizedStops: [],
  }), [location]);

  // Field validation
  const nameTrimmed = receiverName.trim();
  const nameError = useMemo(() => {
    if (!touched.name && !hasAttemptedSubmit) return undefined;
    if (!nameTrimmed) return 'Vui lòng nhập họ tên người nhận.';
    if (nameTrimmed.length > 100) return 'Họ tên người nhận không được vượt quá 100 ký tự.';
    return undefined;
  }, [nameTrimmed, touched.name, hasAttemptedSubmit]);

  const phoneTrimmed = receiverPhone.trim();
  const phoneError = useMemo(() => {
    if (!touched.phone && !hasAttemptedSubmit) return undefined;
    if (!phoneTrimmed) return 'Vui lòng nhập số điện thoại người nhận.';
    if (!isValidPhoneNumber(phoneTrimmed)) return 'Vui lòng nhập số điện thoại từ 8–15 chữ số.';
    return undefined;
  }, [phoneTrimmed, touched.phone, hasAttemptedSubmit]);

  const isFormValid = Boolean(
    nameTrimmed &&
    nameTrimmed.length <= 100 &&
    phoneTrimmed &&
    isValidPhoneNumber(phoneTrimmed)
  );

  const handleConfirm = () => {
    setHasAttemptedSubmit(true);
    if (!isFormValid) return;
    onConfirm({
      receiverName: nameTrimmed,
      receiverPhone: phoneTrimmed,
    });
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? insets.top + 58 : 0}
      style={styles.container}
    >
      <View style={styles.mapContainer}>
        <GoongRouteMap route={mapRoute} isFullScreen showRouteDataNotice={false} />
      </View>

      <View style={[styles.confirmPanel, { paddingBottom: Math.max(insets.bottom, 16) + 4 }]}>
        <View style={styles.handle} />

        <ScrollView
          bounces={false}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {/* Section Header: Receiver Information */}
          <View style={styles.panelHeaderRow}>
            <View style={styles.panelHeaderBadge}>
              <Ionicons name="person" size={13} color={colors.brand.primary} />
            </View>
            <Text style={styles.sectionEyebrow}>Người nhận</Text>
          </View>

          {/* Field: Receiver Name */}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>
              Họ và tên <Text style={styles.required}>*</Text>
            </Text>
            <TextInput
              value={receiverName}
              onChangeText={(text) => {
                setReceiverName(text);
                if (!touched.name) setTouched((prev) => ({ ...prev, name: true }));
              }}
              onBlur={() => setTouched((prev) => ({ ...prev, name: true }))}
              placeholder="Nhập họ tên người nhận"
              placeholderTextColor={colors.text.muted}
              selectionColor={colors.brand.primary}
              returnKeyType="next"
              accessibilityLabel="Họ và tên người nhận"
              style={[
                styles.textInput,
                nameError ? styles.textInputError : null,
              ]}
            />
            {nameError ? (
              <Text accessibilityLiveRegion="polite" style={styles.fieldErrorText}>
                {nameError}
              </Text>
            ) : null}
          </View>

          {/* Field: Receiver Phone */}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>
              Số điện thoại <Text style={styles.required}>*</Text>
            </Text>
            <TextInput
              value={receiverPhone}
              onChangeText={(text) => {
                setReceiverPhone(text);
                if (!touched.phone) setTouched((prev) => ({ ...prev, phone: true }));
              }}
              onBlur={() => setTouched((prev) => ({ ...prev, phone: true }))}
              placeholder="Nhập số điện thoại"
              placeholderTextColor={colors.text.muted}
              selectionColor={colors.brand.primary}
              keyboardType="phone-pad"
              returnKeyType="done"
              accessibilityLabel="Số điện thoại người nhận"
              style={[
                styles.textInput,
                phoneError ? styles.textInputError : null,
              ]}
            />
            {phoneError ? (
              <Text accessibilityLiveRegion="polite" style={styles.fieldErrorText}>
                {phoneError}
              </Text>
            ) : null}
          </View>

          {/* Prominent Confirm CTA Button */}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Xác nhận điểm giao hàng"
            onPress={handleConfirm}
            style={({ pressed }) => [
              styles.confirmButton,
              hasAttemptedSubmit && !isFormValid ? styles.confirmButtonDisabled : null,
              pressed && isFormValid ? styles.confirmButtonPressed : null,
            ]}
          >
            <Ionicons name="checkmark-circle" size={20} color="#FFFFFF" />
            <Text style={styles.confirmButtonText}>Xác nhận điểm giao hàng</Text>
          </Pressable>
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.surface.page,
    flex: 1,
  },
  mapContainer: {
    flex: 1,
    minHeight: 120,
  },
  confirmPanel: {
    backgroundColor: colors.surface.card,
    borderTopColor: colors.border.default,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
    flexShrink: 0,
    paddingHorizontal: 20,
    paddingTop: 10,
    shadowColor: '#173B59',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 8,
  },
  handle: {
    alignSelf: 'center',
    backgroundColor: colors.border.default,
    borderRadius: 2,
    height: 4,
    marginBottom: 8,
    width: 38,
  },
  scrollContent: {
    gap: 12,
    paddingBottom: 8,
  },
  panelHeaderRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  panelHeaderBadge: {
    alignItems: 'center',
    backgroundColor: colors.brand.primarySoft,
    borderRadius: 6,
    height: 22,
    justifyContent: 'center',
    width: 22,
  },
  sectionEyebrow: {
    color: colors.text.primary,
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.2,
    textTransform: 'uppercase',
  },
  inputGroup: {
    gap: 5,
  },
  inputLabel: {
    color: colors.text.primary,
    fontSize: 13,
    fontWeight: '700',
  },
  required: {
    color: '#DC2626',
  },
  textInput: {
    backgroundColor: colors.surface.page,
    borderColor: colors.border.default,
    borderRadius: 14,
    borderWidth: 1,
    color: colors.text.primary,
    fontSize: 14,
    minHeight: 48,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  textInputError: {
    borderColor: '#FCA5A5',
    backgroundColor: '#FEF2F2',
  },
  fieldErrorText: {
    color: '#DC2626',
    fontSize: 12,
    fontWeight: '500',
    marginTop: 2,
  },
  confirmButton: {
    alignItems: 'center',
    backgroundColor: '#1E68A8',
    borderRadius: 16,
    flexDirection: 'row',
    gap: 8,
    height: 54,
    justifyContent: 'center',
    marginTop: 6,
    shadowColor: '#1E68A8',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 8,
  },
  confirmButtonPressed: {
    backgroundColor: '#174f80',
    transform: [{ scale: 0.99 }],
  },
  confirmButtonDisabled: {
    opacity: 0.65,
    shadowOpacity: 0,
  },
  confirmButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
});
