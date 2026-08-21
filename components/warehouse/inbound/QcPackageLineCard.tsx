import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AppInput } from '../../AppInput';
import { colors } from '../../../constants/colors';
import type {
  QcPackageLineErrors,
  QcPackageLineField,
  QcPackageLineFormValue,
} from '../../../features/warehouse/inbound/inboundQcMeasurements';

interface QcPackageLineCardProps {
  index: number;
  line: QcPackageLineFormValue;
  errors?: QcPackageLineErrors;
  canRemove: boolean;
  onChange: (field: QcPackageLineField, value: string) => void;
  onRemove: () => void;
}

export function QcPackageLineCard({
  index,
  line,
  errors,
  canRemove,
  onChange,
  onRemove,
}: QcPackageLineCardProps) {
  const expectedReference = buildExpectedReference(line);

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.titleGroup}>
          <Text style={styles.title}>Quy cách {index + 1}</Text>
          {expectedReference ? <Text style={styles.expected}>{expectedReference}</Text> : null}
        </View>
        {canRemove ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Xóa quy cách ${index + 1}`}
            hitSlop={8}
            onPress={onRemove}
            style={styles.removeButton}
          >
            <Ionicons name="trash-outline" size={18} color={colors.status.danger.main} />
          </Pressable>
        ) : null}
      </View>

      <AppInput
        label="Tên quy cách"
        value={line.label}
        onChangeText={(value) => onChange('label', value)}
        placeholder={`Quy cách ${index + 1}`}
      />

      <View style={styles.twoColumns}>
        <AppInput
          label="Số lượng"
          value={line.quantity}
          onChangeText={(value) => onChange('quantity', value)}
          placeholder="0"
          keyboardType="number-pad"
          error={errors?.quantity}
        />
        <AppInput
          label="Tổng khối lượng thực tế (kg)"
          value={line.actualWeightKg}
          onChangeText={(value) => onChange('actualWeightKg', value)}
          placeholder="0"
          keyboardType="decimal-pad"
          error={errors?.actualWeightKg}
        />
      </View>

      <Text style={styles.dimensionLabel}>Kích thước mỗi kiện (cm)</Text>
      <View style={styles.threeColumns}>
        <AppInput
          label="Dài"
          value={line.lengthCm}
          onChangeText={(value) => onChange('lengthCm', value)}
          placeholder="0"
          keyboardType="decimal-pad"
          error={errors?.lengthCm}
        />
        <AppInput
          label="Rộng"
          value={line.widthCm}
          onChangeText={(value) => onChange('widthCm', value)}
          placeholder="0"
          keyboardType="decimal-pad"
          error={errors?.widthCm}
        />
        <AppInput
          label="Cao"
          value={line.heightCm}
          onChangeText={(value) => onChange('heightCm', value)}
          placeholder="0"
          keyboardType="decimal-pad"
          error={errors?.heightCm}
        />
      </View>
    </View>
  );
}

function buildExpectedReference(line: QcPackageLineFormValue) {
  if (!line.expectedQuantity && !line.expectedCapacityKg) return null;
  const quantity = line.expectedQuantity ? `${line.expectedQuantity} kiện` : null;
  const capacity = line.expectedCapacityKg ? `${line.expectedCapacityKg} kg/kiện` : null;
  return `Dự kiến: ${[quantity, capacity].filter(Boolean).join(' × ')}`;
}

const styles = StyleSheet.create({
  card: {
    gap: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border.default,
    backgroundColor: colors.surface.cardSoft,
    padding: 14,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  titleGroup: {
    flex: 1,
    gap: 2,
  },
  title: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text.primary,
  },
  expected: {
    fontSize: 12,
    color: colors.text.secondary,
  },
  removeButton: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.status.danger.bg,
  },
  twoColumns: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  threeColumns: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  dimensionLabel: {
    marginBottom: -6,
    fontSize: 12,
    fontWeight: '700',
    color: colors.text.secondary,
  },
});
