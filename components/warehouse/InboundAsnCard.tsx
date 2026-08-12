import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { AppPressable as Pressable } from '../AppPressable';
import { colors } from '../../constants/colors';
import { StatusBadge } from '../StatusBadge';
import type { InboundScheduleResponse } from '../../services/asnApi';

interface InboundAsnCardProps {
  asn: InboundScheduleResponse;
  isSelected?: boolean;
  onSelect: (asn: InboundScheduleResponse) => void;
}

export function InboundAsnCard({ asn, isSelected = false, onSelect }: InboundAsnCardProps) {
  const title = asn.itemName?.trim() || asn.asnCode;
  const dropoffTimeFormatted = formatDropoffTime(asn.requestedDropoffTime);
  const locationText = asn.destAddress?.trim() || asn.warehouseName?.trim() || 'Kho tiếp nhận';
  const customerDisplay = asn.customerName?.trim() || 'Khách hàng chưa rõ';

  const hasOperationalInfo = Boolean(
    (asn.quantity && asn.quantity > 0) ||
      (asn.expectedWeightKg && asn.expectedWeightKg > 0) ||
      asn.tempCondition?.trim()
  );

  return (
    <Pressable
      onPress={() => onSelect(asn)}
      style={({ pressed }) => [
        styles.card,
        isSelected && styles.cardSelected,
        pressed && styles.cardPressed,
      ]}
    >
      {/* ── 1. PRIMARY: Item Title + Status Badge ── */}
      <View style={styles.headerRow}>
        <View style={styles.titleContainer}>
          <Text style={styles.itemTitle} numberOfLines={1}>
            {title}
          </Text>
          <Text style={styles.asnCodeText}>{asn.asnCode}</Text>
        </View>
        <StatusBadge status={asn.status} showVietnameseLabel />
      </View>

      {/* ── 2. SECONDARY: Tracking & Location & Dropoff Time ── */}
      <View style={styles.detailSection}>
        {asn.trackingCode ? (
          <View style={styles.infoRow}>
            <Ionicons name="barcode-outline" size={14} color={colors.text.secondary} />
            <Text style={styles.infoText}>Mã theo dõi: {asn.trackingCode}</Text>
          </View>
        ) : null}

        <View style={styles.infoRow}>
          <Ionicons name="location-outline" size={14} color={colors.text.secondary} />
          <Text style={styles.infoText} numberOfLines={1}>
            {locationText}
          </Text>
        </View>

        <View style={styles.infoRow}>
          <Ionicons name="time-outline" size={14} color={colors.text.secondary} />
          <Text style={styles.infoText}>{dropoffTimeFormatted}</Text>
        </View>
      </View>

      {/* ── 3. OPERATIONAL METRICS: Quantity, Weight, Temperature ── */}
      {hasOperationalInfo ? (
        <View style={styles.metricsContainer}>
          {asn.quantity && asn.quantity > 0 ? (
            <View style={styles.metricBadge}>
              <Ionicons name="cube-outline" size={13} color={colors.brand.primary} />
              <Text style={styles.metricText}>{asn.quantity} kiện</Text>
            </View>
          ) : null}

          {asn.expectedWeightKg && asn.expectedWeightKg > 0 ? (
            <View style={styles.metricBadge}>
              <Ionicons name="scale-outline" size={13} color={colors.brand.primary} />
              <Text style={styles.metricText}>{asn.expectedWeightKg} kg</Text>
            </View>
          ) : null}

          {asn.tempCondition?.trim() ? (
            <View style={styles.metricBadge}>
              <Ionicons name="thermometer-outline" size={13} color={colors.brand.primary} />
              <Text style={styles.metricText}>{asn.tempCondition}</Text>
            </View>
          ) : null}
        </View>
      ) : null}

      {/* ── 4. FOOTER: Customer Name + Chevron Indicator ── */}
      <View style={styles.footerRow}>
        <View style={styles.customerContainer}>
          <Ionicons name="business-outline" size={14} color={colors.text.muted} />
          <Text style={styles.customerText} numberOfLines={1}>
            {customerDisplay}
          </Text>
        </View>
        <Ionicons
          name="chevron-forward"
          size={18}
          color={isSelected ? colors.brand.primary : colors.text.muted}
        />
      </View>
    </Pressable>
  );
}

function formatDropoffTime(value?: string | null): string {
  if (!value) return 'N/A';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const year = date.getFullYear();

  return `${hours}:${minutes} · ${day}/${month}/${year}`;
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border.default,
    backgroundColor: colors.surface.card,
    padding: 16,
    gap: 12,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 1,
  },
  cardSelected: {
    borderColor: colors.brand.primary,
    backgroundColor: colors.surface.selected,
    borderWidth: 1.5,
  },
  cardPressed: {
    opacity: 0.92,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  titleContainer: {
    flex: 1,
  },
  itemTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text.primary,
    letterSpacing: -0.2,
  },
  asnCodeText: {
    marginTop: 2,
    fontSize: 12,
    fontWeight: '600',
    color: colors.brand.primary,
  },
  detailSection: {
    gap: 6,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  infoText: {
    fontSize: 13,
    color: colors.text.secondary,
    flex: 1,
  },
  metricsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingTop: 4,
  },
  metricBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.brand.primarySoft,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  metricText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.text.primary,
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: colors.border.default,
    paddingTop: 10,
    marginTop: 2,
  },
  customerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  customerText: {
    fontSize: 12,
    color: colors.text.muted,
    fontWeight: '500',
  },
});
