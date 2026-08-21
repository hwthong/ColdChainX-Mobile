import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { colors } from '../../../constants/colors';
import type { QcMeasurementSummaryValue } from '../../../features/warehouse/inbound/inboundQcMeasurements';

interface QcMeasurementSummaryProps {
  summary: QcMeasurementSummaryValue;
}

export function QcMeasurementSummary({ summary }: QcMeasurementSummaryProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Tổng kết</Text>
      <View style={styles.row}>
        <SummaryValue label="Tổng số kiện" value={formatNumber(summary.totalQuantity)} unit="kiện" />
        <SummaryValue label="Tổng khối lượng" value={formatNumber(summary.totalWeightKg)} unit="kg" />
        <SummaryValue label="Tổng thể tích" value={formatNumber(summary.totalCbm, 4)} unit="m³" />
      </View>
    </View>
  );
}

function SummaryValue({ label, value, unit }: { label: string; value: string; unit: string }) {
  return (
    <View style={styles.valueBlock}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value} numberOfLines={1} adjustsFontSizeToFit>
        {value} <Text style={styles.unit}>{unit}</Text>
      </Text>
    </View>
  );
}

function formatNumber(value: number, maximumFractionDigits = 2) {
  return new Intl.NumberFormat('vi-VN', { maximumFractionDigits }).format(value);
}

const styles = StyleSheet.create({
  container: {
    gap: 10,
    borderRadius: 14,
    backgroundColor: colors.brand.primarySoft,
    padding: 14,
  },
  heading: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text.primary,
  },
  row: {
    flexDirection: 'row',
    gap: 8,
  },
  valueBlock: {
    flex: 1,
    gap: 3,
  },
  label: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.text.secondary,
  },
  value: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.text.primary,
  },
  unit: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.text.secondary,
  },
});
